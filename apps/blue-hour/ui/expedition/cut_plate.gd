extends StyleBox
## Shared, nine-point expedition surface. No per-frame textures or blur passes.
var fill := Color("#142a38e8")
var edge := Color("#63858b88")
var cut: float = 7.0
var clock_face: bool = false

func _draw(canvas: RID, rect: Rect2) -> void:
	if rect.size.x <= .1 or rect.size.y <= .1:
		return
	if clock_face:
		_draw_clock(canvas, rect)
		return
	var a := rect.position
	var b := rect.end
	var c := minf(cut, minf(rect.size.x, rect.size.y) * .3)
	var points := PackedVector2Array([a + Vector2(c, 0), Vector2(b.x, a.y), b - Vector2(0, c), b - Vector2(c, 0), Vector2(a.x, b.y), a + Vector2(0, c)])
	RenderingServer.canvas_item_add_polygon(canvas, points, PackedColorArray([fill]))
	points.append(points[0])
	RenderingServer.canvas_item_add_polyline(canvas, points, PackedColorArray([edge]), 1.0, true)

func _draw_clock(canvas: RID, rect: Rect2) -> void:
	var center := rect.get_center()
	var radius := rect.size * Vector2(.5, .5)
	var face := PackedVector2Array()
	for i: int in range(33):
		var angle: float = TAU * i / 32.0
		face.append(center + Vector2(cos(angle), sin(angle)) * radius)
	RenderingServer.canvas_item_add_polygon(canvas, face, PackedColorArray([fill]))
	for side: int in [-1, 1]:
		var points := PackedVector2Array()
		for i: int in range(17):
			var angle: float = lerpf(-.8, .8, i / 16.0)
			points.append(center + Vector2(cos(angle) * side, sin(angle)) * radius)
		RenderingServer.canvas_item_add_polyline(canvas, points, PackedColorArray([edge]), 1.0, true)
		for i: int in range(-2, 3):
			var point := center + Vector2(side * (radius.x - 7), i * 8)
			RenderingServer.canvas_item_add_line(canvas, point, point - Vector2(side * (7 if i == 0 else 3), 0), edge, 1.0, true)
