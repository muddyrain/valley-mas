class_name WeaponUpgradeApplier
extends RefCounted
## Builds an upgraded WeaponInstance copy; callers commit it only after success.

const Instance = preload("res://weapons/weapon_instance.gd")
const UpgradeData = preload("res://data/weapon_upgrade_data.gd")
const WeaponData = preload("res://data/weapon_data.gd")
const WeaponRegistry = preload("res://data/weapon_registry.gd")
const ModifierRegistry = preload("res://data/weapon_modifier_registry.gd")
const ModifierData = preload("res://data/weapon_modifier_data.gd")
const RarityRegistry = preload("res://data/weapon_rarity_registry.gd")
const RarityProfileData = preload("res://data/weapon_rarity_profile_data.gd")

static func apply(weapon: Instance, upgrade: UpgradeData, run_id: String, upgrade_seed: int) -> Dictionary:
	var validation_error := _validation_error(weapon, upgrade, run_id)
	if not validation_error.is_empty():
		return {"ok": false, "error": validation_error}

	var next := Instance.from_dict(weapon.to_dict(true))
	var before := next.level
	var additions: Array[String] = upgrade.modifier_additions.duplicate()
	var changes: Array[Dictionary] = upgrade.stat_changes.duplicate(true)
	next.level = upgrade.level
	next.instance_schema = 1
	var history_result := {
		"modifier_additions": additions,
		"stat_changes": changes,
		"conflict_group": String(upgrade.conflict_group),
	}
	next.upgrade_history.append({
		"upgrade_id": upgrade.id,
		"level_before": before,
		"level_after": next.level,
		"run_id": run_id,
		"seed": upgrade_seed,
		"result": history_result,
	})
	return {"ok": true, "error": "", "weapon": next}

static func _validation_error(weapon: Instance, upgrade: UpgradeData, run_id: String) -> String:
	if weapon == null or upgrade == null:
		return "Weapon and upgrade are required."
	if weapon.instance_id.is_empty() or weapon.weapon_definition_id.is_empty():
		return "Weapon identity is incomplete."
	if run_id.is_empty():
		return "Run identity is required for upgrade history."
	if not upgrade.validation_errors().is_empty():
		return "Upgrade data is invalid."
	if upgrade.level != weapon.level + 1 or upgrade.level > 3:
		return "Upgrade level does not match the next weapon level."
	if upgrade.weapon_id != "*" and upgrade.weapon_id != weapon.weapon_definition_id:
		return "Upgrade targets a different weapon."
	for entry: Dictionary in weapon.upgrade_history:
		if str(entry.get("upgrade_id", "")) == upgrade.id:
			return "Upgrade was already applied to this weapon."
	var definition: WeaponData = _definition(weapon.weapon_definition_id)
	if definition == null:
		return "Weapon definition is missing."
	var profile: RarityProfileData = RarityRegistry.by_tier(weapon.rarity)
	if profile == null:
		return "Weapon rarity profile is missing."

	var active_ids: Array[String] = weapon.modifiers.duplicate()
	var active_conflicts: Array[StringName] = []
	for entry: Dictionary in weapon.upgrade_history:
		var prior_result: Variant = entry.get("result", {})
		if not prior_result is Dictionary:
			continue
		for modifier_id: Variant in prior_result.get("modifier_additions", []):
			if modifier_id is String:
				active_ids.append(modifier_id)
		var conflict_group := StringName(str(prior_result.get("conflict_group", "")))
		if not conflict_group.is_empty() and conflict_group not in active_conflicts:
			active_conflicts.append(conflict_group)
	for modifier_id: String in active_ids:
		var active_modifier = ModifierRegistry.by_id(modifier_id)
		if active_modifier == null:
			return "Weapon contains an unavailable modifier."
		if not active_modifier.conflict_group.is_empty() and active_modifier.conflict_group not in active_conflicts:
			active_conflicts.append(active_modifier.conflict_group)
	if not _requirements_met(upgrade, weapon, definition, profile, active_ids):
		return "Upgrade requirements are no longer met."
	if not upgrade.conflict_group.is_empty() and upgrade.conflict_group in active_conflicts:
		return "Upgrade conflict group is already active."
	if not upgrade.conflict_group.is_empty():
		active_conflicts.append(upgrade.conflict_group)

	var special_slots_used := 0
	for modifier_id: String in active_ids:
		var modifier: ModifierData = ModifierRegistry.by_id(modifier_id)
		if modifier.category == ModifierData.Category.SPECIAL:
			special_slots_used += 1
	for modifier_id: String in upgrade.modifier_additions:
		var modifier: ModifierData = ModifierRegistry.by_id(modifier_id)
		if modifier == null:
			return "Upgrade references an unavailable modifier."
		if active_ids.count(modifier_id) >= modifier.max_stack:
			return "Modifier stack limit would be exceeded."
		for tag: String in modifier.weapon_tags:
			if tag not in definition.tags:
				return "Modifier is not valid for this weapon."
		if modifier.category == ModifierData.Category.SPECIAL:
			special_slots_used += 1
			if special_slots_used > profile.special_effect_slots:
				return "Rarity special-effect slots would be exceeded."
		if not modifier.conflict_group.is_empty() and modifier.conflict_group in active_conflicts:
			return "Modifier conflict group is already active."
		if not modifier.conflict_group.is_empty():
			active_conflicts.append(modifier.conflict_group)
		active_ids.append(modifier_id)
	return ""

static func _requirements_met(
	upgrade: UpgradeData,
	weapon: Instance,
	definition: WeaponData,
	profile: RarityProfileData,
	active_modifier_ids: Array[String]
) -> bool:
	for requirement: Dictionary in upgrade.requirements:
		match str(requirement.get("kind", "")):
			"HAS_MODIFIER":
				if str(requirement.get("modifier_id", "")) not in active_modifier_ids:
					return false
			"HAS_TAG":
				if str(requirement.get("tag", "")) not in definition.tags:
					return false
			"RARITY_AT_LEAST":
				if profile.tier < int(requirement.get("tier", 0)):
					return false
			"UPGRADE_LEVEL_EQUALS":
				if weapon.level != int(requirement.get("level", 0)):
					return false
			_:
				return false
	return true

static func _definition(weapon_id: String) -> WeaponData:
	for definition: Resource in WeaponRegistry.definitions():
		if definition.id == weapon_id:
			return definition as WeaponData
	return null
