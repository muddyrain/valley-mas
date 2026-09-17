"""Phase-aware in-place Walking contact and loop bake on the unchanged template."""
import hashlib
import json
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT/'assets/characters/survivor_animation_template/source/survivor_animation_template.fbx'
OUT = ROOT/'test-output/standard-survivor-walking-contact'
BLEND = ROOT/'art/blender/characters/standard_survivor_walking.blend'
OUT.mkdir(parents=True, exist_ok=True)
RATE = 24
DURATION = 25/RATE
SPEED = 1.425
STRIKE = {'Left': 7/RATE, 'Right': 7/RATE+DURATION/2}
STANCE = 13/RATE
HEEL_ROLL = 2/RATE
TOE_ROLL = 3/RATE
SEAM = 2/RATE
TRANSITION = 2/RATE
SIDES = ('Left', 'Right')
PREFIX = 'mixamorig:'
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(SOURCE), use_anim=True, automatic_bone_orientation=False, ignore_leaf_bones=False)
scene=bpy.context.scene
scene.frame_start,scene.frame_end=1,26
scene.render.fps=RATE
rig=next(o for o in scene.objects if o.type=='ARMATURE')
mesh=next(o for o in scene.objects if o.type=='MESH')
original=next(a for a in bpy.data.actions if a.name.endswith('|Walking'))
rig.animation_data.action=original
rig.animation_data.action_slot=original.slots[0]
for track in rig.animation_data.nla_tracks: track.mute=True
rest={b.name:[list(row) for row in b.matrix_local] for b in rig.data.bones}
parents={b.name:b.parent.name if b.parent else None for b in rig.data.bones}
object_matrices={o.name:[list(row) for row in o.matrix_world] for o in (rig,mesh)}

def bone(name): return rig.pose.bones[PREFIX+name]
def set_time(t):
    frame=1+t*RATE
    scene.frame_set(int(frame),subframe=frame%1)
    bpy.context.view_layer.update()
def smooth(x):
    x=max(0,min(1,x))
    return x*x*x*(10+x*(-15+6*x))
def hermite(a,b,da,db,u,length):
    return (2*u**3-3*u*u+1)*a + (u**3-2*u*u+u)*length*da + (-2*u**3+3*u*u)*b + (u**3-u*u)*length*db
def values():
    result={}
    for name,p in rig.pose.bones.items():
        loc,q,scale=p.matrix_basis.decompose()
        result[name]=np.array([*loc,*q,*scale])
    return result
def source_values(t):
    set_time(t)
    return values()
def apply(values_by_bone):
    for name,v in values_by_bone.items():
        p=rig.pose.bones[name]
        p.location=v[:3]
        p.rotation_mode='QUATERNION'
        p.rotation_quaternion=Quaternion(v[3:7]).normalized()
        p.scale=v[7:]
    bpy.context.view_layer.update()

# A short offline Hermite bridge repairs only the clip boundary of the source
# pose, including small upper-body endpoint differences. No runtime crossfade.
left=source_values(DURATION-SEAM)
right=source_values(SEAM)
left_before=source_values(DURATION-SEAM-.001)
left_after=source_values(DURATION-SEAM+.001)
right_before=source_values(SEAM-.001)
right_after=source_values(SEAM+.001)
for name in left:
    if np.dot(left[name][3:7],right[name][3:7])<0:
        for mapping in (right,right_before,right_after): mapping[name][3:7]*=-1
def loop_values(t):
    t=t%DURATION
    if SEAM<=t<=DURATION-SEAM: return source_values(t)
    u=(t-(DURATION-SEAM) if t>DURATION-SEAM else t+SEAM)/(2*SEAM)
    return {name:hermite(left[name],right[name],(left_after[name]-left_before[name])/.002,
                         (right_after[name]-right_before[name])/.002,u,2*SEAM) for name in left}

vertices=np.array([list(mesh.matrix_world@v.co) for v in mesh.data.vertices])
patches={}
rest_foot={}
source_flat={}
for side in SIDES:
    rf=rig.matrix_world@bone(side+'Foot').bone.matrix_local
    rt=rig.matrix_world@bone(side+'ToeBase').bone.matrix_local
    rest_foot[side]=rf
    forward=np.array(rt.translation-rf.translation);forward[2]=0;forward/=np.linalg.norm(forward)
    ids=np.where((vertices[:,0]*np.sign(rf.translation.x)>0)&(vertices[:,2]<.06))[0]
    depth=vertices[ids]@forward
    patches[side]={'sole':ids,'heel':ids[depth<depth.min()+.3*np.ptp(depth)],'forefoot':ids[depth>depth.min()+.7*np.ptp(depth)]}
    set_time((STRIKE[side]+.16)%DURATION)
    source_flat[side]=float((rig.matrix_world@bone(side+'Foot').head).x)

