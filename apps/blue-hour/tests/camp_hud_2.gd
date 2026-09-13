extends "res://tests/day_loop_runtime.gd"
## Native screen-space QA with isolated saves; no production data or 3D changes.
const OUTPUT := "res://test-output/camp-hud-2/"
var center_measurements: Array[Dictionary] = []

func run() -> void:
	create_timer(100).timeout.connect(func(): printerr("CAMP HUD 2 TIMEOUT"); quit(2))
	root.size = Vector2i(1920, 1080)
	root.content_scale_size = Vector2i(1600, 900)
	root.unfocusable = true
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	await launch(true)
	app.campaign.new_run(772, "combat", ["xia_zhiyao", "su_wanxing"])
	app.selected_member = "su_wanxing"
	app.campaign.data.food = 30
	app.show_shelter()
	await frames(15)
	var before: Dictionary = app.campaign.data.duplicate(true)
	var camera: Transform3D = app.camp_view.camera.global_transform
	await key(KEY_1)
	check(is_instance_valid(app.camp_ui.detail_card) and app.camp_ui.detail_card.interactive, "Camp numeric shortcut opens the equipped ability without casting it")
	await key(KEY_ESCAPE)
	await click(app.camp_ui.member_buttons.su_wanxing)
	await shot("A-main-1920")
	await click(app.camp_ui.member_buttons.su_wanxing)
	check(app.camp_ui.drawer.member_id == "su_wanxing", "Su selection binds the formal character data")
	await shot("B-su-selected")
	await click(app.camp_ui.member_buttons.xia_zhiyao)
	check(app.camp_ui.drawer.member_name.text == app.campaign.member_template("xia_zhiyao").display_name, "Changing survivor updates name")
	check(app.camp_ui.drawer.data.talent.id == app.campaign.member_trait("xia_zhiyao").id, "Changing survivor updates talent")
	await shot("C-xia-selected")
	await click(app.camp_ui.member_buttons.su_wanxing)
	var quick: Button = app.camp_ui.find_child("Effect_power_rage", true, false)
	await hover(quick)
	check(quick._last_state == "hover", "Quick ability uses supplied hover state")
	await shot("D-quick-hover")
	await hover(app.camp_ui.hud_root.slot_buttons[0])
	check(app.camp_ui.hud_root.slot_buttons[0]._last_state == "hover", "Equipment uses supplied hover state")
	await shot("E-slot-hover")
	await click(app.camp_ui.hud_root.slot_buttons[0])
	check(app.camp_ui.hud_root.slot_buttons[0].selected_visual, "Pinned equipment uses selected overlay")
	await shot("E-slot-selected")
	await key(KEY_ESCAPE)
	await click(app.camp_ui.member_buttons.su_wanxing)
	await hover(app.camp_ui.departure)
	check(app.camp_ui.departure._last_state == "hover", "Departure uses supplied hover state")
	await shot("F-depart-hover")
	await press_at(app.camp_ui.departure.get_global_rect().get_center(), true)
	check(app.state == "shelter" and app.camp_ui.departure._last_state == "pressed", "Pressed art appears before release without early departure")
	await shot("G-depart-pressed")
	var outside := InputEventMouseMotion.new()
	outside.device = 42
	outside.position = Vector2(900, 820)
	outside.button_mask = MOUSE_BUTTON_MASK_LEFT
	root.push_input(outside, true)
	await press_at(Vector2(900, 820), false)
	await frames(3)
	check(app.state == "shelter", "Releasing outside cancels the CTA click")
	for button_node: Node in app.camp_ui.find_children("*", "Button", true, false):
		if button_node.get_script() == load("res://ui/camp/camp_texture_button.gd") and button_node.is_visible_in_tree():
			var entry: Button = button_node
			entry.set_debug_centers(true)
			if not entry.text.is_empty():
				var delta: float = absf(entry.get_global_rect().get_center().y - entry.content_group.get_global_rect().get_center().y)
				center_measurements.append({"button": entry.text, "logical_delta_y": delta})
				check(delta <= 2.0, "Centered content group: " + entry.text)
				await measure_glyphs(entry)
	await shot("H-button-centers")
	for button_node: Node in app.camp_ui.find_children("*", "Button", true, false):
		if button_node.has_method("set_debug_centers"):
			button_node.set_debug_centers(false)
	check(app.campaign.data == before, "Browsing all HUD states leaves campaign data untouched")
	check(app.camp_view.camera.global_transform == camera, "HUD interaction leaves camera unchanged")
	for dimensions: Vector2i in [Vector2i(2560, 1440), Vector2i(1366, 768)]:
		root.size = dimensions
		await frames(10)
		for control: Control in [app.camp_ui.drawer, app.camp_ui.party_panel, app.camp_ui.departure]:
			check(root.get_visible_rect().encloses(control.get_global_rect()), "HUD remains within viewport: " + str(dimensions))
		check(not app.camp_ui.drawer.get_global_rect().intersects(app.camp_ui.party_panel.get_global_rect()), "Details do not overlap roster: " + str(dimensions))
		await shot("responsive-%dx%d" % [dimensions.x, dimensions.y])
	root.size = Vector2i(1920, 1080)
	await frames(8)
	var old_level: int = app.campaign.member_level(app.selected_member)
	await click(app.camp_ui.training_button)
	check(app.campaign.member_level(app.selected_member) == old_level + 1, "Upgrade uses the existing food transaction")
	check(app.store.read(app.campaign.valid_state).data.roster[app.selected_member].level == old_level + 1, "Upgrade persists through the existing save store")
	await click(app.camp_ui.drawer.equipment_button)
	check(is_instance_valid(app.camp_ui.browser) and app.camp_ui.browser.inventory_mode, "Equipment action opens the existing inventory")
	await key(KEY_ESCAPE)
	await click(app.camp_ui.departure)
	check(app.state == "today_action", "CTA opens the existing TodayAction flow")
	check(not app.camp_ui.hud_root.visible, "TodayAction hides the camp HUD")
	await click(app.screen.cancel_button)
	check(app.state == "shelter" and app.camp_view.camera.global_transform == camera, "Cancel returns to the same camp and camera")
	var report := FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "centering": center_measurements}, "\t"))
	print("CAMP HUD 2: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(5)
	quit(0 if failures.is_empty() else 1)

func hover(control: Control) -> void:
	var motion := InputEventMouseMotion.new()
	motion.device = 42
	motion.position = control.get_global_rect().get_center()
	root.push_input(motion, true)
	await create_timer(0.35).timeout

func press_at(point: Vector2, pressed_value: bool) -> void:
	var event := InputEventMouseButton.new()
	event.device = 42
	event.position = point
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = pressed_value
	root.push_input(event, true)
	await frames(4)

func shot(label: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png(OUTPUT + label + ".png") == OK, "Native screenshot: " + label)

func measure_glyphs(button_node: Button) -> void:
	if DisplayServer.get_name() == "headless":
		return
	var viewport := SubViewport.new()
	viewport.size = Vector2i(button_node.size)
	viewport.disable_3d = true
	viewport.transparent_bg = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(viewport)
	var content: Control = button_node.content.duplicate()
	viewport.add_child(content)
	for graphic: Node in content.find_children("*", "TextureRect", true, false):
		graphic.modulate.a = 0
	await frames(3)
	await RenderingServer.frame_post_draw
	var pixels: Image = viewport.get_texture().get_image()
	var bounds: Rect2i = pixels.get_used_rect()
	var difference: float = absf(bounds.position.y + bounds.size.y * 0.5 - viewport.size.y * 0.5)
	var path: String = "text-mask-%02d.png" % center_measurements.size()
	pixels.save_png(OUTPUT + path)
	center_measurements.back().glyph_delta_y = difference
	center_measurements.back().glyph_bounds = str(bounds)
	center_measurements.back().native_mask = path
	check(difference <= 2.0, "Native glyph alpha bounds are visually centered within 2 px: " + button_node.text)
	viewport.queue_free()
	await frames(2)
