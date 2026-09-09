extends RefCounted
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
	if affix_id.is_empty():
		return true
	var affix = catalog.by_id(catalog.affixes, affix_id)
	return affix != null and affix.melee_only == base.melee

func roll(pool: Array, uid: String, rng: RandomNumberGenerator, modified: bool = true) -> Dictionary:
	var kind: String = pool[rng.randi_range(0, pool.size() - 1)]
	var choices: Array[String] = []
	for affix in catalog.affixes:
		if affix.melee_only == catalog.by_id(catalog.weapons, kind).melee:
			choices.append(affix.id)
	return {"uid": uid, "kind": kind, "affix": choices[rng.randi_range(0, choices.size() - 1)] if modified and not choices.is_empty() else ""}

func resource(item: Dictionary) -> Resource:
	if not valid(item):
		return null
	var weapon: Resource = catalog.by_id(catalog.weapons, item.kind).duplicate()
	if item.affix != "":
		var affix: Resource = catalog.by_id(catalog.affixes, item.affix)
		weapon.damage *= affix.damage_multiplier
		weapon.attack_range *= affix.range_multiplier
		weapon.magazine += affix.magazine_bonus
		weapon.reload_seconds *= affix.reload_multiplier
		weapon.display_name += " · " + affix.display_name
	return weapon

func title(item: Dictionary) -> String:
	var value := resource(item)
	return value.display_name if value else "未知装备"

func description(item: Dictionary) -> String:
	var value := resource(item)
	if value == null:
		return ""
	var stats := "伤害 %.0f · 射程 %.1fm" % [value.damage, value.attack_range]
	if not value.melee:
		stats += " · 弹匣 %d · 换弹 %.1fs" % [value.magazine, value.reload_seconds]
	return stats
