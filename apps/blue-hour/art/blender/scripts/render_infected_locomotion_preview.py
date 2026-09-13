import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(r'D:/my-code/valley-mas/apps/blue-hour')
BLEND = ROOT / 'art/blender/characters/infected_basic_a_locomotion.blend'
OUT = ROOT / 'test-output/rigging/infected_basic_a/video_frames_final'

bpy.ops.wm.open_mainfile(filepath=str(BLEND))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 320
scene.render.resolution_y = 480
scene.render.resolution_percentage = 100
scene.render.fps = 30
scene.display.shading.light = 'STUDIO'
scene.display.shading.studio_light = 'paint.sl'
scene.display.shading.color_type = 'MATERIAL'
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in scene.objects if o.type == 'MESH')
bpy.ops.object.camera_add(location=(2.6, -4, 3.6))
cam = bpy.context.object
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.05
cam.rotation_euler = (Vector((0,0,.8)) - cam.location).to_track_quat('-Z','Y').to_euler()
scene.camera = cam
# Ground reference grid makes foot plant and stride readable in the game view.
grid_material = bpy.data.materials.new('PreviewGrid'); grid_material.diffuse_color = (0.12, 0.14, 0.17, 1.0)
for axis in range(-4, 5):
    for horizontal in (True, False):
        bpy.ops.mesh.primitive_cube_add(location=(axis if horizontal else 0, 0 if horizontal else axis, -0.012), scale=(0.008 if horizontal else 4.0, 4.0 if horizontal else 0.008, 0.004))
        line = bpy.context.object; line.data.materials.append(grid_material)
bpy.ops.mesh.primitive_plane_add(size=8, location=(0,0,-0.02))
floor = bpy.context.object; floor.data.materials.append(grid_material)
for action_name, frames in [('Zombie_Idle', 60), ('Zombie_Walk', 30), ('Zombie_Chase', 30)]:
    action = bpy.data.actions.get(action_name)
    rig.animation_data_create(); rig.animation_data.action = action
    folder = OUT / action_name; folder.mkdir(parents=True, exist_ok=True)
    for i in range(frames):
        scene.frame_set(i)
        scene.render.filepath = str(folder / f'{i:04d}.png')
        bpy.ops.render.render(write_still=True)
print('Preview frames rendered to', OUT)
