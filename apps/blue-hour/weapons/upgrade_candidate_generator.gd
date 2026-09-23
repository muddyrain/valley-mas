class_name UpgradeCandidateGenerator
extends RefCounted
## Produces inert upgrade offers; it never applies them to a weapon definition or instance.

const UpgradeData = preload("res://data/weapon_upgrade_data.gd")
const ModifierRegistry = preload("res://data/weapon_modifier_registry.gd")
const ModifierData = preload("res://data/weapon_modifier_data.gd")
const Instance = preload("res://weapons/weapon_instance.gd")
const Definition = preload("res://data/weapon_data.gd")
const RarityProfileData = preload("res://data/weapon_rarity_profile_data.gd")

static func generate(
	weapon: Instance,
	definition: Definition,
	rarity_profile: RarityProfileData,
	current_level: int,
	upgrade_data: Array[UpgradeData],
	rng: RandomNumberGenerator,
	candidate_count: int = 3,
	active_conflict_groups: Array[StringName] = []
) -> Array[UpgradeData]:
	var candidates: Array[UpgradeData] = []
	if weapon == null or definition == null or rarity_profile == null or rng == null:
		return candidates
	if weapon.weapon_definition_id != definition.id or current_level < 1 or current_level >= 3 or candidate_count <= 0:
		return candidates
	var remaining: Array[UpgradeData] = []
	for upgrade: UpgradeData in upgrade_data:
		if not upgrade.validation_errors().is_empty():
			continue
		if upgrade.level != current_level + 1:
			continue
		if upgrade.weapon_id != "*" and upgrade.weapon_id != weapon.weapon_definition_id:
			continue
		if not _requirements_met(upgrade, weapon, definition, rarity_profile, current_level):
			continue
		if not _modifiers_available(upgrade, weapon, definition, rarity_profile, active_conflict_groups):
			continue
		if not upgrade.conflict_group.is_empty() and upgrade.conflict_group in active_conflict_groups:
			continue
		remaining.append(upgrade)
	while not remaining.is_empty() and candidates.size() < candidate_count:
		var total_weight: float = 0.0
		for upgrade: UpgradeData in remaining:
			total_weight += _effective_weight(upgrade)
		if total_weight <= 0.0:
			break
		var pick := rng.randf() * total_weight
		for index: int in range(remaining.size()):
			var upgrade: UpgradeData = remaining[index]
			pick -= _effective_weight(upgrade)
			if pick < 0.0 or index == remaining.size() - 1:
				candidates.append(upgrade)
				remaining.remove_at(index)
				break
	return candidates

static func _effective_weight(upgrade: UpgradeData) -> float:
	var result := upgrade.weight
	for modifier_id: String in upgrade.modifier_additions:
		var modifier := ModifierRegistry.by_id(modifier_id)
		if modifier == null:
			return 0.0
		result *= modifier.rarity_weight
	return result

static func _requirements_met(
	upgrade: UpgradeData,
	weapon: Instance,
	definition: Definition,
	rarity_profile: RarityProfileData,
	current_level: int
) -> bool:
	for requirement: Dictionary in upgrade.requirements:
		match str(requirement.get("kind", "")):
			"HAS_MODIFIER":
				if str(requirement.get("modifier_id", "")) not in weapon.modifiers:
					return false
			"HAS_TAG":
				if str(requirement.get("tag", "")) not in definition.tags:
					return false
			"RARITY_AT_LEAST":
				if rarity_profile.tier < int(requirement.get("tier", 0)):
					return false
			"UPGRADE_LEVEL_EQUALS":
				if current_level != int(requirement.get("level", 0)):
					return false
			_:
				return false
	return true

static func _modifiers_available(
	upgrade: UpgradeData,
	weapon: Instance,
	definition: Definition,
	rarity_profile: RarityProfileData,
	active_conflict_groups: Array[StringName]
) -> bool:
	var seen_in_offer: Array[String] = []
	var seen_conflicts: Array[StringName] = active_conflict_groups.duplicate()
	var used_special_slots: int = 0
	for existing_id: String in weapon.modifiers:
		var existing_modifier := ModifierRegistry.by_id(existing_id)
		if existing_modifier == null:
			return false
		if existing_modifier.category == ModifierData.Category.SPECIAL:
			used_special_slots += 1
		if not existing_modifier.conflict_group.is_empty() and existing_modifier.conflict_group not in seen_conflicts:
			seen_conflicts.append(existing_modifier.conflict_group)
	for modifier_id: String in upgrade.modifier_additions:
		var modifier := ModifierRegistry.by_id(modifier_id)
		if modifier == null or modifier_id in seen_in_offer:
			return false
		seen_in_offer.append(modifier_id)
		if not modifier.weapon_tags.is_empty():
			for required_tag: String in modifier.weapon_tags:
				if required_tag not in definition.tags:
					return false
		if weapon.modifiers.count(modifier_id) >= modifier.max_stack:
			return false
		if modifier.category == ModifierData.Category.SPECIAL:
			used_special_slots += 1
			if used_special_slots > rarity_profile.special_effect_slots:
				return false
		if not modifier.conflict_group.is_empty() and modifier.conflict_group in seen_conflicts:
			return false
		if not modifier.conflict_group.is_empty():
			seen_conflicts.append(modifier.conflict_group)
	return true
