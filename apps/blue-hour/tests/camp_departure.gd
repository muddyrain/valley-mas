extends "res://tests/day_loop_runtime.gd"

var captures: Array[String] = []
var cases: Array[Dictionary] = []

func shot(label: String) -> void:
	if DisplayServer.get_name() == "headless" or label in captures:
		return
	captures.append(label)
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://test-output/camp-departure/" + label + ".png") == OK, "Actual 16:9 capture: " + label)

func run() -> void:
	create_timer(150).timeout.connect(func(): printerr("CAMP DEPARTURE TIMEOUT"); quit(2))
	root.size = Vector2i(1280, 720)
	root.content_scale_size = root.size
	root.unfocusable = true
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output/camp-departure")
	for case_index: int in range(4):
		var count: int = [1, 2, 4, 1][case_index]
		var forced_failure := case_index == 3
		await launch(true)
		app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing", "lin", "qiao"].slice(0, count))
		app.show_shelter()
		await frames(10)
		await click(button("整装出发"))
		await click(button("商业街"))
		var original_camp: Node3D = app.camp_view.camp
		var ambient: Dictionary = {}
		for resident: Node3D in original_camp.get_node("Characters").get_children():
			if not resident.is_in_group("camp_party_actor"):
				ambient[resident] = resident.global_transform
		if forced_failure:
			for actor: Node3D in original_camp.members.values():
				actor.agent.navigation_layers = 0
		await click_at(button("确认出发").get_global_rect().get_center())
		check(app.state == "departure", "Confirmation starts departure before mission construction")
		if app.state != "departure":
			break
		var locked: Dictionary = app.campaign.data.duplicate(true)
		var camp: Node3D = app.camp_view.camp
		check(camp == original_camp, "Selection and departure reuse the same frozen Camp instance")
		var controller: Node = camp.departure
		var selected: Array = app.selected_party.duplicate()
		app.start_mission("airdrop")
		app.show_today_action()
		app.select_member(selected[0])
		check(app.state == "departure" and app.selected_mission_id == "commercial", "Repeated start and camp interaction cannot change locked mission")
		var history: Array[String] = []
		var boarded: Array[String] = []
		var stage_times: Dictionary = {}
		var started := Time.get_ticks_msec()
		var safe_motion := true
		var ambient_stayed := true
		var largest_step := 0.0
		var last_positions: Dictionary = {}
		var vehicle_departed := [false]
		var fallback_reasons: Array[String] = []
		controller.fallback_used.connect(func(reason: String): fallback_reasons.append(reason))
		controller.state_changed.connect(func(value: String): history.append(value))
		controller.state_changed.connect(func(value: String):
			stage_times[value] = (Time.get_ticks_msec() - started) / 1000.0
			if value == "VEHICLE_STARTING":
				check(camp.members.values().all(func(actor: Node3D): return actor.boarded and not actor.visual.visible and actor.collision_layer == 0), "Engine waits until all visuals and Camp collisions are disabled")
			if value == "TRANSITIONING":
				vehicle_departed[0] = controller.vehicle_outside_camera)
		controller.member_boarded.connect(func(id: String): boarded.append(id))
		var deadline := Time.get_ticks_msec() + 35000
		while app.state == "departure" and Time.get_ticks_msec() < deadline:
			for actor: Node3D in camp.members.values():
				if last_positions.has(actor):
					largest_step = maxf(largest_step, actor.global_position.distance_to(last_positions[actor]))
				last_positions[actor] = actor.global_position
				if not actor.boarded:
					safe_motion = safe_motion and actor_clear(actor)
			for resident: Node3D in ambient:
				ambient_stayed = ambient_stayed and resident.visible and resident.global_transform.is_equal_approx(ambient[resident])
			if controller.stage == controller.Stage.DEPARTING:
				safe_motion = safe_motion and vehicle_clear(controller.vehicle)
			if count == 2 and controller.stage == controller.Stage.ASSEMBLING:
				await shot("01-main-station-camp")
			if count == 4:
				if controller.stage == controller.Stage.BOARDING:
					await shot("02-party-assembly")
					if controller.door_pause > 0 and boarded.is_empty():
						await shot("03-boarding")
				if controller.stage == controller.Stage.DEPARTING:
					if controller.elapsed > 0.65:
						await shot("04-leaving-berth")
					if controller.elapsed > 1.5:
						await shot("05-on-road")
					if controller.elapsed > 2.2:
						await shot("06-leaving-camp")
			await process_frame
		check(app.state == "mission", "%d members finish departure" % count)
		check(boarded == selected, "Only the selected members board, in order")
		check(history.has("BOARDING") and history.has("DEPARTING") and history.has("TRANSITIONING"), "Departure visits its observable stages")
		check(app.campaign.data == locked, "Camp performance preserves all campaign data")
		check(ambient_stayed and ambient.size() == 4 - count, "Nonparticipating camp residents stay visible at their original positions")
		check(vehicle_departed[0], "Entire vehicle leaves the fixed camera before fading")
		check(safe_motion, "Characters and departing bus never overlap a static wall or each other")
		check(not fallback_reasons.is_empty() if forced_failure else fallback_reasons.is_empty(), "Only the forced navigation failure uses correction")
		if not forced_failure:
			check(largest_step < 0.5, "Normal departure uses continuous character movement")
		if app.state == "mission":
			check(app.mission.survivors.size() == count, "Locked party reaches mission")
			check(app.campaign.data.selected_action == "commercial", "Original loader receives selected mission")
			check(app.mission.survivors.map(func(actor: Node3D): return actor.data.id) == selected, "Mission preserves member identities and queue order")
			check(app.mission.catalog.map.id == "commercial", "Original Mission setup receives the locked map resource")
		cases.append({"members": count, "forced_failure": forced_failure, "stages_seconds": stage_times, "warnings": fallback_reasons, "largest_frame_step": largest_step, "static_collision_clear": safe_motion})
		print("DEPARTURE CASE: ", cases.back())
		await frames(5)
	var report := FileAccess.open("res://test-output/camp-departure/runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "cases": cases, "captures": captures}, "\t"))
	print("CAMP DEPARTURE: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(5)
	quit(0 if failures.is_empty() else 1)

func actor_clear(actor: Node3D) -> bool:
	var query := PhysicsShapeQueryParameters3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.20
	shape.height = 1.35
	query.shape = shape
	query.transform = Transform3D(Basis.IDENTITY, actor.global_position + Vector3.UP * 0.9)
	query.collision_mask = 1
	return actor.get_world_3d().direct_space_state.intersect_shape(query).is_empty()

func vehicle_clear(vehicle: Node3D) -> bool:
	var query := PhysicsShapeQueryParameters3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(2.13, 2.32, 5.07)
	query.shape = shape
	query.transform = vehicle.global_transform * Transform3D(Basis.IDENTITY, Vector3(0, 1.3, 0))
	query.collision_mask = 3
	query.exclude = [vehicle.get_node("Collision").get_rid()]
	return vehicle.get_world_3d().direct_space_state.intersect_shape(query).is_empty()
