extends "res://tests/day_loop_runtime.gd"
## Production menu, Camp, empty return and continue flow through native synthetic input.

const MAIN_SCENE = preload("res://core/main.tscn")
const OUT := "res://test-output/p1-a-camp-state-20261020/"
var run_save: String = "user://test-runs/p1-a-camp-%d-%d.json" % [OS.get_process_id(), Time.get_ticks_usec()]
var observations: Array[Dictionary] = []

func wait_for_camp() -> void:
	var deadline: int = Time.get_ticks_msec() + 45000
	while Time.get_ticks_msec() < deadline:
		if app.state == "shelter" and not is_instance_valid(app.continue_loading):
			await frames(8)
			return
		await process_frame
	check(false, "Camp becomes ready before deadline: " + str(app.state))

func launch(_fresh: bool) -> void:
	if is_instance_valid(app):
		app.queue_free()
		await frames(8)
	app = MAIN_SCENE.instantiate()
	app.save_path = run_save
	root.add_child(app)
	await frames(12)
	check(app.state == "menu", "Normal scene startup opens title menu")

func create_from_menu() -> void:
	await click(app.screen.menu_buttons[0])
	var deadline: int = Time.get_ticks_msec() + 12000
	while app.state != "new_game" and Time.get_ticks_msec() < deadline:
		await process_frame
	check(app.state == "new_game", "New-game transition reaches specialization selection")
	await create_timer(0.7).timeout
	await click(app.screen.confirm_button)
	var confirmation: Control = app.screen.get_node_or_null("NewRunConfirmation") if app.state == "new_game" else null
	if confirmation != null:
		await click(confirmation.create_run_button)
	await wait_for_camp()

func verify_state(food: int, scrap: int, day: int, context: String) -> void:
	var hud: Control = app.camp_ui
	var actual_food: String = hud.get_node("M03_ResourceBar/ResourceFood/Value").text
	var actual_scrap: String = hud.get_node("M03_ResourceBar/ResourceScrap/Value").text
	var actual_day: String = hud.get_node("M01_CampIdentity/CampInfoPanel/DayCn").text
	check(actual_food == str(food) and int(app.campaign.data.food) == food, context + ": HUD and Campaign food agree")
	check(actual_scrap == str(scrap) and int(app.campaign.data.scrap) == scrap, context + ": HUD and Campaign scrap agree")
	check(actual_day == "第 %d 天" % day and int(app.campaign.data.day) == day, context + ": HUD and Campaign day agree")
	check(hud.get_node("M01_CampIdentity/CampInfoPanel/DayEn").text == "DAY %02d" % day, context + ": English date agrees")
	var saved: Dictionary = app.store.read(app.campaign.valid_state)
	check(saved.ok and int(saved.data.food) == food and int(saved.data.scrap) == scrap and int(saved.data.day) == day, context + ": save agrees")
	observations.append({"context": context, "food": food, "scrap": scrap, "day": day, "history_count": app.campaign.data.history.size(), "viewport": [root.size.x, root.size.y]})

func capture(id: String) -> void:
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	check(screenshot.get_size() == root.size, "Native screenshot has the actual window dimensions")
	check(screenshot.save_png(OUT + id + ".png") == OK, "Captured " + id)
	var viewport_rect := Rect2(Vector2.ZERO, Vector2(root.size))
	for path: String in ["M03_ResourceBar/ResourceFood/Value", "M03_ResourceBar/ResourceScrap/Value", "M01_CampIdentity/CampInfoPanel/DayEn", "M01_CampIdentity/CampInfoPanel/DayCn", "M01_CampIdentity/CampInfoPanel/DescriptionLine1", "M01_CampIdentity/CampInfoPanel/DescriptionLine2"]:
		var label: Label = app.camp_ui.get_node(path)
		check(viewport_rect.encloses(label.get_global_rect()), "State text stays in the viewport: " + path)
		check(label.get_line_count() == 1 and label.get_minimum_size().x <= label.size.x, "State text fits without truncation: " + path)

