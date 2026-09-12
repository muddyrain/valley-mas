extends "res://tests/day_loop_runtime.gd"

var save_file: String = "user://test-runs/world-map-%d.json" % Time.get_ticks_usec()
var perf_frames: Array[float] = []

func step(seconds: float) -> void:
	for i: int in range(ceili(seconds * 30)):
		if app.mission == null or not app.mission.active:
			break
		app.mission._physics_process(1.0 / 30.0)
		if i % 90 == 0:
			await process_frame
	await frames(2)

func run() -> void:
	create_timer(150).timeout.connect(func(): printerr("WORLD MAP RUNTIME TIMEOUT"); quit(2))
	root.unfocusable = true
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output")
	app = load("res://core/main.tscn").instantiate()
	app.save_path = save_file
	root.add_child(app)
	await frames(12)
	check(app.state == "menu", "Production main scene starts at Main Menu")
	await capture("world-01-menu")
	await click(button("开始游戏"))
	check(app.state == "new_game" and app.campaign.data.is_empty(), "New Game opens route draft without creating expedition")
	await click(app.screen.tabs.scavenge)
	await capture("world-02-route")
	await click(app.screen.confirm_button)
	check(app.state == "shelter" and app.mission == null, "Confirm route creates run and enters actual Camp")
	var members: Array = app.campaign.data.members.duplicate()
	var specialty: String = app.campaign.data.specialization
	var inventory: Array = app.campaign.data.inventory.duplicate(true)
	var initial_food: int = app.campaign.data.food
	var initial_scrap: int = app.campaign.data.scrap
	await capture("world-03-camp")
	await click(app.screen.departure)
	check(app.state == "today_action", "Camp opens destination selection")
	await click(app.screen.cards.commercial)
	await click(app.screen.confirm_button)
	check(app.state == "mission" and app.mission != null, "Camp departure enters production expedition")
	check(app.mission.city.sites.size() == 18, "Formal expedition contains fifteen buildings and three searchable vehicles")
	check(app.hud != null and app.mission.camera.current, "Existing HUD and high orthographic camera are active")
	check(app.mission.survivors.size() == members.size(), "Existing run members spawn")
	app.mission.set_physics_process(false)
	await capture("world-04-day")
	for member: Node3D in app.mission.survivors:
		check(not app.mission.city.grid.is_point_solid(app.mission.city.cell_at(member.position)), "Player arrives on an open cell")
	var start: Vector3 = app.mission.squad_center()
	await click_at(app.mission.camera.unproject_position(app.mission.catalog.map.bus_position + Vector3(0, 0, -10)))
	await step(4.0)
	check(app.mission.squad_center().distance_to(start) > 4, "Actual ground click moves the existing squad")
	await key(KEY_SPACE)
	check(app.mission.time_scale == 0, "Existing tactical pause still works")
	await key(KEY_SPACE)
	# The native input path selects the closest southern POI; simulation and combat stay real.
	await click_at(app.mission.camera.unproject_position(app.mission.city.sites.arrival_house.spec.entry + Vector3.UP * .2))
	var deadline: float = app.mission.clock.elapsed + 85
	while not app.mission.city.sites.arrival_house.searched and app.mission.active and app.mission.clock.elapsed < deadline:
		await step(1)
	check(app.mission.city.sites.arrival_house.searched, "Actual entrance click completes search through the existing task system")
	check(app.mission.ledger.food >= app.mission.city.sites.arrival_house.spec.food, "Food loot is collected by the original ledger")
	await capture("world-05-search")
	# Advance the original clock through both boundaries, with its normal signal wiring.
	# Director/combat can continue; this is time-compressed validation, not a replacement clock.
	await step(maxf(0, app.mission.clock.settings.day_seconds - app.mission.clock.elapsed + .1))
	check(app.mission.active and app.mission.clock.phase == app.mission.clock.BLUE_HOUR, "Original clock naturally enters BLUE HOUR")
	await create_timer(3.7).timeout
	check(app.mission.city.accent_lights[0].light_energy > 1, "Existing atmosphere switches on warm street lights")
	check(app.mission.city.lamp_materials[0].emission_energy_multiplier > 1, "Street lamp lens emission follows the same phase")
	await capture("world-06-blue-hour")
	await step(app.mission.clock.settings.blue_seconds)
	check(app.mission.clock.phase == app.mission.clock.NIGHT, "Original clock naturally enters Night")
	await create_timer(3.7).timeout
	await capture("world-07-night")
	for i: int in range(100):
		var before: int = Time.get_ticks_usec()
		await process_frame
		perf_frames.append((Time.get_ticks_usec() - before) / 1000.0)
	var collected_food: int = app.mission.ledger.food
	var collected_scrap: int = app.mission.ledger.scrap
	await key(KEY_E)
	check(app.mission.extraction, "E invokes the existing full-squad return command")
	await step(90)
	await frames(10)
	check(app.state == "result", "Real walking, bus preparation and door closing reach settlement")
	await capture("world-08-settlement")
	await click(app.screen.confirm_button)
	check(app.state == "shelter" and app.mission == null, "Settlement confirmation returns to Camp and disposes expedition")
	check(app.campaign.data.day == 2 and app.campaign.data.history.size() == 1, "Expedition settles exactly once and advances the day")
	check(app.campaign.data.members == members and app.campaign.data.specialization == specialty, "Member and specialization state survive the round trip")
	for item: Dictionary in inventory:
		check(item in app.campaign.data.inventory, "Existing equipment is preserved, alongside valid specialization rewards")
	check(app.campaign.data.food == initial_food + collected_food - members.size(), "Collected food minus daily rations is committed")
	check(app.campaign.data.scrap == initial_scrap + collected_scrap, "Collected scrap is committed")
	check(app.store.read(app.campaign.valid_state).ok, "Resulting campaign save passes the existing validator")
	await capture("world-09-returned-camp")
	perf_frames.sort()
	var report := {"checks": checks, "failures": failures, "full_production_flow": failures.is_empty(),
		"median_frame_ms": perf_frames[perf_frames.size()/2], "p95_frame_ms": perf_frames[int(perf_frames.size()*.95)],
		"render_backend": RenderingServer.get_video_adapter_name(), "seed": app.catalog.map.base_seed,
		"validation": "Native Godot window, synthetic mouse/keyboard, time-compressed original simulation; no teleport, invincibility or forced completion"}
	FileAccess.open("res://test-output/world-runtime.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	app.free()
	await frames()
	print("WORLD MAP RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
