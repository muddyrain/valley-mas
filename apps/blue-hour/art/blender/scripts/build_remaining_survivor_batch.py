"""Build SUR_003-SUR_012 against the frozen Survivor runtime contract.

The source meshes share a 165 cm A-pose envelope but contain no rig or skin.
This tool converts their arm geometry into the canonical T bind before solving
weights. It fails on weak anatomical classification instead of emitting a
character-specific approximation.
"""
from __future__ import annotations

import argparse
import hashlib
import heapq
import json
import math
import shutil
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

SCRIPT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_ROOT))

from bind_character import albedo_per_vertex, solve_seam_welded_heat, weight_audit
from create_humanoid_rig import APP_ROOT, RIG_ID, create_rig, definition
from export_character_glb import export_character
from pose_test import apply_pose, pose_test, positions, studio


OUTPUT_ROOT = APP_ROOT / "test-output/survivor-batch-integration"
SOURCE_ROOT = Path.home() / "Downloads"
CHARACTERS = {
    "lin_jianyue": "Meshy_AI_SUR_003_林见月_0919044512_texture.glb",
    "lu_qinghe": "Meshy_AI_SUR_004_陆清禾_0919043838_texture.glb",
    "shen_yanchuan": "Meshy_AI_SUR_005_沈砚川_0919044507_texture.glb",
    "tang_zhi": "Meshy_AI_SUR_006_唐栀_0919044450_texture.glb",
    "gu_yuan": "Meshy_AI_SUR_007_顾予安_0919044454_texture.glb",
    "cheng_mo": "Meshy_AI_SUR_008_程茉_0919044615_texture.glb",
    "zhou_ye": "Meshy_AI_SUR_009_周野_0919044445_texture.glb",
    "xu_zhaoning": "Meshy_AI_SUR_010_许昭宁_0919044621_texture.glb",
    "he_linchuan": "Meshy_AI_SUR_011_贺临川_0919044608_texture.glb",
    "song_shiyu": "Meshy_AI_SUR_012_宋时雨_0919044501_texture.glb",
}


def smooth(low: float, high: float, value: np.ndarray | float) -> np.ndarray | float:
    amount = np.clip((value - low) / (high - low), 0.0, 1.0)
    return amount * amount * (3.0 - 2.0 * amount)


def save_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def import_source(path: Path) -> bpy.types.Object:
    bpy.ops.import_scene.gltf(filepath=str(path), merge_vertices=False)
    meshes = [item for item in bpy.context.scene.objects if item.type == "MESH"]
    armatures = [item for item in bpy.context.scene.objects if item.type == "ARMATURE"]
    if len(meshes) != 1 or armatures:
        raise ValueError("Source contract requires one mesh and no armature")
    mesh = meshes[0]
    if mesh.matrix_world != Matrix.Identity(4):
        raise ValueError("Source mesh transform must be identity")
    return mesh


