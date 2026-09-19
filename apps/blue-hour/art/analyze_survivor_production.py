"""Measure the native gameplay captures without changing assets or animation keys."""
from pathlib import Path
import hashlib
import json
import math
import numpy as np

APP = Path(__file__).resolve().parents[1]
OUT = APP / 'test-output/survivor-production'


def span(values):
    return [float(min(values)), float(max(values))] if len(values) else None


def phase_flat(sample, side):
    if sample['state'] == 'Idle':
        return True
    walk = sample['state'] == 'Walk'
    length, strike, stance, land, push = (25/24, 7/24, 13/24, 2/24, 3/24) if walk else (2/3, 22/120, 28/120, 5/120, 9/120)
    phase = (sample['clip_time'] - strike - (0 if side == 'Left' else length/2)) % length
    return land <= phase < stance-push


def analyze(cid):
    data = json.loads((OUT/cid/'close/runtime.json').read_text(encoding='utf-8'))
    samples = data['samples']
    run = [s for s in samples if s['phase'] == 'Long straight' and s['speed'] > 2.79]
    report = {'checks': data['checks'], 'failures': data['failures'],
              'actual_run_speed_mps': float(np.median([s['speed'] for s in run])),
              'running_multiplier': float(np.median([s['rate'] for s in run])),
              'running_cadence_spm': float(np.median([s['rate'] for s in run]))*180,
              'shots': data['shots'], 'clips': {}}
    for state, label in [('Idle', 'Idle 5 seconds'), ('Walk', 'Low speed Walk'), ('Run', 'Long straight')]:
        steady = [s for s in samples if s['phase'] == label and s['state'] == state
                  and s['time'] > data['phase_times'][label]+.35
                  and (state == 'Idle' or abs(s['speed'] - (1.26 if state == 'Walk' else 2.8)) < .015)]
        r = {'steady_frames': len(steady), 'feet': {}}
        for side in ['Left', 'Right']:
            flat = [s for s in steady if phase_flat(s, side)]
            foot = {}
            for part in ['Heel', 'Forefoot']:
                key = side+part
                # Actor Y is a navigation convention, not necessarily rendered terrain.
                foot[part+'_height_above_actor_mm'] = span([(s['feet'][key]['low']-s['position'][1])*1000 for s in flat])
            groups = []
            for s in flat:
                if not groups or s['frame'] != groups[-1][-1]['frame']+1:
                    groups.append([])
                groups[-1].append(s)
            residuals = []
            velocities = []
            for group in groups:
                if len(group) < 3:
                    continue
                points = np.array([s['feet'][side+'Forefoot']['centroid'] for s in group])[:, [0, 2]]
                residuals.append(float(np.linalg.norm(np.ptp(points, axis=0))*1000))
                velocities.append(float(np.linalg.norm(points[-1]-points[0])/(group[-1]['time']-group[0]['time'])))
            foot['support_spans'] = len(residuals)
            foot['world_support_sliding_mm'] = span(residuals)
            foot['world_support_drift_mps'] = span(velocities)
            r['feet'][side] = foot
        report['clips'][state] = r
    return report


def rendered_ground_audit(cid, surfaces):
    data = json.loads((OUT/cid/'close/runtime.json').read_text(encoding='utf-8'))
    geometry = []
    for surface in surfaces:
        if surface['path'].split('/')[-1] == 'ReturnZone':
            continue  # Transparent HUD ring is not terrain.
        faces = np.array(surface['vertices']).reshape(-1, 3, 3)
        geometry.append((surface['path'].split('/')[-1], faces,
                         faces[:, :, [0, 2]].min(axis=1), faces[:, :, [0, 2]].max(axis=1)))
    result = {}
    for state, label in [('Idle', 'Idle 5 seconds'), ('Walk', 'Low speed Walk'), ('Run', 'Long straight')]:
        heights = []
        offsets = []
        names = set()
        for sample in data['samples']:
            if sample['phase'] != label or sample['state'] != state or sample['time'] < data['phase_times'][label] + .35:
                continue
            for side in ['Left', 'Right']:
                if not phase_flat(sample, side):
                    continue
                for part in ['Heel', 'Forefoot']:
                    marker = sample['feet'][side+part]
                    point = np.array(marker['centroid'])[[0, 2]]
                    candidates = []
                    for name, faces, low, high in geometry:
                        mask = np.all(point >= low-1e-6, axis=1) & np.all(point <= high+1e-6, axis=1)
                        for triangle in faces[mask]:
                            a, b, c = triangle[:, [0, 2]]
                            matrix = np.stack([b-a, c-a], axis=1)
                            if abs(np.linalg.det(matrix)) < 1e-10:
                                continue
                            u, v = np.linalg.solve(matrix, point-a)
                            if u >= -1e-6 and v >= -1e-6 and u+v <= 1+1e-6:
                                y = triangle[0, 1] + u*(triangle[1, 1]-triangle[0, 1]) + v*(triangle[2, 1]-triangle[0, 1])
                                candidates.append((y, name))
                    if candidates:
                        ground_y, name = max(candidates)
                        names.add(name)
                        heights.append((marker['low']-ground_y)*1000)
                        offsets.append((sample['position'][1]-ground_y)*1000)
        result[state] = {'samples': len(heights), 'surfaces': sorted(names),
                         'sole_to_rendered_ground_mm': span(heights),
                         'actor_to_rendered_ground_mm': span(offsets)}
    return result


def main():
    before = json.loads((OUT/'before.json').read_text(encoding='utf-8'))
    protected = [name for name in before if name.startswith(('assets/animations/public_locomotion/',
        'assets/characters/survivor_animation_template/', 'art/blender/rigs/BH_Humanoid_Rig_v1',
        'weapons/', 'assets/characters/infected_basic_a/'))]
    changed = [name for name in protected if not (APP/name).exists() or hashlib.sha256((APP/name).read_bytes()).hexdigest() != before[name]]
    identity = {}
    for cid in ['xia_zhiyao', 'su_wanxing']:
        runtime = APP/f'assets/characters/{cid}/runtime/{cid}.glb'
        candidate = APP/f'test-output/survivor-upper-skin/candidates/{cid}.glb'
        identity[cid] = {'sha256': hashlib.sha256(runtime.read_bytes()).hexdigest(),
                         'exact_approved_candidate': runtime.read_bytes() == candidate.read_bytes()}
    report = {'method': 'Native 30Hz post-modifier skinned sole markers; fixed lowest 3mm Rest patches. Flat phase only, stable actual speed, first 0.35s of transition excluded. Sliding is world XZ range per contiguous support span, not accumulated travel. Clip heights are relative to actor baseline, NOT actual terrain. rendered_ground_audit projects marker XZ onto actual world-space road/sidewalk triangles. Short Run support windows have only 3-4 samples at this capture rate.',
              'protected_changed': changed, 'protected_files': len(protected), 'production_identity': identity,
              'characters': {cid: analyze(cid) for cid in identity}}
    surface_path = OUT/'ground-surfaces.json'
    if surface_path.exists():
        surfaces = json.loads(surface_path.read_text(encoding='utf-8'))
        report['rendered_ground_audit'] = {cid: rendered_ground_audit(cid, surfaces) for cid in identity}
        report['rendered_ground_acceptance_passed'] = all(
            state['samples'] > 0 and state['sole_to_rendered_ground_mm'][1] <= 10.0
            and state['sole_to_rendered_ground_mm'][0] >= -5.0
            for states in report['rendered_ground_audit'].values() for state in states.values())
    (OUT/'metrics.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
