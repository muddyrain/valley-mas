extends "res://maps/city.gd"
## Read-only Town source with collision-derived Expedition navigation.

signal navigation_ready

const TownNavigation = preload("res://maps/expedition/town_navigation.gd")

const TownGenerator = preload("res://maps/town/town_generator.gd")
const UrbanView = preload("res://maps/town/town_urban_view.gd")
const PolishView = preload("res://maps/town/environment/town_polish_view.gd")
const Targeted = preload("res://maps/town/environment/town_targeted_props.gd")
const RoadsidePass = preload("res://maps/town/environment/town_roadside_visual_pass.gd")
const RoadsideView = preload("res://maps/town/environment/town_roadside_view.gd")
const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const WorldCatalog = preload("res://data/world_asset_catalog.gd")
const NOT_AVAILABLE_YET: String = "NOT_AVAILABLE_YET"
const SPAWN_CLEARANCE: float = 0.5

var runtime_data: Dictionary = {}
var spawn_blockers: Array[Rect2] = []
var navigation: RefCounted = TownNavigation.new()
var lifecycle: Array[String] = []
var navigation_targets: Dictionary = {}
var residential_bounds: Rect2
var load_profile: RefCounted
var runtime_started_usec: int = 0

func build_runtime(mission_type: String, map_seed: int, base_map: Resource) -> bool:
	runtime_started_usec = Time.get_ticks_usec()
	var town: Dictionary = _generate_town(mission_type, map_seed)
	if not bool(town.get("ok", false)):
		return false
	var environment: Dictionary = _generate_environment(town)
	_instantiate_town(town)
	var environment_root := _instantiate_environment(town, environment)
	_finish_runtime(town, environment.data, environment.roadside, environment_root, map_seed, base_map)
	return true

func build_runtime_staged(mission_type: String, map_seed: int, base_map: Resource, profile: RefCounted) -> bool:
	runtime_started_usec = Time.get_ticks_usec()
	load_profile = profile
	var town: Dictionary = _generate_town(mission_type, map_seed)
	if not bool(town.get("ok", false)):
		return false
	await _loading_frame()
	var environment: Dictionary = _generate_environment(town)
	await _loading_frame()
	_instantiate_town(town)
	await _loading_frame()
	var environment_root := _instantiate_environment(town, environment)
	await _loading_frame()
	_finish_runtime(town, environment.data, environment.roadside, environment_root, map_seed, base_map)
	return true

func _loading_frame() -> void:
	await get_tree().process_frame
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw

func _generate_town(mission_type: String, map_seed: int) -> Dictionary:
	var started: int = Time.get_ticks_usec()
	var town: Dictionary = TownGenerator.generate(mission_type, map_seed, "PROFILE_A_MAIN_STREET")
	if load_profile != null:
		load_profile.measure("town_generate", started)
	return town

func _generate_environment(town: Dictionary) -> Dictionary:
	var started := Time.get_ticks_usec()
	var environment_data: Dictionary = Targeted.new().generate(town)
	var roadside: Dictionary = RoadsidePass.new().generate(town, environment_data)
	if load_profile != null:
		load_profile.measure("environment_generate", started)
	return {"data": environment_data, "roadside": roadside}

func _instantiate_town(town: Dictionary) -> void:
	var started := Time.get_ticks_usec()
	UrbanView.build(self, town)
	if load_profile != null:
		load_profile.measure("building_instance", started)

func _instantiate_environment(town: Dictionary, environment: Dictionary) -> Node3D:
	var started := Time.get_ticks_usec()
	var environment_root: Node3D = PolishView.build(self, environment.data)
	RoadsideView.build(self, town, environment.roadside)
	if load_profile != null:
		load_profile.measure("environment_placement", started)
	return environment_root

