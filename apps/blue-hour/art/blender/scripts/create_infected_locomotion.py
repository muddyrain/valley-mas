"""Author ENM_001 in-place locomotion actions only (30 FPS, no root motion)."""
import json, math
from pathlib import Path
import bpy
from mathutils import Quaternion, Vector

ROOT = Path(r'D:/my-code/valley-mas/apps/blue-hour')
BLEND = ROOT / 'art/blender/characters/infected_basic_a_rigged.blend'
OUT_BLEND = ROOT / 'art/blender/characters/infected_basic_a_locomotion.blend'
OUT_GLB = ROOT / 'assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_locomotion.glb'
FPS = 30

def rotate(rig, name, axis, degrees):
    bone = rig.pose.bones[name]
    local_axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector(axis)
    bone.rotation_mode = 'QUATERNION'
    bone.rotation_quaternion = Quaternion(local_axis, math.radians(degrees))

def sample(rig, clip, phase):
    for bone in rig.pose.bones:
        bone.matrix_basis.identity(); bone.rotation_mode = 'QUATERNION'
    c = math.sin(phase * math.tau); s = math.sin(phase * math.tau + math.pi / 2)
    if clip == 'Zombie_Idle':
        rotate(rig, 'Spine', (1,0,0), 8 + 2.0*c)
        rotate(rig, 'Chest', (0,0,1), 2.2*s)
        rotate(rig, 'Head', (0,0,1), -6 + 2.0*s)
        rotate(rig, 'Neck', (0,0,1), 1.0*s)
        rotate(rig, 'LeftShoulder', (0,1,0), -4)
        rotate(rig, 'RightShoulder', (0,1,0), 2.5)
        rotate(rig, 'LeftUpperArm', (1,0,0), 2.5*c)
        rotate(rig, 'RightUpperArm', (1,0,0), -2.0*c)
        rotate(rig, 'LeftLowerArm', (1,0,0), -3)
        rotate(rig, 'RightLowerArm', (1,0,0), 2)
        rotate(rig, 'LeftUpperLeg', (1,0,0), 1.2*c)
        rotate(rig, 'RightUpperLeg', (1,0,0), -1.0*c)
    else:
        chase = clip == 'Zombie_Chase'
        rotate(rig, 'Spine', (1,0,0), 18 if chase else 10)
        rotate(rig, 'Chest', (1,0,0), 5 if chase else 1.5)
        rotate(rig, 'Chest', (0,0,1), (4.0 if chase else 2.0)*s)
        rotate(rig, 'UpperChest', (1,0,0), 4 if chase else 1.0)
        rotate(rig, 'Neck', (1,0,0), -2 if chase else 0)
        rotate(rig, 'Head', (1,0,0), -5 if chase else -2)
        rotate(rig, 'Head', (0,0,1), (1.5 if chase else -4) + (1.2 if chase else 2.0)*s)
        for side, offset in [('Left', 0.0), ('Right', 0.5)]:
            p = (phase + offset) % 1.0
            swing = math.sin(p * math.tau)
            lift = max(0.0, math.sin(p * math.tau))
            # Stride is carried by forward hip rotation; clearance stays low.
            leg = 16.0 if chase else 12.0
            rotate(rig, side+'UpperLeg', (1,0,0), -leg*swing)
            rotate(rig, side+'LowerLeg', (1,0,0), (11.0 if chase else 8.0)*lift)
            rotate(rig, side+'Foot', (1,0,0), -(6.0 if chase else 4.0)*lift)
            arm = 10.0 if chase else 4.0
            rotate(rig, side+'Shoulder', (0,1,0), (-7 if side=='Left' else 4.0) + (4 if chase else .5))
            if chase and side == 'Left':
                rotate(rig, side+'UpperArm', (1,0,0), -24 + arm*swing)
                rotate(rig, side+'LowerArm', (1,0,0), 22)
            else:
                rotate(rig, side+'UpperArm', (1,0,0), (-16 if chase else -5) + arm*swing)
                rotate(rig, side+'LowerArm', (1,0,0), 10 if chase else 3)
        rotate(rig, 'Hips', (0,0,1), (2.0 if chase else 1.2)*s)
    bpy.context.view_layer.update()

def main():
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    for old in list(bpy.data.actions): bpy.data.actions.remove(old)
    report={'fps':FPS,'clips':{}}
    specs={'Zombie_Idle':3.2,'Zombie_Walk':1.0,'Zombie_Chase':.75}
    for name,duration in specs.items():
        action=bpy.data.actions.new(name); action.use_fake_user=True; rig.animation_data_create(); rig.animation_data.action=action
        frames=round(duration*FPS)
        for frame in range(frames+1):
            sample(rig,name,(frame%frames)/frames)
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_quaternion',frame=frame)
                if bone.name in ('Root','Hips'): bone.keyframe_insert('location',frame=frame)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points: key.interpolation='BEZIER'
        report['clips'][name]={'duration':duration,'frames':frames,'loop':True,'in_place':True,'nominal_speed':0.0 if name=='Zombie_Idle' else (1.0 if name=='Zombie_Walk' else 1.8)}
    rig.animation_data.action=None
    for b in rig.pose.bones:b.matrix_basis.identity()
    OUT_BLEND.parent.mkdir(parents=True,exist_ok=True); bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH'); mesh.select_set(True); bpy.context.view_layer.objects.active=rig
    OUT_GLB.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT_GLB),export_format='GLB',use_selection=True,export_yup=True,export_skins=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_frame_range=False,export_force_sampling=True,export_rest_position_armature=True,export_def_bones=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
    (ROOT/'art/blender/rigs/infected_basic_a_locomotion_report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('INFECTED LOCOMOTION ACTIONS EXPORTED',list(report['clips']))
if __name__=='__main__':main()
