"""Measure the source, uncompensated transfer and final character animations."""
import json
import math
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT/'test-output/xia-zhiyao-locomotion'
SIDES = ('Left','Right')


def span(values):
    values = np.asarray(values)
    return {'min': float(values.min()), 'max': float(values.max()), 'range': float(np.ptp(values))}


def phase(name, time, side, length):
    if name == 'idle':
        return 'flat'
    strike = (7/24 if name == 'walking' else 22/120)+(length/2 if side == 'Right' else 0)
    p = (time-strike)%length
    if length-p < 1e-6:
        p = 0.0
    stance = 13/24 if name == 'walking' else 28/120
    landing = 2/24 if name == 'walking' else 5/120
    push = 3/24 if name == 'walking' else 9/120
    return 'landing' if p < landing-1e-6 else 'flat' if p <= stance-push+1e-6 else 'push' if p <= stance+1e-6 else 'swing'


def measure(name, samples, length, source=False):
    data = {'feet': {}, 'duration': length}
    t = np.array([s['time'] for s in samples])
    for side in SIDES:
        feet = data['feet'][side] = {}
        for stage, part in [('landing','heel'),('flat','heel'),('flat','forefoot'),('push','forefoot')]:
            ids = np.array([i for i,s in enumerate(samples[:-1]) if phase(name,s['time'],side,length)==stage])
            if not len(ids):
                continue
            strike = (7/24 if name == 'walking' else 22/120)+(length/2 if side == 'Right' else 0)
            local_time = t[ids] if name == 'idle' else (t[ids]-strike)%length
            if name != 'idle':
                local_time[np.abs(local_time-length)<1e-6] = 0.0
            order = np.argsort(local_time)
            ids, local_time = ids[order], local_time[order]
            points = np.array([samples[i]['feet'][side][part+'_contact'] for i in ids])
            speed = -np.polyfit(local_time,points[:,2],1)[0]
            nominal = 0 if name == 'idle' else 1.425 if name == 'walking' else 2.57
            residual = points[:,[0,2]].copy()
            residual[:,1] += local_time*nominal
            fitted = points[:,[0,2]].copy()
            fitted[:,1] += local_time*speed
            feet[stage+'_'+part] = {
                'height_mm': span([samples[i]['feet'][side][part]*1000 for i in ids]),
                'support_speed_m_s': float(speed),
                'slide_at_source_speed_mm': float(np.linalg.norm(np.ptp(residual,axis=0))*1000),
                'slide_at_fitted_speed_mm': float(np.linalg.norm(np.ptp(fitted,axis=0))*1000),
                'phase_samples': len(ids)}
        feet['sole_height_mm'] = span([s['feet'][side]['sole']*1000 for s in samples])
        up, low, foot = (side+'UpLeg', side+'Leg', side+'Foot') if source else (side+'UpperLeg', side+'LowerLeg', side+'Foot')
        angles = []
        for s in samples:
            hip,knee,ankle = [np.array(s['joints'][n]) for n in (up,low,foot)]
            a,b = knee-hip,ankle-knee
            angles.append(math.degrees(math.acos(np.clip(np.dot(a,b)/np.linalg.norm(a)/np.linalg.norm(b),-1,1))))
        feet['knee_flexion_deg'] = span(angles)
        feet['knee_max_step_deg'] = float(np.max(np.abs(np.diff(angles))))
    for i,axis in enumerate(('lateral','vertical','forward')):
        data['hips_'+axis+'_mm'] = span([s['joints']['Hips'][i]*1000 for s in samples])
    data['both_feet_above_3mm_percent'] = 100*np.mean([all(s['feet'][side]['sole']>.003 for side in SIDES) for s in samples[:-1]])
    torso, head = [], []
    for sample in samples:
        joints = sample['joints']
        body = np.array(joints['Neck'])-np.array(joints['Hips'])
        neck = np.array(joints['Head'])-np.array(joints['Neck'])
        torso.append(math.degrees(math.atan2(body[2],body[1])))
        head.append(math.degrees(math.atan2(neck[2],neck[1])))
    data['torso_lean_deg'] = span(torso)
    data['neck_head_line_lean_deg'] = span(head)
    for side in SIDES:
        flat_samples = [s for s in samples[:-1] if phase(name,s['time'],side,length)=='flat']
        pitches = []
        for s in flat_samples:
            direction = np.array(s['feet'][side]['forefoot_contact'])-np.array(s['feet'][side]['heel_contact'])
            pitches.append(math.degrees(math.atan2(direction[1],np.linalg.norm(direction[[0,2]]))))
        data['feet'][side]['flat_sole_pitch_deg'] = span(pitches)
    return data


