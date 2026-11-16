# 머리 모델(#51): 원본 캐릭터 glb 에서 목 위 머리만 떼어 지금 몸(model/lo4.glb)에 맞춰 줄이고 텍스처를 다시 굽는다
# python3 model/bake-head.py 원본.glb 삼각형수 텍스처크기 출력.glb   (pip install bpy)
# - 크기: 팔 끝(T포즈 |x| 최대)을 지금 몸(0.4786)에 맞춤 → 목 높이가 같아짐
# - 앞뒤: 턱 앞(y 0.61)을 지금 몸 턱 앞(z 0.228)에 맞춤
# - 자르기: y CUT 아래·|x| 0.3 밖(T포즈 팔) 정점은 버림 (몸 셰이더가 y 0.595 위를 감추므로 조금 겹치게)
# 그다음 node model/extract-gear.js 출력.glb head-<이름> 으로 src/gear/head-<이름>.js 를 만든다
import bpy, bmesh, sys
import numpy as np
SRC, TARGET, TEX, OUT = sys.argv[-4], int(sys.argv[-3]), int(sys.argv[-2]), sys.argv[-1]
REF_SPAN, REF_CHIN_Z, CHIN_Y, CUT = 0.4786, 0.228, 0.61, 0.565
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
hi = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = hi; hi.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# 블렌더 좌표 (x, y, z) = glTF (x, -z, y)
V = np.array([v.co[:] for v in hi.data.vertices]); G = np.stack([V[:, 0], V[:, 2], -V[:, 1]], 1)
s = REF_SPAN / np.abs(G[:, 0]).max(); Q = G * s
m = (np.abs(Q[:, 1] - CHIN_Y) < 0.005) & (np.abs(Q[:, 0]) < 0.06)
dz = REF_CHIN_Z - Q[m, 2].max()
print('fit scale %.4f dz %.4f' % (s, dz))
hi.scale = (s, s, s); hi.location = (0, -dz, 0)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bm = bmesh.new(); bm.from_mesh(hi.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < CUT or abs(v.co.x) > 0.3], context='VERTS') # 팔 윗면 제외
bm.to_mesh(hi.data); bm.free()
bpy.ops.object.duplicate(); lo = bpy.context.active_object; lo.name = 'head'
hi.select_set(False)
bm = bmesh.new(); bm.from_mesh(lo.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(lo.data); bm.free()
while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
n0 = sum(len(p.vertices) - 2 for p in lo.data.polygons)
d = lo.modifiers.new('dec', 'DECIMATE'); d.ratio = TARGET / max(1, n0)
bpy.ops.object.modifier_apply(modifier='dec')
print('tris', n0, '->', sum(len(p.vertices) - 2 for p in lo.data.polygons))
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.01)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth()
img = bpy.data.images.new('bake', TEX, TEX, alpha=False)
mat = bpy.data.materials.new('head'); mat.use_nodes = True
nt = mat.node_tree; bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
nt.nodes.active = tex
lo.data.materials.clear(); lo.data.materials.append(mat)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1
b = sc.render.bake; b.use_pass_direct = False; b.use_pass_indirect = False; b.use_pass_color = True
b.use_selected_to_active = True; b.cage_extrusion = 0.012; b.max_ray_distance = 0.03; b.margin = 16
hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type='DIFFUSE')
hi.select_set(False); bpy.data.objects.remove(hi)
lo.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85, use_selection=True, export_apply=True, export_normals=True)
print('done')
