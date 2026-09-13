import bpy
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=r'D:/my-code/valley-mas/apps/blue-hour/art/blender/characters/infected_basic_a_locomotion.blend')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH'); rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('Zombie_Walk'); scene=bpy.context.scene; scene.render.engine='BLENDER_WORKBENCH'; scene.render.resolution_x=640; scene.render.resolution_y=720; scene.render.resolution_percentage=100; scene.display.shading.light='STUDIO'; scene.display.shading.studio_light='paint.sl'; scene.display.shading.color_type='MATERIAL'; bpy.ops.object.camera_add(location=(2.6,-4,3.6)); cam=bpy.context.object; cam.data.type='ORTHO'; cam.data.ortho_scale=1.7; cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler(); scene.camera=cam; scene.frame_set(15); bpy.context.view_layer.update(); scene.render.filepath=r'D:/my-code/valley-mas/apps/blue-hour/test-output/rigging/infected_basic_a/bridge_deform_on.png'; bpy.ops.render.render(write_still=True)
for m in mesh.modifiers:
 if m.type=='ARMATURE': m.show_viewport=False
bpy.context.view_layer.update(); scene.render.filepath=r'D:/my-code/valley-mas/apps/blue-hour/test-output/rigging/infected_basic_a/bridge_deform_off.png'; bpy.ops.render.render(write_still=True)
print('MODS',[(m.name,m.type,m.show_viewport) for m in mesh.modifiers])
