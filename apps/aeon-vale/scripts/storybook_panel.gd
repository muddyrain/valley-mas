extends PanelContainer

func _ready() -> void:
	resized.connect(queue_redraw)

func _draw() -> void:
	var gold = Color("bca879")
	gold.a = .65
	for corner in [Vector2(12,12), Vector2(size.x-12,12), Vector2(12,size.y-12), size-Vector2(12,12)]:
		var direction = Vector2(1 if corner.x < size.x/2 else -1, 1 if corner.y < size.y/2 else -1)
		draw_line(corner + direction*Vector2(4,0), corner + direction*Vector2(30,0), gold, 1, true)
		draw_line(corner + direction*Vector2(0,4), corner + direction*Vector2(0,20), gold, 1, true)
		var leaf = PackedVector2Array([corner,corner+direction*Vector2(5,1),corner+direction*Vector2(8,8),corner+direction*Vector2(1,5)])
		draw_colored_polygon(leaf, Color("bdc99d"))
