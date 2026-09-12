extends SceneTree
## Derive HUD portraits from the same supplied characters, without editing their models.
const MEMBERS: Array[Resource] = [preload("res://data/survivors/xia_zhiyao.tres"), preload("res://data/survivors/su_wanxing.tres")]

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	root.unfocusable = true
	var preview: bool = "--portrait-preview" in OS.get_cmdline_user_args()
	var directory: String = "res://test-output" if preview else "res://assets/ui/expedition/portraits"
	DirAccess.make_dir_recursive_absolute(directory)
	for member: Resource in MEMBERS:
		for facing: int in ([1, -1] if preview else [1]):
			var viewport := SubViewport.new()
			viewport.size = Vector2i(192, 192)
			viewport.own_world_3d = true
			viewport.transparent_bg = true
			viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
			viewport.msaa_3d = Viewport.MSAA_4X
			root.add_child(viewport)
			var model: Node3D = load(member.model_path).instantiate()
			viewport.add_child(model)
			var world := WorldEnvironment.new()
			world.environment = Environment.new()
			world.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
			world.environment.ambient_light_color = Color.WHITE
			world.environment.ambient_light_energy = .8
			viewport.add_child(world)
			var light := DirectionalLight3D.new()
			light.rotation_degrees = Vector3(-25, -25 if facing == 1 else 155, 0)
			light.light_energy = .8
			viewport.add_child(light)
			var camera := Camera3D.new()
			viewport.add_child(camera)
			camera.projection = Camera3D.PROJECTION_ORTHOGONAL
			camera.size = .72
			camera.position = Vector3(.1 * facing, 1.45, 3 * facing)
			camera.look_at(Vector3(0, 1.29, 0), Vector3.UP)
			camera.current = true
			for i: int in range(8):
				await process_frame
			await RenderingServer.frame_post_draw
			var suffix: String = ("-front" if facing == 1 else "-back") if preview else ""
			var path: String = "%s/portrait_%s%s.png" % [directory, member.id, suffix]
			var error: Error = viewport.get_texture().get_image().save_png(path)
			if error != OK:
				push_error("Portrait capture failed: " + path)
				quit(1)
				return
			print("PORTRAIT_CAPTURE ", path)
			viewport.free()
	quit()
