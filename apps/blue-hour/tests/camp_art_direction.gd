extends SceneTree
var app: Node
var checks := 0
var failures: Array[String] = []
var measurements: Dictionary = {}

class InputGate extends Node:
	func _input(event: InputEvent) -> void:
		if event.device != 42:
			get_viewport().set_input_as_handled()

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func frames(count: int = 5) -> void:
	for i in range(count):
		await process_frame

## Native before/after evidence from the formal camp and an isolated campaign save.
var label: String = "after"
var output_directory: String
var artifact_root: String = "res://test-output/camp-visual-polish-02"

func run() -> void:
	create_timer(120).timeout.connect(func(): printerr("CAMP ART DIRECTION TIMEOUT"); quit(2))
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--label="):
			label = argument.trim_prefix("--label=")
		elif argument.begins_with("--artifact-path="):
			artifact_root = argument.trim_prefix("--artifact-path=")
	output_directory = artifact_root.path_join(label) + "/"
	DirAccess.make_dir_recursive_absolute(output_directory)
	root.size = Vector2i(1920, 1080)
	root.unfocusable = true
	root.add_child(InputGate.new())
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	app = load("res://core/main.gd").new()
	app.save_path = "user://test-runs/camp-visual-polish-02.json"
	app.fresh_test_run = true
	root.add_child(app)
	await frames(15)
	app.campaign.new_run(772)
	app.show_shelter()
	await frames(120)
	var camp: Node3D = app.camp_view.camp
	var camera: Camera3D = app.camp_view.camera
	var rig: Node3D = camp.get_node("CameraRig")
	measurements["renderer"] = RenderingServer.get_current_rendering_method()
	measurements["visual_pass"] = camp.get_meta("visual_pass", "01")
	measurements["camera"] = {"transform": str(camera.global_transform), "size": camera.size}
	measurements["performance"] = await frame_timing()
	measurements["draw_calls"] = Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
	measurements["render_objects"] = Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME)
	measurements["primitives"] = Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
	measurements["character_pixels"] = []
	for actor: Node3D in camp.members.values():
		measurements.character_pixels.append(str(projected_bounds(actor.visual.rig, camera)))
	check(camp.get_viewport() == root, "Formal Camp uses the native main viewport")
	check(camp.get_node("NavigationSource/MainBuilding").position == Vector3(0, 0, -6.75), "Station remains in place")
	var environment: Environment = camp.get_node("WorldEnvironment").environment
	check(not environment.glow_enabled and not environment.fog_enabled, "No glow or fog postprocessing")
	check(camp.find_children("*", "Light3D", true, false).size() == 1, "Exactly one daylight light")
	for mesh: MeshInstance3D in camp.find_children("*", "MeshInstance3D", true, false):
		for surface: int in range(mesh.mesh.get_surface_count()):
			var material: Material = mesh.get_active_material(surface)
			check(material == null or material.next_pass == null, "Single pass: " + str(mesh.name))
	await shot("B-main-hud")
	app.ui_layer.hide()
	for actor: Node3D in camp.members.values():
		actor.visual.selection_ring.hide()
	for node: Label3D in camp.find_children("*", "Label3D", true, false):
		node.hide()
	for mesh: MeshInstance3D in camp.find_children("*", "MeshInstance3D", true, false):
		if mesh.mesh is TorusMesh:
			mesh.hide()
	await shot("A-main-no-hud")
	rig.position = Vector3(0, 0, -5.0)
	camera.size = 12.6
	await frames(4)
	await shot("C-station")
	rig.position = Vector3(-4.6, 0, 2.0)
	camera.size = 11.0
	await frames(4)
	await shot("D-vehicle-survivors")
	rig.position = Vector3(-5.4, 0, 4.9)
	rig.rotation.y = 0.0
	camp.get_node("CameraRig/PitchPivot").rotation.x = deg_to_rad(-62.0)
	camera.size = 14.8
	await frames(4)
	await shot("E-departure-area")
	measurements["checks"] = checks
	measurements["failures"] = failures
	FileAccess.open(output_directory + "validation.json", FileAccess.WRITE).store_string(JSON.stringify(measurements, "\t"))
	print("CAMP ART DIRECTION %s: %d checks, %d failures" % [label, checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)

func shot(id: String) -> void:
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png(output_directory + id + ".png") == OK, "Native capture: " + id)

func projected_bounds(node: Node3D, camera: Camera3D) -> Rect2:
	var result := Rect2()
	var first := true
	for mesh: MeshInstance3D in node.find_children("*", "MeshInstance3D", true, false):
		for surface: int in range(mesh.mesh.get_surface_count()):
			var vertices: PackedVector3Array = mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]
			for vertex: Vector3 in vertices:
				var point := root.get_stretch_transform() * camera.unproject_position(mesh.global_transform * vertex)
				result = Rect2(point, Vector2.ZERO) if first else result.expand(point)
				first = false
	return result

func frame_timing() -> Dictionary:
	var samples: Array[float] = []
	var start := Time.get_ticks_usec()
	var previous := start
	while Time.get_ticks_usec() - start < 4000000:
		await process_frame
		var now := Time.get_ticks_usec()
		samples.append((now - previous) / 1000.0)
		previous = now
	var seconds := (Time.get_ticks_usec() - start) / 1000000.0
	samples.sort()
	return {"frames": samples.size(), "seconds": seconds, "average_fps": samples.size() / seconds, "median_ms": samples[samples.size() / 2], "p95_ms": samples[int(samples.size() * 0.95)], "max_ms": samples.back(), "vsync": DisplayServer.window_get_vsync_mode(), "rendering_device": RenderingServer.get_video_adapter_name()}

