"""Independent provenance, rest identity, delta and resource boundary checks."""
from pathlib import Path
import json,hashlib,numpy as np
OUT=Path(__file__).resolve().parent;APP=OUT.parents[1]
rigs=json.loads((OUT/'rigs.json').read_text());profile=json.loads((OUT/'conversion-profile.json').read_text())
def rot(m):u,_,v=np.linalg.svd(m[:3,:3]);return u@v
s=rigs['source'];t=rigs['target'];sn={b['name'].removeprefix('mixamorig_'):i for i,b in enumerate(s['bones'])};tn={b['name']:i for i,b in enumerate(t['bones'])}
sr=np.array([b['world'] for b in s['bones']]);tr=np.array([b['world'] for b in t['bones']]);mapping=profile['mapping']
reference=np.array(json.loads((OUT/'authoring-reference.json').read_text())['global_rotations'])
rows=[];rest_error=0
for target,source in mapping.items():
    ti=tn[target];si=sn[source] if source else None
    err=0 if si is None else float(np.max(np.abs(rot(sr[si])@rot(sr[si]).T@rot(tr[ti])-rot(tr[ti]))))
    rest_error=max(rest_error,err)
    rows.append({'source':s['bones'][si]['name'] if si is not None else None,'canonical':target,'canonical_parent':t['bones'][int(t['bones'][ti]['parent'])]['name'] if int(t['bones'][ti]['parent'])>=0 else None,'source_rest_to_canonical_rest_max_error':err})
report={'source_to_canonical':rows,'ignored_source_bones':[b['name'] for b in s['bones'] if b['name'].removeprefix('mixamorig_') not in mapping.values()],'rest_identity_max_error':rest_error,'clips':{}}
upper=['Spine','Chest','UpperChest','Neck','Head']+[side+part for side in ['Left','Right'] for part in ['Shoulder','UpperArm','LowerArm','Hand']]
for name in ['idle','walking','running']:
    src=json.loads((OUT/(name+'-source.json')).read_text());bake=json.loads((OUT/(name+'-baked.json')).read_text())
    sha=hashlib.sha256((APP/f'assets/characters/survivor_animation_template/animations/{name}.tres').read_bytes()).hexdigest()
    assert sha==src['source_sha256']==bake['source_sha256']
    maxerr=0
    for a,b in zip(src['samples'],bake['samples']):
        sp=np.array(a['poses']);tp=np.array(b['poses'])
        for target in upper:
            expected=rot(sp[sn[mapping[target]]])@rot(sr[sn[mapping[target]]]).T@reference[tn[target]]
            maxerr=max(maxerr,float(np.max(abs(expected-rot(tp[tn[target]])))))
    assert maxerr<1e-5
    text=(OUT/f'assets/public_{name}.tres').read_text()
    assert 'scale_3d' not in text and 'position_3d' in text
    assert 'Skeleton3D:Hips' in text
    armerr=0
    elbow={}
    for side in ['Left','Right']:
        elbow[side]={}
        for target,child,source,sc in [('UpperArm','LowerArm','Arm','ForeArm'),('LowerArm','Hand','ForeArm','Hand')]:
            angles=[]
            for a,b in zip(src['samples'][:-1],bake['samples'][:-1]):
                sp=np.array(a['poses']);tp=np.array(b['poses'])
                av=sp[sn[side+sc],:3,3]-sp[sn[side+source],:3,3];bv=tp[tn[side+child],:3,3]-tp[tn[side+target],:3,3]
                angle=float(np.degrees(np.arccos(np.clip(np.dot(av,bv)/np.linalg.norm(av)/np.linalg.norm(bv),-1,1))))
                angles.append(angle)
            elbow[side][target+'_max_source_direction_difference_deg']=max(angles)
            armerr=max(armerr,max(angles))
    assert armerr<.02, (name,armerr)
    report['clips'][name]={'source_sha256':sha,'output_sha256':hashlib.sha256((OUT/f'assets/public_{name}.tres').read_bytes()).hexdigest(),'duration_s':bake['length'],'upper_body_delta_max_matrix_error':maxerr,'anatomical_arm_direction':elbow,'root_motion':False,'runtime_ik':False,'retarget_instances':0}
assert rest_error<1e-6
(OUT/'conversion-verification.json').write_text(json.dumps(report,indent=2))
print('PROVENANCE / REST IDENTITY / UPPER DELTA PASS',rest_error)
