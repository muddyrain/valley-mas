extends "res://tests/day_loop_runtime.gd"
## Real campaign departure and production encounter loop in an isolated native viewport.
var mission: Node3D
var milestones: Dictionary = {}
var noise_chain: bool = false
var daytime_search_fight: bool = false
var visible_horde: bool = false
var initial_positions: Dictionary = {}
var first_shot: float = -1
var capturing_noise: bool = false

func run() -> void:
	root.unfocusable = true
	root.add_child(InputGate.new())
	create_timer(240).timeout.connect(func(): printerr("ENCOUNTER RUNTIME TIMEOUT"); quit(2))
	app = load("res://core/main.tscn").instantiate()
	app.save_path = "user://test-runs/encounter-runtime-%d.json" % Time.get_ticks_usec()
	app.fresh_test_run = true
	root.add_child(app)
	await frames(8)
	app.campaign.new_run(319762786, "", ["lin_jianyue", "lu_qinghe", "shen_yanchuan"])
	app._save()
	app.show_shelter()
	await frames(6)
	await click(app.screen.departure)
	await click(app.screen.cards.commercial)
	await click(app.screen.confirm_button)
	check(app.state == "mission", "Formal selection, camp boarding and departure load Expedition")
	mission = app.mission
	mission.set_physics_process(false)
	check(mission.arrival.finished and mission.survivors.size() == 3 and mission.survivors.all(func(member: Node3D): return not member.boarding), "Three real survivors disembark before player control")
	check(mission.enemies.size() >= 18, "Population exists on actual mission entry")
	check(not mission.invincible and mission.director_enabled, "Story uses normal combat damage and the live director")
	for enemy: Node3D in mission.enemies:
		initial_positions[enemy.get_instance_id()] = enemy.position
	mission.noise.noise_emitted.connect(_observe_noise)
	var first_deadline: float = mission.action_elapsed + 20
	while mission.active and mission.action_elapsed < first_deadline and first_shot < 0:
		await step()
	check(first_shot >= 5 and first_shot <= 15, "First real shot occurs in the desired opening window (%.2fs)" % first_shot)
	await shot("encounter-day-initial")
	check(mission.enemies.any(func(enemy: Node3D): return enemy.state in [enemy.State.IDLE, enemy.State.WANDER]), "Remote infected remain unaware during the opening fight")
	var moved: bool = false
	for enemy: Node3D in mission.enemies:
		if initial_positions.has(enemy.get_instance_id()) and enemy.position.distance_to(initial_positions[enemy.get_instance_id()]) > .5:
			moved = true
	check(moved, "Infected use actual world navigation")
	await simulate(16)
	check(mission.kills > 0, "Automatic attacks kill production infected")
	var site_id: String = _encounter_site()
	var entry: Vector3 = mission.city.sites[site_id].spec.entry
	mission.command_search(site_id)
	mission.command_reassign(2)
	while mission.active and mission.action_elapsed < 120 and not mission.city.sites[site_id].searched:
		await step()
		if not daytime_search_fight and mission.search_tasks.has(site_id) and mission.search_tasks[site_id].phase == mission.search_tasks[site_id].Phase.DEFEND:
			daytime_search_fight = true
			mission.camera_controller.following = false
			mission.camera_center = mission.search_tasks[site_id].worker.position
			mission.camera_controller.apply()
			await shot("encounter-day-search-combat")
			mission.command_move(entry + Vector3(0, 0, -3))
	check(mission.city.sites[site_id].searched, "Squad completes building search through the existing task system")
	if not daytime_search_fight:
		await shot("encounter-day-search-combat")
	check(noise_chain, "Real weapon noise attracts previously unaware listeners")
	check(mission.ledger.food + mission.ledger.scrap > 0, "World loot is picked up")
	while mission.active and not mission.clock.warning_active:
		await step()
	check(mission.active and mission.clock.warning_active, "Natural mission clock reaches warning")
	await shot("encounter-blue-warning")
	while mission.active and mission.encounter.blue_hour_spawned < 4:
		await step()
	check(mission.active and mission.clock.phase != mission.clock.DAY and mission.encounter.blue_hour_spawned >= 4, "Natural blue hour starts edge horde waves")
	var horde_deadline: float = mission.action_elapsed + 80
	while mission.active and mission.action_elapsed < horde_deadline and not visible_horde:
		await step()
		var visible_group: Array[Node3D] = []
		for enemy: Node3D in mission.enemies:
			if enemy.active and enemy.get_meta("encounter_origin", "") == "horde" and enemy.visible:
				visible_group.append(enemy)
		visible_horde = visible_group.size() >= 3
		if visible_horde:
			mission.camera_center = mission.squad_center().lerp(visible_group[0].position, .5)
			mission.camera_controller.apply()
	check(visible_horde, "A real edge-spawned horde reaches the squad's visible play space")
	await shot("encounter-blue-horde")
	# Low-population replenishment is covered separately; a short route need not deplete the map.
	check(daytime_search_fight, "Building dispatch experiences live combat pressure")
	milestones["before_return"] = snapshot()
	mission.command_extract()
	var return_deadline: float = mission.action_elapsed + 100
	while mission.active and mission.action_elapsed < return_deadline:
		await step()
	check(not mission.active and app.campaign.data.status == "pending" and not app.result.wiped, "Living squad returns, boards and commits one settlement")
	await frames(5)
	await capture("encounter-return")
	var report := {"mode": DisplayServer.get_name(), "method": "Native isolated campaign; actual UI departure, production commands and 30 Hz world steps; normal damage, no teleport, no injected enemies, no forced clock phases", "first_shot_seconds": first_shot, "checks": checks, "failures": failures, "noise_chain": noise_chain, "search_defense": daytime_search_fight, "visible_horde": visible_horde, "milestones": milestones, "result": app.result}
	FileAccess.open("res://test-output/encounter-runtime.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("ENCOUNTER RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	app.free()
	await frames()
	quit(0 if failures.is_empty() else 1)

func _encounter_site() -> String:
	var best: float = INF
	var selected_id: String = "arrival_house"
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		if site.vehicle:
			continue
		var entry: Vector3 = site.spec.entry
		for enemy: Node3D in mission.enemies:
			if not enemy.active:
				continue
			var score: float = entry.distance_to(enemy.position) * 5 + entry.distance_to(mission.squad_center())
			if score < best:
				best = score
				selected_id = id
	return selected_id

func step() -> void:
	while capturing_noise:
		await process_frame
	mission._physics_process(1.0 / 30)
	if first_shot < 0 and int(mission.noise.counts.get("PISTOL", 0)) + int(mission.noise.counts.get("RIFLE", 0)) > 0:
		first_shot = mission.action_elapsed
	await process_frame

func simulate(seconds: float) -> void:
	var until: float = mission.action_elapsed + seconds
	while mission.active and mission.action_elapsed < until:
		await step()

func _observe_noise(event: RefCounted) -> void:
	if event.noise_type not in [mission.noise.Event.NoiseType.PISTOL, mission.noise.Event.NoiseType.RIFLE, mission.noise.Event.NoiseType.SHOTGUN]:
		return
	if event.awakened <= 0 or noise_chain:
		return
	var listener: Node3D
	var farthest: float = mission.catalog.map.encounter.visual_range_day + 3
	for enemy: Node3D in mission.enemies:
		if enemy.heard_serial == event.serial and enemy.target == null and enemy.position.distance_to(mission.squad_center()) > farthest:
			listener = enemy
			farthest = enemy.position.distance_to(mission.squad_center())
	if listener != null:
		noise_chain = true
		mission.encounter_debug.selected = listener
		capturing_noise = true
		capture_noise.call_deferred()

func capture_noise() -> void:
	await key(KEY_F3)
	check(mission.encounter_debug.visible and mission.time_scale == 1, "F3 inspector is live and does not pause combat")
	await shot("encounter-gunshot-noise")
	await key(KEY_F3)
	check(not mission.encounter_debug.visible, "F3 closes diagnostic geometry")
	capturing_noise = false

func shot(id: String) -> void:
	milestones[id] = snapshot()
	await frames(3)
	await capture(id)

func snapshot() -> Dictionary:
	var state_counts: Dictionary = {}
	for enemy: Node3D in mission.enemies:
		var state_name: String = enemy.State.keys()[enemy.state]
		state_counts[state_name] = int(state_counts.get(state_name, 0)) + 1
	return {"seconds": mission.action_elapsed, "phase": mission.clock.encounter_phase_name(), "alive": mission.enemies.size(), "kills": mission.kills, "day_spawn": mission.encounter.daytime_spawned, "horde_spawn": mission.encounter.blue_hour_spawned, "noise_counts": mission.noise.counts.duplicate(), "states": state_counts, "health": mission.survivors.map(func(member: Node3D): return member.hp)}
