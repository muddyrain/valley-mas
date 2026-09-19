"""Reopen before/after Blender files and validate the weight-only scope."""
from pathlib import Path
import sys,json,hashlib
import bpy,numpy as np
from mathutils import Matrix
APP=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(APP/'art/blender/scripts'))
from align_survivor_bind import bone_snapshot
from bind_character import weight_audit
OUT=APP/'test-output/survivor-upper-skin';BASE=APP/'test-output/survivor-t-pose-bind'

def sha(a):return hashlib.sha256(np.asarray(a).tobytes()).hexdigest()
def read(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    images=[]
    for mat in mesh.data.materials:
        for n in mat.node_tree.nodes:
            if n.type=='TEX_IMAGE' and n.image:
                values=np.empty(len(n.image.pixels),np.float32);n.image.pixels.foreach_get(values)
                images.append([list(n.image.size),sha(values)])
    xyz=np.array([v.co[:] for v in mesh.data.vertices]);weights=np.zeros((len(xyz),len(mesh.vertex_groups)))
    for v in mesh.data.vertices:
        for g in v.groups:weights[v.index,g.group]=g.weight
    props={'bones':bone_snapshot(rig),'geometry':sha(xyz),'topology':sha(np.array([tuple(p.vertices) for p in mesh.data.polygons],np.int32)),'uv':sha(np.array([tuple(v.uv) for v in mesh.data.uv_layers.active.data],np.float32)),'textures':sorted(images),'materials':[m.name for m in mesh.data.materials],'socket':rig.get('weapon_socket_contract'),'identity':mesh.matrix_world==rig.matrix_world==Matrix.Identity(4),'rest_pose':all(b.matrix_basis==Matrix.Identity(4) for b in rig.pose.bones),'actions':len(bpy.data.actions),'height_m':float(np.ptp(xyz[:,2]))}
    return props,weights,xyz,weight_audit(mesh)

report={}
for cid in ['xia_zhiyao','su_wanxing']:
    old,w,v,_=read(BASE/cid/(cid+'_t_pose_bind.blend'))
    new,nw,nv,audit=read(OUT/cid/(cid+'_skin.blend'))
    data=np.load(OUT/cid/'weights.npz')
    checks={'exact_'+key:old[key]==new[key] for key in old}
    checks.update(lower_exact=np.array_equal(w[v[:,2]<1.02],nw[v[:,2]<1.02]),non_sleeve_exact=np.array_equal(w[~data['allowed']],nw[~data['allowed']]),fully_weighted=audit['unweighted']==0,max_four=audit['max_influences']<=4,normalized=audit['max_sum_error']<1e-6)
    report[cid]={'checks':checks,'pass':all(checks.values()),'weights':audit,'height_m':new['height_m']}
    print(cid,report[cid],flush=True)
(OUT/'blender-qa.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
assert all(x['pass'] for x in report.values())