def classify_surfaces(mesh: bpy.types.Object) -> tuple[np.ndarray, dict[str, object]]:
    """Split the A-pose surface into torso, head/hair and both arms.

    Seeds come from the shared anatomical envelope. A color-aware geodesic fill
    keeps nearby hair, sleeves and skirts from jumping across empty space.
    """
    points = np.array([vertex.co[:] for vertex in mesh.data.vertices])
    colors = albedo_per_vertex(mesh)
    coordinates, inverse = np.unique(np.round(points, 5), axis=0, return_inverse=True)
    color = np.zeros((len(coordinates), 3))
    np.add.at(color, inverse, colors)
    counts = np.bincount(inverse)
    color /= counts[:, None]
    source_edges = np.array([tuple(edge.vertices) for edge in mesh.data.edges])
    edges = np.unique(np.sort(inverse[source_edges], axis=1), axis=0)
    adjacency: list[list[tuple[int, float]]] = [[] for _ in coordinates]
    for left, right in edges:
        spatial = np.linalg.norm(coordinates[left] - coordinates[right])
        chroma = np.linalg.norm(color[left] - color[right])
        cost = float(spatial * (1.0 + 8.0 * chroma))
        adjacency[left].append((int(right), cost))
        adjacency[right].append((int(left), cost))

    labels = np.full(len(coordinates), -1, dtype=np.int8)
    distance = np.full(len(coordinates), np.inf)
    queue: list[tuple[float, int]] = []
    for index, (x, y, z) in enumerate(coordinates):
        side_extent = abs(x)
        arm_boundary = 0.135 + 0.34 * max(0.0, 1.21 - z)
        label = -1
        if z > 1.305:
            label = 1
        elif 0.70 < z < 1.255 and side_extent > arm_boundary and y < 0.14:
            label = 2 if x >= 0.0 else 3
        elif z < 0.69 or (side_extent < 0.105 and z < 1.22):
            label = 0
        elif side_extent < 0.19 and z < 1.12:
            label = 0
        if label >= 0:
            labels[index] = label
            distance[index] = 0.0
            heapq.heappush(queue, (0.0, index))

    while queue:
        cost, vertex = heapq.heappop(queue)
        if cost > distance[vertex]:
            continue
        for neighbor, edge_cost in adjacency[vertex]:
            candidate = cost + edge_cost
            if candidate < distance[neighbor]:
                labels[neighbor] = labels[vertex]
                distance[neighbor] = candidate
                heapq.heappush(queue, (candidate, neighbor))

    if np.any(labels < 0):
        raise ValueError("Surface classification left vertices without a semantic region")

    # Meshy joins disconnected hair, clothes and body islands into one object.
    # A long hair strand can sit closer to a sleeve than to the scalp in Euclidean
    # space; connected-surface identity takes precedence over that proximity.
    component = np.full(len(coordinates), -1, dtype=np.int32)
    component_count = 0
    for start in range(len(coordinates)):
        if component[start] >= 0:
            continue
        component[start] = component_count
        stack = [start]
        while stack:
            vertex = stack.pop()
            for neighbor, _cost in adjacency[vertex]:
                if component[neighbor] < 0:
                    component[neighbor] = component_count
                    stack.append(neighbor)
        component_count += 1
    hair_components = 0
    for component_id in range(component_count):
        mask = component == component_id
        surface = coordinates[mask]
        if len(surface) < 12:
            continue
        minimum = surface[:, 2].min()
        maximum = surface[:, 2].max()
        mean = surface[:, 2].mean()
        if maximum > 1.32 and minimum > 0.68 and mean > 1.06:
            labels[mask] = 1
            hair_components += 1

    expanded = labels[inverse]
    ratios = {str(label): float(np.mean(expanded == label)) for label in range(4)}
    for label in (2, 3):
        if ratios[str(label)] < 0.025:
            raise ValueError(f"Arm classification is too small for region {label}: {ratios}")
    # Sleeve, coat and hair surface area can be intentionally asymmetric. The
    # per-side minimum and detected anatomical axis are the reliable gates.
    symmetry = abs(ratios["2"] - ratios["3"])
    return expanded, {
        "region_ratios": ratios,
        "arm_ratio_delta": symmetry,
        "connected_components": component_count,
        "head_hair_components": hair_components,
    }


def arm_transform(points: np.ndarray, mask: np.ndarray, sign: int) -> tuple[np.ndarray, dict[str, object]]:
    arm = points[mask]
    if len(arm) < 1000:
        raise ValueError("Arm surface has insufficient vertices")
    centered = arm - np.mean(arm, axis=0)
    _, _, vectors = np.linalg.svd(centered, full_matrices=False)
    axis = vectors[0]
    if axis[0] * sign < 0.0:
        axis *= -1.0
    projection = arm @ axis
    inner_limit, outer_limit = np.quantile(projection, [0.04, 0.96])
    inner = arm[projection <= np.quantile(projection, 0.10)]
    outer = arm[projection >= np.quantile(projection, 0.90)]
    source_shoulder = np.median(inner, axis=0)
    source_hand = np.median(outer, axis=0)
    source_axis = source_hand - source_shoulder
    if source_axis[0] * sign < 0.0:
        source_axis *= -1.0
        source_shoulder, source_hand = source_hand, source_shoulder
    source_length = float(np.linalg.norm(source_axis))
    if not 0.35 <= source_length <= 0.72:
        raise ValueError(f"Detected arm length outside the shared envelope: {source_length:.4f} m")
    direction = source_axis / source_length
    target_direction = np.array([float(sign), 0.0, 0.0])
    rotation = np.array(Vector(direction).rotation_difference(Vector(target_direction)).to_matrix())
    target_shoulder = np.array([0.14 * sign, 0.0, 1.21])
    target_length = 0.52
    ratio = target_length / source_length
    linear = rotation @ (np.eye(3) + (ratio - 1.0) * np.outer(direction, direction))
    transformed = (points - source_shoulder) @ linear.T + target_shoulder
    source_drop = math.degrees(math.asin(np.clip(-direction[2], -1.0, 1.0)))
    report = {
        "source_shoulder": source_shoulder.tolist(),
        "source_hand": source_hand.tolist(),
        "source_length_m": source_length,
        "source_drop_degrees": source_drop,
        "mesh_axial_ratio": ratio,
        "projection_limits": [float(inner_limit), float(outer_limit)],
    }
    return transformed, report


