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

static func from_dict(value: Dictionary) -> WeaponInstance:
	var result := WeaponInstance.new()
	result.instance_id = str(value.get("uid", ""))
	result.weapon_definition_id = Registry.canonical_id(str(value.get("kind", "")))
	result.legacy_affix = str(value.get("affix", ""))
	result.rarity = int(value.get("rarity", Definition.Rarity.COMMON if result.legacy_affix.is_empty() else Definition.Rarity.UNCOMMON))
	for modifier: String in value.get("modifiers", []):
		result.modifiers.append(modifier)
	return result

func to_dict() -> Dictionary:
	return {"uid": instance_id, "kind": weapon_definition_id, "rarity": rarity, "modifiers": modifiers.duplicate(), "affix": legacy_affix}
