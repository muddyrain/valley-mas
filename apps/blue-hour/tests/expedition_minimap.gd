extends SceneTree
## Formal Expedition fixture with isolated saves; the frozen generator is the oracle.

const App = preload("res://core/main.gd")
const Generator = preload("res://maps/town/town_generator.gd")
const Minimap = preload("res://ui/expedition/minimap.gd")
const OUT: String = "res://test-output/expedition-integration-e01-5"
var failures: Array[String] = []
var checks: int = 0
var records: Array[Dictionary] = []
var output_directory: String = OUT

class SeededApp extends App:
	var fixture_seed: int = 4101
	var fixture_provider: String = "MEDIUM_TOWN_V1"
	func _mission_config(action_id: String) -> Dictionary:
		var config: Dictionary = super._mission_config(action_id)
		config.map_seed = fixture_seed
		config.seed = fixture_seed
		config.map_provider = fixture_provider
		return config

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func create_app(seed_value: int, provider: String = "MEDIUM_TOWN_V1") -> Node:
	var app: Node = SeededApp.new()
	app.fixture_seed = seed_value
	app.fixture_provider = provider
	app.fresh_test_run = true
	# Concurrent native and headless fixtures must not race campaign save/rename.
	app.save_path = "user://test-runs/expedition-minimap-%s-%d-%d.json" % [provider, seed_value, OS.get_process_id()]
	root.add_child(app)
	await process_frame
	app.campaign.new_run(seed_value, "combat", ["xia_zhiyao", "su_wanxing", "lin"])
	app.random_mission_counter = 0
	app.start_mission()
	app.mission.set_physics_process(false)
	app.mission.set_process(false)
	await process_frame
	await physics_frame
	return app

func run() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--output-dir="):
			output_directory = argument.trim_prefix("--output-dir=")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_directory))
	var probe: Control = Minimap.new()
	check(probe.has_method("world_to_minimap"), "Minimap exposes the common runtime projection")
	probe.free()
	if not failures.is_empty():
		finish()
		return
	var previous_geometry: String = ""
	var reused: Control = null
	for seed_value: int in [4101, 4102, 4103, 4104]:
		var app: Node = await create_app(seed_value)
		var mission: Node3D = app.mission
		var map: Control = app.hud.minimap
		map._process(0.0)
		verify_map(mission, map, seed_value)
		var geometry: String = var_to_str(mission.runtime_data.minimap_geometry).sha256_text()
		check(geometry != previous_geometry, "Seed %d has its own geometry" % seed_value)
		previous_geometry = geometry
		if reused == null:
			reused = Minimap.new()
			reused.hide()
			reused.size = map.size
			root.add_child(reused)
			reused.setup(mission)
		else:
			var before: int = reused.static_build_count
			reused.mission = mission
			reused._process(0.0)
			check(reused.static_build_count == before + 1, "Reused map rebuilds on seed switch")
		check(reused.cached_source == map.cached_source, "Reused map has no stale seed")
		check(reused.static_layer.commands == map.static_layer.commands, "Reused static geometry matches fresh map")
		var anchor: Vector2 = map.world_to_minimap(mission.runtime_data.arrival_point)
		mission.camera_center += Vector3(35, 0, 42)
		mission.camera_controller.apply()
		map._process(0.0)
		check(map.world_to_minimap(mission.runtime_data.arrival_point) == anchor, "Projection independent of camera")
		var builds: int = map.static_build_count
		var started: int = Time.get_ticks_usec()
		for tick: int in 200:
			map._process(1.0 / 60.0)
		var update_usec: float = (Time.get_ticks_usec() - started) / 200.0
		check(map.static_build_count == builds, "Frame updates preserve static cache")
		check(mission.command_move(mission.runtime_data.mission_poi), "Production move order accepted")
		for tick: int in 120:
			mission._physics_process(1.0 / 30.0)
		map._process(0.0)
		check(map.world_to_minimap(mission.runtime_data.arrival_point).distance_to(anchor) > 1.0, "Real movement scrolls world around squad")
		verify_markers(mission, map)
		var normal_size: Vector2 = map.size
		map.size = Vector2(480, 220)
		map._process(0.0)
		verify_projection(map)
		check(map.static_build_count == builds, "Resize changes transform without rebuilding world geometry")
		map.size = normal_size
		map._process(0.0)
		records.append({"seed": seed_value, "source": map.cached_source, "geometry_sha256": geometry, "bounds": var_to_str(map.town_bounds), "scale": map.map_scale, "build_ms": map.static_build_ms, "geometry_count": map.static_layer.commands.size(), "update_mean_usec": update_usec, "extra_textures": 0, "extra_viewports": 0})
		reused.mission = null
		app.queue_free()
		await process_frame
	var legacy: Node = await create_app(4101, "FIXED_LEGACY")
	reused.mission = legacy.mission
	reused._process(0.0)
	check(not reused.static_layer.visible and not reused.uses_town_runtime(), "Legacy hides cached Town layer")
	check(not legacy.mission.city.data.road_segments.is_empty(), "Legacy retains original world data")
	reused.queue_free()
	legacy.queue_free()
	await process_frame
	finish()

