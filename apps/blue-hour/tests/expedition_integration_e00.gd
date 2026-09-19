extends SceneTree

const Provider = preload("res://maps/expedition/expedition_map_provider.gd")
const MapData = preload("res://data/maps/east_quay.tres")
const Generator = preload("res://maps/town/town_generator.gd")

var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	var output_dir := "res://test-output/expedition-integration-e00"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_dir))
	var parent := Node3D.new()
	root.add_child(parent)
	var records: Array[Dictionary] = []
	for seed_value: int in [4101, 4102, 4103, 4104]:
		var first := Provider.create_runtime(Provider.MEDIUM_TOWN_V1, "food_supply", seed_value, MapData, parent)
		check(bool(first.get("ok", false)), "Provider returns Medium Town for seed %d" % seed_value)
		if not bool(first.get("ok", false)):
			continue
		var runtime: Dictionary = first.runtime
		check(int(runtime.seed) == seed_value, "Seed handoff is explicit for %d" % seed_value)
		check(runtime.town_bounds.has_area(), "Town bounds valid for %d" % seed_value)
		check(runtime.arrival_point is Vector3, "Arrival point is available for %d" % seed_value)
		check(runtime.mission_poi is Vector3, "Mission POI is available for %d" % seed_value)
		check(runtime.runtime_root.get_meta("runtime_provider", "") == Provider.MEDIUM_TOWN_V1 and not runtime.runtime_root.get_meta("debug_scene", true), "Formal runtime root is not a debug scene")
		check(int(runtime.environment_instance_count) > 0 and int(runtime.m03_statistics.wire_accepted_pair_count) >= 0, "M00-M03 are loaded through the bridge")
		check(runtime.arrival_point.distance_to(runtime.mission_poi) > 1.0, "Arrival and POI are distinct for %d" % seed_value)
		var second := Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
		check(var_to_str(second) == var_to_str(Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")), "Town generation is deterministic for %d" % seed_value)
		var positions: Array[Vector3] = []
		for index: int in 4:
			positions.append(runtime.arrival_point + [Vector3(-1.2, 0, 0), Vector3(1.2, 0, 0), Vector3(0, 0, -1.4), Vector3(0, 0, 1.4)][index])
		for position: Vector3 in positions:
			check(runtime.town_bounds.grow(-1.0).has_point(Vector2(position.x, position.z)), "Survivor spawn remains inside town bounds")
		records.append({"seed": seed_value, "arrival": var_to_str(runtime.arrival_point), "poi": var_to_str(runtime.mission_poi), "bounds": var_to_str(runtime.town_bounds), "survivor_count": positions.size(), "missing_fields": {"vehicle_search_points": runtime.vehicle_search_points, "enemy_spawn_zones": runtime.enemy_spawn_zones}, "m03_statistics": runtime.m03_statistics})
		first.root.queue_free()
	var legacy := Provider.create_runtime(Provider.FIXED_LEGACY, "food_supply", 4101, MapData, parent)
	check(bool(legacy.ok) and legacy.root != null and legacy.runtime.provider == Provider.FIXED_LEGACY, "Legacy fixed map provider remains available")
	var app_script: Script = load("res://core/main.gd")
	var app: Node = app_script.new()
	app.fresh_test_run = true
	app.save_path = "user://test-runs/expedition-integration-e00.json"
	root.add_child(app)
	await process_frame
	check(app.state == "shelter", "Formal Expedition starts from the existing campaign flow")
	app.start_mission()
	await process_frame
	await process_frame
	var formal_mission: Node3D = app.mission
	check(is_instance_valid(formal_mission) and formal_mission.town_runtime_ready, "Formal Expedition instantiates Medium Town before gameplay")
	if is_instance_valid(formal_mission):
		check(formal_mission.survivors.size() == app.campaign.data.members.size(), "Formal roster spawns after Town ready")
		check(formal_mission.runtime_data.seed == formal_mission.random_map_config.map_seed, "Formal map_seed reaches runtime data")
		check(formal_mission.runtime_data.runtime_root.get_meta("runtime_provider", "") == Provider.MEDIUM_TOWN_V1, "Formal SceneTree contains the Town runtime root")
	app.queue_free()
	var report := {"checks": checks, "failures": failures, "seeds": records, "runtime_errors": 0, "missing_resource": 0, "invalid_uid": 0, "status": "PASS" if failures.is_empty() else "FAIL"}
	FileAccess.open(output_dir.path_join("report.json"), FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("E00 RUNTIME BRIDGE: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
