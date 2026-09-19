"""Validate frozen rest, topology, UVs, material images, bind and lower body."""
from pathlib import Path
import sys,json,hashlib
import bpy,numpy as np
from mathutils import Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
from align_survivor_bind import bone_snapshot,APP,OUT
from bind_character import weight_audit
def topology(mesh):
    return hashlib.sha256(np.array([tuple(p.vertices) for p in mesh.data.polygons],dtype=np.int32).tobytes()).hexdigest()
def uv(mesh):
    return hashlib.sha256(np.array([tuple(x.uv) for x in mesh.data.uv_layers.active.data],dtype=np.float32).tobytes()).hexdigest()
def images(mesh):
    result=[]
    for mat in mesh.data.materials:
        for n in mat.node_tree.nodes:
            if n.type=='TEX_IMAGE' and n.image:
                pixels=np.empty(len(n.image.pixels),np.float32);n.image.pixels.foreach_get(pixels)
                result.append({'size':list(n.image.size),'sha256':hashlib.sha256(pixels.tobytes()).hexdigest(),'colorspace':n.image.colorspace_settings.name})
    return sorted(result,key=lambda x:x['sha256'])
def read(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig=next(x for x in bpy.context.scene.objects if x.type=='ARMATURE');mesh=next(x for x in bpy.context.scene.objects if x.type=='MESH')
    xyz=np.array([v.co[:] for v in mesh.data.vertices])
    deform=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());dm=deform.to_mesh();evalxyz=np.array([v.co[:] for v in dm.vertices]);deform.to_mesh_clear()
    return {'bones':bone_snapshot(rig),'topology':topology(mesh),'uv':uv(mesh),'images':images(mesh),'material_count':len(mesh.data.materials),'vertices':len(xyz),'height':float(np.ptp(xyz[:,2])),'identity_transforms':mesh.matrix_world==rig.matrix_world==Matrix.Identity(4),'pose_identity':all(b.matrix_basis==Matrix.Identity(4) for b in rig.pose.bones),'rest_skin_error_m':float(np.linalg.norm(evalxyz-xyz,axis=1).max()),'weights':weight_audit(mesh),'actions':len(bpy.data.actions),'socket':rig.get('weapon_socket_contract'),'no_constraints':all(len(b.constraints)==0 for b in rig.pose.bones)}
report={'characters':{}}
for cid in ['xia_zhiyao','su_wanxing']:
    old=read(APP/f'test-output/survivor-unified-rig/{cid}/{cid}_unified_rig_candidate.blend')
    new=read(OUT/cid/(cid+'_t_pose_bind.blend'))
    checks={key:old[key]==new[key] for key in ['bones','topology','uv','images','material_count','vertices','socket']}
    checks.update(identity=new['identity_transforms'],pose_identity=new['pose_identity'],no_constraints=new['no_constraints'],no_animation=new['actions']==0,normalized=new['weights']['max_sum_error']<1e-6,fully_weighted=new['weights']['unweighted']==0,four_weights=new['weights']['max_influences']<=4,rest_bind=new['rest_skin_error_m']<1e-5,height=abs(new['height']-1.65)<1e-5)
    corr=np.load(OUT/cid/'bind-correspondence.npz');mask=corr['source'][:,2]<.7
    checks['lower_mesh_exact']=bool(np.array_equal(corr['source'][mask],corr['target'][mask]));checks['lower_weights_exact']=bool(np.array_equal(corr['weights'][mask],corr['old_weights'][mask]))
    report['characters'][cid]={'checks':checks,'result':new,'pass':all(checks.values())}
report['same_skeleton']=report['characters']['xia_zhiyao']['result']['bones']==report['characters']['su_wanxing']['result']['bones']
report['pass']=all(x['pass'] for x in report['characters'].values()) and report['same_skeleton']
(OUT/'bind-contract-qa.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('BIND CONTRACT',report['pass'],{c:q['checks'] for c,q in report['characters'].items()},flush=True)
assert report['pass']
