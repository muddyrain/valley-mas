extends Node2D
## Screen-space planning diagnostics; the clean capture never includes this layer.

const COLORS := {"COMMERCIAL_CORE": Color("#ed867f"), "RESIDENTIAL_A": Color("#74b9ed"), "RESIDENTIAL_B": Color("#87d2ce"), "MIXED_TRANSITION": Color("#edbe68"), "INDUSTRIAL_SERVICE": Color("#caa2e3"), "OPEN_SPACE": Color("#9ace74")}
const ROUTE_COLORS: Array[Color] = [Color("#f3d463"), Color("#ff7791"), Color("#60e8e4")]
const LABELS := {"COMMERCIAL_CORE": "CORE", "RESIDENTIAL_A": "HOMES A", "RESIDENTIAL_B": "HOMES B", "MIXED_TRANSITION": "MIXED", "INDUSTRIAL_SERVICE": "SERVICE", "OPEN_SPACE": "PARK"}
var town: Dictionary
var camera: Camera3D
var zones: bool = true
var routes: bool = true
var arrivals: bool = true
var poi: bool = true

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	if town.is_empty() or camera == null:
		return
	if zones:
		var centers: Dictionary = {}
		for block: Dictionary in town.blocks:
			var color: Color = COLORS[block.land_use_type]
			var outline := PackedVector2Array()
			for point: Vector2 in block.polygon:
				outline.append(_screen(point))
			draw_colored_polygon(outline, Color(color, 0.25))
			outline.append(outline[0])
			draw_polyline(outline, color, 2, true)
			if not centers.has(block.land_use_type):
				centers[block.land_use_type] = _screen(block.center)
		for kind: String in centers:
			_label(centers[kind] + Vector2(0, -18), LABELS[kind], COLORS[kind])
	if routes:
		for index: int in town.exploration_routes.size():
			var route: Dictionary = town.exploration_routes[index]
			var path := PackedVector2Array()
			for point: Vector2 in route.points:
				path.append(_screen(point) + Vector2(index * 4 - 4, index * 4 - 4))
			draw_polyline(path, ROUTE_COLORS[index], 3, true)
	if arrivals:
		for index: int in town.arrival_candidates.size():
			var candidate: Dictionary = town.arrival_candidates[index]
			var at := camera.unproject_position(candidate.position)
			draw_circle(at, 7, Color("#79bcff"))
			_label(at + Vector2(40, -12), "ARRIVAL" if candidate.id == town.arrival.id else "C%d" % (index + 1), Color.WHITE)
	if poi:
		var at := camera.unproject_position(town.poi.position)
		draw_circle(at, 12, Color("#ff829e"), false, 3, true)
		_label(at + Vector2(0, -24), "POI", Color("#ffb1c4"))
	var y := 48.0
	for index: int in town.exploration_routes.size():
		if routes:
			var route: Dictionary = town.exploration_routes[index]
			_label(Vector2(175, y), "%s  %.0f m" % [route.id, route.length], ROUTE_COLORS[index])
			y += 26
	if zones:
		for kind: String in COLORS:
			_label(Vector2(185, y + 55), kind, COLORS[kind])
			y += 27

func _screen(point: Vector2) -> Vector2:
	return camera.unproject_position(Vector3(point.x, 0.2, point.y))

func _label(at: Vector2, text: String, color: Color) -> void:
	var font: Font = ThemeDB.fallback_font
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
	var position := at - Vector2(width * 0.5, 0)
	draw_string_outline(font, position, text, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 5, Color("#22312d"))
	draw_string(font, position, text, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, color)
