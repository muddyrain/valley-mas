"""BH_Humanoid_Rig_v1: fixed topology and roll convention, authored in Blender."""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

RIG_ID = 'BH_Humanoid_Rig_v1'
BLENDER_ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = BLENDER_ROOT.parents[1]


def definition():
    bones = [
        ('Root', None, (0, 0, 0), (0, 0, .12)),
        ('Hips', 'Root', (0, 0, .86), (0, 0, .98)),
        ('Spine', 'Hips', (0, 0, .98), (0, 0, 1.075)),
        ('Chest', 'Spine', (0, 0, 1.075), (0, 0, 1.16)),
        ('UpperChest', 'Chest', (0, 0, 1.16), (0, 0, 1.23)),
        ('Neck', 'UpperChest', (0, 0, 1.23), (0, 0, 1.285)),
        ('Head', 'Neck', (0, 0, 1.285), (0, 0, 1.5)),
    ]
    for side, sign in [('Left', 1), ('Right', -1)]:
        def p(x, y, z):
            return (sign * x, y, z)
        bones.extend([
            (side + 'Shoulder', 'UpperChest', p(.025, 0, 1.21), p(.14, 0, 1.21)),
            (side + 'UpperArm', side + 'Shoulder', p(.14, 0, 1.21), p(.37, 0, 1.21)),
            (side + 'LowerArm', side + 'UpperArm', p(.37, 0, 1.21), p(.57, 0, 1.21)),
            (side + 'Hand', side + 'LowerArm', p(.57, 0, 1.21), p(.66, 0, 1.21)),
            (side + 'UpperLeg', 'Hips', p(.085, 0, .86), p(.09, -.018, .50)),
            (side + 'LowerLeg', side + 'UpperLeg', p(.09, -.018, .50), p(.09, .015, .16)),
            (side + 'Foot', side + 'LowerLeg', p(.09, .015, .16), p(.09, -.115, .065)),
            (side + 'Toes', side + 'Foot', p(.09, -.115, .065), p(.09, -.18, .065)),
        ])
    return [{'name': n, 'parent': p, 'head': h, 'tail': t} for n, p, h, t in bones]


def create_rig(landmarks=None):
    validate_frozen_standard()
    data = bpy.data.armatures.new(RIG_ID)
    armature = bpy.data.objects.new(RIG_ID, data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    armature.show_in_front = True
    armature['rig_spec'] = RIG_ID
    bpy.ops.object.mode_set(mode='EDIT')
    for spec in definition():
        bone = data.edit_bones.new(spec['name'])
        coordinates = landmarks.get(spec['name'], spec) if landmarks else spec
        bone.head, bone.tail = coordinates['head'], coordinates['tail']
        if spec['parent']:
            bone.parent = data.edit_bones[spec['parent']]
        bone.use_connect = False
        bone.align_roll(Vector((0, -1, 0)))
    bpy.ops.object.mode_set(mode='OBJECT')
    return armature


def validate_frozen_standard():
    contract_path = BLENDER_ROOT / 'rigs' / (RIG_ID + '.contract.json')
    if not contract_path.exists():
        return
    contract = json.loads(contract_path.read_text(encoding='utf-8'))
    topology = [{'name': b['name'], 'parent': b['parent']} for b in definition()]
    if contract['id'] != RIG_ID or contract['bones'] != topology:
        raise ValueError('Frozen rig topology changed. Use a new rig version, not a silent v1 edit.')


def save_rig(output):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0
    create_rig()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    output.with_suffix('.json').write_text(json.dumps({
        'id': RIG_ID, 'units': 'metres', 'up': '+Z', 'forward': '-Y',
        'anatomical_left': '+X', 'local_z_roll_reference': '-Y',
        'canonical_rest': 'T pose; fit bone endpoints to mesh rest without reshaping the mesh',
        'bones': definition(),
    }, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=BLENDER_ROOT / 'rigs' / (RIG_ID + '.blend'))
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    save_rig(args.output)
