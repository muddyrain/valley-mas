import bpy, numpy as np
bpy.ops.wm.open_mainfile(filepath=r'D:/my-code/valley-mas/apps/blue-hour/art/blender/characters/infected_basic_a_locomotion.blend')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
print('OBJECTS',[(o.name,o.type) for o in bpy.context.scene.objects])
print('MESH',mesh.name,'verts',len(mesh.data.vertices),'faces',len(mesh.data.polygons),'materials',[m.name if m else None for m in mesh.data.materials])
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
 comps.append(c)
comps=sorted(comps,key=len,reverse=True); print('COMPONENTS',len(comps))
for ci,c in enumerate(comps):
 co=np.array([mesh.data.vertices[i].co[:] for i in c]); cs=set(c); faces=[p.index for p in mesh.data.polygons if all(v in cs for v in p.vertices)]; mats=sorted(set(mesh.data.polygons[f].material_index for f in faces)); print('COMP',ci,'n',len(c),'bbox',co.min(0).round(4).tolist(),co.max(0).round(4).tolist(),'faces',len(faces),'mats',mats,'ids',c[:8])
bpy.context.scene.frame_set(15); bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get(); em=mesh.evaluated_get(deps); me=em.to_mesh(); verts=np.array([v.co[:] for v in me.vertices]);
for ci,c in enumerate(comps): co=verts[c]; print('POSECOMP',ci,'bbox',co.min(0).round(4).tolist(),co.max(0).round(4).tolist())
em.to_mesh_clear(); print('VGROUPS',[g.name for g in mesh.vertex_groups])
