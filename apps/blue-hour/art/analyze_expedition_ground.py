"""Independent world-triangle projection of native skinned-sole capture evidence."""
from pathlib import Path
import hashlib
import json
import numpy as np

APP = Path(__file__).resolve().parents[1]
OUT = APP / 'test-output/ground-contract'


def bounds(values):
    return [float(min(values)), float(max(values))] if values else None


def analyze(cid):
    folder = OUT / cid
    data = json.loads((folder / 'runtime.json').read_text(encoding='utf-8'))
    surfaces = json.loads((folder / 'surfaces.json').read_text(encoding='utf-8'))
    tri = np.concatenate([np.array(s['vertices']).reshape(-1, 3, 3) for s in surfaces])
    a = tri[:, 0]
    ab = tri[:, 1] - a
    ac = tri[:, 2] - a
    low, high = tri[:, :, [0, 2]].min(axis=1), tri[:, :, [0, 2]].max(axis=1)
    determinant = ab[:, 0]*ac[:, 2] - ab[:, 2]*ac[:, 0]

    def height(point):
        xz = np.array(point)[[0, 2]]
        mask = np.all(xz >= low-1e-7, axis=1) & np.all(xz <= high+1e-7, axis=1) & (abs(determinant) > 1e-10)
        origin, b, c, d = a[mask], ab[mask], ac[mask], determinant[mask]
        delta = xz - origin[:, [0, 2]]
        u = (delta[:, 0]*c[:, 2] - delta[:, 1]*c[:, 0])/d
        v = (b[:, 0]*delta[:, 1] - b[:, 2]*delta[:, 0])/d
        inside = (u >= -1e-6) & (v >= -1e-6) & (u+v <= 1+1e-6)
        ys = (origin[:, 1] + u*b[:, 1] + v*c[:, 1])[inside]
        return float(ys.max()) if len(ys) else float('nan')

    result = {'checks': data['checks'], 'failures': data['failures'], 'cases': {},
              'actor_error_mm': 0.0, 'selection_error_mm': 0.0}
    for sample in data['samples']:
        y = height(sample['position'])
        result['actor_error_mm'] = max(result['actor_error_mm'], abs(sample['position'][1]-y)*1000)
        result['selection_error_mm'] = max(result['selection_error_mm'], abs(sample['selection_y']-y-.012)*1000)
    for label in ['Spawn Idle', 'road Idle', 'road Run', 'open Idle', 'open Run',
                  'sidewalk Idle', 'sidewalk Run', 'POI arrival Idle']:
        sample_list = [s for s in data['samples'] if s['phase'] == label
                       and s['time'] > data['phase_times'][label]+.35]
        if 'Run' in label:
            sample_list = [s for s in sample_list if s['state'] == 'Run' and s['speed'] > 2.79]
        rows = []
        for sample in sample_list:
            for side in ['Left', 'Right']:
                if sample['state'] == 'Run':
                    phase = (sample['clip_time'] - 22/120 - (0 if side == 'Left' else 1/3)) % (2/3)
                    if not 5/120 <= phase < 19/120:
                        continue
                for part in ['Heel', 'Forefoot']:
                    foot = sample['feet'][side+part]
                    ground = height(foot['centroid'])
                    rows.append((sample['position'][1], ground, foot['low'], (foot['low']-ground)*1000))
        result['cases'][label] = {'sole_samples': len(rows), 'actor_y_m': bounds([r[0] for r in rows]),
                                 'render_ground_y_m': bounds([r[1] for r in rows]),
                                 'shoe_sole_y_m': bounds([r[2] for r in rows]),
                                 'shoe_ground_delta_mm': bounds([r[3] for r in rows])}
    result['static_ground_pass'] = all(
        case['sole_samples'] > 0 and -5 <= case['shoe_ground_delta_mm'][0]
        and case['shoe_ground_delta_mm'][1] <= 10
        for label, case in result['cases'].items() if 'Idle' in label)
    return result


def main():
    protected = json.loads((OUT/'protected-before.json').read_text(encoding='utf-8'))
    changed = [name for name, sha in protected.items()
               if not (APP/name).exists() or hashlib.sha256((APP/name).read_bytes()).hexdigest() != sha]
    report = {'method': 'Independent NumPy vertical projection against captured rendered world triangles; no runtime Ground Query calls. Rest sole low-3mm vertex patches, 30Hz. Run only stable >2.79m/s and flat support phase. Marker clearance is 12mm, not actor compensation.',
              'protected_changed': changed, 'protected_count': len(protected),
              'characters': {cid: analyze(cid) for cid in ['xia_zhiyao', 'su_wanxing']}}
    report['passed'] = not changed and all(c['static_ground_pass'] and not c['failures']
                                          and c['actor_error_mm'] < .1 for c in report['characters'].values())
    (OUT/'metrics.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
