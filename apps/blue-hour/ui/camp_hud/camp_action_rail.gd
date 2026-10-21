extends Panel
## Camp opens equipped ability details. Actual casting belongs to Mission.

signal action_requested(action_id: String)

var last_action: String = ""

func configure(campaign: RefCounted) -> void:
	var buffs: bool = false
	var healing: bool = false
	for definition: Resource in campaign.equipped_effects("power"):
		if definition.modifiers().has("heal_fraction"):
			healing = true
		else:
			buffs = true
	$TemporaryBuff.disabled = not buffs
	$MedicalSupport.disabled = not healing
	$TemporaryBuff.tooltip_text = "外勤增益 · 已装备" if buffs else "未装备外勤增益"
	$MedicalSupport.tooltip_text = "外勤治疗 · 已装备" if healing else "未装备外勤治疗"

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
	if (action_id == "temporary_buff" and $TemporaryBuff.disabled) or (action_id == "medical_support" and $MedicalSupport.disabled):
		return
	last_action = action_id
	action_requested.emit(action_id)
