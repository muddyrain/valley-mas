extends "res://tests/runtime.gd"

func run() -> void:
	create_timer(45).timeout.connect(func(): printerr("PAUSE MENU TIMEOUT"); quit(2))
	root.unfocusable = true
	remove_test_settings()
	app = load("res://core/main.gd").new()
	app.save_path = "user://test-runs/pause-menu-01.json"
	app.fresh_test_run = true
	root.add_child(app)
	root.add_child(InputGate.new())
	await frames(12)
	await click_button("今日行动")
	await click_button("商业街")
	await click_button("确认出发")
	check(app.state == "mission", "Pause-menu fixture reaches the live mission")
	await key(KEY_ESCAPE)
	check(app.hud.pause_menu.visible, "Esc opens the styled pause menu")
	check(button("设置") != null, "Pause menu exposes the shared settings page")
	if button("设置") != null:
		await click_button("设置")
		var settings_menu := app.hud.find_child("SettingsMenu", true, false) as Control
		check(settings_menu != null and settings_menu.visible and not app.hud.pause_menu.visible, "Settings replaces the pause card without stacking another modal")
		var mission_resolution := app.hud.find_child("Resolution", true, false) as OptionButton
		check(mission_resolution != null, "Mission settings exposes resolution selection")
		var mission_master := app.hud.find_child("MasterVolume", true, false) as HSlider
		check(mission_master != null, "Mission settings exposes master volume")
		check(mission_resolution != null and mission_resolution.size.x >= 420.0, "Mission settings uses the available form width")
		check(mission_master != null and mission_master.size.x >= 360.0, "Mission volume controls have a readable adjustment range")
		var mission_heading := app.hud.find_child("SettingsHeading", true, false) as Label
		check(mission_heading != null and mission_heading.horizontal_alignment == HORIZONTAL_ALIGNMENT_CENTER, "Mission settings heading anchors the dialog centrally")
		if mission_master != null:
			mission_master.value = 0.35
			app.hud.settings_view.commit()
			check(is_equal_approx(app.settings.data.master_volume, 0.35), "Pause settings apply volume changes immediately")
		await capture("pause-settings")
		await key(KEY_ESCAPE)
		check(app.hud.pause_menu.visible and not settings_menu.visible, "Esc returns from settings to the pause menu")
	check(button("返回主菜单") != null, "Esc menu exposes a direct return to the main menu")
	check(button("退出游戏") == null, "Esc menu does not expose the nested quit confirmation flow")
	check(app.find_children("*", "ConfirmationDialog", true, false).is_empty(), "Esc opens only one menu layer")
	await capture("pause-menu-single-layer")
	await click_button("返回主菜单")
	check(app.state == "menu" and app.mission == null and app.hud == null, "Pause menu returns to the title and clears the mission")
	check(app.campaign.data.status == "shelter", "Returning to title resets the current action for a same-day retry")
	await click_button("设置")
	var title_resolution := app.screen.find_child("Resolution", true, false) as OptionButton
	check(title_resolution != null, "Title settings reuses the full settings page")
	check(app.screen.find_child("EffectsVolume", true, false) is HSlider, "Title settings exposes effects volume")
	var title_master := app.screen.find_child("MasterVolume", true, false) as HSlider
	check(title_master != null and is_equal_approx(title_master.value, 0.35), "Title and pause menus share persisted settings")
	check(title_resolution != null and title_resolution.size.x >= 420.0, "Title settings fills the paper dialog instead of leaving a dead column")
	check(title_master != null and title_master.size.x >= 360.0, "Title volume controls fill the available row")
	var title_heading := app.screen.find_child("SettingsHeading", true, false) as Label
	check(title_heading != null and title_heading.horizontal_alignment == HORIZONTAL_ALIGNMENT_CENTER, "Title settings heading is centered")
	await capture("title-settings")
	await key(KEY_ESCAPE)
	check(app.screen.overlay == null, "Esc closes title settings and returns to the main menu")
	await click_button("继续")
	check(app.state == "shelter", "Continue re-enters the shelter after returning from a mission")
	var report := FileAccess.open("res://test-output/pause-menu-runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("PAUSE MENU RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	remove_test_settings()
	quit(0 if failures.is_empty() else 1)

func remove_test_settings() -> void:
	var base := "user://test-runs/pause-menu-01-settings.json"
	for suffix: String in ["", ".bak", ".tmp"]:
		var target := base + suffix
		if FileAccess.file_exists(target):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(target))
