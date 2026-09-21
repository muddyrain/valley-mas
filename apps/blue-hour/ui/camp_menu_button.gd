extends StateButton
## Compact Camp overlay action with the shared fixed-hit-area state transition.

const MenuArt = preload("res://ui/menu_art.gd")

var _font := SystemFont.new()


func setup(label_text: String, action: Callable) -> void:
	text = label_text
	custom_minimum_size = Vector2(0, 60)
	focus_mode = Control.FOCUS_ALL
	focus_as_hover = true
	hover_duration = 0.12
	pressed_scale = 1.0
	_font.font_names = PackedStringArray(["Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC"])
	_font.font_weight = 700
	for style_name: String in ["normal", "hover", "pressed", "hover_pressed", "focus", "disabled"]:
		add_theme_stylebox_override(style_name, StyleBoxEmpty.new())
	for color_name: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_disabled_color"]:
		add_theme_color_override(color_name, Color.TRANSPARENT)
	pressed.connect(action)
	initialize_visuals()
	visual_state_changed.connect(queue_redraw)
	queue_redraw()


func _draw() -> void:
	var normal_alpha: float = weights.x
	var hover_alpha: float = weights.y + weights.z
	var disabled_alpha: float = weights.w
	_draw_surface(Color("#183146"), Color("#6d8797"), normal_alpha)
	_draw_surface(Color("#2d596d"), Color("#f3efe4"), hover_alpha)
	_draw_surface(Color("#142536"), Color("#526879"), disabled_alpha)
	var text_color := MenuArt.WHITE.lerp(Color.WHITE, hover_alpha)
	if disabled_alpha > 0.0:
		text_color = text_color.lerp(Color("#728897"), disabled_alpha)
	text_color.a = maxf(normal_alpha + hover_alpha + disabled_alpha, 0.0)
	var font_size := 21
	var text_position := Vector2(24, size.y * 0.5 + _font.get_ascent(font_size) - _font.get_height(font_size) * 0.5)
	draw_string(_font, text_position, text, HORIZONTAL_ALIGNMENT_LEFT, size.x - 72, font_size, text_color)
	var arrow := Vector2(size.x - 28, size.y * 0.5)
	draw_polyline(
		PackedVector2Array([arrow + Vector2(-5, -7), arrow + Vector2(2, 0), arrow + Vector2(-5, 7)]),
		text_color,
		2.0,
		true,
	)
	if press_amount > 0.0:
		draw_rect(Rect2(Vector2.ZERO, size), Color(0.0, 0.0, 0.0, 0.14 * press_amount), true)


func _draw_surface(fill: Color, border: Color, alpha: float) -> void:
	if alpha <= 0.001:
		return
	var style := StyleBoxFlat.new()
	style.bg_color = Color(fill.r, fill.g, fill.b, fill.a * alpha)
	style.border_color = Color(border.r, border.g, border.b, border.a * alpha)
	style.set_border_width_all(1)
	style.set_corner_radius_all(4)
	style.draw(get_canvas_item(), Rect2(Vector2.ZERO, size))
