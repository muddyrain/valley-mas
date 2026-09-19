extends "res://tests/day_loop_runtime.gd"
## Current menu transitions and real Camp departure, with both formal survivors.
const PUBLIC = preload("res://assets/animations/public_locomotion/public_locomotion.tres")
const OUTPUT: String = "res://test-output/survivor-production/flow"

func wait_state(value: String, seconds: float = 30.0) -> bool:
	var deadline := Time.get_ticks_msec() + int(seconds * 1000)
	while app.state != value and Time.get_ticks_msec() < deadline:
		await process_frame
	check(app.state == value, "Current App enters " + value)
	return app.state == value

func shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(OUTPUT + "/" + name + ".png")

func run() -> void:
	create_timer(150).timeout.connect(func(): printerr("PRODUCTION FLOW TIMEOUT"); quit(2))
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	root.size = Vector2i(1600, 900)
	root.add_child(InputGate.new())
	app = load("res://core/main.gd").new()
	app.fresh_test_run = true
	app.save_path = "user://test-runs/production-flow-%d.json" % OS.get_process_id()
	root.add_child(app)
	await frames(10)
	app.show_main_menu()
	await frames(8)
	await shot("main-menu")
	await click(app.screen.menu_buttons[0])
	if not await wait_state("new_game"):
		quit(1)
		return
	await click(app.screen.tabs.scavenge)
	check(app.screen.selected == "scavenge", "Skill selection receives input")
	await shot("skill-selection")
	# Deterministic accepted party; same campaign constructor as new-run gameplay.
	app.campaign.new_run(4101, "scavenge", ["xia_zhiyao", "su_wanxing"])
	check(app._save(), "Isolated campaign save")
	app.show_main_menu()
	await frames(6)
	await click(app.screen.menu_buttons[1])
	check(app.state == "loading_continue", "Continue shows real Loading")
	await shot("loading")
	if not await wait_state("shelter", 45.0):
		quit(1)
		return
	while is_instance_valid(app.continue_loading):
		await process_frame
	await frames(12)
	check(app.camp_view.camp.members.size() == 2, "Both formal survivors spawn in Camp")
	for id: String in ["xia_zhiyao", "su_wanxing"]:
		var actor: Node3D = app.camp_view.camp.members[id]
		check(actor.visual.data.id == id, "Camp identity " + id)
		check(actor.visual.animation_controller.player.get_animation_library(&"Public") == PUBLIC, "Camp public library " + id)
		app.select_member(id)
		check(app.selected_member == id, "Camp selection " + id)
		check(app.camp_ui.selected_survivor_id == id and actor.visual.selection_ring.visible, "World selection reaches HUD and ground ring " + id)
	await shot("camp")
	await click_at(app.camp_ui.get_node("M08_DepartAction/Entry").get_global_rect().get_center())
	if not await wait_state("today_action"):
		quit(1)
		return
	await create_timer(.7).timeout
	await click_at(app.screen.cards.commercial.get_global_rect().get_center())
	await create_timer(.3).timeout
	check(app.screen.selected_id == "commercial", "Mission selection receives input")
	await shot("mission-selection")
	await click_at(app.screen.confirm_button.get_global_rect().get_center())
	if not await wait_state("mission", 60.0):
		quit(1)
		return
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	await wait_for_departure()
	check(app.mission.survivors.size() == 2, "Both selected survivors arrive in Expedition")
	for member: Node3D in app.mission.survivors:
		check(member.animation_controller.player.get_animation_library(&"Public") == PUBLIC, "Expedition public library " + member.data.id)
	await shot("expedition")
	FileAccess.open(OUTPUT + "/result.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("SURVIVOR PRODUCTION FLOW: ", checks, " checks; ", failures)
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
