extends "res://tests/camp_departure.gd"

class MotionProbe extends Node:
	var actors: Array[Node3D] = []
	var positions: Dictionary = {}
	var largest_step := 0.0
	func _physics_process(_delta: float) -> void:
		for actor: Node3D in actors:
			if not is_instance_valid(actor):
				continue
			if positions.has(actor):
				largest_step = maxf(largest_step, actor.global_position.distance_to(positions[actor]))
			positions[actor] = actor.global_position

func run() -> void:
	create_timer(160).timeout.connect(func(): printerr("CAMP INTERACTION TIMEOUT"); quit(2))
	root.size = Vector2i(1920, 1080)
	root.content_scale_size = Vector2i(1600, 900)
	root.unfocusable = true
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output/camp-interaction")
	await launch(true)
	app.save_path = "user://test-runs/camp-interaction.json"
	app.campaign.new_run(772, "combat", ["xia_zhiyao", "su_wanxing", "lin", "qiao"])
	app.campaign.data.food = 30
	app.show_shelter()
	await frames(15)
	check(app.get("camp_ui") != null, "Camp has a persistent HUD root")
	if app.get("camp_ui") == null:
		quit(1)
		return
	var camp: Node3D = app.camp_view.camp
	var camera: Transform3D = app.camp_view.camera.global_transform
	var identity := camp.get_instance_id()
	check(app.camp_view.find_children("*", "SubViewport", true, false).is_empty(), "Camp renders in the main viewport")
	check(button("调试 [F1]") == null and button("今日行动") != null, "Light HUD exposes the action and hides developer controls")
	await interaction_shot("01-camp-normal")
	for id: String in ["xia_zhiyao", "su_wanxing"]:
		await click_at(app.camp_view.member_point(id))
		check(app.selected_member == id and app.camp_ui.drawer.is_visible_in_tree(), "World actor opens the matching survivor drawer: " + id)
	await interaction_shot("02-survivor-drawer")
	await key(KEY_ESCAPE)
	for shortcut: String in ["备用装备", "武器", "道具与技能"]:
		await click(button("菜单"))
		await click(button(shortcut))
		check(app.camp_view.interaction_locked, "Modal blocks world input: " + shortcut)
		await key(KEY_ESCAPE)
		check(not app.camp_view.interaction_locked, "Escape closes the top overlay: " + shortcut)
	for id: String in ["main_station", "workshop", "greenhouse", "blue_hour"]:
		await click_at(app.camp_view.interactable_point(id))
		check(app.camp_ui.active_interactable.id == id, "Facility root picking resolves its descriptor: " + id)
		await key(KEY_ESCAPE)
	for count: int in [1, 2, 4]:
		if count != 1:
			app._clear_mission()
			app.campaign.new_run(772, "combat", ["xia_zhiyao", "su_wanxing", "lin", "qiao"])
			app.campaign.data.food = 30
			app.show_shelter()
			await frames(15)
			camp = app.camp_view.camp
			identity = camp.get_instance_id()
		await click(button("今日行动"))
		var draft: Control = app.screen
		await click(draft.cards.commercial)
		for id: String in app.campaign.data.members.slice(count):
			await click(draft.party_buttons[id])
		check(draft.selected_party.size() == count, "Actual party selection chooses %d members" % count)
		if count == 1:
			await click(draft.party_buttons.xia_zhiyao)
			check(draft.selected_party.is_empty() and draft.confirm_button.disabled, "An empty party cannot confirm departure")
			await click(draft.party_buttons.xia_zhiyao)
			await interaction_shot("03-today-action-overlay")
			await key(KEY_ESCAPE)
			check(app.camp_view.camp.get_instance_id() == identity and app.camp_view.camera.global_transform == camera, "Cancelling preserves the Camp and camera")
			check(app.campaign.data.selected_party.size() == 4, "Cancelling discards party draft")
			await click(button("今日行动"))
			draft = app.screen
			await click(draft.cards.commercial)
			for id: String in app.campaign.data.members.slice(count):
				await click(draft.party_buttons[id])
		var started := Time.get_ticks_msec()
		await click_at(draft.confirm_button.get_global_rect().get_center())
		check(app.state == "departure" and app.camp_view.camp.get_instance_id() == identity, "Confirm departs in the exact same camp")
		var controller: Node = camp.departure
		var probe := MotionProbe.new()
		root.add_child(probe)
		probe.actors.assign(camp.members.values())
		var stage_times: Dictionary = {}
		controller.state_changed.connect(func(value: String): stage_times[value] = (Time.get_ticks_msec() - started) / 1000.0)
		var residents: Dictionary = {}
		for id: String in app.campaign.data.members.slice(count):
			residents[id] = camp.members[id].global_transform
		var motion_clear := true
		var hud_alive := true
		var remained := true
		var outside := [false]
		controller.state_changed.connect(func(value: String):
			if value == "TRANSITIONING":
				outside[0] = controller.vehicle_outside_camera)
		if count == 1:
			await create_timer(0.2).timeout
			await interaction_shot("04-mission-confirmed")
		var locked: Dictionary = app.campaign.data.duplicate(true)
		app.start_mission("airdrop")
		app.show_today_action()
		app.select_member(app.campaign.data.members.back())
		app.show_main_menu()
		await key(KEY_ESCAPE)
		check(app.state == "departure" and app.campaign.data == locked, "Repeated input cannot interrupt the locked departure")
		while app.state == "departure":
			hud_alive = hud_alive and app.camp_ui.hud_root.is_visible_in_tree() and app.camp_ui.departure.disabled
			for id: String in residents:
				remained = remained and camp.members[id].global_transform.is_equal_approx(residents[id]) and camp.members[id].visual.visible
			for actor: Node3D in controller.actors:
				if not actor.boarded:
					motion_clear = motion_clear and actor_clear(actor)
			if controller.stage == controller.Stage.DEPARTING:
				motion_clear = motion_clear and vehicle_clear(controller.vehicle)
			if count == 4:
				if controller.stage in [controller.Stage.ASSEMBLING, controller.Stage.BOARDING] and controller.elapsed > 0.25 and controller.actors.any(func(actor: Node3D): return actor.moving):
					await interaction_shot("05-party-moving")
				if controller.stage == controller.Stage.BOARDING and controller.door_pause > 0:
					await interaction_shot("06-boarding")
				if controller.stage == controller.Stage.DEPARTING and controller.elapsed > 0.7:
					await interaction_shot("07-blue-hour-departing")
			await process_frame
		var seconds := (Time.get_ticks_msec() - started) / 1000.0
		check(app.state == "mission" and app.mission.survivors.size() == count and app.mission.catalog.map.id == "commercial", "Chosen party and mission load correctly")
		check(hud_alive and remained and outside[0], "HUD persists; residents stay; bus exits before fade")
		check(probe.largest_step < 0.15 and motion_clear, "Departure is continuous and static collisions stay clear")
		cases.append({"members": count, "seconds": seconds, "largest_step": probe.largest_step, "motion_clear": motion_clear, "stages_seconds": stage_times})
		probe.queue_free()
		print("INTERACTION DEPARTURE: ", cases.back())
		await frames(30)
		if count == 1:
			app.mission.director_enabled = false
			app.mission.debug_clear_enemies()
			app.mission._finish(false)
			await frames(8)
			check(app.state == "result", "A real solo Mission accepts its partial-party result")
			app.return_to_shelter()
			await frames(8)
			check(app.state == "shelter" and app.campaign.data.members.size() == 4 and app.campaign.data.day == 2, "Real return preserves all three residents and advances one day")
	var report := FileAccess.open("res://test-output/camp-interaction/runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "cases": cases}, "\t"))
	print("CAMP INTERACTION: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(5)
	quit(0 if failures.is_empty() else 1)

func interaction_shot(label: String) -> void:
	if label in captures:
		return
	captures.append(label)
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://test-output/camp-interaction/" + label + ".png") == OK, "Actual 16:9 capture: " + label)
