extends Control
## Dynamic expedition minimap: projects live world entities into a compact tactical view.
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const ExplorationStateData = preload("res://maps/exploration_state.gd")
const SURVIVOR_DIAMETER: float = 18.0
const SURVIVOR_CORE_RADIUS: float = 2.25
const SURVIVOR_RING_RADIUS: float = 6.0
const SURVIVOR_RING_WIDTH: float = 1.35
const SURVIVOR_SEARCH_ARC: float = TAU * 0.78
const SURVIVOR_MARKER_OFFSET: Vector2 = Vector2(0, -6)
const VEHICLE_MARKER_OFFSET: Vector2 = Vector2(0, 6)
const MARKER_MARGIN: float = 3.0
const MARKER_LAYOUT_STEP: float = 10.0
const MARKER_LAYOUT_RINGS: int = 7
const TOWN_DYNAMIC_INTERVAL: float = 1.0 / 20.0
const MINIMAP_DEBUG: bool = false
const SURVIVOR_CLUSTER_DISTANCE: float = 12.0
const SURVIVOR_CLUSTER_RADIUS: float = 9.0
const DANGER_CLUSTER_DISTANCE: float = 14.0
const DANGER_EVENT_LIFETIME: float = 7.0
const DISCOVERY_TOAST_LIFETIME: float = 1.8
const SURVIVOR_NUMERALS: Array[String] = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"]
var mission: Node3D
var frame: TextureRect
var marker_bus: Texture2D
var marker_poi: Texture2D
var marker_target: Texture2D
var marker_search: Texture2D
var marker_vehicle: Texture2D
var marker_house: Texture2D
var marker_shop: Texture2D
var marker_medical: Texture2D
var marker_warehouse: Texture2D
var static_layer: TownWorldLayer
var world_clip: LocalWorldClip
var minimap_mode: String = "LOCAL_FOLLOW"
var center_source: String = "squad_center"
var local_world_extent: float = 35.0
var follow_center: Vector3
var town_bounds: Rect2
var minimap_content_rect: Rect2
var marker_rect: Rect2
var map_scale: float = 1.0
var map_origin: Vector2
var cached_source: String = ""
var static_build_count: int = 0
var static_build_ms: float = 0.0
var town_markers: Array[Dictionary] = []
var marker_pool: Dictionary = {}
var survivor_clusters: Array[Dictionary] = []
var cluster_expanded: bool = false
var discovery_notice: String = ""
var discovery_notice_left: float = 0.0
var recent_discoveries: Dictionary = {}
var _discovery_flush_left: float = 0.0
var _cluster_hit_rects: Array[Dictionary] = []
var _cluster_layout_offsets: Dictionary = {}
var _exploration_state: RefCounted
var _cached_size: Vector2 = Vector2.ZERO
var _area: Rect2
var marker_update_count: int = 0
var full_refresh_count: int = 0
var _town_dynamic_elapsed: float = TOWN_DYNAMIC_INTERVAL
var _marker_phase: float = 0.0

func setup(target: Node3D) -> void:
	mission = target
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame = HudArt.picture("minimap_frame", Vector2.ZERO)
	frame.name = "Frame"
	add_child(frame)
	frame.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	marker_bus = HudArt.texture("icon_vehicle_bus")
	marker_poi = HudArt.texture("map_poi_marker")
	marker_target = HudArt.texture("map_target_marker")
	marker_search = HudArt.texture("map_search_marker")
	marker_vehicle = HudArt.texture("icon_vehicle")
	marker_house = HudArt.texture("icon_house_small")
	_exploration_state = mission.exploration.exploration_state
	mouse_filter = Control.MOUSE_FILTER_PASS
	clip_contents = true
	for id: String in mission.city.sites:
		if mission.exploration.state_at(mission.city.sites[id].spec.entry) != mission.exploration.Visibility.UNEXPLORED:
			recent_discoveries[id] = true
	world_clip = LocalWorldClip.new()
	world_clip.name = "LocalWorldClip"
	world_clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	world_clip.clip_contents = true
	world_clip.show_behind_parent = true
	add_child(world_clip)
	static_layer = TownWorldLayer.new()
	static_layer.name = "TownWorldLayer"
	world_clip.add_child(static_layer)
	_sync_town()
	set_process(true)
	queue_redraw()

func _process(delta: float) -> void:
	if delta > 0.0:
		_marker_phase = fmod(_marker_phase + delta, 100.0)
	if not uses_town_runtime():
		_sync_town()
		full_refresh_count += 1
		queue_redraw()
		return
	if delta > 0.0:
		_town_dynamic_elapsed += delta
		discovery_notice_left = maxf(0.0, discovery_notice_left - delta)
		_discovery_flush_left += delta
		if _town_dynamic_elapsed < TOWN_DYNAMIC_INTERVAL:
			return
		_town_dynamic_elapsed = fmod(_town_dynamic_elapsed, TOWN_DYNAMIC_INTERVAL)
	_sync_town()
	var previous_discoveries: Dictionary = recent_discoveries.duplicate()
	_update_town_markers()
	_update_survivor_clusters()
	_update_discovery_notice(previous_discoveries)
	if _discovery_flush_left >= 1.0:
		_discovery_flush_left = 0.0
		_exploration_state.save()
	marker_update_count += 1
	if MINIMAP_DEBUG and marker_update_count % 20 == 0:
		_debug_dump_projection()
	queue_redraw()

func _exit_tree() -> void:
	if _exploration_state != null:
		_exploration_state.save()

func _gui_input(event: InputEvent) -> void:
	if not event is InputEventMouseButton or not event.pressed or event.button_index != MOUSE_BUTTON_LEFT:
		return
	for hit: Dictionary in _cluster_hit_rects:
		var hit_rect: Rect2 = hit.rect
		if hit_rect.has_point(event.position):
			cluster_expanded = not cluster_expanded
			accept_event()
			queue_redraw()
			return

