extends RefCounted
const Instance = preload("res://weapons/weapon_instance.gd")
const WeaponModifiers = preload("res://weapons/weapon_modifiers.gd")
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
	var modifiers: Variant = item.get("modifiers", [])
	if not modifiers is Array or modifiers.size() + int(not affix_id.is_empty()) > int(rarity):
		return false
	var seen: Array[String] = []
	for id: Variant in modifiers:
		if not id is String or id not in WeaponModifiers.choices(base.melee) or id in seen:
			return false
		seen.append(id)
	return true

func roll(pool: Array, uid: String, rng: RandomNumberGenerator, modified: bool = true) -> Dictionary:
	if pool.is_empty():
		return {}
	return create(str(pool[rng.randi_range(0, pool.size() - 1)]), uid, rng, rng.randi_range(1, 3) if modified else 0).to_dict()

func create(kind: String, uid: String, rng: RandomNumberGenerator, rarity: int = 0) -> WeaponInstance:
	var value := Instance.from_dict({"uid": uid, "kind": kind, "rarity": clampi(rarity, 0, 3)})
	var base: Resource = catalog.by_id(catalog.weapons, value.weapon_definition_id)
	if base == null:
		return value
	var choices: Array[String] = WeaponModifiers.choices(base.melee)
	for i in range(value.rarity):
		var index := rng.randi_range(0, choices.size() - 1)
		value.modifiers.append(choices.pop_at(index))
	return value

func resource(item: Dictionary) -> Resource:
	if not valid(item):
		return null
	var weapon: Resource = catalog.by_id(catalog.weapons, item.kind).duplicate()
	var instance := Instance.from_dict(item)
	weapon.rarity = instance.rarity
	WeaponModifiers.apply(weapon, instance.modifiers)
	if not instance.legacy_affix.is_empty():
		var affix: Resource = catalog.by_id(catalog.affixes, instance.legacy_affix)
		weapon.damage *= affix.damage_multiplier
		weapon.attack_range *= affix.range_multiplier
		weapon.magazine += affix.magazine_bonus
		weapon.reload_seconds *= affix.reload_multiplier
		weapon.display_name += " · " + affix.display_name
	return weapon

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
