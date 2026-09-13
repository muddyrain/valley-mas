extends SceneTree
const OUTPUT := "res://test-output/camp-core-props-polish-01b/"
var app: Node
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	root.size = Vector2i(1920, 1080)
	root.content_scale_size = Vector2i(1600, 900)
	app = load("res://core/main.gd").new()
	app.save_path = "user://test-runs/camp-core-props-polish-01b.json"
	app.fresh_test_run = true
	root.add_child(app)
	await _frames(14)
	app.campaign.new_run(772, "combat", ["xia_zhiyao", "su_wanxing"])
	app.campaign.data.food = 30
	app.show_shelter()
	await _frames(16)
	var camera := app.camp_view.camera as Camera3D
	await _frames(3)
	await _shot("A-default-hud")
	app.camp_ui.hud_root.visible = false
	for control: Node in app.camp_ui.find_children("*", "Control", true, false):
		if control != app.camp_ui.hud_root:
			control.visible = false
	await _frames(2)
	await _shot("B-no-hud")
	_set_camera(camera, Vector3(-1.8, 4.8, 1.0), Vector3(-6.0, 0.8, -4.5), 7.4)
	await _shot("C-workshop")
	_set_camera(camera, Vector3(14.0, 5.4, 1.5), Vector3(9.6, 0.8, -2.6), 6.2)
	await _shot("D-storage")
	_set_camera(camera, Vector3(3.0, 4.8, 2.7), Vector3(-2.3, 0.8, -4.0), 6.4)
	await _shot("E-entry")
	_set_camera(camera, Vector3(-6.4, 4.5, 1.5), Vector3(-6.4, 0.8, -4.4), 6.0)
	await _shot("F-workshop-alt-angle")
	var visible_survivors := 0
	for actor: Node in app.camp_view.camp.get_node("Characters").get_children():
		if actor.is_visible_in_tree():
			visible_survivors += 1
	FileAccess.open(OUTPUT + "validation.json", FileAccess.WRITE).store_string(JSON.stringify({
		"renderer": RenderingServer.get_current_rendering_method(),
		"objects": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
		"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"primitives": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
		"survivors": visible_survivors,
		"core_prop_instances": {
			"workbench": app.camp_view.camp.find_children("CAMP_PROP_001_workbench", "Node3D", true, false).size(),
			"generator": app.camp_view.camp.find_children("CAMP_PROP_004_portable_generator", "Node3D", true, false).size(),
			"shelf": app.camp_view.camp.find_children("CAMP_PROP_002_storage_shelf", "Node3D", true, false).size(),
			"board": app.camp_view.camp.find_children("CAMP_PROP_003_notice_board", "Node3D", true, false).size()
		}
	}, "\t"))
	app.queue_free()
	await _frames(4)
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
