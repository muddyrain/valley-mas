import bpy, numpy as np
bpy.ops.wm.open_mainfile(filepath=r'D:/my-code/valley-mas/apps/blue-hour/art/blender/characters/infected_basic_a_locomotion.blend')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH'); rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('Zombie_Walk'); bpy.context.scene.frame_set(15); bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get(); em=mesh.evaluated_get(deps); me=em.to_mesh(); v=np.array([x.co[:] for x in me.vertices]);
# cross side faces based rest x signs and low z
for mode,arr in [('rest',np.array([x.co[:] for x in mesh.data.vertices])),('pose',v)]:
 out=[]
 for p in mesh.data.polygons:
  pts=arr[list(p.vertices)]; xs=pts[:,0]; z=pts[:,2]
  if xs.min() < -0.03 and xs.max()>0.03 and z.max()<0.65 and z.min()>0.02: out.append((p.index,list(p.vertices),pts.min(0),pts.max(0)))
 print(mode,'cross_faces',len(out));
 for x in out[:100]: print(x[0],x[1],x[2].round(4).tolist(),x[3].round(4).tolist())
# cross edges
for e in mesh.data.edges:
 a,b=e.vertices; pa,pb=v[a],v[b]
 if pa[0]<-0.03 and pb[0]>0.03 or pb[0]<-0.03 and pa[0]>0.03:
  if max(pa[2],pb[2])<.65 and min(pa[2],pb[2])>.02: print('EDGE',e.index,a,b,pa.round(4),pb.round(4))
em.to_mesh_clear()
