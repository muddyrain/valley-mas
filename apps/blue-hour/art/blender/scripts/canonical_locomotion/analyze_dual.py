"""Read-only candidate QA; no candidate geometry participates in the bake."""
from pathlib import Path
import json, numpy as np, math
from analyze_conversion import phases,contact_metrics
OUT=Path(__file__).resolve().parent;E=OUT/'evidence'
raw=json.loads((E/'dual-runtime-samples.json').read_text())
def mats(a):
    a=np.asarray(a).reshape(-1,3,4);o=np.tile(np.eye(4),(len(a),1,1));o[:,:3]=a;return o
def build(spec):
    vs=[];ws=[];bs=[];bvs=[];fs=[];offset=0
    for m in spec['meshes']:
        pref=E/m['prefix'];n=m['vertices'];k=int(m['influences'])
        v=np.fromfile(str(pref)+'_positions.bin','<f4').reshape(n,3).astype(float);w=np.fromfile(str(pref)+'_weights.bin','<f4').reshape(n,k)
        j=np.fromfile(str(pref)+'_joints.bin','<i4').reshape(n,k);f=np.fromfile(str(pref)+'_indices.bin','<i4').reshape(-1,3)
        bind=mats([b['matrix'] for b in m['binds']]);bones=np.array([b['bone'] for b in m['binds']],dtype=int)
        vs.append(v);ws.append(w);bs.append(bones[j]);bvs.append(np.einsum('nkij,nj->nki',bind[j],np.c_[v,np.ones(n)]));fs.append(f+offset);offset+=n
    w=np.concatenate(ws);b=np.concatenate(bs);bv=np.concatenate(bvs);faces=np.concatenate(fs)
    def skin(pose,ids=None):
        if ids is None:return np.einsum('nkij,nkj,nk->ni',pose[b],bv,w)[:,:3]
        return np.einsum('nkij,nkj,nk->ni',pose[b[ids]],bv[ids],w[ids])[:,:3]
    return skin,faces
def span(a):return [float(np.min(a)),float(np.max(a))]
report={'characters':{},'native_failures':raw['failures'],'same_library_instance':raw['shared_library_instance'],'resource_identity':raw['resource_identity'],'method':'Fixed Rest sole vertices under 6cm; rear/front 30%; contact centroid fixed low3mm. Native120Hz matrices. Edge ratios at30Hz are deformation indicators, not intersection proof.'}
canon=json.loads((OUT/'canonical-qa.json').read_text())
for cid,spec in raw['characters'].items():
    skin,faces=build(spec);rest=mats([b['global_rest'] for b in spec['bones']]);verts=skin(rest);ids={b['name']:i for i,b in enumerate(spec['bones'])}
    patches={}
    for side,sign in [('Left',1),('Right',-1)]:
        ix=np.where((verts[:,0]*sign>.015)&(verts[:,1]<.06))[0];z=verts[ix,2]
        pp={'sole':ix,'heel':ix[z<=z.min()+.3*np.ptp(z)],'forefoot':ix[z>=z.min()+.7*np.ptp(z)]}
        for part in ['heel','forefoot']:
            ii=pp[part];pp[part+'_contact']=ii[verts[ii,1]<=verts[ii,1].min()+.003]
        patches[side]=pp
    edges=np.unique(np.sort(np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[0,2]]]),axis=1),axis=0)
    el=np.linalg.norm(verts[edges[:,0]]-verts[edges[:,1]],axis=1);keep=el>=.002;el=el[keep];edges=edges[keep]
    mid=verts[edges].mean(1)
    zones={'shoulder_armpit_sleeve':(mid[:,1]>.99)&(mid[:,1]<1.29)&(abs(mid[:,0])>.1),'elbow_wrist':(mid[:,1]>.72)&(mid[:,1]<1.15)&(abs(mid[:,0])>.20),'chest_neck':(mid[:,1]>1.0)&(mid[:,1]<1.35)&(abs(mid[:,0])<.13),'hip_skirt_shorts':(mid[:,1]>.65)&(mid[:,1]<.92),'knee_calf':(mid[:,1]>.25)&(mid[:,1]<.65),'ankle_shoes':mid[:,1]<.25,'head_hair':mid[:,1]>1.29}
    char={'clips':{},'height_m':float(np.ptp(verts[:,1])),'rest_sole_y_m':float(verts[:,1].min())}
    for name,data in spec['clips'].items():
        short=name.removeprefix('public_');records=[];peaks={z:{'p99_stretch':0,'max_stretch':0,'max_edges_over_2x':0} for z in zones};first=last=None
        for frame,sample in enumerate(data['samples']):
            pose=mats(sample['poses']);feet={}
            for side,pp in patches.items():
                feet[side]={}
                for part,ix in pp.items():
                    p=skin(pose,ix);feet[side][part]=p.mean(0).tolist() if part.endswith('contact') else float(p[:,1].min())
            records.append({'time':sample['time'],'feet':feet})
            if frame%4==0 or frame==len(data['samples'])-1:
                p=skin(pose)
                if frame==0:first=p.copy()
                last=p
                ratio=np.linalg.norm(p[edges[:,0]]-p[edges[:,1]],axis=1)/el
                for zone,mask in zones.items():
                    r=ratio[mask];peak=peaks[zone]
                    peak['p99_stretch']=max(peak['p99_stretch'],float(np.percentile(r,99)))
                    peak['max_stretch']=max(peak['max_stretch'],float(r.max()))
                    peak['max_edges_over_2x']=max(peak['max_edges_over_2x'],int((r>2).sum()))
        m=contact_metrics(short,records,data['length']);speed=canon['clips'][short]['canonical']['mean_support_speed_m_s'];t=np.array([s['time'] for s in records])
        for side in ['Left','Right']:
            phase,flat,_,_=phases(short,t,data['length'],side);ix=np.where(flat)[0];ts=t[ix] if short=='idle' else phase[ix]
            x=np.array([r['feet'][side]['forefoot_contact'] for r in records])[ix][:,[0,2]];x[:,1]+=speed*ts
            m[side]['flat_residual_at_canonical_speed_mm']=float(np.linalg.norm(np.ptp(x,axis=0))*1000)
        char['clips'][short]={'contact':m,'deformation':peaks,'loop_mesh_gap_mm':float(np.linalg.norm(first-last,axis=1).max()*1000),'frames':records}
        print(cid,short,'contact',m,'deformation',peaks,flush=True)
    report['characters'][cid]=char
(OUT/'dual-qa.json').write_text(json.dumps(report,indent=2))
