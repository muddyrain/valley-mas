extends StyleBox
## Preserve the supplied border, omit baked sample meters inside the artwork.
var border: StyleBoxTexture
var interior := Color("#102939ed")
var bottom_inset: float = 0.0

func _draw(canvas_item: RID, rect: Rect2) -> void:
	rect.size.y = maxf(0, rect.size.y - bottom_inset)
	var before := Vector2(border.texture_margin_left, border.texture_margin_top)
	var after := Vector2(border.texture_margin_right, border.texture_margin_bottom)
	var ratio := (rect.size / (before + after)).min(Vector2.ONE)
	var center := Rect2(rect.position + before * ratio, (rect.size - (before + after) * ratio).max(Vector2.ZERO))
	RenderingServer.canvas_item_add_rect(canvas_item, center, interior)
	border.draw(canvas_item, rect)
