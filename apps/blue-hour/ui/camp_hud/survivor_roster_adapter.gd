extends RefCounted
## Converts authored survivor definitions and the live campaign state into UI-only view data.

const AVATAR_DIRECTORY := "res://assets/ui/camp/survivor_avatars"
static var _avatar_path_cache: Dictionary = {}

static func build(catalog: RefCounted, campaign: RefCounted) -> Array[Dictionary]:
	var views: Array[Dictionary] = []
	var party_ids: Array = _campaign_members(campaign)
	var campaign_data: Dictionary = campaign.data if campaign != null else {}
	var roster_state: Dictionary = campaign_data.get("roster", {})
	var roster_manager: SurvivorRosterManager = campaign.roster_manager() if campaign != null and campaign.has_method("roster_manager") else null
	var definitions: Array[Resource] = _ordered_definitions(catalog, roster_manager)
	for definition: Resource in definitions:
		var survivor_id := str(definition.survivor_id)
		var role_tags: Array[String] = []
		for tag: String in definition.role_tags:
			role_tags.append(tag)
		var ownership_state := SurvivorRosterManager.RECRUITED
		if roster_manager != null:
			ownership_state = roster_manager.get_state(survivor_id)
		var is_recruited := ownership_state == SurvivorRosterManager.RECRUITED
		var is_discovered := ownership_state == SurvivorRosterManager.DISCOVERED
		var member_key := _member_key(campaign, roster_state, survivor_id, str(definition.id))
		var member_state: Dictionary = roster_state.get(member_key, {}) if not member_key.is_empty() else {}
		var is_party_member := member_key in party_ids or survivor_id in party_ids or str(definition.id) in party_ids
		var level := int(member_state.get("current_level", member_state.get("level", 1)))
		var max_hp := float(member_state.get("max_hp", definition.max_hp))
		var current_hp := float(member_state.get("hp", member_state.get("current_hp", max_hp)))
		var avatar_path := _avatar_path(survivor_id)
		var portrait: Texture2D = load(avatar_path) as Texture2D if not avatar_path.is_empty() else null
		var detail := _detail_data(definition, portrait, current_hp, max_hp, level, campaign, member_key) if is_recruited else {}
		var display_name := str(definition.display_name) if not ownership_state == SurvivorRosterManager.LOCKED else "未知幸存者"
		var status_text := "已招募" if is_recruited else ("已发现 · 等待救援" if is_discovered else "未知幸存者")
		views.append({
			"survivor_id": survivor_id,
			"display_name": display_name,
			"name_en": str(definition.id).to_upper(),
			"tags": " · ".join(role_tags),
			"portrait": portrait,
			"portrait_path": avatar_path,
			"avatar_path": avatar_path,
			"level": level if is_recruited else 0,
			"trait_name": str(detail.get("trait", "")) if is_recruited else "",
			"hp": current_hp,
			"max_hp": max_hp,
			"current_hp": current_hp,
			"current_state": status_text,
			"status": status_text,
			"ownership_state": ownership_state,
			"is_recruited": is_recruited,
			"is_discovered": is_discovered,
			"is_party_member": is_party_member and is_recruited,
			"detail": detail,
		})
	return views

static func _ordered_definitions(catalog: RefCounted, roster_manager: SurvivorRosterManager) -> Array[Resource]:
	if roster_manager == null:
		return catalog.survivors.duplicate()
	var ordered: Array[Resource] = []
	var recruited := roster_manager.get_recruited_survivors()
	var discovered := roster_manager.get_discovered_survivors()
	var all := roster_manager.get_all_survivors()
	for definition: Resource in recruited + discovered:
		ordered.append(definition)
	for definition: Resource in all:
		if definition not in ordered:
			ordered.append(definition)
	return ordered

static func _avatar_path(survivor_id: String) -> String:
	if _avatar_path_cache.has(survivor_id):
		return str(_avatar_path_cache[survivor_id])
	var resolved_path := ""
	if not survivor_id.is_empty():
		for filename: String in DirAccess.get_files_at(AVATAR_DIRECTORY):
			if filename.begins_with(survivor_id + "_") and filename.ends_with("_avatar.png"):
				resolved_path = AVATAR_DIRECTORY + "/" + filename
				break
	_avatar_path_cache[survivor_id] = resolved_path
	return resolved_path

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
