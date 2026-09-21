extends Panel

var survivor_id: String = ""

func show_survivor(data: Dictionary) -> void:
	survivor_id = str(data.get("id", ""))
	$HeaderPanel/SurvivorName.text = str(data.get("name", ""))
	$HeaderPanel/SurvivorNameEn.text = "%s · Lv.%d" % [
		str(data.get("id", "")),
		int(data.get("level", 1)),
	]
	$HeaderPanel/HPLabel.text = "HP %d / %d" % [
		roundi(float(data.get("hp", 0.0))),
		roundi(float(data.get("max_hp", 0.0))),
	]
	var background_title := str(data.get("background_title", ""))
	var background_description := str(data.get("background_description", ""))
	$HeaderPanel/RoleLabel.text = background_title
	$HeaderPanel/Tags.text = str(data.get("tags", ""))
	$HeaderPanel/Quote.text = background_description
	$BackgroundPanel/BackgroundRole.text = background_title
	$BackgroundPanel/BackgroundDescription.text = background_description
	$HeaderPanel/PortraitContainer/HalfPortrait.texture = data.get("portrait") as Texture2D
	$HeaderPanel/HalfPortrait.texture = data.get("portrait") as Texture2D
	$CombatPanel/WeaponName.text = str(data.get("weapon", ""))
	$CombatPanel/WeaponType.text = str(data.get("weapon_type", "—"))
	$CombatPanel/PowerValue.text = str(data.get("power", "—"))
	var attributes: Array = data.get("attributes", [0, 0, 0, 0])
	for index: int in range(4):
		var row: Control = $AttributesPanel.get_child(index)
		row.get_node("Value").text = str(attributes[index])
		row.get_node("Bar").value = float(attributes[index])
	$TraitPanel/TraitName.text = "%s · Lv.%d" % [str(data.get("trait", "未定义")), int(data.get("trait_level", 1))]
	$TraitPanel/TraitDescription.text = str(data.get("trait_description", ""))
	var action_states: Dictionary = data.get("action_states", {})
	$ActionBar/SwitchButton.disabled = str(action_states.get("switch", "disabled")) != "available"
	$ActionBar/EquipmentButton.disabled = str(action_states.get("equipment", "disabled")) != "available"
	$ActionBar/UpgradeButton.disabled = str(action_states.get("upgrade", "locked")) != "available"
