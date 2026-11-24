import bpy, sys, bmesh, math
# 사건 파일 Tripo 모델 줄이기 + 텍스처 굽기 + 멀리용 LOD (#262). bake-prop.py 와 같은 방식(DIFFUSE 굽기)에, 같은 UV 를 쓰는 LOD 를 하나 더 내보냄
# 사용: python3 model/bake-case.py <원본.glb> <삼각형 수> <텍스처 크기> <LOD 삼각형 수> <LOD 텍스처 크기> <출력.glb> <LOD 출력.glb>
SRC, TARGET, TEX, LODT, LODTEX, OUT, OUTLOD = sys.argv[-7], int(sys.argv[-6]), int(sys.argv[-5]), int(sys.argv[-4]), int(sys.argv[-3]), sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
hi = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = hi; hi.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.duplicate(); lo = bpy.context.active_object; lo.name = 'prop'
hi.select_set(False)
for ms in hi.data.materials:
  if not ms or not ms.use_nodes: continue
  for n in ms.node_tree.nodes:
    if n.type == 'BSDF_PRINCIPLED':
      for l in list(n.inputs['Metallic'].links): ms.node_tree.links.remove(l)
      n.inputs['Metallic'].default_value = 0.0
bm = bmesh.new(); bm.from_mesh(lo.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(lo.data); bm.free()
while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
tris = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
m = lo.modifiers.new('dec', 'DECIMATE'); m.ratio = TARGET / max(1, tris(lo))
bpy.ops.object.modifier_apply(modifier='dec')
print('lo tris', tris(lo))
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth()
img = bpy.data.images.new('bake', TEX, TEX, alpha=False)
mat = bpy.data.materials.new('prop'); mat.use_nodes = True
nt = mat.node_tree; bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
nt.nodes.active = tex
lo.data.materials.clear(); lo.data.materials.append(mat)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1
b = sc.render.bake; b.use_pass_direct = False; b.use_pass_indirect = False; b.use_pass_color = True
b.use_selected_to_active = True; b.cage_extrusion = 0.02; b.max_ray_distance = 0.06; b.margin = 6
hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type='DIFFUSE')
hi.select_set(False); bpy.data.objects.remove(hi)
for o in bpy.context.scene.objects: o.select_set(False)
lo.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85, use_selection=True, export_apply=True, export_normals=True)
# 멀리용: 같은 UV 를 지닌 채 더 줄이고, 텍스처는 작게
bpy.ops.object.duplicate(); far = bpy.context.active_object
m = far.modifiers.new('dec', 'DECIMATE'); m.ratio = LODT / max(1, tris(far))
bpy.ops.object.modifier_apply(modifier='dec')
print('lod tris', tris(far))
small = bpy.data.images.new('small', img.size[0], img.size[1]); small.pixels = list(img.pixels); small.scale(LODTEX, LODTEX) # #295: img.copy() 는 굽는 그림을 못 옮겨 검게 나왔음. 못 믿으면 model/lotex.py 로 다시 채움
m2 = mat.copy(); m2.node_tree.nodes.active.image = small
far.data = far.data.copy(); far.data.materials.clear(); far.data.materials.append(m2)
for o in bpy.context.scene.objects: o.select_set(False)
far.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUTLOD, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=80, use_selection=True, export_apply=True, export_normals=True)
print('done')
