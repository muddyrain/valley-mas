class_name BuffEffectHandler
extends RefCounted
## Owns temporary modifier state while the periodic scheduler owns timing.

const META_KEY: String = "survivor_buff_modifiers"
const EFFECT_CRIT_RATE: String = "crit_rate"
const CRITICAL_DAMAGE_MULTIPLIER: float = 2.0

static func apply(target: Node3D, effect_type: String, value: float, provider_id: String = "") -> Dictionary:
	if target == null or not is_instance_valid(target) or effect_type.is_empty():
		return {"applied": false, "reason": "invalid_target"}
	var modifiers: Dictionary = _modifiers(target)
	var entry: Dictionary = modifiers.get(effect_type, {})
	var sources: Dictionary = entry.get("sources", {}) if entry is Dictionary else {}
	var source_key: String = _source_key(provider_id)
	sources[source_key] = maxf(0.0, value)
	modifiers[effect_type] = {"value": _maximum(sources), "sources": sources}
	target.set_meta(META_KEY, modifiers)
	return {"applied": true, "effect_type": effect_type, "value": maxf(0.0, value), "provider_id": provider_id}

static func expire(target: Node3D, effect_type: String, provider_id: String = "") -> Dictionary:
	if target == null or not is_instance_valid(target):
		return {"expired": false, "reason": "invalid_target"}
	var modifiers: Dictionary = _modifiers(target)
	if not modifiers.has(effect_type):
		return {"expired": false, "reason": "not_active"}
	var current: Dictionary = modifiers[effect_type]
	var sources: Dictionary = current.get("sources", {}) if current is Dictionary else {}
	var source_key: String = _source_key(provider_id)
	if not sources.has(source_key):
		return {"expired": false, "reason": "superseded"}
	sources.erase(source_key)
	if sources.is_empty():
		modifiers.erase(effect_type)
	else:
		modifiers[effect_type] = {"value": _maximum(sources), "sources": sources}
	if modifiers.is_empty():
		target.remove_meta(META_KEY)
	else:
		target.set_meta(META_KEY, modifiers)
	return {"expired": true, "effect_type": effect_type}

static func critical_chance(target: Node3D) -> float:
	if target == null or not is_instance_valid(target):
		return 0.0
	var entry: Variant = _modifiers(target).get(EFFECT_CRIT_RATE)
	if not entry is Dictionary:
		return 0.0
	return clampf(float(entry.get("value", 0.0)), 0.0, 1.0)

static func roll_critical(target: Node3D, random: RandomNumberGenerator) -> bool:
	var chance: float = critical_chance(target)
	return chance > 0.0 and random != null and random.randf() < chance

static func to_state(target: Node3D) -> Dictionary:
	if target == null or not is_instance_valid(target):
		return {}
	return _modifiers(target).duplicate(true)

static func restore_state(target: Node3D, state: Dictionary) -> bool:
	if target == null or not is_instance_valid(target):
		return false
	if state.has("effect_type"):
		return bool(apply(target, str(state.get("effect_type", "")), float(state.get("value", 0.0)), str(state.get("provider_id", ""))).get("applied", false))
	if state.is_empty():
		target.remove_meta(META_KEY)
	else:
		target.set_meta(META_KEY, state.duplicate(true))
	return true

static func _modifiers(target: Node3D) -> Dictionary:
	var stored: Variant = target.get_meta(META_KEY, {})
	return stored.duplicate(true) if stored is Dictionary else {}

static func _source_key(provider_id: String) -> String:
	return provider_id if not provider_id.is_empty() else "__default__"

static func _maximum(sources: Dictionary) -> float:
	var result: float = 0.0
	for source_value: Variant in sources.values():
		result = maxf(result, float(source_value))
	return result
