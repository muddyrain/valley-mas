extends Button
## Native button semantics with a vertically arranged icon, caption and real key badge.
const Style = preload("res://ui/expedition_theme.gd")
const UI = preload("res://ui/ui_style.gd")
var caption: Label
var badge: Label
var state_line: ColorRect

func setup(title: String, shortcut: String, picture: Texture2D, command: Callable, width: float = 70) -> void:
	custom_minimum_size = Vector2(width, 76)
	icon = picture
	expand_icon = true
	icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
	add_theme_constant_override("icon_max_width", 32)
	for state: String in ["normal", "hover", "pressed", "disabled", "focus"]:
		var surface := Style.plate(Color("#142a38dc") if state in ["hover", "focus", "pressed"] else Color("#142a3860"), Style.CYAN if state in ["hover", "focus"] else Color.TRANSPARENT, 9)
		surface.content_margin_bottom = 27
		add_theme_stylebox_override(state, surface)
	caption = UI.label(title, 11, Style.PAPER)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.set_anchors_and_offsets_preset(PRESET_BOTTOM_WIDE)
	caption.offset_top = -26
	caption.offset_bottom = -6
	caption.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(caption)
	badge = UI.label(shortcut, 10, Style.GOLD)
	badge.set_anchors_and_offsets_preset(PRESET_TOP_RIGHT)
	badge.offset_left = -17
	badge.offset_top = 3
	badge.offset_right = -4
	badge.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(badge)
	state_line = ColorRect.new()
	state_line.set_anchors_and_offsets_preset(PRESET_BOTTOM_WIDE)
	state_line.offset_left = 10
	state_line.offset_right = -10
	state_line.offset_top = -3
	state_line.offset_bottom = -1
	state_line.color = Style.CYAN
	state_line.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(state_line)
	mouse_default_cursor_shape = CURSOR_POINTING_HAND
	pressed.connect(command)

func set_state(available: bool, active: bool = false, detail: String = "") -> void:
	disabled = not available
	state_line.color = Style.GOLD if active else Style.CYAN
	state_line.visible = available or active
	caption.modulate = Color.WHITE if available or active else Style.MUTED
	add_theme_color_override("icon_disabled_color", Color(1, 1, 1, .9) if active else Color(.55, .6, .65, .7))
	if not detail.is_empty():
		badge.text = detail
