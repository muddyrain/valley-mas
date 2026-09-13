"""Focused ENM_001 arm-chain QA; emits only static pose renders and metrics."""
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pose_test


POSES = {
    'left_arm_20': [('LeftUpperArm', (0, 1, 0), -20)],
    'left_arm_40': [('LeftUpperArm', (0, 1, 0), -40)],
    'left_arm_60': [('LeftUpperArm', (0, 1, 0), -60)],
    'right_arm_20': [('RightUpperArm', (0, 1, 0), 20)],
    'right_arm_40': [('RightUpperArm', (0, 1, 0), 40)],
    'right_arm_60': [('RightUpperArm', (0, 1, 0), 60)],
    'left_elbow_90': [('LeftUpperArm', (0, 1, 0), -30), ('LeftLowerArm', (0, 1, 0), -90)],
    'right_elbow_90': [('RightUpperArm', (0, 1, 0), 30), ('RightLowerArm', (0, 1, 0), 90)],
    'left_wrist_test': [('LeftLowerArm', (0, 1, 0), -30), ('LeftHand', (0, 1, 0), -20)],
    'right_wrist_test': [('RightLowerArm', (0, 1, 0), 30), ('RightHand', (0, 1, 0), 20)],
}


def apply_pose(rig: bpy.types.Object, rotations: list) -> None:
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    for name, axis, degrees in rotations:
        bone = rig.pose.bones[name]
        local_axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector(axis)
        bone.rotation_mode = 'QUATERNION'
        from mathutils import Quaternion
        bone.rotation_quaternion = Quaternion(local_axis, np.deg2rad(degrees))
    bpy.context.view_layer.update()


def metrics(mesh: bpy.types.Object, rig: bpy.types.Object) -> dict:
    rest = pose_test.positions(mesh)
    posed = pose_test.positions(mesh, evaluated=True)
    edges = np.array([tuple(edge.vertices) for edge in mesh.data.edges])
    lengths = np.linalg.norm(rest[edges[:, 0]] - rest[edges[:, 1]], axis=1)
    ratios = np.linalg.norm(posed[edges[:, 0]] - posed[edges[:, 1]], axis=1)[lengths > 0.002] / lengths[lengths > 0.002]
    all_metrics = {'p99': float(np.percentile(ratios, 99)), 'max': float(ratios.max()), 'edges_over_2x': int((ratios > 2).sum())}
    # Critical arm region: both endpoints in the local limb envelope, excluding shirt/hem edges.
    critical_vertices = np.zeros(len(rest), dtype=bool)
    for side in ('Left', 'Right'):
        for bone_name in (side + 'UpperArm', side + 'LowerArm', side + 'Hand'):
            bone = rig.data.bones[bone_name]
            a, b = np.array(bone.head_local), np.array(bone.tail_local)
            axis = b - a
            denom = max(float(np.dot(axis, axis)), 1e-9)
            t = np.clip(((rest - a) @ axis) / denom, 0.0, 1.0)
            critical_vertices |= np.linalg.norm(rest - (a + t[:, None] * axis), axis=1) <= 0.07
    critical_edges = critical_vertices[edges[:, 0]] & critical_vertices[edges[:, 1]] & (lengths > 0.01)
    critical_ratios = np.linalg.norm(posed[edges[:, 0]] - posed[edges[:, 1]], axis=1)[critical_edges] / lengths[critical_edges]
    all_metrics['critical_arm'] = {
        'edge_count': int(len(critical_ratios)),
        'p99': float(np.percentile(critical_ratios, 99)) if len(critical_ratios) else 0.0,
        'max': float(critical_ratios.max()) if len(critical_ratios) else 0.0,
        'edges_over_2x': int((critical_ratios > 2).sum()),
        'classification': 'arm envelope only; shirt/hem and sub-0.01m seam edges excluded',
    }
    return all_metrics


def main() -> None:
    output = Path(r'D:/my-code/valley-mas/apps/blue-hour/test-output/rigging/infected_basic_a/poses')
    bpy.ops.wm.open_mainfile(filepath=r'D:/my-code/valley-mas/apps/blue-hour/art/blender/characters/infected_basic_a_rigged.blend')
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
    mesh = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH')
    scene, camera = pose_test.studio()
    scene.render.engine = 'BLENDER_EEVEE'
    metrics_report = {}
    for name, rotations in POSES.items():
        apply_pose(rig, rotations)
        metrics_report[name] = {'rotations': rotations, 'mesh': metrics(mesh, rig)}
        for view, location in [('front', Vector((0, -4, .85))), ('game', Vector((2.6, -4, 3.6)))]:
            camera.location = location
            camera.rotation_euler = (Vector((0, 0, .8)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
            output_name = name.replace('_wrist_test', '_wrist')
            scene.render.filepath = str(output / f'{output_name}_{view}.png')
            bpy.ops.render.render(write_still=True)
    (output / 'pose_metrics.json').write_text(json.dumps(metrics_report, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
