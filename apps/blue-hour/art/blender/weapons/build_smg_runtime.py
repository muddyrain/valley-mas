"""Wrap the existing BH_SMG_01 mesh for the formal weapon socket contract."""

from pathlib import Path

import bpy


PROJECT = Path(__file__).resolve().parents[3]
SOURCE = PROJECT / "assets/generated/weapon_submachine_gun_model.glb"
OUTPUT = PROJECT / "assets/weapons/models/wpn_004_k9_smg.glb"
BLEND = Path(__file__).resolve().with_name("wpn_004_k9_smg.blend")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
source_root = bpy.data.objects["BH_SMG_01"]
assert sum(obj.type == "MESH" for obj in bpy.data.objects) == 1
mesh = next(obj for obj in bpy.data.objects if obj.type == "MESH")

root = bpy.data.objects.new("WeaponRoot", None)
bpy.context.collection.objects.link(root)
mesh.parent = root
mesh.name = "Mesh"
bpy.data.objects.remove(source_root, do_unlink=True)

for name, position in (
    ("GripPoint_R", (0.0, 0.0, 0.0)),
    ("GripPoint_L", (0.02, 0.184, 0.047)),
    ("MuzzlePoint", (0.0, 0.375, 0.02)),
):
    marker = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(marker)
    marker.parent = root
    marker.location = position

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_normals=True,
    export_texcoords=False,
    export_materials="EXPORT",
    export_animations=False,
    export_cameras=False,
    export_lights=False,
)
print(f"Wrapped existing SMG mesh: {OUTPUT}")
