class_name TraitRuntime
extends RefCounted
## Dispatch by modifier contract, never by survivor identity. Reserved hooks are inert.

const HOOKS: Array[String] = ["search_speed", "loot_reward", "damage", "healing", "interaction", "aura", "max_hp", "loot_quality", "damage_reduction", "power_cooldown"]

static func value(trait_data: Resource, level: int) -> float:
	if trait_data == null or trait_data.levels.size() != 5:
		return 0.0
	return float(trait_data.levels[clampi(level, 1, 5) - 1])

static func search_speed(trait_data: Resource, level: int) -> float:
	return 1.0 + value(trait_data, level) if trait_data != null and trait_data.modifier_hook == "search_speed" else 1.0

static func reward_amount(trait_data: Resource, definition: Resource, amount: int, rng: RandomNumberGenerator) -> int:
	if amount <= 0 or trait_data == null or rng == null or definition == null:
		return amount
	if trait_data.modifier_hook != "loot_reward" or not definition.is_basic_resource():
		return amount
	# Once per positive resource grant, not per unit; the bonus is never re-rolled.
	return amount + (1 if rng.randf() < value(trait_data, trait_data.runtime_level) else 0)
