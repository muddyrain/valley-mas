"""Rebuild checked-in runtime wrappers from the measured GLBs and visual authoring decisions."""
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]


def vec(v):
    return "Vector%d(%s)" % (len(v), ", ".join(f"{x:.6f}" for x in v))


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def scene(spec, yaw, translation, boxes, entrance, road, lamp=False, procedural=False):
    resources = ['[ext_resource type="Script" path="res://maps/world/%s.gd" id="script"]' % ("street_lamp" if lamp else "world_asset")]
    if not procedural:
        resources += ['[ext_resource type="PackedScene" path="%s" id="model"]' % spec["path"]]
    parts = []
    for index, (pos, size) in enumerate(boxes):
        resources += [f'[sub_resource type="BoxShape3D" id="shape_{index}"]\nsize = {vec(size)}']
        parts += [f'[node name="Shape{index}" type="CollisionShape3D" parent="Collision"]\nposition = {vec(pos)}\nshape = SubResource("shape_{index}")']
    nodes = [f'[node name="WorldAsset" type="Node3D" groups=["world_assets"]]\nscript = ExtResource("script")\nasset_id = "{spec["id"]}"',
             '[node name="ModelRoot" type="Node3D" parent="."]\nposition = %s\nrotation = Vector3(0, %.8f, 0)' % (vec(translation), yaw)]
    if not procedural:
        nodes += ['[node name="SourceModel" parent="ModelRoot" instance=ExtResource("model")]']
    nodes += ['[node name="Collision" type="StaticBody3D" parent="."]', *parts,
              '[node name="NavigationObstacle" type="Node3D" parent="."]\nmetadata/provider = "Wrapper shapes projected to the mission AStar grid"',
              '[node name="Anchors" type="Node3D" parent="."]',
              '[node name="RoadAnchor" type="Marker3D" parent="Anchors"]\nposition = ' + vec(road),
              '[node name="EntranceAnchor" type="Marker3D" parent="Anchors"]\nposition = ' + vec(entrance),
              '[node name="SpawnPoints" type="Node3D" parent="."]']
    for group, offset in [("LootPoints", entrance), ("EnemyPoints", [entrance[0]+3, 0, entrance[2]]), ("OptionalVehiclePoints", [0, 0, road[2]-3])]:
        nodes += [f'[node name="{group}" type="Node3D" parent="SpawnPoints"]',
                  f'[node name="Primary" type="Marker3D" parent="SpawnPoints/{group}"]\nposition = {vec(offset)}']
    if spec["id"].startswith("VEH"):
        resources += ['[sub_resource type="SphereShape3D" id="interaction"]\nradius = 1.1']
        nodes += ['[node name="LootAnchor" type="Marker3D" parent="."]\nposition = ' + vec(entrance),
                  '[node name="InteractionArea" type="Area3D" parent="."]\nposition = %s\ncollision_layer = 8\ncollision_mask = 0\nmonitoring = false' % vec(entrance),
                  '[node name="Shape" type="CollisionShape3D" parent="InteractionArea"]\nshape = SubResource("interaction")']
    if lamp:
        resources += ['[ext_resource type="Material" path="res://assets/world/materials/street_lamp_lens.tres" id="lens"]',
                      '[sub_resource type="BoxMesh" id="lens_mesh"]\nsize = Vector3(0.22, 0.035, 0.42)']
        nodes += ['[node name="LampLens" type="MeshInstance3D" parent="."]\nposition = Vector3(0, 4.05, -1.15)\nmesh = SubResource("lens_mesh")\nmaterial_override = ExtResource("lens")',
                  '[node name="StreetLight" type="OmniLight3D" parent="."]\nposition = Vector3(0, 3.85, -1.15)\nlight_color = Color(1, 0.69, 0.32, 1)\nlight_energy = 0.0\nomni_range = 8.0\nshadow_enabled = false']
    if procedural:
        resources += ['[ext_resource type="Material" path="res://assets/world/materials/chain_link.tres" id="chain"]',
                      '[sub_resource type="StandardMaterial3D" id="steel"]\nalbedo_color = Color(0.38, 0.43, 0.44, 1)\nroughness = 0.8',
                      '[sub_resource type="BoxMesh" id="post"]\nsize = Vector3(0.07, 1.8, 0.07)',
                      '[sub_resource type="BoxMesh" id="rail"]\nsize = Vector3(4, 0.05, 0.05)',
                      '[sub_resource type="QuadMesh" id="chain_mesh"]\nsize = Vector2(3.86, 1.65)']
        for name, pos, mesh in [("LeftPost", [-1.965, .9, 0], "post"), ("RightPost", [1.965, .9, 0], "post"), ("TopRail", [0, 1.765, 0], "rail"), ("BottomRail", [0, .08, 0], "rail")]:
            nodes += [f'[node name="{name}" type="MeshInstance3D" parent="ModelRoot"]\nposition = {vec(pos)}\nmesh = SubResource("{mesh}")\nmaterial_override = SubResource("steel")']
        nodes += ['[node name="ChainLinkPlane" type="MeshInstance3D" parent="ModelRoot"]\nposition = Vector3(0, 0.92, 0)\nmesh = SubResource("chain_mesh")\nmaterial_override = ExtResource("chain")',
                  '[node name="LeftSnapAnchor" type="Marker3D" parent="Anchors"]\nposition = Vector3(-2, 0, 0)',
                  '[node name="RightSnapAnchor" type="Marker3D" parent="Anchors"]\nposition = Vector3(2, 0, 0)']
    resources.sort(key=lambda item: not item.startswith('[ext_resource'))
    return '[gd_scene load_steps=%d format=3]\n\n' % (len(resources)+1) + '\n\n'.join(resources+nodes)


