extends SceneTree
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Mission = preload("res://missions/mission.gd")
var failures: Array[String] = []
var checks := 0
var mission: Node3D

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func advance(seconds: float) -> void:
	for i in range(ceili(seconds * 30)):
		mission._physics_process(1.0 / 30)
		if i % 90 == 0:
			await process_frame

func finish() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var report := FileAccess.open("res://test-output/search-dispatch.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("SEARCH DISPATCH: %d checks, %d failures" % [checks, failures.size()])
	mission.queue_free()
	await create_timer(0.15).timeout
	quit(0 if failures.is_empty() else 1)

func run() -> void:
	create_timer(60).timeout.connect(func(): quit(2))
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	mission.setup(Catalog.new(), Ledger.new(), loadout, 772)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	for target in mission.city.sites.values():
		check(not mission.city.grid.is_point_solid(mission.city.cell_at(target.spec.entry)), "Configured search entrance is reachable: " + target.spec.id)
	var site: Dictionary = mission.city.sites.corner
	var entry: Vector3 = site.spec.entry
	var worker = mission.survivors[1]
	for i in range(3):
		mission.survivors[i].position = entry + Vector3(0, 0, -[3, 1, 5][i])
	var guard_position: Vector3 = mission.survivors[0].position
	mission.command_search("corner")
	await advance(2)
	check(mission.survivors[0].position.is_equal_approx(guard_position), "Dispatch moves only one survivor, leaving guards at their position")
	check(site.progress > 0, "The nearest survivor reaches the visible entrance and searches")
	check(mission.has_method("command_reassign"), "A search task can be reassigned to another living survivor")
	if not mission.has_method("command_reassign"):
		await finish()
		return
	check(mission.search_task.worker == worker and mission.guards().size() == 2, "Automatic dispatch selects the nearest available member and leaves two guards")
	var before: float = site.progress
	await advance(1)
	check(is_equal_approx(site.progress - before, worker.talent.search_multiplier / site.spec.search_seconds), "Only the worker trait determines search speed, without squad-size division")
	var ammo_before: int = worker.ammo
	var guard = mission.survivors[0]
	var guard_ammo: int = guard.ammo
	var enemy = mission.spawn_enemy("ENM_001_infected_basic_a", entry + Vector3(0, 0, -6.5))
	enemy.hp = 10000
	enemy.think_left = 999
	await advance(1)
	check(worker.ammo == ammo_before and guard.ammo < guard_ammo, "Working survivor gives up firepower while nearby guards keep firing")
	mission.command_focus(enemy)
	mission._update_focus(0.7)
	check(mission.search_task.worker == worker and worker.path.is_empty(), "Focus moves only guards and preserves the worker's task")
	enemy.take_damage(20000)
	await advance(0.1)
	check(mission.search_id == "corner", "Killing a focus target does not cancel the search")
	mission.command_move(entry + Vector3(7, 0, 6))
	await advance(0.5)
	check(mission.search_id == "corner" and worker.position.distance_to(entry) < 1.2, "Moving guards leaves the worker at the entrance")
	mission.command_stop()
	before = site.progress
	await advance(0.3)
	check(site.progress > before, "Stop applies to guards, without interrupting search")
	mission.command_search("van_south")
	check(mission.search_tasks.has("corner") and mission.search_tasks.has("van_south") and mission.search_tasks.corner.worker == worker, "A second target runs independently without replacing the first worker")
	mission.command_recall("van_south")
	mission.command_search("corner")
	# A visible, vulnerable searcher stops working to defend against close enemies.
	for member in mission.guards():
		member.position = entry + Vector3(15, 0, 7)
		member.stop()
	enemy = mission.spawn_enemy("ENM_001_infected_basic_a", worker.position + Vector3(0, 0, -.7))
	enemy.hp = 10000
	enemy.think_left = 0
	var health: float = worker.hp
	before = site.progress
	await advance(enemy.data.attack_windup + .2)
	check(site.progress == before and not worker.searching, "Threat at the entrance freezes progress and releases the worker to defend")
	check(enemy.hp < 10000 and worker.hp < health, "The worker actually retaliates and can take damage")
	check(worker.visible and worker.scale == Vector3.ONE, "Searching never hides or protects a survivor inside a building")
	mission.debug_clear_enemies()
	await advance(0.25)
	check(site.progress == before, "Search does not flicker back on immediately after a threat")
	await advance(mission.catalog.map.search_resume_seconds + 0.2)
	check(site.progress > before, "Search resumes after a short safe period, retaining progress")
	before = site.progress
	worker.take_damage(5)
	await advance(0.1)
	check(site.progress == before, "Taking a hit independently interrupts search")
	# Reassignment releases the old worker, and invalid requests are non-destructive.
	mission.command_reassign(0)
	check(mission.search_task.worker == guard and not worker.searching, "Reassignment reserves the new worker and releases the old one")
	check(site.progress == before, "Reassignment preserves already earned search progress")
	mission.command_reassign(-1)
	check(mission.search_task.worker == guard, "An invalid replacement does not destroy the task")
	await advance(8)
	check(guard.position.distance_to(entry) < 1.2, "Replacement physically walks to the entrance")
	before = site.progress
	await advance(1)
	check(is_equal_approx(site.progress - before, guard.talent.search_multiplier / site.spec.search_seconds), "A nearby scavenger no longer lends their trait to another searcher")
	mission.command_recall()
	check(mission.search_id.is_empty() and not guard.searching, "Recall cancels the task and releases its firepower")
	enemy = mission.spawn_enemy("ENM_001_infected_basic_a", entry + Vector3(10, 0, 6))
	mission.command_focus(enemy)
	enemy.take_damage(10000)
	await advance(0.1)
	check(guard.regrouping, "Finishing a guard focus target cannot strand the returning worker")
	before = site.progress
	await advance(7)
	check(site.progress == before and guard.position.distance_to(worker.position) < 4, "Recalled worker physically rejoins guards while saved progress remains")
	# Death cannot leave a ghost worker or automatically commit a second survivor.
	mission.command_search("corner")
	mission.command_reassign(0)
	guard.take_damage(10000)
	before = site.progress
	await advance(0.3)
	check(mission.search_id.is_empty() and site.progress == before, "Worker death stops search without progress or silent replacement")
	mission.command_search("corner")
	var replacement = mission.search_task.worker
	mission.command_reassign(0)
	check(mission.search_task.worker == replacement, "A dead survivor cannot be assigned")
	# A near-complete search returns once, then automatically regroups.
	replacement.position = entry
	replacement.stop()
	site.progress = 0.995
	var food: int = mission.ledger.food
	var scrap: int = mission.ledger.scrap
	await advance(1)
	check(site.searched and mission.search_id.is_empty(), "Completing a search releases the worker automatically")
	check(mission.ledger.food == food + site.spec.food and mission.ledger.scrap == scrap + site.spec.scrap, "Completion drops and collects the configured reward once")
	mission.command_search("corner")
	await advance(1)
	check(mission.ledger.food == food + site.spec.food, "Clicking a completed site cannot duplicate loot")
	await advance(7)
	check(replacement.position.distance_to(mission.guards_center(replacement)) < 4, "Completed worker returns to the current guards, not an old search point")
	# Evacuation supersedes both search and return, still waits for living members.
	mission.command_search("van_south")
	replacement = mission.search_task.worker
	replacement.position = mission.city.nearest_open(Vector3(-24, 0, -20))
	mission.command_extract()
	check(mission.search_id.is_empty() and mission.extraction and not replacement.searching, "Evacuation recalls the worker and sends all living members toward the bus")
	replacement.stop()
	await advance(12)
	check(mission.active and mission.closing_left < 0, "Evacuation cannot abandon a delayed former worker")
	mission.command_extract()
	await advance(30)
	check(not mission.active and mission.ledger.last_result.returned.size() == 2, "Former worker reaches the bus and casualty settlement completes")
	await finish()
