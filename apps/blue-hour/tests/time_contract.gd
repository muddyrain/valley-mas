extends "res://tests/expedition_minimap.gd"
## Controlled simulation checks; formal HUD input is accepted separately.

var measurements: Array[Dictionary] = []
var action_baselines: Dictionary = {}

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
			mission.arrival_noise_pending = false
			mission.invincible = true
			for member: Node3D in mission.survivors:
				member.weapon = null
				member.combat.equip(null)
			mission.effects.sources.clear()
			mission.effects._rebuild()
			var prefix: String = "%s x%d " % [provider, int(speed)]
			# A stationary enemy's cooldown exposes missing or duplicate enemy ticks.
			var point: Vector3 = mission.city.nearest_open(mission.catalog.map.bus_position + Vector3(12, 0, 0))
			var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", point)
			enemy.attack_left = 100.0
			enemy.think_left = 100.0
			enemy.state_left = 100.0
			var initial_clock: float = mission.clock.elapsed
			var initial_noise: float = mission.noise.elapsed
			var initial_spawn: float = mission.spawn_left
			mission.time_scale = speed
			for frame: int in int(120.0 / speed):
				mission._physics_process(1.0 / 60.0)
			check(absf(mission.clock.elapsed - initial_clock - 2.0) < 0.00001, prefix + "clock consumes two simulated seconds")
			check(absf(mission.noise.elapsed - initial_noise - 2.0) < 0.00001, prefix + "Noise consumes the same interval once")
			check(absf(enemy.attack_left - 98.0) < 0.00001, prefix + "Enemy consumes the same interval once")
			check(is_equal_approx(mission.spawn_left, initial_spawn), prefix + "disabled director does not advance")
			measurements.append({"provider": provider, "speed": speed, "clock_delta": mission.clock.elapsed - initial_clock, "noise_delta": mission.noise.elapsed - initial_noise, "enemy_delta": 100.0 - enemy.attack_left})
			mission.time_scale = 0.0
			var frozen: Array = state(mission, enemy)
			mission._physics_process(8.0)
			for frame: int in 8:
				await physics_frame
			check(state(mission, enemy) == frozen, prefix + "pause freezes world including independent nodes")
			mission.time_scale = speed
			mission._physics_process(1.0 / 60.0)
			check(absf(mission.clock.elapsed - float(frozen[0]) - speed / 60.0) < 0.00001, prefix + "resume has no wall-time catch-up")
			if mission.town_runtime_ready:
				mission.survivor_commands_enabled = false
				frozen = state(mission, enemy)
				mission._physics_process(1.0)
				check(state(mission, enemy) == frozen, prefix + "loading gate freezes simulation")
				mission.survivor_commands_enabled = true
			verify_actions(mission, speed, prefix)
			mission.active = false
			frozen = state(mission, enemy)
			mission._physics_process(1.0)
			await physics_frame
			check(state(mission, enemy) == frozen, prefix + "completed mission no longer advances")
			app.queue_free()
			await process_frame
	DirAccess.make_dir_recursive_absolute("res://test-output/time-contract")
	FileAccess.open("res://test-output/time-contract/report.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "measurements": measurements}, "\t"))
	print("TIME CONTRACT: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func state(mission: Node3D, enemy: Node3D) -> Array:
	return [mission.clock.elapsed, mission.noise.elapsed, enemy.position, enemy.attack_left,
		mission.survivors[0].hp, mission.spawn_left, mission.action_elapsed,
		mission.extraction_left, mission.closing_left, mission.periodic_effects.to_state().duplicate(true)]

func advance_seconds(mission: Node3D, seconds: float, speed: float) -> void:
	mission.time_scale = speed
	for frame: int in int(round(seconds * 60.0 / speed)):
		mission._physics_process(1.0 / 60.0)

func verify_actions(mission: Node3D, speed: float, prefix: String) -> void:
	mission.debug_clear_enemies()
	var worker: Node3D = mission.survivors[0]
	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", worker.position)
	enemy.position = worker.position + Vector3(0.6, 0.0, 0.0)
	enemy.target = worker
	enemy.target_visible = true
	enemy.memory_left = 100.0
	enemy.think_left = 100.0
	mission.invincible = false
	var initial_hp: float = worker.hp
	advance_seconds(mission, 4.0, speed)
	var damage: float = initial_hp - worker.hp
	check(damage > 0.0, prefix + "infected attacks actually damage a survivor")
	mission.invincible = true
	worker.hp = initial_hp
	mission.debug_clear_enemies()
	worker.equip(mission.catalog.by_id(mission.catalog.weapons, "pistol"))
	worker.combat.rng.seed = 910
	enemy = mission.spawn_enemy("ENM_001_infected_basic_a", worker.position)
	enemy.position = worker.position + Vector3(0.6, 0.0, 0.0)
	enemy.data = enemy.data.duplicate()
	enemy.data.max_hp = 2000.0
	enemy.hp = 2000.0
	enemy.max_hp = 2000.0
	enemy.think_left = 100.0
	enemy.state_left = 100.0
	advance_seconds(mission, 4.0, speed)
	var outgoing: float = 2000.0 - enemy.hp
	var rounds: int = worker.weapon.magazine_size - worker.ammo
	check(outgoing > 0.0 and rounds > 0, prefix + "autonomous combat consumes ammo and deals damage")
	mission.debug_clear_enemies()
	worker.weapon = null
	worker.combat.equip(null)
	enemy = mission.spawn_enemy("ENM_001_infected_basic_a", mission.city.nearest_open(worker.position + Vector3(-6.0, 0.0, 0.0)))
	var enemy_start: Vector3 = enemy.position
	enemy.investigate(worker.position)
	advance_seconds(mission, 2.0, speed)
	var enemy_distance: float = enemy_start.distance_to(enemy.position)
	check(enemy_distance > 0.1, prefix + "infected navigation actually advances")
	mission.debug_clear_enemies()
	var start: Vector3 = worker.position
	var destination: Vector3 = mission.city.nearest_open(start + Vector3(-6.0, 0.0, 0.0))
	worker.order_move(destination, mission.city)
	advance_seconds(mission, 2.0, speed)
	var distance: float = start.distance_to(worker.position)
	check(distance > 0.5, prefix + "survivor movement actually advances")
	var metrics: Array = [damage, outgoing, float(rounds), distance, enemy_distance]
	if speed == 1.0:
		action_baselines[mission.map_provider] = metrics
	else:
		var reference: Array = action_baselines[mission.map_provider]
		for index: int in metrics.size():
			check(absf(float(metrics[index]) - float(reference[index])) < 0.0001, prefix + "same simulation interval matches x1 metric %d" % index)
	measurements.append({"provider": mission.map_provider, "speed": speed, "incoming_damage_4s": damage, "auto_damage_4s": outgoing, "rounds_4s": rounds, "movement_2s": distance, "enemy_movement_2s": enemy_distance})
	worker.stop()
	var freeze_power: Resource = mission.catalog.by_id(mission.catalog.powers, "dusk_delay").duplicate()
	freeze_power.duration = 0.4
	var freeze_definitions: Array[Resource] = [freeze_power]
	mission.powers.start_day(776, freeze_definitions)
	check(mission.powers.activate("dusk_delay"), prefix + "activates the scoped day-clock freeze")
	var clock_start: float = mission.clock.elapsed
	var noise_start: float = mission.noise.elapsed
	advance_seconds(mission, 1.0, speed)
	check(absf(mission.clock.elapsed - clock_start - 0.6) < 0.00001, prefix + "effect expiry preserves the rest of the simulation interval")
	check(absf(mission.noise.elapsed - noise_start - 1.0) < 0.00001, prefix + "scoped clock freeze does not freeze Noise or world time")
	var site_id: String = ""
	for id: String in mission.city.sites:
		var candidate: Dictionary = mission.city.sites[id]
		candidate.discovered = true
		if mission.town_runtime_ready and mission.search_registry.resolve_priority(id) != mission.TownSearchRegistry.RESOLVED_REACHABLE:
			continue
		site_id = id
		break
	check(not site_id.is_empty(), prefix + "search fixture is reachable")
	if site_id.is_empty():
		return
	var site: Dictionary = mission.city.sites[site_id]
	site.spec.search_seconds = 100.0
	worker.position = site.spec.entry
	check(mission.command_search(site_id, worker), prefix + "assigns a real SearchTask")
	advance_seconds(mission, 1.0, 1.0)
	var initial_progress: float = site.progress
	var duration: float = mission.interaction_duration(site, worker)
	var trait_data: Resource = mission.catalog.by_id(mission.catalog.traits, "morale_boost").at_level(1)
	trait_data.effect_interval = 1.0
	trait_data.effect_duration = 0.5
	mission.periodic_effects.register_provider(mission.survivors[1], trait_data, "time-probe")
	var power: Resource = mission.catalog.by_id(mission.catalog.powers, "rage")
	var definitions: Array[Resource] = [power]
	mission.powers.start_day(777, definitions)
	check(mission.powers.activate("rage"), prefix + "activates a real power")
	advance_seconds(mission, 2.0, speed)
	check(absf(site.progress - initial_progress - 2.0 / duration) < 0.00001, prefix + "search progresses by simulated duration")
	check(absf(mission.powers.states.rage.remaining_duration - 6.0) < 0.00001, prefix + "power duration uses simulation time")
	check(absf(mission.powers.states.rage.remaining_cooldown - 58.0) < 0.00001, prefix + "power cooldown uses simulation time")
	var periodic: Dictionary = mission.periodic_effects.to_state()
	check(periodic.active_effects.size() > 0, prefix + "periodic trait triggers in simulation time")
	var snapshot: String = var_to_str([site.progress, mission.powers.states.rage.remaining_duration, periodic])
	mission.time_scale = 0.0
	mission._physics_process(10.0)
	check(var_to_str([site.progress, mission.powers.states.rage.remaining_duration, mission.periodic_effects.to_state()]) == snapshot, prefix + "search, skills and periodic effects freeze")
	measurements.append({"provider": mission.map_provider, "speed": speed, "search_progress": site.progress - initial_progress, "search_expected": 2.0 / duration, "power_remaining": mission.powers.states.rage.remaining_duration, "periodic": periodic})
	mission._release_tasks()
	advance_seconds(mission, 1.0, 1.0)
	# Controlled boarding fixture; completion still runs through the normal countdown.
	var positions: Array[Vector3] = []
	if mission.town_runtime_ready:
		positions = mission.city.spawn_positions(mission.survivors.size())
	for index: int in mission.survivors.size():
		mission.survivors[index].position = positions[index] if mission.town_runtime_ready else mission.catalog.map.bus_position + mission.formation(index)
		mission.survivors[index].stop()
	mission.command_extract()
	for frame: int in 1800:
		mission.time_scale = speed
		mission._physics_process(1.0 / 60.0)
		if mission.closing_left >= 0:
			break
	check(mission.closing_left > 0.0 and mission.active, prefix + "real preparation reaches closing")
	var door: float = mission.city.bus_door.position.x
	var actor_scale: Vector3 = worker.scale
	var closing: float = mission.closing_left
	mission.time_scale = 0.0
	mission._physics_process(2.0)
	check(mission.closing_left == closing and mission.city.bus_door.position.x == door and worker.scale == actor_scale, prefix + "closing timer and visuals freeze")
	advance_seconds(mission, 0.4, speed)
	check(absf(mission.closing_left - closing + 0.4) < 0.00001 and worker.scale.length() < actor_scale.length(), prefix + "closing resumes at selected speed")
