extends SceneTree
## Registers Blender-generated Phase 3C city dressing in WorldAssetData resources.

const Definition = preload("res://data/world_asset_data.gd")
const ROOT := "res://assets/world/props/city_props_v2/"
const ITEMS: Array[Dictionary] = [
	{"id": "PRP_CITY_011_planter_box_pair", "category": "residential", "size": Vector3(1.65, 0.92, 0.58), "tags": ["RESIDENTIAL", "GARDEN"]},
	{"id": "PRP_CITY_012_neighborhood_notice_board", "category": "residential", "size": Vector3(1.28, 1.72, 0.28), "tags": ["RESIDENTIAL", "COMMUNITY"]},
	{"id": "PRP_CITY_013_recycling_bin_pair", "category": "residential", "size": Vector3(1.08, 0.96, 0.65), "tags": ["RESIDENTIAL", "ROAD_EDGE"]},
	{"id": "PRP_CITY_014_delivery_lockbox", "category": "residential", "size": Vector3(0.72, 0.82, 0.58), "tags": ["RESIDENTIAL", "COMMERCIAL"]},
	{"id": "PRP_CITY_015_garden_tool_cart", "category": "residential", "size": Vector3(1.16, 0.86, 0.62), "tags": ["RESIDENTIAL", "GARDEN"]},
	{"id": "PRP_CITY_016_storefront_menu_stand", "category": "commercial", "size": Vector3(0.62, 1.06, 0.48), "tags": ["COMMERCIAL", "FRONTAGE"]},
	{"id": "PRP_CITY_017_beverage_crate_stack", "category": "commercial", "size": Vector3(1.12, 0.88, 0.74), "tags": ["COMMERCIAL", "FRONTAGE"]},
	{"id": "PRP_CITY_018_delivery_handcart", "category": "commercial", "size": Vector3(0.86, 1.08, 0.62), "tags": ["COMMERCIAL", "INDUSTRIAL"]},
	{"id": "PRP_CITY_019_sidewalk_banner_stand", "category": "commercial", "size": Vector3(0.92, 2.05, 0.44), "tags": ["COMMERCIAL", "FRONTAGE"]},
	{"id": "PRP_CITY_020_storefront_flag_pair", "category": "commercial", "size": Vector3(1.12, 1.46, 0.28), "tags": ["COMMERCIAL", "FRONTAGE"]},
	{"id": "PRP_CITY_021_street_bollard_set", "category": "road", "size": Vector3(1.12, 0.82, 0.42), "tags": ["ROAD", "ROAD_EDGE"]},
	{"id": "PRP_CITY_022_utility_cabinet", "category": "road", "size": Vector3(0.76, 1.15, 0.62), "tags": ["ROAD", "ROAD_EDGE"]},
	{"id": "PRP_CITY_023_guardrail_segment", "category": "road", "size": Vector3(2.42, 0.82, 0.26), "tags": ["ROAD", "ROAD_EDGE"]},
	{"id": "PRP_CITY_024_bicycle_parking_rack", "category": "road", "size": Vector3(1.82, 0.68, 0.54), "tags": ["ROAD", "RESIDENTIAL"]},
	{"id": "PRP_CITY_025_bus_stop_post", "category": "road", "size": Vector3(0.48, 2.35, 0.36), "tags": ["ROAD", "COMMERCIAL"]},
	{"id": "PRP_CITY_026_fallen_market_sign", "category": "aftermath", "size": Vector3(1.42, 0.92, 0.2), "tags": ["AFTERMATH", "COMMERCIAL"]},
	{"id": "PRP_CITY_027_cloth_tarp_bundle", "category": "aftermath", "size": Vector3(1.34, 0.98, 0.46), "tags": ["AFTERMATH", "INDUSTRIAL"]},
	{"id": "PRP_CITY_028_scattered_box_debris", "category": "aftermath", "size": Vector3(1.46, 1.02, 0.34), "tags": ["AFTERMATH", "INDUSTRIAL"]},
	{"id": "PRP_CITY_029_broken_fence_section", "category": "aftermath", "size": Vector3(2.12, 0.24, 0.94), "tags": ["AFTERMATH", "RESIDENTIAL"]},
	{"id": "PRP_CITY_030_roadside_grass_patch", "category": "vegetation", "size": Vector3(1.42, 1.12, 0.24), "tags": ["VEGETATION", "ROAD_EDGE"]},
	{"id": "PRP_CITY_031_small_bush_cluster", "category": "vegetation", "size": Vector3(1.42, 1.04, 0.76), "tags": ["VEGETATION", "RESIDENTIAL"]},
	{"id": "PRP_CITY_032_neglected_planter", "category": "vegetation", "size": Vector3(1.12, 0.76, 0.72), "tags": ["VEGETATION", "RESIDENTIAL"]},
	{"id": "PRP_CITY_033_small_vine_patch", "category": "vegetation", "size": Vector3(1.12, 0.18, 0.94), "tags": ["VEGETATION", "WALL_EDGE"]},
	{"id": "PRP_CITY_034_umbrella_stand", "category": "residential", "size": Vector3(0.92, 0.62, 1.42), "tags": ["RESIDENTIAL", "COMMERCIAL"]}
]

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	for item: Dictionary in ITEMS:
		var source_path: String = ROOT + "%s.glb" % item.id
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
