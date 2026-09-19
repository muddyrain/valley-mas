extends SceneTree
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Ledger = preload("res://core/run_ledger.gd")
const TraitDataScript = preload("res://data/trait_data.gd")
const Card = preload("res://ui/expedition/search_card.gd")
const OUT: String = "res://test-output/trait-foundation/"
var checks: int = 0
var failures: Array[String] = []
var measurements: Array[Dictionary] = []
var completed_loot: Dictionary = {}
var collected_loot: Dictionary = {}
var completed_count: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, label: String) -> void:
	checks += 1
	if not ok:
		failures.append(label)
		printerr(label)

func reset_site(mission: Node3D, id: String, worker: Node3D) -> void:
	mission.command_recall_all()
	for exit: RefCounted in mission.exiting_tasks:
		exit.advance_exit(1.0)
	mission.exiting_tasks.clear()
	mission.search_tasks.clear()
	for pickup: Dictionary in mission.pickups:
		pickup.view.queue_free()
	mission.pickups.clear()
	var site: Dictionary = mission.city.sites[id]
	site.searched = false
	site.progress = 0.0
	site.discovered = true
	worker.position = site.spec.entry
	worker.inside_building = false
	worker.visible = true
	worker.stop()
	for other: Node3D in mission.survivors:
		if other != worker:
			other.position = mission.catalog.map.bus_position
	mission.selected_search_member = worker
	mission.rng.seed = 98765
	mission.command_search(id)
	check(mission.search_tasks.has(id), "Dispatch to existing target " + id)
	if not mission.search_tasks.has(id):
		return
	var task: RefCounted = mission.search_tasks[id]
	check(task.worker == worker, "Formal Xia owns task")
	task.prepare(0, mission)
	task.prepare(.3, mission)
	check(worker.searching, "Real search enters active phase")

