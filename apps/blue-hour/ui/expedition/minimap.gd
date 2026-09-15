extends Control
## Dynamic expedition minimap: projects live world entities into a compact tactical view.
const HudArt = preload("res://ui/expedition/hud_skin.gd")
var mission: Node3D
var frame: TextureRect
var marker_player: Texture2D
var marker_teammate: Texture2D
var marker_danger: Texture2D
var marker_bus: Texture2D
var marker_poi: Texture2D
var marker_target: Texture2D
var marker_search: Texture2D

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
	set_process(true)
	queue_redraw()

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	if mission == null: return
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
		if member == get_parent().selected_member:
			continue
		var texture := marker_danger if member.hp < member.data.max_hp * .5 else marker_teammate
		_draw_marker(texture, project.call(member.position), 12.0)
	var selected: Node3D = get_parent().selected_member
	if is_instance_valid(selected) and not selected.dead:
		_draw_marker(marker_player, project.call(selected.position), 24.0)
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
