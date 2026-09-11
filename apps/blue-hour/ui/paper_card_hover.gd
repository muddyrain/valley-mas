class_name PaperCardHover
extends Node
## Reusable lift, press, and alpha-contour feedback for paper card buttons.

const EFFECT_SHADER: Shader = preload("res://ui/paper_card_outline.gdshader")
const EFFECT_MARGIN := 14.0
const HOVER_LIFT := 4.0
const HOVER_SCALE := 1.03
const PRESS_SCALE := 0.98
const HOVER_DURATION := 0.14
const PRESS_DURATION := 0.07
const RELEASE_DURATION := 0.12

var _button: BaseButton
var _visual_root: Control
var _source: TextureRect
var _effect: TextureRect
var _material: ShaderMaterial
var _tween: Tween
var _base_position := Vector2.ZERO
var _hover_amount := 0.0
var _mouse_hovered := false
var _keyboard_focused := false
var _pressed := false

func setup(button: BaseButton, visual_root: Control, source: TextureRect) -> void:
	_button = button
	_visual_root = visual_root
	_source = source
	_base_position = visual_root.position
	_visual_root.pivot_offset = visual_root.size * 0.5
	_build_effect_layer()
	_button.mouse_entered.connect(_on_mouse_entered)
	_button.mouse_exited.connect(_on_mouse_exited)
	_button.focus_entered.connect(_on_focus_entered)
	_button.focus_exited.connect(_on_focus_exited)
	_button.button_down.connect(_on_button_down)
	_button.button_up.connect(_on_button_up)
	_button.gui_input.connect(_on_gui_input)
	_source.item_rect_changed.connect(_sync_effect_geometry)

func set_texture(texture: Texture2D) -> void:
	_effect.texture = texture
	_material.set_shader_parameter("card_texture", texture)

func _build_effect_layer() -> void:
	_effect = TextureRect.new()
	_effect.name = "CardHoverEffect"
	_effect.texture = _source.texture
	_effect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_effect.stretch_mode = TextureRect.STRETCH_SCALE
	_effect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_material = ShaderMaterial.new()
	_material.shader = EFFECT_SHADER
	_material.set_shader_parameter("card_texture", _source.texture)
	_material.set_shader_parameter("hover_amount", 0.0)
	_effect.material = _material
	_visual_root.add_child(_effect)
	_visual_root.move_child(_effect, _source.get_index())
	_sync_effect_geometry()

func _sync_effect_geometry() -> void:
	var margin := Vector2.ONE * EFFECT_MARGIN
	_effect.position = _source.position - margin
	_effect.size = _source.size + margin * 2.0
	_material.set_shader_parameter("content_origin_uv", margin / _effect.size)
	_material.set_shader_parameter("content_size_uv", _source.size / _effect.size)

func _on_mouse_entered() -> void:
	_mouse_hovered = true
	_keyboard_focused = false
	if _button.focus_mode != Control.FOCUS_NONE and not _button.has_focus():
		_button.grab_focus()
	_animate(HOVER_DURATION)

func _on_mouse_exited() -> void:
	_mouse_hovered = false
	_keyboard_focused = false
	_pressed = false
	_animate(HOVER_DURATION)

func _on_focus_entered() -> void:
	if not _mouse_hovered:
		_keyboard_focused = true
	_animate(HOVER_DURATION)

func _on_focus_exited() -> void:
	_keyboard_focused = false
	_animate(HOVER_DURATION)

func _on_button_down() -> void:
	_pressed = true
	_animate(PRESS_DURATION)

func _on_button_up() -> void:
	_pressed = false
	_animate(RELEASE_DURATION)

func _on_gui_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		_keyboard_focused = true
		_mouse_hovered = false
		_animate(HOVER_DURATION)
	elif event is InputEventJoypadButton and event.pressed:
		_keyboard_focused = true
		_mouse_hovered = false
		_animate(HOVER_DURATION)

func _animate(duration: float) -> void:
	if _tween != null and _tween.is_valid():
		_tween.kill()
	var active := _mouse_hovered or _keyboard_focused
	var target_position := _base_position + (Vector2.UP * HOVER_LIFT if active else Vector2.ZERO)
	var target_scale := PRESS_SCALE if _pressed else (HOVER_SCALE if active else 1.0)
	var target_hover := 1.0 if active else 0.0
	_tween = _button.create_tween()
	_tween.set_parallel(true)
	_tween.tween_property(_visual_root, "position", target_position, duration).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_tween.tween_property(_visual_root, "scale", Vector2.ONE * target_scale, duration).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_tween.tween_method(_set_hover_amount, _hover_amount, target_hover, duration).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)

func _set_hover_amount(value: float) -> void:
	_hover_amount = value
	_material.set_shader_parameter("hover_amount", value)
