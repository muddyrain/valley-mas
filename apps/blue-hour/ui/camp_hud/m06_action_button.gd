extends Button
## Shared M06 button feedback. The glow remains weaker than a gameplay-selected state.

var _hovered: bool = false
var _held: bool = false
var _transition: Tween

func _ready() -> void:
	pivot_offset = Vector2(48.0, 41.0)
	mouse_entered.connect(_on_mouse_entered)
	mouse_exited.connect(_on_mouse_exited)
	button_down.connect(_on_button_down)
	button_up.connect(_on_button_up)
	_update_visual(true)

func flash_pressed() -> void:
	_held = true
	_update_visual()
	await get_tree().create_timer(0.10).timeout
	_held = false
	_update_visual()

func _on_mouse_entered() -> void:
	_hovered = true
	_update_visual()

func _on_mouse_exited() -> void:
	_hovered = false
	_update_visual()

func _on_button_down() -> void:
	_held = true
	_update_visual()

func _on_button_up() -> void:
	_held = false
	_update_visual()

func _update_visual(immediate: bool = false) -> void:
	if not is_node_ready():
		return
	if _transition != null:
		_transition.kill()
	var glow: TextureRect = $HoverGlow
	var target_alpha: float = 0.58 if _hovered and not _held else 0.0
	var target_scale: Vector2 = Vector2.ONE * (0.98 if _held else (1.02 if _hovered else 1.0))
	if immediate:
		glow.modulate.a = target_alpha
		scale = target_scale
		return
	_transition = create_tween().set_parallel(true)
	_transition.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_transition.tween_property(glow, "modulate:a", target_alpha, 0.12)
	if _held:
		scale = target_scale
	else:
		_transition.tween_property(self, "scale", target_scale, 0.10)
