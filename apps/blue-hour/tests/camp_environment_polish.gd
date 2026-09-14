extends "res://tests/camp_art_direction.gd"
## Still evidence retains the formal camera. Detail images are crops, never new angles.

func run() -> void:
	create_timer(120).timeout.connect(func(): printerr("CAMP ENVIRONMENT TIMEOUT"); quit(2))
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--label="):
			label = argument.trim_prefix("--label=")
	output_directory = "res://test-output/camp-environment-polish/" + label + "/"
	DirAccess.make_dir_recursive_absolute(output_directory)
	root.size = Vector2i(1920, 1080)
	root.content_scale_size = root.size
	root.unfocusable = true
	root.add_child(InputGate.new())
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	app = load("res://core/main.gd").new()
	app.save_path = "user://test-runs/camp-environment-polish.json"
	app.fresh_test_run = true
	root.add_child(app)
	await frames(15)
	app.campaign.new_run(77, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var escape := InputEventKey.new()
	escape.device = 42
	escape.keycode = KEY_ESCAPE
	escape.physical_keycode = KEY_ESCAPE
	escape.pressed = true
	root.push_input(escape, true)
	await frames(2)
	escape.pressed = false
	root.push_input(escape, true)
	await frames(60)
	var camp: Node3D = app.camp_view.camp
	var camera: Camera3D = app.camp_view.camera
	measurements["camera"] = {"transform": str(camera.global_transform), "size": camera.size}
	measurements["performance"] = await frame_timing()
	measurements["draw_calls"] = Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
	measurements["primitives"] = Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
	measurements["collision"] = []
	for shape: CollisionShape3D in camp.find_children("*", "CollisionShape3D", true, false):
		if shape.shape is BoxShape3D:
			measurements.collision.append({"path": str(camp.get_path_to(shape)), "transform": str(shape.global_transform), "size": str(shape.shape.size)})
	check(camp.members.size() == 2, "Two actual campaign survivors")
	check(camp.get_viewport() == root, "Formal main viewport")
	check(camp.get_node("NavigationSource/MainBuilding").position == Vector3(0, 0, -6.75), "Station transform preserved")
	check(camp.find_children("*", "Light3D", true, false).size() == 1, "Single daylight source")
	await shot("camp_env_pass02_A_default_hud")
	app.ui_layer.hide()
	for actor: Node3D in camp.members.values():
		actor.visual.selection_ring.hide()
		actor.visual.duty_ring.hide()
	for node: Label3D in camp.find_children("*", "Label3D", true, false):
		node.hide()
	await frames(3)
	await shot("camp_env_pass02_B_no_hud")
	await RenderingServer.frame_post_draw
	var still := root.get_texture().get_image()
	_crop(still, camera, "C_main_entry", Vector3(0, 1.6, -4.6), Vector2i(960, 600))
	_crop(still, camera, "D_vehicle_maintenance", Vector3(-7.2, 1.0, -0.9), Vector2i(980, 850))
	_crop(still, camera, "E_rest_area", Vector3(1.0, 0.3, 1.7), Vector2i(700, 560))
	_crop(still, camera, "F_boundary_left", Vector3(-11.1, 0.5, -4.6), Vector2i(650, 700))
	_crop(still, camera, "G_boundary_right", Vector3(10.3, 0.5, 2.2), Vector2i(700, 780))
	measurements["checks"] = checks
	measurements["failures"] = failures
	FileAccess.open(output_directory + "validation.json", FileAccess.WRITE).store_string(JSON.stringify(measurements, "\t"))
	print("CAMP ENVIRONMENT ", label, ": ", checks, " checks; failures=", failures)
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)

func _crop(still: Image, camera: Camera3D, id: String, center: Vector3, size: Vector2i) -> void:
	var projected := Vector2i(root.get_stretch_transform() * camera.unproject_position(center))
	var origin := (projected - size / 2).clamp(Vector2i.ZERO, still.get_size() - size)
	var region := Rect2i(origin, size)
	measurements[id] = str(region)
	check(still.get_region(region).save_png(output_directory + "camp_env_pass02_" + id + ".png") == OK, "Formal camera crop: " + id)
