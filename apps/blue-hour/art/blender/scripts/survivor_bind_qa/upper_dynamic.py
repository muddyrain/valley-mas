"""Aligned T-space regional deformation metrics; supplements broad legacy bands."""
from pathlib import Path
import numpy as np,json
P=Path(__file__).resolve().parent
raw=json.loads((P/'evidence/dual-runtime-samples.json').read_text())
def mats(a):
    a=np.asarray(a).reshape(-1,3,4);r=np.tile(np.eye(4),(len(a),1,1));r[:,:3]=a;return r
result={}
for cid,c in raw['characters'].items():
    m=c['meshes'][0];pref=P/'evidence'/m['prefix'];n=m['vertices'];k=int(m['influences'])
    v=np.fromfile(str(pref)+'_positions.bin','<f4').reshape(n,3).astype(float);w=np.fromfile(str(pref)+'_weights.bin','<f4').reshape(n,k);j=np.fromfile(str(pref)+'_joints.bin','<i4').reshape(n,k)
    f=np.fromfile(str(pref)+'_indices.bin','<i4').reshape(-1,3);e=np.unique(np.sort(np.concatenate([f[:,[0,1]],f[:,[0,2]],f[:,[1,2]]]),axis=1),axis=0)
    lengths=np.linalg.norm(v[e[:,0]]-v[e[:,1]],axis=1);e=e[lengths>.002];lengths=lengths[lengths>.002]
    mid=v[e].mean(1);a=abs(mid[:,0])
    zones={'shoulder_armpit':(a>.1)&(a<.29)&(mid[:,1]>1.02)&(mid[:,1]<1.31),'sleeve_elbow':(a>.29)&(a<.50)&(mid[:,1]>1.05)&(mid[:,1]<1.34),'wrist_hand':a>.50,'chest_neck':(a<.15)&(mid[:,1]>.98)&(mid[:,1]<1.36),'hair':(mid[:,1]>1.3)|((mid[:,2]<-.06)&(mid[:,1]>1.05))}
    bs=np.array([x['bone'] for x in m['binds']],int);bind=mats([x['matrix'] for x in m['binds']]);bv=np.einsum('nkij,nj->nki',bind[j],np.c_[v,np.ones(n)])
    result[cid]={}
    for clip,data in c['clips'].items():
        peaks={z:{'p99':0,'max':0,'over_2':0,'frame_at_max':0} for z in zones}
        for frame,sample in enumerate(data['samples']):
            if frame%4:continue
            pose=mats(sample['poses']);p=np.einsum('nkij,nkj,nk->ni',pose[bs[j]],bv,w)[:,:3]
            ratios=np.linalg.norm(p[e[:,0]]-p[e[:,1]],axis=1)/lengths
            for z,mask in zones.items():
                r=ratios[mask];peak=peaks[z];maximum=float(r.max())
                if maximum>peak['max']:peak.update(max=maximum,frame_at_max=sample['time'])
                peak['p99']=max(peak['p99'],float(np.percentile(r,99)));peak['over_2']=max(peak['over_2'],int((r>2).sum()))
        result[cid][clip]=peaks
        print(cid,clip,peaks,flush=True)
(P/'upper-dynamic-qa.json').write_text(json.dumps(result,indent=2))
