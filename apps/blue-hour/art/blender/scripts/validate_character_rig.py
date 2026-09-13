"""Independent byte-level preservation and skin validation (ordinary Python)."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

from inspect_character_glb import read_glb, accessor_values, inspect

APP_ROOT = Path(__file__).resolve().parents[3]


def geometry_and_images(path):
    document, binary = read_glb(path)
    triangles = Counter()
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            points = accessor_values(document, binary, primitive['attributes']['POSITION'])
            points = [tuple(round(axis, 6) for axis in point) for point in points]
            indices = [row[0] for row in accessor_values(document, binary, primitive['indices'])]
            for i in range(0, len(indices), 3):
                triangles[tuple(sorted(points[j] for j in indices[i:i + 3]))] += 1
    images = []
    for image in document['images']:
        view = document['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        images.append(hashlib.sha256(binary[start:start + view['byteLength']]).hexdigest())
    return triangles, sorted(images)


def validate(character='xia_zhiyao', rigged=None):
    if character == 'infected_basic_a':
        source = APP_ROOT / 'assets/characters/infected_basic_a/model/source/ENM_001_infected_basic_a.glb'
        default_rigged = APP_ROOT / 'assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_rigged.glb'
        fit_path = APP_ROOT / 'art/blender/rigs/infected_basic_a_fit.json'
    else:
        source = APP_ROOT / f'assets/characters/{character}/source/{character}.glb'
        default_rigged = APP_ROOT / f'assets/characters/{character}/runtime/{character}.glb'
        fit_path = APP_ROOT / f'art/blender/rigs/{character}_fit.json'
    rigged = rigged or default_rigged
    fit = json.loads(fit_path.read_text())
    source_faces, source_images = geometry_and_images(source)
    output_faces, output_images = geometry_and_images(rigged)
    audit = inspect(rigged)
    expected = json.loads((APP_ROOT / 'art/blender/rigs/BH_Humanoid_Rig_v1.json').read_text())
    expected_parents = {bone['name']: bone['parent'] for bone in expected['bones']}
    checks = {
        'original_source_hash': hashlib.sha256(source.read_bytes()).hexdigest() == fit['source_sha256'],
        'same_triangles_and_rest_positions_at_1_micrometre': source_faces == output_faces,
        'embedded_texture_bytes_unchanged': source_images == output_images,
        'exact_v1_hierarchy': audit['bone_hierarchy'] == expected_parents,
        'one_skin': audit['skin_count'] == 1,
        'normalized_vertex_weights': audit['unweighted_vertices'] == 0 and audit['maximum_weight_sum_error'] < .00001,
        'zero_animation_clips': audit['animation_count'] == 0,
    }
    report = {'checks': checks, 'triangles': sum(output_faces.values()), 'glb_sha256': audit['sha256']}
    path = APP_ROOT / f'art/blender/rigs/{character}_preservation_report.json'
    path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    if not all(checks.values()):
        raise SystemExit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--character', choices=['xia_zhiyao', 'su_wanxing', 'infected_basic_a'], default='xia_zhiyao')
    parser.add_argument('--runtime', type=Path, help='Validate staging output before promotion')
    args = parser.parse_args()
    validate(args.character, args.runtime)
