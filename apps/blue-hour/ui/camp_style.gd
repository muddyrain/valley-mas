extends RefCounted
const UI = preload("res://ui/ui_style.gd")
const PORTRAITS: Dictionary = preload("res://ui/expedition/squad_card.gd").PORTRAITS
const INK := Color("#293f49")
const MUTED := Color("#6e7979")
const PAPER := Color("#f1ecdf")
const ACCENT := Color("#427f81")

static func plate(color: Color, border: Color, padding: int = 16) -> StyleBoxFlat:
	var result := UI.panel(color, border)
	result.set_corner_radius_all(10)
	result.content_margin_left = padding
	result.content_margin_right = padding
	result.content_margin_top = padding
	result.content_margin_bottom = padding
	result.shadow_color = Color(0.04, 0.1, 0.13, 0.18)
	result.shadow_size = 8
	result.shadow_offset = Vector2(0, 4)
	return result

static func paper_theme() -> Theme:
	var result := theme()
	result.set_color("font_color", "Label", INK)
	result.set_stylebox("panel", "PanelContainer", plate(PAPER, Color("#c9c5b6"), 20))
	result.set_stylebox("panel", "PopupMenu", plate(PAPER, Color("#c9c5b6")))
	result.set_stylebox("hover", "PopupMenu", plate(Color("#d4e4df"), Color("#b9c7bd"), 8))
	result.set_color("font_color", "PopupMenu", INK)
	result.set_color("font_hover_color", "PopupMenu", INK)
	var divider := StyleBoxLine.new()
	divider.color = Color("#c9c8ba")
	divider.thickness = 1
	result.set_stylebox("separator", "HSeparator", divider)
	result.set_constant("scrollbar_h_separation", "ScrollContainer", 10)
	result.set_stylebox("scroll", "VScrollBar", _paper_scrollbar(Color("#d5d8cb")))
	result.set_stylebox("scroll_focus", "VScrollBar", _paper_scrollbar(Color("#b8c6b9")))
	result.set_stylebox("grabber", "VScrollBar", _paper_scrollbar(Color("#839e94"), 18))
	result.set_stylebox("grabber_highlight", "VScrollBar", _paper_scrollbar(ACCENT, 18))
	result.set_stylebox("grabber_pressed", "VScrollBar", _paper_scrollbar(INK, 18))
	for kind: String in ["Button", "OptionButton"]:
		for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
			var fill := Color("#e5e3d8") if state == "normal" else Color("#d4e4df")
			if state == "disabled":
				fill = Color("#e6e2d7")
			var button_plate := plate(fill, Color("#b9c7bd"), 8)
			button_plate.shadow_size = 2
			button_plate.shadow_offset = Vector2(0, 1)
			result.set_stylebox(state, kind, button_plate)
			result.set_color("font_" + state + "_color" if state != "normal" else "font_color", kind, MUTED if state == "disabled" else INK)
	return result

static func _paper_scrollbar(color: Color, minimum_half_height: int = 0) -> StyleBoxFlat:
	var result := StyleBoxFlat.new()
	result.bg_color = color
	result.set_corner_radius_all(3)
	# Keep a 14 px drag target while drawing a restrained 4 px indicator.
	result.content_margin_left = 7
	result.content_margin_right = 7
	result.content_margin_top = minimum_half_height
	result.content_margin_bottom = minimum_half_height
	result.expand_margin_left = -5
	result.expand_margin_right = -5
	return result

static func label(text: String, font_size: int = 16, color: Color = INK) -> Label:
	return UI.label(text, font_size, color)

static func wrapped(text: String, font_size: int = 16, color: Color = MUTED) -> Label:
	return UI.wrapped(text, font_size, color)

static func icon(texture: Texture2D, dimensions := Vector2(40, 40)) -> TextureRect:
	var result := TextureRect.new()
	result.texture = texture
	result.custom_minimum_size = dimensions
	result.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	result.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return result

static func theme() -> Theme:
	var result := UI.theme()
	result.default_font = preload("res://ui/new_run_art.gd").body_font()
	result.set_stylebox("panel", "PanelContainer", plate(Color("#1d3540ed"), Color("#8aada15c"), 12))
	result.set_stylebox("normal", "Button", plate(Color("#29444eea"), Color("#8aada170"), 10))
	result.set_stylebox("pressed", "Button", plate(Color("#42666c"), UI.CYAN, 10))
	result.set_stylebox("hover_pressed", "Button", plate(Color("#4b7479"), UI.CYAN, 10))
	result.set_stylebox("hover", "Button", plate(Color("#36565f"), UI.CYAN, 10))
	result.set_stylebox("disabled", "Button", plate(Color("#233942"), Color("#6a85874d"), 10))
	var focus := plate(Color.TRANSPARENT, UI.CYAN, 10)
	focus.shadow_size = 0
	result.set_stylebox("focus", "Button", focus)
	return result

static func button(text: String, callback: Callable, minimum := Vector2(0, 42)) -> Button:
	var result := UI.button(text, callback, minimum)
	result.focus_mode = Control.FOCUS_ALL
	return result

static func portrait(spec: Resource, dimensions := Vector2(42, 48)) -> TextureRect:
	var result := TextureRect.new()
	result.texture = load(spec.portrait_path) if not spec.portrait_path.is_empty() else PORTRAITS.get(spec.id)
	result.custom_minimum_size = dimensions
	result.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	result.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if result.texture == null:
		var initial := UI.label(spec.display_name.left(1), 25, spec.color.lightened(0.4))
		result.add_child(initial)
		initial.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		initial.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		initial.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return result
