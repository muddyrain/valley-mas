extends SceneTree

func _init() -> void:
	print("\n========== 角色模型验证 ==========\n")

	var packed_scene = load("res://scenes/debug/character_showcase.tscn")
	var scene = packed_scene.instantiate()
	root.add_child(scene)

	# 等待 _ready 执行完成
	await create_timer(0.2).timeout

	print("\n角色加载统计:")

	# 遍历场景中的角色节点
	var char_count = 0
	var model_count = 0
	var placeholder_count = 0

	for node in scene.get_children():
		if node is Node3D and node.name != "WorldEnvironment" and node.name != "DirectionalLight3D" and node.name != "Camera3D":
			if node.get_child_count() > 0:
				char_count += 1
				var has_model = false
				for child in node.get_children():
					if child is Node3D and child.get_child_count() > 0:
						# 检查是否有实际模型（非占位符）
						for grandchild in child.get_children():
							if grandchild is MeshInstance3D and grandchild.mesh != null:
								var mesh_name = str(grandchild.mesh.get_class())
								if "BoxMesh" not in mesh_name:
									has_model = true
									break
				if has_model:
					model_count += 1
				else:
					placeholder_count += 1

	print("  - 总角色数: %d" % char_count)
	print("  - 加载模型: %d" % model_count)
	print("  - 占位符: %d" % placeholder_count)

	# 检查夏知遥和苏晚星的模型文件
	var xia_path = "res://assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb"
	var su_path = "res://assets/characters/su_wanxing/runtime/su_wanxing.glb"

	print("\n模型文件验证:")
	print("  - 夏知遥模型存在: %s" % ("是" if ResourceLoader.exists(xia_path) else "否"))
	print("  - 苏晚星模型存在: %s" % ("是" if ResourceLoader.exists(su_path) else "否"))

	if ResourceLoader.exists(xia_path):
		var xia_model = load(xia_path)
		print("  - 夏知遥模型类型: %s" % xia_model.get_class())

	if ResourceLoader.exists(su_path):
		var su_model = load(su_path)
		print("  - 苏晚星模型类型: %s" % su_model.get_class())

	print("\n========== 验证完成 ==========\n")

	quit()
