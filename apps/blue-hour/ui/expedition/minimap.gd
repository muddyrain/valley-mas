extends Control
## Dynamic expedition minimap: projects live world entities into a compact tactical view.
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const SURVIVOR_DIAMETER: float = 18.0
const MARKER_MARGIN: float = 3.0
var mission: Node3D
var frame: TextureRect
var marker_player: Texture2D
var marker_teammate: Texture2D
var marker_danger: Texture2D
var marker_bus: Texture2D
var marker_poi: Texture2D
var marker_target: Texture2D
var marker_search: Texture2D
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

func setup(target: Node3D) -> void:
	mission = target
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame = HudArt.picture("minimap_frame", Vector2.ZERO)
	frame.name = "Frame"
	add_child(frame)
	frame.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	marker_player = HudArt.texture("map_player_marker")
	marker_teammate = HudArt.texture("map_teammate_marker")
	marker_danger = HudArt.texture("map_teammate_danger")
	marker_bus = HudArt.texture("icon_vehicle_bus")
	marker_poi = HudArt.texture("map_poi_marker")
	marker_target = HudArt.texture("map_target_marker")
	marker_search = HudArt.texture("map_search_marker")
	world_clip = LocalWorldClip.new()
	world_clip.name = "LocalWorldClip"
	world_clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	world_clip.clip_contents = true
	world_clip.show_behind_parent = true
	add_child(world_clip)
	static_layer = TownWorldLayer.new()
	static_layer.name = "TownWorldLayer"
	static_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	world_clip.add_child(static_layer)
	_sync_town()
	set_process(true)
	queue_redraw()

func _process(_delta: float) -> void:
	_sync_town()
	if uses_town_runtime():
		_update_town_markers()
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
	var selected: Node3D = get_parent().selected_member
	for member: Node3D in mission.survivors:
		if member.dead: continue
		var point: Vector2 = project.call(member.position)
		_draw_marker(marker_player, point, SURVIVOR_DIAMETER)
		if member == selected and area.grow(-12.0).has_point(point):
			draw_arc(point, SURVIVOR_DIAMETER * .5 + 2.0, 0, TAU, 24, Color("#f6f0df"), 1.2, true)
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
		town_markers.clear()
		return
	var runtime: Dictionary = mission.runtime_data
	var source: String = "%s:%s" % [runtime.seed, runtime.source_signatures.town]
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
	static_layer.commands.clear()
	static_layer.commands.append({"rect": town_bounds, "color": Color("#304661")})
	static_layer.commands.append({"rect": town_bounds, "color": Color("#6f7d84"), "outline": true})
	var geometry: Dictionary = runtime.minimap_geometry
	for region: Dictionary in geometry.regions:
		var green: bool = region.kind in ["small_park", "community_green", "backyard", "green_buffer"]
		static_layer.commands.append({"polygon": region.polygon, "color": Color("#52676a") if green else Color("#526783")})
	for bounds: Rect2 in runtime.road_bounds:
		_cache_world_rect(bounds, Color("#9aaec6"))
	for building: Dictionary in geometry.buildings:
		_cache_world_rect(building.bounds, Color("#acb5c0"))
	static_layer.queue_redraw()
	static_build_count += 1
	static_build_ms = (Time.get_ticks_usec() - started) / 1000.0

func _cache_world_rect(bounds: Rect2, color: Color) -> void:
	static_layer.commands.append({"rect": bounds, "color": color})

func _update_town_markers() -> void:
	town_markers.clear()
	# Known landmarks retain their exact anchors before nearby icons are separated.
	_append_town_marker("arrival", mission.runtime_data.arrival_point, marker_bus, 20.0)
	var poi_id: String = mission.runtime_data.mission_poi_id
	var poi_texture: Texture2D = marker_search if mission.search_tasks.has(poi_id) else marker_target
	_append_town_marker("poi", mission.runtime_data.mission_poi, poi_texture, 20.0)
	var selected: Node3D = null
	if get_parent().get("selected_member") is Node3D:
		selected = get_parent().get("selected_member")
	for member: Node3D in mission.survivors:
		if member.dead:
			continue
		_append_town_marker(member.get_instance_id(), member.position, marker_player, SURVIVOR_DIAMETER, "survivor", member == selected)
	# Presentation consumes discovery state without creating sites or SearchTasks.
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		if not site.discovered or id == poi_id:
			continue
		var texture: Texture2D = marker_search if mission.search_tasks.has(id) else marker_target if mission.poi_selected_id == id else marker_poi
		_append_town_marker("site:" + id, site.spec.entry, texture, 18.0, "site")

func _append_town_marker(id: Variant, world: Vector3, texture: Texture2D, diameter: float, kind: String = "landmark", selected: bool = false) -> void:
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
	town_markers.append({"id": id, "kind": kind, "world": world, "anchor": anchor, "clamped_anchor": clamped_anchor, "point": point, "texture": texture, "diameter": diameter, "edge": edge, "direction": bearing.normalized(), "selected": selected})

func _draw_town_markers() -> void:
	# Fill the existing rectangular frame around the square local-world clip.
	var local: Rect2 = minimap_content_rect
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
		_draw_marker(item.texture, item.point, item.diameter)
		if item.selected:
			draw_arc(item.point, item.diameter * .5 + 2.0, 0, TAU, 24, Color("#f6f0df"), 1.2, true)
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

class TownWorldLayer extends Control:
	var commands: Array[Dictionary] = []

	func _draw() -> void:
		for command: Dictionary in commands:
			if command.has("polygon"):
				draw_colored_polygon(command.polygon, command.color)
			elif command.get("outline", false):
				draw_rect(command.rect, command.color, false, 1.0)
			else:
				draw_rect(command.rect, command.color)
