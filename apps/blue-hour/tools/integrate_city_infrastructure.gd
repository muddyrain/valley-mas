extends SceneTree
## Registers Blender-generated Phase 3B GLBs without making them gameplay objects.

const Definition = preload("res://data/world_asset_data.gd")
const ITEMS: Array[Dictionary] = [
	{"id": "PRP_CITY_001_shop_sign", "category": "commercial", "size": Vector3(2.15, 0.82, 0.42), "tags": ["COMMERCIAL", "COMMERCIAL_FRONTAGE"]},
	{"id": "PRP_CITY_002_ac_unit", "category": "residential", "size": Vector3(1.12, 0.78, 0.55), "tags": ["RESIDENTIAL", "COMMERCIAL_FRONTAGE"]},
	{"id": "PRP_CITY_003_power_pole", "category": "road", "size": Vector3(0.72, 6.2, 0.52), "tags": ["ROAD", "TOWN_EDGE"]},
	{"id": "PRP_CITY_004_power_wire_set", "category": "road", "size": Vector3(9.0, 0.65, 0.18), "tags": ["ROAD", "OVERHEAD"]},
	{"id": "PRP_CITY_005_traffic_light", "category": "road", "size": Vector3(1.25, 4.15, 0.6), "tags": ["ROAD", "INTERSECTION"]},
	{"id": "PRP_CITY_006_bus_shelter", "category": "commercial", "size": Vector3(4.8, 2.75, 1.85), "tags": ["COMMERCIAL", "ROAD_EDGE"]},
	{"id": "PRP_CITY_007_awning", "category": "commercial", "size": Vector3(3.15, 0.72, 1.25), "tags": ["COMMERCIAL", "COMMERCIAL_FRONTAGE"]},
	{"id": "PRP_CITY_008_cardboard_stack", "category": "industrial", "size": Vector3(1.45, 1.12, 0.98), "tags": ["INDUSTRIAL"]},
	{"id": "PRP_CITY_009_fire_hydrant", "category": "road", "size": Vector3(0.62, 0.92, 0.62), "tags": ["ROAD", "ROAD_EDGE"]},
	{"id": "PRP_CITY_010_broken_billboard", "category": "industrial", "size": Vector3(3.65, 3.45, 0.52), "tags": ["INDUSTRIAL", "ROAD_EDGE"]}
]

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	for item: Dictionary in ITEMS:
		var source_path := "res://assets/world/props/city_props_v1/%s.glb" % item.id
		var scene := load(source_path) as PackedScene
		assert(scene != null, "Imported Blender GLB: " + item.id)
		var definition := Definition.new()
		definition.id = item.id
		definition.scene = scene
		definition.category = item.category
		definition.footprint = Vector2(item.size.x, item.size.z)
		definition.bounding_size = item.size
		definition.spawn_weight = 0.0
		definition.allowed_district = PackedStringArray()
		definition.searchable = false
		definition.loot_profile = ""
		definition.enemy_profile = ""
		definition.environment_tags = PackedStringArray(item.tags)
		var resource_path := "res://data/world_assets/%s.tres" % item.id
		assert(ResourceSaver.save(definition, resource_path) == OK, "Save WorldAssetData: " + item.id)
		print("INTEGRATED ", item.id, " -> ", source_path)
	quit()
