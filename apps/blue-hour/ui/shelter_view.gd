extends SubViewportContainer
signal member_selected(id: String)
const Assets = preload("res://vfx/generated_assets.gd")
const Visuals = preload("res://vfx/visuals.gd")
const Survivor = preload("res://survivors/survivor.gd")
const LAYOUT = preload("res://data/shelter_layout.tres")
var viewport: SubViewport
var camera: Camera3D
var members: Dictionary = {}

func setup(game: RefCounted) -> void:
	stretch = true
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	custom_minimum_size = Vector2(300, 340)
	viewport = SubViewport.new()
	viewport.own_world_3d = true
	viewport.size = Vector2i(760, 440)
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	var world := Node3D.new()
	viewport.add_child(world)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color("#344552")
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color("#b7c7cf")
	env.environment.ambient_light_energy = 0.65
	world.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-45, -30, 0)
	sun.light_color = Color("#ffdda5")
	sun.light_energy = 1.25
	sun.shadow_enabled = true
	world.add_child(sun)
	Visuals.box(world, Vector3(36, 0.3, 28), Vector3(0, -0.2, 0), Color("#656b6d"))
	for entry in LAYOUT.placements:
		Assets.spawn(entry.asset, world, entry.position, entry.yaw)
	camera = Camera3D.new()
	world.add_child(camera)
	camera.position = LAYOUT.camera_position
	camera.look_at(LAYOUT.camera_target)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = LAYOUT.camera_size
	camera.current = true
	for i in range(game.data.members.size()):
		var id: String = game.data.members[i]
		var actor := Survivor.new()
		world.add_child(actor)
		actor.setup(game.member_template(id).duplicate(), game.member_trait(id), game.weapon(game.data.equipment[id]))
		actor.position = LAYOUT.member_positions[i % LAYOUT.member_positions.size()]
		members[id] = actor
	gui_input.connect(_clicked)

func member_point(id: String) -> Vector2:
	return camera.unproject_position(members[id].position + Vector3.UP) * size / Vector2(viewport.size)

func _clicked(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var closest := ""
		var distance := 48.0
		for id in members:
			var current: float = member_point(id).distance_to(event.position)
			if current < distance:
				closest = id
				distance = current
		if not closest.is_empty():
			member_selected.emit(closest)

func select(id: String) -> void:
	for key in members:
		members[key].duty_ring.visible = key == id
