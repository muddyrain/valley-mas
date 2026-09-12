extends RefCounted
## Expedition-only treatment of the existing navy, paper and brass palette.
const UI = preload("res://ui/ui_style.gd")
const Art = preload("res://ui/new_run_art.gd")
const CutPlate = preload("res://ui/expedition/cut_plate.gd")
const PAPER := Color("#e4e6da")
const INK := Color("#203845")
const MUTED := Color("#91a6ac")
const GOLD := Color("#dfbd7c")
const CYAN := Color("#83d9df")

static func plate(color: Color = Color("#142a38e8"), edge: Color = Color("#63858b88"), inset: int = 12) -> StyleBox:
	var style := CutPlate.new()
	style.fill = color
	style.edge = edge
	style.content_margin_left = inset
	style.content_margin_right = inset
	style.content_margin_top = inset
	style.content_margin_bottom = inset
	return style

static func theme() -> Theme:
	var result := UI.theme()
	result.default_font = Art.body_font()
	result.default_font_size = 14
	result.set_color("font_shadow_color", "Label", Color("#081923dd"))
	result.set_constant("shadow_offset_x", "Label", 1)
	result.set_constant("shadow_offset_y", "Label", 1)
	result.set_stylebox("panel", "PanelContainer", plate())
	result.set_stylebox("normal", "Button", plate(Color("#263e4b"), Color("#526771"), 8))
	result.set_stylebox("hover", "Button", plate(Color("#385866"), CYAN, 8))
	result.set_stylebox("pressed", "Button", plate(Color("#456772"), GOLD, 8))
	result.set_stylebox("disabled", "Button", plate(Color("#1c303b"), Color("#344c56"), 8))
	result.set_stylebox("background", "ProgressBar", plate(Color("#465e65"), Color.TRANSPARENT, 0))
	result.set_stylebox("fill", "ProgressBar", plate(CYAN, Color.TRANSPARENT, 0))
	return result

static func anchored(parent: Control, node_name: String, preset: int, rect: Rect2) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.name = node_name
	parent.add_child(panel)
	panel.set_anchors_and_offsets_preset(preset)
	panel.offset_left = rect.position.x
	panel.offset_top = rect.position.y
	panel.offset_right = rect.end.x
	panel.offset_bottom = rect.end.y
	return panel
