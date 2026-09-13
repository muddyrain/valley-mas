extends "res://tests/day_loop_runtime.gd"
const DIRECTORY: String = "res://test-output/expedition-exploration"
var measurements: Array[Dictionary] = []
var maximum_anchor_error: float = 0.0
var stable_frames: int = 0

func shot(id: String) -> void:
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png(DIRECTORY + "/" + id + ".png") == OK, "Captured " + id)

func run() -> void:
	create_timer(900).timeout.connect(func(): quit(2))
	root.unfocusable = true
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(DIRECTORY)
	app = load("res://core/main.tscn").instantiate()
	app.save_path = "user://test-runs/exploration-%d.json" % Time.get_ticks_usec()
	root.add_child(app)
	await frames(12)
	await click(button("开始游戏"))
	await click(app.screen.tabs.scavenge)
	await click(app.screen.confirm_button)
	await click(app.screen.departure)
	await click(app.screen.cards.commercial)
	await click(app.screen.confirm_button)
	check(app.state == "mission", "Main Menu, New Game, Skill Route, Camp, Today Action and Camp departure reach Expedition")
	app.mission.time_scale = 0
	await frames(20)
	await shot("fog-start")
	app.mission.exploration.fog_mesh.hide()
	app.hud.hide()
	app.mission.camera_controller.following = false
	app.mission.camera_center = Vector3.ZERO
	app.mission.camera.size = 140
	app.mission.camera_controller.apply()
	await frames(4)
	await shot("city-layout")
	app.mission.camera.size = 35
	app.mission.camera_center = Vector3(-44, 0, 22)
	app.mission.camera_controller.apply()
	await frames(4)
	await shot("dense-residential")
	app.mission.camera_center = Vector3(-42, 0, -44)
	app.mission.camera_controller.apply()
	await frames(4)
	await shot("dense-commercial")
	app.mission.camera_center = Vector3(39, 0, -47)
	app.mission.camera_controller.apply()
	await frames(4)
	await shot("service-area")
	app.mission.camera.size = 25
	app.mission.center_squad()
	app.mission.exploration.fog_mesh.show()
	app.hud.show()
	app.mission.time_scale = 1
	# Focused presentation recordings isolate search/camera behavior. The separate
	# production runtime keeps the unmodified director and combat enabled throughout.
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	await _exercise_search()
	await _exercise_fog_and_return()
	FileAccess.open(DIRECTORY + "/runtime.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "stable_frames": stable_frames, "maximum_anchor_error_px": maximum_anchor_error, "frames": measurements, "recording_fps": 30, "search_camera_fixture": "Original timer and movement; director disabled for isolated presentation recording"}, "\t"))
	print("EXPLORATION RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	app.free()
	await frames()
	quit(0 if failures.is_empty() else 1)

func _mouse(code: MouseButton, down: bool, point: Vector2) -> void:
	var event := InputEventMouseButton.new()
	event.device = 42
	event.button_index = code
	event.pressed = down
	event.position = point
	root.push_input(event, true)

func _hold(code: Key, down: bool) -> void:
	var event := InputEventKey.new()
	event.device = 42
	event.physical_keycode = code
	event.keycode = code
	event.pressed = down
	root.push_input(event, true)

func _record_frame(clip: String, index: int) -> void:
	var folder: String = DIRECTORY + "/" + clip
	if index == 0:
		DirAccess.make_dir_recursive_absolute(folder)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_jpg(folder + "/%04d.jpg" % index, .92)
	var row: Dictionary = {"clip": clip, "frame": index, "time": app.mission.clock.elapsed, "discovered": app.mission.city.sites.values().filter(func(site: Dictionary): return site.discovered).size()}
	var context: Control = app.hud.poi_context
	if clip == "search-ui-stability" and context.displayed_id == "arrival_mid" and context._focus_card.visible:
		var card: PanelContainer = context._focus_card
		var anchor: Vector3 = app.mission.city.sites.arrival_mid.search_anchor.global_position
		var screen: Vector2 = context.get_global_transform().affine_inverse() * app.mission.camera.unproject_position(anchor)
		var residual: Vector2 = card.position + Vector2(card.size.x * .5, card.size.y + 12) - screen
		maximum_anchor_error = maxf(maximum_anchor_error, maxf(absf(residual.x), absf(residual.y)))
		stable_frames += 1
		row.merge({"error": [residual.x, residual.y], "width": card.size.x, "height": card.size.y})
	measurements.append(row)

func _exercise_search() -> void:
	await click(app.hud.site_buttons.arrival_house)
	check(app.mission.search_tasks.has("arrival_house"), "Actual tracker click assigns an available survivor")
	var worker: Node3D = app.mission.search_tasks.arrival_house.worker
	var saw_inside: bool = false
	for frame: int in range(1800):
		await _record_frame("search-inside", frame)
		if worker.inside_building and not worker.visible:
			if not saw_inside:
				check(app.hud.poi_context._focus_card.visible, "The first building's search card is visible as its worker enters")
				await shot("search-inside")
			saw_inside = true
		if app.mission.city.sites.arrival_house.searched and not worker.inside_building:
			for tail: int in range(30):
				await _record_frame("search-inside", frame + tail + 1)
			break
	check(saw_inside and app.mission.city.sites.arrival_house.searched and worker.visible, "Normal walking, entry fade, full timer and exit are recorded")
	print("RECORDED: search-inside")
	app.mission.poi_selected_id = ""
	app.mission.command_move(Vector3(-32, 0, 38))
	for frame: int in range(120):
		await process_frame
	app.mission.command_stop()
	app.mission.exploration.refresh()
	app.hud.set_objectives_expanded(true)
	await frames(4)
	await click(app.hud.site_buttons.arrival_mid)
	app.hud.set_objectives_expanded(false)
	var cancel_worker: Node3D = app.mission.search_tasks.arrival_mid.worker
	var cancel_at := Vector2.ZERO
	for frame: int in range(360):
		await _record_frame("cancel-search", frame)
		if frame == 250:
			app.mission.command_search("arrival_mid")
			app.hud.poi_context.refresh()
			check(app.hud.poi_context._focus_card.action.is_visible_in_tree(), "Searching building offers a visible cancel control")
			cancel_at = app.hud.poi_context._focus_card.action.get_global_rect().get_center()
			_mouse(MOUSE_BUTTON_LEFT, true, cancel_at)
		if frame == 251:
			_mouse(MOUSE_BUTTON_LEFT, false, cancel_at)
	check(not app.mission.search_tasks.has("arrival_mid") and cancel_worker.visible and not cancel_worker.inside_building, "Clicking Cancel exits the building and restores control")
	check(app.mission.city.sites.arrival_mid.progress > 0 and not app.mission.city.sites.arrival_mid.searched, "Cancellation retains partial progress")
	print("RECORDED: cancel-search")
	await click(app.hud.site_buttons.arrival_mid)
	for frame: int in range(180):
		await process_frame
	app.mission.poi_selected_id = "arrival_mid"
	app.mission.command_move(Vector3(-35, 0, 35))
	for frame: int in range(450):
		if frame == 90:
			_hold(KEY_W, true)
		if frame == 105:
			_hold(KEY_W, false)
		if frame == 150:
			_mouse(MOUSE_BUTTON_RIGHT, true, Vector2(800, 500))
		if frame >= 150 and frame < 170:
			var motion := InputEventMouseMotion.new()
			motion.device = 42
			motion.position = Vector2(800, 500)
			motion.relative = Vector2(2, -1)
			root.push_input(motion, true)
		if frame == 170:
			_mouse(MOUSE_BUTTON_RIGHT, false, Vector2(800, 500))
		if frame == 220 or frame == 260:
			var wheel: MouseButton = MOUSE_BUTTON_WHEEL_DOWN if frame == 220 else MOUSE_BUTTON_WHEEL_UP
			_mouse(wheel, true, Vector2(800, 500))
			_mouse(wheel, false, Vector2(800, 500))
		if frame == 320:
			await click(app.hud.command_buttons["定位"])
		await _record_frame("search-ui-stability", frame)
	check(stable_frames > 300 and maximum_anchor_error <= .51, "Follow, WASD, drag and zoom keep the building card within half a pixel of its static anchor")
	await shot("search-ui-stability")
	print("RECORDED: search-ui-stability; pixels=", maximum_anchor_error)
	app.mission.command_recall_all()
	await frames(15)

func _exercise_fog_and_return() -> void:
	app.mission.command_move(Vector3(0, 0, 0))
	for frame: int in range(600):
		await _record_frame("fog-exploration", frame)
		if frame == 300:
			await shot("fog-explored")
	var origin: Vector3 = app.mission.catalog.map.bus_position
	check(app.mission.exploration.state_at(origin) == app.mission.exploration.Visibility.EXPLORED, "Distant arrival area remains explored after moving up the street")
	# Dispatch to two discovered opposite sides through the same production worker rule.
	app.mission.command_search("garage")
	app.mission.command_search("depot")
	check(app.mission.search_tasks.size() == 2, "Two survivors can approach different buildings in parallel")
	for frame: int in range(300):
		await _record_frame("fog-union", frame)
	await shot("fog-union")
	app.mission.command_recall_all()
	await frames(15)
	app.mission.command_move(Vector3(0, 0, 25))
	while app.mission.clock.phase == app.mission.clock.DAY:
		await process_frame
	for frame: int in range(120):
		await _record_frame("blue-hour-fog", frame)
	await shot("blue-hour-fog")
	check(app.mission.exploration.config.radius == 20, "Blue Hour keeps the same gameplay visibility radius")
	await key(KEY_E)
	for frame: int in range(2400):
		if app.state != "mission":
			break
		await process_frame
	check(app.state == "result", "Exit, bus return and preparation reach Settlement")
	await shot("settlement")
	await click(app.screen.confirm_button)
	check(app.state == "shelter" and app.mission == null, "Settlement returns to Camp and disposes exploration memory")
	await shot("returned-camp")
