extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	root.unfocusable = true
	var world := Node3D.new()
	root.add_child(world)
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("72808a")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_energy = .8
	world.add_child(environment)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-45, -25, 0)
	world.add_child(light)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	world.add_child(camera)
	camera.current = true
	for d: Resource in preload("res://data/world_asset_catalog.gd").get_buildings_by_category(""):
		if int(d.building_id.substr(4)) < 9:
			continue
		var building: Node3D = d.scene.instantiate()
		world.add_child(building)
		camera.size = maxf(d.bounding_size.x, d.bounding_size.z) * 1.5
		for side: int in [0, 1, 2, 3]:
			camera.position = Basis(Vector3.UP, side * PI / 2) * Vector3(0, d.bounding_size.y * .7, -24)
			camera.look_at(Vector3(0, d.bounding_size.y * .35, 0))
			for frame: int in 3:
				await process_frame
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png("res://test-output/random-map/%s-side%d.png" % [d.building_id, side])
		building.free()
	world.free()
	quit()
