import bpy, sys, bmesh, math
# Tripo 모델 줄이기 + 텍스처 다시 굽기 (#71: 들개·외계인·가게 건물). bake-boar.py 와 같은 방식에 모서리 각도(건물은 각지게)를 더함
# 사용: python3 model/bake-prop.py <원본.glb> <삼각형 수> <텍스처 크기> <매끈 각도(도, 180=모두 매끈)> <출력.glb>
SRC, TARGET, TEX, ANG, OUT = sys.argv[-5], int(sys.argv[-4]), int(sys.argv[-3]), float(sys.argv[-2]), sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
hi = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = hi; hi.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.duplicate(); lo = bpy.context.active_object; lo.name = 'prop'
hi.select_set(False)
# 금속 재질은 DIFFUSE 굽기에서 검게 나오므로 금속성을 끔 (외계인 비행접시)
for ms in hi.data.materials:
  if not ms or not ms.use_nodes: continue
  for n in ms.node_tree.nodes:
    if n.type == 'BSDF_PRINCIPLED':
      for l in list(n.inputs['Metallic'].links): ms.node_tree.links.remove(l)
      n.inputs['Metallic'].default_value = 0.0
bm = bmesh.new(); bm.from_mesh(lo.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(lo.data); bm.free()
while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
tris = lambda: sum(len(p.vertices) - 2 for p in lo.data.polygons)
print('lo tris before', tris())
m = lo.modifiers.new('dec', 'DECIMATE'); m.ratio = TARGET / max(1, tris())
bpy.ops.object.modifier_apply(modifier='dec')
print('lo tris after', tris())
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')
if ANG >= 180: bpy.ops.object.shade_smooth()
else: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(ANG))
img = bpy.data.images.new('bake', TEX, TEX, alpha=False)
mat = bpy.data.materials.new('prop'); mat.use_nodes = True
nt = mat.node_tree; bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.8
nt.nodes.active = tex
lo.data.materials.clear(); lo.data.materials.append(mat)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1
b = sc.render.bake; b.use_pass_direct = False; b.use_pass_indirect = False; b.use_pass_color = True
b.use_selected_to_active = True; b.cage_extrusion = 0.02; b.max_ray_distance = 0.06; b.margin = 6
hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type='DIFFUSE')
hi.select_set(False); bpy.data.objects.remove(hi)
lo.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=82, use_selection=True, export_apply=True, export_normals=True)
print('done')
