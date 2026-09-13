"""Build skinned ENM_001 runtime candidates from the reviewed locomotion blend."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inspect_character_glb import inspect


ROOT = Path(r"D:/my-code/valley-mas/apps/blue-hour")
SOURCE_BLEND = ROOT / "art/blender/characters/infected_basic_a_locomotion.blend"
OUTPUTS = {
    "candidate_a_30k": (ROOT / "assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k.glb", 30000),
    "candidate_b_20k": (ROOT / "assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_20k.glb", 20000),
}


def export_candidate(output: Path, target_triangles: int) -> dict:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND))
    mesh = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    source_triangles = len(mesh.data.polygons)
    modifier = mesh.modifiers.new(name="ENM_001_Runtime_Decimate", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = min(1.0, target_triangles / float(source_triangles))
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = rig
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", use_selection=True,
        export_yup=True, export_skins=True, export_animations=True,
        export_animation_mode="ACTIONS", export_anim_single_armature=True,
        export_frame_range=False, export_force_sampling=True,
        export_rest_position_armature=True, export_def_bones=False,
        export_cameras=False, export_lights=False, export_materials="EXPORT",
    )
    audit = inspect(output)
    if audit["bone_count"] != 23 or audit["skin_count"] != 1 or audit["animation_count"] != 3:
        raise RuntimeError(f"Runtime candidate lost rig or locomotion clips: {audit}")
    if audit["unweighted_vertices"] or audit["maximum_weight_sum_error"] > 0.0001:
        raise RuntimeError(f"Runtime candidate has invalid weights: {audit}")
    audit["target_triangles"] = target_triangles
    audit["source_triangles"] = source_triangles
    audit["sha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
    return audit


def main() -> None:
    report: dict[str, dict] = {}
    for name, (output, target) in OUTPUTS.items():
        report[name] = export_candidate(output, target)
        print(name, report[name]["triangles"], report[name]["vertex_count"], report[name]["sha256"])
    report_path = ROOT / "art/blender/rigs/infected_basic_a_runtime_optimization.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
