extends RefCounted
const UI = preload("res://ui/ui_style.gd")
const BACKGROUND = preload("res://assets/ui/main_menu/home_background.png")
const LOGO = preload("res://assets/ui/main_menu/brand_tagline.png")
const PAPER = preload("res://assets/ui/main_menu/paper_panel.png")
const BLUE = preload("res://assets/ui/main_menu/blue_button.png")
const INK := Color("#20374b")
const MUTED := Color("#597080")
const WHITE := Color("#f3efe4")
const GOLD := Color("#e8b36a")

static func logo() -> AtlasTexture:
	var result := AtlasTexture.new()
	result.atlas = LOGO
	result.region = Rect2(160, 0, 1460, 650)
	result.filter_clip = true
	return result

static func paper() -> StyleBoxTexture:
	var style := StyleBoxTexture.new()
	style.texture = PAPER
	style.region_rect = Rect2(110, 140, 1954, 439)
	# The supplied plate has a continuous bevel; scale its full visible region.
	style.set_texture_margin_all(0)
	style.content_margin_left = 28
	style.content_margin_right = 28
	style.content_margin_top = 20
	style.content_margin_bottom = 20
	return style

static func theme() -> Theme:
	var result := UI.theme()
	result.default_font_size = 18
	result.set_color("font_color", "Label", WHITE)
	return result

static func button(text: String, action: Callable, primary: bool = false, plain: bool = false) -> Button:
	var result := UI.button(text, action, Vector2(0, 76 if not plain else 48))
	result.focus_mode = Control.FOCUS_ALL
	result.add_theme_font_size_override("font_size", 25 if not plain else 18)
	var style: StyleBox
	if primary:
		var blue := StyleBoxTexture.new()
		blue.texture = BLUE
		blue.region_rect = Rect2(184, 112, 1802, 500)
		blue.content_margin_left = 36
		blue.content_margin_right = 36
		blue.content_margin_top = 18
		blue.content_margin_bottom = 18
		style = blue
	elif plain:
		style = StyleBoxEmpty.new()
	else:
		style = paper()
		style.content_margin_top = 12
		style.content_margin_bottom = 12
	result.add_theme_stylebox_override("normal", style)
	var hover := style.duplicate()
	if hover is StyleBoxTexture:
		hover.modulate_color = Color(1.12, 1.12, 1.12)
	result.add_theme_stylebox_override("hover", hover)
	var pressed := style.duplicate()
	if pressed is StyleBoxTexture:
		pressed.modulate_color = Color(.78, .86, .94)
	result.add_theme_stylebox_override("pressed", pressed)
	var focus := StyleBoxFlat.new()
	focus.bg_color = Color.TRANSPARENT
	focus.border_color = GOLD
	focus.set_border_width_all(2)
	focus.set_corner_radius_all(5)
	focus.set_expand_margin_all(3)
	result.add_theme_stylebox_override("focus", focus)
	var color := WHITE if primary or plain else INK
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		result.add_theme_color_override(state, color)
	return result

static func flow_focus(buttons: Array[Button]) -> void:
	for index in range(buttons.size()):
		var previous := buttons[posmod(index - 1, buttons.size())].get_path()
		var next := buttons[(index + 1) % buttons.size()].get_path()
		buttons[index].focus_previous = previous
		buttons[index].focus_next = next
		buttons[index].focus_neighbor_top = previous
		buttons[index].focus_neighbor_bottom = next
