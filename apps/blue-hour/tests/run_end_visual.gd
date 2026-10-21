extends "res://tests/day_loop_runtime.gd"
## Native visual fixtures and keyboard focus, separate from production Run evidence.

const Fixtures = preload("res://tests/run_end_fixtures.gd")
const EndScreen = preload("res://ui/run_end_screen.gd")
const OUT := "res://test-output/p1-b-visual-20261020/"
var view: Control
var observations: Array[Dictionary] = []

func capture(id: String) -> void:
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	check(screenshot.get_size() == root.size, "Screenshot records real native window dimensions")
	check(screenshot.save_png(OUT + id + ".png") == OK, "Captured " + id)

func show_fixture(game: RefCounted) -> void:
	if is_instance_valid(view):
		view.queue_free()
		await frames(3)
	view = EndScreen.new()
	root.add_child(view)
	view.setup(game)
	await frames(14)

func check_geometry(context: String) -> void:
	var bounds: Rect2 = view.get_viewport_rect()
	for node: Control in [view.title_label, view.paper_panel, view.member_scroll, view.closing_label, view.menu_button, view.new_run_button]:
		check(bounds.encloses(node.get_global_rect()), context + ": primary regions stay in the viewport")
	check(not view.member_scroll.get_global_rect().intersects(view.actions.get_global_rect()), context + ": only members scroll above fixed actions")
	for label: Label in [view.title_label, view.closing_label] + view.summary_values:
		check(label.get_line_count() == 1 and label.get_minimum_size().x <= label.size.x + 1, context + ": title, totals and closing text fit")
	for card: RunMemberResultCard in view.member_cards:
		check(card.get_global_rect().encloses(card.name_label.get_global_rect()), context + ": member name stays in its card")
		check(card.get_global_rect().encloses(card.status_label.get_global_rect()), context + ": status stays in its card")
	observations.append({"context": context, "window": [root.size.x, root.size.y], "viewport": str(bounds), "title": str(view.title_label.get_global_rect()), "paper": str(view.paper_panel.get_global_rect()), "members": str(view.member_scroll.get_global_rect()), "actions": str(view.actions.get_global_rect())})

func action(name: String) -> void:
	for pressed: bool in [true, false]:
		var event := InputEventAction.new()
		event.device = 42
		event.action = name
		event.pressed = pressed
		root.push_input(event, true)
		await process_frame
	await frames(5)

func run() -> void:
	create_timer(180.0).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.content_scale_size = Vector2i.ZERO
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(OUT)
	var initial_aspect: Window.ContentScaleAspect = root.content_scale_aspect
	var minimum_actions: Rect2
	for resolution: Vector2i in [Vector2i(1600, 900), Vector2i(1024, 640)]:
		root.size = resolution
		var fixed: Dictionary = {}
		for count: int in [1, 2, 4, 8, 12]:
			await show_fixture(Fixtures.victory(count))
			check_geometry("Won %d at %dx%d" % [count, resolution.x, resolution.y])
			var geometry: Dictionary = {"title": view.title_label.get_global_rect(), "paper": view.paper_panel.get_global_rect(), "actions": view.actions.get_global_rect()}
			if fixed.is_empty():
				fixed = geometry
			check(geometry == fixed, "Population never moves the heading, paper or footer")
			check(view.member_cards.size() == count, "Exact actual fixture membership")
			if resolution == Vector2i(1024, 640) and count == 2:
				minimum_actions = view.actions.get_global_rect()
			await capture("visual-won-%d-%dx%d" % [count, resolution.x, resolution.y])
		await show_fixture(Fixtures.hunger_loss(2))
		check_geometry("Lost at %dx%d" % [resolution.x, resolution.y])
		await capture("visual-lost-2-%dx%d" % [resolution.x, resolution.y])
	root.size = Vector2i(1600, 900)
	await show_fixture(Fixtures.victory(2))
	check(root.gui_get_focus_owner() == view.new_run_button, "Initial keyboard focus targets New Run")
	check(view.new_run_button.get_theme_stylebox("focus") is StyleBoxTexture, "Focus uses the matching chamfer asset, not the shared orange rectangle")
	await capture("visual-keyboard-focus-new-1600x900")
	await action("ui_focus_prev")
	check(root.gui_get_focus_owner() == view.menu_button, "Keyboard focus traverses to Main Menu")
	await capture("visual-keyboard-focus-menu-1600x900")
	var navigation: Array[String] = []
	view.main_menu_requested.connect(func() -> void: navigation.append("menu"))
	await action("ui_accept")
	await action("ui_accept")
	check(navigation == ["menu"], "Keyboard accepts navigation once despite repeated input")
	root.gui_release_focus()
	await capture("visual-unfocused-1600x900")
	# Also render with the project's logical canvas scaling, not only physical-pixel fixtures.
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	root.content_scale_size = Vector2i(1600, 900)
	root.size = Vector2i(1024, 640)
	await show_fixture(Fixtures.victory(2))
	check_geometry("Actual project stretch at minimum window")
	var native_scale: float = root.size.x / view.get_viewport_rect().size.x
	var logical_actions: Rect2 = view.actions.get_global_rect()
	check(Rect2(logical_actions.position * native_scale, logical_actions.size * native_scale).is_equal_approx(minimum_actions), "Project scaling preserves the same readable physical footer layout")
	await capture("visual-project-stretch-won-1024x640")
	await show_fixture(Fixtures.hunger_loss(2))
	check_geometry("Lost with actual project stretch at minimum window")
	await capture("visual-project-stretch-lost-1024x640")
	view.queue_free()
	await frames(3)
	check(root.content_scale_aspect == initial_aspect, "Leaving the end page restores the previous window aspect policy")
	FileAccess.open(OUT + "visual-runtime.json", FileAccess.WRITE).store_string(JSON.stringify({"method": "native Godot rendering and synthetic keyboard input; isolated population fixtures, including actual project canvas scaling", "checks": checks, "failures": failures, "observations": observations}, "\t"))
	print("RUN END VISUAL: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
