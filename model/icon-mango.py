import bpy, sys, math
# 망고 아이콘 굽기 (#305): 줄인 망고 모델(bake-case.py 결과 glb)을 투명 바탕에 비스듬히 찍음 → src/mangoicon.js (아래 쓰는 법)
# 사용: python3 model/icon-mango.py <mango.glb> <출력.png> [크기]
#   python3 -c "import base64;print(\"export const MANGO_ICON = 'data:image/png;base64,\"+base64.b64encode(open('<출력.png>','rb').read()).decode()+\"';\")" > src/mangoicon.js
F, OUT = sys.argv[-3] if sys.argv[-1].isdigit() else sys.argv[-2], sys.argv[-2] if sys.argv[-1].isdigit() else sys.argv[-1]
N = int(sys.argv[-1]) if sys.argv[-1].isdigit() else 96
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=F)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'
sc.render.resolution_x = sc.render.resolution_y = N; sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.55
obj = [o for o in sc.objects if o.type == 'MESH'][0]; bpy.context.view_layer.objects.active = obj; obj.select_set(True)
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS'); obj.location = (0, 0, 0); obj.rotation_mode = 'XYZ'; obj.rotation_euler = (0, math.radians(-32), math.radians(25))
sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 1.6; so = bpy.data.objects.new('s', sun); so.rotation_euler = (0.6, 0.3, 0.5); sc.collection.objects.link(so)
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 1.08
co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); co.location = (0, -5, 0); co.rotation_euler = (math.pi / 2, 0, 0); sc.camera = co
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