func _draw() -> void:
	if mission == null: return
	if uses_town_runtime():
		_draw_town_markers()
		return
	var area := Rect2(Vector2(22, 40), size - Vector2(44, 66))
	draw_rect(area, Color("#304661c9"), true)
	var center: Vector3 = mission.squad_center()
	var extent := 34.0
	var project := func(world: Vector3) -> Vector2:
		var p := Vector2((world.x - center.x) / extent, (world.z - center.z) / extent)
		return area.get_center() + Vector2(p.x, p.y) * area.size * .46
	if mission.city != null:
		# Read the live map definition, keeping the same world-to-map projection as markers.
		for district: Dictionary in mission.city.data.districts:
			var bounds: Rect2 = district.bounds
			var start: Vector2 = project.call(Vector3(bounds.position.x, 0, bounds.position.y))
			var end: Vector2 = project.call(Vector3(bounds.end.x, 0, bounds.end.y))
			var block := Rect2(start, end - start).intersection(area)
			if block.has_area():
				draw_rect(block, Color("#52678370") if district.paved else Color("#52676a60"))
		for road: Dictionary in mission.city.data.road_segments:
			var start: Vector2 = project.call(Vector3(road.start.x, 0, road.start.y))
			var end: Vector2 = project.call(Vector3(road.end.x, 0, road.end.y))
			var half_width: Vector2 = area.size * (.46 * 4.0 / extent)
			var road_rect := Rect2(start.min(end) - half_width, (end - start).abs() + half_width * 2).intersection(area)
			if road_rect.has_area():
				draw_rect(road_rect, Color("#9aaec685"))
		for id: String in mission.city.sites:
			var site: Dictionary = mission.city.sites[id]
			if not site.discovered or site.vehicle:
				continue
			var building: Vector2 = project.call(site.body.global_position)
			var dimensions: Vector3 = site.spec.size
			var footprint_size := Vector2(dimensions.x, dimensions.z) * area.size * (.46 / extent)
			if absf(sin(site.body.rotation.y)) > .5:
				footprint_size = Vector2(dimensions.z, dimensions.x) * area.size * (.46 / extent)
			var footprint := Rect2(building - footprint_size * .5, footprint_size).intersection(area)
			if footprint.has_area():
				draw_rect(footprint, Color("#acb5c07d"))
	if mission.city != null:
		var bus: Vector3 = mission.catalog.map.bus_position
		_draw_marker(marker_bus, project.call(bus), 22.0)
		for id: String in mission.city.sites:
			var site: Dictionary = mission.city.sites[id]
			if not site.discovered: continue
			var texture := marker_search if mission.search_tasks.has(id) else marker_target if mission.poi_selected_id == id else marker_poi
			_draw_marker(texture, project.call(site.spec.entry), 22.0 if mission.poi_selected_id == id or mission.search_tasks.has(id) else 19.0)
	for member: Node3D in mission.survivors:
		if member.dead: continue
		var point: Vector2 = project.call(member.position)
		_draw_survivor_marker(point, _survivor_is_moving(member), _survivor_is_searching(member))

func _draw_marker(texture: Texture2D, point: Vector2, diameter: float) -> void:
	if texture == null: return
	if not marker_rect.has_point(point):
		return
	var dimensions: Vector2 = texture.get_size() * (diameter / maxf(texture.get_width(), texture.get_height()))
	var rect := Rect2(point - dimensions * .5, dimensions)
	draw_texture_rect(texture, rect, false)

func uses_town_runtime() -> bool:
	return is_instance_valid(mission) and mission.map_provider == "MEDIUM_TOWN_V1" and mission.runtime_data.has("minimap_geometry")

func world_to_minimap(world_pos: Vector3) -> Vector2:
	return _snap_point(map_origin + Vector2(world_pos.x, world_pos.z) * map_scale)

func _snap_point(point: Vector2) -> Vector2:
	return Vector2(floorf(point.x), floorf(point.y))

func world_to_overview(world_pos: Vector3, content_rect: Rect2) -> Vector2:
	# Retain the whole-Town projection as data support, without a Full Map UI.
	var fit_scale: float = minf(content_rect.size.x / town_bounds.size.x, content_rect.size.y / town_bounds.size.y)
	return content_rect.get_center() + (Vector2(world_pos.x, world_pos.z) - town_bounds.get_center()) * fit_scale

