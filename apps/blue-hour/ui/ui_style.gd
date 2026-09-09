extends RefCounted
const INK := Color("#0b1521")
const PANEL := Color("#172536")
const BORDER := Color("#334b60")
const TEXT := Color("#e5edf2")
const MUTED := Color("#97afbc")
const CYAN := Color("#83d9df")
const AMBER := Color("#f0c17c")

static func theme() -> Theme:
	var result := Theme.new()
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC"])
	result.default_font = font
	result.default_font_size = 16
	result.set_color("font_color", "Label", TEXT)
	result.set_color("font_color", "Button", TEXT)
	result.set_color("font_hover_color", "Button", Color.WHITE)
	result.set_color("font_disabled_color", "Button", MUTED.darkened(0.25))
	result.set_stylebox("normal", "Button", panel(PANEL, BORDER))
	result.set_stylebox("hover", "Button", panel(Color("#294453"), CYAN))
	result.set_stylebox("pressed", "Button", panel(Color("#365867"), CYAN))
	result.set_stylebox("focus", "Button", panel(Color.TRANSPARENT, CYAN))
	result.set_stylebox("disabled", "Button", panel(Color("#111e2c"), Color("#243748")))
	result.set_stylebox("panel", "PanelContainer", panel(INK, BORDER))
	result.set_stylebox("panel", "PopupMenu", panel(INK, BORDER))
	return result

static func panel(color: Color = INK, border: Color = BORDER) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(5)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	return style

static func label(text: String, size: int = 16, color: Color = TEXT) -> Label:
	var result := Label.new()
	result.text = text
	result.add_theme_font_size_override("font_size", size)
	result.add_theme_color_override("font_color", color)
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return result

static func button(text: String, action: Callable, min_size: Vector2 = Vector2(0, 44)) -> Button:
	var result := Button.new()
	result.text = text
	result.custom_minimum_size = min_size
	result.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	result.pressed.connect(action)
	result.focus_mode = Control.FOCUS_NONE
	return result

static func margin(parent: Control, rect: Rect2) -> PanelContainer:
	var result := PanelContainer.new()
	parent.add_child(result)
	result.position = rect.position
	result.size = rect.size
	return result

static func page(parent: Control) -> VBoxContainer:
	parent.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	parent.theme = theme()
	var background := ColorRect.new()
	background.color = INK
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	parent.add_child(background)
	var margin_box := MarginContainer.new()
	margin_box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin_box.add_theme_constant_override("margin_" + side, 24)
	parent.add_child(margin_box)
	parent.set_meta("page_margin", margin_box)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	margin_box.add_child(scroll)
	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_theme_constant_override("separation", 12)
	scroll.add_child(column)
	return column

static func wrapped(text: String, size: int = 16, color: Color = TEXT) -> Label:
	var result := label(text, size, color)
	result.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	result.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return result

static func footer(parent: Control) -> HBoxContainer:
	parent.get_meta("page_margin").add_theme_constant_override("margin_bottom", 88)
	var row := HBoxContainer.new()
	row.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	row.offset_left = 24
	row.offset_right = -24
	row.offset_top = -72
	row.offset_bottom = -24
	parent.add_child(row)
	return row
