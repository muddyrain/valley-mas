"""Compare native LBS before/after, same public poses; no animation evaluation shortcut."""
from pathlib import Path
import json,hashlib,sys,numpy as np
P=Path(__file__).resolve().parent;APP=P.parents[1];BASE=APP/'test-output/survivor-t-pose-bind'
new=json.loads((P/'evidence/dual-runtime-samples.json').read_text())
old=json.loads((BASE/'evidence/dual-runtime-samples.json').read_text())

def mats(a):
    a=np.asarray(a).reshape(-1,3,4);out=np.tile(np.eye(4),(len(a),1,1));out[:,:3]=a;return out

def build(root,c):
    m=c['meshes'][0];prefix=root/'evidence'/m['prefix'];n=m['vertices'];k=int(m['influences'])
    v=np.fromfile(str(prefix)+'_positions.bin','<f4').reshape(n,3).astype(float)
    w=np.fromfile(str(prefix)+'_weights.bin','<f4').reshape(n,k)
    j=np.fromfile(str(prefix)+'_joints.bin','<i4').reshape(n,k)
    f=np.fromfile(str(prefix)+'_indices.bin','<i4').reshape(-1,3)
    b=np.array([x['bone'] for x in m['binds']],int)[j]
    bind=mats([x['matrix'] for x in m['binds']]);bv=np.einsum('nkij,nj->nki',bind[j],np.c_[v,np.ones(n)])
    def skin(pose):return np.einsum('nkij,nkj,nk->ni',pose[b],bv,w)[:,:3]
    return v,f,skin

def hull_area(points):
    points=sorted(set(map(tuple,points)))
    def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower=[];upper=[]
    for p in points:
        while len(lower)>1 and cross(lower[-2],lower[-1],p)<=0:lower.pop()
        lower.append(p)
    for p in reversed(points):
        while len(upper)>1 and cross(upper[-2],upper[-1],p)<=0:upper.pop()
        upper.append(p)
    h=np.array(lower[:-1]+upper[:-1])
    return abs(np.dot(h[:,0],np.roll(h[:,1],1))-np.dot(h[:,1],np.roll(h[:,0],1)))/2

