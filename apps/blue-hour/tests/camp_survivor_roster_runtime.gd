extends "res://tests/camp_hud_skeleton_runtime.gd"

const CAPTURE_DIR := "res://test-output/camp-survivor-roster-interaction/"
const NORMAL: Texture2D = preload("res://assets/ui/camp/m04/m04_portrait_frame_normal.png")
const SELECTED: Texture2D = preload("res://assets/ui/camp/m04/m04_portrait_frame_selected.png")
var selection_events: Array[int] = []

func run() -> void:
	create_timer(90).timeout.connect(func(): quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i.ZERO
	DirAccess.make_dir_recursive_absolute(CAPTURE_DIR)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-survivor-roster.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var before: Dictionary = app.campaign.data.duplicate(true)
	var camera: Transform3D = app.camp_view.camera.global_transform
	var roster: Control = app.camp_ui.get_node("M04_SurvivorRoster")
	var detail: Control = app.camp_ui.get_node("M05_SurvivorDetail")
	var detail_rect: Rect2 = detail.get_global_rect()
	check(app.state == "shelter" and app.camp_view.camera.current, "Camp scene active")
	check(roster.get_global_rect() == Rect2(1466, 126, 118, 436), "M04 required size and right margin")
	check(roster.get_node("Header/Title").text == "幸存者" and roster.get_node("Header/Count").text == "4/4", "Dynamic title and fixture count")
	check(roster.selected_index == -1 and not detail.visible, "Entry does not force a selection")
	roster.selection_changed.connect(func(index: int): selection_events.append(index))
	check(roster.get_node("Background").texture.get_size() == Vector2(236, 872), "Original panel PNG dimensions")
	for dimensions: Vector2i in [Vector2i(1600, 900), Vector2i(1280, 720), Vector2i(1024, 640), Vector2i(1920, 1080)]:
		root.size = dimensions
		await frames(8)
		verify_layout(app.camp_ui, dimensions)
		for index: int in range(4):
			var slot: Button = roster.get_node("Slot%02d" % (index + 1))
			var portrait: TextureRect = slot.get_node("PortraitTexture")
			var frame: TextureRect = slot.get_node("FrameTexture")
			check(slot.get_rect() == Rect2(12, 42 + index * 96, 94, 94), "Slot size and step")
			check(Rect2(Vector2.ZERO, roster.size).encloses(slot.get_rect()), "Slot enclosed by roster")
			check(portrait.size == Vector2(78, 78) and portrait.texture != null, "78px existing portrait")
			check(portrait.get_index() < frame.get_index(), "Frame overlays portrait")
			check(frame.size == Vector2(94, 94) and frame.texture.get_size() == Vector2(188, 188), "Frame source and display size")
			check(slot.get_node("StatusDots").get_child_count() == 4, "Four native status dots")
		for label: Label in roster.get_node("Header").get_children():
			check(label.get_minimum_size().x <= label.size.x and label.get_line_count() == 1, "Header text fits")
		for selected: int in [1, 3, 2, 0]:
			await click(roster.get_node("Slot%02d" % (selected + 1)))
			await create_timer(0.18).timeout
			check(roster.selected_index == selected, "Mouse selects intended slot")
			for index: int in range(4):
				var frame: TextureRect = roster.get_node("Slot%02d/FrameTexture" % (index + 1))
				check(frame.texture == (SELECTED if selected == index else NORMAL), "Exactly one selected frame")
				check(frame.self_modulate.is_equal_approx(Color.WHITE if selected == index else Color(0.78, 0.78, 0.78, 1.0)), "Selection restores original highlight; normal frame is subdued")
		var events_before: int = selection_events.size()
		await click(roster.get_node("Slot01"))
		roster.select_index(-1)
		roster.select_index(4)
		check(selection_events.size() == events_before and roster.selected_index == 0, "Repeated and invalid selection are inert")
		await RenderingServer.frame_post_draw
		var screenshot: Image = root.get_texture().get_image()
		check(screenshot.get_size() == dimensions, "Native screenshot dimensions")
		check(screenshot.save_png(CAPTURE_DIR + "camp-%dx%d.png" % [dimensions.x, dimensions.y]) == OK, "First-selection screenshot saved")
	check(selection_events == [1, 3, 2, 0, 1, 3, 2, 0, 1, 3, 2, 0, 1, 3, 2, 0], "Selection signals match clicks")
	root.size = Vector2i(1600, 900)
	await frames(8)
	await click(roster.get_node("Slot03"))
	await create_timer(0.18).timeout
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(CAPTURE_DIR + "camp-selected-third.png")
	check(detail.get_global_rect() == detail_rect and detail == app.camp_ui.get_node("M05_SurvivorDetail"), "M05 geometry and instance remain unchanged")
	check(app.campaign.data == before, "Fixture selection does not mutate campaign")
	check(app.camp_view.camera.global_transform == camera, "Camera remains unchanged")
	var report := FileAccess.open(CAPTURE_DIR + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "layouts": layouts}, "\t"))
	print("CAMP SURVIVOR ROSTER: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
