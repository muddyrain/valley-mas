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
	check(rail.get_node("TemporaryBuff/ButtonBG").texture == ACTION_BG, "Temporary uses action background")
	check(rail.get_node("MedicalSupport/ButtonBG").texture == ACTION_BG, "Medical uses action background")
	check(locked.get_node("ButtonBG").texture == DISABLED_BG, "Locked uses disabled background")
	check(rail.get_node("TemporaryBuff/HoverGlow").texture == GLOW and rail.get_node("MedicalSupport/HoverGlow").texture == GLOW, "Available slots have hover glow")
	check(temporary.get_node("KeyLabel").text == "Q" and medical.get_node("KeyLabel").text == "E", "Q/E rendered dynamically")
	check(rail.get_node("TemporaryBuff/Label").text == "临时增益" and rail.get_node("MedicalSupport/Label").text == "医疗支援", "Available labels are correct")
	check(locked.get_node("Label").text == "后续解锁\n敬请期待", "Locked label is correct")
	check(temporary.get_node("Icon").size == Vector2(30, 30) and medical.get_node("Icon").size == Vector2(30, 30), "Available icon sizes are stable")
	check(temporary.get_node("Icon").position == Vector2(33, 26) and medical.get_node("Icon").position == Vector2(33, 26), "Available icons share the visual center")
	check(locked.get_node("Icon").position == Vector2(33, 26), "Locked icon shares the visual center")
	check(temporary.get_node("Keycap").position == medical.get_node("Keycap").position and temporary.get_node("Keycap").position == Vector2(67, 56), "Keycaps share one lower-right anchor")
	check(temporary.position.y + 96.0 == medical.position.y and medical.position.y + 96.0 == locked.position.y, "Three slots use a uniform 96px step")
	check(locked.mouse_filter == Control.MOUSE_FILTER_IGNORE, "Locked slot does not receive hover")
	check(temporary.get_node("HoverGlow").modulate.a == 0.0 and temporary.scale == Vector2.ONE, "Normal has no glow or scale")
	await capture("camp-1600x900.png")
	await move_pointer(temporary.get_global_rect().get_center())
	check(temporary.get_node("HoverGlow").modulate.a > 0.5 and temporary.get_node("HoverGlow").modulate.a < 0.7, "Hover reveals restrained glow")
	check(temporary.scale.is_equal_approx(Vector2.ONE * 1.02), "Hover scales to 1.02")
	check(medical.get_node("HoverGlow").modulate.a == 0.0, "Only hovered slot glows")
	await capture("camp-hover-1600x900.png")
	await move_pointer(medical.get_global_rect().get_center())
	check(medical.get_node("HoverGlow").modulate.a > 0.5 and medical.scale.is_equal_approx(Vector2.ONE * 1.02), "Medical hover uses the same aligned feedback")
	await capture("camp-hover-medical-1600x900.png")
	temporary.flash_pressed()
	await create_timer(0.08).timeout
	print("M06 PRESSED SCALE ", temporary.scale, " action ", rail.last_action)
	check(temporary.scale.x < 1.0 and temporary.scale.x > 0.97, "Pressed scales down briefly")
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
	check(locked.get_node("ButtonBG").texture == DISABLED_BG, "Locked remains disabled after input")
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
