extends RefCounted
var mission: Node3D
var definition: Resource
var used := false
var remaining := 0.0
var baseline: Dictionary = {}

func _init(owner_mission: Node3D) -> void:
	mission = owner_mission
	if mission.campaign != null and not mission.campaign.data.power_slots.is_empty():
		definition = mission.catalog.by_id(mission.catalog.powers, mission.campaign.data.power_slots[0])

func activate() -> bool:
	if definition == null or used or not mission.active or not mission.input_enabled or mission.living().is_empty():
		return false
	used = true
	remaining = definition.duration
	for member in mission.living():
		baseline[member] = {"damage": member.talent.damage_multiplier, "speed": member.data.move_speed}
		match definition.effect:
			"burst": member.talent.damage_multiplier *= definition.amount
			"speed": member.data.move_speed *= definition.amount
			"heal": member.hp = minf(member.data.max_hp, member.hp + member.data.max_hp * definition.amount)
	mission.notice.emit(definition.display_name + " · " + definition.description())
	return true

func advance(delta: float) -> void:
	if remaining <= 0:
		return
	remaining = maxf(0, remaining - delta)
	if remaining == 0:
		for member in baseline:
			if is_instance_valid(member):
				member.talent.damage_multiplier = baseline[member].damage
				member.data.move_speed = baseline[member].speed
		baseline.clear()

func caption() -> String:
	if definition == null:
		return ""
	if remaining > 0:
		return "%s · %.0f 秒" % [definition.display_name, ceilf(remaining)]
	return definition.display_name + (" · 本日已用" if used else " · 1/1")
