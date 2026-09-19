"""Convert reviewed A-pose surfaces to frozen canonical T bind; no animation edits."""
from pathlib import Path
import sys,json,hashlib,argparse,math
import bpy,numpy as np
from mathutils import Vector,Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bind_character import classify_regions,albedo_per_vertex,weight_audit
from create_humanoid_rig import definition
from export_character_glb import export_character
APP=Path(__file__).resolve().parents[3]
OUT=APP/'test-output/survivor-t-pose-bind'
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def bone_snapshot(rig):
    return {b.name:{'parent':b.parent.name if b.parent else None,'matrix':[list(x) for x in b.matrix_local],'length':b.length,'head':list(b.head_local),'tail':list(b.tail_local)} for b in rig.data.bones}

def localize_aligned_weights(weights,result,idx):
    for side,sign in [('Left',1),('Right',-1)]:
        extent=result[:,0]*sign
        hand=idx[side+'Hand'];lowerarm=idx[side+'LowerArm'];upperarm=idx[side+'UpperArm']
        amount=weights[:,hand]*(1-smooth(.52,.59,extent))
        weights[:,hand]-=amount;weights[:,lowerarm]+=amount
        amount=weights[:,lowerarm]*(1-smooth(.30,.40,extent))
        weights[:,lowerarm]-=amount;weights[:,upperarm]+=amount
        amount=weights[:,upperarm]*smooth(.40,.50,extent)
        weights[:,upperarm]-=amount;weights[:,lowerarm]+=amount
    merge=smooth(.16,.25,np.abs(result[:,0]))*smooth(.94,1.03,result[:,2])
    amount=weights[:,idx['Chest']]*merge
    weights[:,idx['Chest']]-=amount;weights[:,idx['UpperChest']]+=amount