func verify_map(mission: Node3D, map: Control, seed_value: int) -> void:
	var town: Dictionary = Generator.generate(mission.mission_type, seed_value, "PROFILE_A_MAIN_STREET")
	var geometry: Dictionary = mission.runtime_data.minimap_geometry
	check(map.uses_town_runtime(), "Runtime provider selected")
	check(map.town_bounds == town.bounds, "Bounds are actual Town bounds")
	check(geometry.buildings.size() == town.buildings.size() and not geometry.buildings.is_empty(), "All building footprints available")
	for i: int in town.buildings.size():
		check(geometry.buildings[i].bounds == town.buildings[i].bounds and geometry.buildings[i].id == town.buildings[i].id, "Footprint matches frozen generator")
	check(mission.runtime_data.road_bounds.size() == town.roads.size(), "All road bounds available")
	for i: int in town.roads.size():
		check(mission.runtime_data.road_bounds[i] == town.roads[i].bounds, "Road matches frozen generator")
	var expected_regions: Array = town.ground_spaces.duplicate(true)
	for block: Dictionary in town.blocks:
		expected_regions.append_array(block.spaces)
	check(geometry.regions.size() == expected_regions.size(), "All ground regions available")
	for i: int in expected_regions.size():
		check(geometry.regions[i].polygon == expected_regions[i].polygon and geometry.regions[i].kind == expected_regions[i].kind, "Region matches Town geometry")
	# The map projects XZ; runtime Y can follow the rendered ground without moving its marker.
	check(Vector2(mission.runtime_data.arrival_point.x, mission.runtime_data.arrival_point.z) == Vector2(town.arrival.position.x, town.arrival.position.z), "Arrival XZ matches Town")
	check(Vector2(mission.runtime_data.mission_poi.x, mission.runtime_data.mission_poi.z) == Vector2(town.poi.entry.x, town.poi.entry.z), "POI XZ matches Town")
	check(map.static_layer.commands.size() == 2 + geometry.regions.size() + town.roads.size() + town.buildings.size(), "World draw cache contains bounds, regions, roads, buildings")
	verify_projection(map)
	verify_markers(mission, map)

func verify_projection(map: Control) -> void:
	var bounds: Rect2 = map.town_bounds
	var origin: Vector3 = Vector3(bounds.position.x, 0, bounds.position.y)
	var end: Vector3 = Vector3(bounds.end.x, 0, bounds.end.y)
	var a: Vector2 = map.world_to_overview(origin, map.minimap_content_rect)
	var b: Vector2 = map.world_to_overview(end, map.minimap_content_rect)
	check(map.minimap_content_rect.grow(.01).encloses(Rect2(a, b - a)), "Town fits padded content rect")
	check(is_equal_approx((b.x - a.x) / bounds.size.x, (b.y - a.y) / bounds.size.y), "Aspect ratio preserved")
	check(map.world_to_overview(origin, map.minimap_content_rect) == a, "Overview projection deterministic")
	check(a.distance_to(map.world_to_overview(origin + Vector3.RIGHT, map.minimap_content_rect)) > 0, "Positive overview scale")
	check(map.world_to_minimap(map.follow_center).is_equal_approx(map.minimap_content_rect.get_center()), "HUD projects squad center to local center")

func verify_markers(mission: Node3D, map: Control) -> void:
	var discovered: int = 0
	for id: String in mission.city.sites:
		if mission.city.sites[id].discovered and id != str(mission.runtime_data.mission_poi_id):
			discovered += 1
	check(map.town_markers.size() == mission.living().size() + 2 + discovered, "All survivors, Arrival, POI and discovered sites visible")
	for i: int in map.town_markers.size():
		var marker: Dictionary = map.town_markers[i]
		check(marker.anchor.is_equal_approx(map.world_to_minimap(marker.world)), "Marker uses common mapping")
		check(map.marker_rect.encloses(Rect2(marker.point - Vector2.ONE * marker.diameter * .5, Vector2.ONE * marker.diameter)), "Entire marker inside map")
		if str(marker.id) == "arrival":
			check(marker.world == mission.runtime_data.arrival_point, "Bus marker from runtime")
		elif str(marker.id) == "poi":
			check(marker.world == mission.runtime_data.mission_poi, "Objective marker from runtime")
		elif str(marker.id).begins_with("site:"):
			var site: Dictionary = mission.city.sites[str(marker.id).trim_prefix("site:")]
			check(site.discovered and marker.world == site.spec.entry, "Site marker uses discovered runtime interaction point")
		else:
			check(marker.world == instance_from_id(marker.id).global_position, "Survivor marker reads live actor")
		for j: int in range(i):
			var other: Dictionary = map.town_markers[j]
			check(marker.point.distance_to(other.point) >= (marker.diameter + other.diameter) * .5 + 1.9, "Markers remain distinguishable")

func finish() -> void:
	FileAccess.open(output_directory.path_join("report.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "seeds": records, "human_runtime_qa": "PENDING"}, "\t"))
	print("E01.5 MINIMAP: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
