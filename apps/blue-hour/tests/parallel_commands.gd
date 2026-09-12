extends SceneTree
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
var world: Node3D
var checks := 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func step(seconds: float) -> void:
	for i in range(ceili(seconds * 30)):
		world._physics_process(1.0 / 30)
		if i % 90 == 0:
			await process_frame

func finish() -> void:
	var suffix := "-red" if "red" in OS.get_cmdline_user_args() else ""
	var report := FileAccess.open("res://test-output/parallel-commands" + suffix + ".json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("PARALLEL COMMANDS: %d checks, %d failures" % [checks, failures.size()])
	world.queue_free()
	await create_timer(0.15).timeout
	quit(0 if failures.is_empty() else 1)

func run() -> void:
	create_timer(60).timeout.connect(func(): quit(2))
	world = Mission.new()
	root.add_child(world)
	world.set_physics_process(false)
	world.set_process(false)
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	world.setup(Catalog.new(), Ledger.new(), loadout, 772)
	world.director_enabled = false
	world.debug_clear_enemies()
	var ids := ["corner", "van_south", "garage"]
	for i in range(3):
		world.survivors[i].position = world.city.sites[ids[i]].spec.entry
	for id in ids:
		world.command_search(id)
	await step(1)
	check(ids.all(func(id): return world.city.sites[id].progress > 0), "Three targets progress concurrently with three distinct workers")
	check(world.guards().is_empty(), "All three survivors may search, leaving zero guards")
	check(world.has_method("command_aim"), "Direct aim is available separately from enemy lock-on")
	if not failures.is_empty():
		await finish()
		return
	var workers: Array = ids.map(func(id): return world.search_tasks[id].worker)
	check(workers[0] != workers[1] and workers[1] != workers[2] and workers[0] != workers[2], "Each target owns a distinct worker")
	world.command_search("pharmacy")
	check(world.search_tasks.size() == 3 and world.search_id == "garage", "A fourth site cannot steal an occupied survivor")
	world.command_search("corner")
	check(world.search_task.worker == workers[0], "Selecting an active site preserves its assignment")
	world.command_reassign(1)
	check(world.search_task.worker == workers[0] and world.search_tasks.van_south.worker == workers[1], "Reassignment cannot take another task's worker")
	var before: float = world.city.sites.corner.progress
	world.command_recall("corner")
	check(world.search_tasks.size() == 2 and world.guards() == [workers[0]], "Canceling one task releases only its worker")
	var other: float = world.city.sites.van_south.progress
	world.command_move(Vector3(0, 0, 10))
	world.command_stop()
	await step(1)
	check(world.city.sites.corner.progress == before and world.city.sites.van_south.progress > other, "Move and stop preserve other tasks while canceled progress stays saved")
	world.command_search("van_south")
	before = world.city.sites.van_south.progress
	world.command_reassign(0)
	check(world.search_tasks.van_south.worker == workers[0] and world.task_for(workers[1]) == null, "Selected task can be reassigned to a free survivor")
	check(world.city.sites.van_south.progress == before, "Reassignment retains progress")
	world.command_search("corner")
	check(world.search_tasks.size() == 3 and world.search_tasks.corner.worker == workers[1], "New task reserves the newly available survivor")
	before = world.city.sites.garage.progress
	other = world.city.sites.van_south.progress
	workers[2].take_damage(5)
	world.search_tasks.van_south.worker.position = world.city.sites.van_south.spec.entry
	await step(0.1)
	check(world.city.sites.garage.progress == before and world.city.sites.van_south.progress > other, "Damage interrupts only the affected worker while another task advances")
	workers[2].take_damage(10000)
	await step(0.1)
	check(not world.search_tasks.has("garage") and world.search_tasks.size() == 2, "Worker death removes only its own task")
	for id in world.search_tasks:
		world.search_tasks[id].worker.position = world.city.sites[id].spec.entry
		world.city.sites[id].progress = 0.9999
	var food: int = world.ledger.food
	await step(0.1)
	check(world.city.sites.corner.searched and world.city.sites.van_south.searched and world.search_tasks.is_empty(), "Two tasks can finish in the same frame and release both workers")
	check(world.ledger.food == food + world.city.sites.corner.spec.food + world.city.sites.van_south.spec.food, "Simultaneous completion collects each site's reward exactly once")
	world.command_search("corner")
	world.command_search("van_south")
	await step(0.1)
	check(world.ledger.food == food + world.city.sites.corner.spec.food + world.city.sites.van_south.spec.food, "Completed sites cannot duplicate simultaneous rewards")
	world.command_search("garage")
	world.command_search("pharmacy")
	check(world.guards().is_empty(), "Recall fixture starts with all living members assigned")
	world.command_recall_all()
	check(world.search_tasks.is_empty() and world.guards().size() == 2 and world.guards().all(func(m): return not m.path.is_empty()), "Recall all releases and moves every living worker even with zero prior guards")
	world.command_search("garage")
	world.command_search("pharmacy")
	var delayed = world.search_tasks.pharmacy.worker
	delayed.position = world.city.nearest_open(Vector3(-24, 0, -20))
	world.command_extract()
	check(world.search_tasks.is_empty() and world.extraction, "Extract recalls both simultaneously assigned survivors")
	delayed.stop()
	await step(15)
	check(world.active and world.closing_left < 0, "Bus cannot leave a distant former worker behind")
	world.command_extract()
	await step(45)
	check(not world.active and world.ledger.last_result.returned.size() == 2, "All living former searchers reach the bus and settle together")
	await aim_checks()
	await finish()

func aim_checks() -> void:
	world.queue_free()
	await process_frame
	world = Mission.new()
	root.add_child(world)
	world.set_physics_process(false)
	world.set_process(false)
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	world.setup(Catalog.new(), Ledger.new(), loadout, 772)
	world.director_enabled = false
	world.debug_clear_enemies()
	var gunner = world.survivors[0]
	var melee = world.survivors[2]
	gunner.position = Vector3(0, 0, 12)
	world.survivors[1].position = world.city.sites.corner.spec.entry
	melee.position = Vector3(0, 0, 22)
	world.command_search("corner")
	await step(0.1)
	var task = world.search_task
	var before: float = world.city.sites.corner.progress
	world.command_move(Vector3(0, 0, 3))
	world.command_aim(Vector3(0, 0, 0))
	var origin: Vector3 = gunner.position
	var ammo: int = gunner.ammo
	await step(0.1)
	check(gunner.position == origin and gunner.path.is_empty(), "Direct aim stops guards immediately without chasing")
	check(gunner.ammo < ammo, "Aiming into empty space consumes ammunition")
	check(world.search_task == task and world.city.sites.corner.progress > before, "Direct aim leaves the independent search running")
	var front = world.spawn_enemy("ENM_001_infected_basic_a", Vector3(0, 0, 7))
	var side = world.spawn_enemy("ENM_001_infected_basic_a", Vector3(4, 0, 12))
	var far = world.spawn_enemy("ENM_001_infected_basic_a", Vector3(0, 0, -12))
	for enemy in [front, side, far]:
		enemy.hp = 10000
	gunner.cooldown = 0
	gunner.tick(0.01, world)
	check(front.hp < 10000 and side.hp == 10000 and far.hp == 10000, "Aimed fire hits along the pointer direction, without homing or exceeding range")
	ammo = gunner.ammo
	gunner.tick(0.01, world)
	check(gunner.ammo == ammo, "Direct fire respects the weapon cooldown")
	gunner.ammo = 0
	gunner.cooldown = 0
	gunner.tick(0.01, world)
	check(gunner.reload_left > 0 and gunner.ammo == 0, "Empty magazine starts normal reload")
	gunner.tick(gunner.weapon.reload_seconds + 0.01, world)
	check(gunner.ammo == gunner.weapon.magazine - 1, "Reload refills and resumes directed fire")
	world.debug_clear_enemies()
	var close = world.spawn_enemy("ENM_001_infected_basic_a", melee.position + Vector3(0, 0, -1))
	close.hp = 10000
	melee.tick(0.01, world)
	check(close.hp < 10000 and melee.position == Vector3(0, 0, 22), "Melee defends nearby while aiming without chasing the pointer")
	world.debug_clear_enemies()
	gunner.equip(world.catalog.by_id(world.catalog.weapons, "shotgun"))
	gunner.combat.rng.seed = 10
	var spread: Array = []
	for x in [-0.65, 0, 0.65]:
		var enemy = world.spawn_enemy("ENM_001_infected_basic_a", Vector3(x, 0, 8))
		enemy.position = Vector3(x, 0, 8)
		enemy.hp = 10000
		spread.append(enemy)
	gunner.tick(0.01, world)
	check(spread.filter(func(enemy): return enemy.hp < 10000).size() >= 2 and gunner.combat.last_pellets.size() == 7, "Directed shotgun uses seven independent pellet rays")
	gunner.equip(world.catalog.by_id(world.catalog.weapons, "pistol"))
	world.debug_clear_enemies()
	# Aim through the center of a solid building, within pistol range.
	var cover: Dictionary = world.city.sites.corner.spec
	gunner.position = Vector3(cover.position.x, 0, floorf(cover.position.z - cover.size.z * .5) - 1)
	var covered_at := Vector3(cover.position.x, 0, ceilf(cover.position.z + cover.size.z * .5) + 1)
	var covered = world.spawn_enemy("ENM_001_infected_basic_a", covered_at)
	covered.position = covered_at
	covered.hp = 10000
	check(not world.city.line_clear(gunner.position, covered.position), "Cover fixture crosses a solid building")
	world.command_aim(covered.position)
	gunner.cooldown = 0
	gunner.tick(0.01, world)
	check(covered.hp == 10000, "Manual fire cannot pass through cover")
	world.time_scale = 0
	before = world.city.sites.corner.progress
	ammo = gunner.ammo
	var elapsed: float = world.clock.elapsed
	await step(1)
	check(world.city.sites.corner.progress == before and gunner.ammo == ammo and world.clock.elapsed == elapsed, "Tactical pause freezes search, firing and mission time")
	world.end_aim()
	check(not world.manual_aim and world.search_task == task, "Releasing aim restores automatic combat without canceling search")
	world.command_extract()
	check(world.search_tasks.is_empty() and world.extraction, "Extraction releases every task and supersedes directed fire")