def main(cid):
    path=APP/f'test-output/survivor-unified-rig/{cid}/{cid}_unified_rig_candidate.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig=next(x for x in bpy.context.scene.objects if x.type=='ARMATURE')
    mesh=next(x for x in bpy.context.scene.objects if x.type=='MESH')
    before=bone_snapshot(rig)
    for pb in rig.pose.bones:pb.matrix_basis.identity()
    mesh.modifiers.clear()
    xyz=np.array([v.co[:] for v in mesh.data.vertices]);original=xyz.copy()
    names=[g.name for g in mesh.vertex_groups];idx={n:i for i,n in enumerate(names)}
    weights=np.zeros((len(xyz),len(names)))
    for v in mesh.data.vertices:
        for g in v.groups:weights[v.index,g.group]=g.weight
    oldweights=weights.copy()
    labels=classify_regions(mesh,albedo_per_vertex(mesh),cid)
    fit=json.loads((APP/f'art/blender/rigs/{cid}_fit.json').read_text())
    transforms={};alignment={};arm_indices=[]
    for side,sign,label in [('Left',1,2),('Right',-1,3)]:
        segments=[]
        for part in ['Shoulder','UpperArm','LowerArm','Hand']:
            name=side+part;bone=rig.data.bones[name]
            a=np.array(fit['left'][part]['head'])*[sign,1,1]*1.03125
            b=np.array(fit['left'][part]['tail'])*[sign,1,1]*1.03125
            ta=np.array(bone.head_local);tb=np.array(bone.tail_local)
            direction=(b-a)/np.linalg.norm(b-a);targetdir=(tb-ta)/np.linalg.norm(tb-ta)
            rotation=np.array(Vector(direction).rotation_difference(Vector(targetdir)).to_matrix())
            ratio=np.linalg.norm(tb-ta)/np.linalg.norm(b-a)
            # No canonical finger endpoint exists: retain hand size instead of
            # shortening fingers to the diagnostic Hand bone tail.
            if part=='Hand':ratio=1.0
            # Length adjustment exists only in the authored mesh, never the rig/object.
            linear=rotation@(np.eye(3)+(ratio-1)*np.outer(direction,direction))
            matrix=np.eye(4);matrix[:3,:3]=linear;matrix[:3,3]=ta-linear@a
            transforms[name]=matrix
            alignment[name]={'source_head':a.tolist(),'source_tail':b.tolist(),'target_head':ta.tolist(),'target_tail':tb.tolist(),'mesh_axial_ratio':float(ratio)}
            segments.append((name,a,b));arm_indices.append(idx[name])
        mask=labels==label
        points=xyz[mask];chain=np.zeros((len(points),4))
        # Continuous arclength coordinate follows the anatomical A chain.
        ds=[];ts=[]
        for name,a,b in segments:
            v=b-a;t=np.clip((points-a)@v/np.dot(v,v),0,1)
            ds.append(np.linalg.norm(points-a-t[:,None]*v,axis=1));ts.append(t)
        nearest=np.argmin(np.array(ds),axis=0)
        lengths=np.array([np.linalg.norm(b-a) for _,a,b in segments]);offset=np.r_[0,np.cumsum(lengths)]
        s=offset[nearest]+np.array(ts)[nearest,np.arange(len(points))]*lengths[nearest]
        elbow=offset[2];wrist=offset[3]
        lower=smooth(elbow-.045,elbow+.045,s);hand=smooth(wrist-.03,wrist+.03,s)
        shoulder=1-smooth(offset[1]-.035,offset[1]+.06,s)
        chain[:,0]=shoulder;chain[:,1]=(1-shoulder)*(1-lower);chain[:,2]=(1-hand)*lower;chain[:,3]=hand
        chain/=chain.sum(1)[:,None]
        weights[mask]=0
        for k,(name,_,_) in enumerate(segments):weights[mask,idx[name]]=chain[:,k]
    # Preserve reviewed torso/hair/lower body, but remove arm pollution off arm surfaces.
    nonarm=~np.isin(labels,[2,3]);upper=xyz[:,2]>.88
    removed=weights[:,arm_indices].sum(1)
    selected=nonarm&upper
    weights[np.ix_(selected,arm_indices)]=0
    for i in np.where(selected)[0]:
        target='Head' if labels[i]==1 else ('UpperChest' if xyz[i,2]>1.14 else 'Chest')
        weights[i,idx[target]]+=removed[i]
    # Smooth the arm/chest junction on the seam-welded surface; never diffuse into hair cores.
    _,inverse=np.unique(np.round(xyz,5),axis=0,return_inverse=True)
    edges=np.unique(np.sort(inverse[np.array([e.vertices[:] for e in mesh.data.edges])],axis=1),axis=0)
    nw=inverse.max()+1;weld=np.zeros((nw,len(names)));np.add.at(weld,inverse,weights);weld/=np.bincount(inverse)[:,None]
    coords=np.zeros((nw,3));np.add.at(coords,inverse,xyz);coords/=np.bincount(inverse)[:,None]
    lab=np.zeros(nw,int);lab[inverse]=labels
    cross=edges[lab[edges[:,0]]!=lab[edges[:,1]]]
    dist=np.full(nw,100);dist[np.unique(cross)]=0
    for _ in range(24):
        prev=dist.copy();np.minimum.at(dist,edges[:,0],prev[edges[:,1]]+1);np.minimum.at(dist,edges[:,1],prev[edges[:,0]]+1)
    blend=np.clip((24-dist)/8,0,1)*.5
    blend[(coords[:,2]<.88)|(coords[:,2]>1.42)]=0
    blend[(lab==1)&(dist>20)]=0
    degree=np.bincount(edges.ravel(),minlength=nw)
    for _ in range(96):
        adj=np.zeros_like(weld);np.add.at(adj,edges[:,0],weld[edges[:,1]]);np.add.at(adj,edges[:,1],weld[edges[:,0]])
        weld+=blend[:,None]*(adj/np.maximum(degree[:,None],1)-weld)
    weights=weld[inverse]
    # Reduce semantic influence families before the four-weight limit. Dropping
    # alternating fifth influences along one seam creates visible skin spikes.
    upper_mask=xyz[:,2]>.88
    weights[upper_mask,idx['Chest']]+=weights[upper_mask,idx['Spine']]
    weights[upper_mask,idx['Spine']]=0
    torso_cleanup=smooth(.90,1.02,xyz[:,2])
    for name in ['Hips']+[s+p for s in ['Left','Right'] for p in ['UpperLeg','LowerLeg','Foot','Toes']]:
        amount=weights[:,idx[name]]*torso_cleanup
        weights[:,idx[name]]-=amount;weights[:,idx['Chest']]+=amount
    for side,sign in [('Left',1),('Right',-1)]:
        shoulder=idx[side+'Shoulder'];upperarm=idx[side+'UpperArm']
        weights[:,idx['UpperChest']]+=weights[:,shoulder]
        weights[:,shoulder]=0
        junction=smooth(1.08,1.15,xyz[:,2])*(xyz[:,0]*sign>0)
        for part in ['LowerArm','Hand']:
            amount=weights[:,idx[side+part]]*junction
            weights[:,upperarm]+=amount
            weights[:,idx[side+part]]-=amount
        # Central chest must not acquire arm motion through an attached hair seam.
        keep_arm=smooth(.085,.15,xyz[:,0]*sign)
        removed=weights[:,upperarm]*(1-keep_arm)*nonarm
        weights[:,upperarm]-=removed;weights[:,idx['Chest']]+=removed
    weights[xyz[:,2]<.7]=oldweights[xyz[:,2]<.7]
    # Only the arm influence portion changes the mesh bind geometry.
    result=xyz.copy();homogeneous=np.c_[xyz,np.ones(len(xyz))]
    for name,matrix in transforms.items():
        moved=(homogeneous@matrix.T)[:,:3]
        result+=weights[:,idx[name],None]*(moved-xyz)
    # Re-evaluate influence locality on the aligned T surface. A source seam
    # near the torso must not retain a distant elbow/wrist influence after alignment.
    # A sleeve seam cannot alternate Chest/Head as the discarded fifth weight.
    # Merge adjacent torso controls before quantization, leaving the Head hair
    # influence and both elbow influences continuous across the same surface.
    localize_aligned_weights(weights,result,idx)
    # Connected hair/collar vertices can share the same semantic label while
    # still carrying sharply different Head weights. Smooth that actual weight
    # discontinuity on the surface, without moving the authored bind geometry.
    weld=np.zeros((nw,len(names)));np.add.at(weld,inverse,weights)
    weld/=np.bincount(inverse)[:,None]
    central=(np.abs(coords[:,0])<.30)&(coords[:,2]>1.02)&(coords[:,2]<1.40)
    sharp=np.max(np.abs(weld[edges[:,0]]-weld[edges[:,1]]),axis=1)>.10
    seeds=edges[sharp&central[edges[:,0]]&central[edges[:,1]]]
    distance=np.full(nw,100);distance[np.unique(seeds)]=0
    for _ in range(8):
        previous=distance.copy()
        np.minimum.at(distance,edges[:,0],previous[edges[:,1]]+1)
        np.minimum.at(distance,edges[:,1],previous[edges[:,0]]+1)
    strength=np.clip((8-distance)/4,0,1)*.5*central
    for _ in range(24):
        adj=np.zeros_like(weld)
        np.add.at(adj,edges[:,0],weld[edges[:,1]])
        np.add.at(adj,edges[:,1],weld[edges[:,0]])
        weld+=strength[:,None]*(adj/np.maximum(degree[:,None],1)-weld)
    weights=weld[inverse]
    # Diffusion must not reintroduce a distal limb or a fifth torso influence.
    localize_aligned_weights(weights,result,idx)
    keep=np.argsort(weights,axis=1)[:,-4:];limited=np.zeros_like(weights)
    np.put_along_axis(limited,keep,np.take_along_axis(weights,keep,axis=1),axis=1)
    weights=limited/limited.sum(1)[:,None]
    lower=original[:,2]<.7
    weights[lower]=oldweights[lower]
    result[lower]=original[lower]
    mesh.data.vertices.foreach_set('co',result.ravel())
    mesh.data.update()
    for group in mesh.vertex_groups:group.remove(list(range(len(xyz))))
    for i,row in enumerate(weights):
        for j in np.flatnonzero(row>1e-8):mesh.vertex_groups[int(j)].add([i],float(row[j]),'REPLACE')
    mod=mesh.modifiers.new('CanonicalSkin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=False
    mesh['weight_method']='canonical_t_bind_alignment_reviewed_upper_chain'
    for key in ['heat_unweighted_vertices','heat_proxy_vertices','hair_vertices','hair_core_vertices','hair_junction_edges','hair_arm_weight_before','hair_arm_weight_after']:
        if key in mesh:del mesh[key]
    assert bone_snapshot(rig)==before
    assert np.max(abs(result[lower]-original[lower]))==0
    assert np.max(abs(weights[lower]-oldweights[lower]))==0
    assert all(abs(x-1)<1e-7 for x in mesh.scale) and mesh.matrix_world==Matrix.Identity(4)
    assert rig.matrix_world==Matrix.Identity(4)
    assert not bpy.data.actions
    folder=OUT/cid;folder.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/(cid+'_t_pose_bind.blend')))
    audit=export_character(rig,[mesh],OUT/'candidates'/(cid+'.glb'))
    report={'character':cid,'source_candidate_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'skeleton_before':before,'skeleton_after':bone_snapshot(rig),'alignment':alignment,'height_m':float(np.ptp(result[:,2])),'vertices':len(result),'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'weights':weight_audit(mesh),'lower_mesh_max_change_m':0,'lower_weight_max_change':0,'changed_vertices':int(np.sum(np.linalg.norm(result-original,axis=1)>1e-7)),'export':audit,'region_counts':{str(i):int((labels==i).sum()) for i in range(4)}}
    (folder/'bind-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    np.savez_compressed(folder/'bind-correspondence.npz',source=original,target=result,labels=labels,weights=weights,old_weights=oldweights,names=names)
    print('BIND COMPLETE',cid,report['height_m'],report['weights'],flush=True)
if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:]
    main(args[0])
