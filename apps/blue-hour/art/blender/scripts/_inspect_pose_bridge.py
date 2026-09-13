import bpy, numpy as np
bpy.ops.wm.open_mainfile(filepath=r'D:/my-code/valley-mas/apps/blue-hour/art/blender/characters/infected_basic_a_locomotion.blend')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
rig.animation_data_create(); rig.animation_data.action=bpy.data.actions.get('Zombie_Walk')
bpy.context.scene.frame_set(15); bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get(); em=mesh.evaluated_get(deps); me=em.to_mesh(); v=np.array([x.co[:] for x in me.vertices]);
print('frame',bpy.context.scene.frame_current,'action',rig.animation_data.action.name)
cands=[]
for p in mesh.data.polygons:
 pts=v[list(p.vertices)]; mn=pts.min(0); mx=pts.max(0)
 if mn[2]<0.65 and mx[2]>0.05 and mn[0]<-0.015 and mx[0]>0.015:
  cands.append((p.index,list(p.vertices),mn,mx))
print('CANDIDATES',len(cands))
for x in cands[:100]: print('POLY',x[0],'verts',x[1],'bbox',x[2].round(4).tolist(),x[3].round(4).tolist(),'mat',mesh.data.polygons[x[0]].material_index)
# vertices in lower central posed envelope
ids=[]
for i,pt in enumerate(v):
 if pt[2]<0.65 and pt[2]>0.05 and abs(pt[0])<0.08: ids.append(i)
print('CENTRAL_IDS',len(ids),ids[:200])
for i in ids[:80]:
 print('V',i,'rest',mesh.data.vertices[i].co[:],'posed',v[i].round(4).tolist(),'weights',[(mesh.vertex_groups[g.group].name,round(g.weight,4)) for g in mesh.data.vertices[i].groups if g.weight>0])
em.to_mesh_clear()
