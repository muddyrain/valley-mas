extends SceneTree
var failures: Array[String] = []
var checks: int = 0
var app: Node
var mission: Node3D

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _initialize() -> void:
	call_deferred("run")

func frames(count: int) -> void:
	for i in range(count):
		await process_frame

func advance(seconds: float) -> void:
	var count := ceili(seconds * 30)
	for i in range(count):
		mission._physics_process(1.0 / 30.0)
		if i % 90 == 0:
			await process_frame
	await frames(2)

func clear_enemies() -> void:
	mission.debug_clear_enemies()

func place_squad(point: Vector3) -> void:
	mission.command_recall()
	mission.command_stop()
	for i in range(mission.survivors.size()):
		mission.survivors[i].position = mission.city.nearest_open(point + mission.formation(i))

func _watchdog() -> void:
	printerr("FAIL: mission test timeout")
	quit(2)

func run() -> void:
	create_timer(90).timeout.connect(_watchdog)
	var script = load("res://core/main.gd")
	if script == null or not script.can_instantiate():
		quit(1)
		return
	app = script.new()
	app.save_path = "user://test-runs/mission-flow.json"
	app.fresh_test_run = true
	root.add_child(app)
	await frames(3)
	check(app.state == "shelter", "Starts in simple safehouse")
	var ids: Array = app.campaign.data.members
	var old: String = app.campaign.data.equipment[ids[0]]
	app.equip_member(ids[0], app.campaign.data.equipment[ids[1]])
	check(app.campaign.data.equipment[ids[1]] == "" and app.campaign.weapon_inventory.has_weapon(old), "Transfer has one holder and returns old weapon to stock")
	app.debug_weapon("shotgun", "")
	var shotgun: Dictionary = app.campaign.data.inventory.back()
	app.equip_member(ids[2], shotgun.uid)
	check(app.campaign.weapon(app.campaign.data.equipment[ids[2]]).id == "WPN_005_S12_SHOTGUN", "Owned fourth weapon can be equipped before departure")
	app.start_mission()
	await frames(4)
	mission = app.mission
	mission.set_physics_process(false)
	mission.director_enabled = false
	clear_enemies()
	check(mission.survivors.size() == 3, "Three survivors actually spawn in the city")
	check(mission.city.sites.size() == 18, "Fifteen buildings and three vehicles exist as search targets")
	# Navigation test crosses a building footprint, not just an empty road.
	place_squad(Vector3(-13, 0, 8))
	mission.command_move(Vector3(-13, 0, -27))
	var passed_solid := false
	for i in range(480):
		mission._physics_process(1.0 / 30.0)
		for member in mission.survivors:
			if mission.city.grid.is_point_solid(mission.city.cell_at(member.position)):
				passed_solid = true
		if i % 120 == 0:
			await process_frame
	check(not passed_solid, "Squad movement never crosses blocked buildings or vehicles")
	check(mission.squad_center().distance_to(Vector3(-13, 0, -27)) < 3.0, "Squad routes around the building and reaches the destination")
	mission.command_move(Vector3(0, 0, 10))
	await advance(0.6)
	mission.command_stop()
	await advance(0.4)
	check(mission.survivors[0].path.is_empty(), "Player stop finishes its short braking phase")
	var stopped: Vector3 = mission.survivors[0].position
	await advance(0.5)
	check(mission.survivors[0].position.is_equal_approx(stopped), "Stop cancels movement")
	# Search interruption, then a real moving squad completing a vehicle.
	mission.clock.set_phase(mission.clock.DAY)
	place_squad(mission.city.sites.corner.spec.entry)
	mission.command_search("corner")
	await advance(2)
	var progress: float = mission.city.sites.corner.progress
	check(progress > 0, "Search progresses when the squad reaches the entrance")
	mission.command_recall()
	await advance(2)
	check(is_equal_approx(mission.city.sites.corner.progress, progress), "Recall preserves incomplete search progress")
	mission.command_search("corner")
	var blocker = mission.spawn_enemy("ENM_001_infected_basic_a", mission.city.sites.corner.spec.entry)
	for member in mission.survivors:
		member.cooldown = 10
	await advance(0.25)
	check(is_equal_approx(mission.city.sites.corner.progress, progress), "Nearby enemies pause search")
	clear_enemies()
	await advance(50)
	check(mission.city.sites.corner.searched, "Building can be searched to completion")
	check(mission.ledger.food == 3 and mission.ledger.scrap == 3, "Building drops are collected as Food and Scrap")
	var gathered: int = mission.ledger.food
	mission.command_search("corner")
	await advance(1)
	check(mission.ledger.food == gathered, "Completed buildings cannot pay out twice")
	mission.command_search("van_south")
	await advance(40)
	check(mission.city.sites.van_south.searched, "Squad moves to and searches a vehicle")
	check(mission.ledger.food == 4 and mission.ledger.scrap == 7, "Vehicle loot is credited")
	# A drop at distance remains in the world until someone approaches.
	mission.drop_loot(Vector3(-30, 0, -23), 2, 3)
	await advance(0.1)
	check(mission.pickups.size() == 1, "Remote drops are not automatically credited")
	place_squad(Vector3(-30, 0, -23))
	await advance(0.1)
	check(mission.pickups.is_empty() and mission.ledger.food == 6, "Approaching survivors collect world drops")
	# Traits change actual observable damage, not only labels.
	var resilient = mission.survivors[2]
	resilient.hp = 100
	resilient.take_damage(10)
	check(is_equal_approx(resilient.hp, 93), "Resilient trait reduces incoming damage")
	place_squad(Vector3(0, 0, 0))
	for member in mission.survivors:
		member.cooldown = 99
	var shooter = mission.survivors[0]
	shooter.equip(mission.catalog.by_id(mission.catalog.weapons, "pistol"))
	var enemy = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(-1, 0, -5))
	enemy.think_left = 99
	var before: float = enemy.hp
	await advance(0.05)
	check(is_equal_approx(before - enemy.hp, 22.5), "Auto attack applies steady trait damage to pistol")
	clear_enemies()
	# Weapons share the same system, with true range, magazine and cone differences.
	shooter.equip(mission.catalog.by_id(mission.catalog.weapons, "crowbar"))
	enemy = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(-1, 0, -6))
	enemy.think_left = 99
	await advance(0.1)
	check(enemy.hp == enemy.data.max_hp, "Melee cannot hit a distant target")
	enemy.position = shooter.position + Vector3(0, 0, -1.5)
	await advance(0.1)
	check(enemy.hp < enemy.data.max_hp, "Melee attacks automatically at close range")
	clear_enemies()
	shooter.equip(mission.catalog.by_id(mission.catalog.weapons, "shotgun"))
	var targets: Array[Node3D] = []
	shooter.combat.rng.seed = 10
	shooter.position = Vector3(0, 0, 10)
	for x in [-0.65, 0.0, 0.65]:
		var target = mission.spawn_enemy("ENM_001_infected_basic_a", shooter.position + Vector3(x, 0, -3))
		target.position = shooter.position + Vector3(x, 0, -3)
		target.think_left = 99
		targets.append(target)
	await advance(0.05)
	check(targets.filter(func(target): return target.hp < target.data.max_hp).size() >= 2 and shooter.combat.last_pellets.size() == 7, "Shotgun emits seven pellets and can hit multiple enemies")
	clear_enemies()
	shooter.equip(mission.catalog.by_id(mission.catalog.weapons, "smg"))
	shooter.ammo = 0
	enemy = mission.spawn_enemy("ENM_001_infected_basic_a", shooter.position + Vector3(0, 0, -5))
	enemy.think_left = 99
	await advance(0.05)
	check(shooter.reload_left > 0, "Empty magazine starts automatic reload")
	await advance(2.3)
	check(shooter.ammo > 0 and shooter.ammo < shooter.weapon.magazine, "Reload completes and firing resumes")
	clear_enemies()
	# Focus must move melee members into range and remove stale targets after kills.
	enemy = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(0, 0, -10))
	mission.command_focus(enemy)
	check(mission.focus_target == enemy, "Focus order selects a specific enemy")
	mission._update_focus(0.7)
	check(not mission.survivors[2].path.is_empty(), "Focus moves out-of-range members toward their target")
	enemy.take_damage(999)
	await advance(0.05)
	check(mission.focus_target == null and enemy in mission.enemy_pool, "Dead focus target is cleared and enemy goes back to the pool")
	var pooled: Array = mission.enemy_pool.duplicate()
	var reused = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(20, 0, 20))
	check(reused in pooled and reused.hp == reused.data.max_hp and reused.active, "Enemy pool reactivates a clean unit")
	clear_enemies()
	mission.clock.set_phase(mission.clock.NIGHT)
	mission.director_enabled = true
	mission.invincible = true
	mission.spawn_left = 0
	await advance(60)
	check(mission.clock.threat_level() >= 3 and mission.enemies.size() > 0, "Night director escalates over elapsed time")
	check(mission.enemies.all(func(actor): return actor.data.id == "ENM_001_infected_basic_a"), "Night director only spawns the formal common infected")
	for i in range(mission.catalog.map.enemy_limit + 10):
		mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(25, 0, 25))
	check(mission.enemies.size() <= mission.catalog.map.enemy_limit, "Enemy population remains bounded")
	mission.director_enabled = false
	clear_enemies()
	# UI debug functions operate on the real mission and pause simulation.
	app.hud.toggle_debug()
	check(app.hud.debug_menu.visible and mission.time_scale == 0, "F1 menu pauses the mission while configuring it")
	var frozen_time: float = mission.clock.elapsed
	var frozen_hp: float = mission.survivors[0].hp
	var debug_enemy = mission.spawn_enemy("ENM_001_infected_basic_a", mission.survivors[0].position)
	await advance(2.0)
	check(mission.clock.elapsed == frozen_time and mission.survivors[0].hp == frozen_hp and debug_enemy.hp == debug_enemy.max_hp, "Paused simulation cannot move time or attack")
	clear_enemies()
	app.hud.toggle_debug()
	check(not app.hud.debug_menu.visible and mission.time_scale == 1, "Closing debug resumes the selected speed")
	# No teleport evacuation: one missing survivor keeps the bus waiting.
	place_squad(mission.catalog.map.bus_position)
	mission.survivors[2].position = Vector3(25, 0, -25)
	mission.command_extract()
	mission.survivors[2].stop()
	await advance(12)
	check(mission.active and mission.closing_left < 0 and mission.extraction_left == mission.catalog.map.extraction_seconds, "Bus never evacuates while a living member is missing")
	mission.command_stop()
	check(not mission.extraction, "Stop cancels extraction preparation")
	mission.command_extract()
	# The southern return point now requires a longer real route from the remote member.
	await advance(70)
	check(app.state == "result" and not mission.active, "All survivors board after prep and door closing, reaching settlement")
	check(app.result.returned.size() == 3 and app.result.lost.is_empty(), "Full squad return is reported accurately")
	check(app.campaign.data.status == "pending" and app.campaign.preview().total >= 12, "Returning loot is staged before food settlement")
	app.return_to_shelter()
	await frames(3)
	check(app.state == "shelter" and app.mission == null, "Return button tears down the city and shows the safehouse")
	var stock: int = app.campaign.data.food
	app.start_mission()
	await frames(3)
	mission = app.mission
	mission.set_physics_process(false)
	mission.director_enabled = false
	clear_enemies()
	check(mission.clock.phase == mission.clock.DAY and mission.ledger.food == 0, "New sortie resets day, temporary threat and carried loot")
	mission.survivors[1].take_damage(1000)
	mission.ledger.add_loot(3, 4)
	mission.command_extract()
	await advance(11)
	check(app.state == "result" and app.result.returned.size() == 2 and app.result.lost.size() == 1, "Casualty extraction returns living members and explicitly reports the missing survivor")
	check(not app.result.wiped and app.campaign.preview().total == stock + 3, "Partial squad return stages recovered loot")
	app.return_to_shelter()
	await frames(3)
	stock = app.campaign.data.food
	app.start_mission()
	await frames(3)
	mission = app.mission
	mission.set_physics_process(false)
	mission.director_enabled = false
	clear_enemies()
	mission.ledger.add_loot(20, 30)
	for member in mission.survivors:
		member.take_damage(1000)
	await advance(0.1)
	check(app.state == "result" and app.result.wiped and app.result.food == 0, "Full squad death produces a failure result without loot")
	check(app.campaign.data.food == stock, "Pending wipe does not mutate stock before confirmation")
	app.return_to_shelter()
	check(app.campaign.data.status == "lost" and app.state == "ended", "Confirmed wipe ends the current run")
	print("MISSION FLOW: %d checks, %d failures" % [checks, failures.size()])
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var report := FileAccess.open("res://test-output/mission-flow.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "engine": Engine.get_version_info().string}, "\t"))
	app.queue_free()
	await frames(3)
	await create_timer(0.1).timeout
	quit(0 if failures.is_empty() else 1)
