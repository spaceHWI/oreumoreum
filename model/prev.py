import bpy, sys, math
F = sys.argv[-2]; OUT = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=F)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 12; sc.cycles.device = 'CPU'
sc.render.resolution_x = 1400; sc.render.resolution_y = 800; sc.render.film_transparent = False
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.9, 0.92, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
obj = [o for o in sc.objects if o.type == 'MESH'][0]
print('tris', sum(len(p.vertices) - 2 for p in obj.data.polygons), 'verts', len(obj.data.vertices))
# 3 copies: front, 3/4, back
for i, rz in enumerate([0, -0.9, math.pi]):
    o = obj if i == 0 else obj.copy(); 
    if i: sc.collection.objects.link(o)
    o.rotation_mode = 'XYZ'; o.location.x = (i - 1) * 1.0; o.rotation_euler = (o.rotation_euler.x, o.rotation_euler.y, rz)
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 3.1
co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); co.location = (0, -5, 0.5); co.rotation_euler = (math.pi / 2, 0, 0); sc.camera = co
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
