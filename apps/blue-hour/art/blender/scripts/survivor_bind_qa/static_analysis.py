"""Analyze native rest bind, frozen bones, static stress and source protection."""
from pathlib import Path
import json,hashlib,numpy as np
P=Path(__file__).resolve().parent;APP=P.parents[1]
raw=json.loads((P/'evidence/dual-runtime-samples.json').read_text());poses=json.loads((P/'evidence/static-poses.json').read_text())
prior=json.loads((APP/'test-output/canonical-public-locomotion/evidence/dual-runtime-samples.json').read_text())
def matrices(a):
    a=np.array(a).reshape(-1,3,4);out=np.tile(np.eye(4),(len(a),1,1));out[:,:3]=a;return out
result={'characters':{},'library_unchanged':{},'protection':{}}
for f in [(APP/'assets/animations/public_locomotion')/('public_'+name+'.tres') for name in ['idle','walking','running']]:
    local=P/'assets'/f.name
    result['library_unchanged'][f.name]=hashlib.sha256(f.read_bytes()).hexdigest()==hashlib.sha256(local.read_bytes()).hexdigest()
for cid,spec in raw['characters'].items():
    m=spec['meshes'][0];pref=P/'evidence'/m['prefix'];n=m['vertices'];k=int(m['influences'])
    xyz=np.fromfile(str(pref)+'_positions.bin','<f4').reshape(n,3).astype(float);w=np.fromfile(str(pref)+'_weights.bin','<f4').reshape(n,k)
    j=np.fromfile(str(pref)+'_joints.bin','<i4').reshape(n,k);faces=np.fromfile(str(pref)+'_indices.bin','<i4').reshape(-1,3)
    bind=matrices([b['matrix'] for b in m['binds']]);bn=np.array([b['bone'] for b in m['binds']],int)
    bv=np.einsum('nkij,nj->nki',bind[j],np.c_[xyz,np.ones(n)])
    def deform(pose):return np.einsum('nkij,nkj,nk->ni',pose[bn[j]],bv,w)[:,:3]
    rest=deform(matrices([b['global_rest'] for b in spec['bones']]))
    edges=np.unique(np.sort(np.concatenate([faces[:,[0,1]],faces[:,[0,2]],faces[:,[1,2]]]),axis=1),axis=0)
    length=np.linalg.norm(rest[edges[:,0]]-rest[edges[:,1]],axis=1);keep=length>.002;edges=edges[keep];length=length[keep]
    center=rest[edges].mean(1)
    zones={'shoulder_armpit':(abs(center[:,0])>.10)&(abs(center[:,0])<.29)&(center[:,1]>1.03)&(center[:,1]<1.32),'elbow':(abs(center[:,0])>.29)&(abs(center[:,0])<.46),'wrist_hand':abs(center[:,0])>.46,'torso':(abs(center[:,0])<.15)&(center[:,1]>.90)&(center[:,1]<1.28),'lower':center[:,1]<.7}
    checks={'exact_previous_skeleton':spec['bones']==prior['characters'][cid]['bones'],'rest_skin_error_mm':float(np.linalg.norm(rest-xyz,axis=1).max()*1000),'rest_bound_height':float(np.ptp(rest[:,1])),'pose_tests':{},'joint_landmarks':{b['name']:b['global_rest'][3::4] for b in spec['bones'] if any(x in b['name'] for x in ['Arm','Hand','Shoulder'])}}
    for name,pose in poses[cid].items():
        pp=deform(matrices(pose));ratio=np.linalg.norm(pp[edges[:,0]]-pp[edges[:,1]],axis=1)/length
        checks['pose_tests'][name]={z:{'p99_stretch':float(np.percentile(ratio[mask],99)),'max_stretch':float(ratio[mask].max()),'edges_above_2':int((ratio[mask]>2).sum())} for z,mask in zones.items()}
    checks['animation_matrix_max_change']=max(float(np.max(np.abs(np.array([s['poses'] for s in clip['samples']])-np.array([s['poses'] for s in prior['characters'][cid]['clips'][name]['samples']])))) for name,clip in spec['clips'].items())
    result['characters'][cid]=checks
snapshot=json.loads((P/'protected-before.json').read_text());changes=[]
for path,sha in snapshot.items():
    f=Path(path);current=hashlib.sha256(f.read_bytes()).hexdigest() if f.exists() else None
    if sha!=current:changes.append({'path':path,'before':sha,'after':current})
result['protection']={'count':len(snapshot),'unchanged':len(snapshot)-len(changes),'changes':changes}
assert all(result['library_unchanged'].values())
assert all(c['exact_previous_skeleton'] and c['animation_matrix_max_change']==0 for c in result['characters'].values())
(P/'static-native-qa.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print('Static / source contract PASS; protected differences',changes)
