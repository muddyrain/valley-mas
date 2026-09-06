extends PanelContainer

func _ready() -> void:
	resized.connect(queue_redraw)

func _draw() -> void:
	var highlight = Color("849078")
	var shadow = Color("172e2c")
	draw_line(Vector2(5, 5), Vector2(size.x - 5, 5), highlight, 1)
	draw_line(Vector2(5, 5), Vector2(5, size.y - 5), highlight, 1)
	draw_line(Vector2(5, size.y - 5), size - Vector2(5, 5), shadow, 2)
	for corner in [Vector2(5,5), Vector2(size.x - 11,5), Vector2(5,size.y - 11), size - Vector2(11,11)]:
		draw_rect(Rect2(corner, Vector2(6,6)), shadow)
		draw_rect(Rect2(corner + Vector2.ONE, Vector2(3,3)), highlight)
