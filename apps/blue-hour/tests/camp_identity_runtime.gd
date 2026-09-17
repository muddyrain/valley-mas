extends "res://tests/camp_hud_skeleton_runtime.gd"

const CAPTURE_DIR := "res://test-output/camp-identity-frozen/"
const COPY := {
	"CampNameCn": "东岸营地", "CampNameEn": "EAST COAST CAMP",
	"DayEn": "DAY 01", "DayCn": "第 1 天",
	"DescriptionLine1": "新的旅程，", "DescriptionLine2": "从这里出发。",
}

func run() -> void:
	create_timer(60).timeout.connect(func(): quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i.ZERO
	DirAccess.make_dir_recursive_absolute(CAPTURE_DIR)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-identity.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var before: Dictionary = app.campaign.data.duplicate(true)
	var identity: Control = app.camp_ui.get_node("M01_CampIdentity")
	check(identity.get_global_rect() == Rect2(24, 16, 228, 244), "M01 outer layout remains M00")
	check(identity.get_theme_stylebox("panel") is StyleBoxEmpty, "M01 debug plate is removed")
	var logo: TextureRect = identity.get_node("GameLogo/TextureRect")
	var background: NinePatchRect = identity.get_node("CampInfoPanel/Background")
	check(logo.size.is_equal_approx(Vector2(236, 104.22335)), "Logo keeps source aspect at approximately 230 visible pixels")
	check(background.get_global_rect().size.is_equal_approx(Vector2(238, 152)), "Nine-slice card renders at 238 by 152")
	check(background.region_rect == Rect2(55, 88, 1485, 828), "Nine-slice excludes source transparent padding")
	check(background.patch_margin_top == 200 and background.patch_margin_bottom == 450, "Nine-slice preserves paper header and lower torn edge")
	check(logo.texture.get_size() == Vector2(394, 174) and background.texture.get_size() == Vector2(1599, 984), "Supplied asset dimensions")
	check(logo.stretch_mode == TextureRect.STRETCH_KEEP_ASPECT_CENTERED, "Logo preserves aspect ratio")
	check(identity.find_children("*", "TextureRect", true, false).size() == 1 and identity.find_children("*", "NinePatchRect", true, false).size() == 1, "Logo texture and nine-slice card are the only image nodes")
	for texture: Texture2D in [logo.texture, background.texture]:
		var source := texture.get_image()
		check(source.get_pixel(0, 0).a == 0.0, "Transparent image corner: " + texture.resource_path)
	for dimensions: Vector2i in [Vector2i(1600, 900), Vector2i(1280, 720), Vector2i(1024, 640), Vector2i(1920, 1080)]:
		root.size = dimensions
		await frames(8)
		verify_layout(app.camp_ui, dimensions)
		var info: Control = identity.get_node("CampInfoPanel")
		check(Rect2(Vector2.ZERO, Vector2(dimensions)).encloses(logo.get_global_rect()), "Logo remains fully on screen")
		check(Rect2(Vector2.ZERO, Vector2(dimensions)).encloses(info.get_global_rect()), "Enlarged card stays on screen")
		for sibling: Node in app.camp_ui.get_children():
			if sibling != identity:
				check(not info.get_global_rect().intersects((sibling as Control).get_global_rect()), "Enlarged card clears " + sibling.name)
		var labels: Array[Rect2] = []
		for node_name: String in COPY:
			var label: Label = info.get_node(node_name)
			check(label.text == COPY[node_name], "Dynamic label copy: " + node_name)
			check(info.get_global_rect().encloses(label.get_global_rect()), "Text fits card: " + node_name)
			check(label.get_line_count() == 1 and label.get_minimum_size().x <= label.size.x, "Text fits one line: " + node_name)
			for rect: Rect2 in labels:
				check(not rect.intersects(label.get_global_rect()), "No text overlap: " + node_name)
			labels.append(label.get_global_rect())
		await RenderingServer.frame_post_draw
		var screenshot := root.get_texture().get_image()
		check(screenshot.get_size() == dimensions, "Native capture dimensions")
		check(screenshot.save_png(CAPTURE_DIR + "camp-%dx%d.png" % [dimensions.x, dimensions.y]) == OK, "Native capture saved")
	check(app.campaign.data == before, "M01 presentation does not mutate gameplay")
	var report := FileAccess.open(CAPTURE_DIR + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "layouts": layouts}, "\t"))
	print("CAMP IDENTITY: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
