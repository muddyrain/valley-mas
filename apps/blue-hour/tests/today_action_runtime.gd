extends "res://tests/today_action.gd"


func run() -> void:
	create_timer(80).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.add_child(TestInputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output")
	app = load("res://core/main.gd").new()
	app.save_path = "user://test-runs/today-action-visual-%d.json" % Time.get_ticks_usec()
	app.fresh_test_run = true
	root.add_child(app)
	await frames(12)
	await click(app.screen.departure)
	await create_timer(0.25).timeout
	await capture("today-action-01-unselected")
	check(app.screen.confirm_button.disabled, "Empty selection visibly disables departure")
	var focus_before: Control = root.gui_get_focus_owner()
	await key(KEY_RIGHT)
	check(root.gui_get_focus_owner() != focus_before and app.screen.selected_id.is_empty(), "Arrow keys move focus without selecting")
	await key(KEY_ENTER)
	check(app.screen.selected_id == "commercial", "Enter selects the focused card without departing")
	for id: String in ["residential", "commercial", "airdrop"]:
		await click(app.screen.cards[id])
		await create_timer(0.18).timeout
		check(app.screen.selected_id == id, "Mouse selects " + id)
		await capture("today-action-" + id)
	var joy := InputEventJoypadButton.new()
	joy.device = 42
	joy.button_index = JOY_BUTTON_B
	joy.pressed = true
	root.push_input(joy, true)
	await frames()
	check(app.state == "shelter", "Controller B returns to camp")
	if app.state == "shelter":
		await click(app.screen.departure)
	for dimensions: Vector2i in [Vector2i(1024, 640), Vector2i(1280, 720), Vector2i(1440, 900), Vector2i(2560, 1080)]:
		root.size = dimensions
		await frames(8)
		var bounds: Rect2 = root.get_visible_rect()
		var screen: Control = app.screen
		for control: Control in [screen.confirm_button, screen.cancel_button, screen.selection_title, screen.selection_description]:
			check(bounds.encloses(control.get_global_rect()), "Action footer remains visible at " + str(dimensions))
		var previous := Rect2()
		for card: Button in screen.cards.values():
			var rect: Rect2 = card.get_global_rect()
			check(bounds.encloses(rect) and not previous.intersects(rect), "Cards fit without overlap at " + str(dimensions))
			previous = rect
		await click(screen.cards.commercial)
		check(screen.selected_id == "commercial", "Selection works after resize to " + str(dimensions))
		await capture("today-action-%dx%d" % [dimensions.x, dimensions.y])
	root.size = Vector2i(1600, 900)
	await frames(8)
	await click(app.screen.cancel_button)
	check(app.state == "shelter", "Return button restores the camp")
	print("TODAY ACTION RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	var report := FileAccess.open("res://test-output/today-action-runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	report.close()
	app.queue_free()
	await frames()
	quit(0 if failures.is_empty() else 1)
