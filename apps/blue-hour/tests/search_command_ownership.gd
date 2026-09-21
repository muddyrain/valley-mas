extends SceneTree
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")

var world: Node3D
var solo: Node3D
var checks := 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func step(seconds: float, target: Node3D = null) -> void:
	var subject: Node3D = world if target == null else target
	for i in range(ceili(seconds * 30.0)):
		subject._physics_process(1.0 / 30.0)
		if i % 90 == 0:
			await process_frame

func finish() -> void:
	var report := FileAccess.open("res://test-output/search-command-ownership.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("SEARCH COMMAND OWNERSHIP: %d checks, %d failures" % [checks, failures.size()])
	if is_instance_valid(world):
		world.queue_free()
	if is_instance_valid(solo):
		solo.queue_free()
	await create_timer(0.1).timeout
	quit(0 if failures.is_empty() else 1)

func run() -> void:
	create_timer(60.0).timeout.connect(func(): quit(2))
	world = Mission.new()
	root.add_child(world)
	world.set_physics_process(false)
	world.set_process(false)
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	world.setup(Catalog.new(), Ledger.new(), loadout, 772)
	world.director_enabled = false
	world.debug_clear_enemies()
	var ids := ["corner", "van_south", "garage"]
	for id: String in ids:
		world.city.sites[id].spec.search_seconds = 46.0
	for i in range(ids.size()):
		world.survivors[i].position = world.city.sites[ids[i]].spec.entry
	var a: Node3D = world.survivors[0]
	var b: Node3D = world.survivors[1]
	var c: Node3D = world.survivors[2]

	check(world.command_search("corner", a), "Explicit A search command is accepted")
	check(world.command_search("van_south", b), "Explicit B search command is accepted")
	check(world.search_tasks.size() == 2 and world.survivor_tasks.size() == 2, "Target and survivor indexes contain two active tasks")
	check(world.task_for(a) == world.search_tasks.corner and world.task_for(b) == world.search_tasks.van_south and world.task_for(c) == null, "Each survivor resolves its own task")
	await step(1.0)
	var a_progress: float = world.city.sites.corner.progress
	var b_progress: float = world.city.sites.van_south.progress
	check(a_progress > 0 and b_progress > 0, "A and B search progress advances independently")

	var c_origin: Vector3 = c.position
	check(world.command_move(Vector3(0, 0, 10)), "Move command is accepted by non-searching survivors")
	await step(0.5)
	check(world.task_for(a) != null and world.city.sites.corner.progress > a_progress, "A keeps searching while C receives movement")
	check(c.position.distance_to(c_origin) > 0.01 or not c.path.is_empty(), "C receives a movement route independently")

	world.command_recall_survivor(a)
	check(world.task_for(a) == null and not world.survivor_tasks.has(str(a.data.id)), "Canceling A clears only A's survivor index")
	check(world.search_tasks.has("van_south") and world.task_for(b) != null, "B target and survivor task survive A cancellation")
	var b_after_cancel: float = world.city.sites.van_south.progress
	await step(0.5)
	check(world.city.sites.van_south.progress > b_after_cancel, "B continues after A cancellation")

	solo = Mission.new()
	root.add_child(solo)
	solo.set_physics_process(false)
	solo.set_process(false)
	var solo_loadout: Array[String] = ["pistol"]
	solo.setup(Catalog.new(), Ledger.new(), solo_loadout, 773)
	solo.director_enabled = false
	solo.debug_clear_enemies()
	var only: Node3D = solo.survivors[0]
	only.position = solo.city.sites.corner.spec.entry
	solo.city.sites.corner.spec.search_seconds = 46.0
	check(solo.command_search("corner", only), "Single survivor accepts an explicit search command")
	check(solo.survivor_tasks.size() == 1 and solo.task_for(only) == solo.search_tasks.corner, "Single survivor owns the task through the survivor index")
	await step(0.5, solo)
	check(solo.city.sites.corner.progress > 0, "Single survivor search progresses")
	await finish()
