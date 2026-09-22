extends "res://tests/day_loop_runtime.gd"
## Records actual viewport frames and native input through the formal departure flow.
const FPS: int = 30
const DIRECTORY: String = "res://test-output/expedition-motion/after"

func press_key(code: Key, down: bool) -> void:
	var event := InputEventKey.new()
	event.device = 42
	event.keycode = code
	event.physical_keycode = code
	event.pressed = down
	root.push_input(event, true)

func mouse_button(code: MouseButton, down: bool, point: Vector2) -> void:
	var event := InputEventMouseButton.new()
	event.device = 42
	event.button_index = code
	event.pressed = down
	event.position = point
	root.push_input(event, true)

func run() -> void:
	create_timer(180).timeout.connect(func(): quit(2))
	root.unfocusable = true
	root.add_child(InputGate.new())
	app = load("res://core/main.tscn").instantiate()
	app.save_path = "user://test-runs/motion-%d.json" % Time.get_ticks_usec()
	root.add_child(app)
	await frames(12)
	await click(button("开始游戏"))
	await click(app.screen.tabs.scavenge)
	await click(app.screen.confirm_button)
	await click(app.screen.departure)
	await click(app.screen.cards.commercial)
	await click(app.screen.confirm_button)
	check(app.state == "mission", "Motion recording enters the formal expedition")
	check(app.mission.camera.size == 23, "Recording starts at the normal default camera")
	DirAccess.make_dir_recursive_absolute(DIRECTORY)
	var metadata: Array[Dictionary] = []
	var point := Vector2(800, 450)
	var origin: Vector3 = app.mission.squad_center()
	for frame: int in range(600):
		if frame == 0 or frame == 570:
			point = app.mission.camera.unproject_position(app.mission.squad_center() + Vector3(0, 0, -10))
			mouse_button(MOUSE_BUTTON_LEFT, true, point)
		if frame == 1 or frame == 571:
			mouse_button(MOUSE_BUTTON_LEFT, false, point)
		if frame == 120:
			press_key(KEY_W, true)
		if frame == 210:
			press_key(KEY_W, false)
			mouse_button(MOUSE_BUTTON_RIGHT, true, Vector2(800,450))
		if frame >= 210 and frame < 300:
			var motion := InputEventMouseMotion.new()
			motion.device = 42
			motion.position = Vector2(800,450)
			motion.relative = Vector2(3, -1)
			root.push_input(motion, true)
		if frame == 300:
			mouse_button(MOUSE_BUTTON_RIGHT, false, Vector2(800,450))
		if frame >= 300 and frame < 420 and frame % 15 == 0:
			var wheel: MouseButton = MOUSE_BUTTON_WHEEL_DOWN if frame < 360 else MOUSE_BUTTON_WHEEL_UP
			mouse_button(wheel, true, Vector2(800,450))
			mouse_button(wheel, false, Vector2(800,450))
		if frame == 420:
			mouse_button(MOUSE_BUTTON_RIGHT, true, Vector2(800,450))
		if frame >= 420 and frame < 480:
			var delta_world: Vector3 = (Vector3(-56, 0, 22) - app.mission.camera_center) / float(480 - frame)
			var forward: Vector3 = -app.mission.camera.global_basis.z
			forward.y = 0
			var pan := Vector2(delta_world.dot(app.mission.camera.global_basis.x), -delta_world.dot(forward.normalized()))
			var drag := InputEventMouseMotion.new()
			drag.device = 42
			drag.position = Vector2(800,450)
			drag.relative = -pan * root.get_visible_rect().size.y / app.mission.camera.size
			root.push_input(drag, true)
		if frame == 480:
			mouse_button(MOUSE_BUTTON_RIGHT, false, Vector2(800,450))
			check(app.mission.camera_center.distance_to(Vector3(-56,0,22)) < .1, "Mouse drag frames the fence and garden for temporal inspection")
		if frame == 540:
			var locate: Vector2 = app.hud.command_buttons["定位"].get_global_rect().get_center()
			mouse_button(MOUSE_BUTTON_LEFT, true, locate)
		if frame == 541:
			mouse_button(MOUSE_BUTTON_LEFT, false, app.hud.command_buttons["定位"].get_global_rect().get_center())
		if frame == 542:
			check(app.mission.camera_controller.following, "Actual locate button restores follow after manual input")
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(DIRECTORY + "/%04d.png" % frame)
		metadata.append({"frame":frame, "camera_size":app.mission.camera.size, "camera":var_to_str(app.mission.camera.position), "following":app.mission.camera_controller.following})
	check(app.mission.squad_center().distance_to(origin) > 8, "Actual ground input moves the existing characters during recording")
	FileAccess.open(DIRECTORY + "/frames.json", FileAccess.WRITE).store_string(JSON.stringify(metadata))
	# A debug-only overview documents the authored layout; it is never a player camera preset.
	app.mission.camera_controller.following = false
	app.mission.camera_center = Vector3.ZERO
	app.mission.camera.size = 132
	app.mission.camera_controller.apply()
	app.hud.visible = false
	await frames(3)
	await capture("expedition-layout")
	print("EXPEDITION MOTION: %d checks, %d failures; 600 native frames" % [checks, failures.size()])
	app.free()
	await frames()
	quit(0 if failures.is_empty() else 1)
