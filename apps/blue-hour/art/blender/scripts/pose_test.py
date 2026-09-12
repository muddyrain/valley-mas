"""Static pose samples only: no timeline, keyframes, actions or animation export."""
import json
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Quaternion, Vector

POSES = {
    'rest': [],
    'head_left': [('Head', (0, 0, 1), 25)],
    'head_right': [('Head', (0, 0, 1), -25)],
    'left_arm': [('LeftUpperArm', (0, 1, 0), -40)],
    'right_arm': [('RightUpperArm', (0, 1, 0), 40)],
    # Facing -Y: hip flexion is -X, while knee flexion is +X.
    'left_leg': [('LeftUpperLeg', (1, 0, 0), -30)],
    'right_leg': [('RightUpperLeg', (1, 0, 0), -30)],
    'left_knee': [('LeftUpperLeg', (1, 0, 0), -25), ('LeftLowerLeg', (1, 0, 0), 60)],
    'right_knee': [('RightUpperLeg', (1, 0, 0), -25), ('RightLowerLeg', (1, 0, 0), 60)],
    'lean': [('Spine', (1, 0, 0), 12)],
    'left_arm_stress': [('LeftUpperArm', (0, 1, 0), -60)],
    'right_arm_stress': [('RightUpperArm', (0, 1, 0), 60)],
}


def apply_pose(rig, name):
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    for bone_name, world_axis, degrees in POSES[name]:
        bone = rig.pose.bones[bone_name]
        axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector(world_axis)
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = Quaternion(axis, math.radians(degrees))
    bpy.context.view_layer.update()


def positions(mesh, evaluated=False):
    target = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh() if evaluated else mesh.data
    values = np.empty(len(target.vertices) * 3, dtype=np.float64)
    target.vertices.foreach_get('co', values)
    if evaluated:
        mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
    return values.reshape((-1, 3))


def leg_direction(rig, pose):
    if pose not in ('left_leg', 'right_leg', 'left_knee', 'right_knee'):
        return None
    side = 'Left' if pose.startswith('left') else 'Right'
    hip, knee, ankle = [rig.pose.bones[side + part] for part in ('UpperLeg', 'LowerLeg', 'Foot')]
    forward = (knee.head - knee.bone.head_local).dot(Vector((0, -1, 0)))
    result = {'knee_forward_displacement_m': forward}
    if forward <= .05:
        raise ValueError(f'{pose}: thigh lifted backward instead of toward -Y')
    if pose.endswith('knee'):
        def angle(a, b):
            return math.atan2(Vector((1, 0, 0)).dot(a.cross(b)), a.dot(b))
        rest_angle = angle(knee.bone.head_local - hip.bone.head_local, ankle.bone.head_local - knee.bone.head_local)
        pose_angle = angle(knee.head - hip.head, ankle.head - knee.head)
        flexion = math.degrees((pose_angle - rest_angle + math.pi) % (2 * math.pi) - math.pi)
        result['knee_backward_flexion_degrees'] = flexion
        if not 55 < flexion < 65:
            raise ValueError(f'{pose}: knee bends into hyperextension ({flexion:.2f} degrees)')
    return result


def studio():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.render.resolution_x = 600
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('RigReviewStudio')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes['Background']
    background.inputs[0].default_value = (.22, .24, .28, 1)
    background.inputs[1].default_value = .6
    scene.view_settings.view_transform = 'Standard'
    for location, power, size in [((2, -3, 4), 350, 4), ((-2, -1, 2), 160, 3), ((0, 2, 3), 250, 3)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy, light.data.size = power, size
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 2.05
    scene.camera = camera
    return scene, camera


def pose_test(rig, meshes, output, render=True):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    scene, camera = studio() if render else (None, None)
    rest = {mesh.name: positions(mesh) for mesh in meshes}
    report = {'blender_version': bpy.app.version_string, 'poses': {}, 'actions': len(bpy.data.actions)}
    for pose in POSES:
        apply_pose(rig, pose)
        samples = {}
        for mesh in meshes:
            points = positions(mesh, evaluated=True)
            original = rest[mesh.name]
            edges = np.array([tuple(edge.vertices) for edge in mesh.data.edges])
            lengths = np.linalg.norm(original[edges[:, 0]] - original[edges[:, 1]], axis=1)
            deformed = np.linalg.norm(points[edges[:, 0]] - points[edges[:, 1]], axis=1)
            ratios = deformed[lengths > .002] / lengths[lengths > .002]
            samples[mesh.name] = {
                'finite': bool(np.isfinite(points).all()),
                'bounds_min': points.min(axis=0).tolist(), 'bounds_max': points.max(axis=0).tolist(),
                'max_vertex_displacement_m': float(np.linalg.norm(points - original, axis=1).max()),
                'edge_stretch_p99': float(np.percentile(ratios, 99)),
                'edge_stretch_max': float(ratios.max()),
                'edges_stretched_over_2x': int((ratios > 2).sum()),
            }
        report['poses'][pose] = {'rotations': POSES[pose], 'meshes': samples}
        direction = leg_direction(rig, pose)
        if direction:
            report['poses'][pose]['leg_direction'] = direction
        if render:
            views = [('front', (0, -4, .85)), ('game', (2.6, -4, 3.6)), ('back', (0, 4, .85))]
            if pose in ('left_knee', 'right_knee'):
                views.append(('side', (4, 0, .85)))
            for view, location in views:
                camera.location = location
                camera.rotation_euler = (Vector((0, 0, .8)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
                scene.render.filepath = str(output / f'{pose}_{view}.png')
                bpy.ops.render.render(write_still=True)
    apply_pose(rig, 'rest')
    (output / 'pose_metrics.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return report
