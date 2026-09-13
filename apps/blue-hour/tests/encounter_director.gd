extends SceneTree
var checks: int = 0
var failures: Array[String] = []

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
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	mission.setup(load("res://data/catalog.gd").new(), load("res://core/run_ledger.gd").new(), loadout, 701)
	mission.set_physics_process(false)
	var config: Resource = mission.catalog.map.encounter
	var original_count: int = mission.enemies.size()
	mission.spawn_left = 0
	mission._update_director(.01)
	check(mission.enemies.size() == original_count, "Daytime population above minimum does not keep accumulating")
	mission.debug_clear_enemies()
	mission.spawn_left = 0
	mission._update_director(.01)
	check(mission.enemies.size() == config.daytime_respawn_batch, "Low population receives one small batch")
	check(is_equal_approx(mission.spawn_left, config.daytime_respawn_interval), "Daytime replenishment respects the slow interval")
	for enemy: Node3D in mission.enemies:
		check(enemy.position.distance_to(mission.squad_center()) >= config.spawn_safe_radius, "Replenishment stays far from survivors")
		check(not mission.camera.is_position_in_frustum(enemy.position + Vector3.UP), "Replenishment never pops into camera")
		check(not mission.city.path(enemy.position, mission.squad_center()).is_empty(), "Replenishment uses connected navigation")
	mission._update_director(1)
	check(mission.enemies.size() == config.daytime_respawn_batch, "No high frequency daytime flood")
	mission.debug_clear_enemies()
	mission.clock.set_phase(mission.clock.BLUE_HOUR)
	mission.spawn_left = 0
	mission._update_director(.01)
	check(mission.enemies.size() == config.blue_hour_spawn_batch, "Blue hour produces a configured horde wave")
	check(is_equal_approx(mission.spawn_left, config.blue_hour_spawn_interval / config.blue_hour_spawn_multiplier), "Horde starts at the configured faster rate")
	var sides: Dictionary = {}
	for enemy: Node3D in mission.enemies:
		check(enemy.target == null and enemy.state == enemy.State.INVESTIGATE, "Horde has a regional interest, not an exact survivor lock")
		check(enemy.visual_multiplier == config.blue_hour_visual_multiplier and enemy.speed_multiplier == config.blue_hour_speed_multiplier, "New horde receives enhanced senses and movement")
		check(not mission.camera.is_position_in_frustum(enemy.position + Vector3.UP), "Horde stays offscreen too")
	for spawn: Dictionary in mission.encounter.spawn_history.slice(-config.blue_hour_spawn_batch):
		if spawn.has("side"):
			sides[spawn.side] = true
	check(sides.size() >= 2, "One horde wave uses multiple edge directions")
	var first_interval: float = mission.clock.spawn_interval()
	mission.clock.advance(config.horde_pressure_seconds * 3)
	check(mission.clock.spawn_interval() < first_interval and mission.clock.spawn_interval() >= config.horde_min_interval, "Lingering increases pressure with a bounded spawn rate")
	mission.closing_left = 1
	mission.spawn_left = 0
	var before_close: int = mission.enemies.size()
	mission._update_director(1)
	check(mission.enemies.size() == before_close, "Closed extraction stops the director")
	mission.free()
	await process_frame
	print("ENCOUNTER DIRECTOR: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
