extends Node3D

# 营地场景 - 展示两个角色同屏

func _ready() -> void:
	# 设置环境
	var env = WorldEnvironment.new()
	var environment = Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.05, 0.07, 0.12)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.3, 0.3, 0.35)
	environment.ambient_light_energy = 0.5
	env.environment = environment
	add_child(env)

	# 添加主光源
	var light = DirectionalLight3D.new()
	light.position = Vector3(0, 10, 0)
	light.rotation_degrees = Vector3(-45, 30, 0)
	light.light_color = Color(1.0, 0.95, 0.9)
	light.light_energy = 1.2
	light.shadow_enabled = true
	add_child(light)

	# 添加补光
	var fill_light = DirectionalLight3D.new()
	fill_light.position = Vector3(0, 5, 0)
	fill_light.rotation_degrees = Vector3(-30, -45, 0)
	fill_light.light_color = Color(0.7, 0.8, 1.0)
	fill_light.light_energy = 0.4
	add_child(fill_light)

	# 添加地面
	var ground = MeshInstance3D.new()
	var plane_mesh = PlaneMesh.new()
	plane_mesh.size = Vector2(20, 20)
	ground.mesh = plane_mesh

	var ground_mat = StandardMaterial3D.new()
	ground_mat.albedo_color = Color(0.15, 0.15, 0.18)
	ground_mat.metallic = 0.0
	ground_mat.roughness = 0.8
	ground.material_override = ground_mat
	add_child(ground)

	# 设置摄像机
	var camera = Camera3D.new()
	camera.position = Vector3(0, 2, 6)
	camera.rotation_degrees = Vector3(-10, 0, 0)
	add_child(camera)

	# 加载角色
	var CharacterRegistry = preload("res://data/character_registry.gd")

	var xia = CharacterRegistry.get_definition("xia_zhiyao")
	var su = CharacterRegistry.get_definition("su_wanxing")

	if xia and ResourceLoader.exists(xia.model_path):
		var xia_scene = load(xia.model_path)
		var xia_instance = xia_scene.instantiate()
		xia_instance.position = Vector3(-1.5, 0, 0)
		add_child(xia_instance)
		print("✓ 夏知遥加载成功")

	if su and ResourceLoader.exists(su.model_path):
		var su_scene = load(su.model_path)
		var su_instance = su_scene.instantiate()
		su_instance.position = Vector3(1.5, 0, 0)
		add_child(su_instance)
		print("✓ 苏晚星加载成功")

	print("\n营地场景初始化完成")
	print("按 ESC 退出")

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		get_tree().quit()