def align_to_t_pose(mesh: bpy.types.Object, labels: np.ndarray) -> dict[str, object]:
    original = np.array([vertex.co[:] for vertex in mesh.data.vertices])
    result = original.copy()
    report: dict[str, object] = {}
    for side, sign, label in (("Left", 1, 2), ("Right", -1, 3)):
        mask = labels == label
        transformed, details = arm_transform(original, mask, sign)
        result[mask] = transformed[mask]
        report[side] = details
    mesh.data.vertices.foreach_set("co", result.ravel())
    mesh.data.update()
    mesh["bind_alignment"] = "generic_anatomical_a_to_canonical_t"
    report["changed_vertices"] = int(np.sum(np.linalg.norm(result - original, axis=1) > 1e-7))
    report["height_before_m"] = float(np.ptp(original[:, 2]))
    report["height_after_m"] = float(np.ptp(result[:, 2]))
    return report


def automatic_bind(mesh: bpy.types.Object, rig: bpy.types.Object) -> None:
    rig.data.bones["Root"].use_deform = False
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    try:
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
        if weight_audit(mesh)["unweighted"]:
            raise RuntimeError("Direct heat left unweighted vertices")
        mesh["weight_method"] = "canonical_t_pose_automatic_heat"
    except RuntimeError:
        mesh.vertex_groups.clear()
        mesh.modifiers.clear()
        mesh.parent = None
        solve_seam_welded_heat(mesh, rig)
        mesh.parent = rig
        modifier = mesh.modifiers.new("CanonicalSkin", "ARMATURE")
        modifier.object = rig
    rig.data.bones["Root"].use_deform = True


