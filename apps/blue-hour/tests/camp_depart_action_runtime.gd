extends "res://tests/camp_hud_skeleton_runtime.gd"
## Exercises the real navigation with an isolated save and native viewport input.

const CAPTURES: String = "res://test-output/m08/"


func run() -> void:
	create_timer(100).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i.ZERO
	DirAccess.make_dir_recursive_absolute(CAPTURES)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-depart-action.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var panel: Control = app.camp_ui.get_node("M08_DepartAction")
	var entry: StateButton = panel.get_node("Entry")
	var camp: Node = app.camp_view
	var camera: Transform3D = app.camp_view.camera.global_transform
	var campaign: Dictionary = app.campaign.data.duplicate(true)
	var hit: Rect2 = entry.get_global_rect()
	check(app.state == "shelter" and app.camp_view.camera.current, "Real Camp and camera active")
	check(panel.get_global_rect() == Rect2(1264, 744, 320, 112), "Existing M08 outer layout preserved")
	check(hit == Rect2(1284, 784, 300, 86), "Fixed 300x86 button with 16px right and 30px bottom safe margins")
	check(not hit.intersects(app.camp_ui.get_node("M07_LoadoutPanel").get_global_rect()), "M08 does not cover M07")
	check(panel.get_node_or_null("ModuleName") == null and not panel is Panel, "Black debug panel removed")
	check(entry.content.get_node("DepartIcon").size == Vector2(46, 46), "Depart icon is 46x46")
	for layer: TextureRect in [entry.normal_layer, entry.hover_layer, entry.disabled_layer]:
		check(layer.get_global_rect() == hit, "All state canvases have identical bounds and center")
	for visual: Control in entry.visual_root.find_children("*", "Control", true, false):
		check(visual.mouse_filter == Control.MOUSE_FILTER_IGNORE, "Only Entry handles input: " + str(visual.name))
	for label: Label in [entry.content.get_node("TitleLabel"), entry.content.get_node("SubtitleLabel")]:
		var font: Font = label.get_theme_font("font")
		check(font.get_string_size(label.text, HORIZONTAL_ALIGNMENT_LEFT, -1, label.get_theme_font_size("font_size")).x <= label.size.x, "Dynamic text fits: " + label.text)
	await move_pointer(Vector2(800, 600), 0.16)
	await capture_m08("normal")
	# Exclude synchronous PNG readback/encoding time from the next animation tick.
	await frames(5)
	await move_pointer(hit.get_center(), 0.045)
	print("M08 hover sample: ", entry.weights, " FPS: ", Engine.get_frames_per_second())
	check(entry.weights.y > 0.0 and entry.weights.y < 1.0, "Hover cross-fade has intermediate alpha")
	check(is_equal_approx(entry.weights.x + entry.weights.y, 1.0), "Normal and hover cross-fade together")
	await create_timer(0.16).timeout
	check(is_equal_approx(entry.weights.y, 1.0), "Hover completes")
	await capture_m08("hover")
	for index: int in range(20):
		var previous: Tween = entry._transition
		await move_pointer(Vector2(800, 600) if index % 2 == 0 else hit.get_center(), 0.01)
		check(entry.get_global_rect() == hit and entry.visual_root.scale == Vector2.ONE, "Rapid enter/exit preserves geometry")
		check(not previous.is_valid(), "Previous hover tween replaced")
	await move_pointer(Vector2(800, 600), 0.16)
	check(is_zero_approx(entry.weights.y), "No residual hover")
	panel.set_depart_enabled(false)
	await create_timer(0.18).timeout
	await move_pointer(hit.get_center(), 0.16)
	await click(entry)
	check(app.state == "shelter" and entry.weights == Vector4(0, 0, 0, 1), "Disabled click and hover do not navigate or highlight")
	check(is_equal_approx(entry.content.modulate.a, 0.45), "Disabled icon and text dim together")
	await move_pointer(Vector2(800, 600), 0.16)
	await capture_m08("disabled")
	panel.set_depart_enabled(true)
	await create_timer(0.18).timeout
	check(is_equal_approx(entry.content.modulate.a, 1.0), "Enabled content opacity restored")
	await capture_m08("camp-overall")
	check(app.campaign.data == campaign, "Presentation states leave Campaign unchanged")
	for dimensions: Vector2i in [Vector2i(1280, 720), Vector2i(1024, 640), Vector2i(1920, 1080)]:
		root.size = dimensions
		await frames(8)
		check(root.get_visible_rect().encloses(entry.get_global_rect()), "Button stays onscreen at " + str(dimensions))
		check(entry.normal_layer.get_global_rect() == entry.hover_layer.get_global_rect(), "Responsive state layers remain aligned")
	root.size = Vector2i(1600, 900)
	await frames(8)
	for index: int in range(3):
		await click(entry)
		await create_timer(0.6).timeout
		check(app.state == "today_action" and app.camp_view.interaction_locked, "Enabled click opens existing Mission Selection")
		check(app.camp_view == camp, "Opening reuses the Camp instance")
		await click(app.screen.cancel_button)
		await create_timer(0.4).timeout
		check(app.state == "shelter" and not app.camp_view.interaction_locked, "Cancel restores Camp interaction")
		check(entry.get_global_rect() == hit and entry.visual_root.scale == Vector2.ONE, "Repeated navigation preserves hit area")
	check(app.camp_view.camera.global_transform == camera, "Camp camera unchanged")
	await click(entry)
	await create_timer(0.6).timeout
	await click(app.screen.cards["commercial"])
	await create_timer(0.2).timeout
	await click(app.screen.confirm_button)
	await frames(3)
	check(app.state == "departure", "Only existing mission confirmation starts bus departure")
	await create_timer(0.18).timeout
	check(entry.disabled and entry.weights.w == 1.0 and is_equal_approx(entry.content.modulate.a, 0.45), "Existing native departure lock also dims M08")
	var deadline: int = Time.get_ticks_msec() + 45000
	while app.state == "departure" and Time.get_ticks_msec() < deadline:
		await process_frame
	check(app.state == "mission" and is_instance_valid(app.mission), "Existing bus departure reaches Mission")
	var report: FileAccess = FileAccess.open(CAPTURES + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("CAMP M08: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)


func move_pointer(point: Vector2, duration: float) -> void:
	var event: InputEventMouseMotion = InputEventMouseMotion.new()
	event.position = point
	root.push_input(event, true)
	await create_timer(duration).timeout


func capture_m08(label: String) -> void:
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	check(screenshot.get_size() == Vector2i(1600, 900), "Native 1600x900 capture")
	check(screenshot.save_png(CAPTURES + label + ".png") == OK, "Saved " + label)
