"""Isolated, reproducible survivor binding to the frozen canonical rig.

Never writes the formal character, rig, animation or gameplay directories.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from create_humanoid_rig import APP_ROOT, BLENDER_ROOT, RIG_ID, definition
from inspect_character_glb import accessor_values, inspect, read_glb
from bind_character import bind_character, weight_audit
from create_humanoid_rig import create_rig
from pose_test import positions, studio, pose_test

OUTPUT = APP_ROOT / 'test-output/survivor-unified-rig'
SOURCES = {
    'xia_zhiyao': ('Meshy_AI_幸存者_夏知遥_0919020132_texture.glb',
                   '27a81da65634171718bbf28d58364cc4e1cabf434ab65ab5593f2cff1206f701'),
    'su_wanxing': ('Meshy_AI_幸存者_苏晚星_0919020201_texture.glb',
                    'd3d77f82dd1e6d0f6e95439b9eed4cf d9c0b6fee979e2d8104a93e37d9d1a16e'.replace(' ', '')),
}


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def donor_correspondence(character, mesh):
    """Check every vertex before using any reviewed donor skin data."""
    path = APP_ROOT / f'assets/characters/{character}/runtime/{character}.glb'
    doc, binary = read_glb(path)
    primitive = doc['meshes'][0]['primitives'][0]
    attrs = primitive['attributes']
    points = np.array(accessor_values(doc, binary, attrs['POSITION']))
    # GLB +Y up, +Z forward -> Blender +Z up, -Y forward.
    points = points[:, [0, 2, 1]] * np.array([1, -1, 1]) * 1.03125
    tree = KDTree(len(points))
    for index, point in enumerate(points):
        tree.insert(point, index)
    tree.balance()
    matches = [tree.find(vertex.co) for vertex in mesh.data.vertices]
    error = max(match[2] for match in matches)
    return {'path': str(path), 'max_nearest_error_m': error,
            'source_vertices': len(mesh.data.vertices), 'donor_vertices': len(points)}, matches, doc, binary


def render_view(scene, camera, path, location, target=(0, 0, .825), scale=1.9):
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def import_source(source):
    bpy.ops.import_scene.gltf(filepath=str(source), merge_vertices=False)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if len(meshes) != 1 or any(o.type == 'ARMATURE' for o in bpy.context.scene.objects):
        raise ValueError('Expected one unrigged mesh and no armature')
    mesh = meshes[0]
    if mesh.matrix_world != Matrix.Identity(4):
        raise ValueError('Source mesh has a non-identity transform')
    return mesh


def canonical_config(character, source_hash):
    return {'character': character, 'source_sha256': source_hash,
            'weight_corrections': 'reviewed_a_pose_surfaces'}


def add_socket_contract(rig):
    # Existing Godot runtime creates WeaponSocket_R dynamically on RightHand.
    # Keep the asset free of duplicate nodes and freeze the shared semantic contract here.
    contract = {'right_hand_socket': 'RightHand', 'left_hand_reference': 'LeftHand',
                'muzzle_attachment': 'weapon_scene/MuzzlePoint'}
    rig['weapon_socket_contract'] = json.dumps(contract, separators=(',', ':'))
    rig['WeaponSocket_R.bone'] = 'RightHand'
    rig['WeaponSocket_L.reference_bone'] = 'LeftHand'
    rig['MuzzlePoint.owner'] = 'weapon_scene'
    return contract


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--character', choices=list(SOURCES), required=True)
    parser.add_argument('--probe', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    character = args.character
    output = OUTPUT / character
    output.mkdir(parents=True, exist_ok=True)
    filename, expected_hash = SOURCES[character]
    source = Path.home() / 'Downloads' / filename
    assert hashlib.sha256(source.read_bytes()).hexdigest() == expected_hash
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh = import_source(source)
    mesh['source_sha256'] = expected_hash
    mesh['character_id'] = character
    rig = create_rig()
    config = canonical_config(character, expected_hash)
    weights = bind_character(rig, [mesh], config)
    sockets = add_socket_contract(rig)
    # Parent the mesh to the canonical armature; no animation or action is generated.
    bpy.context.scene.frame_start = bpy.context.scene.frame_end = 1
    bpy.context.scene.render.fps = 24
    bpy.ops.file.pack_all()
    blend_path = output / f'{character}_unified_rig_candidate.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    from export_character_glb import export_character
    glb_path = output / f'{character}_unified_rig_candidate.glb'
    exported = export_character(rig, [mesh], glb_path)
    static = pose_test(rig, [mesh], output / 'qa', render=True)
    correspondence, matches, doc, binary = donor_correspondence(character, mesh)
    save_json(output / 'qa.json', {'character': character, 'source': str(source),
        'source_sha256': expected_hash, 'rig': RIG_ID, 'bones': definition(),
        'weights': weights, 'export': exported, 'socket_contract': sockets,
        'donor_correspondence': correspondence, 'static_pose': static,
        'actions': len(bpy.data.actions)})
    print(json.dumps({'character': character, 'glb': str(glb_path), 'bones': 23,
                      'weights': weights, 'socket_contract': sockets}), flush=True)


if __name__ == '__main__':
    main()
