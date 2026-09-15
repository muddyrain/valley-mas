extends Button
## Native button semantics with a vertically arranged icon, caption and real key badge.
const Style = preload("res://ui/expedition_theme.gd")
const UI = preload("res://ui/ui_style.gd")
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const HotkeyBadge = preload("res://ui/expedition/hotkey_badge.gd")
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
var _motion_base_position := Vector2.ZERO
var _hover_shader: ShaderMaterial

const HOVER_SHADER := "shader_type canvas_item; uniform float hover_amount : hint_range(0.0, 1.0) = 0.0; void fragment(){ vec4 c = texture(TEXTURE, UV) * COLOR; float edge = 1.0 - smoothstep(0.35, 0.95, c.a); c.rgb *= 1.0 + hover_amount * 0.10; c.rgb += vec3(0.12, 0.20, 0.24) * hover_amount * edge; COLOR = c; }"

func set_visual_scale(value: float) -> void:
	if resting_scale == Vector2.ONE * value:
		return
	resting_scale = Vector2.ONE * value
	scale = resting_scale
	pivot_offset = size if family == "hud_return" else size * .5

func setup(title: String, shortcut: String, picture: Texture2D, command: Callable, width: float = 120) -> void:
	custom_minimum_size = Vector2(width, 132)
	focus_mode = FOCUS_NONE
	icon = HudArt.fitted_icon(picture)
	expand_icon = true
	icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
	add_theme_constant_override("icon_max_width", 44 if family == "hud_return" else 48 if title == "停止" else 44 if title == "集火" else 36 if title == "狂怒" else 38)
	HudArt.button(self, family)
	_hover_shader = ShaderMaterial.new()
	_hover_shader.shader = Shader.new()
	_hover_shader.shader.code = HOVER_SHADER
	material = _hover_shader
	# Keep the native hit target geometry identical across visual states. The
	# supplied hover/pressed PNGs have different transparent padding.
	var normal_surface: StyleBox = get_theme_stylebox("normal")
	add_theme_stylebox_override("hover", normal_surface)
	add_theme_stylebox_override("pressed", normal_surface)
	add_theme_stylebox_override("hover_pressed", normal_surface)
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		get_theme_stylebox(state).content_margin_top = 12
		get_theme_stylebox(state).content_margin_bottom = 44
		get_theme_stylebox(state).expand_margin_bottom = -24
	caption = UI.label(title, 17 if family == "hud_return" else 16, Style.PAPER)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.set_anchors_and_offsets_preset(PRESET_BOTTOM_WIDE)
	caption.offset_top = -66
	caption.offset_bottom = -42
	caption.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(caption)
	key_backplate = HotkeyBadge.new()
	add_child(key_backplate)
	key_backplate.setup(shortcut)
	key_backplate.set_anchors_and_offsets_preset(PRESET_CENTER_BOTTOM)
	key_backplate.offset_left = -14
	key_backplate.offset_right = 14
	key_backplate.offset_top = -32
	key_backplate.offset_bottom = -4
	badge = key_backplate.label
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
	button_down.connect(_sync_details)
	button_up.connect(_sync_details)
	button_down.connect(func(): _motion(false, true))
	button_up.connect(func(): _motion(is_hovered(), false))
	_apply_layout()
	call_deferred("_capture_motion_origin")

func _capture_motion_origin() -> void:
	_motion_base_position = position

func _hover(entered: bool) -> void:
	_sync_details()
	if _hover_tween != null:
		_hover_tween.kill()
	_hover_tween = create_tween()
	_motion(entered, false)
	_hover_tween.tween_property(caption, "modulate", Color("#fffdf2") if entered else Color.WHITE if not disabled else Color(.68, .72, .74, .65), Visual.HOVER_SECONDS)

func _motion(hovered: bool, pressed: bool) -> void:
	if _hover_tween != null:
		_hover_tween.kill()
	_hover_tween = create_tween().set_parallel(true)
	pivot_offset = size * (Vector2(0.5, 1.0) if family == "hud_return" else Vector2(0.5, 0.5))
	var factor := 0.99 if pressed else 1.025 if hovered and not disabled else 1.0
	_hover_tween.tween_property(self, "scale", resting_scale * factor, 0.13 if hovered else 0.11).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_hover_tween.tween_property(self, "position:y", _motion_base_position.y - (2.0 if hovered and not pressed else 0.0), 0.13 if hovered else 0.11).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	if _hover_shader != null:
		_hover_tween.tween_method(func(value: float): _hover_shader.set_shader_parameter("hover_amount", value), 1.0 if hovered else 0.0, 0.0 if not hovered else 1.0, 0.13)

func set_state(available: bool, active: bool = false, detail: String = "") -> void:
	disabled = not available
	if _active != active:
		_active = active

		HudArt.button(self, family)
		if active:
			var active_surface := HudArt.surface(family + ("_hover" if family == "hud_return" else "_default"), Vector4(12, 12, 12, 44), Color.WHITE if family == "hud_return" else Color(Visual.ACTIVE_BRIGHTNESS, Visual.ACTIVE_BRIGHTNESS, Visual.ACTIVE_BRIGHTNESS))
			for state: String in ["normal", "hover", "disabled"]:
				add_theme_stylebox_override(state, active_surface)
		for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
			get_theme_stylebox(state).content_margin_top = 12
			get_theme_stylebox(state).content_margin_bottom = 44
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
	_apply_layout()
	_sync_details()

func _sync_details() -> void:
	var highlighted: bool = _active or (not disabled and (is_hovered() or is_pressed()))
	key_backplate.set_active(highlighted)
	if family == "hud_return":
		icon = HudArt.texture("icon_return_highlight" if highlighted else "icon_return")

func _apply_layout() -> void:
	if family != "hud_return":
		return
	custom_minimum_size.y = 116
	add_theme_constant_override("icon_max_width", 50)
	caption.add_theme_font_size_override("font_size", 24)
	icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
	vertical_icon_alignment = VERTICAL_ALIGNMENT_CENTER
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		var surface: StyleBoxTexture = get_theme_stylebox(state)
		for side: int in range(4):
			surface.set_texture_margin(side, 0)
		surface.content_margin_top = 14
		surface.content_margin_bottom = 44
		surface.content_margin_left = 24
		surface.content_margin_right = 24
		surface.expand_margin_bottom = -28
	caption.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	caption.offset_left = 72
	caption.offset_right = -18
	caption.offset_bottom = -28
	caption.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	caption.add_theme_color_override("font_color", HudArt.INK)
	key_backplate.set_anchors_and_offsets_preset(PRESET_CENTER_BOTTOM)
	key_backplate.offset_left = -16
	key_backplate.offset_right = 16
	key_backplate.offset_top = -30
	key_backplate.offset_bottom = 0
	state_line.visible = false
