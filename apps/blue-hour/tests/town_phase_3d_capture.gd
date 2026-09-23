extends "res://tests/expedition_minimap.gd"
## Native Phase 3D captures for seeded town overviews and production Expedition UI.

const UrbanView = preload("res://maps/town/town_urban_view.gd")
const Dressing = preload("res://maps/town/environment/town_urban_dressing_layer.gd")
const DressingView = preload("res://maps/town/environment/town_urban_dressing_view.gd")
const OUTPUT := "res://test-output/town-phase-3d-capture"
const SEEDS: Array[int] = [4101, 4102, 4103, 4104, 4105]

var capture_host: Node3D
var capture_camera: Camera3D
var captures: Array[String] = []

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	await _capture_towns()
	await _capture_expedition()
	FileAccess.open(OUTPUT.path_join("capture-manifest.json"), FileAccess.WRITE).store_string(JSON.stringify({
		"phase": "3D", "seeds": SEEDS, "native": DisplayServer.get_name() != "headless", "captures": captures
	}, "\t"))
	print("PHASE_3D NATIVE CAPTURE: %d images" % captures.size())
	quit(0 if captures.size() >= 8 else 1)

func _capture_towns() -> void:
	capture_host = Node3D.new()
	capture_host.name = "Phase3DTownCapture"
	root.add_child(capture_host)
	_build_capture_camera()
	for seed_value: int in SEEDS:
		var town: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
		if not bool(town.get("ok", false)):
			push_error("Town generation failed for capture seed %d: %s" % [seed_value, str(town.get("error", "unknown"))])
			continue
		var layer := Node3D.new()
		layer.name = "Town_%d" % seed_value
		capture_host.add_child(layer)
		UrbanView.build(layer, town)
		DressingView.build(layer, town, Dressing.new().generate(town))
		await _settle_capture()
		capture_camera.size = 280.0
		capture_camera.position = Vector3(0, 420, 145)
		capture_camera.look_at(Vector3.ZERO)
		await _save_capture("town_seed_%d_overview" % seed_value)
		layer.queue_free()
		await process_frame
	capture_host.queue_free()
	await process_frame

func _capture_expedition() -> void:
	var app: Node = await create_app(4101)
	var mission: Node3D = app.mission
	var minimap: Control = app.hud.minimap
	mission.camera_controller.following = false
	mission.camera.size = 250.0
	mission.camera_center = Vector3.ZERO
	mission.camera_controller.apply()
	await process_frame
	await RenderingServer.frame_post_draw
	await _save_capture("expedition_town_overview")
	mission.camera.size = 105.0
	mission.camera_center = Vector3(-72.0, 0, 12.0)
	mission.camera_controller.apply()
	await _save_capture("expedition_arrival_street")
	var viewport_image: Image = root.get_viewport().get_texture().get_image()
	var minimap_rect: Rect2i = Rect2i(minimap.get_global_rect())
	var clipped_rect := minimap_rect.intersection(Rect2i(Vector2i.ZERO, viewport_image.get_size()))
	if clipped_rect.has_area():
		viewport_image.get_region(clipped_rect).save_png(ProjectSettings.globalize_path(OUTPUT.path_join("minimap_formal.png")))
		captures.append(OUTPUT.path_join("minimap_formal.png"))
	app.queue_free()
	await process_frame

func _build_capture_camera() -> void:
	capture_camera = Camera3D.new()
	capture_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	capture_camera.far = 1200.0
	capture_host.add_child(capture_camera)
	capture_camera.current = true
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.light_energy = 1.1
	capture_host.add_child(sun)
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#aeb8bc")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#b6c4d6")
	environment.ambient_light_energy = 0.7
	world.environment = environment
	capture_host.add_child(world)

func _save_capture(label: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await _settle_capture()
	var path := OUTPUT.path_join(label + ".png")
	if root.get_viewport().get_texture().get_image().save_png(ProjectSettings.globalize_path(path)) == OK:
		captures.append(path)

func _settle_capture() -> void:
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
