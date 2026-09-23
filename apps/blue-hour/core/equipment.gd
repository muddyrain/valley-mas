extends RefCounted
const Instance = preload("res://weapons/weapon_instance.gd")
const WeaponModifiers = preload("res://weapons/weapon_modifiers.gd")
const RarityRegistry = preload("res://data/weapon_rarity_registry.gd")
const RarityProfileData = preload("res://data/weapon_rarity_profile_data.gd")
const TraitRuntime = preload("res://core/trait_runtime.gd")
var catalog: RefCounted

func _init(content: RefCounted) -> void:
	catalog = content

func valid(item: Dictionary) -> bool:
	if not item.get("uid", "") is String or String(item.get("uid", "")).is_empty():
		return false
	var base = catalog.by_id(catalog.weapons, str(item.get("kind", "")))
	if base == null:
		return false
	var affix_id := str(item.get("affix", ""))
	if not affix_id.is_empty():
		var affix: Resource = catalog.by_id(catalog.affixes, affix_id)
		if affix == null or affix.melee_only != base.melee:
			return false
	var rarity: Variant = item.get("rarity", 0 if affix_id.is_empty() else 1)
	if not (rarity is int or rarity is float) or rarity != floor(float(rarity)) or rarity < 0 or rarity > 3:
		return false
	var rarity_profile: RarityProfileData = RarityRegistry.by_tier(int(rarity))
	if rarity_profile == null:
		return false
	var modifiers: Variant = item.get("modifiers", [])
	var legacy_modifier_capacity: int = rarity_profile.modifier_slots + rarity_profile.special_effect_slots
	if not modifiers is Array or modifiers.size() + int(not affix_id.is_empty()) > legacy_modifier_capacity:
		return false
	var seen: Array[String] = []
	for id: Variant in modifiers:
		if not id is String or id not in WeaponModifiers.choices(base.melee) or id in seen:
			return false
		seen.append(id)
	return true

func roll(pool: Array, uid: String, rng: RandomNumberGenerator, modified: bool = true, trait_data: Resource = null) -> Dictionary:
	if pool.is_empty():
		return {}
	var rarity: int = 0
	if modified:
		var rarities: Array[RarityProfileData] = []
		for tier: int in range(1, 4):
			var profile: RarityProfileData = RarityRegistry.by_tier(tier)
			if profile != null:
				rarities.append(profile)
		var total_weight: float = 0.0
		for profile: RarityProfileData in rarities:
			total_weight += TraitRuntime.loot_weight(profile.drop_weight, profile.tier, trait_data)
		var pick: float = rng.randf() * total_weight
		for profile: RarityProfileData in rarities:
			pick -= TraitRuntime.loot_weight(profile.drop_weight, profile.tier, trait_data)
			if pick <= 0.0:
				rarity = profile.tier
				break
	return create(str(pool[rng.randi_range(0, pool.size() - 1)]), uid, rng, rarity).to_dict()

func create(kind: String, uid: String, rng: RandomNumberGenerator, rarity: int = 0) -> WeaponInstance:
	var value := Instance.from_dict({"uid": uid, "kind": kind, "rarity": clampi(rarity, 0, 3)})
	var base: Resource = catalog.by_id(catalog.weapons, value.weapon_definition_id)
	if base == null:
		return value
	var rarity_profile: RarityProfileData = RarityRegistry.by_tier(value.rarity)
	if rarity_profile == null:
		return value
	var choices: Array[String] = WeaponModifiers.choices(base.melee)
	var legacy_modifier_capacity: int = rarity_profile.modifier_slots + rarity_profile.special_effect_slots
	for i in range(legacy_modifier_capacity):
		var index := rng.randi_range(0, choices.size() - 1)
		value.modifiers.append(choices.pop_at(index))
	return value

func resource(item: Dictionary) -> Resource:
	if not valid(item):
		return null
	var weapon: Resource = catalog.by_id(catalog.weapons, item.kind).duplicate()
	var instance := Instance.from_dict(item)
	weapon.rarity = instance.rarity
	var applied_modifiers: Array[String] = instance.modifiers.duplicate()
	for history_entry: Dictionary in instance.upgrade_history:
		var result: Variant = history_entry.get("result", {})
		if result is Dictionary:
			for modifier_id: Variant in result.get("modifier_additions", []):
				if modifier_id is String:
					applied_modifiers.append(modifier_id)
	WeaponModifiers.apply(weapon, applied_modifiers)
	if not instance.legacy_affix.is_empty():
		var affix: Resource = catalog.by_id(catalog.affixes, instance.legacy_affix)
		weapon.damage *= affix.damage_multiplier
		weapon.attack_range *= affix.range_multiplier
		weapon.magazine += affix.magazine_bonus
		weapon.reload_seconds *= affix.reload_multiplier
		weapon.display_name += " · " + affix.display_name
	for history_entry: Dictionary in instance.upgrade_history:
		var result: Variant = history_entry.get("result", {})
		if result is Dictionary:
			_apply_stat_changes(weapon, result.get("stat_changes", []))
	return weapon

func _apply_stat_changes(weapon: Resource, raw_changes: Variant) -> void:
	if not raw_changes is Array:
		return
	for raw_change: Variant in raw_changes:
		if not raw_change is Dictionary:
			continue
		var stat: String = str(raw_change.get("stat", ""))
		var operation: String = str(raw_change.get("operation", ""))
		if stat not in ["damage", "attack_rate", "magazine_size", "reload_time", "accuracy", "range", "penetration", "knockback", "pellet_count"]:
			continue
		var value: Variant = raw_change.get("value")
		if not (value is int or value is float) or not is_finite(float(value)):
			continue
		var next_value := float(weapon.get(stat))
		match operation:
			"ADD": next_value += float(value)
			"MULTIPLY": next_value *= float(value)
			"SET": next_value = float(value)
			_:
				continue
		if stat == "magazine_size" or stat == "penetration" or stat == "pellet_count":
			weapon.set(stat, ceili(next_value))
		elif stat == "accuracy":
			weapon.set(stat, clampf(next_value, 0.0, 1.0))
		else:
			weapon.set(stat, next_value)

func title(item: Dictionary) -> String:
	var value := resource(item)
	return value.display_name if value else "未装备"

func description(item: Dictionary) -> String:
	var value := resource(item)
	if value == null:
		return ""
	var stats := "伤害 %.0f · 射程 %.1fm" % [value.damage, value.attack_range]
	if not value.melee:
		stats += " · 弹匣 %d · 换弹 %.1fs" % [value.magazine, value.reload_seconds]
	return stats