def constrain_weights(mesh: bpy.types.Object, rig: bpy.types.Object, labels: np.ndarray) -> dict[str, object]:
    for spec in definition():
        if mesh.vertex_groups.get(spec["name"]) is None:
            mesh.vertex_groups.new(name=spec["name"])
    names = [group.name for group in mesh.vertex_groups]
    indices = {name: index for index, name in enumerate(names)}
    points = np.array([vertex.co[:] for vertex in mesh.data.vertices])
    weights = np.zeros((len(points), len(names)))
    for vertex in mesh.data.vertices:
        for group in vertex.groups:
            weights[vertex.index, group.group] = group.weight

    arm_names = [side + part for side in ("Left", "Right") for part in ("Shoulder", "UpperArm", "LowerArm", "Hand")]
    arm_indices = [indices[name] for name in arm_names]
    for side, sign, label in (("Left", 1, 2), ("Right", -1, 3)):
        mask = labels == label
        extent = points[:, 0] * sign
        upper_to_lower = smooth(0.335, 0.405, extent)
        lower_to_hand = smooth(0.535, 0.600, extent)
        shoulder_to_upper = smooth(0.145, 0.195, extent)
        chain = np.zeros((len(points), 4))
        chain[:, 0] = 1.0 - shoulder_to_upper
        chain[:, 1] = shoulder_to_upper * (1.0 - upper_to_lower)
        chain[:, 2] = upper_to_lower * (1.0 - lower_to_hand)
        chain[:, 3] = lower_to_hand
        weights[mask] = 0.0
        for column, part in enumerate(("Shoulder", "UpperArm", "LowerArm", "Hand")):
            weights[mask, indices[side + part]] = chain[mask, column]

    # Hair and facial islands remain rigidly attached to Head in this 23-bone contract.
    hair = labels == 1
    weights[hair] = 0.0
    weights[hair, indices["Head"]] = 1.0

    # Torso and lower garments must not inherit a distant arm merely because surfaces touch.
    central = (labels == 0) & (np.abs(points[:, 0]) < 0.13) & (points[:, 2] > 0.86)
    removed = weights[np.ix_(central, arm_indices)].sum(axis=1)
    weights[np.ix_(central, arm_indices)] = 0.0
    torso_target = np.where(points[central, 2] > 1.18, indices["UpperChest"], indices["Chest"])
    central_rows = np.flatnonzero(central)
    weights[central_rows, torso_target] += removed

    # Prevent opposite-leg contamination and make shoe soles follow the matching foot chain.
    for side, sign in (("Left", 1), ("Right", -1)):
        own = [indices[side + part] for part in ("UpperLeg", "LowerLeg", "Foot", "Toes")]
        other_side = "Right" if side == "Left" else "Left"
        opposite = [indices[other_side + part] for part in ("UpperLeg", "LowerLeg", "Foot", "Toes")]
        lower = (points[:, 0] * sign > 0.025) & (points[:, 2] < 0.86)
        transfer = weights[np.ix_(lower, opposite)].sum(axis=1)
        weights[np.ix_(lower, opposite)] = 0.0
        own_sum = weights[np.ix_(lower, own)].sum(axis=1)
        rows = np.flatnonzero(lower)
        for row, amount, total in zip(rows, transfer, own_sum):
            if amount <= 0.0:
                continue
            if total > 1e-8:
                weights[row, own] *= (total + amount) / total
            else:
                weights[row, indices[side + "UpperLeg"]] = amount
        shoe = (points[:, 0] * sign > 0.025) & (points[:, 2] < 0.145)
        toe_mix = smooth(-0.08, -0.145, points[:, 1])
        rows = np.flatnonzero(shoe)
        weights[rows] = 0.0
        weights[rows, indices[side + "Foot"]] = 1.0 - toe_mix[rows]
        weights[rows, indices[side + "Toes"]] = toe_mix[rows]

    keep = np.argsort(weights, axis=1)[:, -4:]
    limited = np.zeros_like(weights)
    np.put_along_axis(limited, keep, np.take_along_axis(weights, keep, axis=1), axis=1)
    totals = limited.sum(axis=1)
    if np.any(totals < 1e-8):
        raise ValueError("Weight constraints produced unweighted vertices")
    limited /= totals[:, None]
    for group in mesh.vertex_groups:
        group.remove(list(range(len(points))))
    for vertex, row in enumerate(limited):
        for group_index in np.flatnonzero(row > 1e-8):
            mesh.vertex_groups[int(group_index)].add([vertex], float(row[group_index]), "REPLACE")
    mesh["weight_method"] += "_semantic_contract"
    for modifier in mesh.modifiers:
        if modifier.type == "ARMATURE":
            modifier.use_deform_preserve_volume = False
    audit = weight_audit(mesh)
    if audit["unweighted"] or audit["max_influences"] > 4 or audit["max_sum_error"] > 1e-5:
        raise ValueError(f"Invalid final skin: {audit}")
    return audit


def add_socket_contract(rig: bpy.types.Object) -> dict[str, str]:
    contract = {
        "right_hand_socket": "RightHand",
        "left_hand_reference": "LeftHand",
        "muzzle_attachment": "weapon_scene/MuzzlePoint",
    }
    rig["weapon_socket_contract"] = json.dumps(contract, separators=(",", ":"))
    rig["WeaponSocket_R.bone"] = "RightHand"
    rig["WeaponSocket_L.reference_bone"] = "LeftHand"
    rig["MuzzlePoint.owner"] = "weapon_scene"
    return contract


def bone_snapshot(rig: bpy.types.Object) -> list[dict[str, object]]:
    return [
        {
            "name": bone.name,
            "parent": bone.parent.name if bone.parent else None,
            "head": list(bone.head_local),
            "tail": list(bone.tail_local),
            "length": bone.length,
            "matrix": [list(row) for row in bone.matrix_local],
        }
        for bone in rig.data.bones
    ]


