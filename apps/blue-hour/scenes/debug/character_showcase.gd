extends Node3D
# 角色展示测试场景，用于验证新角色模型加载
const Assets = preload("res://vfx/generated_assets.gd")
const Visuals = preload("res://vfx/visuals.gd")
const CharacterRegistry = preload("res://data/character_registry.gd")

var camera: Camera3D
var characters: Array[Node3D] = []

func _ready() -> void:
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color("#1a1f28")
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color("#b7c7cf")
	env.environment.ambient_light_energy = 0.8
	add_child(env)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-45, -30, 0)
	sun.light_color = Color("#ffdda5")
	sun.light_energy = 1.5
	sun.shadow_enabled = true
	add_child(sun)

	# 地面
	Visuals.box(self, Vector3(24, 0.2, 16), Vector3(0, -0.15, 0), Color("#556268"))

	camera = Camera3D.new()
	add_child(camera)
	camera.position = Vector3(0, 3.5, 8)
	camera.look_at(Vector3(0, 1.2, 0))
	camera.current = true

	_load_characters()

func _load_characters() -> void:
	var survivors: Array[Resource] = CharacterRegistry.all_survivors()
	var spacing: float = 3.0
	var start_x: float = -(survivors.size() - 1) * spacing * 0.5

	for i in range(survivors.size()):
		var survivor_data: Resource = survivors[i]
		var character := Node3D.new()
		add_child(character)
		character.position = Vector3(start_x + i * spacing, 0, 0)
		characters.append(character)

		# 显示模型或占位符
		if not survivor_data.model_path.is_empty() and ResourceLoader.exists(survivor_data.model_path):
			var model = load(survivor_data.model_path)
			if model is PackedScene:
				var instance = model.instantiate()
				character.add_child(instance)
				# 调整模型缩放和位置
				instance.scale = Vector3.ONE * 0.01
				instance.position.y = 0
			else:
				_create_placeholder(character, survivor_data)
		else:
			_create_placeholder(character, survivor_data)

		# 角色信息标签
		Visuals.label(character, survivor_data.display_name, Vector3(0, 2.2, 0), survivor_data.color, 28)

		var char_trait: Resource = CharacterRegistry.get_trait(survivor_data.trait_id)
		if char_trait != null:
			Visuals.label(character, char_trait.display_name, Vector3(0, 1.8, 0), Color.WHITE, 20)

		# 职业标签
		if not survivor_data.profession_name.is_empty():
			Visuals.label(character, survivor_data.profession_name, Vector3(0, 2.6, 0), Color("#ffcf8a"), 22)

		# 地面圆环
		Visuals.ring(character, Vector3(0, 0.02, 0), 0.8, survivor_data.color)

	print("已加载 %d 个角色到展示场景" % characters.size())

func _create_placeholder(parent: Node3D, survivor_data: Resource) -> void:
	# 创建占位体
	Visuals.box(parent, Vector3(0.6, 1.8, 0.4), Vector3(0, 0.9, 0), survivor_data.color)
	Visuals.box(parent, Vector3(0.8, 0.8, 0.8), Vector3(0, 0.4, 0), survivor_data.color.darkened(0.2))

func _process(_delta: float) -> void:
	# 简单的相机旋转
	if Input.is_action_pressed("ui_left"):
		camera.rotate_y(0.02)
	if Input.is_action_pressed("ui_right"):
		camera.rotate_y(-0.02)
	if Input.is_key_pressed(KEY_ESCAPE):
		get_tree().quit()
