import bpy, json, sys, math
from pathlib import Path
from mathutils import Vector

def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images, bpy.data.actions):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)

def bbox_world(objects):
    points=[]
    for obj in objects:
        if obj.type == 'MESH':
            points.extend(obj.matrix_world @ Vector(c) for c in obj.bound_box)
    if not points: return None
    lo=Vector((min(p.x for p in points),min(p.y for p in points),min(p.z for p in points)))
    hi=Vector((max(p.x for p in points),max(p.y for p in points),max(p.z for p in points)))
    return {'min':[lo.x,lo.y,lo.z],'max':[hi.x,hi.y,hi.z],'size':[hi.x-lo.x,hi.y-lo.y,hi.z-lo.z],'height':hi.z-lo.z}

def bone_info(arm):
    bones=[]
    for b in arm.data.bones:
        bones.append({'name':b.name,'parent':b.parent.name if b.parent else None,'head':[round(x,6) for x in b.head_local],'tail':[round(x,6) for x in b.tail_local],'length':b.length,'use_deform':b.use_deform})
    return bones

def audit(path, label):
    reset()
    if path.suffix.lower() == '.fbx':
        bpy.ops.import_scene.fbx(filepath=str(path), automatic_bone_orientation=False)
    else:
        bpy.ops.import_scene.gltf(filepath=str(path))
    objects=list(bpy.context.scene.objects)
    meshes=[o for o in objects if o.type=='MESH']
    arms=[o for o in objects if o.type=='ARMATURE']
    bbox=bbox_world(meshes)
    verts=sum(len(o.data.vertices) for o in meshes)
    tris=sum(sum(max(0,len(p.vertices)-2) for p in o.data.polygons) for o in meshes)
    mats=[]; tex=[]; tex_info=[]
    for o in meshes:
        for m in o.data.materials:
            if m and m.name not in mats: mats.append(m.name)
            if m and m.node_tree:
                for n in m.node_tree.nodes:
                    if n.type=='TEX_IMAGE' and n.image and n.image.name not in tex:
                        tex.append(n.image.name)
                        tex_info.append({'name':n.image.name,'width':n.image.size[0],'height':n.image.size[1],'channels':n.image.channels})
    arm=arms[0] if arms else None
    weighted=0; unweighted=0; max_groups=0; arm_modifiers=[]
    for o in meshes:
        vg={g.index for g in o.vertex_groups}
        for v in o.data.vertices:
            w=sum(g.weight for g in v.groups if g.group in vg)
            max_groups=max(max_groups,len(v.groups))
            if w > 1e-6: weighted+=1
            else: unweighted+=1
        arm_modifiers += [{'name':m.name,'object':m.object.name if m.object else None,'type':m.type} for m in o.modifiers if m.type=='ARMATURE']
    actions=[]
    for a in bpy.data.actions:
        actions.append({'name':a.name,'frame_start':a.frame_range[0],'frame_end':a.frame_range[1],'fps':bpy.context.scene.render.fps,'tracks':len(a.layers) if hasattr(a,'layers') else None})
    result={'label':label,'source':str(path),'objects':[{'name':o.name,'type':o.type,'scale':list(o.scale),'location':list(o.location)} for o in objects], 'mesh_count':len(meshes),'triangle_count':tris,'vertex_count':verts,'bbox':bbox,'materials':mats,'textures':tex,'texture_info':tex_info,'skeleton_count':len(arms),'skin':bool(arm_modifiers),'armature_modifiers':arm_modifiers,'bone_count':len(arm.data.bones) if arm else 0,'bones':bone_info(arm) if arm else [],'unweighted_vertices':unweighted,'weighted_vertices':weighted,'max_vertex_groups':max_groups,'actions':actions,'object_scales':{o.name:list(o.scale) for o in objects if o.type in ('MESH','ARMATURE')}}
    return result

def main():
    args=sys.argv[sys.argv.index('--')+1:]
    out=Path(args[0]); out.parent.mkdir(parents=True,exist_ok=True)
    entries=[]
    for raw,label in zip(args[1::2],args[2::2]): entries.append(audit(Path(raw),label))
    out.write_text(json.dumps({'audits':entries},indent=2),encoding='utf-8')

if __name__=='__main__': main()
