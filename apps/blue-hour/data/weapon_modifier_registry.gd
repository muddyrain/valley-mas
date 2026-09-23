class_name WeaponModifierRegistry
extends RefCounted
## Resolves stable modifier IDs to their Resource definitions.

const RESOURCES := [
	preload("res://data/weapons/modifiers/damage_up.tres"),
	preload("res://data/weapons/modifiers/attack_speed_up.tres"),
	preload("res://data/weapons/modifiers/magazine_up.tres"),
	preload("res://data/weapons/modifiers/reload_speed_up.tres"),
	preload("res://data/weapons/modifiers/accuracy_up.tres"),
	preload("res://data/weapons/modifiers/range_up.tres"),
]

static func definitions() -> Array[Resource]:
	var result: Array[Resource] = []
	for modifier: Resource in RESOURCES:
		result.append(modifier)
	return result

static func by_id(id: String) -> WeaponModifierData:
	var matched_modifier: WeaponModifierData
	for resource: Resource in RESOURCES:
		var modifier := resource as WeaponModifierData
		if modifier.id != id:
			continue
		if matched_modifier != null:
			push_error("Duplicate weapon modifier ID: " + id)
			return null
		matched_modifier = modifier
	return matched_modifier

static func has_id(id: String) -> bool:
	return by_id(id) != null

static func validate() -> Array[String]:
	return validate_resources(definitions())

static func validate_resources(resources: Array[Resource]) -> Array[String]:
	var errors: Array[String] = []
	var seen: Array[String] = []
	for resource: Resource in resources:
		if not resource is WeaponModifierData:
			errors.append("Invalid weapon modifier resource")
			continue
		var modifier := resource as WeaponModifierData
		if modifier.id.is_empty() or modifier.id in seen:
			errors.append("Empty or duplicate weapon modifier ID: " + modifier.id)
		seen.append(modifier.id)
		if modifier.name.is_empty() or modifier.description.is_empty():
			errors.append("Weapon modifier needs a name and description: " + modifier.id)
		if modifier.category not in [WeaponModifierData.Category.STAT, WeaponModifierData.Category.MECHANIC, WeaponModifierData.Category.SPECIAL]:
			errors.append("Invalid weapon modifier category: " + modifier.id)
		if modifier.operation not in [WeaponModifierData.Operation.ADD, WeaponModifierData.Operation.MULTIPLY, WeaponModifierData.Operation.SET]:
			errors.append("Invalid weapon modifier operation: " + modifier.id)
		if modifier.target_stat.is_empty():
			errors.append("Weapon modifier has no target stat: " + modifier.id)
		if not is_finite(modifier.value) or not is_finite(modifier.rarity_weight) or modifier.rarity_weight <= 0.0:
			errors.append("Invalid weapon modifier value or weight: " + modifier.id)
		if modifier.max_stack < 1:
			errors.append("Invalid weapon modifier max_stack: " + modifier.id)
		if modifier.category == WeaponModifierData.Category.STAT and not modifier.effect_id.is_empty():
			errors.append("Stat modifier cannot declare an effect_id: " + modifier.id)
	return errors
