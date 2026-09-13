import bpy
bpy.ops.wm.open_mainfile(filepath=r'D:/my-code/valley-mas/apps/blue-hour/art/blender/characters/infected_basic_a_locomotion.blend')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for n in ['Hips','LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot']:
 b=rig.data.bones[n]; print(n,'head',tuple(round(x,3) for x in b.head_local),'tail',tuple(round(x,3) for x in b.tail_local))
