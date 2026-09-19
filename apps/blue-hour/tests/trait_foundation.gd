extends SceneTree
const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Save = preload("res://core/save_store.gd")
const Runtime = preload("res://core/trait_runtime.gd")
const Reward = preload("res://data/reward_definition.gd")
const Ledger = preload("res://core/run_ledger.gd")
const OUT: String = "res://test-output/trait-foundation/"
var failures: Array[String] = []
var checks: int = 0
var samples: Array[Dictionary] = []
var event_total: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures.append(message)
		printerr(message)

func run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT)
	var catalog := Catalog.new()
	check(catalog.validate().is_empty(), "All content contracts validate")
	var campaign := Campaign.new(catalog)
	campaign.new_run(4101, "", ["xia_zhiyao", "su_wanxing"])
	for id: String in campaign.data.members:
		var definition: Resource = campaign.member_template(id)
		check(definition is SurvivorDefinition, "Formal definition: " + id)
		check(definition.trait_levels.size() == 5 and definition.base_move_speed == 2.8, "Five levels and frozen speed")
		check(ResourceLoader.exists(definition.model_resource) and ResourceLoader.exists(definition.portrait), "Model/portrait resolve")
		check(campaign.member_trait_level(id) == 1, "New run defaults to level one")
	campaign.data.food = 100
	for index: int in 4:
		check(campaign.train("xia_zhiyao"), "Existing level up advances trait")
	check(not campaign.train("xia_zhiyao") and campaign.member_trait_level("xia_zhiyao") == 5, "Level cap")
	var store := Save.new("user://test-runs/trait-foundation-%d.json" % OS.get_process_id())
	check(store.write(campaign.data, campaign.valid_state).is_empty(), "Save formal progression")
	var restored := Campaign.new(catalog)
	var saved: Dictionary = store.read(restored.valid_state)
	check(saved.ok and restored.restore(saved.data), "Restore formal progression")
	check(restored.member_trait_level("xia_zhiyao") == 5 and restored.member_trait_level("su_wanxing") == 1, "Trait levels survive save/load")
	var xia: Resource = catalog.by_id(catalog.traits, "search_instinct")
	for level: int in range(1, 6):
		var expected: float = [0.12, 0.15, 0.18, 0.21, 0.25][level - 1]
		check(absf(xia.at_level(level).search_multiplier - (1 + expected)) < .000001, "Exact table level %d" % level)
	check(xia.at_level(0).runtime_level == 1 and xia.at_level(99).runtime_level == 5, "Runtime clamps out-of-range levels")
	var su: Resource = catalog.by_id(catalog.traits, "resource_efficiency")
	for level: int in [1, 5]:
		var ledger := Ledger.new()
		event_total = 0
		ledger.resources_collected.connect(func(gained: Vector2i): event_total += gained.x + gained.y)
		var rng := RandomNumberGenerator.new()
		rng.seed = 20260919
		var leveled: Resource = su.at_level(level)
		var count: int = 100000
		var hits: int = 0
		for index: int in count:
			var gain: Vector2i = ledger.collect_resources(1, 0, 1.0, leveled, rng)
			hits += gain.x - 1
		var rate: float = float(hits) / count
		var target: float = .08 if level == 1 else .16
		check(absf(rate - target) < .005, "Proc distribution at level %d" % level)
		check(ledger.food == count + hits and ledger.scrap == 0 and event_total == ledger.food, "Reward event and ledger include every extra unit")
		var result: Dictionary = ledger.finish([], [], 1.0, 0, false)
		check(result.food == count + hits and ledger.stored_food == result.food, "Settlement includes bonus once")
		check(ledger.collect_resources(1, 0, 1, leveled, rng) == Vector2i.ZERO, "Settled ledger cannot award twice")
		samples.append({"level": level, "seed": 20260919, "sample_count": count, "proc_count": hits, "proc_rate": rate, "target_rate": target})
	# Force a guaranteed proc so exclusions cannot pass by random chance.
	var guaranteed: Resource = su.at_level(5)
	guaranteed.levels = PackedFloat32Array([1, 1, 1, 1, 1])
	var rng := RandomNumberGenerator.new()
	rng.seed = 123
	for category: int in [Reward.Category.WEAPON, Reward.Category.EQUIPMENT, Reward.Category.POWER, Reward.Category.CHARACTER_UNLOCK, Reward.Category.QUEST, Reward.Category.SPECIAL]:
		var definition := Reward.new()
		definition.category = category
		definition.tags = ["basic_resource"]
		check(Runtime.reward_amount(guaranteed, definition, 3, rng) == 3, "Exclude category %d even if mistagged" % category)
	for rarity: int in [Reward.Rarity.RARE, Reward.Rarity.EPIC, Reward.Rarity.LEGENDARY]:
		var definition := Reward.new()
		definition.category = Reward.Category.RESOURCE
		definition.rarity = rarity
		definition.tags = ["basic_resource"]
		check(Runtime.reward_amount(guaranteed, definition, 3, rng) == 3, "Exclude Rare+ %d" % rarity)
	var generic := Reward.new()
	generic.id = "arbitrary_future_resource"
	generic.category = Reward.Category.RESOURCE
	check(Runtime.reward_amount(guaranteed, generic, 3, rng) == 3, "Untagged resources excluded")
	generic.tags = ["basic_resource"]
	check(Runtime.reward_amount(guaranteed, generic, 3, rng) == 4, "Unknown name works by tag, one extra per grant")
	check(Runtime.reward_amount(guaranteed, generic, 0, rng) == 0, "No reward creates no bonus")
	check(Runtime.reward_amount(xia.at_level(5), generic, 3, rng) == 3, "Search modifier does not change rewards")
	var report := {"checks": checks, "failures": failures, "samples": samples}
	FileAccess.open(OUT + "statistics.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("TRAIT FOUNDATION: ", report)
	quit(0 if failures.is_empty() else 1)
