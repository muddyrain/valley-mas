"""Rebuild the three formal weapons. Blender +Y forward, +Z up; meters.

Run: blender --background --python art/blender/weapons/build_weapons.py
Reuses the project's geometry/material tools and existing firearm construction.
"""
import sys
import json
from pathlib import Path
from math import pi
import bpy
from mathutils import Matrix

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from utils.geometry import box, prism, cylinder, beam
from utils.materials import PALETTE, material
from utils.glb import statistics
from generators.generate_weapons import build as firearm

PROJECT = HERE.parents[2]
PALETTE["BH_Weapon_Steel"] = ("9DA6AA", .48, .55)
PALETTE["BH_Weapon_Blue"] = ("4488AF", .60, .15)


def knife():
    prism("KnifeTang", [(-.077,-.019),(.080,-.019),(.09,.025),(-.070,.026)], .014, "BH_Metal_Mid", .003)
    prism("KnifeHandle", [(-.07,-.022),(-.046,-.028),(-.012,-.025),(.02,-.024),(.05,-.019),(.066,.022),(-.06,.029)], .030, "BH_Plastic_Dark", .006)
    # Flat dark spine and broad light cutting bevel echo the provided drop-point icon.
    prism("BladeSpine", [(.069,-.019),(.202,-.019),(.260,.023),(.22,.031),(.070,.031)], .010, "BH_Metal_Mid", .001)
    prism("CuttingEdge", [(.083,-.033),(.198,-.030),(.26,.023),(.202,-.010),(.083,-.010)], .004, "BH_Weapon_Steel", .001)
    box("Guard", (.043,.014,.075), (0,.069,0), "BH_Metal_Dark", .005)
    for x in [-.018,.018]:
        box("HandleInset", (.003,.076,.024), (x,-.002,.003), "BH_Weapon_Blue", .003)
        box("Fuller", (.002,.080,.005), (x*.33,.133,.016), "BH_Metal_Dark", .001)
        for y in [-.050,.047]:
            cylinder("HandleRivet", .004,.003,(x,y,.010),"BH_Weapon_Steel",8,(0,pi/2,0))
    box("Pommel", (.034,.014,.038), (0,-.074,.001), "BH_Metal_Mid", .004)


def gun(kind):
    firearm("BH_" + kind + "_01")
    # Preserve proven geometry, replace old hazard markings with icon blue accents.
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        if any(m.name in ["BH_Safety_Yellow", "BH_Warm_Orange"] for m in obj.data.materials):
            obj.data.materials[0] = material("BH_Weapon_Blue")
        if "Slide" in obj.name:
            obj.data.materials[0] = material("BH_Weapon_Steel")
    # Readable slide serrations / magazine ribs, not tiny simulation detail.
    if kind == "Pistol":
        for x in [-.024,.024]:
            for y in [-.065,-.048,-.031,-.014]:
                box("SlideSerration", (.003,.006,.031),(x,y,.149),"BH_Metal_Dark",.001)
        beam("Trigger",(0,.050,.025),(0,.043,-.018),.003)
    else:
        for x in [-.024,.024]:
            for z in [-.05,-.105,-.16]:
                box("MagazineRib",(.003,.060,.008),(x,.14,z),"BH_Metal_Mid",.001)
        # Open stock frame replaces the original solid block to match the icon.
        for obj in list(bpy.context.scene.objects):
            if obj.name == "BH_Stock":
                bpy.data.objects.remove(obj,do_unlink=True)
        for a,b in [((0,-.11,.125),(0,-.35,.10)),((0,-.35,.10),(0,-.35,-.045)),((0,-.35,-.045),(0,-.17,.09))]:
            beam("StockFrame",a,b,.019,"BH_Plastic_Dark")
        for y in [.0,.045,.09,.135,.18,.225,.27,.315]:
            box("RailTooth",(.051,.016,.012),(0,y,.177),"BH_Metal_Dark",.002)
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.data.transform(Matrix.Scale(.8,4))


def export(name, builder, support, muzzle):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1
    bpy.context.preferences.filepaths.save_version = 0
    builder()
    root = bpy.data.objects.new("WeaponRoot",None)
    bpy.context.collection.objects.link(root)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = "Mesh"
    mesh.data.name = name
    mesh.parent = root
    for label, point in [("GripPoint_R",(0,0,0)),("GripPoint_L",support),("MuzzlePoint",muzzle)]:
        marker = bpy.data.objects.new(label,None)
        bpy.context.collection.objects.link(marker)
        marker.parent = root
        marker.location = point
        marker.empty_display_type = "ARROWS"
        marker.empty_display_size = .04
    # One canonical editable source, with independent named materials.
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/(name+".blend")))
    output = PROJECT/"assets/weapons/models"/(name+".glb")
    output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(output),export_format="GLB",use_selection=True,
        export_yup=True,export_apply=True,export_normals=True,export_texcoords=False,
        export_materials="EXPORT",export_animations=False,export_cameras=False,export_lights=False)
    result = statistics(output)
    assert result["triangles"] < 5000
    result["path"] = str(output.relative_to(PROJECT)).replace("\\","/")
    return result


report = {
    "wpn_001_survival_knife": export("wpn_001_survival_knife",knife,(0,.02,0),(0,.26,.023)),
    "wpn_002_p9_pistol": export("wpn_002_p9_pistol",lambda:gun("Pistol"),(0,0,-.025),(0,.1456,.0792)),
    "wpn_006_a21_assault_rifle": export("wpn_006_a21_assault_rifle",lambda:gun("AR"),(0,.272,.025),(0,.4776,.0792)),
}
(HERE/"weapon_models.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps({key:entry["triangles"] for key,entry in report.items()}))
