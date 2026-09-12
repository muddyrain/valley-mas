"""Author three shared Blender Actions on a mesh-independent v1 reference rig.

Foot paths are converted to baked joint keys here, not solved at runtime.
No character mesh or character-specific action is involved.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from create_humanoid_rig import create_rig, definition, BLENDER_ROOT

FPS = 60
CLIPS = {
    'Idle': {'duration': 3.2, 'nominal_speed': 0.0},
    'Walk': {'duration': 1.0, 'stance': .62, 'reach': .30, 'lift': .075, 'drop': .073, 'lean': 2.5},
    'Run': {'duration': .7, 'stance': .30, 'reach': .31, 'lift': .095, 'drop': .086, 'lean': 7.0},
}


def reference_landmarks():
    points = {b['name']: {'head': b['head'], 'tail': b['tail']} for b in definition()}
    # A neutral authoring stance, independent of either survivor's fit. The
    # standard's reference T rig remains intact; names and hierarchy are frozen.
    arm = [('Shoulder', (.025, 0, 1.21), (.14, 0, 1.185)),
           ('UpperArm', (.14, 0, 1.185), (.23, -.008, 1.005)),
           ('LowerArm', (.23, -.008, 1.005), (.315, -.014, .795)),
           ('Hand', (.315, -.014, .795), (.36, -.016, .72))]
    for side, sign in [('Left', 1), ('Right', -1)]:
        for name, head, tail in arm:
            points[side + name] = {'head': (sign * head[0], head[1], head[2]),
                                  'tail': (sign * tail[0], tail[1], tail[2])}
    return points


def rotate(rig, name, axis, degrees):
    bone = rig.pose.bones[name]
    local_axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector(axis)
    bone.rotation_mode = 'QUATERNION'
    bone.rotation_quaternion = Quaternion(local_axis, math.radians(degrees))


def leg_angles(rig, side, forward, ankle_z, hip_delta):
    upper = rig.data.bones[side + 'UpperLeg']
    lower = rig.data.bones[side + 'LowerLeg']
    hip, knee, ankle = upper.head_local, lower.head_local, rig.data.bones[side + 'Foot'].head_local
    a, b = (knee - hip).length, (ankle - knee).length
    height = hip.z + hip_delta - ankle_z
    distance = min(a + b - .00001, max(abs(a - b) + .00001, math.hypot(forward, height)))
    thigh = math.atan2(forward, height) + math.acos(max(-1, min(1, (a*a + distance*distance - b*b) / (2*a*distance))))
    flexion = math.pi - math.acos(max(-1, min(1, (a*a + b*b - distance*distance) / (2*a*b))))
    rest_thigh = math.atan2(hip.y - knee.y, hip.z - knee.z)
    rest_shin = math.atan2(knee.y - ankle.y, knee.z - ankle.z)
    rotate(rig, side + 'UpperLeg', (1, 0, 0), -math.degrees(thigh - rest_thigh))
    rotate(rig, side + 'LowerLeg', (1, 0, 0), math.degrees(flexion - (rest_thigh - rest_shin)))
    # Counter-rotate the ankle to keep the sole level during support.
    rotate(rig, side + 'Foot', (1, 0, 0), math.degrees(thigh - flexion - rest_shin))


def sample(rig, clip, phase):
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
        bone.rotation_mode = 'QUATERNION'
    cycle = 2 * math.pi * phase
    if clip == 'Idle':
        rotate(rig, 'Spine', (1, 0, 0), .6 * math.sin(cycle))
        rotate(rig, 'Chest', (1, 0, 0), -.3 * math.sin(cycle))
        rotate(rig, 'Head', (0, 0, 1), .65 * math.sin(cycle))
        for side, sign in [('Left', 1), ('Right', -1)]:
            rotate(rig, side + 'UpperArm', (0, 1, 0), sign * .35 * math.sin(cycle))
    else:
        spec = CLIPS[clip]
        hip_delta = -spec['drop'] + .004 * math.sin(cycle)**2
        hips = rig.pose.bones['Hips']
        hips.location = hips.bone.matrix_local.to_3x3().inverted() @ Vector((0, 0, hip_delta))
        rotate(rig, 'Spine', (1, 0, 0), spec['lean'])
        rotate(rig, 'Chest', (0, 0, 1), (1.5 if clip == 'Walk' else 2.4) * math.sin(cycle))
        for side, offset in [('Left', 0), ('Right', .5)]:
            p = (phase + offset) % 1
            if p < spec['stance']:
                forward = spec['reach'] * (1 - 2*p/spec['stance'])
                lift = 0
            else:
                u = (p - spec['stance']) / (1 - spec['stance'])
                blend = u*u*(3 - 2*u)
                forward = spec['reach'] * (2*blend - 1)
                lift = spec['lift'] * math.sin(math.pi*u)**2
            leg_angles(rig, side, forward, .16 + lift, hip_delta)
            swing = (14 if clip == 'Walk' else 23) * math.cos(2*math.pi*p)
            rotate(rig, side + 'UpperArm', (1, 0, 0), swing)
            rotate(rig, side + 'LowerArm', (1, 0, 0), -8 if clip == 'Walk' else -20)
    bpy.context.view_layer.update()


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.render.fps = FPS
    rig = create_rig(reference_landmarks())
    rig.animation_data_create()
    out = BLENDER_ROOT / 'animations'
    out.mkdir(parents=True, exist_ok=True)
    report = {'id': 'BH_Humanoid_Animations_v1', 'rig': 'BH_Humanoid_Rig_v1', 'fps': FPS, 'clips': {}}
    for name, spec in CLIPS.items():
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        frames = round(spec['duration'] * FPS)
        for frame in range(frames + 1):
            sample(rig, name, (frame % frames) / frames)
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_quaternion', frame=frame)
                if bone.name in ('Root', 'Hips'):
                    bone.keyframe_insert('location', frame=frame)
        # Baked samples use linear interpolation, including the identical loop endpoints.
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation = 'LINEAR'
        nominal = spec.get('nominal_speed', 2*spec.get('reach', 0) / (spec['duration']*spec.get('stance', 1)))
        report['clips'][name] = {**spec, 'frames': frames, 'nominal_speed': nominal, 'loop': True, 'in_place': True}
    rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    scene.frame_start = 0
    scene.frame_end = round(3.2 * FPS)
    # A tiny Root-bound export carrier preserves a glTF skin and Skeleton3D.
    # The Godot extraction step discards it; it is not part of any character.
    mesh = bpy.data.meshes.new('ExportCarrier')
    mesh.from_pydata([(0, 0, 0), (.001, 0, 0), (0, .001, 0)], [], [(0, 1, 2)])
    carrier = bpy.data.objects.new('ExportCarrier', mesh)
    bpy.context.collection.objects.link(carrier)
    carrier.parent = rig
    carrier.vertex_groups.new(name='Root').add([0, 1, 2], 1, 'REPLACE')
    carrier.modifiers.new('Skin', 'ARMATURE').object = rig
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    carrier.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.wm.save_as_mainfile(filepath=str(out / 'BH_Humanoid_Animations_v1.blend'))
    bpy.ops.export_scene.gltf(filepath=str(out / 'bh_humanoid_animations_v1.glb'),
                             export_format='GLB', use_selection=True, export_yup=True,
                             export_skins=True, export_animations=True,
                             export_animation_mode='ACTIONS', export_anim_single_armature=True,
                             export_frame_range=False, export_force_sampling=True,
                             export_rest_position_armature=True, export_def_bones=False)
    (out / 'bh_humanoid_animations_v1.json').write_text(json.dumps(report, indent=2) + '\n')
    print('SHARED HUMANOID ACTIONS: Idle, Walk, Run; zero horizontal root/hips travel')


if __name__ == '__main__':
    main()
