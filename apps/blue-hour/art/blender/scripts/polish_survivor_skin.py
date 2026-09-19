"""Local sleeve weight polish on frozen T-bind candidates; no geometry edits."""
from pathlib import Path
import sys,json,hashlib
import bpy,numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent))
from align_survivor_bind import bone_snapshot,smooth
from bind_character import weight_audit
from export_character_glb import export_character

APP=Path(__file__).resolve().parents[3]
BASE=APP/'test-output/survivor-t-pose-bind'
OUT=APP/'test-output/survivor-upper-skin'

def digest(a):return hashlib.sha256(np.asarray(a).tobytes()).hexdigest()

def main(cid):
    source=BASE/cid/(cid+'_t_pose_bind.blend')
    bpy.ops.wm.open_mainfile(filepath=str(source))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    xyz=np.array([v.co[:] for v in mesh.data.vertices]);bones=bone_snapshot(rig)
    names=[g.name for g in mesh.vertex_groups];idx={n:i for i,n in enumerate(names)}
    original=np.zeros((len(xyz),len(names)))
    for v in mesh.data.vertices:
        for g in v.groups:original[v.index,g.group]=g.weight
    weights=original.copy()
    labels=np.load(BASE/cid/'bind-correspondence.npz')['labels']
    strength=.95 if cid=='su_wanxing' else .45
    allowed=np.zeros(len(xyz),bool)
    _,weld_index=np.unique(np.round(xyz,6),axis=0,return_inverse=True)
    edges=np.unique(np.sort(weld_index[np.array([e.vertices[:] for e in mesh.data.edges])],axis=1),axis=0)
    weld_count=int(weld_index.max()+1);degree=np.bincount(edges.ravel(),minlength=weld_count)
    for side,sign,label in [('Left',1,2),('Right',-1,3)]:
        x=xyz[:,0]*sign;u=idx[side+'UpperArm'];l=idx[side+'LowerArm']
        mass=original[:,u]+original[:,l]
        # Keep both cylindrical sleeve sections coherent. Put the transition at
        # the actual elbow instead of spreading it over most of the forearm.
        arm=(labels==label)&(xyz[:,2]>1.02)&(x>.15)&(x<.53)
        allowed|=arm
        envelope=smooth(.27,.32,x)*(1-smooth(.47,.52,x))*arm
        # Front/back asymmetry localizes the inside crease without a planar cut.
        crease=.37+np.clip(xyz[:,1],-.06,.06)*.16
        halfwidth=.031 if cid=='su_wanxing' else .040
        lower=smooth(crease-halfwidth,crease+halfwidth,x)
        amount=(mass*lower-original[:,l])*envelope*strength
        weights[:,l]+=amount;weights[:,u]-=amount
        # Polish only the existing shoulder/sleeve blend on connected arm faces.
        # Freeze Head, the chest surface and the armpit boundary rather than
        # spreading a garment correction through nearby strands or torso faces.
        chest=idx['UpperChest'];pair=original[:,u]+original[:,chest]
        region=arm&(x<.32)&(original[:,chest]>1e-7)&(original[:,u]>1e-7)
        blend=smooth(.15,.20,x)*(1-smooth(.27,.32,x))*region
        ratio=original[:,u]/np.maximum(pair,1e-10)
        counts=np.bincount(weld_index)
        wr=np.bincount(weld_index,weights=ratio)/counts
        wb=np.bincount(weld_index,weights=blend)/counts
        # UV seams and semantic boundaries must not acquire different deltas.
        frozen=np.zeros(weld_count,bool);frozen[weld_index[~region]]=True
        wb[frozen]=0
        distance=np.full(weld_count,100);distance[frozen]=0
        for _ in range(5):
            previous=distance.copy()
            np.minimum.at(distance,edges[:,0],previous[edges[:,1]]+1)
            np.minimum.at(distance,edges[:,1],previous[edges[:,0]]+1)
        wb*=smooth(0,2 if cid=='su_wanxing' else 5,distance)
        for _ in range(8):
            total=np.zeros(weld_count)
            np.add.at(total,edges[:,0],wr[edges[:,1]])
            np.add.at(total,edges[:,1],wr[edges[:,0]])
            wr+=wb*(.40 if cid=='su_wanxing' else .10)*(total/np.maximum(degree,1)-wr)
        delta=(pair*wr[weld_index]-original[:,u])*wb[weld_index]
        delta=np.clip(delta,-.035,.035)
        weights[:,u]+=delta;weights[:,chest]-=delta
    # Redistribute existing UpperArm/LowerArm/UpperChest mass on the arm only.
    # Head, Chest and Hand stay bit-exact: no new hair, torso or wrist influences.
    changed=np.max(abs(weights-original),axis=1)>1e-9
    assert not np.any(changed&~allowed)
    assert np.min(weights)>-1e-8
    for i in np.flatnonzero(changed):
        for name in ['UpperChest']+[s+p for s in ['Left','Right'] for p in ['UpperArm','LowerArm']]:
            j=idx[name]
            mesh.vertex_groups[j].add([int(i)],float(weights[i,j]),'REPLACE')
    actual=np.zeros_like(weights)
    for v in mesh.data.vertices:
        for g in v.groups:actual[v.index,g.group]=g.weight
    assert np.array_equal(xyz,np.array([v.co[:] for v in mesh.data.vertices]))
    assert bones==bone_snapshot(rig)
    assert np.array_equal(actual[~allowed],original[~allowed])
    keep=[i for i,n in enumerate(names) if n not in ['UpperChest']+[s+p for s in ['Left','Right'] for p in ['UpperArm','LowerArm']]]
    assert np.array_equal(actual[:,keep],original[:,keep])
    mesh['weight_method']='upper_sleeve_local_crease_polish'
    folder=OUT/cid;folder.mkdir(parents=True,exist_ok=True)
    (folder/'.gdignore').write_text('',encoding='utf-8')
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/(cid+'_skin.blend')))
    audit=export_character(rig,[mesh],OUT/'candidates'/(cid+'.glb'))
    np.savez_compressed(folder/'weights.npz',xyz=xyz,before=original,after=actual,names=names,allowed=allowed,labels=labels)
    report={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'character':cid,'changed_vertices':int(changed.sum()),'allowed_vertices':int(allowed.sum()),'mesh_positions_sha256':digest(xyz),'unchanged_geometry':True,'unchanged_bones':bones==bone_snapshot(rig),'unchanged_outside_sleeve':True,'unchanged_non_arm_columns':True,'unchanged_lower_body':np.array_equal(actual[xyz[:,2]<1.02],original[xyz[:,2]<1.02]),'weights':weight_audit(mesh),'strength':strength,'export':audit}
    (folder/'polish.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('POLISH',cid,report['changed_vertices'],report['weights'],flush=True)

if __name__=='__main__':main(sys.argv[sys.argv.index('--')+1])
