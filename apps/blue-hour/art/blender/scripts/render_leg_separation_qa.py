import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(r'D:/my-code/valley-mas/apps/blue-hour')
BLEND = ROOT / 'art/blender/characters/infected_basic_a_locomotion.blend'
OUT = ROOT / 'test-output/rigging/infected_basic_a/leg_separation_frames'
bpy.ops.wm.open_mainfile(filepath=str(BLEND))
scene=bpy.context.scene; scene.render.engine='BLENDER_WORKBENCH'; scene.render.resolution_x=480; scene.render.resolution_y=640; scene.render.resolution_percentage=100
scene.display.shading.light='STUDIO'; scene.display.shading.studio_light='paint.sl'; scene.display.shading.color_type='MATERIAL'
rig=next(o for o in scene.objects if o.type=='ARMATURE'); bpy.ops.object.camera_add(location=(1.8,-3.3,1.25));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.55;cam.rotation_euler=(Vector((0,0,.75))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
mat=bpy.data.materials.new('LegGrid');mat.diffuse_color=(.12,.14,.17,1)
bpy.ops.mesh.primitive_plane_add(size=5,location=(0,0,-.02));bpy.context.object.data.materials.append(mat)
action=rig.animation_data.action
for name,frame in [('rest',0),('left_forward_right_back',10),('right_forward_left_back',25),('chase_max',12)]:
    rig.animation_data.action=bpy.data.actions.get('Zombie_Chase' if name=='chase_max' else 'Zombie_Walk')
    scene.frame_set(frame)
    OUT.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(OUT/f'{name}.png');bpy.ops.render.render(write_still=True)
print('LEG SEPARATION QA:',OUT)
