import bpy, json
from mathutils import Vector
from pathlib import Path
root=Path(r'D:/my-code/valley-mas/apps/blue-hour'); out=root/'test-output/rigging/infected_basic_a'
bpy.ops.wm.open_mainfile(filepath=str(root/'art/blender/characters/infected_basic_a_locomotion.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH'); rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('Zombie_Walk'); scene=bpy.context.scene; scene.frame_set(15); bpy.context.view_layer.update()
# select lower inner-leg/cuff region in rest-space; this captures the visible candidate strip region.
for p in mesh.data.polygons: p.select=False
faces=[]; verts=set()
for p in mesh.data.polygons:
 c=p.center
 if 0.03 <= c.z <= 0.48 and abs(c.x) <= 0.16:
  p.select=True; faces.append(p.index); verts.update(p.vertices)
# solid render with selected red material via object color
for poly in mesh.data.polygons: poly.material_index=0
mat=mesh.data.materials[0]; mat.diffuse_color=(0.75,0.08,0.03,1)
scene.render.engine='BLENDER_WORKBENCH'; scene.display.shading.light='STUDIO'; scene.display.shading.studio_light='paint.sl'; scene.display.shading.color_type='MATERIAL'; scene.render.resolution_x=640; scene.render.resolution_y=720; scene.render.resolution_percentage=100
bpy.ops.object.camera_add(location=(2.6,-4,3.6)); cam=bpy.context.object; cam.data.type='ORTHO'; cam.data.ortho_scale=1.7; cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler(); scene.camera=cam
scene.render.filepath=str(out/'bridge_selected_solid.png'); bpy.ops.render.render(write_still=True)
# wireframe overlay
mesh.show_wire=True; mesh.show_all_edges=True; scene.display.shading.color_type='SINGLE'; scene.display.shading.single_color=(0.05,0.05,0.05)
scene.render.filepath=str(out/'bridge_selected_wireframe.png'); bpy.ops.render.render(write_still=True)
# full influences
weights={}
for i in sorted(verts): weights[str(i)]={mesh.vertex_groups[g.group].name: g.weight for g in mesh.data.vertices[i].groups}
json.dump({'object':mesh.name,'component_id':'0 (main connected component)','selected_face_ids':faces,'selected_vertex_ids':sorted(verts),'weights':weights,'selection_rule':'polygon center z 0.03..0.48 and abs(x)<=0.16 at Zombie_Walk frame 15; lower inner-leg/cuff candidate region'},open(out/'bridge_selection.json','w'),indent=2)
print('SELECTED',len(faces),'faces',len(verts),'verts')

