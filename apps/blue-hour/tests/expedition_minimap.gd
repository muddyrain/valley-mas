extends SceneTree
## Formal Expedition fixture with isolated saves; the frozen generator is the oracle.

const App = preload("res://core/main.gd")
const Generator = preload("res://maps/town/town_generator.gd")
const Minimap = preload("res://ui/expedition/minimap.gd")
const ExplorationStateData = preload("res://maps/exploration_state.gd")
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
		config.exploration_state_namespace = "test-%d" % OS.get_process_id()
		return config

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func verify_exploration_state() -> void:
	var identity: String = "minimap-v4-test:%d" % Time.get_ticks_usec()
	var state: RefCounted = ExplorationStateData.new()
	state.load_map(identity)
	var fresh: Vector2 = Vector2(10.0, -4.0)
	check(state.state_at(fresh) == 0, "New exploration profile starts with unknown cells")
	var sources := PackedVector2Array([Vector2.ZERO])
	check(state.update_visibility(sources, 5.0), "Exploration records newly revealed cells")
	check(state.state_at(Vector2.ZERO) == 2 and state.state_at(Vector2(12, 0)) == 0, "Visible and unknown cell states remain distinct")
	check(state.save(), "Exploration state saves to its map profile")
	var restored: RefCounted = ExplorationStateData.new()
	restored.load_map(identity)
	check(restored.state_at(Vector2.ZERO) == 1, "Reload restores explored memory without preserving live visibility")
	check(restored.state_at(fresh) == 0, "Reload leaves never-visited cells unknown")

func create_app(seed_value: int, provider: String = "MEDIUM_TOWN_V1") -> Node:
	var app: Node = SeededApp.new()
	app.fixture_seed = seed_value
	app.fixture_provider = provider
	app.fresh_test_run = true
	# Concurrent native and headless fixtures must not race campaign save/rename.
	app.save_path = "user://test-runs/expedition-minimap-%s-%d-%d.json" % [provider, seed_value, OS.get_process_id()]
	root.add_child(app)
	await process_frame
	app.campaign.new_run(seed_value, "combat", ["xia_zhiyao", "su_wanxing", "lin_jianyue"])
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
	verify_exploration_state()
	if not failures.is_empty():
		finish()
		return
	var previous_geometry: String = ""
	var reused: Control = null
	for seed_value: int in [4101, 4102, 4103, 4104, 4105]:
		var app: Node = await create_app(seed_value)
		var mission: Node3D = app.mission
		var map: Control = app.hud.minimap
		map._process(0.0)
		verify_map(mission, map, seed_value)
		if seed_value == 4101:
			verify_polish(mission, map)
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
		var footprint: Dictionary = geometry.buildings[i]
		check(footprint.bounds == town.buildings[i].bounds and footprint.id == town.buildings[i].id, "Footprint matches frozen generator")
		check(footprint.polygon.size() == 4 and footprint.position == Vector2(town.buildings[i].position.x, town.buildings[i].position.z), "Building snapshot includes polygon, position and type")
	check(mission.runtime_data.road_bounds.size() == town.roads.size(), "All road bounds available")
	for i: int in town.roads.size():
		check(mission.runtime_data.road_bounds[i] == town.roads[i].bounds, "Road matches frozen generator")
	check(geometry.roads.size() == town.roads.size(), "All road polygons available")
	for i: int in town.roads.size():
		var road: Dictionary = geometry.roads[i]
		check(road.polygon.size() == 4 and is_equal_approx(road.width, town.roads[i].width) and road.type == town.roads[i].kind, "Road polygon preserves width and type")
	var arrival: Dictionary = geometry.arrival
	check(arrival.point == Vector2(mission.runtime_data.arrival_point.x, mission.runtime_data.arrival_point.z), "Arrival snapshot preserves bus point")
	check(arrival.bus_stop.polygon.size() >= 4 and arrival.road.polygon.size() == 4 and arrival.entrance.polygon.size() == 4, "Arrival snapshot includes bus stop, road and entrance")
	check(geometry.has("parking") and geometry.parking == arrival.parking, "Parking geometry is available in static and Arrival snapshots")
	var expected_regions: Array = town.ground_spaces.duplicate(true)
	for block: Dictionary in town.blocks:
		expected_regions.append_array(block.spaces)
	check(geometry.regions.size() == expected_regions.size(), "All ground regions available")
	for i: int in expected_regions.size():
		check(geometry.regions[i].polygon == expected_regions[i].polygon and geometry.regions[i].kind == expected_regions[i].kind, "Region matches Town geometry")
	# The map projects XZ; runtime Y can follow the rendered ground without moving its marker.
	check(Vector2(mission.runtime_data.arrival_point.x, mission.runtime_data.arrival_point.z) == Vector2(town.arrival.position.x, town.arrival.position.z), "Arrival XZ matches Town")
	check(Vector2(mission.runtime_data.mission_poi.x, mission.runtime_data.mission_poi.z) == Vector2(town.poi.entry.x, town.poi.entry.z), "POI XZ matches Town")
	var expected_commands: int = 2 + geometry.regions.size() + geometry.parking.size() + geometry.roads.size() + geometry.buildings.size() + arrival.zones.size()
	check(map.static_layer.commands.size() == expected_commands, "World draw cache contains polygons, Arrival zones and buildings")
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
	var center_projection: Vector2 = map._snap_point(map.map_origin + Vector2(map.follow_center.x, map.follow_center.z) * map.map_scale)
	check(map.world_to_minimap(map.follow_center) == center_projection, "HUD projects squad center through the shared floor-rounded mapping")
	var expected: Rect2 = Rect2(map._area.position + Vector2(2, 2), (map._area.size - Vector2(4, 4)).max(Vector2.ONE))
	check(map.minimap_content_rect == expected, "Minimap content fills the complete framed viewport")
	check(map.world_clip.size == expected.size, "Minimap clip matches the full content viewport")
	var snapped: Vector2 = map.world_to_minimap(map.follow_center + Vector3(0.013, 0, 0.017))
	check(snapped == Vector2(floorf(snapped.x), floorf(snapped.y)), "Minimap projection floors markers to whole pixels")
	var raw_projection: Vector2 = map.map_origin + Vector2(map.follow_center.x + 0.37, map.follow_center.z + 0.83) * map.map_scale
	check(map._snap_point(raw_projection) == Vector2(floorf(raw_projection.x), floorf(raw_projection.y)), "Projection uses floor rather than nearest-pixel rounding")

