class_name PeriodicEffectRuntime
extends RefCounted
## Data-driven periodic scheduler. It emits effect events but does not own gameplay effects.

signal effect_applied(event: Dictionary)
signal effect_expired(event: Dictionary)

const TraitRuntime = preload("res://core/trait_runtime.gd")
const TARGET_SELF: String = "SELF"
const TARGET_ALLY: String = "ALLY"
const TARGET_NEAREST_ALLY: String = "NEAREST_ALLY"
const TARGET_LOWEST_HP_ALLY: String = "LOWEST_HP_ALLY"
const TARGET_ALL_TEAM: String = "ALL_TEAM"

var paused: bool = false
var _providers: Array[Dictionary] = []
var _active_effects: Dictionary = {}

func register_provider(provider: Node3D, trait_data: Resource, provider_id: String = "") -> bool:
	if provider == null or trait_data == null:
		return false
	var definition: Dictionary = _definition(trait_data)
	if definition.is_empty():
		return false
	var key: String = provider_id if not provider_id.is_empty() else str(provider.get_instance_id())
	for state: Dictionary in _providers:
		if state.provider_id == key:
			state.trait_data = trait_data
			state.definition = definition
			state.trait_level = int(trait_data.runtime_level)
			return true
	_providers.append({
		"provider_id": key,
		"provider": provider,
		"trait_data": trait_data,
		"trait_id": str(trait_data.id),
		"trait_level": int(trait_data.runtime_level),
		"definition": definition,
		"elapsed": 0.0,
	})
	return true

func unregister_provider(provider_id: String) -> void:
	_providers = _providers.filter(func(state: Dictionary) -> bool: return state.provider_id != provider_id)
	for key: String in _active_effects.keys():
		if str(_active_effects[key].provider_id) == provider_id:
			_expire(key)

func advance(delta: float, team: Array[Node3D] = []) -> Array[Dictionary]:
	var events: Array[Dictionary] = []
	if delta <= 0.0 or paused:
		return events
	for key: String in _active_effects.keys().duplicate():
		var active: Dictionary = _active_effects[key]
		active.remaining = maxf(0.0, float(active.remaining) - delta)
		if active.remaining <= 0.0:
			events.append(_expire(key))
	for state: Dictionary in _providers:
		var provider: Node3D = state.provider as Node3D
		if provider == null or not is_instance_valid(provider) or _is_inactive(provider):
			continue
		state.elapsed = float(state.elapsed) + delta
		var interval: float = float(state.definition.interval)
		while state.elapsed + 0.000001 >= interval:
			state.elapsed = float(state.elapsed) - interval
			var targets: Array[Node3D] = select_targets(provider, state.definition, team)
			for target: Node3D in targets:
				var event: Dictionary = _apply(state, target)
				events.append(event)
	return events

func select_targets(provider: Node3D, definition: Dictionary, team: Array[Node3D]) -> Array[Node3D]:
	var filter: String = str(definition.filter)
	if filter == TARGET_SELF:
		return [provider]
	var allies: Array[Node3D] = []
	for candidate: Node3D in team:
		if candidate == null or candidate == provider or not is_instance_valid(candidate) or _is_inactive(candidate):
			continue
		if _within_radius(provider, candidate, float(definition.radius)):
			allies.append(candidate)
	if filter == TARGET_ALLY or filter == TARGET_ALL_TEAM:
		if filter == TARGET_ALL_TEAM and not _is_inactive(provider):
			allies.append(provider)
		return allies
	if allies.is_empty():
		return []
	if filter == TARGET_NEAREST_ALLY:
		return [_nearest(provider, allies)]
	if filter == TARGET_LOWEST_HP_ALLY:
		return [_lowest_hp(allies)]
	return []

func to_state() -> Dictionary:
	var providers: Array[Dictionary] = []
	for state: Dictionary in _providers:
		providers.append({
			"provider_id": state.provider_id,
			"trait_id": state.trait_id,
			"trait_level": state.trait_level,
			"elapsed": state.elapsed,
		})
	return {"paused": paused, "providers": providers, "active_effects": _active_effects.duplicate(true)}