def phase(t,side): return (t-STRIKE[side])%DURATION
def support_matrix(p,side):
    rf=rest_foot[side]
    angle=math.radians(10*(1-smooth(p/HEEL_ROLL))) if p<HEEL_ROLL else -math.radians(38*smooth((p-(STANCE-TOE_ROLL))/TOE_ROLL))
    rotation=Matrix.Rotation(-angle,4,'X')
    target=rotation@rf
    ids=patches[side]['heel' if p<HEEL_ROLL else 'forefoot' if p>STANCE-TOE_ROLL else 'sole']
    relative=vertices[ids]-np.array(rf.translation)
    transformed=relative@np.array(rotation)[:3,:3].T
    target.translation=Vector((source_flat[side],-.34+SPEED*p, -float(transformed[:,2].min())+.001))
    # Rolling is about the current contact patch, whose ground trajectory stays
    # linear. This offsets ankle movement caused by the foot's rotation.
    pivot=ids[vertices[ids,2].argmin()]
    base=vertices[pivot]-np.array(rf.translation)
    rotated=np.array(rotation)[:3,:3]@base
    target.translation.y+=float(base[1]-rotated[1])
    return target

boundary_source={}
for side in SIDES:
    boundary_source[side]={}
    for endpoint in (0,STANCE):
        mats=[]
        for offset in (-.001,0,.001):
            apply(loop_values(STRIKE[side]+endpoint+offset))
            mats.append((rig.matrix_world@bone(side+'Foot').matrix).copy())
        boundary_source[side][endpoint]=(mats[1],(mats[2].translation-mats[0].translation)/.002)

def desired_target(t,side,source_world):
    p=phase(t,side)
    if p<=STANCE: return support_matrix(p,side),1.0
    distance=min(p-STANCE,DURATION-p)
    weight=1-smooth(distance/TRANSITION)
    if weight<=0: return source_world.copy(),0.0
    endpoint=STANCE if p-STANCE<DURATION-p else 0
    support=support_matrix(endpoint,side)
    source_boundary,source_velocity=boundary_source[side][endpoint]
    direction=1 if endpoint==STANCE else -1
    difference=support.translation-source_boundary.translation
    slope=(Vector((0,SPEED,0))-source_velocity)*direction
    correction=hermite(difference,Vector(),slope,Vector(),distance/TRANSITION,TRANSITION)
    q=source_world.to_quaternion().slerp(support.to_quaternion(),weight)
    target=q.to_matrix().to_4x4()
    target.translation=source_world.translation+correction
    return target,weight

times=[i/120 for i in range(126)]
base=[]
targets=[]
weights=[]
original_world=[]
for t in times:
    v=loop_values(t);apply(v)
    base.append({n:x.copy() for n,x in v.items()})
    world={n:rig.matrix_world@p.matrix for n,p in rig.pose.bones.items()}
    original_world.append(world)
    targets.append({});weights.append({})
    for side in SIDES:
        target,weight=desired_target(t,side,world[PREFIX+side+'Foot'])
        targets[-1][side]=target;weights[-1][side]=weight

# Vertical pelvis adjustment is driven by leg reach, never by model/root offset.
deltas=[]
for index,t in enumerate(times):
    delta=0.0
    for side in SIDES:
        world=original_world[index]
        hip=world[PREFIX+side+'UpLeg'].translation
        knee=world[PREFIX+side+'Leg'].translation
        ankle=world[PREFIX+side+'Foot'].translation
        a,b=(knee-hip).length,(ankle-knee).length
        reach=math.sqrt(a*a+b*b+2*a*b*math.cos(math.radians(9)))
        target=targets[index][side].translation
        horizontal=(hip.x-target.x)**2+(hip.y-target.y)**2
        limit=target.z+math.sqrt(max(.01,reach*reach-horizontal))
        delta=min(delta,limit-hip.z)
    deltas.append(delta)
raw=np.array(deltas[:-1])
filtered=np.zeros_like(raw)
kernel=np.exp(-.5*(np.arange(-5,6)/2)**2);kernel/=kernel.sum()
for offset,weight in zip(range(-5,6),kernel): filtered+=np.roll(raw,offset)*weight
filtered-=max(0,float(np.max(filtered-raw)))+.001
deltas=list(filtered)+[float(filtered[0])]

helpers={};constraints=[]
for side in SIDES:
    target=bpy.data.objects.new(side+'WalkingContact',None)
    scene.collection.objects.link(target);helpers[side]=target
    shin=bone(side+'Leg');shin.ik_stretch=0;bone(side+'UpLeg').ik_stretch=0
    ik=shin.constraints.new('IK');ik.target=target;ik.chain_count=2;ik.use_stretch=False;ik.iterations=500
    constraints.append((shin,ik))
    foot=bone(side+'Foot')
    rotation=foot.constraints.new('COPY_ROTATION');rotation.target=target
    rotation.target_space='WORLD';rotation.owner_space='WORLD';constraints.append((foot,rotation))

def evaluated_vertices():
    evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    arr=np.empty(len(evaluated.data.vertices)*3)
    evaluated.data.vertices.foreach_get('co',arr)
    matrix=np.array(evaluated.matrix_world)
    return arr.reshape(-1,3)@matrix[:3,:3].T+matrix[:3,3]

