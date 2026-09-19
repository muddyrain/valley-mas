extends Panel
## Presentation-only action rail. Q/E emit local signals without gameplay effects.

signal action_requested(action_id: String)

var last_action: String = ""

func _ready() -> void:
	$TemporaryBuff.pressed.connect(_on_action_pressed.bind("temporary_buff"))
	$MedicalSupport.pressed.connect(_on_action_pressed.bind("medical_support"))
	set_process_unhandled_key_input(true)

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.physical_keycode == KEY_Q:
		$TemporaryBuff.flash_pressed()
		_on_action_pressed("temporary_buff")
	elif event.physical_keycode == KEY_E:
		$MedicalSupport.flash_pressed()
		_on_action_pressed("medical_support")

func _on_action_pressed(action_id: String) -> void:
	last_action = action_id
	action_requested.emit(action_id)
