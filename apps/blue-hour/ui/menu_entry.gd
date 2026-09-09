extends Button
const Art = preload("res://ui/menu_art.gd")
const NORMAL = preload("res://assets/ui/main_menu/icons_normal.png")
const HOVER = preload("res://assets/ui/main_menu/icons_hover.png")
var icon_index := 0
var lit := false
var paper_style: StyleBoxTexture

func setup(label_text: String, index: int, action: Callable) -> void:
	text = label_text
	icon_index = index
	custom_minimum_size = Vector2(373, 70)
	focus_mode = Control.FOCUS_ALL
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	alignment = HORIZONTAL_ALIGNMENT_LEFT
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei UI", "Microsoft YaHei"])
	font.font_weight = 700
	add_theme_font_override("font", font)
	add_theme_font_size_override("font_size", 34 if index == 0 else 30)
	var empty := StyleBoxEmpty.new()
	empty.content_margin_left = 94
	empty.content_margin_right = 50
	for state in ["normal", "hover", "pressed", "focus", "disabled"]:
		add_theme_stylebox_override(state, empty)
	paper_style = Art.paper()
	paper_style.region_rect = Rect2(134,164,1903,390)
	pressed.connect(action)
	mouse_entered.connect(grab_focus)
	focus_entered.connect(_refresh)
	focus_exited.connect(_refresh)
	button_down.connect(queue_redraw)
	button_up.connect(queue_redraw)
	_refresh()

func _refresh() -> void:
	lit = has_focus()
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		add_theme_color_override(state, Color.TRANSPARENT)
	queue_redraw()

func _draw() -> void:
	var rect := Rect2(Vector2.ZERO, size)
	if lit:
		rect = rect.grow(4)
		var glow := StyleBoxFlat.new()
		glow.bg_color = Color("#3c7da7")
		glow.set_corner_radius_all(10)
		glow.shadow_color = Color(.26, .67, 1, .5)
		glow.shadow_size = 16
		glow.draw(get_canvas_item(), rect)
	paper_style.modulate_color = Color(.25, .55, .80) if lit else Color(.96, .96, .96)
	if is_pressed():
		paper_style.modulate_color = paper_style.modulate_color.darkened(.12)
	paper_style.draw(get_canvas_item(), rect)
	if lit:
		var rim := rect.grow(-6)
		var c := 7.0
		var points := PackedVector2Array([rim.position + Vector2(c,0), Vector2(rim.end.x-c,rim.position.y), Vector2(rim.end.x,rim.position.y+c), rim.end-Vector2(0,c), rim.end-Vector2(c,0), Vector2(rim.position.x+c,rim.end.y), Vector2(rim.position.x,rim.end.y-c), rim.position+Vector2(0,c), rim.position+Vector2(c,0)])
		draw_polyline(points, Color("#d5f3ff"), 2, true)
	var icon_rect := Rect2(Vector2(8, (size.y-72)/2), Vector2(72,72))
	draw_texture_rect_region(HOVER if lit else NORMAL, icon_rect, Rect2(0, icon_index*128,128,128))
	var arrow := Vector2(size.x-36, size.y/2)
	var ink := Color("#f5f6ef") if lit else Color("#183146")
	var font := get_theme_font("font")
	var font_size := get_theme_font_size("font_size")
	var baseline := size.y/2 + font.get_ascent(font_size) - font.get_height(font_size)/2
	var pen := Vector2(102 if icon_index == 0 else 94, baseline)
	for character in text:
		draw_string(font, pen, character, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, ink)
		pen.x += font.get_string_size(character, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x + (3 if icon_index == 0 else 2)
	draw_polyline(PackedVector2Array([arrow+Vector2(-5,-8),arrow+Vector2(3,0),arrow+Vector2(-5,8)]), ink, 3, true)
