extends Control
## Dynamic expedition minimap: projects live world entities into a compact tactical view.
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const SURVIVOR_DIAMETER: float = 18.0
const SURVIVOR_CORE_RADIUS: float = 2.25
const SURVIVOR_RING_RADIUS: float = 6.0
const SURVIVOR_RING_WIDTH: float = 1.35
const SURVIVOR_SEARCH_ARC: float = TAU * 0.78
const MARKER_MARGIN: float = 3.0
const TOWN_DYNAMIC_INTERVAL: float = 1.0 / 20.0
var mission: Node3D
var frame: TextureRect
var marker_bus: Texture2D
var marker_poi: Texture2D
var marker_target: Texture2D
var marker_search: Texture2D
var marker_vehicle: Texture2D
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
var _cached_size: Vector2 = Vector2.ZERO
var _area: Rect2
var _label_rect: Rect2
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
		if _town_dynamic_elapsed < TOWN_DYNAMIC_INTERVAL:
			return
		_town_dynamic_elapsed = fmod(_town_dynamic_elapsed, TOWN_DYNAMIC_INTERVAL)
	_sync_town()
	_update_town_markers()
	marker_update_count += 1
	queue_redraw()

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
	var label_rect := Rect2(area.position + Vector2(8, area.size.y - 32), Vector2(112, 24))
	draw_rect(label_rect, Color("#0c2338d9"), true)
	draw_string(ThemeDB.fallback_font, label_rect.position + Vector2(8, 15), mission.city.data.display_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("#d5e4e5"))

func _draw_marker(texture: Texture2D, point: Vector2, diameter: float) -> void:
	if texture == null: return
	if not Rect2(Vector2(22, 22), size - Vector2(44, 44)).has_point(point):
		return
	var dimensions: Vector2 = texture.get_size() * (diameter / maxf(texture.get_width(), texture.get_height()))
	var rect := Rect2(point - dimensions * .5, dimensions)
	draw_texture_rect(texture, rect, false)

func uses_town_runtime() -> bool:
	return is_instance_valid(mission) and mission.map_provider == "MEDIUM_TOWN_V1" and mission.runtime_data.has("minimap_geometry")

func world_to_minimap(world_pos: Vector3) -> Vector2:
	return map_origin + Vector2(world_pos.x, world_pos.z) * map_scale

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
		var available: Rect2 = Rect2(_area.position + Vector2(2, 2), (_area.size - Vector2(4, 30)).max(Vector2.ONE))
		var side: float = minf(available.size.x, available.size.y)
		minimap_content_rect = Rect2(available.get_center() - Vector2.ONE * side * .5, Vector2.ONE * side)
		marker_rect = minimap_content_rect
		world_clip.position = minimap_content_rect.position
		world_clip.size = minimap_content_rect.size
		_label_rect = Rect2(_area.position + Vector2(8, _area.size.y - 26), Vector2(140, 22))
		world_clip.queue_redraw()
	follow_center = mission.squad_center()
	map_scale = minimap_content_rect.size.x / (local_world_extent * 2.0)
	map_origin = minimap_content_rect.get_center() - Vector2(follow_center.x, follow_center.z) * map_scale
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
	# Known landmarks retain their exact anchors before nearby icons are separated.
	_append_town_marker("arrival", mission.runtime_data.arrival_point, marker_bus, 20.0)
	var poi_id: String = mission.runtime_data.mission_poi_id
	var poi_texture: Texture2D = marker_search if mission.search_tasks.has(poi_id) else marker_target
	_append_town_marker("poi", mission.runtime_data.mission_poi, poi_texture, 20.0)
	for member: Node3D in mission.survivors:
		if member.dead:
			continue
		_append_town_marker(member.get_instance_id(), member.position, null, SURVIVOR_DIAMETER, "survivor")
	# Presentation consumes discovery state without creating sites or SearchTasks.
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		if not site.discovered or id == poi_id:
			continue
		var texture: Texture2D = _site_marker_texture(id, site)
		_append_town_marker("site:" + id, site.spec.entry, texture, 18.0, "site")

func _site_marker_texture(id: String, site: Dictionary) -> Texture2D:
	if mission.search_tasks.has(id):
		return marker_search
	if bool(site.get("vehicle", false)):
		return marker_vehicle
	if mission.poi_selected_id == id:
		return marker_target
	return marker_poi

