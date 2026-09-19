extends Button

const NORMAL_FRAME: Texture2D = preload("res://assets/ui/camp/m04/m04_portrait_frame_normal.png")
const SELECTED_FRAME: Texture2D = preload("res://assets/ui/camp/m04/m04_portrait_frame_selected.png")
const NORMAL_TINT := Color(0.78, 0.78, 0.78, 1)
const HOVER_TINT := Color(0.90, 0.93, 0.94, 1)

var selected: bool = false
var _hovered: bool = false
var _held: bool = false
var _transition: Tween

func _ready() -> void:
	pivot_offset = size * 0.5
	mouse_entered.connect(func() -> void:
		_hovered = true
		_update_visual())
	mouse_exited.connect(func() -> void:
		_hovered = false
		_update_visual())
	button_down.connect(func() -> void:
		_held = true
		_update_visual())
	button_up.connect(func() -> void:
		_held = false
		_update_visual())
	visibility_changed.connect(_reset_transient_state)
	_update_visual(true)

func set_selected(value: bool) -> void:
	selected = value
	_update_visual()

func _reset_transient_state() -> void:
	if not is_visible_in_tree():
		_hovered = false
		_held = false
		_update_visual(true)

func _update_visual(immediate: bool = false) -> void:
	if not is_node_ready():
		return
	if _transition != null:
		_transition.kill()
	var frame: TextureRect = $FrameTexture
	var portrait: TextureRect = $PortraitTexture
	frame.texture = SELECTED_FRAME if selected else NORMAL_FRAME
	var tint: Color = Color.WHITE if selected else (HOVER_TINT if _hovered else NORMAL_TINT)
	var portrait_tint := Color(1.06, 1.06, 1.06, 1) if _hovered and not selected else Color.WHITE
	var target_scale := Vector2.ONE * (0.98 if _held else (1.02 if _hovered and not selected else 1.0))
	if immediate:
		frame.self_modulate = tint
		portrait.self_modulate = portrait_tint
		scale = target_scale
		return
	_transition = create_tween().set_parallel(true)
	_transition.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_transition.tween_property(frame, "self_modulate", tint, 0.12)
	_transition.tween_property(portrait, "self_modulate", portrait_tint, 0.12)
	_transition.tween_property(self, "scale", target_scale, 0.10)
