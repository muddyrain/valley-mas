extends Button
## Native button semantics with a vertically arranged icon, caption and real key badge.
const Style = preload("res://ui/expedition_theme.gd")
const UI = preload("res://ui/ui_style.gd")
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const Visual = preload("res://ui/expedition/hud_visual_profile.gd")
var caption: Label
var badge: Label
var state_line: ColorRect
var counter: Label
var family: String = "hud_skill_slot"
var _active: bool = false
var _hover_tween: Tween
var resting_scale: Vector2 = Vector2.ONE
var key_backplate: PanelContainer

func set_visual_scale(value: float) -> void:
	if resting_scale == Vector2.ONE * value:
		return
	resting_scale = Vector2.ONE * value
	scale = resting_scale
	pivot_offset = size if family == "hud_return" else size * .5

func setup(title: String, shortcut: String, picture: Texture2D, command: Callable, width: float = 96) -> void:
	custom_minimum_size = Vector2(width, 116)
	focus_mode = FOCUS_NONE
	icon = HudArt.fitted_icon(picture)
	expand_icon = true
	icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
	add_theme_constant_override("icon_max_width", 38 if family == "hud_return" else 40)
	HudArt.button(self, family)
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		get_theme_stylebox(state).content_margin_top = 12
		get_theme_stylebox(state).content_margin_bottom = 60
		get_theme_stylebox(state).expand_margin_bottom = -24
	caption = UI.label(title, 17 if family == "hud_return" else 16, Style.PAPER)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.set_anchors_and_offsets_preset(PRESET_BOTTOM_WIDE)
	caption.offset_top = -58
	caption.offset_bottom = -34
	caption.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(caption)
	key_backplate = PanelContainer.new()
	key_backplate.set_anchors_and_offsets_preset(PRESET_CENTER_BOTTOM)
	key_backplate.offset_left = -12
	key_backplate.offset_right = 12
	key_backplate.offset_top = -25
	key_backplate.offset_bottom = -1
	var key_style := StyleBoxFlat.new()
	key_style.bg_color = Color("#172a36dd")
	key_style.border_color = Color("#8da9b14d")
	key_style.set_border_width_all(1)
	key_style.set_corner_radius_all(12)
	key_backplate.add_theme_stylebox_override("panel", key_style)
	key_backplate.mouse_filter = MOUSE_FILTER_IGNORE
	key_backplate.visible = not shortcut.is_empty()
	add_child(key_backplate)
	badge = UI.label(shortcut, 14, Color("#d6e7e8"))
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	badge.mouse_filter = MOUSE_FILTER_IGNORE
	key_backplate.add_child(badge)
	counter = UI.label("", 10, Style.CYAN)
	counter.set_anchors_and_offsets_preset(PRESET_TOP_LEFT)
	counter.position = Vector2(10, 6)
	add_child(counter)
	state_line = ColorRect.new()
	state_line.set_anchors_and_offsets_preset(PRESET_CENTER_BOTTOM)
	state_line.offset_left = -2
	state_line.offset_right = 2
	state_line.offset_top = -32
	state_line.offset_bottom = -28
	state_line.pivot_offset = Vector2(2, 2)
	state_line.rotation = PI / 4
	state_line.color = Color("#dacba5")
	state_line.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(state_line)
	mouse_default_cursor_shape = CURSOR_POINTING_HAND
	pressed.connect(command)
	mouse_entered.connect(_hover.bind(true))
	mouse_exited.connect(_hover.bind(false))
	state_line.hide()

func _hover(entered: bool) -> void:
	if _hover_tween != null:
		_hover_tween.kill()
	_hover_tween = create_tween()
	pivot_offset = size if family == "hud_return" else size * .5
	_hover_tween.set_parallel(true)
	_hover_tween.tween_property(self, "scale", resting_scale * (Visual.HOVER_SCALE if entered and not disabled else 1.0), Visual.HOVER_SECONDS).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_hover_tween.tween_property(caption, "modulate", Color.WHITE if entered or not disabled else Color(.68, .72, .74, .65), Visual.HOVER_SECONDS)

func set_state(available: bool, active: bool = false, detail: String = "") -> void:
	disabled = not available
	if _active != active:
		_active = active
		HudArt.button(self, family)
		if active:
			var active_surface := HudArt.surface(family + "_default", Vector4(12, 12, 12, 60), Color(Visual.ACTIVE_BRIGHTNESS, Visual.ACTIVE_BRIGHTNESS, Visual.ACTIVE_BRIGHTNESS))
			for state: String in ["normal", "hover", "disabled"]:
				add_theme_stylebox_override(state, active_surface)
		for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
			get_theme_stylebox(state).content_margin_top = 12
			get_theme_stylebox(state).content_margin_bottom = 60
			get_theme_stylebox(state).expand_margin_bottom = -24
	state_line.visible = active
	caption.modulate = Color.WHITE if available or active else Color(.68, .72, .74, .65)
	key_backplate.modulate.a = 1.0 if available or active else .55
	if disabled and scale != resting_scale:
		if _hover_tween != null:
			_hover_tween.kill()
		scale = resting_scale
	add_theme_color_override("icon_disabled_color", Color(1, 1, 1, .9) if active else Color(.55, .6, .65, .7))
	counter.text = detail
