extends Panel

var survivor_id: String = ""

func show_survivor(data: Dictionary) -> void:
	survivor_id = data.id
	$HeaderPanel/SurvivorName.text = data.name
	$HeaderPanel/SurvivorNameEn.text = data.name_en
	$HeaderPanel/RoleLabel.text = data.role
	$HeaderPanel/Tags.text = data.tags
	$HeaderPanel/Quote.text = data.quote
	$HeaderPanel/HalfPortrait.texture = data.portrait
	$CombatPanel/WeaponName.text = data.weapon
	$CombatPanel/WeaponType.text = data.weapon_type
	$CombatPanel/PowerValue.text = data.power
	var attributes: Array = data.attributes
	for index: int in range(4):
		var row: Control = $AttributesPanel.get_child(index)
		row.get_node("Value").text = str(attributes[index])
		row.get_node("Bar").value = float(attributes[index])
	$TraitPanel/TraitName.text = data.trait
	$TraitPanel/TraitDescription.text = data.trait_description
