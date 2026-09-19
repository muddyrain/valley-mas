"""Frozen canonical rig plus diagnostic geometry; no survivor mesh input."""
from pathlib import Path
import sys, bpy, json
from mathutils import Vector
OUT=Path(__file__).resolve().parent
APP=OUT.parents[1]
sys.path.insert(0,str(APP/'art/blender/scripts'))
from create_humanoid_rig import create_rig, definition
bpy.ops.wm.read_factory_settings(use_empty=True)
rig=create_rig()
objects=[]
def bind(obj,name,color):
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    group=obj.vertex_groups.new(name=name)
    group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('CanonicalSkin','ARMATURE'); mod.object=rig
    obj.parent=rig
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1)
    obj.data.materials.append(mat);objects.append(obj)
for spec in definition():
    name=spec['name']
    if name=='Root' or name.endswith(('Foot','Toes')): continue
    a,b=Vector(spec['head']),Vector(spec['tail'])
    bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.018 if 'Arm' in name else .025,depth=(b-a).length,location=(a+b)/2)
    obj=bpy.context.object;obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    bind(obj,name,(.2,.65,.8) if name.startswith('Left') else (.8,.42,.22))
for side,sign in [('Left',1),('Right',-1)]:
    # Fixed ground envelope: heel Godot Z=-.065, toe tip +.195, width .08m.
    for bone,y0,y1 in [('Foot',-.115,.065),('Toes',-.195,-.115)]:
        bpy.ops.mesh.primitive_cube_add(size=1,location=(sign*.09,(y0+y1)/2,.025))
        obj=bpy.context.object;obj.scale=(.08,y1-y0,.05)
        bind(obj,side+bone,(.85,.8,.3))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects: obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.join()
bpy.context.object.name='CanonicalDiagnosticMesh'
rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'candidates/canonical.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
(OUT/'canonical-envelope.json').write_text(json.dumps({'ground_y_m':0,'sole_width_m':.08,'heel_z_m':-.065,'toe_hinge_z_m':.115,'toe_tip_z_m':.195,'sole_thickness_m':.05,'basis':'frozen create_rig() without landmarks; diagnostic proxy is not a character mesh'},indent=2))