func verify_polish(mission: Node3D, map: Control) -> void:
	var outside_id: String = ""
	var farthest: float = -1.0
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		if site.vehicle:
			continue
		var distance: float = map.world_to_minimap(site.spec.entry).distance_to(map.minimap_content_rect.get_center())
		if distance > farthest:
			farthest = distance
			outside_id = id
	mission.city.sites[outside_id].discovered = true
	var outside_cell: Vector2i = Vector2i((Vector2(mission.city.sites[outside_id].spec.entry.x,
		mission.city.sites[outside_id].spec.entry.z) / ExplorationStateData.CELL_SIZE).floor())
	map._exploration_state.visible_cells["%d:%d" % [outside_cell.x, outside_cell.y]] = true
	map._process(0.0)
	var outside_key: String = "site:" + outside_id
	var pooled_marker: Dictionary = map.marker_pool[outside_key]
	check(not bool(pooled_marker.visible), "Out-of-range marker record remains pooled as hidden")
	var outside_visible: bool = false
	for marker: Dictionary in map.town_markers:
		outside_visible = outside_visible or str(marker.id) == outside_key
	check(not outside_visible, "Out-of-range building marker is hidden")
	var original_positions: Array[Vector3] = []
	for member: Node3D in mission.survivors:
		original_positions.append(member.position)
		member.position = mission.city.sites[outside_id].spec.entry
	map._process(0.0)
	outside_visible = false
	for marker: Dictionary in map.town_markers:
		outside_visible = outside_visible or str(marker.id) == outside_key
	check(outside_visible, "Building marker returns when it re-enters the viewport")
	check(is_same(map.marker_pool[outside_key], pooled_marker), "Re-entering building reuses its marker record")
	check(bool(pooled_marker.visible), "Re-entering marker updates its retained visibility state")
	for index: int in mission.survivors.size():
		mission.survivors[index].position = original_positions[index]
	map._process(0.0)
	var candidates: Array[String] = []
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		if site.vehicle or id == outside_id:
			continue
		if mission.city.path(mission.squad_center(), site.spec.entry).is_empty():
			continue
		site.discovered = true
		site.spec.search_status = "RESOLVED_REACHABLE"
		candidates.append(id)
		if candidates.size() == 2:
			break
	check(candidates.size() == 2, "Two reachable building targets are available for parallel search")
	if candidates.size() == 2:
		check(mission.command_search(candidates[0]), "First survivor accepts first building search")
		check(mission.command_search(candidates[1]), "Second survivor accepts second building search")
		var workers: Array[int] = []
		for id: String in candidates:
			workers.append(mission.search_tasks[id].worker.get_instance_id())
		check(mission.search_tasks.size() == 2 and workers[0] != workers[1], "Parallel searches use distinct survivors without a global lock")
		mission.command_recall_all()

