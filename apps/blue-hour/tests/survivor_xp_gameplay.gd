extends SceneTree

const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Mission = preload("res://missions/mission.gd")
const HitEvent = preload("res://weapons/combat/hit_event.gd")
const Progression = preload("res://data/survivor_progression.gd")

var checks: int = 0
var failures: Array[String] = []
var mission: Node3D

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func advance(seconds: float) -> void:
	for _index in range(ceili(seconds * 30.0)):
		mission._physics_process(1.0 / 30.0)

func run() -> void:
	var catalog := Catalog.new()
	var campaign := Campaign.new(catalog)
	campaign.new_run(7310, "", ["xia_zhiyao", "su_wanxing"])
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = []
	mission.setup(catalog, Ledger.new(), loadout, 7310, campaign)
	mission.director_enabled = false
	mission.debug_clear_enemies()

	var worker: Node3D = mission.survivors[0]
	var site: Dictionary = mission.city.sites.corner
	worker.position = site.spec.entry
	mission.command_search("corner")
	site.progress = 0.999
	await advance(1.5)
	check(campaign.member_total_xp(worker.data.id) == 1, "Completed search awards one XP to its worker")
	var search_xp: int = campaign.member_total_xp(worker.data.id)
	await advance(1.0)
	check(campaign.member_total_xp(worker.data.id) == search_xp, "Completed search cannot award XP twice")

	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", worker.position + Vector3(0, 0, -1.0))
	check(enemy != null, "Combat XP test spawns an enemy")
	if enemy != null:
		enemy.hp = 1.0
		enemy.apply_hit(HitEvent.create({"source": worker, "damage": 1.0, "target": enemy}))
		await advance(0.1)
		check(campaign.member_total_xp(worker.data.id) == search_xp + 1, "Final hit awards one XP to its survivor")
		mission._retire_enemy(enemy)
		check(campaign.member_total_xp(worker.data.id) == search_xp + 1, "Repeated enemy retirement cannot award XP twice")

	check(Progression.default_event_xp(Progression.EventType.SPECIAL_EVENT) == 1, "Special event keeps a configured API value")
	print("SURVIVOR XP GAMEPLAY: %d checks, %d failures" % [checks, failures.size()])
	mission.queue_free()
	await create_timer(0.1).timeout
	quit(0 if failures.is_empty() else 1)
