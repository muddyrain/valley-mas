extends Panel

enum TransitionState { CLOSED, OPENING, OPEN, CLOSING, SWITCHING }

const OPEN_DURATION := 0.26
const CLOSE_DURATION := 0.20
const SWITCH_OUT_DURATION := 0.08
const SWITCH_IN_DURATION := 0.16

var survivor_id: String = ""
var transition_state: TransitionState = TransitionState.CLOSED
var _transition: Tween
var _rest_position: Vector2 = Vector2.ZERO
var _slide_factor: float = 1.0
var _pending_data: Dictionary = {}
var _content: Array[Control] = []
var _content_positions: Array[Vector2] = []

func _ready() -> void:
	_rest_position = position
	for child: Node in get_children():
		var control := child as Control
		if control != null:
			_content.append(control)
			_content_positions.append(control.position)
	visible = false
	modulate.a = 0.0
	mouse_filter = Control.MOUSE_FILTER_STOP

func set_layout_position(rest_position: Vector2, scale_factor: float) -> void:
	_rest_position = rest_position
	_slide_factor = scale_factor
	if transition_state == TransitionState.CLOSED or transition_state == TransitionState.OPEN:
		position = _rest_position
		return
	_cancel_transition()
	if transition_state == TransitionState.CLOSING:
		_snap_closed()
	else:
		if not _pending_data.is_empty():
			show_survivor(_pending_data)
			_pending_data.clear()
		_snap_open()

func present(data: Dictionary) -> void:
	if data.is_empty():
		return
	var target_id := str(data.get("id", ""))
	match transition_state:
		TransitionState.CLOSED:
			_start_open(data, true)
		TransitionState.CLOSING:
			_start_open(data, false)
		TransitionState.OPENING, TransitionState.SWITCHING:
			if target_id == survivor_id and transition_state == TransitionState.OPENING:
				_pending_data.clear()
				show_survivor(data)
			else:
				_pending_data = data.duplicate(true)
		TransitionState.OPEN:
			if target_id == survivor_id:
				show_survivor(data)
			else:
				_start_switch(data)

func close_panel() -> void:
	if transition_state == TransitionState.CLOSED or transition_state == TransitionState.CLOSING:
		return
	_pending_data.clear()
	_cancel_transition()
	transition_state = TransitionState.CLOSING
	_transition = create_tween()
	_transition.tween_property(self, "modulate:a", 0.0, CLOSE_DURATION).set_delay(0.02).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	_transition.parallel().tween_property(self, "position:x", _rest_position.x + 18.0 * _slide_factor, CLOSE_DURATION).set_delay(0.02).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	for control: Control in _content:
		_transition.parallel().tween_property(control, "modulate:a", 0.0, 0.08)
	_transition.tween_callback(_snap_closed)

func force_hidden() -> void:
	_cancel_transition()
	_pending_data.clear()
	_snap_closed()

func _start_open(data: Dictionary, from_closed: bool) -> void:
	_cancel_transition()
	_pending_data.clear()
	show_survivor(data)
	visible = true
	transition_state = TransitionState.OPENING
	if from_closed:
		position = _rest_position + Vector2(24.0 * _slide_factor, 0.0)
		modulate.a = 0.0
		for control: Control in _content:
			control.modulate.a = 0.0
	else:
		for index: int in range(_content.size()):
			_content[index].position = _content_positions[index]
	_transition = create_tween()
	_transition.tween_property(self, "modulate:a", 1.0, OPEN_DURATION).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_transition.parallel().tween_property(self, "position:x", _rest_position.x, OPEN_DURATION).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	for index: int in range(_content.size()):
		_transition.parallel().tween_property(_content[index], "modulate:a", 1.0, 0.15).set_delay(0.03 + float(index) * 0.015).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_transition.tween_callback(_finish_open)

func _finish_open() -> void:
	_snap_open()
	if _pending_data.is_empty():
		return
	var data := _pending_data.duplicate()
	_pending_data.clear()
	if str(data.get("id", "")) == survivor_id:
		show_survivor(data)
	else:
		_start_switch(data)

func _start_switch(data: Dictionary) -> void:
	_cancel_transition()
	_pending_data = data.duplicate(true)
	transition_state = TransitionState.SWITCHING
	_transition = create_tween()
	for index: int in range(_content.size()):
		var control := _content[index]
		var fade := _transition.tween_property(control, "modulate:a", 0.0, SWITCH_OUT_DURATION) if index == 0 else _transition.parallel().tween_property(control, "modulate:a", 0.0, SWITCH_OUT_DURATION)
		fade.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	_transition.tween_callback(_swap_content)

