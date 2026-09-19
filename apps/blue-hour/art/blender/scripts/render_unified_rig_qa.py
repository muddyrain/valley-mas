"""Render the requested static QA views from an isolated candidate blend."""
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pose_test import apply_pose, studio


def render(scene, camera, output, name, location, target, scale):
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale
    scene.render.filepath = str(output / name)
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    blend = Path(args[0])
    output = Path(args[1])
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
    output.mkdir(parents=True, exist_ok=True)
    scene, camera = studio()
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 800
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    apply_pose(rig, 'rest')
    render(scene, camera, output, 'qa_front.png', (0, -4, .825), (0, 0, .825), 1.9)
    render(scene, camera, output, 'qa_side.png', (4, 0, .825), (0, 0, .825), 1.9)
    render(scene, camera, output, 'qa_three_quarter.png', (2.6, -4, 2.0), (0, 0, .825), 1.95)
    render(scene, camera, output, 'qa_feet_closeup.png', (1.7, -2.2, .28), (0, -.06, .12), .55)
    apply_pose(rig, 'left_arm')
    render(scene, camera, output, 'qa_arm_pose.png', (0, -4, .825), (0, 0, .825), 1.9)
    apply_pose(rig, 'left_knee')
    render(scene, camera, output, 'qa_knee_bend.png', (4, 0, .85), (0, 0, .78), 1.9)


if __name__ == '__main__':
    main()
