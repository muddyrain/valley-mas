extends Control
## Entry retains the existing Camp navigation connection and fixed hit area.

@onready var entry: StateButton = $Entry


func _ready() -> void:
	entry.initialize_visuals()
	entry.visual_state_changed.connect(_sync_content)
	_sync_content()


func set_depart_enabled(enabled: bool) -> void:
	$Entry.disabled = not enabled


func _sync_content() -> void:
	# Also follows native Entry.disabled writes from the existing bus departure flow.
	entry.content.modulate.a = lerpf(1.0, 0.45, entry.weights.w)
	entry.mouse_default_cursor_shape = Control.CURSOR_ARROW if entry.disabled else Control.CURSOR_POINTING_HAND
