extends SceneTree

const MAIN := preload("res://core/main.tscn")
const OUTPUT := "res://test-output/camp-hud-skeleton/"
var failures: Array[String] = []
var checks: int = 0
var layouts: Array[Dictionary] = []

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	create_timer(90).timeout.connect(func(): quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-hud-skeleton.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var camp: Node3D = app.camp_view.camp
	var camera: Transform3D = app.camp_view.camera.global_transform
	var campaign_before: Dictionary = app.campaign.data.duplicate(true)
	check(app.state == "shelter", "Main entry reaches Camp")
	check(camp.get_node("WorldEnvironment") != null and app.camp_view.camera.current, "Existing Camp world and camera are active")
	for dimensions: Vector2i in [Vector2i(1600, 900), Vector2i(1280, 720), Vector2i(1024, 640), Vector2i(1920, 1080), Vector2i(2560, 1080)]:
		root.size = dimensions
		# Exercise actual Control resizing, including non-16:9 windows.
		root.content_scale_size = Vector2i.ZERO
		await frames(8)
		verify_layout(app.camp_ui, dimensions)
		if dimensions == Vector2i(1600, 900):
			await RenderingServer.frame_post_draw
			var screenshot: Image = root.get_texture().get_image()
			check(screenshot.get_size() == dimensions, "Native screenshot is exactly 1600x900")
			check(screenshot.save_png(OUTPUT + "camp-hud-1600x900.png") == OK, "Camp screenshot saved")
	check(app.campaign.data == campaign_before, "Static HUD never changes campaign data")
	root.size = Vector2i(1600, 900)
	await frames(4)
	var entry: Button = app.camp_ui.get_node("M08_DepartAction/Entry")
	await click(entry)
	await frames(20)
	check(app.state == "today_action" and app.camp_view.interaction_locked, "M08 opens the existing TodayAction workflow")
	check(not app.camp_ui.get_node("M05_SurvivorDetail").visible, "HUD yields to the existing overlay")
	await key(KEY_ESCAPE)
	await frames(20)
	check(app.state == "shelter" and not app.camp_ui.get_node("M05_SurvivorDetail").visible, "Escape preserves the unselected hidden detail")
	check(app.camp_view.camp == camp and app.camp_view.camera.global_transform == camera, "Overlay preserves Camp and camera")
	await key(KEY_F1)
	app.select_member(app.campaign.data.members[0])
	check(app.campaign.data == campaign_before, "Inactive placeholder controls do not mutate gameplay")
	await key(KEY_ESCAPE)
	check(app.state == "menu" and not is_instance_valid(app.camp_ui), "Existing Escape returns to the main menu")
	app.show_shelter()
	await frames(8)
	await click(app.camp_ui.get_node("M08_DepartAction/Entry"))
	await frames(20)
	await click(app.screen.cards.commercial)
	await click(app.screen.confirm_button)
	await frames(20)
	check(app.state == "departure", "Existing confirmation starts Camp departure")
	check(app.camp_ui.get_node("M08_DepartAction/Entry").disabled, "Departure locks the placeholder entry")
	var deadline := Time.get_ticks_msec() + 45000
	while app.state == "departure" and Time.get_ticks_msec() < deadline:
		await process_frame
	check(app.state == "mission" and is_instance_valid(app.mission), "Existing departure reaches Mission")
	var report := FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "layouts": layouts}, "\t"))
	print("CAMP HUD SKELETON: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)

func verify_layout(hud: Control, dimensions: Vector2i) -> void:
	var modules: Array[Node] = hud.get_children()
	check(modules.size() == 9, "Nine independent modules at " + str(dimensions))
	var screen_rect := Rect2(Vector2.ZERO, Vector2(dimensions))
	var rectangles: Dictionary = {}
	for index: int in range(modules.size()):
		var module := modules[index] as Control
		var rect := module.get_global_rect()
		var expected_visible: bool = module.name != "M05_SurvivorDetail" or hud.selected_survivor_id != null
		check(module.is_visible_in_tree() == expected_visible and screen_rect.encloses(rect), module.name + " expected visibility inside " + str(dimensions))
		rectangles[module.name] = [rect.position.x, rect.position.y, rect.size.x, rect.size.y]
		for other: Node in modules.slice(index + 1):
			check(not rect.intersects((other as Control).get_global_rect()), module.name + " does not overlap " + other.name)
		if module.name not in ["M01_CampIdentity", "M02_TimeStatus", "M03_ResourceBar", "M04_SurvivorRoster", "M05_SurvivorDetail", "M06_CampActionRail"]:
			check(module.find_children("*", "TextureRect", true, false).is_empty(), module.name + " has no artwork")
	var middle := Rect2(Vector2(dimensions) * Vector2(0.17, 0.15), Vector2(dimensions) * Vector2(0.49, 0.61))
	check(modules.all(func(module: Control) -> bool: return not module.get_global_rect().intersects(middle)), "Central world stays unobstructed at " + str(dimensions))
	layouts.append({"viewport": [dimensions.x, dimensions.y], "modules": rectangles})

func check(passed: bool, message: String) -> void:
	checks += 1
	if not passed:
		failures.append(message)
		push_error(message)

func frames(count: int) -> void:
	for index: int in range(count):
		await process_frame

func click(button: Button) -> void:
	for pressed: bool in [true, false]:
		var event := InputEventMouseButton.new()
		event.position = button.get_global_rect().get_center()
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		root.push_input(event, true)
		await process_frame

func key(code: Key) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = code
	event.pressed = true
	root.push_input(event, true)
	await process_frame