func _append_town_marker(id: Variant, world: Vector3, texture: Texture2D, diameter: float, kind: String = "landmark") -> void:
	var anchor: Vector2 = world_to_minimap(world)
	var inset: Rect2 = marker_rect.grow(-diameter * .5 - MARKER_MARGIN)
	var bearing: Vector2 = anchor - minimap_content_rect.get_center()
	var edge: bool = not minimap_content_rect.has_point(anchor)
	var clamped_anchor: Vector2 = anchor.clamp(inset.position, inset.end)
	if edge:
		var ratio: float = maxf(absf(bearing.x) / (inset.size.x * .5), absf(bearing.y) / (inset.size.y * .5))
		clamped_anchor = inset.get_center() + bearing / ratio
	var point: Vector2 = clamped_anchor
	# Stable roster order plus fixed candidates keeps close squad icons readable.
	# A tether retains the exact map position instead of falsifying world coordinates.
	var found: bool = false
	for ring: int in 9:
		for direction: int in (1 if ring == 0 else 16):
			var offset: Vector2 = Vector2.from_angle(direction * TAU / 16.0) * ring * 12.0
			if edge:
				# Keep out-of-window landmarks on the edge, including crowded bearings.
				if absf(clamped_anchor.x - inset.get_center().x) >= inset.size.x * .5 - .01:
					offset.x = 0.0
				else:
					offset.y = 0.0
			var candidate: Vector2 = (clamped_anchor + offset).clamp(inset.position, inset.end)
			var clear: bool = true
			for other: Dictionary in town_markers:
				if candidate.distance_to(other.point) < (diameter + other.diameter) * .5 + MARKER_MARGIN * 2.0:
					clear = false
					break
			if clear:
				point = candidate
				found = true
				break
		if found:
			break
	var marker: Dictionary = {"id": id, "kind": kind, "world": world, "anchor": anchor, "clamped_anchor": clamped_anchor, "point": point, "texture": texture, "diameter": diameter, "edge": edge, "direction": bearing.normalized()}
	if kind == "survivor":
		var survivor: Node3D = instance_from_id(int(id)) as Node3D
		marker["moving"] = _survivor_is_moving(survivor)
		marker["searching"] = _survivor_is_searching(survivor)
	town_markers.append(marker)

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

func _draw_survivor_marker(point: Vector2, moving: bool, searching: bool) -> void:
	var core_color := Color("#f6f0df")
	var ring_color := Color("#b9d8d0")
	if searching:
		var start_angle: float = fmod(_marker_phase * TAU / 1.4, TAU)
		draw_arc(point, SURVIVOR_RING_RADIUS, start_angle, start_angle + SURVIVOR_SEARCH_ARC, 20, Color("#f2c06b"), SURVIVOR_RING_WIDTH + 0.2, true)
		draw_arc(point, SURVIVOR_RING_RADIUS, start_angle + PI, start_angle + PI + TAU * 0.14, 8, Color("#fff0b8"), 1.0, true)
	elif moving:
		var pulse: float = 0.5 + 0.5 * sin(_marker_phase * TAU / 1.8)
		draw_arc(point, SURVIVOR_RING_RADIUS + pulse * 0.9, 0.0, TAU, 20, Color(ring_color, 0.52 + pulse * 0.28), SURVIVOR_RING_WIDTH, true)
	else:
		draw_arc(point, SURVIVOR_RING_RADIUS, 0.0, TAU, 20, ring_color, SURVIVOR_RING_WIDTH, true)
	draw_circle(point, SURVIVOR_CORE_RADIUS, core_color)

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
	for item: Dictionary in town_markers:
		var anchor: Vector2 = item.clamped_anchor if item.edge else item.anchor
		if item.point.distance_to(anchor) > 2.0:
			draw_line(anchor, item.point, Color("#d5e4e5a0"), 1.0, true)
			draw_circle(anchor, 1.5, Color("#d5e4e5"))
	for item: Dictionary in town_markers:
		if item.kind == "survivor":
			_draw_survivor_marker(item.point, bool(item.get("moving", false)), bool(item.get("searching", false)))
		else:
			_draw_marker(item.texture, item.point, item.diameter)
		if item.edge:
			var tip: Vector2 = item.point + item.direction * (item.diameter * .5 + 2.0)
			var side: Vector2 = item.direction.orthogonal() * 2.5
			draw_line(tip - item.direction * 3.0 + side, tip, Color("#f6f0df"), 1.2, true)
			draw_line(tip - item.direction * 3.0 - side, tip, Color("#f6f0df"), 1.2, true)
	draw_rect(_label_rect, Color("#0c2338d9"))
	draw_string(ThemeDB.fallback_font, _label_rect.position + Vector2(8, 15), "Medium Town V1", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("#d5e4e5"))

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
