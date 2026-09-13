extends Control
## Dynamic expedition minimap: projects live world entities into a compact tactical view.
const HudArt = preload("res://ui/expedition/hud_skin.gd")
var mission: Node3D
var frame: Texture2D
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
	frame = HudArt.texture("hud_minimap_frame")
	marker_player = HudArt.texture("map_player_marker")
	marker_teammate = HudArt.texture("map_teammate_marker")
	marker_danger = HudArt.texture("map_teammate_danger")
	marker_bus = HudArt.texture("map_bus_marker")
	marker_poi = HudArt.texture("map_poi_marker")
	marker_target = HudArt.texture("map_target_marker")
	marker_search = HudArt.texture("map_search_marker")
	set_process(true)
	queue_redraw()

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	if mission == null: return
	var area := Rect2(Vector2(16, 16), size - Vector2(32, 32))
	# The map stays live, but the old evenly spaced debug grid is replaced by a quiet tactical base.
	draw_rect(area, Color("#102b42e8"), true)
	var street_color := Color("#aec5cc", 0.16)
	draw_line(area.position + Vector2(area.size.x * .04, area.size.y * .72), area.position + Vector2(area.size.x * .78, area.size.y * .10), street_color, 3.0, true)
	draw_line(area.position + Vector2(area.size.x * .20, area.size.y * .98), area.position + Vector2(area.size.x * .94, area.size.y * .30), street_color, 2.0, true)
	draw_line(area.position + Vector2(area.size.x * .02, area.size.y * .34), area.position + Vector2(area.size.x * .62, area.size.y * .02), street_color, 2.0, true)
	if frame != null:
		draw_texture_rect(frame, Rect2(Vector2.ZERO, size), false)
	else:
		draw_rect(area, Color("#9eb9c5", .45), false, 2.0)
	var center: Vector3 = mission.squad_center()
	var extent := 34.0
	var project := func(world: Vector3) -> Vector2:
		var p := Vector2((world.x - center.x) / extent, (world.z - center.z) / extent)
		return area.get_center() + Vector2(p.x, p.y) * area.size * .46
	if mission.city != null:
		var bus: Vector3 = mission.catalog.map.bus_position
		_draw_marker(marker_bus, project.call(bus), 28.0)
		for id: String in mission.city.sites:
			var site: Dictionary = mission.city.sites[id]
			if not site.discovered: continue
			var texture := marker_search if mission.search_tasks.has(id) else marker_target if mission.poi_selected_id == id else marker_poi
			_draw_marker(texture, project.call(site.spec.entry), 22.0)
	for member: Node3D in mission.survivors:
		if member.dead: continue
		var texture := marker_player if member == get_parent().selected_member else marker_danger if member.hp < member.data.max_hp * .5 else marker_teammate
		_draw_marker(texture, project.call(member.position), 28.0 if member == get_parent().selected_member else 22.0)
	var label_rect := Rect2(area.position + Vector2(8, area.size.y - 27), Vector2(94, 21))
	draw_rect(label_rect, Color("#0c2338d9"), true)
	draw_string(ThemeDB.fallback_font, label_rect.position + Vector2(8, 15), "东岸城区", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#d5e4e5"))

func _draw_marker(texture: Texture2D, point: Vector2, diameter: float) -> void:
	if texture == null: return
	var rect := Rect2(point - Vector2.ONE * diameter * .5, Vector2.ONE * diameter)
	draw_texture_rect(texture, rect, false)