func _swap_content() -> void:
	if _pending_data.is_empty():
		_finish_switch()
		return
	var data := _pending_data.duplicate()
	_pending_data.clear()
	show_survivor(data)
	for index: int in range(_content.size()):
		_content[index].modulate.a = 0.0
		_content[index].position = _content_positions[index] + Vector2(0.0, 4.0)
	_transition = create_tween()
	for index: int in range(_content.size()):
		var control := _content[index]
		var fade := _transition.tween_property(control, "modulate:a", 1.0, SWITCH_IN_DURATION) if index == 0 else _transition.parallel().tween_property(control, "modulate:a", 1.0, SWITCH_IN_DURATION)
		fade.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		_transition.parallel().tween_property(control, "position", _content_positions[index], SWITCH_IN_DURATION).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_transition.tween_callback(_finish_switch)

func _finish_switch() -> void:
	_snap_open()
	if _pending_data.is_empty():
		return
	var data := _pending_data.duplicate()
	_pending_data.clear()
	if str(data.get("id", "")) == survivor_id:
		show_survivor(data)
	else:
		_start_switch(data)

func _snap_open() -> void:
	visible = true
	position = _rest_position
	modulate.a = 1.0
	_reset_content()
	transition_state = TransitionState.OPEN

func _snap_closed() -> void:
	visible = false
	position = _rest_position
	modulate.a = 0.0
	_reset_content()
	survivor_id = ""
	transition_state = TransitionState.CLOSED

func _reset_content() -> void:
	for index: int in range(_content.size()):
		_content[index].modulate.a = 1.0
		_content[index].position = _content_positions[index]

func _cancel_transition() -> void:
	if _transition != null:
		_transition.kill()
		_transition = null

func show_survivor(data: Dictionary) -> void:
	survivor_id = str(data.get("id", ""))
	$HeaderPanel/SurvivorName.text = str(data.get("name", ""))
	$HeaderPanel/SurvivorNameEn.text = "%s  ·  Lv.%d  ·  %s" % [
		survivor_id,
		int(data.get("level", 1)),
		str(data.get("current_state", "")),
	]
	$HeaderPanel/HPLabel.text = "HP %d / %d" % [
		roundi(float(data.get("hp", 0.0))),
		roundi(float(data.get("max_hp", 0.0))),
	]
	var role_tags := str(data.get("tags", "")).strip_edges()
	var trait_name := str(data.get("trait", "")).strip_edges()
	$HeaderPanel/TraitBadge.visible = not role_tags.is_empty()
	$HeaderPanel/TraitBadge/Label.text = role_tags
	var background_title := str(data.get("background_title", "")).strip_edges()
	$HeaderPanel/RoleLabel.visible = not background_title.is_empty()
	$HeaderPanel/RoleLabel.text = background_title
	var quote := str(data.get("quote", "")).strip_edges()
	if quote.is_empty():
		quote = str(data.get("background_description", "")).strip_edges()
	if quote.contains("。"):
		quote = quote.get_slice("。", 0) + "。"
	if quote.length() > 37:
		quote = quote.left(36) + "…"
	$BackgroundPanel.visible = not quote.is_empty()
	$BackgroundPanel/BackgroundDescription.text = quote
	$HeaderPanel/PortraitContainer/HalfPortrait.texture = data.get("portrait") as Texture2D
	$CombatPanel/WeaponName.text = str(data.get("weapon", ""))
	$CombatPanel/WeaponType.text = str(data.get("weapon_type", ""))
	$CombatPanel/PowerValue.text = str(data.get("power", "—"))
	var attributes: Array = data.get("attributes", [])
	var rows: Array[String] = ["Survival", "Firepower", "TeamSupport", "Mobility"]
	for index: int in range(rows.size()):
		var value := float(attributes[index]) if index < attributes.size() else 0.0
		var row: Control = $AttributesPanel.get_node(rows[index])
		row.get_node("Value").text = str(roundi(value))
		row.get_node("Bar").value = value
	$TraitPanel.visible = not trait_name.is_empty() and trait_name != "未定义"
	$TraitPanel/TraitName.text = "%s · Lv.%d" % [trait_name, int(data.get("trait_level", 1))]
	$TraitPanel/TraitDescription.text = str(data.get("trait_description", ""))
	var action_states: Dictionary = data.get("action_states", {})
	$ActionBar/SwitchButton.disabled = str(action_states.get("switch", "disabled")) != "available"
	$ActionBar/EquipmentButton.disabled = str(action_states.get("equipment", "disabled")) != "available"
	$ActionBar/UpgradeButton.disabled = str(action_states.get("upgrade", "locked")) != "available"
