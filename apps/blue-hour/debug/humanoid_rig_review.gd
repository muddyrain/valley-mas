extends Node3D
## Permanent shared inspector; imported skeletons remain authored in Blender.

const Catalog = preload("res://debug/humanoid_catalog.gd")
const Controller = preload("res://survivors/survivor_animation_controller.gd")
const POSES: Array[String] = ["原始姿势", "头向左", "头向右", "抬左臂 40°", "抬右臂 40°", "抬左腿", "抬右腿", "左膝弯曲", "右膝弯曲", "身体前倾", "左臂压力测试 60°", "右臂压力测试 60°"]

@export var initial_character_id: String = "xia_zhiyao"

var skeleton: Skeleton3D
var model: Node3D
var camera: Camera3D
var pose_label: Label
var source: Node3D
var character_index: int = 0
var controller: Node3D
var preview_rate: float = 1.0
var character_selector: OptionButton

func _ready() -> void:
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("#343e48")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color.WHITE
	environment.environment.ambient_light_energy = 0.65
	add_child(environment)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-45, -30, 0)
	light.light_energy = 1.2
	add_child(light)
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(5, 4)
	ground.mesh = plane
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#65717b")
	ground.material_override = material
	ground.position.y = -0.006
	add_child(ground)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 3.1
	add_child(camera)
	set_view(0)
	var layer := CanvasLayer.new()
	add_child(layer)
	var column := VBoxContainer.new()
	column.position = Vector2(18, 18)
	layer.add_child(column)
	var title := Label.new()
	title.text = "幸存者 · 骨骼检查\n左：原模型　右：绑定模型"
	column.add_child(title)
	character_selector = OptionButton.new()
	for character in Catalog.CHARACTERS:
		character_selector.add_item(character["name"])
	character_selector.item_selected.connect(set_character)
	column.add_child(character_selector)
	pose_label = Label.new()
	column.add_child(pose_label)
	for i in POSES.size():
		var button := Button.new()
		button.text = POSES[i]
		button.pressed.connect(set_pose.bind(i))
		column.add_child(button)
	for i in 3:
		var button := Button.new()
		button.text = ["游戏视角", "正面", "背面"][i]
		button.pressed.connect(set_view.bind(i))
		column.add_child(button)
	for clip in ["Idle", "Walk", "Run"]:
		var button := Button.new()
		button.text = clip
		button.pressed.connect(play_clip.bind(clip))
		column.add_child(button)
	var rate_slider := HSlider.new()
	rate_slider.min_value = .5
	rate_slider.max_value = 1.5
	rate_slider.step = .05
	rate_slider.value = 1.0
	rate_slider.value_changed.connect(func(value: float) -> void: preview_rate = value)
	column.add_child(rate_slider)
	var initial_index: int = 0
	for i in Catalog.CHARACTERS.size():
		if String(Catalog.CHARACTERS[i]["id"]) == initial_character_id:
			initial_index = i
			break
	set_character(initial_index)

func _process(delta: float) -> void:
	if is_instance_valid(controller) and controller.enabled:
		controller.advance_preview(delta, preview_rate)

func play_clip(clip: StringName) -> void:
	if not is_instance_valid(controller):
		controller = Controller.new()
		model.add_child(controller)
		assert(controller.initialize(model))
	controller.preview(clip)
	pose_label.text = clip

func set_character(index: int) -> void:
	character_index = index
	character_selector.select(index)
	if is_instance_valid(source):
		source.free()
	if is_instance_valid(model):
		model.free()
	controller = null
	var entry: Dictionary = Catalog.CHARACTERS[index]
	var source_scene: PackedScene = entry["source"]
	var rigged_scene: PackedScene = entry["rigged"]
	source = source_scene.instantiate() as Node3D
	source.position.x = -0.65
	add_child(source)
	model = rigged_scene.instantiate() as Node3D
	model.position.x = 0.65
	add_child(model)
	skeleton = find_skeleton(model)
	set_pose(0)

func set_pose(index: int) -> void:
	if is_instance_valid(controller):
		controller.set_enabled(false)
	skeleton.reset_bone_poses()
	match index:
		1: _rotate("Head", Vector3.UP, 25)
		2: _rotate("Head", Vector3.UP, -25)
		3: _rotate("LeftUpperArm", Vector3.BACK, 40)
		4: _rotate("RightUpperArm", Vector3.BACK, -40)
		5: _rotate("LeftUpperLeg", Vector3.RIGHT, -30)
		6: _rotate("RightUpperLeg", Vector3.RIGHT, -30)
		7:
			_rotate("LeftUpperLeg", Vector3.RIGHT, -25)
			_rotate("LeftLowerLeg", Vector3.RIGHT, 60)
		8:
			_rotate("RightUpperLeg", Vector3.RIGHT, -25)
			_rotate("RightLowerLeg", Vector3.RIGHT, 60)
		9: _rotate("Spine", Vector3.RIGHT, 12)
		10: _rotate("LeftUpperArm", Vector3.BACK, 60)
		11: _rotate("RightUpperArm", Vector3.BACK, -60)
	pose_label.text = POSES[index]

func set_view(index: int) -> void:
	camera.position = [Vector3(2.6, 3.6, 4), Vector3(0, 0.9, 5), Vector3(0, 0.9, -5)][index]
	camera.look_at(Vector3(0, 0.8, 0))
	camera.current = true

func _rotate(bone_name: String, axis: Vector3, degrees: float) -> void:
	var index := skeleton.find_bone(bone_name)
	var local_axis := skeleton.get_bone_global_rest(index).basis.inverse() * axis
	var rest_rotation := skeleton.get_bone_rest(index).basis.get_rotation_quaternion()
	skeleton.set_bone_pose_rotation(index, rest_rotation * Quaternion(local_axis.normalized(), deg_to_rad(degrees)))

static func find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node as Skeleton3D
	for child in node.get_children():
		var found := find_skeleton(child)
		if found:
			return found
	return null
