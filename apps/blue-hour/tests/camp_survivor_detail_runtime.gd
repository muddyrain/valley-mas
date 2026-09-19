extends "res://tests/camp_hud_skeleton_runtime.gd"

const CAPTURE_DIR := "res://test-output/camp-survivor-detail/"
const NORMAL: Texture2D = preload("res://assets/ui/camp/m04/m04_portrait_frame_normal.png")
const SELECTED: Texture2D = preload("res://assets/ui/camp/m04/m04_portrait_frame_selected.png")

func run() -> void:
	create_timer(90).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i.ZERO
	DirAccess.make_dir_recursive_absolute(CAPTURE_DIR)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-survivor-detail.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var hud: Control = app.camp_ui
	var roster: Control = hud.get_node("M04_SurvivorRoster")
	var detail: Control = hud.get_node("M05_SurvivorDetail")
	var detail_instance: int = detail.get_instance_id()
	var before: Dictionary = app.campaign.data.duplicate(true)
	var camera: Transform3D = app.camp_view.camera.global_transform
	var slot: Button = roster.get_node("Slot01")
	var frame: TextureRect = slot.get_node("FrameTexture")
	var portrait: TextureRect = slot.get_node("PortraitTexture")
	check(app.state == "shelter" and app.camp_view.camera.current, "Existing Camp scene active")
	check(not detail.visible and hud.selected_survivor_id == null and roster.selected_index == -1, "Entry has no selection and hidden detail")
	check(roster.get_global_rect() == Rect2(1466, 126, 118, 436), "M04 geometry frozen")
	check(detail.get_global_rect() == Rect2(1100, 278, 354, 452), "M05 uses existing geometry")
	for index: int in range(4):
		var item: Button = roster.get_node("Slot%02d" % (index + 1))
		check(item.get_rect() == Rect2(12, 42 + index * 96, 94, 94), "Slot geometry frozen")
		check(item.get_node("PortraitTexture").size == Vector2(78, 78), "Portrait size frozen")
		check(item.get_node("FrameTexture").texture == NORMAL, "No initial selected frame")
		check(item.mouse_default_cursor_shape == Control.CURSOR_POINTING_HAND, "Clickable cursor")
	await capture("camp-initial-1600x900.png")
	await click(hud.get_node("M08_DepartAction/Entry"))
	await frames(20)
	await key(KEY_ESCAPE)
	await frames(20)
	check(app.state == "shelter" and not detail.visible, "Overlay return does not open unselected M05")
	await move_pointer(slot.get_global_rect().get_center())
	check(frame.texture == NORMAL, "Hover keeps normal PNG")
	check(frame.self_modulate.is_equal_approx(Color(0.90, 0.93, 0.94, 1)), "Hover lifts normal brightness with restrained cyan tint")
	check(portrait.self_modulate.is_equal_approx(Color(1.06, 1.06, 1.06, 1)), "Hover portrait brightens six percent")
	check(slot.scale.is_equal_approx(Vector2.ONE * 1.02), "Hover scale settles at 1.02")
	check(not detail.visible, "Hover does not select or show detail")
	await capture("camp-hover-1600x900.png")
	await mouse_button(slot, true)
	check(slot.scale.is_equal_approx(Vector2.ONE * 0.98), "Pressed scale settles at 0.98")
	check(not detail.visible, "Press waits for release to select")
	await mouse_button(slot, false)
	check(detail.visible and roster.selected_index == 0 and hud.selected_survivor_id == "su_wanxing", "Release selects first fixture and opens M05")
	check(frame.texture == SELECTED and frame.self_modulate.is_equal_approx(Color.WHITE), "Selected retains original PNG and brightness while hovered")
	check(portrait.self_modulate.is_equal_approx(Color.WHITE) and slot.scale.is_equal_approx(Vector2.ONE), "Selected hover has no extra glow or scale")
	var first_name: String = detail.get_node("HeaderPanel/SurvivorName").text
	var first_role: String = detail.get_node("HeaderPanel/RoleLabel").text
	var first_portrait: Texture2D = detail.get_node("HeaderPanel/HalfPortrait").texture
	var first_weapon: String = detail.get_node("CombatPanel/WeaponName").text
	var first_power: String = detail.get_node("CombatPanel/PowerValue").text
	var first_attribute: float = detail.get_node("AttributesPanel/Survival/Bar").value
	await capture("camp-selected-first-1600x900.png")
	var second: Button = roster.get_node("Slot02")
	await move_pointer(second.get_global_rect().get_center())
	await capture("camp-selected-and-hover-1600x900.png")
	await click(second)
	await create_timer(0.18).timeout
	check(roster.selected_index == 1 and hud.selected_survivor_id == "xia_zhiyao", "Second click selects matching ID")
	check(detail.get_node("HeaderPanel/SurvivorName").text != first_name, "Name refreshes")
	check(detail.get_node("HeaderPanel/RoleLabel").text != first_role, "Role refreshes")
	check(detail.get_node("HeaderPanel/HalfPortrait").texture != first_portrait, "Portrait refreshes")
	check(detail.get_node("CombatPanel/WeaponName").text != first_weapon, "Weapon refreshes")
	check(detail.get_node("CombatPanel/PowerValue").text != first_power, "Power refreshes")
	check(detail.get_node("AttributesPanel/Survival/Bar").value != first_attribute, "Attributes refresh")
	check(detail.get_instance_id() == detail_instance and detail.visible, "M05 instance reused")
	await move_pointer(Vector2(800, 500))
	await capture("camp-1600x900.png")
	for index: int in [3, 2, 0, 1, 0, 1]:
		await click(roster.get_node("Slot%02d" % (index + 1)))
		check(detail.get_instance_id() == detail_instance and detail.visible, "Repeated switch preserves visible instance")
		check(roster.selected_index == index, "Repeated switch selection correct")
		for candidate: int in range(4):
			check(roster.get_node("Slot%02d/FrameTexture" % (candidate + 1)).texture == (SELECTED if index == candidate else NORMAL), "Exactly one selected frame")
	roster.select_index(-1)
	roster.select_index(4)
	check(roster.selected_index == 1, "Invalid selection ignored")
	await click(hud.get_node("M08_DepartAction/Entry"))
	await frames(20)
	check(not detail.visible, "Existing overlay hides selected detail")
	await key(KEY_ESCAPE)
	await frames(20)
	check(detail.visible and detail.get_instance_id() == detail_instance, "Overlay restores same selected detail")
	await move_pointer(slot.get_global_rect().get_center())
	hud.set_hud_visible(false)
	await frames(2)
	hud.set_hud_visible(true)
	await move_pointer(Vector2(800, 500))
	check(slot.scale.is_equal_approx(Vector2.ONE) and frame.self_modulate.is_equal_approx(Color(0.78, 0.78, 0.78, 1)), "Hide clears transient hover")
	for dimensions: Vector2i in [Vector2i(1600, 900), Vector2i(1280, 720), Vector2i(1024, 640), Vector2i(1920, 1080)]:
		root.size = dimensions
		await frames(8)
		verify_layout(hud, dimensions)
		for label: Node in detail.find_children("*", "Label", true, false):
			check(label.get_minimum_size().x <= label.size.x and label.get_minimum_size().y <= label.size.y, "Detail text fits: " + str(label.name))
		for panel: Control in detail.get_children():
			check(Rect2(Vector2.ZERO, detail.size).encloses(panel.get_rect()), "Detail section fits: " + str(panel.name))
	for button: Button in detail.get_node("ActionBar").get_children():
		check(button.disabled, "Skeleton action has no gameplay")
	check(app.campaign.data == before, "UI fixtures do not mutate campaign")
	check(app.camp_view.camera.global_transform == camera, "Camera unchanged")
	await key(KEY_ESCAPE)
	app.show_shelter()
	await frames(12)
	check(app.camp_ui.selected_survivor_id == null and not app.camp_ui.get_node("M05_SurvivorDetail").visible, "Reentering Camp resets selection")
	var report := FileAccess.open(CAPTURE_DIR + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "layouts": layouts}, "\t"))
	print("CAMP SURVIVOR DETAIL: %d checks, %d failures" % [checks, failures.size()])
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
	await create_timer(0.18).timeout

func capture(filename: String) -> void:
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	check(screenshot.get_size() == Vector2i(1600, 900), "Screenshot native 1600x900")
	check(screenshot.save_png(CAPTURE_DIR + filename) == OK, "Saved " + filename)
