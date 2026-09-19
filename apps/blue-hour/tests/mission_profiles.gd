extends SceneTree
## Phase 0A fixture only. No map generation or formal entry claim.
const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Mission = preload("res://missions/mission.gd")
const Director = preload("res://encounter/encounter_director.gd")

class FixtureCity extends Node3D:
	var sites: Dictionary = {}

var checks := 0
var failures: Array[String] = []

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var catalog := Catalog.new()
	var baseline := var_to_str(catalog.map)
	var base_sites := var_to_str(catalog.map.buildings)
	var campaign := Campaign.new(catalog)
	campaign.new_run(4101)
	var rows: Array[Dictionary] = []
	for action: Resource in catalog.today_actions:
		var map: Resource = action.make_map(catalog.map)
		check(map.mission_profile.id == action.id, "Map carries private profile")
		check(map.mission_profile != action, "Profile snapshot is isolated")
		check(var_to_str(map.buildings) == base_sites, "No base loot mutation or premature multiplier")
		var encounter := Director.new()
		encounter.setup(action.encounter_rules(catalog.map.encounter, 40), 4101)
		check(encounter.config.validation_errors().is_empty(), "Encounter accepts capped rules")
		check(action.encounter_rules(catalog.map.encounter, 5).initial_zombie_max <= 5, "Capacity caps intent")
		var initial_total := 0
		for sample: int in 1000:
			initial_total += encounter.rng.randi_range(encounter.config.initial_zombie_min, encounter.config.initial_zombie_max)
		var mission := Mission.new()
		mission.catalog = catalog
		mission.campaign = campaign
		mission.mission_profile = map.mission_profile
		var city := FixtureCity.new()
		mission.city = city
		var spec := {"category": "industrial", "loot_profile": "materials_tools", "food": 10, "scrap": 10}
		city.sites["generated_slot_42"] = {"spec": spec}
		var loot: Dictionary = mission.resolve_site_loot({"spec": spec})
		check(spec.food == 10 and spec.scrap == 10, "Final loot leaves shared site unchanged")
		check(loot.food == roundi(10 * action.food_multiplier), "Mission consumes Food modifier")
		check(loot.scrap == roundi(10 * action.scrap_multiplier), "Mission consumes Scrap modifier")
		var table := {"entries": [{"loot_id": "food", "chance": 1.0, "weight": 1.0, "min_amount": 10, "max_amount": 10}, {"loot_id": "scrap", "chance": 1.0, "weight": 1.0, "min_amount": 10, "max_amount": 10}]}
		check(mission.resolve_site_loot({"spec": {"loot_table": table}}) == loot, "Loot table path applies same final modifier once")
		check(action.weapon_chance_for(spec) == action.weapon_reward_chance, "Generated semantic site eligible")
		check(action.weapon_chance_for({"id": "garage", "category": "residential"}) == 0.0, "Old ID alone cannot qualify")
		check(action.weapon_chance_for({"loot_tags": ["tools"]}) > 0.0, "Existing tag qualifies")
		var awards := 0
		for index: int in 1000:
			var id := "slot_%d" % index
			city.sites[id] = {"spec": spec}
			var reward: Dictionary = mission.reward_for_site(id)
			check(reward == mission.reward_for_site(id), "Retry stable per-site reward")
			if not reward.is_empty():
				awards += 1
				check(campaign.gear.valid(reward), "Reward uses real equipment")
				campaign.data.inventory.append(reward)
				check(mission.reward_for_site(id).is_empty(), "Owned UID cannot be awarded twice")
				campaign.data.inventory.pop_back()
		rows.append({"action": action.id, "generation_type": action.mission_type, "objective": action.objective, "threat": action.threat_profile, "initial_intent": action.initial_enemy_fraction, "fixture_initial_draw": encounter.rng.randi_range(encounter.config.initial_zombie_min, encounter.config.initial_zombie_max), "day_interval": encounter.config.daytime_respawn_interval, "batch": encounter.config.daytime_respawn_batch, "food_modifier": action.food_multiplier, "scrap_modifier": action.scrap_multiplier, "fixture_loot": loot, "weapon_chance": action.weapon_reward_chance, "fixture_weapon_awards_1000": awards, "poi_preference": action.poi_preference})
		rows.back()["fixture_initial_mean_1000"] = initial_total / 1000.0
		check(action.objective == "SEARCH_AND_RETURN", "No rescue objective implemented")
		check(encounter.config.horde_interval_step == catalog.map.encounter.horde_interval_step, "Horde progression unchanged")
		city.free()
		mission.free()
	check(rows[0].fixture_initial_mean_1000 < rows[1].fixture_initial_mean_1000 and rows[1].fixture_initial_mean_1000 < rows[2].fixture_initial_mean_1000, "Comparable pressure distributions differ")
	check(rows[0].fixture_weapon_awards_1000 < rows[1].fixture_weapon_awards_1000 and rows[1].fixture_weapon_awards_1000 < rows[2].fixture_weapon_awards_1000, "Semantic weapon tendency differs")
	check(var_to_str(catalog.map) == baseline and var_to_str(catalog.map.buildings) == base_sites, "Base data unchanged")
	DirAccess.make_dir_recursive_absolute("res://test-output/mission-profiles")
	FileAccess.open("res://test-output/mission-profiles/report.json", FileAccess.WRITE).store_string(JSON.stringify({"scope": "Phase 0A fixture; NOT formal Medium Town Runtime", "checks": checks, "failures": failures, "rows": rows}, "\t"))
	print("MISSION PROFILES FIXTURE: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
