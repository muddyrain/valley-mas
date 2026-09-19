extends StateButton
## M06 keeps its supplied HoverGlow as an overlay while using the shared state machine.

func _ready() -> void:
	hover_is_overlay = true
	hover_opacity = 0.58
	focus_as_hover = false
	super._ready()

func _apply_weights(value: Vector4) -> void:
	super._apply_weights(value)
	if not _configured:
		return
	var hover_amount: float = value.y
	var tint: Color = Color.WHITE.lerp(Color(1.05, 1.05, 1.05, 1.0), hover_amount)
	var icon_tint: Color = Color.WHITE.lerp(Color(1.04, 1.04, 1.04, 1.0), hover_amount)
	$VisualRoot/NormalTexture.self_modulate = tint
	$VisualRoot/Icon.self_modulate = icon_tint
