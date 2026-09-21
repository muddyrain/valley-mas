class_name TraitRuntime
extends RefCounted
## Dispatch by modifier contract, never by survivor identity. Reserved hooks are inert.

const HOOKS: Array[String] = ["search_speed", "loot_reward", "damage", "healing", "interaction", "aura", "periodic_effect", "max_hp", "loot_quality", "damage_reduction", "power_cooldown"]

static func value(trait_data: Resource, level: int) -> float:
	if trait_data == null or trait_data.levels.size() != 5:
		return 0.0
	return float(trait_data.levels[clampi(level, 1, 5) - 1])

static func search_speed(trait_data: Resource, level: int) -> float:
	return 1.0 + value(trait_data, level) if trait_data != null and trait_data.modifier_hook == "search_speed" else 1.0

static func damage_amount(base_damage: float, trait_data: Resource, horizontal_distance: float, target_tags: Array[String]) -> float:
	if trait_data == null or trait_data.modifier_hook != "damage":
		return base_damage
	var required_tags: Array = trait_data.params.get("target_tags", [])
	if required_tags.is_empty() or not required_tags.all(func(tag: String) -> bool: return tag in target_tags):
		return base_damage
	var threshold: float = float(trait_data.params.get("range_m", 0.0))
	var rule: String = str(trait_data.params.get("distance_rule", ""))
	var applies: bool = (rule == "at_most" and horizontal_distance <= threshold) or (rule == "greater_than" and horizontal_distance > threshold)
	return base_damage * (1.0 + value(trait_data, trait_data.runtime_level)) if applies else base_damage

static func interaction_duration(base_duration: float, trait_data: Resource, categories: Array[String]) -> float:
	if trait_data == null or trait_data.modifier_hook != "interaction":
		return base_duration
	var allowed: Array = trait_data.params.get("interaction_categories", [])
	if not categories.any(func(category: String) -> bool: return category in allowed):
		return base_duration
	return maxf(0.0, base_duration * (1.0 - value(trait_data, trait_data.runtime_level)))

static func max_hp(base_max_hp: float, trait_data: Resource) -> float:
	if trait_data == null or trait_data.modifier_hook != "max_hp":
		return base_max_hp
	return base_max_hp * (1.0 + value(trait_data, trait_data.runtime_level))

static func loot_weight(base_weight: float, rarity: int, trait_data: Resource) -> float:
	if trait_data == null or trait_data.modifier_hook != "loot_quality":
		return base_weight
	var minimum_rarity: int = int(trait_data.params.get("minimum_rarity", 2))
	if rarity < minimum_rarity:
		return base_weight
	return base_weight * (1.0 + value(trait_data, trait_data.runtime_level))

static func power_cooldown(base_cooldown: float, team_traits: Array[Resource]) -> float:
	var bonus: float = 0.0
	for trait_data: Resource in team_traits:
		if trait_data != null and trait_data.modifier_hook == "power_cooldown":
			bonus = maxf(bonus, value(trait_data, trait_data.runtime_level))
	return maxf(0.0, base_cooldown * (1.0 - bonus))

static func damage_reduction(base_multiplier: float, reduction: float, target_tags: Array[String]) -> float:
	if not "infected" in target_tags:
		return base_multiplier
	return maxf(0.0, base_multiplier * (1.0 - clampf(reduction, 0.0, 1.0)))

static func reward_amount(trait_data: Resource, definition: Resource, amount: int, rng: RandomNumberGenerator) -> int:
	if amount <= 0 or trait_data == null or rng == null or definition == null:
		return amount
	if trait_data.modifier_hook != "loot_reward" or not definition.is_basic_resource():
		return amount
	# Once per positive resource grant, not per unit; the bonus is never re-rolled.
	return amount + (1 if rng.randf() < value(trait_data, trait_data.runtime_level) else 0)
