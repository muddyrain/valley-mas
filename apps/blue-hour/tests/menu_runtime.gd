extends "res://tests/new_run_runtime.gd"

class MenuInputGate extends Node:
	func _input(event: InputEvent) -> void:
		if event.device != 42 and not event.has_meta("menu_test"):
			get_viewport().set_input_as_handled()

func run() -> void:
	create_timer(60).timeout.connect(func(): printerr("MENU UI TIMEOUT"); quit(2))
	root.unfocusable = true
	root.add_child(MenuInputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output/menu")
	await launch(true)
	check(root.gui_get_focus_owner() == button("开始游戏"), "New game is initially keyboard reachable")
	await key(KEY_ENTER)
	check(app.state == "new_game", "Enter opens new game from initial focus")
	if app.state != "new_game":
		await click(button("开始游戏"))
	await key(KEY_ESCAPE)
	check(app.state == "menu", "Escape returns from creation to title")
	if app.state != "menu":
		app.show_main_menu()
		await frames()
	check(not FileAccess.file_exists(run_save), "Keyboard navigation does not create a save")
	for dimensions in [Vector2i(1672,941), Vector2i(1919,1080), Vector2i(1440,900), Vector2i(1024,640), Vector2i(2560,1080), Vector2i(1024,768)]:
		root.size = dimensions
		await frames(15)
		check_buttons("title %s" % dimensions)
		await capture("menu/title-%dx%d" % [dimensions.x, dimensions.y])
		if dimensions.x == 1919:
			var motion := InputEventMouseMotion.new()
			motion.device = 42
			motion.position = button("设置").get_global_rect().get_center()
			root.push_input(motion, true)
			await frames()
			check(root.gui_get_focus_owner() == button("设置"), "Mouse hover hands navigation focus to the pointed entry")
			check(button("设置").lit and not button("开始游戏").lit, "Only one menu entry uses the white hover sprite")
			await capture("menu/title-hover-settings")
			var poster: TextureRect = app.screen.find_child("StaticPoster", true, false)
			check(poster.mouse_filter == Control.MOUSE_FILTER_IGNORE, "Poster is decorative and has no interactive hit area")
		await click(button("开始游戏"))
		for choice in ["combat", "scavenge", "survey"]:
			await click(app.screen.tabs[choice])
			check(app.screen.selected == choice, "Responsive specialization selection: " + choice)
			if dimensions == Vector2i(1672,941):
				await capture("menu/create-1672x941-" + choice)
		await click(app.screen.tabs.scavenge)
		if dimensions == Vector2i(1672,941):
			check(app.screen.selected_effect == 1 and app.screen.tooltip_title.text == "疾行号令", "Reference layout opens on the selected skill detail")
			await click(app.screen.unlock_button)
			check(app.screen.selected_effect == -1 and app.screen.tooltip_badge.text == "尚未解锁", "Unlock preview reports its real unavailable state")
			await capture("menu/create-1672x941-locked")
			await click(app.screen.cards[1])
		check_buttons("creation %s" % dimensions)
		await capture("menu/create-%dx%d" % [dimensions.x, dimensions.y])
		await click(button("取消"))
	check(not FileAccess.file_exists(run_save), "Previewing all specialties never writes a run")
	await click(button("继续"))
	check(app.state == "menu" and app.screen.overlay != null, "Continue without save explains the empty state")
	await key(KEY_ESCAPE)
	for label in ["角色图鉴", "营地档案", "设置"]:
		await click(button(label))
		check(app.screen.overlay != null, "Menu destination opens: " + label)
		await key(KEY_TAB)
		check(app.screen.overlay.is_ancestor_of(root.gui_get_focus_owner()), "Tab stays inside the open menu page")
		await key(KEY_ESCAPE)
		check(app.screen.overlay == null and root.gui_get_focus_owner() == button(label), "Back restores focus: " + label)
	for target in app.screen.social_buttons:
		await click(target)
		check(app.screen.overlay != null, "Unpublished external entry has an explicit status")
		await key(KEY_ESCAPE)
	check(not FileAccess.file_exists(run_save), "Viewing menu pages never creates a run")
	root.size = Vector2i(1440,900)
	await frames()
	button("开始游戏").grab_focus()
	await joy(JOY_BUTTON_DPAD_DOWN)
	check(root.gui_get_focus_owner() == button("继续"), "Controller D-pad navigates the title")
	await joy(JOY_BUTTON_DPAD_UP)
	await joy(JOY_BUTTON_A)
	check(app.state == "new_game", "Controller confirm opens creation")
	if app.state == "new_game":
		check(root.gui_get_focus_owner() == app.screen.tabs.scavenge, "Creation gives the selected route initial controller focus")
		await joy(JOY_BUTTON_DPAD_LEFT)
		check(root.gui_get_focus_owner() == app.screen.tabs.combat, "Controller moves horizontally between route tabs")
		await joy(JOY_BUTTON_DPAD_RIGHT)
		await joy(JOY_BUTTON_DPAD_DOWN)
		check(root.gui_get_focus_owner() == app.screen.cards[1], "Controller moves from the selected route to its skill card")
		await joy(JOY_BUTTON_DPAD_DOWN)
		check(root.gui_get_focus_owner() == app.screen.confirm_button, "Controller reaches the primary confirmation")
		await joy(JOY_BUTTON_B)
		check(app.state == "menu", "Controller back returns to title")
	# A valid saved run changes the primary action without losing keyboard access.
	app.campaign.new_run(772, "survey")
	check(app._save(), "Isolated continue fixture saved")
	app.show_main_menu()
	await frames(20)
	check(root.gui_get_focus_owner() == button("继续"), "Continue receives initial focus for an existing run")
	check_buttons("continue")
	await capture("menu/title-continue")
	var saved := FileAccess.get_file_as_string(run_save)
	await key(KEY_ENTER)
	check(app.state == "shelter", "Keyboard continue reaches the existing shelter")
	check(FileAccess.get_file_as_string(run_save) == saved, "Continue preserves exact saved progress")
	var report := FileAccess.open("res://test-output/menu/runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "evidence":"native rendering, synthetic keyboard/mouse/controller events, isolated save"}, "\t"))
	print("MENU NATIVE: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(8)
	quit(0 if failures.is_empty() else 1)

func capture(id: String) -> void:
	await create_timer(.3).timeout
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	check(image.get_size() == root.size, "Menu fills the actual window: " + id)
	check(image.save_png("res://test-output/" + id + ".png") == OK, "Captured " + id)

func check_buttons(context: String) -> void:
	var rectangles: Array[Rect2] = []
	var safe := root.get_visible_rect().grow(-16)
	for node in app.screen.find_children("*", "Button", true, false):
		if not node.is_visible_in_tree():
			continue
		var rect: Rect2 = node.get_global_rect()
		check(safe.encloses(rect), context + ": safe button " + node.text)
		check(rect.size.y >= 44, context + ": usable target " + node.text)
		for earlier in rectangles:
			check(not earlier.intersects(rect), context + ": buttons do not overlap")
		rectangles.append(rect)

func joy(code: JoyButton) -> void:
	for pressed in [true, false]:
		var event := InputEventJoypadButton.new()
		event.device = 42
		event.button_index = code
		event.pressed = pressed
		root.push_input(event, true)
		await process_frame
	await frames()

func key(code: Key, receiver: Viewport = null) -> void:
	# Built-in keyboard actions target device 0. Tag synthetic events instead of
	# changing production mappings to accommodate the legacy device-42 fixture.
	for pressed in [true, false]:
		var event := InputEventKey.new()
		event.set_meta("menu_test", true)
		event.keycode = code
		event.physical_keycode = code
		event.pressed = pressed
		(receiver if receiver != null else root).push_input(event, true)
		await process_frame
	await frames()
