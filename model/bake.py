import bpy, sys, bmesh
SRC = sys.argv[-3]; TARGET = int(sys.argv[-2]); OUT = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
hi = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = hi; hi.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.duplicate(); lo = bpy.context.active_object; lo.name = 'runner'
hi.select_set(False)
# weld UV seam splits, then decimate
bm = bmesh.new(); bm.from_mesh(lo.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(lo.data); bm.free()
while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
print('lo tris before', sum(len(p.vertices) - 2 for p in lo.data.polygons))
m = lo.modifiers.new('dec', 'DECIMATE'); m.ratio = TARGET / max(1, sum(len(p.vertices) - 2 for p in lo.data.polygons))
bpy.ops.object.modifier_apply(modifier='dec')
print('lo tris after', sum(len(p.vertices) - 2 for p in lo.data.polygons))
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.006)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth()
img = bpy.data.images.new('bake', 1024, 1024, alpha=False)
mat = bpy.data.materials.new('runner'); mat.use_nodes = True
nt = mat.node_tree; bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.8
nt.nodes.active = tex
lo.data.materials.clear(); lo.data.materials.append(mat)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1
b = sc.render.bake; b.use_pass_direct = False; b.use_pass_indirect = False; b.use_pass_color = True
b.use_selected_to_active = True; b.cage_extrusion = 0.012; b.max_ray_distance = 0.03; b.margin = 8
hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type='DIFFUSE')
img.filepath_raw = 'bake.png'; img.file_format = 'PNG'; img.save()
hi.select_set(False); bpy.data.objects.remove(hi)
lo.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=88, use_selection=True, export_apply=True, export_normals=True)
print('done')
