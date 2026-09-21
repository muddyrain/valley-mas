extends SceneTree

const Campaign = preload("res://core/campaign.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const LootEntryData = preload("res://data/loot_entry.gd")
const LootResolverData = preload("res://core/loot_resolver.gd")
const LootTableData = preload("res://data/loot_table.gd")
const Equipment = preload("res://core/equipment.gd")
const Mission = preload("res://missions/mission.gd")
const Runtime = preload("res://core/trait_runtime.gd")
const Save = preload("res://core/save_store.gd")
const TraitDataScript = preload("res://data/trait_data.gd")

const SAMPLE_COUNT: int = 100000
const OUT: String = "res://test-output/trait-phase-a.json"

var checks: int = 0
var failures: Array[String] = []
var samples: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		printerr(label)

func near(actual: float, expected: float, label: String) -> void:
	check(absf(actual - expected) < 0.00001, "%s (%.6f / %.6f)" % [label, actual, expected])

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var catalog := Catalog.new()
	check(catalog.validate().is_empty(), "Catalog accepts all Phase A contracts")
	await _check_damage(catalog)
	_check_interaction(catalog)
	await _check_max_hp(catalog)
	_check_loot_quality(catalog)
	await _check_power_cooldown(catalog)
	_check_foundation_regression(catalog)
	FileAccess.open(OUT, FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "samples": samples}, "\t"))
	print("TRAIT PHASE A: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func _check_damage(catalog: RefCounted) -> void:
	var infected: Array[String] = ["infected"]
	var neutral: Array[String] = []
	for level: int in [1, 5]:
		var near_trait: Resource = catalog.by_id(catalog.traits, "danger_instinct").at_level(level)
		var far_trait: Resource = catalog.by_id(catalog.traits, "calm_aim").at_level(level)
		var multiplier: float = 1.10 if level == 1 else 1.22
		near(Runtime.damage_amount(100.0, near_trait, 4.9, infected), 100.0 * multiplier, "SUR_003 applies at 4.9m Lv%d" % level)
		near(Runtime.damage_amount(100.0, near_trait, 5.0, infected), 100.0 * multiplier, "SUR_003 applies at 5.0m Lv%d" % level)
		near(Runtime.damage_amount(100.0, near_trait, 5.1, infected), 100.0, "SUR_003 excludes 5.1m Lv%d" % level)
		near(Runtime.damage_amount(100.0, near_trait, 4.9, neutral), 100.0, "SUR_003 excludes non-infected Lv%d" % level)
		near(Runtime.damage_amount(100.0, far_trait, 7.9, infected), 100.0, "SUR_007 excludes 7.9m Lv%d" % level)
		near(Runtime.damage_amount(100.0, far_trait, 8.0, infected), 100.0, "SUR_007 excludes 8.0m Lv%d" % level)
		near(Runtime.damage_amount(100.0, far_trait, 8.1, infected), 100.0 * multiplier, "SUR_007 applies at 8.1m Lv%d" % level)
		near(Runtime.damage_amount(100.0, far_trait, 8.1, neutral), 100.0, "SUR_007 excludes non-infected Lv%d" % level)
	var tagged_trait: Resource = catalog.by_id(catalog.traits, "danger_instinct").at_level(1)
	tagged_trait.params.target_tags = ["mechanical"]
	near(Runtime.damage_amount(100.0, tagged_trait, 5.0, infected), 100.0, "Damage target tag comes from Trait data")
	var mechanical: Array[String] = ["mechanical"]
	near(Runtime.damage_amount(100.0, tagged_trait, 5.0, mechanical), 110.0, "Damage accepts the configured target tag")
	var campaign := Campaign.new(catalog)
	campaign.new_run(3003, "", ["lin_jianyue"])
	var mission := Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	mission.setup(catalog, Ledger.new(), [], 3003, campaign)
	var member: Node3D = mission.survivors[0]
	member.position = Vector3.ZERO
	var target := Node3D.new()
	mission.add_child(target)
	target.position = Vector3(3.0, 20.0, 4.0)
	mission.enemies.append(target)
	near(mission.damage_to(member, target), member.weapon.damage * 1.10, "Mission damage hook uses 5m XZ distance and ignores Y")
	mission.enemies.erase(target)
	near(mission.damage_to(member, target), member.weapon.damage, "Mission damage hook excludes non-infected targets")
	mission.queue_free()
	await process_frame

func _check_interaction(catalog: RefCounted) -> void:
	var neutral := TraitDataScript.new()
	var mechanical: Array[String] = ["vehicle", "mechanical"]
	var ordinary: Array[String] = []
	near(Runtime.interaction_duration(10.0, neutral, mechanical), 10.0, "Mechanical baseline")
	near(Runtime.interaction_duration(10.0, catalog.by_id(catalog.traits, "temporary_repair").at_level(1), mechanical), 8.8, "SUR_005 Lv1 mechanical duration")
	near(Runtime.interaction_duration(10.0, catalog.by_id(catalog.traits, "temporary_repair").at_level(5), mechanical), 7.2, "SUR_005 Lv5 mechanical duration")
	near(Runtime.interaction_duration(10.0, catalog.by_id(catalog.traits, "temporary_repair").at_level(5), ordinary), 10.0, "SUR_005 leaves ordinary search unchanged")
	check("mechanical" in catalog.map.vehicles[0].interaction_categories, "Vehicle sites expose normalized mechanical category")
	var house: Dictionary = catalog.map.buildings.filter(func(site: Dictionary) -> bool: return site.search_kind == "residential")[0]
	check(house.interaction_categories.is_empty(), "Ordinary building search has no mechanical category")
	var campaign := Campaign.new(catalog)
	campaign.new_run(5005, "", ["shen_yanchuan"])
	var mission := Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	mission.setup(catalog, Ledger.new(), [], 5005, campaign)
	var worker: Node3D = mission.survivors[0]
	var vehicle_site: Dictionary = mission.city.sites.values().filter(func(site: Dictionary) -> bool: return site.vehicle)[0]
	var ordinary_site: Dictionary = mission.city.sites.values().filter(func(site: Dictionary) -> bool: return not site.vehicle and site.spec.interaction_categories.is_empty())[0]
	near(mission.interaction_duration(vehicle_site, worker), vehicle_site.spec.search_seconds * 0.88, "SUR_005 real vehicle interaction hook")
	near(mission.interaction_duration(ordinary_site, worker), ordinary_site.spec.search_seconds, "SUR_005 real ordinary search remains unchanged")
	mission.queue_free()

func _check_max_hp(catalog: RefCounted) -> void:
	var campaign := Campaign.new(catalog)
	campaign.new_run(9309, "", ["zhou_ye"])
	var member_id: String = campaign.data.members[0]
	near(Runtime.max_hp(100.0, catalog.by_id(catalog.traits, "robust_physique").at_level(1)), 112.0, "SUR_009 Lv1 max HP")
	near(Runtime.max_hp(100.0, catalog.by_id(catalog.traits, "robust_physique").at_level(5)), 125.0, "SUR_009 Lv5 max HP")
	var mission := Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	mission.setup(catalog, Ledger.new(), [], 9309, campaign)
	var member: Node3D = mission.survivors[0]
	near(member.data.max_hp, 112.0, "SUR_009 spawn derives Lv1 max HP")
	member.hp = 56.0
	campaign.data.roster[member_id].level = 5
	member.apply_trait(campaign.member_trait(member_id))
	near(member.data.max_hp, 125.0, "SUR_009 runtime level refresh derives Lv5 max HP")
	near(member.hp, 62.5, "SUR_009 level refresh preserves HP ratio")
	var store := Save.new("user://test-runs/trait-phase-a-%d.json" % OS.get_process_id())
	check(store.write(campaign.data, campaign.valid_state).is_empty(), "SUR_009 level saves")
	var restored := Campaign.new(catalog)
	var saved: Dictionary = store.read(restored.valid_state)
	check(saved.ok and restored.restore(saved.data), "SUR_009 save loads")
	check(restored.member_trait_level(member_id) == 5, "SUR_009 trait level survives load")
	mission.queue_free()
	await process_frame

func _check_loot_quality(catalog: RefCounted) -> void:
	var table := LootTableData.new()
	var common := LootEntryData.new()
	common.loot_id = "common"
	common.weight = 80.0
	common.min_amount = 1
	common.max_amount = 1
	common.rarity = 0
	var rare := LootEntryData.new()
	rare.loot_id = "rare"
	rare.weight = 20.0
	rare.min_amount = 1
	rare.max_amount = 1
	rare.rarity = 2
	table.entries = [common, rare]
	var traits: Array[Resource] = [TraitDataScript.new(), catalog.by_id(catalog.traits, "value_judgment").at_level(1), catalog.by_id(catalog.traits, "value_judgment").at_level(5)]
	var labels: Array[String] = ["baseline", "lv1", "lv5"]
	var bonuses: Array[float] = [0.0, 0.08, 0.16]
	for index: int in traits.size():
		near(Runtime.loot_weight(80.0, 0, traits[index]), 80.0, "SUR_010 preserves Common weight " + labels[index])
		near(Runtime.loot_weight(20.0, 2, traits[index]), 20.0 * (1.0 + bonuses[index]), "SUR_010 exact Rare+ weight " + labels[index])
		var rng := RandomNumberGenerator.new()
		rng.seed = 20260921
		var rare_count: int = 0
		for sample: int in SAMPLE_COUNT:
			var result: Array[Dictionary] = LootResolverData.roll(table, rng, traits[index])
			rare_count += int(not result.is_empty() and result[0].id == "rare")
		var actual: float = float(rare_count) / SAMPLE_COUNT
		var expected: float = (20.0 * (1.0 + bonuses[index])) / (80.0 + 20.0 * (1.0 + bonuses[index]))
		check(absf(actual - expected) < 0.005, "SUR_010 deterministic distribution " + labels[index])
		samples.append({"trait": "value_judgment", "level": [0, 1, 5][index], "sample_count": SAMPLE_COUNT, "rare_plus_count": rare_count, "actual_rate": actual, "expected_rate": expected})
	var epic_only: Resource = catalog.by_id(catalog.traits, "value_judgment").at_level(1)
	epic_only.params.minimum_rarity = 3
	near(Runtime.loot_weight(20.0, 2, epic_only), 20.0, "Loot rarity threshold comes from Trait data")
	near(Runtime.loot_weight(20.0, 3, epic_only), 21.6, "Loot weight applies at configured rarity threshold")
	var equipment := Equipment.new(catalog)
	var neutral: Resource = TraitDataScript.new()
	var value_trait: Resource = catalog.by_id(catalog.traits, "value_judgment").at_level(5)
	var base_rare: int = 0
	var trait_rare: int = 0
	var base_rng := RandomNumberGenerator.new()
	base_rng.seed = 20260921
	var trait_rng := RandomNumberGenerator.new()
	trait_rng.seed = 20260921
	for sample: int in 10000:
		base_rare += int(int(equipment.roll(["WPN_002_P9_PISTOL"], "quality-base-%d" % sample, base_rng, true, neutral).get("rarity", 0)) >= 2)
		trait_rare += int(int(equipment.roll(["WPN_002_P9_PISTOL"], "quality-trait-%d" % sample, trait_rng, true, value_trait).get("rarity", 0)) >= 2)
	check(trait_rare > base_rare, "SUR_010 formal equipment reward raises Rare+ outcomes")

func _check_power_cooldown(catalog: RefCounted) -> void:
	for level: int in [1, 5]:
		var campaign := Campaign.new(catalog)
		campaign.new_run(12000 + level, "", ["song_shiyu"])
		var member_id: String = campaign.data.members[0]
		campaign.data.roster[member_id].level = level
		check(campaign.grant_effect("power", "rage"), "Grant rage fixture")
		check(campaign.grant_effect("power", "aid"), "Grant aid fixture")
		check(campaign.expand_effect_slots("power", 1), "Expand power fixture")
		check(campaign.equip_effect("power", "rage") and campaign.equip_effect("power", "aid"), "Equip two power fixtures")
		var mission := Mission.new()
		root.add_child(mission)
		mission.set_physics_process(false)
		mission.setup(catalog, Ledger.new(), [], 12000 + level, campaign)
		var expected: float = 60.0 * (0.97 if level == 1 else 0.93)
		var member: Node3D = mission.survivors[0]
		var weapon_interval: float = member.weapon.cooldown
		var reload_seconds: float = member.weapon.reload_seconds
		check(mission.powers.activate("rage"), "SUR_012 activates rage Lv%d" % level)
		near(mission.powers.states.rage.remaining_cooldown, expected, "SUR_012 rage cooldown Lv%d" % level)
		check(mission.powers.activate("aid"), "SUR_012 activates aid Lv%d" % level)
		near(mission.powers.states.aid.remaining_cooldown, expected, "SUR_012 aid cooldown Lv%d" % level)
		near(member.weapon.cooldown, weapon_interval, "SUR_012 leaves weapon interval unchanged Lv%d" % level)
		near(member.weapon.reload_seconds, reload_seconds, "SUR_012 leaves reload unchanged Lv%d" % level)
		near(mission.effects.search_seconds(10.0, 1.0), 10.0, "SUR_012 leaves search timer unchanged Lv%d" % level)
		mission.powers.advance(expected)
		check(mission.powers.can_activate("rage") and mission.powers.can_activate("aid"), "SUR_012 cooldown re-enables powers Lv%d" % level)
		mission.queue_free()
		await process_frame

func _check_foundation_regression(catalog: RefCounted) -> void:
	near(catalog.by_id(catalog.traits, "search_instinct").at_level(1).search_multiplier, 1.12, "SUR_001 search regression")
	var basic := RewardDefinition.new()
	basic.category = RewardDefinition.Category.RESOURCE
	basic.tags = ["basic_resource"]
	var guaranteed: Resource = catalog.by_id(catalog.traits, "resource_efficiency").at_level(5)
	guaranteed.levels = PackedFloat32Array([1, 1, 1, 1, 1])
	var rng := RandomNumberGenerator.new()
	rng.seed = 1
	check(Runtime.reward_amount(guaranteed, basic, 1, rng) == 2, "SUR_002 reward regression")
	check(catalog.survivors.size() == 12 and catalog.traits.size() == 12, "All 12 definitions remain registered")