func _sync_town() -> void:
	if static_layer == null:
		return
	world_clip.visible = uses_town_runtime()
	static_layer.visible = world_clip.visible
	if not world_clip.visible:
		cached_source = ""
		static_layer.commands.clear()
		static_layer.source = ""
		static_layer.drawn_source = ""
		static_layer.queue_redraw()
		town_markers.clear()
		marker_pool.clear()
		return
	var runtime: Dictionary = mission.runtime_data
	var geometry: Dictionary = runtime.minimap_geometry
	var roads: Array = geometry.get("roads", [])
	if runtime.road_bounds.is_empty() or geometry.get("buildings", []).is_empty() or (roads.is_empty() and geometry.get("regions", []).is_empty()):
		cached_source = ""
		static_layer.commands.clear()
		static_layer.source = ""
		static_layer.drawn_source = ""
		static_layer.queue_redraw()
		return
	var source: String = "%s:%s:%s" % [runtime.seed, runtime.source_signatures.town, runtime.source_signatures.m02]
	town_bounds = runtime.town_bounds
	if size != _cached_size:
		_cached_size = size
		_area = Rect2(Vector2(22, 40), (size - Vector2(44, 66)).max(Vector2.ONE))
		var available: Rect2 = Rect2(_area.position + Vector2(2, 2), (_area.size - Vector2(4, 4)).max(Vector2.ONE))
		# The frame's inner area is the viewport; no footer space is reserved for absent content.
		minimap_content_rect = available
		marker_rect = minimap_content_rect
		world_clip.position = minimap_content_rect.position
		world_clip.size = minimap_content_rect.size
		world_clip.queue_redraw()
	follow_center = mission.squad_center()
	map_scale = maxf(minimap_content_rect.size.x, minimap_content_rect.size.y) / (local_world_extent * 2.0)
	map_origin = minimap_content_rect.get_center() - Vector2(follow_center.x, follow_center.z) * map_scale
	map_origin = _snap_point(map_origin)
	static_layer.scale = Vector2.ONE * map_scale
	static_layer.position = map_origin - world_clip.position
	if source == cached_source:
		return
	var started: int = Time.get_ticks_usec()
	cached_source = source
	static_layer.source = source
	static_layer.drawn_source = ""
	static_layer.commands.clear()
	static_layer.commands.append({"layer": 0, "rect": town_bounds, "color": Color("#304661")})
	static_layer.commands.append({"rect": town_bounds, "color": Color("#6f7d84"), "outline": true})
	for region: Dictionary in geometry.regions:
		var green: bool = region.kind in ["small_park", "community_green", "backyard", "green_buffer"]
		static_layer.commands.append({"layer": 1, "polygon": region.polygon,
			"color": Color("#536d6d") if green else Color("#53677a"),
			"outline_color": Color("#b9c7bd38"), "outline_width": 0.35})
	for parking: Dictionary in geometry.get("parking", []):
		_cache_world_polygon(parking.polygon, Color("#a28f75"), Color("#f0d9a35c"), 0.75, 1)
	if roads.is_empty():
		for bounds: Rect2 in runtime.road_bounds:
			_cache_world_rect(bounds, Color("#91aabe"), 2)
	else:
		for road: Dictionary in roads:
			var road_style: Dictionary = _road_style(road)
			_cache_world_polygon(road.polygon, road_style.fill, road_style.outline, road_style.outline_width, 2)
	for building: Dictionary in geometry.buildings:
		var building_style: Dictionary = _building_style(building)
		_cache_world_polygon(_building_polygon(building), building_style.fill, building_style.outline,
			building_style.outline_width, 3)
	var arrival: Dictionary = geometry.get("arrival", {})
	for zone: Dictionary in arrival.get("zones", []):
		var zone_style: Dictionary = _arrival_style(str(zone.kind))
		_cache_world_polygon(zone.polygon, zone_style.fill, zone_style.outline, zone_style.outline_width, 4)
	static_layer.queue_redraw()
	static_build_count += 1
	static_build_ms = (Time.get_ticks_usec() - started) / 1000.0
	print("[MINIMAP] seed=%d roads=%d buildings=%d cache_rebuilt=true build_ms=%.3f" % [runtime.seed, roads.size() if not roads.is_empty() else runtime.road_bounds.size(), geometry.buildings.size(), static_build_ms])

func world_layer_ready() -> bool:
	if not uses_town_runtime() or cached_source.is_empty() or not minimap_content_rect.has_area() or size.x <= 44 or size.y <= 66:
		return false
	var source: String = "%s:%s:%s" % [mission.runtime_data.seed, mission.runtime_data.source_signatures.town, mission.runtime_data.source_signatures.m02]
	if source != cached_source or static_layer.commands.is_empty() or not is_visible_in_tree():
		return false
	# Headless can validate data submission only; native QA checks actual rendered pixels.
	return DisplayServer.get_name() == "headless" or static_layer.drawn_source == source

func _cache_world_rect(bounds: Rect2, color: Color, layer: int = 2) -> void:
	static_layer.commands.append({"layer": layer, "rect": bounds, "color": color})

func _cache_world_polygon(polygon: PackedVector2Array, color: Color, outline_color: Color, outline_width: float,
		layer: int = 2) -> void:
	if polygon.size() < 3:
		return
	static_layer.commands.append({"layer": layer, "polygon": polygon, "color": color,
		"outline_color": outline_color, "outline_width": outline_width})

func _road_style(road: Dictionary) -> Dictionary:
	var road_type: String = str(road.get("type", road.get("kind", "secondary"))).to_lower()
	match road_type:
		"main":
			return {"fill": Color("#9eb8c8"), "outline": Color("#f0e8d4a0"), "outline_width": 1.35}
		"connector", "alley":
			return {"fill": Color("#6e8798"), "outline": Color("#d8e0d98c"), "outline_width": 0.9}
		_:
			return {"fill": Color("#829eaf"), "outline": Color("#e0e7df98"), "outline_width": 1.05}

func _building_style(building: Dictionary) -> Dictionary:
	var category: String = str(building.get("category", building.get("type", "residential"))).to_lower()
	var land_use: String = str(building.get("land_use_type", "")).to_lower()
	if "industrial" in category or "industrial" in land_use:
		return {"fill": Color("#9baeb9"), "outline": Color("#e5eef0a8"), "outline_width": 1.0}
	if "commercial" in category or "commercial" in land_use:
		return {"fill": Color("#c5b39e"), "outline": Color("#f3e4c2b0"), "outline_width": 1.0}
	if "special" in category or "special" in land_use or "service" in category:
		return {"fill": Color("#d4bc83"), "outline": Color("#ffe5a9d0"), "outline_width": 1.25}
	return {"fill": Color("#c7c7b8"), "outline": Color("#eee9d5a0"), "outline_width": 0.85}

