extends ProgressBar
## Clip the fill in its native canvas proportions so damage never squeezes the end caps.
const HudArt = preload("res://ui/expedition/hud_skin.gd")
var background: Texture2D = HudArt.texture("hp_friendly_bg")
var fill: Texture2D = HudArt.texture("hp_friendly_fill")

func _init() -> void:
	show_percentage = false
	step = 0
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	texture_repeat = CanvasItem.TEXTURE_REPEAT_DISABLED
	add_theme_stylebox_override("background", StyleBoxEmpty.new())
	add_theme_stylebox_override("fill", StyleBoxEmpty.new())
	value_changed.connect(func(_value: float): queue_redraw())
	resized.connect(queue_redraw)

func _draw() -> void:
	var bar_height := minf(5.0, size.y)
	var rect := Rect2(0, (size.y - bar_height) * 0.5, size.x, bar_height)
	draw_rect(rect, Color("#3f4b50"), true)
	var fraction: float = clampf(ratio, 0, 1)
	if fraction > 0.0:
		draw_rect(Rect2(rect.position, Vector2(rect.size.x * fraction, rect.size.y)), Color("#d8a45e"), true)
