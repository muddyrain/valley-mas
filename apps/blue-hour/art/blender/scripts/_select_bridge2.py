import bpy
from mathutils import Vector
from pathlib import Path
root=Path(r'D:/my-code/valley-mas/apps/blue-hour'); out=root/'test-output/rigging/infected_basic_a'
bpy.ops.wm.open_mainfile(filepath=str(root/'art/blender/characters/infected_basic_a_locomotion.blend')); rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH'); rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('Zombie_Walk'); scene=bpy.context.scene; scene.frame_set(15); bpy.context.view_layer.update()
red=bpy.data.materials.new('BridgeSelected'); red.diffuse_color=(0.9,0.05,0.02,1); gray=bpy.data.materials.new('BridgeContext'); gray.diffuse_color=(0.28,0.3,0.34,1); mesh.data.materials.clear(); mesh.data.materials.append(gray); mesh.data.materials.append(red)
for p in mesh.data.polygons:
 c=p.center; p.material_index=1 if 0.03<=c.z<=0.48 and abs(c.x)<=0.16 else 0
scene.render.engine='BLENDER_WORKBENCH'; scene.display.shading.light='STUDIO'; scene.display.shading.studio_light='paint.sl'; scene.display.shading.color_type='MATERIAL'; scene.render.resolution_x=640; scene.render.resolution_y=720; bpy.ops.object.camera_add(location=(2.6,-4,3.6)); cam=bpy.context.object; cam.data.type='ORTHO'; cam.data.ortho_scale=1.7; cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler(); scene.camera=cam; scene.render.filepath=str(out/'bridge_selected_solid.png'); bpy.ops.render.render(write_still=True); mesh.show_wire=True; mesh.show_all_edges=True; scene.render.filepath=str(out/'bridge_selected_wireframe.png'); bpy.ops.render.render(write_still=True)
