extends SceneTree
## Phase 3C acceptance: Blender assets, catalog registration, deterministic grouped placement.

const Generator = preload("res://maps/town/town_generator.gd")
const Dressing = preload("res://maps/town/environment/town_urban_dressing_layer.gd")
const Catalog = preload("res://data/world_asset_catalog.gd")
const MANIFEST_PATH := "res://assets/world/props/city_props_v2/manifest.json"
const SEEDS: Array[int] = [4101, 4102, 4103, 4104, 4105]

var checks := 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var file := FileAccess.open(MANIFEST_PATH, FileAccess.READ)
	_check(file != null, "V2 manifest exists")
	if file == null:
		_finish()
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	_check(parsed is Dictionary and parsed.get("assets", []).size() == 24, "Manifest declares 24 new models")
	if not parsed is Dictionary:
		_finish()
		return
	for asset: Dictionary in parsed.assets:
		var asset_id: String = asset.asset_name
		_check(asset.get("new_model", false), "Asset is explicitly a new model: " + asset_id)
		_check(int(asset.get("tris", 99999)) <= 1500, "Asset stays within low-poly budget: " + asset_id)
		_check(FileAccess.file_exists("res://" + str(asset.file_path)), "GLB exists: " + asset_id)
		_check(FileAccess.file_exists("res://" + str(asset.source_path)), "Editable Blender source exists: " + asset_id)
		var definition: Resource = Catalog.asset(asset_id)
		_check(definition != null and definition.scene != null, "Catalog resource loads: " + asset_id)
		if definition != null and definition.scene != null:
			var instance: Node = definition.scene.instantiate()
			_check(instance != null, "GLB scene instantiates: " + asset_id)
			instance.free()
	for seed_value: int in SEEDS:
		_audit_seed(seed_value)
	_finish()

func _audit_seed(seed_value: int) -> void:
	var town: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	_check(bool(town.get("ok", false)), "Seed %d generates" % seed_value)
	if not town.get("ok", false):
		return
	var result: Dictionary = Dressing.new().generate(town)
	var repeated: Dictionary = Dressing.new().generate(town)
	_check(var_to_str(result) == var_to_str(repeated), "Seed %d placement is deterministic" % seed_value)
	_check(result.instances.size() <= Dressing.MAX_PROPS, "Seed %d respects instance cap" % seed_value)
	_check(result.get("phase", "") == "3C", "Seed %d reports Phase 3C" % seed_value)
	_check(int(result.by_zone.get("RESIDENTIAL", 0)) > 0, "Seed %d has residential dressing" % seed_value)
	_check(int(result.by_zone.get("COMMERCIAL", 0)) > 0, "Seed %d has commercial dressing" % seed_value)
	_check(int(result.by_zone.get("INDUSTRIAL", 0)) > 0, "Seed %d has industrial dressing" % seed_value)
	var grouped_count := 0
	var residential_v2_count := 0
	var commercial_v2_count := 0
	var roadside_v2_count := 0
	var aftermath_count := 0
	for item: Dictionary in result.instances:
		if item.asset in ["PRP_CITY_011_planter_box_pair", "PRP_CITY_012_neighborhood_notice_board", "PRP_CITY_013_recycling_bin_pair", "PRP_CITY_014_delivery_lockbox", "PRP_CITY_015_garden_tool_cart", "PRP_CITY_016_storefront_menu_stand", "PRP_CITY_017_beverage_crate_stack", "PRP_CITY_018_delivery_handcart", "PRP_CITY_019_sidewalk_banner_stand", "PRP_CITY_020_storefront_flag_pair", "PRP_CITY_021_street_bollard_set", "PRP_CITY_022_utility_cabinet", "PRP_CITY_023_guardrail_segment", "PRP_CITY_024_bicycle_parking_rack", "PRP_CITY_025_bus_stop_post", "PRP_CITY_030_roadside_grass_patch", "PRP_CITY_031_small_bush_cluster", "PRP_CITY_032_neglected_planter"]:
			grouped_count += 1
		if item.asset in ["PRP_CITY_011_planter_box_pair", "PRP_CITY_012_neighborhood_notice_board", "PRP_CITY_013_recycling_bin_pair", "PRP_CITY_014_delivery_lockbox", "PRP_CITY_015_garden_tool_cart", "PRP_CITY_031_small_bush_cluster", "PRP_CITY_032_neglected_planter", "PRP_CITY_034_umbrella_stand"]:
			residential_v2_count += 1
		if item.asset in ["PRP_CITY_013_recycling_bin_pair", "PRP_CITY_016_storefront_menu_stand", "PRP_CITY_017_beverage_crate_stack", "PRP_CITY_018_delivery_handcart", "PRP_CITY_019_sidewalk_banner_stand", "PRP_CITY_020_storefront_flag_pair", "PRP_CITY_034_umbrella_stand"]:
			commercial_v2_count += 1
		if item.asset in ["PRP_CITY_021_street_bollard_set", "PRP_CITY_022_utility_cabinet", "PRP_CITY_023_guardrail_segment", "PRP_CITY_024_bicycle_parking_rack", "PRP_CITY_025_bus_stop_post", "PRP_CITY_030_roadside_grass_patch", "PRP_CITY_031_small_bush_cluster"]:
			roadside_v2_count += 1
		if item.asset in ["PRP_CITY_026_fallen_market_sign", "PRP_CITY_027_cloth_tarp_bundle", "PRP_CITY_028_scattered_box_debris", "PRP_CITY_029_broken_fence_section"]:
			aftermath_count += 1
		_check(not bool(item.collision), "Seed %d dressing stays non-blocking" % seed_value)
	_check(grouped_count >= 6, "Seed %d places new residential, commercial, and roadside groups" % seed_value)
	_check(residential_v2_count > 0, "Seed %d places new residential props" % seed_value)
	_check(commercial_v2_count > 0, "Seed %d places new commercial props" % seed_value)
	_check(roadside_v2_count > 0, "Seed %d places new roadside props" % seed_value)
	_check(aftermath_count > 0, "Seed %d gets restrained aftermath dressing" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_025_bus_stop_post", 0)) > 0, "Seed %d gets a new Arrival bus stop post" % seed_value)
	var arrival_point := Vector2(town.arrival.position.x, town.arrival.position.z)
	var has_arrival_structure := false
	for item: Dictionary in result.instances:
		if item.zone == "ARRIVAL" and item.asset.begins_with("PRP_CITY_"):
			if Vector2(item.position.x, item.position.z).distance_to(arrival_point) <= 20.0:
				has_arrival_structure = true
	_check(has_arrival_structure, "Seed %d has a new arrival-area detail" % seed_value)
	print("PHASE_3C seed=%d instances=%d v2=%d residential=%d commercial=%d roadside=%d after=%d zones=%s" % [seed_value, result.instances.size(), grouped_count, residential_v2_count, commercial_v2_count, roadside_v2_count, aftermath_count, str(result.by_zone)])

func _check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)

func _finish() -> void:
	print("TOWN PHASE 3C ACCEPTANCE: %d checks, %d failures" % [checks, failures.size()])
	for failure: String in failures:
		printerr(failure)
	quit(0 if failures.is_empty() else 1)