func _arrival_style(kind: String) -> Dictionary:
	match kind:
		"bus_stop":
			return {"fill": Color("#e0bd73"), "outline": Color("#fff0b8d0"), "outline_width": 1.0}
		"entrance":
			return {"fill": Color("#9bc9b3"), "outline": Color("#dff5d5c0"), "outline_width": 0.9}
		"parking":
			return {"fill": Color("#aa906e"), "outline": Color("#f0d6a580"), "outline_width": 0.75}
		_:
			return {"fill": Color("#c6a16d"), "outline": Color("#f4db9b9c"), "outline_width": 0.85}

func _building_polygon(building: Dictionary) -> PackedVector2Array:
	var polygon: PackedVector2Array = building.get("polygon", PackedVector2Array())
	if polygon.size() >= 3:
		return polygon
	var bounds: Rect2 = building.bounds
	return PackedVector2Array([bounds.position, Vector2(bounds.end.x, bounds.position.y), bounds.end, Vector2(bounds.position.x, bounds.end.y)])

func _update_town_markers() -> void:
	town_markers.clear()
	_append_town_marker("arrival", mission.runtime_data.arrival_point, marker_bus, 20.0, "arrival")
	var poi_id: String = mission.runtime_data.mission_poi_id
	if exploration_state_at(mission.runtime_data.mission_poi) != 0:
		var poi_texture: Texture2D = marker_search if mission.search_tasks.has(poi_id) else marker_target
		_append_town_marker("poi", mission.runtime_data.mission_poi, poi_texture, 20.0, "poi")
	var selected_member: Node3D = mission.get("selected_search_member") as Node3D
	var selected_id: int = selected_member.get_instance_id() if is_instance_valid(selected_member) else -1
	for member: Node3D in mission.survivors:
		if member.dead:
			continue
		_append_town_marker(member.get_instance_id(), member.position, null, SURVIVOR_DIAMETER, "survivor", member.get_instance_id() == selected_id)
	# Presentation consumes discovery state without creating sites or SearchTasks.
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		if exploration_state_at(site.spec.entry) == 0 or id == poi_id:
			continue
		var texture: Texture2D = _site_marker_texture(id, site)
		var kind: String = "vehicle" if bool(site.get("vehicle", false)) else "site"
		_append_town_marker("site:" + id, site.spec.entry, texture, 18.0, kind)
		if not recent_discoveries.has(id):
			recent_discoveries[id] = true
	_update_survivor_clusters()
	_layout_town_markers()

func _site_marker_texture(id: String, site: Dictionary) -> Texture2D:
	if mission.search_tasks.has(id):
		return marker_search
	if bool(site.get("vehicle", false)):
		return marker_vehicle
	if mission.poi_selected_id == id:
		return marker_target
	var poi_type: String = str(site.spec.get("poi_type", "")).to_lower()
	var category: String = str(site.spec.get("category", "")).to_lower()
	if poi_type in ["pharmacy", "warehouse", "supermarket", "restaurant", "gas_station", "auto_repair"] or category in ["commercial", "industrial", "special", "medical"]:
		return marker_target
	if poi_type in ["house", "residence", "residential"] or category == "residential":
		return marker_house
	return marker_poi

func exploration_state_at(world: Vector3) -> int:
	return int(mission.exploration.state_at(world))

func _update_survivor_clusters() -> void:
	survivor_clusters.clear()
	var remaining: Array[Dictionary] = []
	for item: Dictionary in town_markers:
		if item.kind == "survivor":
			remaining.append(item)
	while not remaining.is_empty():
		var leader: Dictionary = remaining.pop_front()
		var members: Array[Dictionary] = [leader]
		var index: int = 0
		while index < remaining.size():
			if Vector2(remaining[index].point).distance_to(leader.point) <= SURVIVOR_CLUSTER_DISTANCE:
				members.append(remaining.pop_at(index))
			else:
				index += 1
		if members.size() > 1:
			var selected_id: int = -1
			for member: Dictionary in members:
				if bool(member.get("selected", false)):
					selected_id = int(member.id)
					break
			survivor_clusters.append({"id": str(leader.id), "point": leader.desired_point,
				"members": members, "selected_id": selected_id})

func _layout_town_markers() -> void:
	var grouped_ids: Dictionary = {}
	var layout_items: Array[Dictionary] = []
	for cluster: Dictionary in survivor_clusters:
		for member: Dictionary in cluster.members:
			grouped_ids[int(member.id)] = true
		layout_items.append({"id": "cluster:" + str(cluster.id), "kind": "cluster", "diameter": 20.0,
			"desired_point": cluster.point, "point": cluster.point})
	for marker: Dictionary in town_markers:
		if marker.kind == "survivor" and grouped_ids.has(int(marker.id)):
			continue
		marker["layout_diameter"] = 46.0 if bool(marker.get("selected", false)) else float(marker.diameter)
		layout_items.append(marker)
	layout_items.sort_custom(_marker_precedes)
	var placed: Array[Dictionary] = []
	for item: Dictionary in layout_items:
		var key: String = str(item.id)
		var offset: Vector2 = _layout_offset_for(item, key)
		var point: Vector2 = item.desired_point + offset
		var layout_diameter: float = float(item.get("layout_diameter", item.diameter))
		if not _marker_position_is_clear(point, layout_diameter, placed):
			offset = _find_marker_offset(item, key, placed)
			point = item.desired_point + offset
		if item.kind == "cluster":
			_cluster_layout_offsets[key] = offset
			for cluster: Dictionary in survivor_clusters:
				if "cluster:" + str(cluster.id) == key:
					cluster.point = point
		else:
			item.layout_offset = offset
			item.point = point
		placed.append(item)

func _layout_offset_for(item: Dictionary, key: String) -> Vector2:
	if item.kind == "cluster":
		return _cluster_layout_offsets.get(key, Vector2.ZERO)
	return item.get("layout_offset", Vector2.ZERO)

