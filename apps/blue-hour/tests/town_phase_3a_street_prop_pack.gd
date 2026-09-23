extends SceneTree
## Phase 3A acceptance: asset import, seed determinism, zone policy, and arrival dressing.

const Generator = preload("res://maps/town/town_generator.gd")
const Dressing = preload("res://maps/town/environment/town_urban_dressing_layer.gd")
const Catalog = preload("res://data/world_asset_catalog.gd")
const IDS: Array[String] = [
	"PRP_STREET_001_trash_bin", "PRP_STREET_002_mailbox", "PRP_STREET_003_street_lamp_b", "PRP_STREET_004_traffic_cone", "PRP_STREET_005_road_barrier", "PRP_STREET_006_bus_stop_sign", "PRP_STREET_007_bench", "PRP_STREET_008_vending_machine",
	"PRP_HOUSE_001_bicycle", "PRP_HOUSE_002_flower_pot_set", "PRP_HOUSE_003_laundry_rack", "PRP_HOUSE_004_patio_table_set", "PRP_HOUSE_005_wood_fence_segment", "PRP_HOUSE_006_package_box_set",
	"PRP_RUIN_001_garbage_bag_pile", "PRP_RUIN_002_fallen_bicycle", "PRP_RUIN_003_broken_sign", "PRP_RUIN_004_tire_stack",
	"PRP_CITY_001_shop_sign", "PRP_CITY_002_ac_unit", "PRP_CITY_003_power_pole", "PRP_CITY_004_power_wire_set", "PRP_CITY_005_traffic_light", "PRP_CITY_006_bus_shelter", "PRP_CITY_007_awning", "PRP_CITY_008_cardboard_stack", "PRP_CITY_009_fire_hydrant", "PRP_CITY_010_broken_billboard"
]
const SEEDS: Array[int] = [4101, 4102, 4103, 4104, 4105]
const OUTPUT := "res://test-output/town-phase-3a"

var checks := 0
var failures: Array[String] = []
var records: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	for asset_id: String in IDS:
		var pack := "city_props_v1" if asset_id.begins_with("PRP_CITY_") else "street_prop_pack_v1"
		var path := "res://assets/world/props/%s/%s.glb" % [pack, asset_id]
		_check(FileAccess.file_exists(path), "GLB exists: " + asset_id)
		var scene := load(path) as PackedScene
		_check(scene != null, "GLB imports: " + asset_id)
		var definition: Resource = Catalog.asset(asset_id)
		_check(definition != null and definition.scene != null, "Catalog entry: " + asset_id)
		if definition != null and definition.scene != null:
			var instance: Node = definition.scene.instantiate()
			_check(instance != null, "Scene instantiates: " + asset_id)
			instance.free()
	for seed_value: int in SEEDS:
		_audit_seed(seed_value)
	FileAccess.open(OUTPUT.path_join("acceptance-report.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "assets": IDS, "seeds": records, "blender_available": true, "blender_version": "5.2.1 LTS"}, "\t"))
	print("TOWN PHASE 3A ACCEPTANCE: %d checks, %d failures" % [checks, failures.size()])
	for failure: String in failures:
		printerr(failure)
	quit(0 if failures.is_empty() else 1)

func _audit_seed(seed_value: int) -> void:
	var town: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	_check(bool(town.get("ok", false)), "Seed %d generates town" % seed_value)
	if not bool(town.get("ok", false)):
		return
	var before := var_to_str(town)
	var result: Dictionary = Dressing.new().generate(town)
	var repeat: Dictionary = Dressing.new().generate(town)
	_check(before == var_to_str(town), "Seed %d town remains unchanged" % seed_value)
	_check(var_to_str(result) == var_to_str(repeat), "Seed %d dressing is deterministic" % seed_value)
	_check(result.instances.size() <= Dressing.MAX_PROPS, "Seed %d respects total prop cap" % seed_value)
	_check(int(result.by_zone.get("RESIDENTIAL", 0)) > 0, "Seed %d has residential dressing" % seed_value)
	_check(int(result.by_zone.get("COMMERCIAL", 0)) > 0, "Seed %d has commercial dressing" % seed_value)
	_check(int(result.by_zone.get("INDUSTRIAL", 0)) > 0, "Seed %d has industrial dressing" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_003_power_pole", 0)) > 0, "Seed %d has road power poles" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_004_power_wire_set", 0)) > 0, "Seed %d has overhead wires" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_001_shop_sign", 0)) > 0, "Seed %d has commercial signage" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_002_ac_unit", 0)) > 0, "Seed %d has residential wall equipment" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_005_traffic_light", 0)) > 0, "Seed %d has intersection signals" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_006_bus_shelter", 0)) > 0, "Seed %d has a bus shelter" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_007_awning", 0)) > 0, "Seed %d has commercial awnings" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_008_cardboard_stack", 0)) > 0, "Seed %d has industrial cartons" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_009_fire_hydrant", 0)) > 0, "Seed %d has road hydrants" % seed_value)
	_check(int(result.by_asset.get("PRP_CITY_010_broken_billboard", 0)) > 0, "Seed %d has industrial signage" % seed_value)
	var arrival: Array = result.instances.filter(func(item: Dictionary) -> bool: return item.zone == "ARRIVAL")
	var arrival_point := Vector2(town.arrival.position.x, town.arrival.position.z)
	_check(arrival.size() >= 5, "Seed %d has arrival dressing" % seed_value)
	_check(arrival.filter(func(item: Dictionary) -> bool: return item.asset == "PRP_STREET_003_street_lamp_b").size() >= 2, "Seed %d has two arrival lamps" % seed_value)
	_check(arrival.any(func(item: Dictionary) -> bool: return item.asset == "PRP_STREET_001_trash_bin"), "Seed %d has arrival trash bin" % seed_value)
	_check(arrival.any(func(item: Dictionary) -> bool: return item.asset == "PRP_STREET_007_bench"), "Seed %d has arrival bench" % seed_value)
	for item: Dictionary in arrival:
		_check(Vector2(item.position.x, item.position.z).distance_to(arrival_point) <= 20.0, "Seed %d arrival prop within radius" % seed_value)
	for item: Dictionary in result.instances:
		if not bool(item.get("allow_road_overlap", false)):
			for road: Dictionary in town.roads:
				_check(not item.bounds.intersects(road.bounds), "Seed %d ground prop clears roads" % seed_value)
		if not bool(item.get("overhead", false)):
			for site: Dictionary in town.buildings:
				if site.id == item.get("mount_site", ""):
					continue
				_check(not item.bounds.intersects(site.bounds.grow(0.18)), "Seed %d prop clears non-host buildings" % seed_value)
	print("PHASE_3A seed=%d instances=%d zones=%s arrival=%d" % [seed_value, result.instances.size(), str(result.by_zone), arrival.size()])
	records.append({"seed": seed_value, "instances": result.instances.size(), "by_zone": result.by_zone, "by_asset": result.by_asset, "arrival": arrival.size(), "signature": var_to_str(result).sha256_text()})

func _check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
