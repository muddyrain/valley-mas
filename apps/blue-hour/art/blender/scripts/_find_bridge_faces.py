import bpy, numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=r'D:/my-code/valley-mas/apps/blue-hour/art/blender/characters/infected_basic_a_locomotion.blend')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH'); rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('Zombie_Walk')
scene=bpy.context.scene; scene.render.resolution_x=320; scene.render.resolution_y=480; bpy.ops.object.camera_add(location=(2.6,-4,3.6)); cam=bpy.context.object; cam.data.type='ORTHO'; cam.data.ortho_scale=2.05; cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler(); scene.camera=cam
scene.frame_set(15); bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get(); em=mesh.evaluated_get(deps); me=em.to_mesh(); v=np.array([x.co[:] for x in me.vertices]);
cs=[]
for p in mesh.data.polygons:
 pts=v[list(p.vertices)]; uv=np.array([[world_to_camera_view(scene,cam,Vector(q)).x, world_to_camera_view(scene,cam,Vector(q)).y] for q in pts]); mn=uv.min(0); mx=uv.max(0)
 if mx[0]>=.42 and mn[0]<=.60 and mx[1]>=.15 and mn[1]<=.34 and pts[:,2].max()<.7:
  cs.append((p.index,list(p.vertices),mn,mx,pts[:,2].min(),pts[:,2].max()))
print('CAND',len(cs))
for p in cs: print('POLY',p[0],'verts',p[1],'uvbbox',p[2].round(3).tolist(),p[3].round(3).tolist(),'z',round(p[4],3),round(p[5],3))
# summarize groups for candidate verts
ids=sorted(set(i for p in cs for i in p[1])); print('IDS',ids)
for i in ids:
 w=[(mesh.vertex_groups[g.group].name,round(g.weight,4)) for g in mesh.data.vertices[i].groups if g.weight>0]
 print('V',i,'rest',np.array(mesh.data.vertices[i].co[:]).round(4).tolist(),'posed',v[i].round(4).tolist(),'W',w)
em.to_mesh_clear()
