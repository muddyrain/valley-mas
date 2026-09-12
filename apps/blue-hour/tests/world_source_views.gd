extends SceneTree

var report: Array = []

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	root.unfocusable = true
	report = JSON.parse_string(FileAccess.get_file_as_string("res://art/world_asset_audit.json"))
	DirAccess.make_dir_recursive_absolute("res://test-output/world-audit")
	for spec: Dictionary in report:
		if spec.get("missing", false):
			continue
		var row := HBoxContainer.new()
		root.add_child(row)
		for direction: Vector3 in [Vector3(0, 0.55, -1), Vector3(1, 0.55, 0), Vector3(0, 0.55, 1), Vector3(-1, 0.55, 0)]:
			var container := SubViewportContainer.new()
			container.custom_minimum_size = Vector2(380, 320)
			row.add_child(container)
			var viewport := SubViewport.new()
			viewport.size = Vector2i(380, 320)
			viewport.own_world_3d = true
			container.add_child(viewport)
			var model: Node3D = load(spec.path).instantiate()
			viewport.add_child(model)
			var env := WorldEnvironment.new()
			env.environment = Environment.new()
			env.environment.background_mode = Environment.BG_COLOR
			env.environment.background_color = Color("#777e87")
			env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
			env.environment.ambient_light_color = Color.WHITE
			env.environment.ambient_light_energy = 0.75
			viewport.add_child(env)
			var light := DirectionalLight3D.new()
			light.rotation_degrees = Vector3(-48, -35, 0)
			viewport.add_child(light)
			var camera := Camera3D.new()
			viewport.add_child(camera)
			camera.projection = Camera3D.PROJECTION_ORTHOGONAL
			camera.size = maxf(spec.size[0], maxf(spec.size[1], spec.size[2])) * 1.25
			var center := Vector3(0, spec.size[1] * 0.5, 0)
			camera.position = center + direction * 30
			camera.look_at(center)
			camera.current = true
		for i: int in range(6):
			await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/world-audit/" + spec.id + ".png")
		row.free()
	print("WORLD SOURCE VIEWS: 16 assets, camera order -Z / +X / +Z / -X")
	quit()
