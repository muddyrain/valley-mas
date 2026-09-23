class_name WeaponInstance
extends RefCounted
## uid/kind are the existing save keys for instance_id/weapon_definition_id.

const Definition = preload("res://data/weapon_data.gd")
const Registry = preload("res://data/weapon_registry.gd")
var instance_id: String = ""
var weapon_definition_id: String = ""
var rarity: int = Definition.Rarity.COMMON
var modifiers: Array[String] = []
var legacy_affix: String = ""
var level: int = 1
var upgrade_history: Array[Dictionary] = []
var seed: int = 0
var pending_upgrade: Dictionary = {}
var instance_schema: int = 1

static func from_dict(value: Dictionary) -> WeaponInstance:
	var result := WeaponInstance.new()
	result.instance_id = str(value.get("uid", ""))
	result.weapon_definition_id = Registry.canonical_id(str(value.get("kind", "")))
	result.legacy_affix = str(value.get("affix", ""))
	result.rarity = int(value.get("rarity", Definition.Rarity.COMMON if result.legacy_affix.is_empty() else Definition.Rarity.UNCOMMON))
	for modifier: String in value.get("modifiers", []):
		result.modifiers.append(modifier)
	result.level = int(value.get("level", 1))
	var history: Variant = value.get("upgrade_history", [])
	if history is Array:
		for entry: Variant in history:
			if entry is Dictionary:
				result.upgrade_history.append(entry.duplicate(true))
	result.seed = int(value.get("seed", 0))
	var pending: Variant = value.get("pending_upgrade", {})
	if pending is Dictionary:
		result.pending_upgrade = pending.duplicate(true)
	result.instance_schema = int(value.get("instance_schema", 0))
	return result

func to_dict(include_upgrade_state: bool = false) -> Dictionary:
	var result := {"uid": instance_id, "kind": weapon_definition_id, "rarity": rarity, "modifiers": modifiers.duplicate(), "affix": legacy_affix}
	if include_upgrade_state:
		result.merge({
			"level": level,
			"upgrade_history": upgrade_history.duplicate(true),
			"seed": seed,
			"pending_upgrade": pending_upgrade.duplicate(true),
			"instance_schema": instance_schema,
		}, true)
	return result
