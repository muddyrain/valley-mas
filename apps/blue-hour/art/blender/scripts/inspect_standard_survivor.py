"""Read the supplied FBX bind/rest geometry without evaluating its animations."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector
from io_scene_fbx import parse_fbx


def vector(value):
    return [float(v) for v in value]


def matrix(value):
    return [vector(row) for row in value]


def inspect(source):
    tree, version = parse_fbx.parse(str(source))
    objects = next(e for e in tree.elems if e.id == b"Objects")
    actions = [str(e.props[1]) for e in objects.elems if e.id == b"AnimationStack"]
    images = []
    for obj in objects.elems:
        if obj.id in (b"Video", b"Texture"):
            images.extend({"field": e.id.decode(), "value": str(e.props[0])} for e in obj.elems if e.id in (b"Filename", b"FileName", b"RelativeFilename"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(source), use_anim=False, automatic_bone_orientation=False, ignore_leaf_bones=False)
    rigs = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert len(rigs) == 1 and len(meshes) == 1
    rig, mesh = rigs[0], meshes[0]
    rig.data.pose_position = "REST"
    bpy.context.view_layer.update()
    vertices = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    bounds = {"min": [min(v[i] for v in vertices) for i in range(3)], "max": [max(v[i] for v in vertices) for i in range(3)]}
    bones = []
    for b in rig.data.bones:
        transform = rig.matrix_world @ b.matrix_local
        bones.append({"name": b.name, "parent": b.parent.name if b.parent else None, "head": vector(rig.matrix_world @ b.head_local), "tail": vector(rig.matrix_world @ b.tail_local), "length": b.length, "rest_matrix": matrix(transform), "determinant": transform.to_3x3().determinant()})
    weights = [[g.weight for g in v.groups if g.weight > 0] for v in mesh.data.vertices]
    sums = [sum(w) for w in weights]
    weighted_vertices_by_bone = {g.name: 0 for g in mesh.vertex_groups}
    for vertex in mesh.data.vertices:
        for group in vertex.groups:
            if group.weight > 0:
                weighted_vertices_by_bone[mesh.vertex_groups[group.group].name] += 1
    invalid_groups = [g.name for g in mesh.vertex_groups if g.name not in rig.data.bones]
    feet = {}
    for side in ("Left", "Right"):
        names = {part: next(b.name for b in rig.data.bones if b.name.endswith(side + part)) for part in ("UpLeg", "Leg", "Foot", "ToeBase", "Toe_End")}
        points = {part: rig.matrix_world @ rig.data.bones[name].head_local for part, name in names.items()}
        forward = points["ToeBase"] - points["Foot"]
        forward.z = 0
        forward.normalize()
        sign = 1 if points["Foot"].x > 0 else -1
        sole = [v for v in vertices if v.x * sign > 0 and v.z < bounds["min"][2] + 0.06]
        depth = [v.dot(forward) for v in sole]
        rear, front = min(depth), max(depth)
        heel = [v.z for v, d in zip(sole, depth) if d <= rear + (front - rear) * 0.3]
        toe = [v.z for v, d in zip(sole, depth) if d >= rear + (front - rear) * 0.7]
        thigh = points["Leg"] - points["UpLeg"]
        shin = points["Foot"] - points["Leg"]
        feet[side] = {"joints": {k: vector(v) for k, v in points.items()}, "thigh_length": thigh.length, "shin_length": shin.length, "knee_bend_degrees": math.degrees(thigh.angle(shin)), "sole_vertices": len(sole), "heel_min": min(heel), "heel_max": max(heel), "forefoot_min": min(toe), "forefoot_max": max(toe), "foot_to_toe_pitch_degrees": math.degrees(math.atan2((points["ToeBase"]-points["Foot"]).z, (Vector((points["ToeBase"].x-points["Foot"].x, points["ToeBase"].y-points["Foot"].y))).length))}
    symmetry = {}
    mirror = Matrix.Diagonal(Vector((-1, 1, 1)))
    for part in ("UpLeg", "Leg", "Foot", "ToeBase", "Toe_End"):
        left = next(b for b in rig.data.bones if b.name.endswith("Left" + part))
        right = next(b for b in rig.data.bones if b.name.endswith("Right" + part))
        lm = rig.matrix_world @ left.matrix_local
        rm = rig.matrix_world @ right.matrix_local
        symmetry[part] = {"mirrored_head_error_m": (mirror @ lm.translation - rm.translation).length, "length_difference_m": abs(left.length-right.length), "mirrored_axis_dot": [(mirror @ lm.to_3x3().col[i]).normalized().dot(rm.to_3x3().col[i].normalized()) for i in range(3)]}
    modifiers = [{"type": m.type, "target": m.object.name if m.type == "ARMATURE" and m.object else None} for m in mesh.modifiers]
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    rest_displacement = max((evaluated.matrix_world @ v.co - vertices[i]).length for i, v in enumerate(evaluated.data.vertices))
    return {"source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "fbx_version": version, "source_animations_not_imported": actions, "image_metadata": images, "mesh": {"vertices": len(vertices), "polygons": len(mesh.data.polygons), "bounds_z_up": bounds, "height_m": bounds["max"][2]-bounds["min"][2], "transform": matrix(mesh.matrix_world), "armature_modifiers": modifiers, "rest_skin_max_displacement_m": rest_displacement}, "rig": {"name": rig.name, "transform": matrix(rig.matrix_world), "bone_count": len(bones), "bones": bones}, "skin": {"unweighted_vertices": sum(not w for w in weights), "min_weight_sum": min(sums), "max_weight_sum": max(sums), "max_influences": max(map(len, weights)), "invalid_groups": invalid_groups, "weighted_vertices_by_bone": weighted_vertices_by_bone}, "feet": feet, "symmetry": symmetry}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("report", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    report = inspect(args.source)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"height": report["mesh"]["height_m"], "bones": report["rig"]["bone_count"], "skin": report["skin"], "feet": report["feet"], "symmetry": report["symmetry"]}))