func _finish_runtime(town: Dictionary, environment_data: Dictionary, roadside: Dictionary, environment_root: Node3D, map_seed: int, base_map: Resource) -> void:
	var started := Time.get_ticks_usec()
	navigation.ground.build(self)
	bus_root = get_node("BusArrival")
	bus_door = bus_root.get_node("DoorMotion")
	var arrival_point: Vector3 = project_to_ground(town.arrival.position)
	var arrival_forward := Vector3.BACK.rotated(Vector3.UP, float(town.arrival.yaw))
	var bounds: Rect2 = town.bounds
	var entries: Array[Dictionary] = []
	var search_points: Array[Dictionary] = []
	for site: Dictionary in town.buildings:
		entries.append({"id": site.id, "position": project_to_ground(site.entry), "asset": site.asset})
		var wrapper: Node3D = get_node("Buildings/" + str(site.id))
		_measure_blocker(wrapper)
		if bool(site.searchable):
			search_points.append({"id": site.id, "position": project_to_ground(site.entry)})
	for wrapper: Node in environment_root.get_children():
		if wrapper is Node3D and wrapper.has_meta("environment_slot"):
			_measure_blocker(wrapper)
	_measure_blocker(bus_root)
	var road_bounds: Array[Rect2] = []
	for road: Dictionary in town.roads:
		road_bounds.append(road.bounds)
	var poi_definition: Resource = WorldCatalog.asset(town.poi.asset)
	runtime_data = {"provider": "MEDIUM_TOWN_V1", "seed": map_seed, "town_bounds": bounds, "arrival_point": arrival_point, "arrival_forward": arrival_forward, "arrival_exit": bus_root.get_node("VehicleExitPoint").global_position, "mission_poi": project_to_ground(town.poi.entry), "mission_poi_id": town.poi.id, "mission_poi_type": poi_definition.poi_type if not poi_definition.poi_type.is_empty() else poi_definition.category, "extraction_point": project_to_ground(town.extraction.position), "building_entries": entries, "building_search_points": search_points, "vehicle_search_points": NOT_AVAILABLE_YET, "enemy_spawn_zones": NOT_AVAILABLE_YET, "road_bounds": road_bounds, "walkable_hint_bounds": road_bounds, "environment_root": environment_root, "runtime_root": self, "world_root": self, "navigation_available": false, "gameplay_available": false, "movement_status": "MOVEMENT BLOCKED BY E01 NAVIGATION INTEGRATION", "source_signatures": {"town": var_to_str(town).sha256_text(), "m02": var_to_str(environment_data).sha256_text(), "m03": var_to_str(roadside).sha256_text()}, "m03_statistics": roadside.statistics, "environment_instance_count": environment_data.instances.size()}
	get_node("MissionPOI").position = runtime_data.mission_poi
	get_node("BusArrivalPoint").position = arrival_point
	data = base_map.duplicate(true)
	# Read-only HUD snapshot of the generated geometry; navigation and Town stay untouched.
	var minimap_buildings: Array[Dictionary] = []
	for site: Dictionary in town.buildings:
		minimap_buildings.append({"id": site.id, "bounds": site.bounds})
	var minimap_regions: Array[Dictionary] = []
	for space: Dictionary in town.ground_spaces:
		minimap_regions.append({"kind": space.kind, "polygon": space.polygon.duplicate()})
	for block: Dictionary in town.blocks:
		for space: Dictionary in block.spaces:
			minimap_regions.append({"kind": space.kind, "polygon": space.polygon.duplicate()})
	runtime_data["minimap_geometry"] = {"buildings": minimap_buildings, "regions": minimap_regions}
	data.id = "medium_town"
	data.display_name = "Medium Town V1"
	data.base_seed = map_seed
	data.bus_position = arrival_point
	data.half_width = ceili(maxf(absf(bounds.position.x), absf(bounds.end.x)))
	data.half_depth = ceili(maxf(absf(bounds.position.y), absf(bounds.end.y)))
	for field: String in ["road_segments", "districts", "plots", "frontage_blocks", "parking_placements", "parking_areas", "props", "vegetation", "buildings", "vehicles"]:
		data.get(field).clear()
	_build_input_surface(bounds)
	marker = HudMarker.create(self, "world_move_marker", 1.05, arrival_point)
	marker.hide()
	var return_zone := HudMarker.create(self, "world_select_ring", 8.0, arrival_point + Vector3.UP * TownNavigation.Ground.MARKER_CLEARANCE, true)
	return_zone.name = "ReturnZone"
	return_zone.material_override.albedo_color = Color("#f4d397")
	var bus_marker := HudMarker.create(self, "icon_return", .85, arrival_point + Vector3.UP * 3.1)
	bus_marker.name = "BusMarker"
	bus_label = Visuals.label(self, "归航巴士", arrival_point + Vector3(0, 2.4, 0), Color("#ffe1a5"), 22)
	bus_label.pixel_size = .022
	bus_label.outline_size = 2
	bus_light = OmniLight3D.new()
	bus_light.position = arrival_point + Vector3.UP * 3.5
	bus_light.light_energy = 0.0
	add_child(bus_light)
	runtime_data["town_generation_ms"] = (Time.get_ticks_usec() - runtime_started_usec) / 1000.0
	lifecycle.append("town_runtime_ready")
	for block: Dictionary in town.blocks:
		var target: Vector2 = block.bounds.get_center()
		if block.land_use_type == "OPEN_SPACE" and not navigation_targets.has("park"):
			navigation_targets["park"] = project_to_ground(Vector3(target.x, 0, target.y))
		if str(block.land_use_type).begins_with("RESIDENTIAL") and not navigation_targets.has("residential"):
			navigation_targets["residential"] = project_to_ground(Vector3(target.x, 0, target.y))
			residential_bounds = block.bounds.grow(-4.0)
		if block.land_use_type == "COMMERCIAL_CORE" and not navigation_targets.has("commercial"):
			for site: Dictionary in town.buildings:
				if site.land_use_type == "COMMERCIAL_CORE":
					navigation_targets["commercial"] = project_to_ground(site.road_point)
					break
	_build_navigation.call_deferred()
	if load_profile != null:
		load_profile.measure("town_runtime_bind", started)

