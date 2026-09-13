extends SceneTree

const OUTPUT := "res://test-output/camp-environment-dressing-01/"
const CAMP_SCENE := "res://scenes/camp/camp_main.tscn"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	root.size = Vector2i(1920, 1080)
	var packed := load(CAMP_SCENE) as PackedScene
	if packed == null:
		quit(1)
		return
	var camp := packed.instantiate() as Node3D
	root.add_child(camp)
	await _frames(8)
	var rig := camp.get_node("CameraRig") as Node3D
	var pivot := camp.get_node("CameraRig/PitchPivot") as Node3D
	var camera := camp.get_node("CameraRig/PitchPivot/Camera3D") as Camera3D
	await _shot("A-default-camp")
	for hud: Node in camp.find_children("*", "CanvasLayer", true, false):
		hud.visible = false
	for control: Node in camp.find_children("*", "Control", true, false):
		control.visible = false
	await _frames(1)
	await _shot("B-no-hud")
	rig.position = Vector3(0, 0, -5.0)
	camera.size = 12.6
	await _frames(3)
	await _shot("C-main-entry")
	rig.position = Vector3(-4.6, 0, 2.0)
	camera.size = 11.0
	await _frames(3)
	await _shot("D-vehicle-maintenance")
	rig.position = Vector3(-5.4, 0, 4.9)
	pivot.rotation.x = deg_to_rad(-62.0)
	camera.size = 14.8
	await _frames(3)
	await _shot("E-rest-and-storage")
	FileAccess.open(OUTPUT + "validation.json", FileAccess.WRITE).store_string(JSON.stringify({
		"renderer": RenderingServer.get_current_rendering_method(),
		"objects": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
		"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"primitives": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
		"camera": str(camera.global_transform),
		"camera_size": camera.size,
	}, "\t"))
	camp.queue_free()
	await _frames(2)
	quit(0)

func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(OUTPUT + name + ".png")

func _frames(count: int) -> void:
	for _index in range(count):
		await process_frame
