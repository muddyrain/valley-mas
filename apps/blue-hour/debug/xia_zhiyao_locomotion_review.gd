extends Node3D
## Isolated character animation review. Never instantiates gameplay controllers.

const MODEL: String = "res://assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb"
const CLIPS: String = "res://assets/characters/xia_zhiyao/animations/"
const NAMES: Array[String] = ["idle", "walking", "running"]
const VIEWS: Array[Dictionary] = [
	{"name": "front", "eye": Vector3(0, 1.15, 4), "target": Vector3(0, 0.8, 0), "size": 1.9},
	{"name": "side", "eye": Vector3(-4, 1.05, 0), "target": Vector3(0, 0.8, 0), "size": 1.9},
	{"name": "three_quarter", "eye": Vector3(3, 1.35, 4), "target": Vector3(0, 0.8, 0), "size": 1.9},
	{"name": "feet", "eye": Vector3(-3.4, 0.55, 2.8), "target": Vector3(0, 0.38, 0.02), "size": 1.1},
]

var actor: Node3D
var skeleton: Skeleton3D
var player: AnimationPlayer
var clip: Animation
var viewports: Array[SubViewport] = []
var current_clip: String = "idle"
var elapsed: float = 0.0
var output_path: String
var title: Label

func _ready() -> void:
	set_process(false)
	output_path = ProjectSettings.globalize_path("res://test-output/xia-zhiyao-locomotion/")
	for argument: String in OS.get_cmdline_user_args():
		if argument in NAMES:
			current_clip = argument
		if argument.begins_with("output="):
			output_path = argument.trim_prefix("output=") + "/"
	actor = (load(MODEL) as PackedScene).instantiate() as Node3D
	add_child(actor)
	skeleton = actor.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	player = AnimationPlayer.new()
	actor.add_child(player)
	player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	var library: AnimationLibrary = AnimationLibrary.new()
	for name: String in NAMES:
		library.add_animation(name, load(CLIPS + name + ".tres") as Animation)
	player.add_animation_library("", library)
	build_stage()
	select_clip(current_clip)
	print("XIA LOCOMOTION READY: ", current_clip, "; original model; no runtime IK")
	if "capture" in OS.get_cmdline_user_args() or "preview" in OS.get_cmdline_user_args() or "phases" in OS.get_cmdline_user_args():
		call_deferred("capture")
	else:
		set_process(true)

func _process(delta: float) -> void:
	elapsed += delta
	seek(fposmod(elapsed, clip.length))

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.is_pressed():
		var key: InputEventKey = event as InputEventKey
		if key.keycode >= KEY_1 and key.keycode <= KEY_3:
			select_clip(NAMES[key.keycode - KEY_1])

func select_clip(name: String) -> void:
	current_clip = name
	clip = player.get_animation(name)
	player.play(name)
	player.advance(0.0)
	elapsed = 0.0
	title.text = "Xia Zhiyao | " + name.capitalize() + "   [1 Idle / 2 Walking / 3 Running]"

func seek(time: float) -> void:
	player.seek(time, true)
	skeleton.force_update_all_bone_transforms()

func build_stage() -> void:
	var environment: WorldEnvironment = WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color(0.24, 0.27, 0.30)
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color.WHITE
	environment.environment.ambient_light_energy = 0.4
	add_child(environment)
	var light: DirectionalLight3D = DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-55, -30, 0)
	light.light_energy = 0.8
	light.light_specular = 0.25
	light.shadow_enabled = true
	light.directional_shadow_max_distance = 8.0
	add_child(light)
	var floor_mesh: MeshInstance3D = MeshInstance3D.new()
	var plane: PlaneMesh = PlaneMesh.new()
	plane.size = Vector2(10, 10)
	floor_mesh.mesh = plane
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = Color(0.25, 0.27, 0.29)
	material.roughness = 1.0
	floor_mesh.material_override = material
	add_child(floor_mesh)
	var lines: ImmediateMesh = ImmediateMesh.new()
	var line_material: StandardMaterial3D = StandardMaterial3D.new()
	line_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	line_material.albedo_color = Color(0.40, 0.42, 0.44)
	lines.surface_begin(Mesh.PRIMITIVE_LINES, line_material)
	for index: int in range(-20, 21):
		var offset: float = index * 0.1
		lines.surface_add_vertex(Vector3(offset, 0.0001, -2))
		lines.surface_add_vertex(Vector3(offset, 0.0001, 2))
		lines.surface_add_vertex(Vector3(-2, 0.0001, offset))
		lines.surface_add_vertex(Vector3(2, 0.0001, offset))
	lines.surface_end()
	var grid: MeshInstance3D = MeshInstance3D.new()
	grid.mesh = lines
	add_child(grid)
	var display: GridContainer = GridContainer.new()
	display.columns = 2
	display.add_theme_constant_override("h_separation", 0)
	display.add_theme_constant_override("v_separation", 0)
	add_child(display)
	for view: Dictionary in VIEWS:
		var viewport: SubViewport = SubViewport.new()
		viewport.size = Vector2i(960, 720)
		viewport.world_3d = get_world_3d()
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		viewport.msaa_3d = Viewport.MSAA_4X
		add_child(viewport)
		var camera: Camera3D = Camera3D.new()
		camera.projection = Camera3D.PROJECTION_ORTHOGONAL
		camera.size = view.size
		camera.near = 0.01
		viewport.add_child(camera)
		camera.position = view.eye
		camera.look_at(view.target)
		camera.make_current()
		viewports.append(viewport)
		var preview: TextureRect = TextureRect.new()
		preview.custom_minimum_size = Vector2(640, 480)
		preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		preview.texture = viewport.get_texture()
		display.add_child(preview)
	title = Label.new()
	title.position = Vector2(12, 10)
	add_child(title)

func capture() -> void:
	for view: Dictionary in VIEWS:
		DirAccess.make_dir_recursive_absolute(output_path + "frames/" + current_clip + "/" + view.name)
	for warmup: int in 5:
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
	var count: int = int(round(clip.length * (2 if current_clip == "idle" else 12 if current_clip == "walking" else 20) * 60.0))
	if "preview" in OS.get_cmdline_user_args():
		count = 1
	if "phases" in OS.get_cmdline_user_args():
		count = 8
	for frame: int in count:
		var time: float = clip.length * frame / 8.0 if "phases" in OS.get_cmdline_user_args() else fposmod(frame / 60.0, clip.length)
		seek(time)
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
		for index: int in VIEWS.size():
			var picture: Image = viewports[index].get_texture().get_image()
			var saved: Error = picture.save_jpg(output_path + "frames/" + current_clip + "/" + VIEWS[index].name + "/%05d.jpg" % frame, 0.96)
			assert(saved == OK)
		if frame % 240 == 0:
			print("CAPTURE ", current_clip, " ", frame, "/", count)
	assert(actor.transform.is_equal_approx(Transform3D.IDENTITY))
	print("CAPTURE COMPLETE ", current_clip, " frames=", count)
	get_tree().quit()