def main():
    reports = json.loads((ROOT / "art/world_asset_audit.json").read_text(encoding="utf-8"))
    profiles = ["food_high", "general", "general", "medical_basic", "food_medium", "materials_tools", "fuel_vehicle", "vehicle_parts_tools"]
    pois = ["supermarket", "house", "house", "pharmacy", "restaurant", "warehouse", "gas_station", "auto_repair"]
    parking = ["parking_lot", "roadside", "roadside", "roadside", "roadside", "loading", "fuel_area", "work_area"]
    entries = [0, -2.0, -3.0, 0, 0, 0, 4.0, 0]
    registry = []
    for index, spec in enumerate(reports):
        if spec.get("missing"):
            continue
        building = spec["id"].startswith("BLD")
        vehicle = spec["id"].startswith("VEH")
        lamp = spec["id"].startswith("PRP_001")
        fence = spec["id"].startswith("BAR")
        tree = spec["id"].startswith("VEG_001")
        bush = spec["id"].startswith("VEG_002")
        yaw = math.pi if building else (-math.pi/2 if vehicle or lamp else 0)
        size = spec["size"].copy()
        center = [(spec["max"][i]+spec["min"][i])/2 for i in range(3)]
        center[1] = spec["min"][1]
        if lamp:
            center[0] = .69  # measured pole foot; the arm makes the full AABB asymmetric
        translation = [-math.cos(yaw)*center[0]-math.sin(yaw)*center[2], -center[1], math.sin(yaw)*center[0]-math.cos(yaw)*center[2]]
        if vehicle or lamp:
            size[0], size[2] = size[2], size[0]
        setback = 4.0 if index in [5, 6, 7] else (2.0 if index in [1, 2] else 1.5)
        entrance = [entries[index] if building else 0, 0, -size[2]/2-1.5]
        if vehicle:
            entrance = [0, 0, size[2]/2+1.5]
        road = [0, 0, -size[2]/2-setback]
        boxes = [([0, size[1]/2, 0], size)]
        if tree:
            boxes = [([0, 1.4, 0], [.65, 2.8, .65])]
        if bush:
            boxes = [([0, .4, 0], [1.35, .8, 1.0])]
        if lamp:
            boxes = [([0, 2.0, 0], [.3, 4.0, .3])]
        if index == 6:
            # Monolithic source: keep the forecourt open using measured structure proxies.
            boxes = [([4.15, 2.25, 0], [7.5, 4.5, 10.5]), ([-4.15, 4.95, 0], [7.5, .5, 10.0])]
            boxes += [([x, 2.4, z], [.35, 4.8, .35]) for x in [-7.5, -.8] for z in [-4.6, 4.6]]
            boxes += [([-4.1, .85, z], [.9, 1.7, 1.6]) for z in [-2.5, 2.5]]
        if fence:
            damaged = spec.copy()
            damaged["wrapper"] = spec["wrapper"].replace(".tscn", "_damaged.tscn")
            write(ROOT / damaged["wrapper"][6:], scene(spec, yaw, translation, boxes, entrance, road))
            size = [4, 1.8, .15]
            boxes = [([0, .9, 0], size)]
            yaw, translation = 0, [0, 0, 0]
        spec.update(runtime_scale=[1, 1, 1], model_yaw_degrees=round(math.degrees(yaw), 3),
                    model_translation=translation, runtime_size=size, collision_boxes=boxes,
                    forward="+Z" if building else ("-X" if vehicle or lamp else "symmetric / not applicable"),
                    entrance_offset=entrance, road_offset=road,
                    known_issue=("Damaged noncontinuous source; procedural standard and unused damaged wrapper" if fence else
                                 "Monolithic canopy; compound collision leaves forecourt open; roof fade deferred" if index == 6 else
                                 "Sparse source foliage; original 47,272 triangles preserved" if tree else
                                 "Source labels contain generated pseudo lettering" if building else ""))
        write(ROOT / spec["wrapper"][6:], scene(spec, yaw, translation, boxes, entrance, road, lamp, fence))
        category = spec["path"].split("/")[5] if building else ("vehicles" if vehicle else "vegetation" if tree or bush else "barriers" if fence else "street")
        resource_path = "data/world_assets/" + pathlib.Path(spec["wrapper"]).stem + ".tres"
        data = ['[gd_resource type="Resource" load_steps=3 format=3]', '[ext_resource type="Script" path="res://data/world_asset_data.gd" id="1"]',
                '[ext_resource type="PackedScene" path="%s" id="2"]' % spec["wrapper"],
                '[resource]\nscript = ExtResource("1")\nid = "%s"\nscene = ExtResource("2")' % spec["id"],
                'category = "%s"' % category, 'footprint = ' + vec([size[0], size[2]]), 'bounding_size = ' + vec(size),
                'poi_type = "%s"' % (pois[index] if building else "vehicle" if vehicle else ""),
                'parking_requirement = "%s"' % (parking[index] if building else "none"),
                'loot_profile = "%s"' % (profiles[index] if building else "vehicle_parts_tools" if vehicle else "general"),
                'enemy_profile = "%s"' % ("service" if index in [5, 6, 7] else "street"),
                'entrance_offset = ' + vec(entrance), 'road_offset = ' + vec(road)]
        write(ROOT / resource_path, '\n\n'.join(data))
        registry.append('preload("res://%s")' % resource_path)
    write(ROOT / "data/world_asset_catalog.gd", '''extends RefCounted
## Resource references are the only runtime path registry. Source GLBs belong to wrappers.

const ALL: Array[Resource] = [
\t%s
]

static func asset(id: String) -> Resource:
\tfor definition: Resource in ALL:
\t\tif definition.id == id:
\t\t\treturn definition
\tpush_error("Unknown world asset: " + id)
\treturn null
''' % ',\n\t'.join(registry))
    write(ROOT / "art/world_asset_audit.json", json.dumps(reports, ensure_ascii=False, indent=2))
    print("WORLD WRAPPERS: %d definitions; 16 standard wrappers + damaged fence" % len(registry))


if __name__ == "__main__":
    main()
