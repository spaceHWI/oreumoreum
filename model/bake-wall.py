import bpy, sys, bmesh
# 돌담 조각 (#39): Tripo 원본 → 가까이용(촘촘한 껍데기) + 멀리용(상자에 가까운 껍데기) 두 벌, 각각 텍스처 굽기
# 원본을 바로 줄이면(Decimate) 뒤집힌 면·검은 얼룩이 생겨, 원본 크기 상자를 칸으로 나눠 겉면에 붙이는 방식으로 만든다
# python3 model/bake-wall.py <원본.glb> <가까이 삼각형> <가까이 텍스처> <멀리 텍스처> <가까이.glb> <멀리.glb>
SRC, NEAR, TEXN, TEXF, OUTN, OUTF = sys.argv[-6], int(sys.argv[-5]), int(sys.argv[-4]), int(sys.argv[-3]), sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
hi = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
for o in bpy.context.scene.objects: o.select_set(o == hi)
bpy.context.view_layer.objects.active = hi
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# 가운데 정렬: 길이(x)·두께(y) 가운데, 바닥 z=0
ws = [v.co for v in hi.data.vertices]
mn = [min(w[i] for w in ws) for i in range(3)]; mx = [max(w[i] for w in ws) for i in range(3)]
for v in hi.data.vertices: v.co.x -= (mn[0] + mx[0]) / 2; v.co.y -= (mn[1] + mx[1]) / 2; v.co.z -= mn[2]
DX, DY, DZ = mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]
print('dims', DX, DY, DZ)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1
b = sc.render.bake; b.use_pass_direct = False; b.use_pass_indirect = False; b.use_pass_color = True
b.use_selected_to_active = True; b.margin = 8

def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)

def finish(lo, tex, out, cage, ray):
    while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
    for o in bpy.context.scene.objects: o.select_set(o == lo)
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.008)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new('bake_' + lo.name, tex, tex, alpha=False)
    mat = bpy.data.materials.new(lo.name); mat.use_nodes = True
    nt = mat.node_tree; bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9; nt.nodes.active = t
    lo.data.materials.clear(); lo.data.materials.append(mat)
    b.cage_extrusion = cage; b.max_ray_distance = ray
    hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
    bpy.ops.object.bake(type='DIFFUSE')
    hi.select_set(False)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=86, use_selection=True, export_apply=True, export_normals=True)
    print(lo.name, 'tris', tris(lo))

def shell(name, nx, ny, nz):
    # 원본 크기 상자를 칸으로 나눠(바닥 없음) 원본 겉면에 붙임 → 틈·뒤집힌 면 없는 껍데기
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.active_object; o.name = name
    o.scale = (DX * 0.98, DY * 0.95, DZ * 0.98); o.location = (0, 0, DZ * 0.49)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new(); bm.from_mesh(o.data)
    for axis, cuts in ((0, nx - 1), (1, ny - 1), (2, nz - 1)):
        if cuts > 0: bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co[axis] - e.verts[1].co[axis]) > 1e-4], cuts=cuts, use_grid_fill=True)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.9], context='FACES')
    bm.to_mesh(o.data); bm.free()
    sw = o.modifiers.new('sw', 'SHRINKWRAP'); sw.target = hi; sw.wrap_method = 'NEAREST_SURFACEPOINT'
    bpy.ops.object.modifier_apply(modifier='sw')
    for v in o.data.vertices:
        if v.co.z < DZ * 0.02: v.co.z = 0  # 바닥 둘레는 바닥에
    return o

# 가까이용: 칸을 촘촘히 (길이 NX·두께 2·높이 5 칸, NX=15 면 400 삼각형)
NX = max(4, round((NEAR / 2 - 20) / 12))
near = shell('wall_near', NX, 2, 5)
bpy.ops.object.shade_smooth()
finish(near, TEXN, OUTN, 0.02, 0.1)

# 멀리용: 길이 4·높이 2·두께 1 칸
far = shell('wall_far', 4, 1, 2)
bpy.ops.object.shade_flat()
finish(far, TEXF, OUTF, 0.03, 0.12)
print('done')
