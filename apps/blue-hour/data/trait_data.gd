extends Resource
@export var id: String = ""
@export var display_name: String = ""
@export var description: String = ""
@export var damage_multiplier: float = 1.0
@export var search_multiplier: float = 1.0
@export var incoming_damage_multiplier: float = 1.0

func at_level(level: int) -> Resource:
	var result: Resource = duplicate()
	result.damage_multiplier = 1.0 + (damage_multiplier - 1.0) * level
	result.search_multiplier = 1.0 + (search_multiplier - 1.0) * level
	result.incoming_damage_multiplier = maxf(0.1, 1.0 + (incoming_damage_multiplier - 1.0) * level)
	return result

func summary() -> String:
	var parts: PackedStringArray = []
	if damage_multiplier != 1.0:
		parts.append("伤害 +%d%%" % roundi((damage_multiplier - 1.0) * 100))
	if search_multiplier != 1.0:
		parts.append("搜索速度 +%d%%" % roundi((search_multiplier - 1.0) * 100))
	if incoming_damage_multiplier != 1.0:
		parts.append("受到伤害 −%d%%" % roundi((1.0 - incoming_damage_multiplier) * 100))
	return " · ".join(parts)
