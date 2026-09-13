extends "res://tests/search_dispatch.gd"

func run() -> void:
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	mission.setup(Catalog.new(), Ledger.new(), loadout, 20260912)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var entry: Vector3 = mission.city.sites.arrival_house.spec.entry
	var worker: Node3D = mission.survivors[0]
	worker.position = entry
	mission.command_search("arrival_house")
	await advance(.15)
	check(worker.visible and mission.city.sites.arrival_house.progress == 0, "Entering transition precedes interior search timer")
	await advance(.3)
	check(worker.inside_building and not worker.visible and worker.path.is_empty(), "Interior worker is hidden and removed from outside navigation")
	var task: RefCounted = mission.search_task
	var before: float = mission.city.sites.arrival_house.progress
	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", entry + Vector3(0, 0, -1))
	enemy.target = worker
	enemy.attack_target = worker
	var health: float = worker.hp
	await advance(.1)
	check(enemy.target != worker and enemy.attack_target != worker and worker.hp == health, "Enemy drops both chase and committed attack against an interior worker")
	await advance(.4)
	check(mission.city.sites.arrival_house.progress == before and not worker.inside_building, "Doorway threat pauses search and brings the worker out to defend")
	mission.debug_clear_enemies()
	mission.command_search("garden_house")
	check(mission.search_tasks.size() == 2, "Different survivors reserve different buildings")
	before = mission.city.sites.arrival_house.progress
	mission.command_recall("arrival_house")
	check(worker.visible and worker.position.distance_to(entry) < .01, "Cancellation reveals the worker at the same entrance")
	await advance(.4)
	check(not worker.inside_building and task.phase == task.Phase.CANCELLED, "Exit finishes before outside control and combat resume")
	check(mission.city.sites.arrival_house.progress == before and mission.search_tasks.has("garden_house"), "Cancel preserves progress and the other assignment")
	mission.command_recall_all()
	await advance(.4)
	worker.position = entry
	worker.stop()
	mission.command_search("arrival_house")
	mission.city.sites.arrival_house.progress = .995
	await advance(1)
	check(mission.city.sites.arrival_house.searched and worker.visible and not worker.inside_building, "Completion awards loot once and exits into the world")
	check(mission.search_tasks.is_empty(), "Completed task releases its worker")
	entry = mission.city.sites.van_south.spec.entry
	worker.position = entry
	worker.stop()
	for member: Node3D in mission.survivors.slice(1):
		member.position = entry + Vector3(15, 0, 7)
		member.stop()
	mission.command_search("van_south")
	await advance(.5)
	check(worker.visible and not worker.inside_building, "Vehicle search remains outdoors")
	before = mission.city.sites.van_south.progress
	enemy = mission.spawn_enemy("ENM_001_infected_basic_a", entry + Vector3(0, 0, -.7))
	enemy.hp = 10000
	health = worker.hp
	await advance(2)
	check(mission.city.sites.van_south.progress == before and worker.hp < health, "Vehicle search still interrupts and takes outside damage")
	mission.debug_clear_enemies()
	await advance(mission.catalog.map.search_resume_seconds + .2)
	check(mission.city.sites.van_south.progress > before, "Vehicle search resumes with retained progress after danger")
	print("INTERIOR SEARCH: %d checks, %d failures" % [checks, failures.size()])
	mission.free()
	quit(0 if failures.is_empty() else 1)
