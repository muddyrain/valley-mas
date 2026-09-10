extends SceneTree
# 截图验证角色展示

func _init() -> void:
	print("\n开始截图验证...")

	var packed_scene = load("res://scenes/debug/character_showcase.tscn")
	var scene = packed_scene.instantiate()
	root.add_child(scene)

	# 等待场景加载
	await get_tree().create_timer(0.5).timeout

	# 截图
	var viewport = get_root()
	var image = viewport.get_texture().get_image()
	var screenshot_path = "user://character_showcase.png"
	image.save_png(screenshot_path)

	var absolute_path = ProjectSettings.globalize_path(screenshot_path)
	print("截图已保存到: %s" % absolute_path)

	quit()