func run() -> void:
	create_timer(150).timeout.connect(func(): quit(2))
	DirAccess.make_dir_recursive_absolute(OUT)
	var catalog := Catalog.new()
	var campaign := Campaign.new(catalog)
	campaign.new_run(4101, "", ["xia_zhiyao", "su_wanxing"])
	var ledger := Ledger.new()
	var mission := Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = []
	mission.setup(catalog, ledger, loadout, 4101, campaign)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	mission.search_completed.connect(func(_id: String, _worker: String, loot: Dictionary): completed_loot = loot.duplicate(true); completed_count += 1)
	mission.search_loot_collected.connect(func(_id: String, _worker: String, loot: Dictionary): collected_loot = loot.duplicate(true))
	var xia: Node3D = mission.survivors[0]
	var su: Node3D = mission.survivors[1]
	var card := Card.new()
	root.add_child(card)
	card.setup(mission)
	var targets: Dictionary = {}
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		var kind: String = "vehicle" if site.vehicle else str(site.spec.get("search_kind", ""))
		if kind in ["residential", "vehicle", "large"] and not targets.has(kind):
			targets[kind] = id
	check(targets.size() == 3, "Existing residential, vehicle and large searchable targets")
	for kind: String in targets:
		var id: String = targets[kind]
		var site: Dictionary = mission.city.sites[id]
		var base: float = site.spec.search_seconds
		var baseline_loot: Dictionary = {}
		for level: int in [0, 1, 5]:
			xia.talent = TraitDataScript.new() if level == 0 else catalog.by_id(catalog.traits, "search_instinct").at_level(level)
			reset_site(mission, id, xia)
			if not mission.search_tasks.has(id):
				continue
			var task: RefCounted = mission.search_tasks[id]
			var elapsed: float = 0
			var expected: float = base / (1.0 if level == 0 else 1.12 if level == 1 else 1.25)
			var events_before: int = completed_count
			while not site.searched and elapsed < base + 1:
				task.advance(1.0 / 120, mission)
				elapsed += 1.0 / 120
				if absf(elapsed - expected * .5) < 1.0 / 120:
					card.update_site(id, false)
					check(absf(card.progress.value - elapsed / expected * 100) < .001, "Progress UI uses real duration")
			check(site.searched and completed_count == events_before + 1, "Completes once: " + kind)
			check(elapsed >= expected - .00001 and elapsed - expected <= 1.0 / 120 + .00001, "Measured duration: %s level %d" % [kind, level])
			if level == 0:
				baseline_loot = completed_loot.duplicate(true)
			check(completed_loot == baseline_loot, "Search trait preserves same-seed reward")
			measurements.append({"provider": "FIXED_LEGACY", "target": id, "kind": kind, "name": site.spec.name, "level": level, "base_seconds": base, "expected_seconds": expected, "measured_seconds": elapsed, "reward": completed_loot})
			for exit: RefCounted in mission.exiting_tasks:
				exit.advance_exit(1)
			mission.exiting_tasks.clear()
			xia.position = site.spec.entry
			var before := Vector2i(ledger.food, ledger.scrap)
			mission._update_pickups()
			check(Vector2i(ledger.food, ledger.scrap) - before == Vector2i(completed_loot.food, completed_loot.scrap), "Search reward enters unchanged inventory")
			check(collected_loot.food == completed_loot.food and collected_loot.scrap == completed_loot.scrap, "Search result UI event matches inventory")
		# Cancellation retains partial progress; move uses the existing command route.
		xia.talent = catalog.by_id(catalog.traits, "search_instinct").at_level(5)
		reset_site(mission, id, xia)
		if mission.search_tasks.has(id):
			mission.search_tasks[id].advance(.5, mission)
			var before: int = completed_count
			var progress: float = site.progress
			mission.command_recall(id)
			check(not mission.search_tasks.has(id) and site.progress == progress and completed_count == before, "Cancel preserves progress without reward")
			for exit: RefCounted in mission.exiting_tasks:
				exit.advance_exit(1)
			mission.exiting_tasks.clear()
			check(mission.command_move(catalog.map.bus_position), "Move after cancel accepted")
	# Guarantee a Su proc in the real pickup path; only the test duplicate is changed.
	mission.command_recall_all()
	var guaranteed: Resource = catalog.by_id(catalog.traits, "resource_efficiency").at_level(5)
	guaranteed.levels = PackedFloat32Array([1, 1, 1, 1, 1])
	su.talent = guaranteed
	su.inside_building = false
	su.position = catalog.map.bus_position
	xia.position = su.position + Vector3(10, 0, 0)
	var before := Vector2i(ledger.food, ledger.scrap)
	mission.drop_loot(su.position, 2, 3, {}, {"id": "trait-qa", "worker_name": su.data.display_name})
	mission._update_pickups()
	check(Vector2i(ledger.food, ledger.scrap) - before == Vector2i(3, 4), "Su bonus enters real pickup inventory")
	check(collected_loot.food == 3 and collected_loot.scrap == 4, "UI reward event includes final bonus")
	var count_before: int = ledger.food + ledger.scrap
	mission._update_pickups()
	check(ledger.food + ledger.scrap == count_before, "Pickup cannot grant twice")
	var weapon: Dictionary = campaign.item(campaign.data.equipment["su_wanxing"]).duplicate(true)
	weapon.uid = "trait-qa-weapon"
	var weapons_before: int = ledger.weapons.size()
	mission.drop_loot(su.position, 0, 0, weapon)
	mission._update_pickups()
	mission._update_pickups()
	check(ledger.weapons.size() == weapons_before + 1, "Guaranteed resource proc never duplicates a real weapon")
	check(ledger.food + ledger.scrap == count_before, "Weapon pickup creates no basic-resource bonus")
	FileAccess.open(OUT + "gameplay.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "search": measurements}, "\t"))
	print("TRAIT GAMEPLAY: ", checks, " checks; ", failures)
	card.queue_free()
	mission.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