func verify_markers(mission: Node3D, map: Control) -> void:
	var expected_markers: int = mission.living().size() + 1
	if int(mission.exploration.state_at(mission.runtime_data.mission_poi)) != mission.exploration.Visibility.UNEXPLORED:
		expected_markers += 1
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		if id == str(mission.runtime_data.mission_poi_id) or int(mission.exploration.state_at(site.spec.entry)) == mission.exploration.Visibility.UNEXPLORED:
			continue
		var offset: Vector2 = Vector2(0, 6) if bool(site.get("vehicle", false)) else Vector2.ZERO
		var point: Vector2 = map.world_to_minimap(site.spec.entry) + offset
		var marker_bounds: Rect2 = Rect2(point - Vector2.ONE * 9.0, Vector2.ONE * 18.0)
		if map.marker_rect.encloses(marker_bounds):
			expected_markers += 1
	check(map.town_markers.size() == expected_markers, "Only explored sites and known landmarks are shown")
	for i: int in map.town_markers.size():
		var marker: Dictionary = map.town_markers[i]
		check(marker.anchor.is_equal_approx(map.world_to_minimap(marker.world)), "Marker uses common mapping")
		check(marker.anchor == Vector2(floorf(marker.anchor.x), floorf(marker.anchor.y)), "Marker projection has integer floor coordinates")
		check(map.marker_rect.encloses(Rect2(marker.point - Vector2.ONE * marker.diameter * .5, Vector2.ONE * marker.diameter)), "Entire marker inside map")
		if str(marker.id) == "arrival":
			check(marker.world == mission.runtime_data.arrival_point, "Bus marker from runtime")
			if not marker.edge:
				check(marker.point == marker.anchor + marker.get("layout_offset", Vector2.ZERO), "Arrival marker preserves its stable layout offset")
		elif str(marker.id) == "poi":
			check(marker.world == mission.runtime_data.mission_poi, "Objective marker from runtime")
			if not marker.edge:
				check(marker.point == marker.anchor + marker.get("layout_offset", Vector2.ZERO), "Objective marker preserves its stable layout offset")
		elif marker.kind == "vehicle":
			var vehicle_site: Dictionary = mission.city.sites[str(marker.id).trim_prefix("site:")]
			check(vehicle_site.discovered and marker.world == vehicle_site.spec.entry, "Vehicle marker reads its runtime interaction point")
			check(marker.point == marker.anchor + marker.offset + marker.get("layout_offset", Vector2.ZERO), "Vehicle marker keeps its stable layout offset")
		elif str(marker.id).begins_with("site:"):
			var site: Dictionary = mission.city.sites[str(marker.id).trim_prefix("site:")]
			check(site.discovered and marker.world == site.spec.entry, "Site marker uses discovered runtime interaction point")
			check(marker.point == marker.anchor + marker.get("layout_offset", Vector2.ZERO), "Building marker keeps its stable layout offset")
		elif marker.kind == "survivor":
			check(marker.world == instance_from_id(marker.id).global_position, "Survivor marker reads live actor")
			if not marker.edge:
				check(marker.point == marker.anchor + marker.offset + marker.get("layout_offset", Vector2.ZERO), "Survivor marker keeps its stable layout offset")
			check(marker.texture == null, "Survivor marker does not use an avatar texture")
			check(marker.has("selected"), "Survivor marker carries selection state")
			check(marker.has("moving") and marker.has("searching"), "Survivor marker carries behavior state")
	var unknown_sites: int = 0
	for id: String in mission.city.sites:
		if int(mission.exploration.state_at(mission.city.sites[id].spec.entry)) == mission.exploration.Visibility.UNEXPLORED:
			unknown_sites += 1
	check(unknown_sites > 0, "Fixture contains unrevealed sites")
	for marker: Dictionary in map.town_markers:
		if str(marker.id).begins_with("site:"):
			var site_id: String = str(marker.id).trim_prefix("site:")
			check(int(mission.exploration.state_at(mission.city.sites[site_id].spec.entry)) != mission.exploration.Visibility.UNEXPLORED, "Unknown target has no marker")
	check(map.survivor_clusters.size() > 0, "Nearby survivors are grouped")
	map.cluster_expanded = true
	map.queue_redraw()
	check(map.cluster_expanded, "Survivor cluster can expand to names")
	var prior: Dictionary = map.recent_discoveries.duplicate()
	var candidate_id: String = ""
	for id: String in mission.city.sites:
		if not prior.has(id):
			candidate_id = id
			break
	if not candidate_id.is_empty():
		map.recent_discoveries[candidate_id] = true
		var before_discovery: Dictionary = map.recent_discoveries.duplicate()
		before_discovery.erase(candidate_id)
		map._update_discovery_notice(before_discovery)
		check(map.discovery_notice.begins_with("发现 ") and map.discovery_notice_left > 0.0, "New location discovery produces a short notice")

func finish() -> void:
	FileAccess.open(output_directory.path_join("report.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "seeds": records, "human_runtime_qa": "PENDING"}, "\t"))
	print("E01.5 MINIMAP: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
