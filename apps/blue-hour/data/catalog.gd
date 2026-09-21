extends RefCounted
const WeaponRegistryData = preload("res://data/weapon_registry.gd")
var survivors: Array[Resource] = [
	preload("res://data/survivors/xia_zhiyao.tres"),
	preload("res://data/survivors/su_wanxing.tres"),
	preload("res://data/survivors/lin_jianyue.tres"),
	preload("res://data/survivors/lu_qinghe.tres"),
	preload("res://data/survivors/shen_yanchuan.tres"),
	preload("res://data/survivors/tang_zhi.tres"),
	preload("res://data/survivors/gu_yuan.tres"),
	preload("res://data/survivors/cheng_mo.tres"),
	preload("res://data/survivors/zhou_ye.tres"),
	preload("res://data/survivors/xu_zhaoning.tres"),
	preload("res://data/survivors/he_linchuan.tres"),
	preload("res://data/survivors/song_shiyu.tres")
]
var traits: Array[Resource] = [
	preload("res://data/traits/search_instinct.tres"),
	preload("res://data/traits/resource_efficiency.tres"),
	preload("res://data/traits/danger_instinct.tres"),
	preload("res://data/traits/emergency_response.tres"),
	preload("res://data/traits/temporary_repair.tres"),
	preload("res://data/traits/set_the_pace.tres"),
	preload("res://data/traits/calm_aim.tres"),
	preload("res://data/traits/morale_boost.tres"),
	preload("res://data/traits/robust_physique.tres"),
	preload("res://data/traits/value_judgment.tres"),
	preload("res://data/traits/hold_the_line.tres"),
	preload("res://data/traits/composed_planning.tres")
]
var weapons: Array[Resource] = WeaponRegistryData.definitions()
var enemies: Array[Resource] = [
	preload("res://data/enemies/enm_001_infected_basic_a.tres")
]
var map: Resource = preload("res://data/maps/east_quay.tres").duplicate(true)
var today_actions: Array[Resource] = [
	preload("res://data/today_actions/residential.tres"),
	preload("res://data/today_actions/commercial.tres"),
	preload("res://data/today_actions/airdrop.tres")
]
var loop: Resource = preload("res://data/day_loop.tres")
var start_rules: Resource = preload("res://data/new_run.tres")
var specializations: Array[Resource] = [preload("res://data/specializations/combat.tres"), preload("res://data/specializations/scavenge.tres"), preload("res://data/specializations/survey.tres")]
var passives: Array[Resource] = [
	preload("res://data/effects/shooting_target.tres"),
	preload("res://data/effects/spare_magazine.tres"),
	preload("res://data/effects/armor_plate.tres"),
	preload("res://data/effects/replicator.tres"),
	preload("res://data/effects/tool_belt.tres"),
	preload("res://data/effects/folding_cart.tres"),
	preload("res://data/effects/early_start.tres"),
	preload("res://data/effects/old_watch.tres")
]
var powers: Array[Resource] = [
	preload("res://data/effects/rage.tres"),
	preload("res://data/effects/focus_fire.tres"),
	preload("res://data/effects/sprint.tres"),
	preload("res://data/effects/scavenge_frenzy.tres"),
	preload("res://data/effects/aid.tres"),
	preload("res://data/effects/dusk_delay.tres")
]
var affixes: Array[Resource] = [preload("res://data/affixes/longbarrel.tres"), preload("res://data/affixes/extended.tres"), preload("res://data/affixes/quickload.tres"), preload("res://data/affixes/weighted.tres")]

func _init() -> void:
	preload("res://maps/generation/map_layout.gd").prepare(map)

func by_id(collection: Array[Resource], id: String) -> Resource:
	if collection == weapons:
		id = WeaponRegistryData.canonical_id(id)
	for entry in collection:
		if entry.id == id:
			return entry
	return null