report = {}
for name in ('idle','walking','running'):
    baked = json.loads((OUT/(name+'-baked.json')).read_text())
    comp = json.loads((OUT/(name+'-comparison.json')).read_text())
    samples = baked['samples']
    r = {'source': measure(name,comp['source'],baked['length'],True), 'raw': measure(name,comp['raw'],baked['length']), 'retarget': measure(name,samples,baked['length']), 'stride_ratio':baked['stride_ratio']}
    matching = 0.0 if name=='idle' else float(np.mean([r['retarget']['feet'][s]['flat_forefoot']['support_speed_m_s'] for s in SIDES]))
    r['matching_speed_m_s'] = matching
    r['slide_at_common_speed_mm'] = {}
    for side in SIDES:
        rows = [s for s in samples[:-1] if phase(name,s['time'],side,baked['length'])=='flat']
        strike = (7/24 if name=='walking' else 22/120)+(baked['length']/2 if side=='Right' else 0)
        time = np.array([s['time'] if name=='idle' else (s['time']-strike)%baked['length'] for s in rows])
        time[np.abs(time-baked['length'])<1e-6] = 0.0
        r['slide_at_common_speed_mm'][side] = {}
        for part in ('heel','forefoot'):
            pts = np.array([s['feet'][side][part+'_contact'] for s in rows])[:,[0,2]]
            pts[:,1] += time*matching
            r['slide_at_common_speed_mm'][side][part] = float(np.linalg.norm(np.ptp(pts,axis=0))*1000)
    r['compensation_hips_y_mm'] = span([x['hips_y']*1000 for x in comp['compensation']])
    r['compensation_foot_pitch_deg'] = {side: span([x['foot_pitch_degrees'][side] for x in comp['compensation']]) for side in SIDES}
    poses = np.array([s['poses'] for s in samples])
    r['loop'] = {}
    r['bone_max_step_deg'] = {}
    for i,bone in enumerate(baked['target_names']):
        first,last = poses[0,i],poses[-1,i]
        angle = math.degrees(math.acos(np.clip((np.trace(first[:3,:3].T@last[:3,:3])-1)/2,-1,1)))
        velocity = (poses[1,i,:3,3]-poses[0,i,:3,3])*120-(poses[-1,i,:3,3]-poses[-2,i,:3,3])*120
        r['loop'][bone] = {'position_mm':float(np.linalg.norm(first[:3,3]-last[:3,3])*1000), 'rotation_deg':angle,'velocity_seam_m_s':float(np.linalg.norm(velocity))}
        change = np.einsum('nji,njk->nik',poses[:-1,i,:3,:3],poses[1:,i,:3,:3])
        angles = np.degrees(np.arccos(np.clip((np.trace(change,axis1=1,axis2=2)-1)/2,-1,1)))
        r['bone_max_step_deg'][bone] = float(angles.max())
    report[name] = r
(OUT/'analysis.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
for name,r in report.items():
    print(name,'ratio',r['stride_ratio'],'hips compensation',r['compensation_hips_y_mm'])
    for side in SIDES:
        print(side,json.dumps(r['retarget']['feet'][side]))