baked=[];contact_iterations=[]
for index,t in enumerate(times):
    set_time(t);apply(base[index])
    hips=bone('Hips');world=rig.matrix_world@hips.matrix
    world.translation.z+=deltas[index]
    hips.matrix=rig.matrix_world.inverted()@world
    for side in SIDES:
        helpers[side].matrix_world=targets[index][side]
        toe=bone(side+'ToeBase')
        toe.rotation_quaternion=toe.rotation_quaternion.slerp(Quaternion(),weights[index][side])
    bpy.context.view_layer.update()
    # Account for the existing skin weights rather than assuming ankle height
    # alone guarantees shoe contact. Only support targets are adjusted.
    for iteration in range(4):
        verts=evaluated_vertices()
        for side in SIDES:
            p=phase(t,side)
            if p>STANCE: continue
            region='heel' if p<HEEL_ROLL else 'forefoot' if p>STANCE-TOE_ROLL else 'sole'
            if HEEL_ROLL<=p<=STANCE-TOE_ROLL:
                h=verts[patches[side]['heel']];f=verts[patches[side]['forefoot']]
                hp=h[h[:,2].argmin()];fp=f[f[:,2].argmin()]
                angle=math.atan2(float(hp[2]-fp[2]),float(np.linalg.norm(fp[:2]-hp[:2])))
                location=helpers[side].location.copy()
                helpers[side].matrix_world=Matrix.Rotation(-angle,4,'X')@helpers[side].matrix_world
                helpers[side].location=location
            height=float(verts[patches[side][region],2].min())
            helpers[side].location.z+=.001-height
        bpy.context.view_layer.update()
    contact_iterations.append({side:list(helpers[side].location) for side in SIDES})
    baked.append({name:p.matrix.copy() for name,p in rig.pose.bones.items()})
    print('FRAME',index,'pelvis',deltas[index],flush=True)
for owner,constraint in constraints: owner.constraints.remove(constraint)
for helper in helpers.values(): bpy.data.objects.remove(helper,do_unlink=True)

corrected=bpy.data.actions.new('Walking')
rig.animation_data.action=corrected
previous={}
for index,t in enumerate(times):
    set_time(t)
    matrices=baked[0] if index==len(times)-1 else baked[index]
    for name,p in rig.pose.bones.items():
        p.matrix=matrices[name]
        if name in previous and p.rotation_quaternion.dot(previous[name])<0: p.rotation_quaternion.negate()
        previous[name]=p.rotation_quaternion.copy()
        p.keyframe_insert('location',frame=1+t*RATE,group=name)
        p.keyframe_insert('rotation_quaternion',frame=1+t*RATE,group=name)
        p.keyframe_insert('scale',frame=1+t*RATE,group=name)
        bpy.context.view_layer.update()
curves=corrected.layers[0].strips[0].channelbag(corrected.slots[0]).fcurves
for curve in curves:
    for key in curve.keyframe_points: key.interpolation='LINEAR'

assert rest=={b.name:[list(row) for row in b.matrix_local] for b in rig.data.bones}
assert parents=={b.name:b.parent.name if b.parent else None for b in rig.data.bones}
assert object_matrices=={o.name:[list(row) for row in o.matrix_world] for o in (rig,mesh)}
samples=[]
for t in times:
    set_time(t)
    samples.append({'time':t,'bones':{n.removeprefix(PREFIX):[list(row) for row in rig.matrix_world@p.matrix] for n,p in rig.pose.bones.items()}})
payload={'duration':DURATION,'fps':RATE,'speed_m_s':SPEED,'strike_s':STRIKE,'stance_s':STANCE,
         'heel_roll_s':HEEL_ROLL,'toe_roll_s':TOE_ROLL,'seam_window_s':SEAM,
         'source_sha256':source_hash,'samples':samples,'pelvis_delta_m':[float(x) for x in deltas],
         'rest_world':{b.name.removeprefix(PREFIX):[list(row) for row in rig.matrix_world@b.matrix_local] for b in rig.data.bones},
         'rest_unchanged':True,'object_transforms_unchanged':True,'constraints_remaining':0,
         'edited_bones':list(rig.pose.bones.keys())}
(OUT/'baked-pose.json').write_text(json.dumps(payload),encoding='utf-8')
for track in list(rig.animation_data.nla_tracks): rig.animation_data.nla_tracks.remove(track)
for action in list(bpy.data.actions):
    if action!=corrected: bpy.data.actions.remove(action)
albedo=bpy.data.images.load(str(SOURCE.parent/'survivor_animation_template_albedo.png'),check_existing=True);albedo.pack()
for slot in mesh.material_slots:
    if slot.material and slot.material.use_nodes:
        for node in slot.material.node_tree.nodes:
            if node.type=='TEX_IMAGE': node.image=albedo
set_time(0)
BLEND.parent.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
print('BAKED',BLEND,'pelvis',min(deltas),max(deltas),flush=True)
