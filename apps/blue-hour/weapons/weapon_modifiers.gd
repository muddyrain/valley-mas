extends RefCounted
## Compatibility API for existing weapon instance modifier IDs.

const ModifierData = preload("res://data/weapon_modifier_data.gd")
const ModifierRegistry = preload("res://data/weapon_modifier_registry.gd")

static func definitions() -> Array[Resource]:
	return ModifierRegistry.definitions()

static func definition(id: String) -> Resource:
	return ModifierRegistry.by_id(id)

static func has_id(id: String) -> bool:
	return ModifierRegistry.has_id(id)

static func choices(melee: bool) -> Array[String]:
	var result: Array[String] = []
	for resource: Resource in ModifierRegistry.definitions():
		var modifier := resource as ModifierData
		if melee and modifier.id in ["MAGAZINE_UP", "RELOAD_SPEED_UP", "ACCURACY_UP"]:
			continue
		result.append(modifier.id)
	return result

static func apply(weapon: Resource, ids: Array[String]) -> void:
	for id: String in ids:
		var modifier := ModifierRegistry.by_id(id)
		if modifier == null:
			continue
		var stat := str(modifier.target_stat)
		var current_value := float(weapon.get(stat))
		var next_value := current_value
		match modifier.operation:
			ModifierData.Operation.ADD:
				next_value += modifier.value
			ModifierData.Operation.MULTIPLY:
				next_value *= modifier.value
			ModifierData.Operation.SET:
				next_value = modifier.value
		if stat == "magazine_size":
			weapon.set(stat, ceili(next_value))
		elif stat == "accuracy":
			weapon.set(stat, clampf(next_value, 0.0, 1.0))
		else:
			weapon.set(stat, next_value)
