"""One asset per blend / GLB, bounded material surfaces and separate moving parts."""
from pathlib import Path
import bpy
from .naming import require_asset_id
from .glb import statistics

PROJECT = Path(__file__).resolve().parents[3]
RUNTIME = PROJECT / "assets/generated"
SOURCES = PROJECT / "art/blender/sources"


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    bpy.context.preferences.filepaths.save_version = 0


def export_asset(spec, generator):
    asset_id = require_asset_id(spec["id"])
    groups = {}
    proxies = []
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        if obj.get("bh_proxy"):
            proxies.append(obj)
        else:
            groups.setdefault(obj.get("bh_group", "RenderMesh"), []).append(obj)
    root = bpy.data.objects.new(asset_id, None)
    root["art_bible"] = "BLUE HOUR ART BIBLE V1"
    root["unit_meters"] = 1
    bpy.context.collection.objects.link(root)
    for group, objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = f"{asset_id}_{group}"
        obj.data.name = obj.name
        # Consolidate repeated slots from joined components.
        unique = sorted({mat.name for mat in obj.data.materials if mat})
        indices = [unique.index(obj.data.materials[p.material_index].name) for p in obj.data.polygons]
        obj.data.materials.clear()
        for name in unique:
            obj.data.materials.append(bpy.data.materials[name])
        for polygon, index in zip(obj.data.polygons, indices):
            polygon.material_index = index
        tri = obj.modifiers.new("BH_Triangulate", "TRIANGULATE")
        bpy.ops.object.modifier_apply(modifier=tri.name)
        obj.parent = root
    for i, obj in enumerate(proxies):
        obj.name = f"{asset_id}_COL_{i:02d}-convcolonly"
        obj.data.name = obj.name
        obj.parent = root
    bpy.ops.object.select_all(action="SELECT")
    RUNTIME.mkdir(parents=True, exist_ok=True)
    SOURCES.mkdir(parents=True, exist_ok=True)
    source = SOURCES / f"{asset_id}.blend"
    target = PROJECT / spec["path"]
    bpy.ops.wm.save_as_mainfile(filepath=str(source), check_existing=False)
    bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", use_selection=True,
                              export_yup=True, export_apply=True, export_normals=True,
                              export_texcoords=False, export_tangents=False,
                              export_materials="EXPORT", export_animations=False,
                              export_cameras=False, export_lights=False, export_extras=True)
    result = {**spec, **statistics(target), "path": target.relative_to(PROJECT).as_posix(),
              "blend": source.relative_to(PROJECT).as_posix(), "generator": generator,
              "blender": bpy.app.version_string, "collision": "host-owned" if not proxies else "box convex proxies; city uses map collider"}
    if result["triangles"] > spec["budget"]:
        raise ValueError(f"{asset_id}: {result['triangles']} triangles exceeds {spec['budget']}")
    print(f"BH_EXPORTED {asset_id} {result['triangles']} tris {result['bytes']} bytes")
    return result
