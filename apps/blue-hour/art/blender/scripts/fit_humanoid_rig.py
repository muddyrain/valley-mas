"""Fit an explicit, reviewed landmark file. Does not guess anatomy for new characters."""
import json
from pathlib import Path

import bpy
from mathutils import Matrix
from create_humanoid_rig import create_rig, definition
from inspect_character_glb import inspect


def fit_character(source, fit_path):
    source = Path(source)
    audit = inspect(source)
    if audit['skeleton'] or audit['skin_count'] or audit['vertex_weights']:
        raise ValueError('Existing skeleton/weights detected: review reuse before binding')
    config = json.loads(Path(fit_path).read_text(encoding='utf-8'))
    if audit['sha256'] != config['source_sha256']:
        raise ValueError('Source changed: review landmarks before rerunning the fit')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.ops.import_scene.gltf(filepath=str(source), merge_vertices=True)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not meshes or any(obj.type == 'ARMATURE' for obj in bpy.context.scene.objects):
        raise ValueError('Expected unrigged render meshes')
    for mesh in meshes:
        if mesh.matrix_world != Matrix.Identity(4):
            raise ValueError('Normalize non-identity source object transforms before fitting')
    landmarks = dict(config['body'])
    for side, sign in [('Left', 1), ('Right', -1)]:
        for part, points in config['left'].items():
            landmarks[side + part] = {
                key: [sign * value[0], value[1], value[2]] for key, value in points.items()
            }
    if set(landmarks) != {bone['name'] for bone in definition()}:
        raise ValueError('Fit must specify exactly the v1 bone set')
    bpy.ops.object.select_all(action='DESELECT')
    rig = create_rig(landmarks)
    for mesh in meshes:
        mesh['source_sha256'] = audit['sha256']
        mesh['character_id'] = config['character']
    rig['fit_id'] = config['character']
    return rig, meshes, config