func _marker_precedes(a: Dictionary, b: Dictionary) -> bool:
	var a_priority: int = _marker_priority(a)
	var b_priority: int = _marker_priority(b)
	if a_priority != b_priority:
		return a_priority < b_priority
	return str(a.id) < str(b.id)

func _marker_draws_after(a: Dictionary, b: Dictionary) -> bool:
	var a_priority: int = _marker_priority(a)
	var b_priority: int = _marker_priority(b)
	if a_priority != b_priority:
		return a_priority > b_priority
	return str(a.id) > str(b.id)

func _marker_priority(marker: Dictionary) -> int:
	if marker.kind == "survivor" or marker.kind == "cluster":
		return 1
	if marker.kind == "arrival":
		return 2
	var target_id: String = str(marker.id).trim_prefix("site:")
	if marker.kind == "poi" or mission.search_tasks.has(target_id) or mission.poi_selected_id == target_id:
		return 0
	return 3

func _marker_position_is_clear(point: Vector2, diameter: float, placed: Array[Dictionary]) -> bool:
	var bounds: Rect2 = Rect2(point - Vector2.ONE * diameter * 0.5, Vector2.ONE * diameter)
	if not marker_rect.encloses(bounds):
		return false
	for other: Dictionary in placed:
		var other_diameter: float = float(other.get("layout_diameter", other.diameter))
		var minimum_distance: float = (diameter + other_diameter) * 0.5 + 1.0
		if point.distance_squared_to(other.point) < minimum_distance * minimum_distance:
			return false
	return true

func _find_marker_offset(item: Dictionary, key: String, placed: Array[Dictionary]) -> Vector2:
	var start_direction: int = absi(key.hash()) % 8
	var layout_diameter: float = float(item.get("layout_diameter", item.diameter))
	for ring: int in range(1, MARKER_LAYOUT_RINGS + 1):
		for step: int in 8:
			var direction: Vector2 = Vector2.from_angle(float((start_direction + step) % 8) * TAU / 8.0)
			var offset: Vector2 = (direction * MARKER_LAYOUT_STEP * float(ring)).round()
			if _marker_position_is_clear(item.desired_point + offset, layout_diameter, placed):
				return offset
	return Vector2.ZERO

func _update_discovery_notice(previous: Dictionary) -> void:
	var discovered: Array[String] = []
	for id: String in recent_discoveries:
		if not previous.has(id):
			discovered.append(str(mission.city.sites[id].spec.get("name", id)))
	if not discovered.is_empty():
		discovery_notice = "发现 " + "、".join(discovered.slice(0, 2))
		discovery_notice_left = DISCOVERY_TOAST_LIFETIME

func _draw_fog_layer(local: Rect2) -> void:
	if map_scale <= 0.0:
		return
	var world_min: Vector2 = (local.position - map_origin) / map_scale
	var world_max: Vector2 = (local.end - map_origin) / map_scale
	var min_cell: Vector2i = Vector2i((world_min / ExplorationStateData.CELL_SIZE).floor())
	var max_cell: Vector2i = Vector2i((world_max / ExplorationStateData.CELL_SIZE).ceil())
	for x: int in range(min_cell.x, max_cell.x + 1):
		for y: int in range(min_cell.y, max_cell.y + 1):
			var world_center: Vector2 = (Vector2(x, y) + Vector2.ONE * 0.5) * ExplorationStateData.CELL_SIZE
			var cell_rect: Rect2 = Rect2(map_origin + world_center * map_scale - Vector2.ONE * ExplorationStateData.CELL_SIZE * map_scale * 0.5,
				Vector2.ONE * ExplorationStateData.CELL_SIZE * map_scale).intersection(local)
			if not cell_rect.has_area():
				continue
			var state: int = int(_exploration_state.state_at(world_center))
			if state == 0:
				draw_rect(cell_rect, Color("#172b40"))
			elif state == 1:
				draw_rect(cell_rect, Color("#20364d70"))

func _draw_building_marker(item: Dictionary) -> void:
	var point: Vector2 = item.point
	if item.kind in ["arrival", "poi", "vehicle"]:
		_draw_marker(item.texture, point, item.diameter)
		return
	var site_id: String = str(item.id).trim_prefix("site:")
	var site: Dictionary = mission.city.sites.get(site_id, {})
	var poi_type: String = str(site.get("spec", {}).get("poi_type", "")).to_lower()
	var category: String = str(site.get("spec", {}).get("category", "")).to_lower()
	var color: Color = Color("#c7c7b8")
	var symbol: String = "house"
	if poi_type == "pharmacy" or category == "medical":
		color = Color("#d5aaa6")
		symbol = "medical"
	elif poi_type == "warehouse" or category == "industrial":
		color = Color("#a7bdc5")
		symbol = "warehouse"
	elif category == "commercial" or poi_type in ["supermarket", "restaurant", "gas_station", "auto_repair"]:
		color = Color("#e5ca91")
		symbol = "shop"
	if mission.search_tasks.has(site_id):
		color = Color("#8bcde0")
	elif bool(site.get("searched", false)):
		color = Color("#778b91")
	var bounds: Rect2 = Rect2(point - Vector2.ONE * 6.0, Vector2.ONE * 12.0)
	draw_rect(bounds, Color("#172c42"), true)
	draw_rect(bounds, color, false, 1.1, true)
	match symbol:
		"medical":
			draw_rect(Rect2(point - Vector2(1.0, 4.0), Vector2(2.0, 8.0)), color, true)
			draw_rect(Rect2(point - Vector2(4.0, 1.0), Vector2(8.0, 2.0)), color, true)
		"shop":
			draw_rect(Rect2(point - Vector2(4.0, 1.0), Vector2(8.0, 5.0)), color, true)
			draw_line(point + Vector2(-5.0, -3.0), point + Vector2(5.0, -3.0), color, 1.5, true)
		"warehouse":
			draw_line(point + Vector2(-5.0, -1.0), point, color, 1.5, true)
			draw_line(point, point + Vector2(5.0, -1.0), color, 1.5, true)
			draw_rect(Rect2(point + Vector2(-4.0, -1.0), Vector2(8.0, 5.0)), color, false, 1.1, true)
		_:
			draw_line(point + Vector2(-5.0, 0.0), point, color, 1.5, true)
			draw_line(point, point + Vector2(5.0, 0.0), color, 1.5, true)
			draw_line(point + Vector2(-5.0, 0.0), point + Vector2(-5.0, 5.0), color, 1.5, true)
			draw_line(point + Vector2(5.0, 0.0), point + Vector2(5.0, 5.0), color, 1.5, true)