func restore_state(state: Dictionary, provider_resolver: Callable, trait_resolver: Callable) -> bool:
	if not state.get("providers", []) is Array or not provider_resolver.is_valid() or not trait_resolver.is_valid():
		return false
	_providers.clear()
	_active_effects = state.get("active_effects", {}).duplicate(true)
	paused = bool(state.get("paused", false))
	for saved: Dictionary in state.providers:
		var provider: Node3D = provider_resolver.call(str(saved.provider_id)) as Node3D
		var trait_data: Resource = trait_resolver.call(str(saved.trait_id), int(saved.trait_level)) as Resource
		if provider == null or trait_data == null or not register_provider(provider, trait_data, str(saved.provider_id)):
			return false
		for current: Dictionary in _providers:
			if current.provider_id == str(saved.provider_id):
				current.elapsed = float(saved.get("elapsed", 0.0))
	return true

func _definition(trait_data: Resource) -> Dictionary:
	var params: Dictionary = trait_data.params
	var effect_type: String = str(trait_data.effect_type if not str(trait_data.effect_type).is_empty() else params.get("effect_type", ""))
	var interval: float = float(trait_data.effect_interval if trait_data.effect_interval > 0.0 else params.get("interval", 0.0))
	var duration: float = maxf(0.0, float(trait_data.effect_duration if trait_data.effect_duration > 0.0 else params.get("duration", 0.0)))
	var radius: float = maxf(0.0, float(trait_data.effect_radius if trait_data.effect_radius > 0.0 else params.get("radius", 0.0)))
	var filter: String = str(trait_data.effect_target_filter if not str(trait_data.effect_target_filter).is_empty() else params.get("target_filter", ""))
	if effect_type.is_empty() or interval <= 0.0 or duration <= 0.0 or filter.is_empty():
		return {}
	return {"effect_type": effect_type, "interval": interval, "duration": duration, "radius": radius, "filter": filter}

func _apply(state: Dictionary, target: Node3D) -> Dictionary:
	var key: String = "%s:%s:%s" % [state.provider_id, str(target.get_instance_id()), state.definition.effect_type]
	var event: Dictionary = {
		"provider_id": state.provider_id,
		"target_id": str(target.get_instance_id()),
		"effect_type": state.definition.effect_type,
		"value": TraitRuntime.value(state.trait_data, state.trait_level),
		"duration": state.definition.duration,
		"remaining": state.definition.duration,
	}
	if _active_effects.has(key):
		var current: Dictionary = _active_effects[key]
		current.remaining = state.definition.duration
		current.value = event.value
		event["refreshed"] = true
	else:
		_active_effects[key] = event.duplicate(true)
	effect_applied.emit(event)
	return event

func _expire(key: String) -> Dictionary:
	var event: Dictionary = _active_effects.get(key, {})
	_active_effects.erase(key)
	if not event.is_empty():
		effect_expired.emit(event)
	return event

func _within_radius(provider: Node3D, target: Node3D, radius: float) -> bool:
	if radius <= 0.0:
		return true
	return provider.position.distance_to(target.position) <= radius + 0.00001

func _nearest(provider: Node3D, candidates: Array[Node3D]) -> Node3D:
	var result: Node3D = candidates[0]
	var best: float = provider.position.distance_squared_to(result.position)
	for candidate: Node3D in candidates.slice(1):
		var distance: float = provider.position.distance_squared_to(candidate.position)
		if distance < best:
			best = distance
			result = candidate
	return result

func _lowest_hp(candidates: Array[Node3D]) -> Node3D:
	var result: Node3D = candidates[0]
	var best: float = _hp_ratio(result)
	for candidate: Node3D in candidates.slice(1):
		var ratio: float = _hp_ratio(candidate)
		if ratio < best:
			best = ratio
			result = candidate
	return result

func _hp_ratio(actor: Node3D) -> float:
	var hp_value: Variant = actor.get("hp")
	var hp: float = float(hp_value) if hp_value != null else float(actor.get_meta("hp", 100.0))
	var data: Variant = actor.get("data")
	var maximum: float = float(data.get("max_hp")) if data != null else 100.0
	return hp / maxf(0.000001, maximum)

func _is_inactive(actor: Node3D) -> bool:
	var dead_value: Variant = actor.get("dead")
	var boarding_value: Variant = actor.get("boarding")
	var dead: bool = bool(dead_value) if dead_value != null else bool(actor.get_meta("dead", false))
	var boarding: bool = bool(boarding_value) if boarding_value != null else bool(actor.get_meta("boarding", false))
	return dead or boarding
