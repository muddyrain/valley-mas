extends Node2D

var result: Dictionary = {}
var camera: Camera3D
var slots: bool = true
var categories: bool = true
var clear_zones: bool = false

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	if camera == null:
		return
	if slots:
		for slot: Dictionary in result.slots:
			_polygon(slot.polygon, Color(0.3, 0.8, 0.9, 0.5))
	if clear_zones:
		for zone: Dictionary in result.clear_zones:
			_polygon(preload("res://maps/town/environment/environment_geometry.gd").polygon(zone.bounds), Color(1.0, 0.3, 0.25, 0.65))
	if categories:
		for item: Dictionary in result.instances:
			var color := Color("80c967") if item.asset.begins_with("VEG") else Color("e4c76c") if item.asset.begins_with("VEH") else Color("b597d2")
			draw_circle(camera.unproject_position(item.position + Vector3.UP), 3.0, color)

func _polygon(points: PackedVector2Array, color: Color) -> void:
	var screen := PackedVector2Array()
	for point: Vector2 in points:
		screen.append(camera.unproject_position(Vector3(point.x, 0.2, point.y)))
	screen.append(screen[0])
	draw_polyline(screen, color, 1.0, true)