func _draw_survivor_clusters() -> void:
	var clustered_ids: Dictionary = {}
	for cluster: Dictionary in survivor_clusters:
		for member: Dictionary in cluster.members:
			clustered_ids[int(member.id)] = true
		var point: Vector2 = cluster.point
		draw_arc(point, SURVIVOR_CLUSTER_RADIUS, 0.0, TAU, 24, Color("#bedad9"), 1.4, true)
		draw_circle(point, 6.2, Color("#19324c"))
		draw_arc(point, 4.0, 0.0, TAU, 20, Color("#f6f0df"), 1.0, true)
		draw_string(ThemeDB.fallback_font, point + Vector2(-3.0, 3.2), str(cluster.members.size()), HORIZONTAL_ALIGNMENT_LEFT, 7.0, 8, Color("#f6f0df"))
		var selected_id: int = int(cluster.get("selected_id", -1))
		if selected_id >= 0:
			_draw_selected_survivor_name(point, _survivor_name(selected_id))
	for member: Dictionary in town_markers:
		if member.kind == "survivor" and not clustered_ids.has(int(member.id)):
			_draw_survivor_marker(member.point, bool(member.get("moving", false)), bool(member.get("searching", false)),
				bool(member.get("selected", false)), _survivor_marker_label(member))

func _survivor_marker_label(marker: Dictionary) -> String:
	if bool(marker.get("selected", false)):
		return _survivor_name(int(marker.id))
	var survivor_index: int = mission.survivors.find(instance_from_id(int(marker.id)))
	if survivor_index < 0:
		return ""
	return SURVIVOR_NUMERALS[mini(survivor_index, SURVIVOR_NUMERALS.size() - 1)]

func _survivor_name(instance_id: int) -> String:
	var survivor: Node3D = instance_from_id(instance_id) as Node3D
	return str(survivor.data.display_name) if survivor != null else "幸存者"

func _draw_danger_layer() -> void:
	var danger_sources: Array[Dictionary] = []
	for enemy: Node3D in mission.enemies:
		if enemy.active and mission.exploration.is_visible(enemy.position):
			danger_sources.append({"position": world_to_minimap(enemy.position), "severity": 0, "enemy_count": 1})
	if mission.noise != null:
		for event: RefCounted in mission.noise.events:
			if mission.noise.elapsed - float(event.emitted_at) > DANGER_EVENT_LIFETIME:
				continue
			if not mission.exploration.is_visible(event.world_position):
				continue
			var strength: float = float(event.intensity)
			var severity: int = 2 if strength >= 1.0 else 1 if strength >= 0.55 else 0
			danger_sources.append({"position": world_to_minimap(event.world_position), "severity": severity, "enemy_count": 0})
	var threats: Array[Dictionary] = []
	for source: Dictionary in danger_sources:
		var matched: Dictionary = {}
		for threat: Dictionary in threats:
			if Vector2(threat.position).distance_to(source.position) <= DANGER_CLUSTER_DISTANCE:
				matched = threat
				break
		if matched.is_empty():
			threats.append({"position": source.position, "severity": int(source.severity), "enemy_count": int(source.enemy_count), "source_count": 1})
		else:
			var count: int = int(matched.source_count)
			matched.position = (Vector2(matched.position) * float(count) + Vector2(source.position)) / float(count + 1)
			matched.severity = maxi(int(matched.severity), int(source.severity))
			matched.enemy_count = int(matched.enemy_count) + int(source.enemy_count)
			matched.source_count = count + 1
	for threat: Dictionary in threats:
		_draw_threat_pulse(threat)

func _draw_threat_pulse(threat: Dictionary) -> void:
	var blue_hour: bool = mission.clock.phase != mission.clock.DAY
	var enemy_count: int = int(threat.enemy_count)
	var severity: int = int(threat.severity)
	var high_threat: bool = blue_hour or severity >= 2 or enemy_count >= 5
	var pulse: float = 0.5 + 0.5 * sin(_marker_phase * TAU / 1.6)
	var radius: float = 3.2 + minf(float(maxi(0, enemy_count - 1)) * 0.65, 2.6) + float(severity) * 0.8 + (1.2 if high_threat else 0.0)
	radius = clampf(radius + pulse * 0.6, 3.0, 8.0)
	var point: Vector2 = threat.position
	var red: Color = Color("#e36f70")
	for ring: int in 4:
		var ring_radius: float = radius * float(4 - ring) / 4.0
		var alpha: float = (0.05 + float(ring) * 0.012) * (0.72 + pulse * 0.28)
		draw_circle(point, ring_radius, Color(red, alpha))
	if high_threat or enemy_count > 1 or severity > 0:
		_draw_threat_warning(point, red)
	if enemy_count > 1:
		draw_string(ThemeDB.fallback_font, point + Vector2(6.0, 4.0), "×%d" % enemy_count,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 9, Color("#f4d7d3"))