func validate() -> Array[String]:
	var errors: Array[String] = []
	errors.append_array(map.encounter.validation_errors())
	for collection in [survivors, traits, weapons, enemies, affixes, specializations, passives, powers, today_actions]:
		var ids: Array[String] = []
		for entry in collection:
			if entry.id.is_empty() or entry.id in ids:
				errors.append("Empty or duplicate content ID")
			ids.append(entry.id)
	for survivor in survivors:
		if by_id(traits, survivor.trait_id) == null or survivor.max_hp <= 0 or survivor.move_speed <= 0:
			errors.append("Invalid survivor: " + survivor.id)
		if survivor is SurvivorDefinition:
			if survivor.survivor_id.is_empty() or survivor.trait_definition != by_id(traits, survivor.trait_id):
				errors.append("Survivor definition/trait mismatch: " + survivor.id)
	for definition: Resource in traits:
		if definition.modifier_hook.is_empty():
			continue
		if definition.modifier_hook not in preload("res://core/trait_runtime.gd").HOOKS or definition.levels.size() != 5:
			errors.append("Invalid trait contract: " + definition.id)
		for value: float in definition.levels:
			if not is_finite(value) or value < 0 or (definition.modifier_hook == "loot_reward" and value > 1):
				errors.append("Invalid trait level: " + definition.id)
	for weapon in weapons:
		errors.append_array(weapon.validation_errors())
	for enemy in enemies:
		errors.append_array(enemy.validation_errors())
	for id in map.initial_weapons:
		if by_id(weapons, id) == null:
			errors.append("Unknown initial weapon: " + id)
	if map.initial_weapons.size() != survivors.size():
		errors.append("Each survivor needs an initial weapon")
	if map.day_seconds <= 0 or map.blue_seconds <= 0 or map.night_threat_seconds <= 0 or map.extraction_seconds <= 0:
		errors.append("Invalid mission durations")
	if map.search_radius <= 0 or map.search_radius >= map.pickup_radius or map.search_danger_radius <= 0 or map.search_resume_seconds <= 0:
		errors.append("Invalid search safety or arrival parameters")
	for multipliers: PackedFloat32Array in [map.enemy_phase_hp, map.enemy_phase_damage]:
		if multipliers.size() != 3:
			errors.append("Enemy phase multipliers require Day, Blue Hour and Night")
		for multiplier: float in multipliers:
			if not is_finite(multiplier) or multiplier <= 0:
				errors.append("Invalid enemy phase multiplier")
	if not is_finite(map.threat_hp_step) or not is_finite(map.threat_damage_step) or map.threat_hp_step < 0 or map.threat_damage_step < 0:
		errors.append("Invalid enemy threat scaling")
	for site in map.buildings + map.vehicles:
		for key in ["id", "name", "position", "size", "entry", "search_seconds", "food", "scrap"]:
			if not site.has(key):
				errors.append("Missing site field: " + key)
		if site.get("search_seconds", 0) <= 0 or site.get("food", -1) < 0 or site.get("scrap", -1) < 0:
			errors.append("Invalid search reward or duration")
		for entry: Dictionary in site.get("loot_table", {}).get("entries", []):
			var chance: float = float(entry.get("chance", 1.0))
			if not is_finite(chance) or chance < 0.0 or chance > 1.0 or entry.get("loot_id", "") not in ["food", "scrap"] or int(entry.get("min_amount", -1)) < 0 or int(entry.get("max_amount", -1)) < int(entry.get("min_amount", 0)):
				errors.append("Invalid search loot entry: " + str(site.id))
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
	for action: Resource in today_actions:
		if action.thumbnail == null or action.display_name.is_empty() or action.danger.is_empty():
			errors.append("Missing destination presentation: " + action.id)
		for factor: float in [action.food_multiplier, action.scrap_multiplier, action.spawn_interval_multiplier, action.initial_enemy_fraction]:
			if not is_finite(factor) or factor <= 0:
				errors.append("Invalid destination factor: " + action.id)
		if action.initial_enemy_fraction > 1.0:
			errors.append("Destination cannot exceed the authored initial encounters")
		for site: String in action.weapon_sites:
			if site not in loop.reward_pools:
				errors.append("Unknown destination equipment site: " + site)
	for affix in affixes:
		if affix.damage_multiplier <= 0 or affix.range_multiplier <= 0 or affix.reload_multiplier <= 0 or affix.magazine_bonus < 0:
			errors.append("Invalid weapon affix")
	for specialization in specializations:
		if by_id(passives, specialization.passive_id) == null or by_id(powers, specialization.power_id) == null:
			errors.append("Invalid specialization package")
		elif by_id(passives, specialization.passive_id).specialization != specialization.id or by_id(powers, specialization.power_id).specialization != specialization.id:
			errors.append("Starter package has mismatched specialization")
	var effect_ids: Array[String] = []
	for effect: Resource in passives + powers:
		errors.append_array(effect.validation_errors())
		if effect.id in effect_ids or by_id(specializations, effect.specialization) == null or effect.category != ("passive" if effect in passives else "power"):
			errors.append("Invalid effect category, specialization or duplicate ID: " + effect.id)
		effect_ids.append(effect.id)
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
