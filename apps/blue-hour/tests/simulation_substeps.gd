extends "res://tests/time_contract.gd"
## Keep final movement samples and exact effect boundaries across speed substeps.

var steps: Array[float] = []
var applied_count: int = 0
var expired_count: int = 0
var expiry_day: int = 900

func run() -> void:
	create_timer(180.0).timeout.connect(func() -> void: quit(2))
	for provider: String in ["MEDIUM_TOWN_V1", "FIXED_LEGACY"]:
		for speed: float in [1.0, 2.0, 4.0]:
			var app: Node = await create_app(4101, provider)
			var mission: Node3D = app.mission
			for frame: int in 600:
				if mission.survivor_commands_enabled:
					break
				await process_frame
			mission.set_physics_process(false)
			mission.director_enabled = false
			mission.debug_clear_enemies()
			mission.powers.clear()
			mission.effects.sources.clear()
			mission.effects._rebuild()
			for member: Node3D in mission.survivors:
				member.equip(null)
			mission.simulation_advanced.connect(func(dt: float) -> void: steps.append(dt))
			var prefix: String = "%s x%d " % [provider, int(speed)]
			verify_motion(mission, speed, prefix)
			verify_boundaries(mission, speed, prefix)
			verify_periodic(mission, speed, prefix)
			app.free()
			await process_frame
	DirAccess.make_dir_recursive_absolute("res://test-output/simulation-substeps")
	FileAccess.open("res://test-output/simulation-substeps/report.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "measurements": measurements}, "\t"))
	print("SIMULATION SUBSTEPS: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func render_motion(mission: Node3D, member: Node3D) -> void:
	# Execute the production render consumer without yielding an automatic physics tick.
	mission.set_physics_process(true)
	member.animation_controller._process(1.0 / 60.0)
	mission.set_physics_process(false)

func verify_motion(mission: Node3D, speed: float, prefix: String) -> void:
	var member: Node3D = mission.survivors[0]
	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", mission.city.nearest_open(member.position + Vector3(-6, 0, 0)))
	enemy.target = member
	enemy.last_seen_position = member.position
	enemy.memory_left = 100.0
	enemy.think_left = 100.0
	enemy.attack_left = 100.0
	var enemy_start: Vector3 = enemy.position
	advance_seconds(mission, 1.0, speed)
	check(enemy.position.distance_to(enemy_start) > 0.5, prefix + "infected actually moves")
	check(absf(enemy.attack_left - 99.0) < 0.00001, prefix + "infected timer consumes one second once")
	check(absf(enemy.animation_player.speed_scale - enemy.animation_controller.playback_speed_variation) < 0.001, prefix + "infected animation retains its moving speed sample")
	var enemy_rate: float = enemy.animation_player.speed_scale
	mission.debug_clear_enemies()
	var start: Vector3 = member.position
	member.order_move(mission.city.nearest_open(start + Vector3(-12, 0, 0)), mission.city)
	var initial_clock: float = mission.clock.elapsed
	var initial_noise: float = mission.noise.elapsed
	for frame: int in int(60.0 / speed):
		steps.clear()
		mission._physics_process(1.0 / 60.0)
		check(steps.size() == int(speed), prefix + "has only meaningful bounded substeps")
		check(absf(step_sum() - speed / 60.0) < 1e-16, prefix + "preserves the entire outer frame interval")
	render_motion(mission, member)
	check(start.distance_to(member.position) > 2.0, prefix + "survivor actually moves")
	check(member.actual_velocity.length() > 2.0, prefix + "final velocity retains movement")
	check(member.animation_controller.current_state in [&"Run", &"Walk"], prefix + "rendered locomotion remains moving")
	check(absf(mission.clock.elapsed - initial_clock - 1.0) < 0.00001, prefix + "clock advances once")
	check(absf(mission.noise.elapsed - initial_noise - 1.0) < 0.00001, prefix + "noise advances once")
	measurements.append({"provider": mission.map_provider, "speed": speed, "movement_1s": start.distance_to(member.position), "velocity": member.actual_velocity.length(), "animation": str(member.animation_controller.current_state), "steps": steps.duplicate(), "infected_rate": enemy_rate})
	member.stop()
	mission._physics_process(1.0 / 60.0)
	render_motion(mission, member)
	check(member.animation_controller.current_state == &"Idle", prefix + "stopping returns to idle")
	mission.time_scale = 0.0
	var frozen: Array = [mission.clock.elapsed, mission.noise.elapsed, member.position]
	steps.clear()
	mission._physics_process(10.0)
	check(steps.is_empty() and frozen == [mission.clock.elapsed, mission.noise.elapsed, member.position], prefix + "pause has no substeps")
	mission.time_scale = speed
	mission._physics_process(1.0 / 60.0)
	check(absf(mission.clock.elapsed - float(frozen[0]) - speed / 60.0) < 0.00001, prefix + "resume consumes only its next frame")

func step_sum() -> float:
	var result: float = 0.0
	for dt: float in steps:
		result += dt
	return result

func verify_boundaries(mission: Node3D, speed: float, prefix: String) -> void:
	for duration: float in [1e-12, 1e-7, 0.007]:
		var definition: Resource = mission.catalog.by_id(mission.catalog.powers, "dusk_delay").duplicate()
		definition.duration = duration
		var definitions: Array[Resource] = [definition]
		expiry_day += 1
		mission.powers.start_day(expiry_day, definitions)
		check(mission.powers.activate("dusk_delay"), prefix + "activates short expiry")
		steps.clear()
		var clock_start: float = mission.clock.elapsed
		mission._physics_process(1.0 / 60.0)
		check(steps[0] == duration, prefix + "retains the exact short expiry boundary")
		check(not mission.powers.states.dusk_delay.active, prefix + "expires the power")
		check(absf(step_sum() - speed / 60.0) < 1e-16, prefix + "short expiry loses no time")
		check(absf(mission.clock.elapsed - clock_start - speed / 60.0 + duration) < 1e-11, prefix + "remaining interval resumes clock after expiry")
	mission.powers.clear()
	steps.clear()
	mission._physics_process(1e-12 / speed)
	check(steps.size() == 1 and absf(step_sum() - 1e-12) < 1e-26, prefix + "genuine tiny frame is not discarded")
	var edge: Resource = mission.catalog.by_id(mission.catalog.powers, "dusk_delay").duplicate()
	edge.duration = 1.0 / 60.0
	var edge_definitions: Array[Resource] = [edge]
	expiry_day += 1
	mission.powers.start_day(expiry_day, edge_definitions)
	mission.powers.activate("dusk_delay")
	steps.clear()
	var interval: float = 1.0 / 60.0 + 6.938893903907228e-18
	mission._physics_process(interval / speed)
	check(steps.size() == 2 and steps[0] == edge.duration and steps[1] > 0.0, prefix + "does not merge across a genuine expiry even at rounding scale")
	check(step_sum() == interval, prefix + "genuine rounding-scale expiry preserves its remainder")
	mission.powers.clear()

func verify_periodic(mission: Node3D, speed: float, prefix: String) -> void:
	for provider: Dictionary in mission.periodic_effects.to_state().providers:
		mission.periodic_effects.unregister_provider(provider.provider_id)
	var trait_data: Resource = mission.catalog.by_id(mission.catalog.traits, "morale_boost").at_level(1)
	trait_data.effect_interval = 1.0
	trait_data.effect_duration = 1e-12
	trait_data.effect_radius = 10000.0
	trait_data.effect_target_filter = "ALL_TEAM"
	mission.periodic_effects.register_provider(mission.survivors[0], trait_data, "substeps")
	applied_count = 0
	expired_count = 0
	mission.periodic_effects.effect_applied.connect(func(_event: Dictionary) -> void: applied_count += 1)
	mission.periodic_effects.effect_expired.connect(func(_event: Dictionary) -> void: expired_count += 1)
	advance_seconds(mission, 1.0, speed)
	check(applied_count == 3 and expired_count == 0, prefix + "periodic trigger occurs once per target")
	mission._physics_process(1e-12 / speed)
	check(expired_count == 3 and mission.periodic_effects.to_state().active_effects.is_empty(), prefix + "genuine tiny periodic expiry is consumed")