func _build_navigation() -> void:
	var started: int = Time.get_ticks_usec()
	lifecycle.append("navigation_build_started")
	navigation.build(self, runtime_data.town_bounds)
	grid = navigation.grid
	# Landmark centers can contain a tree or bench. Resolve a nearby open ground
	# point without carving the grid or changing the generated landmark geometry.
	for key: String in navigation_targets:
		var target: Vector3 = navigation_targets[key]
		if not navigation.point_clear(target):
			var open: Vector3 = navigation.nearest(target)
			if open.is_finite():
				navigation_targets[key] = open
	_resolve_residential_landmark()
	runtime_data["navigation_ready_ms"] = (Time.get_ticks_usec() - started) / 1000.0
	if load_profile != null:
		load_profile.measure("navigation", started)
	runtime_data["navigation_available"] = true
	runtime_data["movement_status"] = "NAVIGATION READY"
	lifecycle.append("navigation_ready")
	navigation_ready.emit()

func _resolve_residential_landmark() -> void:
	# A parcel center may be a sealed private yard. Pick a reachable open point
	# inside the same residential block; never open its fence or alter its paths.
	var origins: Array[Vector3] = spawn_positions(1)
	if origins.is_empty():
		return
	var origin: Vector3 = origins[0]
	var center: Vector3 = navigation_targets.get("residential", Vector3.INF)
	if not center.is_finite():
		return
	for radius: int in range(0, 13, 2):
		for direction: Vector2 in [Vector2.ZERO, Vector2.LEFT, Vector2.RIGHT, Vector2.UP, Vector2.DOWN, Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
			var flat: Vector2 = Vector2(center.x, center.z) + direction * radius
			var candidate: Vector3 = navigation.nearest(Vector3(flat.x, 0, flat.y), 1.0)
			if not candidate.is_finite() or not residential_bounds.has_point(Vector2(candidate.x, candidate.z)):
				continue
			if not navigation.path(origin, candidate).is_empty():
				navigation_targets["residential"] = candidate
				return

func spawn_positions(count: int) -> Array[Vector3]:
	var result: Array[Vector3] = []
	var forward: Vector3 = runtime_data.arrival_forward
	var lateral: Vector3 = forward.cross(Vector3.UP)
	var origin: Vector3 = runtime_data.arrival_exit
	for row: int in 10:
		for side: float in [0.0, 1.2, -1.2, 2.4, -2.4]:
			var candidate := origin + lateral * side - forward * float(row) * 1.2
			candidate = project_to_ground(candidate)
			if not candidate.is_finite():
				continue
			if not spawn_is_clear(candidate) or result.any(func(point: Vector3) -> bool: return point.distance_to(candidate) < 1.1):
				continue
			result.append(candidate)
			if result.size() == count:
				return result
	return []

func spawn_is_clear(point: Vector3) -> bool:
	var flat := Vector2(point.x, point.z)
	if not runtime_data.town_bounds.grow(-SPAWN_CLEARANCE).has_point(flat):
		return false
	for blocker: Rect2 in spawn_blockers:
		if blocker.grow(SPAWN_CLEARANCE).has_point(flat):
			return false
	if navigation.ready and not navigation.point_clear(point):
		return false
	return true

func get_walkable_ground_height(world_xz: Vector2) -> float:
	return navigation.ground.get_walkable_ground_height(world_xz)

func project_to_ground(point: Vector3) -> Vector3:
	return navigation.ground.project(point)

func nearest_open(point: Vector3) -> Vector3:
	return navigation.nearest(point)

func path(from: Vector3, to: Vector3) -> PackedVector3Array:
	return navigation.path(from, to)

func line_clear(from: Vector3, to: Vector3) -> bool:
	return navigation.ready and navigation.segment_clear(from, to)

func cell_at(point: Vector3) -> Vector2i:
	return navigation.cell_at(point)

func formation_target(origin: Vector3, preferred: Vector3, reserved: Array[Vector3], reserved_paths: Array[PackedVector3Array]) -> Vector3:
	var center: Vector3 = nearest_open(preferred)
	if not center.is_finite():
		return Vector3.INF
	for ring: int in 9:
		for x: int in range(-ring, ring + 1):
			for z: int in range(-ring, ring + 1):
				if maxi(absi(x), absi(z)) != ring:
					continue
				var candidate: Vector3 = center + Vector3(x, 0, z) * 0.5
				var separated: bool = true
				for point: Vector3 in reserved:
					if point.distance_to(candidate) < 1.1:
						separated = false
				if not separated or not navigation.open_cell(navigation.cell_at(candidate)):
					continue
				var route: PackedVector3Array = path(origin, candidate)
				if route.is_empty():
					continue
				# A parked member must not occupy another member's final approach.
				# This is destination planning, not dynamic collision or steering.
				for endpoint: Vector3 in reserved:
					separated = separated and _route_clears_endpoint(route, endpoint)
				for previous: PackedVector3Array in reserved_paths:
					separated = separated and _route_clears_endpoint(previous, candidate)
				if separated:
					return candidate
	return Vector3.INF

func _route_clears_endpoint(route: PackedVector3Array, endpoint: Vector3) -> bool:
	var point: Vector2 = Vector2(endpoint.x, endpoint.z)
	for i: int in range(1, route.size()):
		var a: Vector2 = Vector2(route[i - 1].x, route[i - 1].z)
		var b: Vector2 = Vector2(route[i].x, route[i].z)
		if point.distance_to(Geometry2D.get_closest_point_to_segment(point, a, b)) < 0.9:
			return false
	return true

func _measure_blocker(wrapper: Node3D) -> void:
	var box: AABB = wrapper.global_transform * Geometry.bounds(wrapper).merge(Geometry.bounds(wrapper, true))
	spawn_blockers.append(Rect2(Vector2(box.position.x, box.position.z), Vector2(box.size.x, box.size.z)))

func _build_input_surface(bounds: Rect2) -> void:
	var ground := StaticBody3D.new()
	ground.name = "ExpeditionInputSurface"
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(bounds.size.x, 0.2, bounds.size.y)
	collision.shape = shape
	ground.add_child(collision)
	ground.position = Vector3(bounds.get_center().x, -0.15, bounds.get_center().y)
	add_child(ground)