func _draw_threat_warning(point: Vector2, color: Color) -> void:
	var triangle := PackedVector2Array([point + Vector2(0.0, -5.0), point + Vector2(5.0, 4.0), point + Vector2(-5.0, 4.0)])
	draw_colored_polygon(triangle, Color("#402d36"))
	draw_polyline(PackedVector2Array([triangle[0], triangle[1], triangle[2], triangle[0]]), color, 1.2, true)
	draw_line(point + Vector2(0.0, -2.0), point + Vector2(0.0, 1.0), color, 1.1, true)
	draw_circle(point + Vector2(0.0, 2.5), 0.6, color)

func _draw_exploration_scans() -> void:
	for member: Node3D in mission.living():
		if member.inside_building or member.boarding:
			continue
		var phase: float = fmod(_marker_phase, 1.2) / 1.2
		var radius: float = clampf(lerpf(2.5, 8.0, phase) * map_scale, 4.0, 20.0)
		draw_arc(world_to_minimap(member.position), radius, 0.0, TAU, 20,
			Color(0.58, 0.8, 0.83, (1.0 - phase) * 0.22), 0.75, true)

func _draw_discovery_notice() -> void:
	var bounds: Rect2 = Rect2(minimap_content_rect.position + Vector2(4.0, 4.0), Vector2(minf(150.0, minimap_content_rect.size.x - 8.0), 20.0))
	draw_rect(bounds, Color("#19324ceB"), true)
	draw_rect(bounds, Color("#b9d8d0"), false, 1.0)
	draw_string(ThemeDB.fallback_font, bounds.position + Vector2(6.0, 14.0), discovery_notice, HORIZONTAL_ALIGNMENT_LEFT, bounds.size.x - 12.0, 10, Color("#f6f0df"))

func _append_town_marker(id: Variant, world: Vector3, texture: Texture2D, diameter: float, kind: String = "landmark", selected: bool = false) -> void:
	var key: String = str(id)
	var anchor: Vector2 = world_to_minimap(world)
	var offset: Vector2 = _marker_offset(kind)
	var desired_point: Vector2 = anchor + offset
	var inset: Rect2 = marker_rect.grow(-diameter * .5 - MARKER_MARGIN)
	var bearing: Vector2 = desired_point - minimap_content_rect.get_center()
	var marker_bounds: Rect2 = Rect2(desired_point - Vector2.ONE * diameter * .5, Vector2.ONE * diameter)
	var edge: bool = not marker_rect.encloses(marker_bounds)
	var clamped_anchor: Vector2 = desired_point
	if edge:
		var ratio: float = maxf(absf(bearing.x) / (inset.size.x * .5), absf(bearing.y) / (inset.size.y * .5))
		if ratio > 0.0:
			clamped_anchor = inset.get_center() + bearing / ratio
	var point: Vector2 = clamped_anchor if edge else desired_point
	var visible: bool = true
	if kind in ["site", "vehicle"]:
		visible = marker_rect.encloses(marker_bounds)
	var marker: Dictionary = marker_pool.get(key, {})
	if marker.is_empty():
		marker = {"id": id}
		marker_pool[key] = marker
	marker["id"] = id
	marker["kind"] = kind
	marker["world"] = world
	marker["projected_position"] = map_origin + Vector2(world.x, world.z) * map_scale
	marker["anchor"] = anchor
	marker["rounded_position"] = anchor
	marker["offset"] = offset
	marker["clamped_anchor"] = clamped_anchor
	marker["point"] = point
	marker["desired_point"] = point
	marker["layout_offset"] = marker.get("layout_offset", Vector2.ZERO)
	marker["texture"] = texture
	marker["diameter"] = diameter
	marker["edge"] = edge
	marker["direction"] = bearing.normalized()
	marker["visible"] = visible
	if kind == "survivor":
		var survivor: Node3D = instance_from_id(int(id)) as Node3D
		marker["moving"] = _survivor_is_moving(survivor)
		marker["searching"] = _survivor_is_searching(survivor)
		marker["selected"] = selected
	if visible:
		town_markers.append(marker)

func _debug_dump_projection() -> void:
	print("[MiniMap Debug] Frame: %.0f x %.0f | Content: %.0f x %.0f | World Bounds: %s" % [size.x, size.y, minimap_content_rect.size.x, minimap_content_rect.size.y, var_to_str(town_bounds)])
	for marker: Dictionary in marker_pool.values():
		var visibility: String = "Visible" if bool(marker.visible) else "Hidden"
		print("[MiniMap Debug] Marker %s | World Position: %s | MiniMap Position: %s | Rounded Position: %s | %s" % [str(marker.id), var_to_str(marker.world), var_to_str(marker.projected_position), var_to_str(marker.rounded_position), visibility])

func _marker_offset(kind: String) -> Vector2:
	match kind:
		"survivor":
			return SURVIVOR_MARKER_OFFSET
		"vehicle":
			return VEHICLE_MARKER_OFFSET
		_:
			return Vector2.ZERO

func _survivor_is_moving(survivor: Node3D) -> bool:
	if survivor == null or not is_instance_valid(survivor):
		return false
	var speed_value: Variant = survivor.get("current_speed")
	if speed_value is float or speed_value is int:
		return float(speed_value) > 0.15
	var velocity_value: Variant = survivor.get("actual_velocity")
	var velocity: Vector3 = velocity_value if velocity_value is Vector3 else Vector3.ZERO
	return velocity.length() > 0.15

func _survivor_is_searching(survivor: Node3D) -> bool:
	return survivor != null and is_instance_valid(survivor) and bool(survivor.get("searching"))

