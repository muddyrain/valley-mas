"""Bake foot contact into the template's Idle_4 without changing its rest rig."""
import hashlib
import json
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'assets/characters/survivor_animation_template/source/survivor_animation_template.fbx'
OUT = ROOT / 'test-output/standard-survivor-foot-contact'
BLEND = ROOT / 'art/blender/characters/standard_survivor_idle.blend'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE_HASH = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
SIDES = ('Left', 'Right')
PREFIX = 'mixamorig:'
RATE = 24
START, END = 1, 337
MIN_KNEE_DEGREES = 15.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(SOURCE), use_anim=True,
                        automatic_bone_orientation=False, ignore_leaf_bones=False)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = START, END
scene.render.fps = RATE
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in scene.objects if o.type == 'MESH')
original = next(a for a in bpy.data.actions if a.name.endswith('|Idle_4'))
rig.animation_data.action = original
rig.animation_data.action_slot = original.slots[0]
for track in rig.animation_data.nla_tracks:
    track.mute = True
rest = {b.name: [list(row) for row in b.matrix_local] for b in rig.data.bones}
parents = {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
object_matrices = {o.name: [list(row) for row in o.matrix_world] for o in (rig, mesh)}

def bone(name):
    return rig.pose.bones[PREFIX + name]

def set_frame(frame):
    scene.frame_set(int(frame), subframe=frame % 1)
    bpy.context.view_layer.update()

def curves(action):
    return action.layers[0].strips[0].channelbag(action.slots[0]).fcurves

def world_head(name):
    return rig.matrix_world @ bone(name).head

source_samples = []
for frame in range(START, END + 1):
    set_frame(frame)
    source_samples.append({name: (rig.matrix_world @ p.matrix).copy()
                           for name, p in rig.pose.bones.items()})

targets = {}
for side in SIDES:
    foot = bone(side + 'Foot')
    rest_matrix = rig.matrix_world @ foot.bone.matrix_local
    toe_matrix = rig.matrix_world @ bone(side + 'ToeBase').bone.matrix_local
    rest_forward = toe_matrix.translation - rest_matrix.translation
    mean_forward = sum((s[PREFIX + side + 'ToeBase'].translation - s[PREFIX + side + 'Foot'].translation
                        for s in source_samples), Vector()) / len(source_samples)
    yaw = math.atan2(mean_forward.y, mean_forward.x) - math.atan2(rest_forward.y, rest_forward.x)
    target = Matrix.Rotation(yaw, 4, 'Z') @ rest_matrix
    mean_position = sum((s[PREFIX + side + 'Foot'].translation for s in source_samples), Vector()) / len(source_samples)
    target.translation = Vector((mean_position.x, mean_position.y, rest_matrix.translation.z + 0.001))
    targets[side] = target
    print('CHAIN', side, 'shin tail/head difference',
          (rig.matrix_world @ bone(side + 'Leg').tail - world_head(side + 'Foot')).length,
          'target', list(target.translation), flush=True)

# Both feet support the entire source Idle. The pelvis must remain within the
# intersection of the two leg reach spheres; no object/root transform is moved.
pelvis_deltas = []
for sample in source_samples:
    delta = 0.0
    for side in SIDES:
        hip = sample[PREFIX + side + 'UpLeg'].translation
        knee = sample[PREFIX + side + 'Leg'].translation
        ankle = sample[PREFIX + side + 'Foot'].translation
        a, b = (knee - hip).length, (ankle - knee).length
        reach = math.sqrt(a*a + b*b + 2*a*b*math.cos(math.radians(MIN_KNEE_DEGREES)))
        horizontal = Vector((hip.x - targets[side].translation.x, hip.y - targets[side].translation.y)).length_squared
        limit = targets[side].translation.z + math.sqrt(reach*reach - horizontal)
        delta = min(delta, limit - hip.z)
    pelvis_deltas.append(delta)

# Smooth the constraint envelope periodically, then conservatively remain below
# it to avoid a knee-speed cusp when support dominance changes.
data = np.array(pelvis_deltas[:-1])
smoothed = np.zeros_like(data)
weights = np.exp(-0.5*(np.arange(-12, 13)/4.0)**2)
weights /= weights.sum()
for offset, weight in zip(range(-12, 13), weights):
    smoothed += np.roll(data, offset)*weight
smoothed -= max(0.0, float(np.max(smoothed-data))) + 0.001
pelvis_deltas = list(smoothed) + [float(smoothed[0])]

corrected = original.copy()
corrected.name = 'Idle_4'
rig.animation_data.action = corrected
rig.animation_data.action_slot = corrected.slots[0]
for frame, delta in zip(range(START, END + 1), pelvis_deltas):
    set_frame(frame)
    hips = bone('Hips')
    desired = source_samples[frame-START][PREFIX+'Hips'].copy()
    desired.translation.z += delta
    hips.matrix = rig.matrix_world.inverted() @ desired
    hips.keyframe_insert('location', frame=frame, group=hips.name)

helpers = []
constraints = []
for side in SIDES:
    target = bpy.data.objects.new(side + 'FootContact', None)
    scene.collection.objects.link(target)
    target.matrix_world = targets[side]
    helpers.append(target)
    shin = bone(side + 'Leg')
    shin.ik_stretch = 0.0
    bone(side+'UpLeg').ik_stretch = 0.0
    ik = shin.constraints.new('IK')
    ik.target = target
    ik.chain_count = 2
    ik.use_stretch = False
    ik.iterations = 500
    constraints.append((shin, ik))
    foot = bone(side+'Foot')
    rotation = foot.constraints.new('COPY_ROTATION')
    rotation.target = target
    rotation.target_space = 'WORLD'
    rotation.owner_space = 'WORLD'
    constraints.append((foot, rotation))
    toe = bone(side+'ToeBase')
    for fcurve in list(curves(corrected)):
        if fcurve.data_path.startswith(toe.path_from_id() + '.'):
            curves(corrected).remove(fcurve)
    toe.matrix_basis = Matrix.Identity(4)
    toe.keyframe_insert('rotation_quaternion', frame=START, group=toe.name)
    toe.keyframe_insert('rotation_quaternion', frame=END, group=toe.name)

edited_names = [PREFIX + side + part for side in SIDES for part in ('UpLeg', 'Leg', 'Foot', 'ToeBase')]
baked = []
errors = []
for frame in range(START, END + 1):
    set_frame(frame)
    baked.append({name: rig.pose.bones[name].matrix.copy() for name in edited_names})
    errors.extend((world_head(side+'Foot')-targets[side].translation).length for side in SIDES)
for owner, constraint in constraints:
    owner.constraints.remove(constraint)
for helper in helpers:
    bpy.data.objects.remove(helper, do_unlink=True)

for fcurve in list(curves(corrected)):
    if any(fcurve.data_path.startswith(rig.pose.bones[name].path_from_id()+'.') for name in edited_names):
        curves(corrected).remove(fcurve)
previous = {}
for frame, matrices in zip(range(START, END + 1), baked):
    set_frame(frame)
    for name in edited_names:
        p = rig.pose.bones[name]
        p.matrix = matrices[name]
        if name in previous and p.rotation_quaternion.dot(previous[name]) < 0:
            p.rotation_quaternion.negate()
        previous[name] = p.rotation_quaternion.copy()
        p.keyframe_insert('location', frame=frame, group=name)
        p.keyframe_insert('rotation_quaternion', frame=frame, group=name)
        p.keyframe_insert('scale', frame=frame, group=name)
        bpy.context.view_layer.update()
for curve in curves(corrected):
    if any(curve.data_path.startswith(rig.pose.bones[name].path_from_id()+'.') for name in edited_names) or curve.data_path == bone('Hips').path_from_id()+'.location':
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'

assert rest == {b.name: [list(row) for row in b.matrix_local] for b in rig.data.bones}
assert parents == {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
assert object_matrices == {o.name: [list(row) for row in o.matrix_world] for o in (rig, mesh)}
assert all(len(p.constraints) == 0 for p in rig.pose.bones)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_HASH

# Export bone world matrices, not another mesh/rig. Godot converts these back to
# local tracks on the unchanged canonical skeleton and saves a baked Animation.
tracks = []
for frame in range(START, END + 1):
    set_frame(frame)
    tracks.append({'time': (frame-START)/RATE,
                   'bones': {name.removeprefix(PREFIX): [list(row) for row in rig.matrix_world @ p.matrix]
                             for name, p in rig.pose.bones.items()}})
payload = {'duration': 14.0, 'fps': RATE, 'source_sha256': SOURCE_HASH, 'samples': tracks,
           'rest_world': {b.name.removeprefix(PREFIX): [list(row) for row in rig.matrix_world @ b.matrix_local] for b in rig.data.bones},
           'pelvis_delta_m': [float(x) for x in pelvis_deltas], 'ik_max_target_error_m': max(errors),
           'rest_unchanged': True, 'parents_unchanged': True, 'object_transforms_unchanged': True,
           'constraints_remaining': 0, 'edited_bones': edited_names}
def untouched_curve_signature(action):
    result = []
    for curve in curves(action):
        if any(curve.data_path.startswith(rig.pose.bones[name].path_from_id()+'.') for name in edited_names):
            continue
        if curve.data_path == bone('Hips').path_from_id()+'.location':
            continue
        result.append((curve.data_path, curve.array_index,
                       [(list(k.co), list(k.handle_left), list(k.handle_right), k.interpolation)
                        for k in curve.keyframe_points]))
    return hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
payload['untouched_source_curve_hash'] = untouched_curve_signature(original)
payload['untouched_baked_curve_hash'] = untouched_curve_signature(corrected)
assert payload['untouched_source_curve_hash'] == payload['untouched_baked_curve_hash']
(OUT/'baked-pose.json').write_text(json.dumps(payload), encoding='utf-8')

# Keep a single deliverable action, with no helper rig or constraints in the .blend.
for track in list(rig.animation_data.nla_tracks):
    rig.animation_data.nla_tracks.remove(track)
for action in list(bpy.data.actions):
    if action != corrected:
        bpy.data.actions.remove(action)
set_frame(START)
albedo = bpy.data.images.load(str(SOURCE.parent/'survivor_animation_template_albedo.png'), check_existing=True)
albedo.pack()
for slot in mesh.material_slots:
    if slot.material and slot.material.use_nodes:
        for node in slot.material.node_tree.nodes:
            if node.type == 'TEX_IMAGE':
                node.image = albedo
BLEND.parent.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
print('BAKED', BLEND, 'pelvis range', min(pelvis_deltas), max(pelvis_deltas),
      'max IK error', max(errors), flush=True)
