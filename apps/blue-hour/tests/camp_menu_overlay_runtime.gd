extends "res://tests/camp_hud_skeleton_runtime.gd"

const CAPTURES := "res://test-output/camp-menu-overlay/"


func run() -> void:
	create_timer(90).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i.ZERO
	DirAccess.make_dir_recursive_absolute(CAPTURES)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-menu-overlay.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(20)
	var camp: Node3D = app.camp_view.camp
	var camera: Transform3D = app.camp_view.camera.global_transform
	var campaign_before: Dictionary = app.campaign.data.duplicate(true)
	await capture("camp-normal")

	var top_menu: Button = app.camp_ui.get_node("M03_ResourceBar/MenuButton")
	await click(top_menu)
	await frames(3)
	var overlay: Control = app.camp_menu_overlay
	check(app.state == "shelter" and is_instance_valid(overlay), "Top menu opens the Camp overlay without leaving Camp")
	check(app.camp_view.camp == camp and app.camp_view.camera.global_transform == camera, "Opening the overlay preserves Camp and camera")
	check(app.camp_view.interaction_locked and app.camp_ui.process_mode == Node.PROCESS_MODE_DISABLED, "Overlay locks Camp world and HUD input")
	check(overlay.mouse_filter == Control.MOUSE_FILTER_STOP and overlay.z_index > app.camp_ui.z_index, "Full-screen overlay blocks lower pointer input at the highest UI level")
	check(overlay.menu_panel.size.x >= 360.0 and overlay.menu_panel.size.x <= 420.0, "Menu panel follows the compact width contract")
	check(overlay.menu_panel.size.y >= 400.0 and overlay.menu_panel.size.y <= 480.0, "Menu panel follows the compact height contract")
	check(_routes_to(overlay.main_menu_requested, app, "show_main_menu"), "Return action reuses Main.show_main_menu")
	check(_routes_to(overlay.quit_requested, app, "request_quit"), "Quit action reuses Main.request_quit")
	overlay.settings_button.grab_focus()
	await create_timer(0.16).timeout
	var menu_rect: Rect2 = overlay.continue_button.get_global_rect()
	await move_pointer(menu_rect.get_center(), 0.04)
	check(overlay.continue_button.weights.y > 0.0 and overlay.continue_button.weights.y < 1.0, "Menu button hover cross-fades over time")
	await create_timer(0.12).timeout
	check(overlay.continue_button.get_global_rect() == menu_rect and overlay.continue_button.visual_root.scale == Vector2.ONE, "Hover keeps the fixed hit area without scale or movement")
	await capture("menu-overlay-open")

	var utility_rect: Rect2 = app.camp_ui.get_node("M09_Utility/Entry").get_global_rect()
	await click_at(utility_rect.get_center())
	check(app.state == "shelter" and is_instance_valid(app.camp_menu_overlay), "Overlay prevents clicks from reaching Camp HUD")
	await click(overlay.settings_button)
	await frames(3)
	check(overlay.settings_view != null and overlay.settings_view.is_visible_in_tree(), "Settings reuses the shared SettingsView inside the Camp overlay")
	check(overlay.find_child("Resolution", true, false) is OptionButton, "Shared settings exposes the existing resolution control")
	check(overlay.find_child("EffectsVolume", true, false) is HSlider, "Shared settings exposes the existing audio controls")
	await capture("settings-from-menu-overlay")
	await click(overlay.settings_view.back_button)
	await frames(2)
	check(overlay.menu_panel.visible and not overlay.settings_panel.visible, "Settings back returns to the Camp menu overlay")
	await click(overlay.continue_button)
	await frames(3)
	check(not is_instance_valid(app.camp_menu_overlay) and not app.camp_view.interaction_locked, "Continue closes the overlay and restores Camp input")
	check(app.camp_ui.process_mode == Node.PROCESS_MODE_INHERIT, "Continue restores Camp HUD input")
	check(app.camp_view.camp == camp and app.camp_view.camera.global_transform == camera, "Closing the overlay preserves Camp and camera")
	check(app.campaign.data == campaign_before, "Opening and closing the overlay never mutates the campaign")
	await capture("camp-after-overlay-close")

	await click(app.camp_ui.get_node("M03_ResourceBar/MenuButton"))
	await frames(2)
	await key(KEY_ESCAPE)
	await frames(2)
	check(app.state == "shelter" and not is_instance_valid(app.camp_menu_overlay), "Esc closes the Camp overlay before normal Camp navigation")
	await key(KEY_ESCAPE)
	await frames(3)
	check(app.state == "menu" and not is_instance_valid(app.camp_ui), "Esc keeps the existing M09 return-to-main-menu behavior after the overlay closes")

	app.show_shelter()
	await frames(8)
	await click(app.camp_ui.get_node("M03_ResourceBar/MenuButton"))
	await frames(2)
	await click(app.camp_menu_overlay.return_main_menu_button)
	await frames(3)
	check(app.state == "menu" and not is_instance_valid(app.camp_view), "Overlay return action opens the existing main menu and clears Camp")
	var report := FileAccess.open(CAPTURES + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("CAMP MENU OVERLAY: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)


func _routes_to(route_signal: Signal, target: Object, method: String) -> bool:
	for connection: Dictionary in route_signal.get_connections():
		var callable: Callable = connection.callable
		if callable.get_object() == target and callable.get_method() == method:
			return true
	return false


func move_pointer(point: Vector2, duration: float) -> void:
	var event := InputEventMouseMotion.new()
	event.position = point
	root.push_input(event, true)
	await create_timer(duration).timeout


func click_at(point: Vector2) -> void:
	for pressed: bool in [true, false]:
		var event := InputEventMouseButton.new()
		event.position = point
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		root.push_input(event, true)
		await process_frame


func capture(label: String) -> void:
	await RenderingServer.frame_post_draw
	var screenshot := root.get_texture().get_image()
	check(screenshot.get_size() == Vector2i(1600, 900), "Native 1600x900 screenshot: " + label)
	check(screenshot.save_png(CAPTURES + label + ".png") == OK, "Saved screenshot: " + label)