report={'characters':{},'native_checks':new['checks'],'native_failures':new['failures'],'same_library':new['shared_library_instance'],'method':'Native 120Hz poses. Surface edge ratios sampled at30Hz; elbow cross-section hull projected perpendicular to posed bone bisector, fixed Rest vertex band +/-12mm. Hull area is a volume-retention proxy, not closed mesh volume or collision proof.'}
for cid,c in new['characters'].items():
    before=old['characters'][cid];v,f,skin=build(P,c);ov,of,oskin=build(BASE,before)
    # Godot's vertex cache optimization can reorder indices after a skin edit.
    # Match the unchanged coordinate multiset before comparing deformed surfaces.
    vi=np.lexsort(v.T);oi=np.lexsort(ov.T)
    assert np.array_equal(v[vi],ov[oi])
    remap=np.empty(len(v),int);remap[vi]=oi
    inverse=np.empty(len(v),int);inverse[remap]=np.arange(len(v))
    _,vg=np.unique(v,axis=0,return_inverse=True)
    _,og=np.unique(ov,axis=0,return_inverse=True)
    fa=np.sort(vg[f],axis=1);fb=np.sort(og[of],axis=1)
    assert np.array_equal(fa[np.lexsort(fa.T)],fb[np.lexsort(fb.T)])
    original_skin=oskin
    oskin=lambda pose: original_skin(pose)[remap]
    assert c['bones']==before['bones']
    ids={b['name']:i for i,b in enumerate(c['bones'])}
    edges=np.unique(np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[0,2]]]),axis=1),axis=0)
    length=np.linalg.norm(v[edges[:,0]]-v[edges[:,1]],axis=1);edges=edges[length>.002];length=length[length>.002]
    mid=v[edges].mean(1);a=abs(mid[:,0])
    zones={'shoulder':(a>.14)&(a<.30)&(mid[:,1]>1.02)&(mid[:,1]<1.31),'elbow_sleeve':(a>.30)&(a<.47)&(mid[:,1]>1.02)&(mid[:,1]<1.34),'wrist':a>.53}
    r={'exact_mesh':True,'exact_skeleton':True,'clips':{}}
    for clip,data in c['clips'].items():
        if '--run-only' in sys.argv and clip!='public_running':continue
        assert data==before['clips'][clip]
        lowmax=0.;headmax=0.;first=None;last=None;metrics={'before':{z:[] for z in zones},'after':{z:[] for z in zones}};sections={'before':[],'after':[]}
        for i,sample in enumerate(data['samples']):
            if i%4 and i!=len(data['samples'])-1:continue
            pose=mats(sample['poses']);p=skin(pose);op=oskin(pose)
            lowmax=max(lowmax,float(np.linalg.norm(p[v[:,1]<1.02]-op[v[:,1]<1.02],axis=1).max()))
            headmax=max(headmax,float(np.linalg.norm(p[v[:,1]>1.38]-op[v[:,1]>1.38],axis=1).max()))
            if first is None:first=p
            last=p
            for key,points in [('before',op),('after',p)]:
                ratio=np.linalg.norm(points[edges[:,0]]-points[edges[:,1]],axis=1)/length
                for z,mask in zones.items():metrics[key][z].append([float(np.percentile(ratio[mask],1)),float(np.percentile(ratio[mask],99)),float(ratio[mask].max())])
                if clip=='public_running':
                    for side,sign in [('Left',1),('Right',-1)]:
                        u=pose[ids[side+'UpperArm'],:3,:3]@np.linalg.inv(mats([c['bones'][ids[side+'UpperArm']]['global_rest']])[0,:3,:3])
                        l=pose[ids[side+'LowerArm'],:3,:3]@np.linalg.inv(mats([c['bones'][ids[side+'LowerArm']]['global_rest']])[0,:3,:3])
                        axis=u[:,0]+l[:,0];axis/=np.linalg.norm(axis)
                        e1=np.cross(axis,np.array([0,1,0]));e1/=np.linalg.norm(e1);e2=np.cross(axis,e1)
                        ring=(abs(v[:,0]*sign-.37)<.012)&(v[:,1]>1.08)&(v[:,1]<1.30)
                        rest_area=hull_area(v[ring][:,[1,2]])
                        area=hull_area(np.column_stack([points[ring]@e1,points[ring]@e2]))
                        sections[key].append(float(area/rest_area))
        r['clips'][clip]={'pose_matrices_exact':True,'lower_max_displacement_mm':lowmax*1000,'head_max_displacement_mm':headmax*1000,'loop_mesh_gap_mm':float(np.linalg.norm(last-first,axis=1).max()*1000),'edges':{key:{z:{'minimum_p01':min(x[0] for x in rows),'maximum_p99':max(x[1] for x in rows),'max':max(x[2] for x in rows)} for z,rows in values.items()} for key,values in metrics.items()},'elbow_section_area_ratio':{key:{'min':min(vals),'median':float(np.median(vals))} for key,vals in sections.items() if vals}}
    report['characters'][cid]=r
    print(cid,json.dumps(r['clips']['public_running']),flush=True)
report['clips_unchanged']={name:hashlib.sha256((P/'assets'/name).read_bytes()).hexdigest()==hashlib.sha256((APP/'assets/animations/public_locomotion'/name).read_bytes()).hexdigest() for name in ['public_idle.tres','public_walking.tres','public_running.tres']}
snapshot=json.loads((P/'protected-before.json').read_text())
report['protected']={'count':len(snapshot),'changed':[f for f,h in snapshot.items() if not Path(f).exists() or hashlib.sha256(Path(f).read_bytes()).hexdigest()!=h]}
assert not report['native_failures'] and all(report['clips_unchanged'].values())
assert all(d['lower_max_displacement_mm']<.001 and d['head_max_displacement_mm']<.001 for c in report['characters'].values() for d in c['clips'].values())
(P/('probe-qa.json' if '--run-only' in sys.argv else 'native-qa.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
print('Native regression PASS; protected differences',report['protected']['changed'])
