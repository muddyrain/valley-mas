extends "res://tests/expedition_minimap.gd"
## Controlled regression; native main-scene input acceptance is recorded separately.

func run() -> void:
	create_timer(90.0).timeout.connect(func() -> void: quit(2))
	DirAccess.make_dir_recursive_absolute("res://test-output/mission-dayloop")
	for provider: String in ["MEDIUM_TOWN_V1", "FIXED_LEGACY"]:
		var app: Node = await create_app(4101, provider)
		var mission: Node3D = app.mission
		for frame: int in 600:
			if mission.survivor_commands_enabled:
				break
			await process_frame
		app.hud.ambient_threat.set_physics_process(false)
		mission.director_enabled = false
		mission.debug_clear_enemies()
		mission.arrival_noise_pending = false
		mission.invincible = true
		var outcomes: Array[Dictionary] = []
		mission.completed.connect(func(outcome: Dictionary) -> void: outcomes.append(outcome))
		var before: float = mission.clock.elapsed
		mission._physics_process(1.0)
		check(is_equal_approx(mission.clock.elapsed - before, 1.0), provider + " advances the clock exactly once")
		mission.effects.sources.clear()
		mission.effects._rebuild()
		mission.clock.settings.day_seconds = mission.clock.elapsed + 1.0
		mission.clock.settings.blue_seconds = 1.0
		mission._physics_process(1.0)
		check(mission.clock.phase == mission.clock.BLUE_HOUR, provider + " enters Blue Hour")
		mission._physics_process(1.0)
		check(mission.clock.phase == mission.clock.NIGHT, provider + " enters Night")
		mission._physics_process(mission.clock.settings.night_threat_seconds)
		check(mission.clock.threat_level() >= 2, provider + " escalates night threat")
		mission.director_enabled = true
		mission.spawn_left = 0.0
		mission._physics_process(1.0 / 30.0)
		check(mission.encounter.blue_hour_spawned > 0, provider + " existing director can spawn reachable night reinforcements")
		mission.director_enabled = false
		mission.debug_clear_enemies()
		mission.command_extract()
		check(mission.last_command_rejection.is_empty(), provider + " return order targets walkable boarding ground")
		mission.command_stop()
		var boarding_positions: Array[Vector3] = []
		if mission.town_runtime_ready:
			boarding_positions = mission.city.spawn_positions(mission.survivors.size())
		else:
			for index: int in mission.survivors.size():
				boarding_positions.append(mission.catalog.map.bus_position + mission.formation(index))
		for member: Node3D in mission.survivors:
			member.position = boarding_positions[mission.survivors.find(member)]
		mission.survivors.back().position = mission.city.nearest_open(mission.catalog.map.bus_position + Vector3(10, 0, 0))
		mission.command_extract()
		check(mission.extraction, provider + " starts return with a missing member: " + mission.last_command_rejection)
		mission.survivors.back().stop()
		mission._physics_process(0.25)
		check(mission.active and mission.closing_left < 0 and is_equal_approx(mission.extraction_left, mission.catalog.map.extraction_seconds), provider + " waits for missing member")
		for member: Node3D in mission.survivors:
			member.position = boarding_positions[mission.survivors.find(member)]
			member.stop()
		mission.command_extract()
		for tick: int in 900:
			mission._physics_process(1.0 / 30.0)
			if mission.closing_left >= 0 or not mission.active:
				break
		check(mission.board_count() == mission.living().size(), provider + " return paths bring everyone inside boarding radius")
		check(mission.active and mission.closing_left > 0, provider + " starts closing after preparation")
		mission._physics_process(1.5)
		await process_frame
		check(not mission.active and outcomes.size() == 1 and app.state == "result", provider + " reaches one settlement")
		mission._physics_process(2.0)
		check(outcomes.size() == 1, provider + " cannot settle twice")
		app.queue_free()
		await process_frame
		var wipe_app: Node = await create_app(4101, provider)
		mission = wipe_app.mission
		wipe_app.hud.ambient_threat.set_physics_process(false)
		mission.director_enabled = false
		mission.debug_clear_enemies()
		mission.ledger.add_loot(5, 7)
		for member: Node3D in mission.survivors:
			member.take_damage(10000)
		mission._physics_process(0.1)
		await process_frame
		check(wipe_app.state == "result" and wipe_app.result.wiped and wipe_app.result.food == 0 and wipe_app.result.scrap == 0, provider + " wipes through normal mission tick and loses carried loot")
		wipe_app.queue_free()
		await process_frame
	FileAccess.open("res://test-output/mission-dayloop/report.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("MISSION DAYLOOP: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