func empty_sortie() -> void:
	await click(app.camp_ui.get_node("M08_DepartAction/Entry"))
	await create_timer(0.7).timeout
	check(app.state == "today_action", "Camp opens today's action")
	await click(app.screen.cards.residential)
	await click(app.screen.confirm_button)
	check(app.state == "mission" and app.mission.map_provider == "MEDIUM_TOWN_V1", "Confirmed production destination loads Town")
	check(not app.mission.invincible and app.mission.director_enabled, "Return uses normal damage and the live director")
	var mission: Node3D = app.mission
	await key(KEY_E)
	var deadline: int = Time.get_ticks_msec() + 75000
	while app.state == "mission" and Time.get_ticks_msec() < deadline:
		await process_frame
	check(app.state == "result", "E orders a real walk, boarding and return")
	if app.state != "result":
		return
	check(not mission.active and not app.campaign.data.pending.wiped, "Live squad returns normally")
	check(app.campaign.data.pending.food == 0 and app.campaign.data.pending.scrap == 0, "Empty sortie carries no injected resources")
	await frames(8)
	await click(app.screen.confirm_button)
	await wait_for_camp()

func run() -> void:
	create_timer(220.0).timeout.connect(func() -> void: printerr("CAMP CAMPAIGN RUNTIME TIMEOUT"); quit(2))
	root.unfocusable = true
	root.content_scale_size = Vector2i.ZERO
	root.size = Vector2i(1600, 900)
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(OUT)
	await launch(false)
	await create_from_menu()
	verify_state(6, 0, 1, "Actual new run")
	await capture("new-run-1600x900")
	var before: Dictionary = app.campaign.data.duplicate(true)
	var before_save: String = FileAccess.get_file_as_string(run_save)
	for iteration: int in 20:
		app.camp_ui.refresh_campaign_state()
		app.camp_ui.set_hud_visible(false)
		app.camp_ui.set_hud_visible(true)
	check(app.campaign.data == before, "Repeated native refresh never changes the run")
	check(FileAccess.get_file_as_string(run_save) == before_save, "Repeated native refresh never writes the save")
	var camp: Node3D = app.camp_view
	await click(app.camp_ui.get_node("M08_DepartAction/Entry"))
	await create_timer(0.7).timeout
	await click(app.screen.cards.commercial)
	await click(app.screen.cancel_button)
	await create_timer(0.5).timeout
	check(app.state == "shelter" and app.camp_view == camp, "Cancel returns to the same Camp")
	check(app.campaign.data == before and FileAccess.get_file_as_string(run_save) == before_save, "Browse and cancel preserve the run and save")
	verify_state(6, 0, 1, "After today's-action cancel")
	await empty_sortie()
	verify_state(4, 0, 2, "Real Day 1 empty return")
	check(app.campaign.data.history.size() == 1, "Real return is committed only once")
	await capture("day-two-1600x900")
	root.size = Vector2i(1024, 640)
	await frames(12)
	verify_state(4, 0, 2, "Minimum window")
	await capture("day-two-1024x640")
	root.size = Vector2i(1600, 900)
	await frames(8)
	await launch(false)
	await click(app.screen.menu_buttons[1])
	await wait_for_camp()
	verify_state(4, 0, 2, "Actual continue after scene reload")
	await capture("continued-1600x900")
	await empty_sortie()
	verify_state(2, 0, 3, "Consecutive real return")
	check(app.campaign.data.history.size() == 2, "Consecutive return keeps exactly two history entries")
	await key(KEY_ESCAPE)
	check(app.state == "menu", "Camp Escape returns to title menu")
	await create_from_menu()
	verify_state(6, 0, 1, "Actual replacement new run")
	check(app.campaign.data.history.is_empty(), "Replacement run has no previous history")
	# Hunger is a controlled display fixture; real empty return and continue above use production input.
	app.campaign.data.food = 0
	app.campaign.data.scrap = 27
	app.campaign.data.hunger = 1
	app.campaign.data.day = 4
	check(app._save(), "Controlled hunger display fixture saves")
	app.show_shelter()
	await frames(12)
	verify_state(0, 27, 4, "Controlled hunger display")
	check(app.camp_ui.get_node("M01_CampIdentity/CampInfoPanel/DescriptionLine2").text == "生命上限 80%", "Native hunger text follows the rules")
	await capture("hunger-1600x900")
	root.size = Vector2i(1024, 640)
	await frames(12)
	await capture("hunger-1024x640")
	FileAccess.open(OUT + "runtime-report.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "observations": observations, "method": "native main.tscn with synthetic input; normal production empty returns and continue; separately labelled hunger fixture", "save_path": run_save}, "\t"))
	print("CAMP CAMPAIGN RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(8)
	quit(0 if failures.is_empty() else 1)
