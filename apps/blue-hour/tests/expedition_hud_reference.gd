extends "res://tests/expedition_hud_polish.gd"
## Real production HUD, native renderer and synthetic device-42 input.

func output_folder() -> String:
	return "hud-reference-polish/after/"

func snap(id: String) -> void:
	if id.begins_with("01_expediton_hud_overview"):
		for action: Button in hud.command_buttons.values() + hud.power_buttons.values() + [hud.extract_button]:
			check(action.get_global_rect().encloses(action.key_backplate.get_global_rect()), "Shortcut remains inside its button's mouse target")
	if id == "01_expediton_hud_overview_1920x1080":
		mission.camera_controller.following = false
		hud.toggle_menu()
		await key(KEY_L)
		check(not mission.camera_controller.following, "Locate shortcut is blocked while the menu owns input")
		hud.toggle_menu()
		await key(KEY_L)
		check(mission.camera_controller.following, "Displayed L restores camera follow through native keyboard input")
		mission.camera_controller.following = false
		await click(hud.command_buttons["定位"].key_backplate)
		check(mission.camera_controller.following, "Clicking the visible key badge invokes Locate instead of issuing a ground move")
		await hover(hud.brand_panel.get_global_rect().get_center())
	await super.snap(id)
	if DisplayServer.get_name() == "headless":
		return
	if id == "01_expediton_hud_overview_1920x1080":
		await crop("10_return_button", hud.extract_button.get_global_rect().grow(16))
		await crop("11_title_party", hud.brand_panel.get_global_rect().merge(hud.squad_panel.get_global_rect()).grow(16))
		await crop("12_action_bar", hud.command_panel.get_global_rect().grow(16))
	if id == "04_objective_action_interaction":
		await crop("13_resources_objective", hud.resources_panel.get_global_rect().merge(hud.sites_panel.get_global_rect()).grow(16))

func crop(id: String, region: Rect2) -> void:
	await RenderingServer.frame_post_draw
	var pixels: Image = root.get_texture().get_image()
	var rect := Rect2i(root.get_stretch_transform() * region).intersection(Rect2i(Vector2i.ZERO, pixels.get_size()))
	check(pixels.get_region(rect).save_png("res://test-output/" + output_folder() + id + ".png") == OK, "Captured native HUD detail " + id)
