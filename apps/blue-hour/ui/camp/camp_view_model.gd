extends RefCounted
## Read-only adapter. Missing concepts remain absent; UI does not invent scores,
## wall-clock time, currency, character biographies, or gameplay traits.
const Portraits = preload("res://ui/expedition/squad_card.gd")
const Clock = preload("res://time/mission_clock.gd")
var app: Node

func _init(owner_app: Node) -> void:
	app = owner_app

func resources() -> Dictionary:
	var data: Dictionary = app.campaign.data
	return {"food": str(data.food), "scrap": str(data.scrap), "intel": str(data.intel) if data.has("intel") else "—"}

func survivor(id: String) -> Dictionary:
	var game: RefCounted = app.campaign
	var spec: Resource = game.member_template(id)
	var talent: Resource = game.member_trait(id)
	var modifiers: RefCounted = game.passive_modifiers()
	var weapon: Resource = game.weapon(game.data.equipment.get(id, ""))
	var damage: float = modifiers.outgoing_damage(weapon.damage * talent.damage_multiplier, weapon.melee) if weapon != null else 0.0
	var speed: float = spec.move_speed * modifiers.multiplier("move_speed") * (1.0 + weapon.move_speed_modifier if weapon != null else 1.0)
	var passive: Array[Resource] = game.equipped_effects("passive")
	var portrait: Texture2D = load(spec.portrait_path) if not spec.portrait_path.is_empty() else Portraits.PORTRAITS.get(spec.id)
	return {"id": id, "name": spec.display_name, "role": spec.profession_name,
		"tags": spec.role_tags, "description": spec.description, "level": game.member_level(id),
		"portrait": portrait, "talent": talent, "weapon": weapon, "damage": damage,
		"training_cost": game.training_cost(id), "passives": passive,
		"stats": [
			{"label": "生命上限", "value": spec.max_hp * game.health_multiplier(), "maximum": spec.max_hp, "format": "%.0f"},
			{"label": "单次伤害", "value": damage, "maximum": _maximum_damage(), "format": "%.1f"},
			{"label": "搜刮效率", "value": 100.0 / modifiers.search_seconds(1.0, talent.search_multiplier), "maximum": 200.0, "format": "%.0f%%"},
			{"label": "移动速度", "value": speed, "maximum": 8.0, "format": "%.1f m/s"}]}

func timeline() -> Dictionary:
	var modifiers: RefCounted = app.campaign.passive_modifiers()
	var live: bool = is_instance_valid(app.mission) and app.state == "mission"
	var clock: RefCounted
	if live:
		clock = app.mission.clock
	else:
		var settings: Resource = app.base_map.duplicate()
		settings.day_seconds += modifiers.amount("day_extension")
		clock = Clock.new(settings)
	var warning: float = modifiers.amount("warning_seconds")
	var day_seconds: float = clock.settings.day_seconds
	var total: float = day_seconds + clock.settings.blue_seconds
	var stage: int = 0
	if clock.phase == Clock.NIGHT:
		stage = 3
	elif clock.phase == Clock.BLUE_HOUR:
		stage = 2
	elif clock.warning_active or (warning > 0 and clock.remaining() <= warning):
		stage = 1
	return {"stage": stage, "phase": ["白昼", "黄昏预警", "蓝时", "夜晚"][stage],
		"elapsed": _duration(clock.elapsed) if live else "整备中",
		"progress": clampf(clock.elapsed / maxf(1.0, total), 0.0, 1.0),
		"remaining": _duration(clock.remaining()), "caption": "阶段剩余" if live else "出勤白昼",
		"day": int(app.campaign.data.day), "live": live}

func _maximum_damage() -> float:
	var maximum: float = 1.0
	for weapon: Resource in app.catalog.weapons:
		maximum = maxf(maximum, weapon.damage)
	return maximum

func _duration(seconds: float) -> String:
	var whole: int = ceili(seconds)
	return "%02d:%02d" % [whole / 60, whole % 60]
