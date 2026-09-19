extends Button
class_name StateButton
## The Button is the fixed hit area; every animated node lives under VisualRoot.
## Textures are assigned during configuration, never switched by pointer events.

signal visual_state_changed

enum VisualState { NORMAL, HOVER, SELECTED, DISABLED }

@export var normal_texture: Texture2D
@export var hover_texture: Texture2D
@export var selected_texture: Texture2D
@export var disabled_texture: Texture2D
@export_range(0.01, 1.0) var hover_duration: float = 0.12
@export_range(0.01, 1.0) var selected_duration: float = 0.15
@export_range(0.01, 1.0) var pressed_duration: float = 0.08
@export var hover_is_overlay: bool = false
@export_range(0.0, 1.0) var hover_opacity: float = 1.0
@export_range(0.98, 1.0) var pressed_scale: float = 0.98
@export var focus_as_hover: bool = true
@export var normal_layer_path := NodePath("VisualRoot/NormalTexture")
@export var hover_layer_path := NodePath("VisualRoot/HoverTexture")
@export var selected: bool = false:
	set(value):
		selected = value
		_refresh_state()

var visual_root: Control
var content: Control
var normal_layer: TextureRect
var hover_layer: TextureRect
var selected_layer: TextureRect
var disabled_layer: TextureRect
var state: VisualState = VisualState.NORMAL
var weights := Vector4(1, 0, 0, 0)
var press_amount: float = 0.0
var _transition: Tween
var _press_tween: Tween
var _hovered: bool = false
var _pointer_focus: bool = false
var _held: bool = false
var _last_disabled: bool = false
var _configured: bool = false
var _pulse_serial: int = 0

func _ready() -> void:
	# Subclasses may configure assets after insertion (the menu's setup API).
	initialize_visuals.call_deferred()

func _process(_delta: float) -> void:
	# BaseButton.disabled is native and has no changed signal.
	if _configured and disabled != _last_disabled:
		_last_disabled = disabled
		_reset_press()
		_refresh_state()

func initialize_visuals() -> void:
	if _configured:
		return
	visual_root = get_node_or_null("VisualRoot") as Control
	if visual_root == null:
		visual_root = Control.new()
		visual_root.name = "VisualRoot"
		add_child(visual_root)
		visual_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	normal_layer = _layer(normal_layer_path, "NormalTexture", normal_texture)
	hover_layer = _layer(hover_layer_path, "HoverTexture", hover_texture)
	selected_layer = _layer(NodePath("VisualRoot/SelectedTexture"), "SelectedTexture", selected_texture)
	disabled_layer = _layer(NodePath("VisualRoot/DisabledTexture"), "DisabledTexture", disabled_texture)
	content = visual_root.get_node_or_null("Content") as Control
	if content == null:
		content = Control.new()
		content.name = "Content"
		visual_root.add_child(content)
		content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_ignore_mouse(visual_root)
	for style: String in ["normal", "hover", "pressed", "hover_pressed", "focus", "disabled"]:
		add_theme_stylebox_override(style, StyleBoxEmpty.new())
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	mouse_entered.connect(_enter)
	mouse_exited.connect(_leave)
	focus_entered.connect(_focus_enter)
	focus_exited.connect(_refresh_state)
	button_down.connect(_down)
	button_up.connect(_up)
	visibility_changed.connect(_visibility_changed)
	var window := get_window()
	if window != null:
		window.focus_exited.connect(_cancel_transient)
	_configured = true
	_last_disabled = disabled
	_refresh_state(true)

func set_state_textures(
	normal: Texture2D,
	hover: Texture2D = null,
	selected_state: Texture2D = null,
	disabled_state: Texture2D = null,
) -> void:
	if not _configured:
		initialize_visuals()
	normal_texture = normal
	hover_texture = hover
	selected_texture = selected_state
	disabled_texture = disabled_state
	normal_layer.texture = normal
	hover_layer.texture = hover
	selected_layer.texture = selected_state
	disabled_layer.texture = disabled_state
	_refresh_state(true)

func flash_pressed() -> void:
	if disabled or not is_visible_in_tree():
		return
	_pulse_serial += 1
	var serial: int = _pulse_serial
	_animate_press(true)
	await get_tree().create_timer(pressed_duration).timeout
	if serial == _pulse_serial:
		_animate_press(_held)

func _layer(path: NodePath, fallback_name: String, texture: Texture2D) -> TextureRect:
	var layer := get_node_or_null(path) as TextureRect
	if layer == null:
		layer = TextureRect.new()
		layer.name = fallback_name
		visual_root.add_child(layer)
		layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		layer.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		layer.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if texture != null:
		layer.texture = texture
	return layer

func _ignore_mouse(node: Node) -> void:
	if node is Control:
		node.mouse_filter = Control.MOUSE_FILTER_IGNORE
		node.focus_mode = Control.FOCUS_NONE
	for child: Node in node.get_children():
		_ignore_mouse(child)

func _enter() -> void:
	_hovered = true
	_pointer_focus = true
	_refresh_state()

func _leave() -> void:
	_hovered = false
	_refresh_state()

func _focus_enter() -> void:
	_pointer_focus = _hovered
	_refresh_state()

func _down() -> void:
	if disabled:
		return
	_held = true
	_pulse_serial += 1
	_animate_press(true)

func _up() -> void:
	_held = false
	_pulse_serial += 1
	_animate_press(false)

func _visibility_changed() -> void:
	if not is_visible_in_tree():
		_cancel_transient()

func _cancel_transient() -> void:
	_hovered = false
	_pointer_focus = true
	_reset_press()
	_refresh_state(true)

func _reset_press() -> void:
	_held = false
	_pulse_serial += 1
	if _press_tween != null:
		_press_tween.kill()
	if _configured:
		_apply_press(0.0)

func _refresh_state(immediate: bool = false) -> void:
	if not _configured:
		return
	var next: VisualState = VisualState.NORMAL
	if disabled:
		next = VisualState.DISABLED
	elif selected:
		next = VisualState.SELECTED
	elif _hovered or (focus_as_hover and has_focus() and not _pointer_focus):
		next = VisualState.HOVER
	if next == state and not immediate:
		return
	var duration: float = selected_duration if next == VisualState.SELECTED or state == VisualState.SELECTED else hover_duration
	state = next
	if _transition != null:
		_transition.kill()
	var target := Vector4.ZERO
	target[int(state)] = 1.0
	if immediate:
		_apply_weights(target)
	else:
		_transition = create_tween()
		_transition.tween_method(_apply_weights, weights, target, duration).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

func _apply_weights(value: Vector4) -> void:
	weights = value
	var normal_alpha: float = value.x
	if hover_is_overlay or hover_layer.texture == null:
		normal_alpha += value.y
	if selected_layer.texture == null:
		normal_alpha += value.z
	if disabled_layer.texture == null:
		normal_alpha += value.w
	normal_layer.modulate.a = normal_alpha
	hover_layer.modulate.a = value.y * hover_opacity
	selected_layer.modulate.a = value.z
	disabled_layer.modulate.a = value.w
	visual_state_changed.emit()

func _animate_press(down: bool) -> void:
	if not _configured:
		return
	if _press_tween != null:
		_press_tween.kill()
	_press_tween = create_tween()
	_press_tween.tween_method(_apply_press, press_amount, 1.0 if down else 0.0, pressed_duration).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)

func _apply_press(value: float) -> void:
	press_amount = value
	visual_root.scale = Vector2.ONE * lerpf(1.0, pressed_scale, value)
	visual_state_changed.emit()