func _draw_survivor_marker(point: Vector2, moving: bool, searching: bool, selected: bool = false, label: String = "") -> void:
	var core_color := Color("#f6f0df")
	var ring_color := Color("#b9d8d0")
	if searching:
		var start_angle: float = fmod(_marker_phase * TAU / 1.4, TAU)
		draw_arc(point, SURVIVOR_RING_RADIUS, start_angle, start_angle + SURVIVOR_SEARCH_ARC, 20, Color("#f2c06b"), SURVIVOR_RING_WIDTH + 0.2, true)
		draw_arc(point, SURVIVOR_RING_RADIUS, start_angle + PI, start_angle + PI + TAU * 0.14, 8, Color("#fff0b8"), 1.0, true)
	elif moving:
		draw_arc(point, SURVIVOR_RING_RADIUS, 0.0, TAU, 20, Color(ring_color, 0.72), SURVIVOR_RING_WIDTH, true)
	else:
		draw_arc(point, SURVIVOR_RING_RADIUS, 0.0, TAU, 20, ring_color, SURVIVOR_RING_WIDTH, true)
	if selected:
		draw_circle(point, 5.4, Color("#19324c"))
		draw_circle(point, 3.0, core_color)
		_draw_selected_survivor_name(point, label)
	else:
		draw_circle(point, 6.3, Color("#19324c"))
		draw_circle(point, SURVIVOR_CORE_RADIUS, core_color)
		var numeral: String = label
		if not numeral.is_empty():
			draw_string(ThemeDB.fallback_font, point + Vector2(-4.0, 3.1), numeral,
				HORIZONTAL_ALIGNMENT_LEFT, 9.0, 8, Color("#19324c"))

func _draw_selected_survivor_name(point: Vector2, label: String) -> void:
	if label.is_empty():
		return
	var font: Font = ThemeDB.fallback_font
	var text_width: float = font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 9).x
	var panel_size := Vector2(text_width + 8.0, 15.0)
	var panel := Rect2(point + Vector2(8.0, -18.0), panel_size)
	if not marker_rect.encloses(panel):
		panel.position = point - Vector2(panel.size.x + 8.0, 18.0)
	panel.position.x = clampf(panel.position.x, marker_rect.position.x, marker_rect.end.x - panel.size.x)
	panel.position.y = clampf(panel.position.y, marker_rect.position.y, marker_rect.end.y - panel.size.y)
	draw_rect(panel, Color("#19324cf2"), true)
	draw_rect(panel, Color("#b9d8d0"), false, 1.0)
	draw_string(font, panel.position + Vector2(4.0, 11.0), label, HORIZONTAL_ALIGNMENT_LEFT, text_width, 9, Color("#f6f0df"))

func _draw_town_markers() -> void:
	# Static TownWorldLayer renders behind this parent; keep the map surface transparent
	# here so cached terrain, roads, buildings, and Arrival polygons remain visible.
	var local: Rect2 = minimap_content_rect
	draw_rect(local.grow(2.0), Color("#112b46b8"), false, 1.0, true)
	var margins: Array[Rect2] = [
		Rect2(_area.position, Vector2(_area.size.x, local.position.y - _area.position.y)),
		Rect2(Vector2(_area.position.x, local.end.y), Vector2(_area.size.x, _area.end.y - local.end.y)),
		Rect2(Vector2(_area.position.x, local.position.y), Vector2(local.position.x - _area.position.x, local.size.y)),
		Rect2(Vector2(local.end.x, local.position.y), Vector2(_area.end.x - local.end.x, local.size.y))
	]
	for rect: Rect2 in margins:
		draw_rect(rect, Color("#304661"))
	_draw_danger_layer()
	_draw_fog_layer(local)
	var draw_order: Array[Dictionary] = town_markers.duplicate()
	draw_order.sort_custom(_marker_draws_after)
	for item: Dictionary in draw_order:
		if item.kind == "survivor":
			continue
		if item.edge:
			var tip: Vector2 = item.point + item.direction * (item.diameter * .5 + 2.0)
			var side: Vector2 = item.direction.orthogonal() * 2.5
			draw_line(tip - item.direction * 3.0 + side, tip, Color("#f6f0df"), 1.2, true)
			draw_line(tip - item.direction * 3.0 - side, tip, Color("#f6f0df"), 1.2, true)
		_draw_building_marker(item)
	_draw_survivor_clusters()
	_draw_exploration_scans()
	if discovery_notice_left > 0.0:
		_draw_discovery_notice()

class LocalWorldClip extends Control:
	func _draw() -> void:
		draw_rect(Rect2(Vector2.ZERO, size), Color("#304661"))

class TownWorldLayer extends Node2D:
	var commands: Array[Dictionary] = []
	var source: String = ""
	var drawn_source: String = ""

	func _draw() -> void:
		for command: Dictionary in commands:
			if command.has("polygon"):
				draw_colored_polygon(command.polygon, command.color)
				if command.has("outline_color"):
					var outline: PackedVector2Array = command.polygon.duplicate()
					outline.append(outline[0])
					draw_polyline(outline, command.outline_color, float(command.get("outline_width", 1.0)), true)
			elif command.get("outline", false):
				draw_rect(command.rect, command.color, false, 1.0)
			else:
				draw_rect(command.rect, command.color)
			if command.has("rect") and not command.get("outline", false):
				var rect: Rect2 = command.rect
				var color: Color = command.color
				if color == Color("#9aaec6"):
					draw_rect(rect.grow(0.18), Color("#d5e4e536"), false, 0.45)
				elif color == Color("#acb5c0"):
					draw_rect(rect.grow(0.12), Color("#f6f0df36"), false, 0.5)
		drawn_source = source
