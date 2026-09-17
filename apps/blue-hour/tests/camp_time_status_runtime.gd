extends "res://tests/camp_hud_skeleton_runtime.gd"

const CAPTURE_DIR := "res://test-output/camp-time-status-frozen/"
const COPY := {
	"CurrentTimeBlock/PhaseLabel": "白昼",
	"CurrentTimeBlock/TimeLabel": "10:24",
	"PhaseTimeline/LabelDay": "白昼",
	"PhaseTimeline/LabelDusk": "黄昏",
	"PhaseTimeline/LabelWarning": "蓝时预警",
	"PhaseTimeline/LabelBlueHour": "蓝时",
	"WaveCountdown/WaveLabel": "第 1 波",
	"WaveCountdown/CountdownTitle": "距离蓝时还有",
	"WaveCountdown/CountdownValue": "08:36:12",
}

func run() -> void:
	create_timer(60).timeout.connect(func(): quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i.ZERO
	DirAccess.make_dir_recursive_absolute(CAPTURE_DIR)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-time-status.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var before: Dictionary = app.campaign.data.duplicate(true)
	var camera: Transform3D = app.camp_view.camera.global_transform
	var status: Control = app.camp_ui.get_node("M02_TimeStatus")
	check(app.state == "shelter" and app.camp_view.camera.current, "Camp scene and camera are active")
	check(status.get_global_rect() == Rect2(480, 16, 568, 76), "M02 keeps M00 bounds")
	check(status.get_theme_stylebox("panel") is StyleBoxEmpty, "No placeholder panel remains")
	check(status.find_children("*", "TextureRect", true, false).size() == 2, "Only two supplied PNGs")
	check(status.find_children("*", "BaseButton", true, false).is_empty(), "M02 has no button states")
	var background: TextureRect = status.get_node("Background")
	var sun: TextureRect = status.get_node("CurrentTimeBlock/SunIcon")
	check(background.texture.get_size() == Vector2(1136, 152), "Original background dimensions")
	check(sun.texture.get_size() == Vector2(64, 64) and sun.size == Vector2(30, 30), "Original sun at 30px")
	for texture: TextureRect in [background, sun]:
		check(texture.stretch_mode == TextureRect.STRETCH_KEEP_ASPECT_CENTERED, "Artwork preserves aspect")
	var phase_nodes: Array[Control] = []
	for node_name: String in ["NodeDay", "NodeDusk", "NodeWarning", "NodeBlueHour"]:
		phase_nodes.append(status.get_node("PhaseTimeline/" + node_name))
	for index: int in range(1, phase_nodes.size()):
		check(is_equal_approx(phase_nodes[index].get_rect().get_center().x - phase_nodes[index - 1].get_rect().get_center().x, 74), "Even phase spacing")
	var current_style: StyleBoxFlat = phase_nodes[0].get_theme_stylebox("panel")
	check(current_style.bg_color.r > 0.9 and current_style.border_color.b > 0.7, "Current day has warm center and blue border")
	for dimensions: Vector2i in [Vector2i(1600, 900), Vector2i(1280, 720), Vector2i(1024, 640), Vector2i(1920, 1080)]:
		root.size = dimensions
		await frames(8)
		verify_layout(app.camp_ui, dimensions)
		var label_rects: Array[Rect2] = []
		for node_path: String in COPY:
			var label: Label = status.get_node(node_path)
			var block: Control = status.get_node(node_path.get_slice("/", 0))
			check(label.text == COPY[node_path], "Dynamic text: " + node_path)
			check(Rect2(Vector2.ZERO, block.size).encloses(label.get_rect()), "Text stays in its section: " + node_path)
			check(label.get_line_count() == 1 and label.get_minimum_size().x <= label.size.x, "No text truncation: " + node_path)
			for rect: Rect2 in label_rects:
				check(not rect.grow(-0.01).intersects(label.get_global_rect()), "No label overlap: " + node_path)
			label_rects.append(label.get_global_rect())
		var factor: float = status.scale.x
		for index: int in range(phase_nodes.size()):
			var label: Label = status.get_node("PhaseTimeline/" + ["LabelDay", "LabelDusk", "LabelWarning", "LabelBlueHour"][index])
			check(is_equal_approx(label.get_global_rect().get_center().x, phase_nodes[index].get_global_rect().get_center().x), "Phase text centers on node")
		check(status.get_node("CurrentTimeBlock").get_global_rect().end.x <= status.global_position.x + 155 * factor + 0.01, "Left section respects first baked divider")
		check(status.get_node("PhaseTimeline").get_global_rect().end.x <= status.global_position.x + 465 * factor, "Timeline respects second baked divider")
		check(status.get_node("WaveCountdown").position.x > 465, "Countdown clears second baked divider")
		await RenderingServer.frame_post_draw
		var screenshot: Image = root.get_texture().get_image()
		check(screenshot.get_size() == dimensions, "Native screenshot dimensions")
		check(screenshot.save_png(CAPTURE_DIR + "camp-%dx%d.png" % [dimensions.x, dimensions.y]) == OK, "Native screenshot saved")
	check(app.campaign.data == before, "Presentation never mutates gameplay")
	check(app.camp_view.camera.global_transform == camera, "Camera remains unchanged")
	var report := FileAccess.open(CAPTURE_DIR + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "layouts": layouts}, "\t"))
	print("CAMP TIME STATUS: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
