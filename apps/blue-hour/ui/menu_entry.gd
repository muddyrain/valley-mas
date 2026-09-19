extends StateButton

const Art = preload("res://ui/menu_art.gd")
const NORMAL = preload("res://assets/ui/main_menu/main_menu_navigation_icons_normal.png")
const HOVER = preload("res://assets/ui/main_menu/main_menu_navigation_icons_hover.png")

var icon_index: int = 0
var lit: bool = false
var paper_style: StyleBoxTexture

func setup(label_text: String, index: int, action: Callable) -> void:
	text = label_text
	icon_index = index
	custom_minimum_size = Vector2(373, 70)
	focus_mode = Control.FOCUS_ALL
	focus_as_hover = true
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
	for style_name: String in ["normal", "hover", "pressed", "focus", "disabled"]:
		add_theme_stylebox_override(style_name, empty)
	paper_style = Art.paper()
	paper_style.region_rect = Rect2(134, 164, 1903, 390)
	pressed.connect(action)
	mouse_entered.connect(grab_focus)
	focus_entered.connect(_refresh)
	focus_exited.connect(_refresh)
	visual_state_changed.connect(_refresh)
	set_state_textures(_icon_region(NORMAL, index), _icon_region(HOVER, index))
	_set_icon_layers()
	_refresh()

func _icon_region(texture: Texture2D, index: int) -> AtlasTexture:
	var region := AtlasTexture.new()
	region.atlas = texture
	region.region = Rect2(0, index * 128, 128, 128)
	region.filter_clip = true
	return region

func _set_icon_layers() -> void:
	for layer: TextureRect in [normal_layer, hover_layer]:
		layer.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
		layer.position = Vector2(8, -1)
		layer.size = Vector2(72, 72)
		layer.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		layer.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED

func _refresh() -> void:
	lit = state == VisualState.HOVER or state == VisualState.SELECTED or has_focus()
	for color_name: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		add_theme_color_override(color_name, Color.TRANSPARENT)
	queue_redraw()

func _draw() -> void:
	var hover_amount: float = weights.y + weights.z
	var rect := Rect2(Vector2.ZERO, size)
	var glow := StyleBoxFlat.new()
	glow.bg_color = Color(0.235, 0.49, 0.655, 0.18 * hover_amount)
	glow.set_corner_radius_all(10)
	glow.shadow_color = Color(0.26, 0.67, 1, 0.5 * hover_amount)
	glow.shadow_size = 16
	if hover_amount > 0.01:
		glow.draw(get_canvas_item(), rect.grow(4))
	var paper_color := Color(0.96, 0.96, 0.96).lerp(Color(0.25, 0.55, 0.80), hover_amount)
	if is_pressed():
		paper_color = paper_color.darkened(0.12)
	paper_style.modulate_color = paper_color
	paper_style.draw(get_canvas_item(), rect)
	if hover_amount > 0.01:
		var rim := rect.grow(-6)
		var c := 7.0
		var points := PackedVector2Array([
			rim.position + Vector2(c, 0),
			Vector2(rim.end.x - c, rim.position.y),
			Vector2(rim.end.x, rim.position.y + c),
			rim.end - Vector2(0, c),
			rim.end - Vector2(c, 0),
			Vector2(rim.position.x + c, rim.end.y),
			Vector2(rim.position.x, rim.end.y - c),
			rim.position + Vector2(0, c),
			rim.position + Vector2(c, 0),
		])
		draw_polyline(points, Color(0.835, 0.953, 1.0, hover_amount), 2, true)
	var arrow := Vector2(size.x - 36, size.y / 2)
	var ink := Color("#183146").lerp(Color("#f5f6ef"), hover_amount)
	var font := get_theme_font("font")
	var font_size := get_theme_font_size("font_size")
	var baseline := size.y / 2 + font.get_ascent(font_size) - font.get_height(font_size) / 2
	var pen := Vector2(102 if icon_index == 0 else 94, baseline)
	for character: String in text:
		draw_string(font, pen, character, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, ink)
		pen.x += font.get_string_size(character, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x + (3 if icon_index == 0 else 2)
	draw_polyline(PackedVector2Array([arrow + Vector2(-5, -8), arrow + Vector2(3, 0), arrow + Vector2(-5, 8)]), ink, 3, true)
