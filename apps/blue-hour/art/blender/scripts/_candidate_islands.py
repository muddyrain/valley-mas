import bpy, numpy as np
bpy.ops.wm.open_mainfile(filepath=r'D:/my-code/valley-mas/apps/blue-hour/art/blender/characters/infected_basic_a_locomotion.blend')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH'); rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('Zombie_Walk'); bpy.context.scene.frame_set(15); bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get(); em=mesh.evaluated_get(deps); me=em.to_mesh(); v=np.array([x.co[:] for x in me.vertices]);
adj=[[] for _ in mesh.data.vertices]
for e in mesh.data.edges:
 a,b=e.vertices; adj[a].append(b); adj[b].append(a)
seen=set(); comps=[]
for i in range(len(adj)):
 if i in seen: continue
 st=[i]; seen.add(i); c=[]
 while st:
  j=st.pop(); c.append(j)
  for n in adj[j]:
   if n not in seen: seen.add(n); st.append(n)
 comps=sorted(comps,key=len,reverse=True) if False else comps
# sort by size desc
comps.sort(key=len,reverse=True)
for ci,c in enumerate(comps):
 pts=v[c]; mn=pts.min(0); mx=pts.max(0)
 if mn[2]<0.55 and mx[2]>0.0 and (mx[0]-mn[0]>0.035 or (mn[0]<-0.015 and mx[0]>0.015)):
  cs=set(c); fs=[p.index for p in mesh.data.polygons if all(x in cs for x in p.vertices)]
  print('CAND',ci,'n',len(c),'bbox',mn.round(4).tolist(),mx.round(4).tolist(),'faces',fs[:20])
  if len(c)<=20:
   for i in c: print(' V',i,[(mesh.vertex_groups[g.group].name,round(g.weight,4)) for g in mesh.data.vertices[i].groups])
em.to_mesh_clear()
