class_name AuraRuntime
extends RefCounted
## Resolves data-driven team Auras for a target without embedding survivor identity rules.

const TraitRuntime = preload("res://core/trait_runtime.gd")
const EFFECT_TEAM_MOVE_SPEED: String = "teammate_move_speed"
const EFFECT_INFECTED_DAMAGE_REDUCTION: String = "infected_damage_reduction"
const DEFAULT_RADIUS_M: float = 6.0

static func modifier(target: Node3D, providers: Array[Node3D], effect_type: String) -> float:
	if target == null or effect_type.is_empty():
		return 0.0
	var strongest: float = 0.0
	for provider: Node3D in providers:
		if provider == null or provider == target or not is_instance_valid(provider):
			continue
		if _bool_property(provider, "dead") or _bool_property(provider, "boarding"):
			continue
		var trait_data: Resource = provider.get("talent") as Resource
		if trait_data == null or trait_data.modifier_hook != "aura":
			continue
		var params: Dictionary = trait_data.params
		if str(params.get("effect_type", "")) != effect_type:
			continue
		var radius: float = maxf(0.0, float(params.get("radius_m", DEFAULT_RADIUS_M)))
		var target_position: Vector3 = target.global_position if target.is_inside_tree() else target.position
		var provider_position: Vector3 = provider.global_position if provider.is_inside_tree() else provider.position
		if target_position.distance_to(provider_position) <= radius + 0.00001:
			strongest = maxf(strongest, TraitRuntime.value(trait_data, trait_data.runtime_level))
	return strongest

static func movement_multiplier(target: Node3D, providers: Array[Node3D]) -> float:
	return 1.0 + modifier(target, providers, EFFECT_TEAM_MOVE_SPEED)

static func infected_damage_multiplier(target: Node3D, providers: Array[Node3D], damage_tags: Array[String]) -> float:
	if not "infected" in damage_tags:
		return 1.0
	return 1.0 - modifier(target, providers, EFFECT_INFECTED_DAMAGE_REDUCTION)

static func _bool_property(actor: Node3D, property_name: String) -> bool:
	var value: Variant = actor.get(property_name)
	return value is bool and bool(value)