def render_static_views(rig: bpy.types.Object, output: Path) -> None:
    scene, camera = studio()
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 600
    scene.render.resolution_y = 800
    scene.render.image_settings.file_format = "PNG"
    output.mkdir(parents=True, exist_ok=True)
    views = {
        "t_pose_front": (0.0, -4.0, 0.90),
        "t_pose_three_quarter": (2.7, -4.0, 2.15),
    }
    apply_pose(rig, "rest")
    for name, location in views.items():
        camera.location = location
        camera.rotation_euler = (Vector((0.0, 0.0, 0.82)) - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(output / f"{name}.png")
        bpy.ops.render.render(write_still=True)


def build(character: str, production: bool) -> dict[str, object]:
    source = SOURCE_ROOT / CHARACTERS[character]
    if not source.exists():
        raise FileNotFoundError(source)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    output = OUTPUT_ROOT / character
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh = import_source(source)
    mesh.name = character
    mesh["character_id"] = character
    mesh["source_sha256"] = source_hash
    labels, classification = classify_surfaces(mesh)
    alignment = align_to_t_pose(mesh, labels)
    rig = create_rig()
    before = bone_snapshot(rig)
    automatic_bind(mesh, rig)
    weights = constrain_weights(mesh, rig, labels)
    sockets = add_socket_contract(rig)
    bpy.context.view_layer.update()
    after = bone_snapshot(rig)
    if before != after:
        raise ValueError("Skinning changed the frozen canonical skeleton")
    mesh_matrix_error = float(np.max(np.abs(np.array(mesh.matrix_world) - np.eye(4))))
    rig_matrix_error = float(np.max(np.abs(np.array(rig.matrix_world) - np.eye(4))))
    if mesh_matrix_error > 1e-6 or rig_matrix_error > 1e-6:
        raise ValueError(
            "Runtime object transforms must remain identity: "
            f"mesh={mesh_matrix_error}, rig={rig_matrix_error}"
        )
    if bpy.data.actions:
        raise ValueError("Binding pipeline must not create animation actions")

    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.file.pack_all()
    blend_path = output / f"{character}_bind.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    candidate_path = output / f"{character}.glb"
    export = export_character(rig, [mesh], candidate_path)
    deformation = pose_test(rig, [mesh], output / "static-qa", render=False)
    render_static_views(rig, output / "static-qa")

    points = positions(mesh)
    report = {
        "character": character,
        "source": str(source),
        "source_sha256": source_hash,
        "rig": RIG_ID,
        "bone_count": len(before),
        "skeleton": before,
        "classification": classification,
        "alignment": alignment,
        "weights": weights,
        "socket_contract": sockets,
        "height_m": float(np.ptp(points[:, 2])),
        "ground_y_m": float(points[:, 2].min()),
        "triangles": sum(len(polygon.vertices) - 2 for polygon in mesh.data.polygons),
        "vertices": len(points),
        "actions": len(bpy.data.actions),
        "mesh_matrix_identity_error": mesh_matrix_error,
        "rig_matrix_identity_error": rig_matrix_error,
        "export": export,
        "deformation": deformation,
        "candidate": str(candidate_path),
    }
    if not 1.62 <= report["height_m"] <= 1.68:
        raise ValueError(f"Runtime height left the 165 cm envelope: {report['height_m']}")
    save_json(output / "bind-report.json", report)

    if production:
        character_root = APP_ROOT / "assets" / "characters" / character
        runtime = character_root / "runtime" / f"{character}.glb"
        source_copy = character_root / "source" / f"{character}.glb"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        source_copy.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(candidate_path, runtime)
        shutil.copy2(source, source_copy)
        report["production_runtime"] = str(runtime)
        report["production_source"] = str(source_copy)
        save_json(output / "bind-report.json", report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--character", choices=[*CHARACTERS, "all"], required=True)
    parser.add_argument("--production", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    selected = list(CHARACTERS) if args.character == "all" else [args.character]
    results = []
    for character in selected:
        results.append(build(character, args.production))
        print(f"BATCH SURVIVOR PASS {character}", flush=True)
    save_json(OUTPUT_ROOT / "bind-summary.json", {
        "rig": RIG_ID,
        "characters": [row["character"] for row in results],
        "production": args.production,
        "results": results,
    })


if __name__ == "__main__":
    main()
