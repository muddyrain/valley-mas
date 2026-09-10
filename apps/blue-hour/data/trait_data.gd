extends Resource
class_name TraitData

enum TraitType {
	COMBAT,
	DEFENSE,
	SCAVENGE_SPEED,
	SCAVENGE_DETECTION,
	RESOURCE_BONUS,
	MOBILITY
}

@export var id: String = ""
@export var display_name: String = ""
@export var description: String = ""
@export var trait_type: TraitType = TraitType.COMBAT
@export var params: Dictionary = {}
@export var damage_multiplier: float = 1.0
@export var search_multiplier: float = 1.0
@export var incoming_damage_multiplier: float = 1.0

func at_level(level: int) -> Resource:
	var result: Resource = duplicate()
	result.damage_multiplier = 1.0 + (damage_multiplier - 1.0) * level
	result.search_multiplier = 1.0 + (search_multiplier - 1.0) * level
	result.incoming_damage_multiplier = maxf(0.1, 1.0 + (incoming_damage_multiplier - 1.0) * level)
	# 参数化的 Trait 按等级缩放
	result.params = params.duplicate()
	for key in params:
		if key.ends_with("_per_level"):
			var base_key = key.trim_suffix("_per_level")
			if base_key in result.params:
				result.params[base_key] = params.get(base_key, 0.0) + params[key] * (level - 1)
	return result

func summary() -> String:
	var parts: PackedStringArray = []
	if damage_multiplier != 1.0:
		parts.append("伤害 +%d%%" % roundi((damage_multiplier - 1.0) * 100))
	if search_multiplier != 1.0:
		parts.append("搜索速度 +%d%%" % roundi((search_multiplier - 1.0) * 100))
	if incoming_damage_multiplier != 1.0:
		parts.append("受到伤害 −%d%%" % roundi((1.0 - incoming_damage_multiplier) * 100))
	# 参数化 Trait 显示
	match trait_type:
		TraitType.SCAVENGE_DETECTION:
			var bonus = params.get("detection_bonus", 0.0)
			if bonus > 0:
				parts.append("搜刮发现 +%d%%" % roundi(bonus * 100))
		TraitType.RESOURCE_BONUS:
			var chance = params.get("bonus_chance", 0.0)
			if chance > 0:
				parts.append("额外资源 %d%% 概率" % roundi(chance * 100))
	return " · ".join(parts)
