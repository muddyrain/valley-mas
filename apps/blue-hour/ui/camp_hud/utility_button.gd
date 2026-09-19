extends StateButton
## Pure Godot visuals consume the shared transition without adding navigation.


func _apply_weights(value: Vector4) -> void:
	super._apply_weights(value)
	if not _configured:
		return
	var keycap: Panel = content.get_node("EscKeycap")
	var border: StyleBoxFlat = keycap.get_theme_stylebox("panel") as StyleBoxFlat
	border.border_color = Color(1, 1, 1, lerpf(0.85, 1.0, value.y))
	var label: Label = content.get_node("ReturnLabel")
	label.modulate.a = lerpf(0.85, 1.0, value.y)
	content.modulate.a = lerpf(1.0, 0.4, value.w)
	mouse_default_cursor_shape = Control.CURSOR_ARROW if disabled else Control.CURSOR_POINTING_HAND
