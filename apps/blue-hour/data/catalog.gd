extends RefCounted
var survivors: Array[Resource] = [
	preload("res://data/survivors/lin.tres"),
	preload("res://data/survivors/qiao.tres"),
	preload("res://data/survivors/yan.tres"),
	preload("res://data/survivors/xia_zhiyao.tres"),
	preload("res://data/survivors/su_wanxing.tres")
]
var traits: Array[Resource] = [
	preload("res://data/traits/steady.tres"),
	preload("res://data/traits/scavenger.tres"),
	preload("res://data/traits/resilient.tres"),
	preload("res://data/traits/route_intuition.tres"),
	preload("res://data/traits/resource_efficiency.tres")
]
var weapons: Array[Resource] = [
	preload("res://data/weapons/pistol.tres"),
	preload("res://data/weapons/smg.tres"),
	preload("res://data/weapons/shotgun.tres"),
	preload("res://data/weapons/crowbar.tres")
]
var enemies: Array[Resource] = [
	preload("res://data/enemies/shambler.tres"),
	preload("res://data/enemies/runner.tres"),
	preload("res://data/enemies/hound.tres"),
	preload("res://data/enemies/siren.tres")
]
var map: Resource = preload("res://data/maps/east_quay.tres")
var loop: Resource = preload("res://data/day_loop.tres")
var start_rules: Resource = preload("res://data/new_run.tres")
var specializations: Array[Resource] = [preload("res://data/specializations/combat.tres"), preload("res://data/specializations/scavenge.tres"), preload("res://data/specializations/survey.tres")]
var passives: Array[Resource] = [preload("res://data/effects/calibration.tres"), preload("res://data/effects/replicator.tres"), preload("res://data/effects/early_start.tres")]
var powers: Array[Resource] = [preload("res://data/effects/burst.tres"), preload("res://data/effects/sprint.tres"), preload("res://data/effects/aid.tres")]
var affixes: Array[Resource] = [preload("res://data/affixes/longbarrel.tres"), preload("res://data/affixes/extended.tres"), preload("res://data/affixes/quickload.tres"), preload("res://data/affixes/weighted.tres")]

func by_id(collection: Array[Resource], id: String) -> Resource:
	for entry in collection:
		if entry.id == id:
			return entry
	return null

func validate() -> Array[String]:
	var errors: Array[String] = []
	for collection in [survivors, traits, weapons, enemies, affixes, specializations, passives, powers]:
		var ids: Array[String] = []
		for entry in collection:
			if entry.id.is_empty() or entry.id in ids:
				errors.append("Empty or duplicate content ID")
			ids.append(entry.id)
	for survivor in survivors:
		if by_id(traits, survivor.trait_id) == null or survivor.max_hp <= 0 or survivor.move_speed <= 0:
			errors.append("Invalid survivor: " + survivor.id)
	for weapon in weapons:
		if weapon.damage <= 0 or weapon.cooldown <= 0 or weapon.attack_range <= 0 or weapon.magazine <= 0 or weapon.target_count <= 0:
			errors.append("Invalid weapon: " + weapon.id)
	for enemy in enemies:
		if enemy.max_hp <= 0 or enemy.speed <= 0 or enemy.attack_interval <= 0:
			errors.append("Invalid enemy: " + enemy.id)
	for id in map.initial_weapons:
		if by_id(weapons, id) == null:
			errors.append("Unknown initial weapon: " + id)
	if map.initial_weapons.size() != survivors.size():
		errors.append("Each survivor needs an initial weapon")
	if map.day_seconds <= 0 or map.blue_seconds <= 0 or map.night_threat_seconds <= 0 or map.extraction_seconds <= 0:
		errors.append("Invalid mission durations")
	if map.search_radius <= 0 or map.search_radius >= map.pickup_radius or map.search_danger_radius <= 0 or map.search_resume_seconds <= 0:
		errors.append("Invalid search safety or arrival parameters")
	for pool in [map.day_enemy_pool, map.blue_enemy_pool, map.night_enemy_pool]:
		if pool.is_empty():
			errors.append("Empty enemy spawn pool")
		for id in pool:
			if by_id(enemies, id) == null:
				errors.append("Unknown spawn enemy: " + id)
	for site in map.buildings + map.vehicles:
		for key in ["id", "name", "position", "size", "entry", "search_seconds", "food", "scrap"]:
			if not site.has(key):
				errors.append("Missing site field: " + key)
		if site.get("search_seconds", 0) <= 0 or site.get("food", -1) < 0 or site.get("scrap", -1) < 0:
			errors.append("Invalid search reward or duration")
	if loop.end_day < 1 or loop.initial_food < 0 or loop.food_per_member < 1 or loop.hunger_health_multiplier <= 0 or loop.hunger_health_multiplier > 1 or loop.shop_size < 1:
		errors.append("Invalid day-loop rules")
	for id in loop.weapon_prices:
		if by_id(weapons, id) == null or loop.weapon_prices[id] <= 0:
			errors.append("Invalid shop price")
	var site_ids: Array = []
	for site in map.buildings + map.vehicles:
		site_ids.append(site.id)
	for site in loop.reward_pools:
		if site not in site_ids or loop.reward_pools[site].is_empty():
			errors.append("Invalid equipment reward site")
		for id in loop.reward_pools[site]:
			if by_id(weapons, id) == null:
				errors.append("Unknown reward weapon")
	for affix in affixes:
		if affix.damage_multiplier <= 0 or affix.range_multiplier <= 0 or affix.reload_multiplier <= 0 or affix.magazine_bonus < 0:
			errors.append("Invalid weapon affix")
	for specialization in specializations:
		if by_id(passives, specialization.passive_id) == null or by_id(powers, specialization.power_id) == null:
			errors.append("Invalid specialization package")
	for effect in passives + powers:
		if not is_finite(effect.amount) or effect.amount <= 0 or effect.duration < 0:
			errors.append("Invalid effect amount")
		if effect.effect in ["weapon_copy", "heal"] and effect.amount > 1:
			errors.append("Effect probability or fraction exceeds one")
		if effect.effect in ["burst", "speed"] and (effect.amount <= 1 or effect.duration <= 0):
			errors.append("Timed power needs an actual buff and duration")
	for effect in passives:
		if effect.effect not in ["ranged_damage", "weapon_copy", "day_extension"]:
			errors.append("Unsupported passive effect")
	for effect in powers:
		if effect.effect not in ["burst", "speed", "heal"]:
			errors.append("Unsupported special power effect")
	if start_rules.starting_count < 1 or start_rules.starting_count > start_rules.starter_pool.size():
		errors.append("Invalid starter count")
	var starters: Array = []
	for id in start_rules.starter_pool:
		if id in starters or by_id(survivors, id) == null or by_id(weapons, str(start_rules.starting_weapons.get(id, ""))) == null:
			errors.append("Invalid starter pool")
		starters.append(id)
	for cost in start_rules.training_costs:
		if cost <= 0:
			errors.append("Invalid training cost")
	return errors
