extends PanelContainer
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const UI = preload("res://ui/ui_style.gd")
var background: TextureRect
var label: Label

func setup(key: String) -> void:
	custom_minimum_size = Vector2(28, 28)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	background = HudArt.picture("hotkey_normal", Vector2.ZERO)
	add_child(background)
	label = UI.label(key, 14, HudArt.PAPER)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(label)
	visible = not key.is_empty()

func set_active(active: bool) -> void:
	background.texture = HudArt.texture("hotkey_active" if active else "hotkey_normal")
	label.add_theme_color_override("font_color", HudArt.INK if active else HudArt.PAPER)
