"""Byte and Blender-side QA for isolated unified Survivor candidates."""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from create_humanoid_rig import definition, RIG_ID
from pose_test import positions

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'test-output/survivor-unified-rig'


def close(a, b, tol=1e-6):
    return max(abs(float(x) - float(y)) for x, y in zip(a, b)) <= tol


def candidate(character):
    path = OUT / character / f'{character}_unified_rig_candidate.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
    mesh = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH')
    expected = definition()
    by_name = {bone.name: bone for bone in rig.data.bones}
    hierarchy = {bone.name: (bone.parent.name if bone.parent else None) for bone in rig.data.bones}
    expected_hierarchy = {bone['name']: bone['parent'] for bone in expected}
    endpoints = {}
    exact_endpoints = True
    for item in expected:
        bone = by_name[item['name']]
        endpoints[item['name']] = {'parent': hierarchy[item['name']],
            'head': list(bone.head_local), 'tail': list(bone.tail_local), 'length': bone.length}
        exact_endpoints &= close(bone.head_local, item['head']) and close(bone.tail_local, item['tail'])
    rows = [[g.weight for g in vertex.groups if g.weight > 0] for vertex in mesh.data.vertices]
    points = positions(mesh)
    evaluated = positions(mesh, evaluated=True)
    edges = np.array([tuple(edge.vertices) for edge in mesh.data.edges])
    rest_lengths = np.linalg.norm(points[edges[:, 0]] - points[edges[:, 1]], axis=1)
    posed_lengths = np.linalg.norm(evaluated[edges[:, 0]] - evaluated[edges[:, 1]], axis=1)
    ratios = posed_lengths[rest_lengths > .002] / rest_lengths[rest_lengths > .002]
    ground = {}
    for side, sign in [('left', 1), ('right', -1)]:
        mask = (points[:, 0] * sign > .015) & (points[:, 2] < .25) & (points[:, 1] < .08)
        ground[side] = {'vertex_count': int(mask.sum()), 'min_z_m': float(points[mask, 2].min()),
                        'p01_z_m': float(np.percentile(points[mask, 2], 1)),
                        'max_z_m': float(points[mask, 2].max())}
    report = {
        'character': character, 'blend': str(path), 'rig_id': rig.get('rig_spec'),
        'mesh': {'name': mesh.name, 'vertices': len(mesh.data.vertices),
                 'triangles': sum(len(poly.vertices) - 2 for poly in mesh.data.polygons),
                 'bounds_min_m': points.min(axis=0).tolist(), 'bounds_max_m': points.max(axis=0).tolist(),
                 'height_m': float(points[:, 2].max() - points[:, 2].min()),
                 'object_scale': list(mesh.scale), 'object_location': list(mesh.location)},
        'skeleton': {'bone_count': len(rig.data.bones), 'hierarchy_exact': hierarchy == expected_hierarchy,
                     'endpoints_exact': exact_endpoints, 'bones': endpoints,
                     'object_scale': list(rig.scale), 'object_location': list(rig.location)},
        'skin': {'unweighted_vertices': sum(not row for row in rows),
                 'max_influences': max(map(len, rows), default=0),
                 'max_sum_error': max((abs(sum(row) - 1) for row in rows), default=0),
                 'armature_modifiers': [{'object': modifier.object.name if modifier.object else None}
                                        for modifier in mesh.modifiers if modifier.type == 'ARMATURE']},
        'ground': ground,
        'deformation': {'finite': bool(np.isfinite(evaluated).all()),
                        'edge_stretch_p99': float(np.percentile(ratios, 99)),
                        'edge_stretch_max': float(ratios.max()),
                        'edges_over_2x': int((ratios > 2).sum())},
        'actions': len(bpy.data.actions),
        'socket_contract': json.loads(rig['weapon_socket_contract']),
    }
    report['pass'] = all([
        report['rig_id'] == RIG_ID, report['mesh']['height_m'] >= 1.649,
        report['skeleton']['bone_count'] == 23, report['skeleton']['hierarchy_exact'],
        report['skeleton']['endpoints_exact'], report['skin']['unweighted_vertices'] == 0,
        report['skin']['max_influences'] <= 4, report['skin']['max_sum_error'] < 1e-5,
        report['deformation']['finite'], report['actions'] == 0,
        # Ground contact is measured from render vertices; sub-half-millimetre
        # import/float noise is below the static acceptance threshold.
        all(abs(value['min_z_m']) < 5e-4 for value in ground.values()),
    ])
    return report


def main():
    rows = [candidate(character) for character in ('xia_zhiyao', 'su_wanxing')]
    same_skeleton = rows[0]['skeleton']['bones'] == rows[1]['skeleton']['bones']
    result = {'rig': RIG_ID, 'same_skeleton': same_skeleton, 'candidates': rows,
              'all_static_checks_pass': all(row['pass'] for row in rows) and same_skeleton}
    (OUT / 'unified-rig-static-qa.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result['all_static_checks_pass'] else 1)


if __name__ == '__main__':
    main()
