extends SceneTree
const OUTPUT := "res://test-output/camp-core-props-correction-01a/"
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	root.size = Vector2i(1920, 1080)
	var camp := (load("res://scenes/camp/camp_main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(camp)
	await _frames(8)
	var authored_characters := camp.get_node("Characters").get_children()
	var visible_survivors := 0
	for index: int in range(2, authored_characters.size()):
		(authored_characters[index] as Node3D).visible = false
	visible_survivors = 2
	var camera := camp.get_node("CameraRig/PitchPivot/Camera3D") as Camera3D
	_set_camera(camera, Vector3(1.5, 18.0, 19.0), Vector3(0, 0, -1.5), 18.0)
	await _shot("A-default-hud")
	for canvas: Node in camp.find_children("*", "CanvasLayer", true, false):
		canvas.visible = false
	for control: Node in camp.find_children("*", "Control", true, false):
		control.visible = false
	await _frames(1)
	await _shot("B-no-hud")
	_set_camera(camera, Vector3(-1.8, 4.8, 0.8), Vector3(-6.1, 0.75, -4.65), 7.2)
	await _shot("C-workshop")
	_set_camera(camera, Vector3(15.0, 5.5, 2.0), Vector3(9.6, 0.8, -2.6), 6.0)
	await _shot("D-storage")
	_set_camera(camera, Vector3(3.0, 4.6, 2.5), Vector3(-2.3, 0.8, -4.0), 6.4)
	await _shot("E-entry")
	FileAccess.open(OUTPUT + "validation.json", FileAccess.WRITE).store_string(JSON.stringify({
		"renderer": RenderingServer.get_current_rendering_method(),
		"objects": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
		"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"primitives": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
		"survivor_visuals": visible_survivors
	}, "\t"))
	camp.queue_free()
	await _frames(2)
	quit(0)
func _set_camera(camera: Camera3D, position: Vector3, target: Vector3, size: float) -> void:
	camera.global_position = position
	camera.look_at(target, Vector3.UP)
	camera.size = size
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	await _frames(2)
func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(OUTPUT + name + ".png")
func _frames(count: int) -> void:
	for _index in range(count):
		await process_frame

