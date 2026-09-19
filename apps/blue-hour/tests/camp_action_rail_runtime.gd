extends "res://tests/camp_hud_skeleton_runtime.gd"

const CAPTURE_DIR := "res://test-output/camp-action-rail/"
const ACTION_BG: Texture2D = preload("res://assets/ui/camp/m06/m06_action_button_bg.png")
const DISABLED_BG: Texture2D = preload("res://assets/ui/camp/m06/m06_action_button_disabled_bg.png")
const GLOW: Texture2D = preload("res://assets/ui/camp/m06/m06_action_button_hover_glow.png")

func run() -> void:
	create_timer(90).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i.ZERO
	DirAccess.make_dir_recursive_absolute(CAPTURE_DIR)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-action-rail.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var hud: Control = app.camp_ui
	var campaign_before: Dictionary = app.campaign.data.duplicate(true)
	var rail: Control = hud.get_node("M06_CampActionRail")
	var temporary: Button = rail.get_node("TemporaryBuff")
	var medical: Button = rail.get_node("MedicalSupport")
	var locked: Control = rail.get_node("LockedAction")
	check(app.state == "shelter" and app.camp_view.camera.current, "Existing Camp scene active")
	check(rail.get_global_rect() == Rect2(28, 278, 112, 330), "M06 keeps skeleton geometry")
	check(rail.get_node("TemporaryBuff/VisualRoot/NormalTexture").texture == ACTION_BG, "Temporary uses action background")
	check(rail.get_node("MedicalSupport/VisualRoot/NormalTexture").texture == ACTION_BG, "Medical uses action background")
	check(locked.get_node("VisualRoot/NormalTexture").texture == DISABLED_BG, "Locked uses disabled background")
	check(rail.get_node("TemporaryBuff/VisualRoot/HoverTexture").texture == GLOW and rail.get_node("MedicalSupport/VisualRoot/HoverTexture").texture == GLOW, "Available slots have hover glow")
	check(temporary.get_node("VisualRoot/KeyLabel").text == "Q" and medical.get_node("VisualRoot/KeyLabel").text == "E", "Q/E rendered dynamically")
	check(rail.get_node("TemporaryBuff/VisualRoot/Label").text == "临时增益" and rail.get_node("MedicalSupport/VisualRoot/Label").text == "医疗支援", "Available labels are correct")
	check(locked.get_node("VisualRoot/Label").text == "后续解锁\n敬请期待", "Locked label is correct")
	check(temporary.get_node("VisualRoot/Icon").size == Vector2(30, 30) and medical.get_node("VisualRoot/Icon").size == Vector2(30, 30), "Available icon sizes are stable")
	check(temporary.get_node("VisualRoot/Icon").position == Vector2(33, 26) and medical.get_node("VisualRoot/Icon").position == Vector2(33, 26), "Available icons share the visual center")
	check(locked.get_node("VisualRoot/Icon").position == Vector2(33, 26), "Locked icon shares the visual center")
	check(temporary.get_node("VisualRoot/Keycap").position == medical.get_node("VisualRoot/Keycap").position and temporary.get_node("VisualRoot/Keycap").position == Vector2(67, 56), "Keycaps share one lower-right anchor")
	for node_path: String in ["HoverTexture", "NormalTexture", "Icon", "Label", "Keycap", "KeyLabel"]:
		check(temporary.get_node("VisualRoot/" + node_path).mouse_filter == Control.MOUSE_FILTER_IGNORE, node_path + " ignores mouse input")
	check(temporary.position.y + 96.0 == medical.position.y and medical.position.y + 96.0 == locked.position.y, "Three slots use a uniform 96px step")
	check(locked.mouse_filter == Control.MOUSE_FILTER_IGNORE, "Locked slot does not receive hover")
	check(temporary.get_node("VisualRoot/HoverTexture").modulate.a == 0.0 and temporary.scale == Vector2.ONE and temporary.get_node("VisualRoot").scale == Vector2.ONE, "Normal has no glow or scale")
	await capture("camp-1600x900.png")
	await move_pointer(temporary.get_global_rect().get_center())
	check(temporary.get_node("VisualRoot/HoverTexture").modulate.a > 0.5 and temporary.get_node("VisualRoot/HoverTexture").modulate.a < 0.7, "Hover reveals restrained glow")
	check(temporary.scale == Vector2.ONE and temporary.get_node("VisualRoot").scale == Vector2.ONE, "Hover keeps the fixed hit area and visual scale")
	check(medical.get_node("VisualRoot/HoverTexture").modulate.a == 0.0, "Only hovered slot glows")
	await capture("camp-hover-1600x900.png")
	await move_pointer(medical.get_global_rect().get_center())
	check(medical.get_node("VisualRoot/HoverTexture").modulate.a > 0.5 and medical.scale == Vector2.ONE and medical.get_node("VisualRoot").scale == Vector2.ONE, "Medical hover uses the same aligned feedback")
	await capture("camp-hover-medical-1600x900.png")
	for button: Button in [temporary, medical]:
		await move_pointer(Vector2(800, 500))
		var hit_rect: Rect2 = button.get_global_rect()
		var visual: Control = button.get_node("VisualRoot")
		var bg: TextureRect = visual.get_node("NormalTexture")
		var bg_rect: Rect2 = bg.get_global_rect()
		var previous_tween: Tween = button._transition
		for index: int in range(20):
			var motion := InputEventMouseMotion.new()
			motion.position = hit_rect.position + Vector2(1 if index % 2 == 0 else -1, 41)
			root.push_input(motion, true)
			await process_frame
			check(button.get_global_rect() == hit_rect and button.scale == Vector2.ONE, "Rapid edge crossing keeps HitArea fixed")
			check(bg.get_global_rect() == bg_rect and visual.scale == Vector2.ONE, "Rapid hover never moves or resizes button art")
			check(not previous_tween.is_valid() and button._transition != previous_tween, "State change replaces prior tween")
			previous_tween = button._transition
		await move_pointer(hit_rect.get_center())
		check(bg.self_modulate.is_equal_approx(Color(1.05, 1.05, 1.05, 1)), "Hover background settles at mild brightness")
		await mouse_button(button, true)
		check(button.get_global_rect() == hit_rect and button.scale == Vector2.ONE and visual.scale.is_equal_approx(Vector2.ONE * 0.98), "Actual mouse press scales VisualRoot only")
		await mouse_button(button, false)
		await move_pointer(Vector2(800, 500))
		check(visual.scale.is_equal_approx(Vector2.ONE) and is_zero_approx(visual.get_node("HoverTexture").modulate.a) and bg.self_modulate.is_equal_approx(Color.WHITE), "Exit restores normal without residual tween")
	temporary.flash_pressed()
	await create_timer(0.08).timeout
	print("M06 PRESSED VISUAL SCALE ", temporary.get_node("VisualRoot").scale, " hit area ", temporary.scale)
	check(temporary.get_node("VisualRoot").scale.x < 1.0 and temporary.get_node("VisualRoot").scale.x > 0.97 and temporary.scale == Vector2.ONE, "Pressed scales only the visual root")
	await click(temporary)
	await frames(2)
	check(rail.last_action == "temporary_buff", "Temporary click emits local action")
	await click(medical)
	check(rail.last_action == "medical_support", "Medical click emits local action")
	await key(KEY_Q)
	await frames(2)
	check(rail.last_action == "temporary_buff", "Q triggers temporary action")
	await key(KEY_E)
	await frames(2)
	check(rail.last_action == "medical_support", "E triggers medical action")
	check(locked.get_node("VisualRoot/NormalTexture").texture == DISABLED_BG, "Locked remains disabled after input")
	for dimensions: Vector2i in [Vector2i(1600, 900), Vector2i(1280, 720), Vector2i(1024, 640), Vector2i(1920, 1080)]:
		root.size = dimensions
		await frames(8)
		verify_layout(hud, dimensions)
	check(app.campaign.data == campaign_before, "Camp action presentation does not replace campaign data")
	var report := FileAccess.open(CAPTURE_DIR + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "layouts": layouts}, "\t"))
	print("CAMP ACTION RAIL: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)

func move_pointer(position: Vector2) -> void:
	var event := InputEventMouseMotion.new()
	event.position = position
	root.push_input(event, true)
	await create_timer(0.18).timeout

func mouse_button(button: Button, down: bool) -> void:
	var event := InputEventMouseButton.new()
	event.position = button.get_global_rect().get_center()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = down
	root.push_input(event, true)
	if down:
		await create_timer(0.08).timeout
	else:
		await create_timer(0.12).timeout

func key(code: Key) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = code
	event.pressed = true
	root.push_input(event, true)
	await process_frame

func capture(filename: String) -> void:
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	check(screenshot.get_size() == Vector2i(1600, 900), "Screenshot native 1600x900")
	check(screenshot.save_png(CAPTURE_DIR + filename) == OK, "Saved " + filename)
