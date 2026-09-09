extends "res://tests/runtime.gd"

func mouse(point: Vector2, relative: Vector2 = Vector2.ZERO) -> void:
	var event := InputEventMouseMotion.new()
	event.device = 42
	event.position = point
	event.relative = relative
	root.push_input(event, true)
	await process_frame

func mouse_button(point: Vector2, code: MouseButton, pressed: bool) -> void:
	var event := InputEventMouseButton.new()
	event.device = 42
	event.position = point
	event.button_index = code
	event.pressed = pressed
	root.push_input(event, true)
	await process_frame

func held_key(code: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.device = 42
	event.physical_keycode = code
	event.keycode = code
	event.pressed = pressed
	root.push_input(event, true)
	await process_frame

func run() -> void:
	create_timer(90).timeout.connect(func(): printerr("CONTROLS TIMEOUT"); quit(2))
	root.unfocusable = true
	app = load("res://core/main.gd").new()
	app.save_path = "user://test-runs/controls-03.json"
	app.fresh_test_run = true
	root.add_child(app)
	root.add_child(InputGate.new())
	await frames(12)
	await click_button("整装出发")
	var mission = app.mission
	mission.director_enabled = false
	mission.debug_clear_enemies()
	await frames(12)
	var first: Vector2 = mission.camera.unproject_position(Vector3(0, 0, 10))
	var second: Vector2 = mission.camera.unproject_position(Vector3(4, 0, 8))
	await mouse(first)
	await mouse_button(first, MOUSE_BUTTON_LEFT, true)
	await mouse(second, second - first)
	await wait_seconds(0.2)
	check(mission.rally_point.distance_to(Vector3(4, 0, 8)) < 1.5, "Held left button continuously updates the ground rally point")
	var rally: Vector3 = mission.rally_point
	var ui_point: Vector2 = app.hud.site_buttons.corner.get_global_rect().get_center()
	await mouse(ui_point)
	await mouse_button(ui_point, MOUSE_BUTTON_LEFT, false)
	await mouse(first)
	await wait_seconds(0.15)
	check(mission.rally_point == rally and not mission.controls.following, "Releasing left over UI ends continuous movement")
	# A press on a search entrance must never turn into ground steering while held.
	var entry: Vector2 = mission.camera.unproject_position(mission.city.sites.corner.spec.entry + Vector3.UP)
	await mouse(entry)
	await mouse_button(entry, MOUSE_BUTTON_LEFT, true)
	await mouse(second, second - entry)
	await wait_seconds(0.15)
	check(mission.search_tasks.has("corner") and not mission.controls.following and mission.rally_point == rally, "Dragging from an entrance preserves search without starting follow")
	await mouse_button(second, MOUSE_BUTTON_LEFT, false)
	await click(app.hud.site_buttons.van_south.get_global_rect().get_center())
	await click(app.hud.site_buttons.garage.get_global_rect().get_center())
	check(mission.search_tasks.size() == 3 and mission.guards().is_empty(), "Actual site buttons dispatch three independent workers")
	for id in mission.search_tasks:
		mission.search_tasks[id].worker.position = mission.city.sites[id].spec.entry
	await wait_seconds(0.3)
	check(mission.search_tasks.keys().all(func(id): return mission.city.sites[id].progress > 0), "All three searches advance through live physics")
	check(app.hud.squad_heading.text.contains("搜索 3") and not app.hud.site_buttons.corner.disabled, "HUD shows three tasks and keeps active sites selectable")
	await capture("20-parallel-search")
	var canceled = mission.search_tasks.corner.worker
	await click(entry)
	check(mission.search_tasks.size() == 2 and not mission.search_tasks.has("corner"), "Clicking a busy world entrance cancels only that search")
	await click(app.hud.site_buttons.van_south.get_global_rect().get_center())
	check(mission.search_tasks.size() == 2 and mission.search_id == "van_south", "Sidebar inspection does not cancel an active task")
	await click(app.hud.assign_buttons[mission.survivors.find(canceled)].get_global_rect().get_center())
	check(mission.search_tasks.van_south.worker == canceled, "Actual selected-task action reassigns to a free survivor")
	await key(KEY_R)
	check(mission.search_tasks.is_empty() and mission.guards().size() == 3, "R recalls all current workers")
	mission.command_stop()
	for i in range(3):
		mission.survivors[i].position = Vector3(i * 2, 0, 12)
		mission.survivors[i].cooldown = 0
	var gunner = mission.survivors[0]
	var origin: Vector3 = gunner.position
	var ammo: int = gunner.ammo
	await mouse(mission.camera.unproject_position(Vector3(0, 0, 0)))
	await held_key(KEY_CTRL, true)
	await wait_seconds(0.2)
	check(mission.manual_aim and gunner.position == origin and gunner.ammo < ammo, "Holding Ctrl stops movement and fires toward the actual cursor")
	await capture("21-directed-fire")
	await mouse(ui_point)
	await wait_seconds(0.1)
	check(not mission.manual_aim, "Aiming over UI suspends direct fire")
	await held_key(KEY_CTRL, false)
	await mouse(first)
	check(not mission.controls.aiming and not mission.manual_aim, "Ctrl release over UI clears aim without a stuck input")
	var center: Vector3 = mission.camera_center
	await held_key(KEY_W, true)
	await wait_seconds(0.15)
	await held_key(KEY_W, false)
	check(mission.camera_center.distance_to(center) > 0.5, "W moves the camera while held")
	mission.command_move(Vector3(0, 0, 8))
	center = mission.camera_center
	await held_key(KEY_S, true)
	await wait_seconds(0.15)
	await held_key(KEY_S, false)
	check(mission.camera_center.distance_to(center) > 0.5 and mission.order == "前往阵位", "S pans the camera without issuing the old stop command")
	center = mission.camera_center
	rally = mission.rally_point
	await mouse_button(first, MOUSE_BUTTON_RIGHT, true)
	await mouse(first + Vector2(60, 30), Vector2(60, 30))
	await mouse_button(ui_point, MOUSE_BUTTON_RIGHT, false)
	check(mission.camera_center.distance_to(center) > 1 and mission.rally_point == rally and not mission.controls.dragging, "Right drag pans without moving the squad and releases over UI")
	var zoom: float = mission.camera.size
	await mouse(first)
	await mouse_button(first, MOUSE_BUTTON_WHEEL_UP, true)
	await mouse_button(first, MOUSE_BUTTON_WHEEL_UP, false)
	check(mission.camera.size < zoom, "Wheel zoom remains available")
	await key(KEY_SPACE)
	var elapsed: float = mission.clock.elapsed
	origin = gunner.position
	await click(mission.camera.unproject_position(Vector3(0, 0, 3)))
	await wait_seconds(0.2)
	check(app.hud.paused and mission.clock.elapsed == elapsed and gunner.position == origin and not gunner.path.is_empty(), "Space pauses simulation while accepting a move order")
	await capture("22-tactical-pause")
	await key(KEY_F1)
	await key(KEY_F1)
	check(mission.time_scale == 0 and app.hud.paused, "Closing Debug preserves the existing tactical pause")
	await key(KEY_SPACE)
	await wait_seconds(0.2)
	check(mission.clock.elapsed > elapsed and gunner.position != origin, "Space resumes queued movement")
	await key(KEY_ESCAPE)
	check(app.hud.pause_menu.visible and not mission.input_enabled and mission.time_scale == 0, "Esc opens a blocking pause menu")
	rally = mission.rally_point
	await click(Vector2(330, 700))
	check(mission.rally_point == rally, "World clicks outside the pause menu cannot issue commands")
	await click(app.hud.site_buttons.corner.get_global_rect().get_center())
	check(mission.search_tasks.is_empty(), "Pause backdrop blocks underlying HUD commands")
	await capture("23-pause-menu")
	await key(KEY_ESCAPE)
	check(not app.hud.pause_menu.visible and mission.input_enabled and mission.time_scale > 0, "Esc closes the menu and restores mission control")
	await mouse(first)
	await mouse_button(first, MOUSE_BUTTON_LEFT, true)
	await held_key(KEY_D, true)
	mission.notification(Node.NOTIFICATION_WM_WINDOW_FOCUS_OUT)
	check(not mission.controls.following and mission.controls.keys.is_empty(), "Window focus loss clears held movement and camera inputs")
	await held_key(KEY_D, false)
	await mouse_button(first, MOUSE_BUTTON_LEFT, false)
	await key(KEY_X)
	check(mission.order.begins_with("停止"), "X provides the supplemental stop command")
	root.size = Vector2i(1024, 640)
	await frames(15)
	for id in ["corner", "van_south", "garage"]:
		mission.command_search(id)
	await frames(15)
	var panel_end: float = app.hud.rally_button.get_global_rect().end.y
	check(panel_end < app.hud.extract_button.get_global_rect().position.y, "Three task cards stay clear of bottom commands at the minimum window size")
	for id in mission.search_tasks:
		check(app.hud.site_buttons[id].get_global_rect().end.y < app.hud.extract_button.get_global_rect().position.y, "Active site fits above the command bar: " + id)
	await capture("24-parallel-small-window")
	var report := FileAccess.open("res://test-output/controls-runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("CONTROLS RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
