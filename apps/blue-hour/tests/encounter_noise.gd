extends SceneTree
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	run.call_deferred()

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	var mission: Node3D = load("res://missions/mission.gd").new()
	root.add_child(mission)
	var loadout: Array[String] = ["pistol"]
	mission.setup(load("res://data/catalog.gd").new(), load("res://core/run_ledger.gd").new(), loadout, 701)
	mission.set_physics_process(false)
	mission.director_enabled = false
	check(mission.get("noise") != null, "Mission owns the reusable NoiseEvent dispatcher")
	if mission.get("noise") != null:
		mission.begin_arrival()
		check(mission.survivors[0].boarding and not mission.input_enabled, "Arrival locks orders until disembarkation")
		for i: int in range(180):
			if mission.arrival.finished:
				break
			mission._physics_process(1.0 / 30)
		check(mission.arrival.finished and not mission.survivors[0].boarding, "Production survivor walks out of the stopped vehicle")
		check(mission.noise.total_emitted == 0, "Arrival emits no premature noise while the squad is inside")
		mission._physics_process(0.01)
		check(mission.noise.total_emitted == 1, "Disembarkation emits arrival once")
		var interested: int = 0
		for actor: Node3D in mission.enemies:
			interested += int(actor.heard_noise == "ARRIVAL")
		check(interested >= 1 and interested <= 6, "Arrival attracts a local subset")
		mission.debug_clear_enemies()
		var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(0, 0, 0))
		var distant: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(0, 0, -35))
		var event: RefCounted = mission.noise.emit_noise(Vector3(0, 0, 8), 22, mission.noise.Event.NoiseType.PISTOL)
		check(event.world_position == Vector3(0, 0, 8) and event.radius == 22, "Event carries the actual sound origin and radius")
		check(enemy.state == enemy.State.INVESTIGATE and enemy.target == null, "Hearing gives an interest point without a survivor target")
		check(distant.state != distant.State.INVESTIGATE, "Finite radius excludes remote listeners")
		var start: Vector3 = enemy.position
		for i: int in range(60):
			enemy.tick(1.0 / 30, mission)
		check(enemy.position.distance_to(Vector3(0, 0, 8)) < start.distance_to(Vector3(0, 0, 8)), "Investigation moves along real navigation toward noise")
		for i: int in range(600):
			enemy.tick(1.0 / 30, mission)
		check(enemy.state != enemy.State.INVESTIGATE, "Empty investigation ends in idle or wander")
		mission.noise.advance(2)
		check(mission.noise.events.is_empty(), "Noise events expire")
		enemy.take_damage(999)
		mission._retire_enemy(enemy)
		var recycled: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(0, 0, 0))
		check(recycled.heard_noise.is_empty() and recycled.target == null and recycled.state == recycled.State.IDLE, "Pool clears hearing, target, and state")
	mission.free()
	await process_frame
	print("ENCOUNTER NOISE: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
