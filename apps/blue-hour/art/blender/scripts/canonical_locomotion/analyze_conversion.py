"""Canonical gate from native playback plus approved phase and contact measures."""
from pathlib import Path
import json, math
import numpy as np
OUT=Path(__file__).resolve().parent
runtime=json.loads((OUT/'evidence/canonical-runtime-samples.json').read_text())
rigs=json.loads((OUT/'rigs.json').read_text())
def phases(name,t,T,side):
    if name=='idle': return np.zeros(len(t)),np.ones(len(t),bool),np.ones(len(t),bool),np.ones(len(t),bool)
    strike,stance,landing,push=(7/24,13/24,2/24,3/24) if name=='walking' else (22/120,28/120,5/120,9/120)
    p=(t-strike-(0 if side=='Left' else T/2))%T
    return p,(p>=landing-1e-6)&(p<stance-push-1e-6),p<landing,(p>=stance-push)&(p<stance)
def range_mm(a):return [float(np.min(a)*1000),float(np.max(a)*1000)]
def contact_metrics(name,samples,T):
    t=np.array([s['time'] for s in samples]);out={}
    for side in ['Left','Right']:
        phase,flat,landing,push=phases(name,t,T,side)
        feet=[s['feet'][side] for s in samples]
        h=np.array([f['heel'] for f in feet]);f=np.array([f['forefoot'] for f in feet])
        xyz=np.array([q['forefoot_contact'] for q in feet])
        use=np.where(flat)[0];use=use[np.argsort(phase[use])]
        ts=phase[use] if name!='idle' else t[use]
        if name=='idle': speed=0.0
        else: speed=-float(np.polyfit(ts,xyz[use,2],1)[0])
        residual=xyz[use][:,[0,2]].copy();residual[:,1]+=speed*ts
        out[side]={'heel_flat_mm':range_mm(h[flat]),'forefoot_flat_mm':range_mm(f[flat]),'landing_heel_mm':range_mm(h[landing]),'push_forefoot_mm':range_mm(f[push]),'sole_all_mm':range_mm(np.array([q['sole'] for q in feet])), 'fitted_support_speed_m_s':speed,'flat_residual_at_own_speed_mm':float(np.linalg.norm(np.ptp(residual,axis=0))*1000)}
    mean=np.mean([q['fitted_support_speed_m_s'] for q in out.values()])
    for side in ['Left','Right']:
        phase,flat,_,_=phases(name,t,T,side);ids=np.where(flat)[0];ids=ids[np.argsort(phase[ids])]
        ts=phase[ids] if name!='idle' else t[ids]
        xyz=np.array([q['feet'][side]['forefoot_contact'] for q in samples])[ids][:,[0,2]]
        xyz[:,1]+=mean*ts
        out[side]['flat_residual_at_shared_speed_mm']=float(np.linalg.norm(np.ptp(xyz,axis=0))*1000)
    out['mean_support_speed_m_s']=float(mean)
    out['flight_fraction_3mm']=float(np.mean([min(s['feet'][side]['sole'] for side in ['Left','Right'])>.003 for s in samples[:-1]]))
    return out
report={'clips':{},'native_failures':runtime['failures'],'method':'120Hz. Flat phase source definitions; heel landing and forefoot push measured separately. Sole reference is canonical diagnostic envelope, not either character shoe.'}
for name in ['idle','walking','running']:
    b=json.loads((OUT/(name+'-baked.json')).read_text());c=json.loads((OUT/(name+'-comparison.json')).read_text())
    names=b['target_names'];p=np.array([s['poses'] for s in b['samples']]);times=np.array([s['time'] for s in b['samples']])
    native=runtime['characters']['canonical']['clips']['public_'+name]
    pn=np.array([s['poses'] for s in native['samples']]).reshape(-1,len(names),3,4)
    nmap={x['name']:i for i,x in enumerate(runtime['characters']['canonical']['bones'])}
    ix=[nmap[n] for n in names];pn=pn[:,ix]
    pose_error=float(np.max(np.abs(pn[:-1]-p[:-1,:,:3,:])))
    loop={}
    for bone in ['Hips','LeftFoot','RightFoot','LeftLowerLeg','RightLowerLeg','LeftToes','RightToes','LeftUpperArm','RightUpperArm','Head']:
        i=names.index(bone);q=p[:,i];v1=(q[1,:3,3]-q[0,:3,3])*120;v0=(q[-1,:3,3]-q[-2,:3,3])*120
        u0,_,v0r=np.linalg.svd(q[0,:3,:3]);u1,_,v1r=np.linalg.svd(q[-1,:3,:3])
        angle=math.degrees(math.acos(np.clip((np.trace((u0@v0r)@(u1@v1r).T)-1)/2,-1,1)))
        loop[bone]={'position_mm':float(np.linalg.norm(q[0,:3,3]-q[-1,:3,3])*1000),'rotation_deg':angle,'velocity_seam_m_s':float(np.linalg.norm(v1-v0))}
    knee={}
    for side in ['Left','Right']:
        a=p[:,names.index(side+'UpperLeg'),:3,3];k=p[:,names.index(side+'LowerLeg'),:3,3];f=p[:,names.index(side+'Foot'),:3,3]
        u=a-k;v=f-k
        flex=180-np.degrees(np.arccos(np.clip(np.sum(u*v,axis=1)/np.linalg.norm(u,axis=1)/np.linalg.norm(v,axis=1),-1,1)))
        knee[side]={'range_deg':[float(flex.min()),float(flex.max())],'max_120Hz_step_deg':float(abs(np.diff(flex)).max()),'length_variation_mm':float(max(np.ptp(np.linalg.norm(u,axis=1)),np.ptp(np.linalg.norm(v,axis=1)))*1000)}
    source=contact_metrics(name,c['source'],b['length']);canonical=contact_metrics(name,b['samples'],b['length'])
    report['clips'][name]={'duration':b['length'],'cadence':0 if name=='idle' else 120/b['length'],'stride_ratio':b['stride_ratio'],'source':source,'canonical':canonical,'loop':loop,'knee':knee,'hips_xyz_range_mm':(np.ptp(p[:,names.index('Hips'),:3,3],axis=0)*1000).tolist(),'hips_adaptation_mm':range_mm([x['hips_y'] for x in c['compensation']]),'native_baked_matrix_max_error':pose_error}
    print(name,json.dumps(report['clips'][name]),flush=True)
(OUT/'canonical-qa.json').write_text(json.dumps(report,indent=2))
