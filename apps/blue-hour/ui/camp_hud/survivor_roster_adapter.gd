extends RefCounted
## Converts authored survivor definitions and the live campaign state into UI-only view data.

static func build(catalog: RefCounted, campaign: RefCounted) -> Array[Dictionary]:
	var views: Array[Dictionary] = []
	var party_ids: Array = _campaign_members(campaign)
	var campaign_data: Dictionary = campaign.data if campaign != null else {}
	var roster_state: Dictionary = campaign_data.get("roster", {})
	for definition: Resource in catalog.survivors:
		var survivor_id := str(definition.survivor_id)
		var member_key := _member_key(campaign, roster_state, survivor_id, str(definition.id))
		var member_state: Dictionary = roster_state.get(member_key, {}) if not member_key.is_empty() else {}
		var is_party_member := member_key in party_ids or survivor_id in party_ids or str(definition.id) in party_ids
		var level := int(member_state.get("current_level", member_state.get("level", 1)))
		var max_hp := float(member_state.get("max_hp", definition.max_hp))
		var current_hp := float(member_state.get("hp", member_state.get("current_hp", max_hp)))
		var portrait_path := str(definition.portrait)
		var portrait: Texture2D = load(portrait_path) as Texture2D if not portrait_path.is_empty() else null
		var detail := _detail_data(definition, portrait, current_hp, max_hp, level, campaign, member_key)
		views.append({
			"survivor_id": survivor_id,
			"display_name": str(definition.display_name),
			"portrait": portrait,
			"portrait_path": portrait_path,
			"level": level,
			"hp": current_hp,
			"max_hp": max_hp,
			"current_hp": current_hp,
			"current_state": str(member_state.get("current_state", member_state.get("status", "待命" if is_party_member else "未入队"))),
			"status": str(member_state.get("current_state", member_state.get("status", "待命" if is_party_member else "未入队"))),
			"is_party_member": is_party_member,
			"detail": detail,
		})
	return views

static func _campaign_members(campaign: RefCounted) -> Array:
	if campaign == null or not campaign.data is Dictionary:
		return []
	return campaign.data.get("members", [])

static func _member_key(campaign: RefCounted, roster_state: Dictionary, survivor_id: String, legacy_id: String) -> String:
	for candidate: String in [survivor_id, legacy_id]:
		if roster_state.has(candidate):
			return candidate
	if campaign == null:
		return ""
	for key: Variant in roster_state.keys():
		var value: Variant = roster_state[key]
		if value is Dictionary and str(value.get("template", "")) in [survivor_id, legacy_id]:
			return str(key)
	return ""

static func _detail_data(definition: Resource, portrait: Texture2D, current_hp: float, max_hp: float, level: int, campaign: RefCounted, member_key: String) -> Dictionary:
	var role_tags: Array[String] = []
	for tag: String in definition.role_tags:
		role_tags.append(tag)
	var attribute_base := clampi(int(round(current_hp / maxf(max_hp, 1.0) * 24.0)), 1, 24)
	var trait_data: Resource = definition.trait_definition
	var trait_level := 1
	if campaign != null and not member_key.is_empty() and campaign.has_method("get_trait_level"):
		trait_level = int(campaign.get_trait_level(member_key))
	if campaign != null and not member_key.is_empty() and campaign.has_method("member_trait"):
		var live_trait: Resource = campaign.member_trait(member_key)
		if live_trait != null:
			trait_data = live_trait
	if trait_data != null and trait_data.has_method("at_level"):
		trait_data = trait_data.at_level(trait_level)
	var trait_name := str(trait_data.display_name) if trait_data != null else str(definition.trait_name)
	var trait_description := str(trait_data.summary()) if trait_data != null and trait_data.has_method("summary") else str(definition.trait_description)
	var equipment := _equipment_data(campaign, member_key)
	return {
		"id": str(definition.survivor_id),
		"name": str(definition.display_name),
		"name_en": str(definition.id).to_upper(),
		"level": level,
		"hp": current_hp,
		"max_hp": max_hp,
		"background_title": str(definition.background_title),
		"background_description": str(definition.background_description),
		"tags": " · ".join(role_tags),
		"portrait": portrait,
		"equipment": equipment,
		"weapon": str(equipment.get("display_name", "")),
		"weapon_type": str(equipment.get("type_name", "—")),
		"power": str(equipment.get("power", "—")),
		"attributes": [attribute_base, attribute_base, attribute_base, attribute_base],
		"attributes_source": "SurvivorDefinition.max_hp/current_hp",
		"trait": trait_name if not trait_name.is_empty() else "未定义",
		"trait_description": trait_description,
		"trait_level": trait_level,
		"action_states": {"switch": "disabled", "equipment": "disabled", "upgrade": "locked"},
	}

static func _equipment_data(campaign: RefCounted, member_key: String) -> Dictionary:
	var result := {
		"id": "",
		"display_name": "未装备",
		"type_name": "—",
		"power": "—",
		"state": "empty",
	}
	if campaign == null or member_key.is_empty() or not campaign.data is Dictionary:
		return result
	var equipment: Dictionary = campaign.data.get("equipment", {})
	var uid := str(equipment.get(member_key, ""))
	if uid.is_empty() or not campaign.has_method("item"):
		return result
	var item: Dictionary = campaign.item(uid)
	if item.is_empty() or campaign.gear == null:
		return result
	var weapon: Resource = campaign.gear.resource(item)
	if weapon == null:
		return result
	result.id = uid
	result.display_name = campaign.gear.title(item)
	result.type_name = weapon.type_name() if weapon.has_method("type_name") else "—"
	result.power = str(roundi(float(weapon.damage)))
	result.state = "equipped"
	return result
