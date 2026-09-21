extends "res://tests/camp_hud_skeleton_runtime.gd"

const CAPTURES: String = "res://test-output/m09/"


func run() -> void:
	create_timer(90).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i.ZERO
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-utility.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var panel: Control = app.camp_ui.get_node("M09_Utility")
	var entry: StateButton = panel.get_node("Entry")
	var label: Label = entry.content.get_node("ReturnLabel")
	var keycap: Panel = entry.content.get_node("EscKeycap")
	var border: StyleBoxFlat = keycap.get_theme_stylebox("panel")
	var hit: Rect2 = entry.get_global_rect()
	check(hit == Rect2(30, 850, 150, 30), "150x30 hit area, 30px left / 20px bottom")
	check(keycap.size == Vector2(34, 24), "Keycap is 34x24")
	check(border.bg_color.a <= 0.08 and border.border_color.r == 1.0, "Transparent white-outline keycap")
	check(label.get_theme_color("font_color") == Color.WHITE, "Return text is white")
	check(label.position.x - keycap.position.x - keycap.size.x == 9, "9px text gap")
	check(not panel is Panel and panel.get_node_or_null("ModuleName") == null, "Debug panel removed")
	for visual: Control in entry.visual_root.find_children("*", "Control", true, false):
		check(visual.mouse_filter == Control.MOUSE_FILTER_IGNORE, "Visual ignores mouse: " + str(visual.name))
	for layer: TextureRect in entry.visual_root.find_children("*", "TextureRect", true, false):
		check(layer.texture == null, "No PNG textures used")
	await move_pointer(Vector2(800, 600), 0.16)
	check(is_equal_approx(label.modulate.a, 0.85), "Normal label alpha")
	await capture("normal")
	await frames(5)
	await move_pointer(hit.get_center(), 0.045)
	check(label.modulate.a > 0.85 and label.modulate.a < 1.0, "Smooth hover intermediate opacity")
	await create_timer(0.16).timeout
	check(is_equal_approx(label.modulate.a, 1.0) and border.border_color.a > 0.85, "Hover label and border brighten")
	await capture("hover")
	for index: int in range(20):
		var previous: Tween = entry._transition
		await move_pointer(Vector2(800, 600) if index % 2 == 0 else hit.get_center(), 0.01)
		check(entry.get_global_rect() == hit and entry.visual_root.scale == Vector2.ONE, "No hover displacement or scale")
		check(not previous.is_valid(), "Previous tween replaced")
	await move_pointer(Vector2(800, 600), 0.16)
	check(is_equal_approx(label.modulate.a, 0.85), "No residual hover")
	await capture("camp-overall")
	entry.disabled = true
	await create_timer(0.16).timeout
	await click(entry)
	check(app.state == "shelter", "Disabled departure lock prevents mouse return")
	entry.disabled = false
	await create_timer(0.16).timeout
	var snapshot: Dictionary = app.campaign.data.duplicate(true)
	await click(entry)
	await frames(5)
	check(app.state == "menu" and not is_instance_valid(app.camp_ui), "Mouse returns to existing menu")
	check(app.campaign.data == snapshot, "Mouse return preserves campaign")
	app.show_shelter()
	await frames(15)
	await key(KEY_ESCAPE)
	await frames(5)
	check(app.state == "menu" and not is_instance_valid(app.camp_ui), "Esc returns to same menu")
	check(app.campaign.data == snapshot, "Esc return preserves campaign")
	app.show_shelter()
	await frames(15)
	var menu: Button = app.camp_ui.get_node("M03_ResourceBar/MenuButton")
	check(menu.size == Vector2(116, 56) and not menu.disabled, "Top menu uses full original button bounds")
	for child: Control in menu.get_children():
		check(child.mouse_filter == Control.MOUSE_FILTER_IGNORE, "Top menu visuals never intercept input")
	var menu_rect: Rect2 = menu.get_global_rect()
	await move_pointer(menu_rect.get_center(), 0.16)
	check(root.gui_get_hovered_control() == menu, "Top menu is not covered by another control")
	await click(menu)
	await frames(3)
	check(app.state == "shelter" and is_instance_valid(app.camp_menu_overlay), "Top menu opens the Camp menu overlay")
	check(app.campaign.data == snapshot, "Top menu preserves campaign")
	await capture("top-menu-open")
	await click(app.camp_menu_overlay.continue_button)
	await frames(3)
	menu = app.camp_ui.get_node("M03_ResourceBar/MenuButton")
	for down: bool in [true, false]:
		var event: InputEventMouseButton = InputEventMouseButton.new()
		event.position = menu.get_global_rect().position + Vector2(3, 3)
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = down
		root.push_input(event, true)
		await process_frame
	check(app.state == "shelter" and is_instance_valid(app.camp_menu_overlay), "Top menu corner opens the overlay, not just icon or label")
	await key(KEY_ESCAPE)
	await frames(15)
	for dimensions: Vector2i in [Vector2i(1280, 720), Vector2i(1024, 640), Vector2i(1920, 1080)]:
		root.size = dimensions
		await frames(6)
		check(root.get_visible_rect().encloses(app.camp_ui.get_node("M09_Utility/Entry").get_global_rect()), "Utility stays in viewport")
	var report: FileAccess = FileAccess.open(CAPTURES + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("CAMP M09: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)


func move_pointer(point: Vector2, duration: float) -> void:
	var event: InputEventMouseMotion = InputEventMouseMotion.new()
	event.position = point
	root.push_input(event, true)
	await create_timer(duration).timeout


func capture(label: String) -> void:
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	check(screenshot.get_size() == Vector2i(1600, 900), "Native 1600x900 screenshot")
	check(screenshot.save_png(CAPTURES + label + ".png") == OK, "Saved " + label)
