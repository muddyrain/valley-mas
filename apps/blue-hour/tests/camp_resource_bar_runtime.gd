extends "res://tests/camp_hud_skeleton_runtime.gd"

const CAPTURE_DIR := "res://test-output/camp-resource-bar-frozen/"
const ITEMS := ["ResourceFood", "ResourceScrap", "ResourceIntel", "MenuButton"]
const COPY := {
	"ResourceFood/Label": "食物", "ResourceFood/Value": "10",
	"ResourceScrap/Label": "废料", "ResourceScrap/Value": "60",
	"ResourceIntel/Label": "情报", "ResourceIntel/Value": "3",
	"MenuButton/LabelCn": "菜单", "MenuButton/LabelEn": "MENU",
}

func run() -> void:
	create_timer(60).timeout.connect(func(): quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i.ZERO
	DirAccess.make_dir_recursive_absolute(CAPTURE_DIR)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-resource-bar.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var before: Dictionary = app.campaign.data.duplicate(true)
	var camera: Transform3D = app.camp_view.camera.global_transform
	var bar: Control = app.camp_ui.get_node("M03_ResourceBar")
	check(app.state == "shelter" and app.camp_view.camera.current, "Camp scene is active")
	check(bar.get_global_rect() == Rect2(1120, 20, 464, 60), "M03 keeps M00 outer bounds")
	check(bar.get_theme_stylebox("panel") is StyleBoxEmpty, "Placeholder plate removed")
	check(bar.get_child_count() == 4, "Four independent items")
	check(bar.find_children("*", "TextureRect", true, false).size() == 8, "Four backgrounds and four icons")
	var chip: Texture2D = bar.get_node("ResourceFood/Background").texture
	for index: int in range(ITEMS.size()):
		var item: Control = bar.get_node(ITEMS[index])
		var background: TextureRect = item.get_node("Background")
		var icon: TextureRect = item.get_node("Icon")
		var menu: bool = index == 3
		check(item.size == Vector2(116 if menu else 103, 56), "Item target dimensions")
		check(background.texture.get_size() == Vector2(232 if menu else 206, 112), "Original background size")
		check(icon.texture.get_size() == Vector2(48 if menu else 64, 48 if menu else 64), "Original icon size")
		check(icon.size == Vector2(24 if menu else 34, 24 if menu else 34), "Icon display size")
		if not menu:
			check(background.texture == chip, "Resource backgrounds share one texture")
		for texture: TextureRect in [background, icon]:
			check(texture.stretch_mode == TextureRect.STRETCH_KEEP_ASPECT_CENTERED, "Artwork preserves aspect")
		if index > 0:
			var previous: Control = bar.get_node(ITEMS[index - 1])
			check(item.position.x - previous.get_rect().end.x == (10 if menu else 13), "Card spacing")
	for dimensions: Vector2i in [Vector2i(1600, 900), Vector2i(1280, 720), Vector2i(1024, 640), Vector2i(1920, 1080)]:
		root.size = dimensions
		await frames(8)
		verify_layout(app.camp_ui, dimensions)
		var rectangles: Array[Rect2] = []
		for item_name: String in ITEMS:
			var item: Control = bar.get_node(item_name)
			check(Rect2(Vector2.ZERO, bar.size).encloses(item.get_rect()), "Item stays inside M03")
			for rect: Rect2 in rectangles:
				check(not rect.intersects(item.get_global_rect()), "Items do not overlap")
			rectangles.append(item.get_global_rect())
		var label_rects: Array[Rect2] = []
		for node_path: String in COPY:
			var label: Label = bar.get_node(node_path)
			var item: Control = bar.get_node(node_path.get_slice("/", 0))
			var icon: TextureRect = item.get_node("Icon")
			check(label.text == COPY[node_path], "Dynamic text: " + node_path)
			check(Rect2(Vector2.ZERO, item.size).encloses(label.get_rect()), "Text stays inside card")
			check(label.get_line_count() == 1 and label.get_minimum_size().x <= label.size.x, "No text truncation")
			check(not icon.get_global_rect().intersects(label.get_global_rect()), "Icon clears text")
			for rect: Rect2 in label_rects:
				check(not rect.grow(-0.01).intersects(label.get_global_rect()), "No text overlap")
			label_rects.append(label.get_global_rect())
		await RenderingServer.frame_post_draw
		var screenshot: Image = root.get_texture().get_image()
		check(screenshot.get_size() == dimensions, "Native screenshot dimensions")
		check(screenshot.save_png(CAPTURE_DIR + "camp-%dx%d.png" % [dimensions.x, dimensions.y]) == OK, "Native screenshot saved")
	check(app.campaign.data == before, "Fixed resource display does not mutate gameplay")
	check(app.camp_view.camera.global_transform == camera, "Camera unchanged")
	var report := FileAccess.open(CAPTURE_DIR + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "layouts": layouts}, "\t"))
	print("CAMP RESOURCE BAR: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
