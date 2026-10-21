extends "res://tests/day_loop_runtime.gd"
## Native rendering/input of explicitly isolated population fixtures.

const Fixtures = preload("res://tests/run_end_fixtures.gd")
const EndScreen = preload("res://ui/run_end_screen.gd")
const OUT := "res://test-output/p1-b-run-end-20261020/"
var output_dir: String = "res://test-output/" + OS.get_environment("BLUE_HOUR_RUN_END_OUTPUT").get_file() + "/" if not OS.get_environment("BLUE_HOUR_RUN_END_OUTPUT").is_empty() else OUT
var view: Control
var observations: Array[Dictionary] = []

func capture(id: String) -> void:
	await RenderingServer.frame_post_draw
	var image: Image = root.get_texture().get_image()
	check(image.get_size() == root.size, "Actual native viewport size")
	check(image.save_png(output_dir + id + ".png") == OK, "Captured " + id)

func verify_layout(count: int) -> void:
	var viewport := Rect2(Vector2.ZERO, Vector2(root.size))
	check(view.member_cards.size() == count and view.member_grid.get_child_count() == count, "Exact card count: %d" % count)
	check(view.member_grid.columns == (1 if count == 1 else 2), "Adaptive columns: %d" % count)
	for button: Button in [view.menu_button, view.new_run_button]:
		check(viewport.encloses(button.get_global_rect()), "Footer stays entirely inside viewport")
		check(not button.get_global_rect().intersects(view.member_scroll.get_global_rect()), "Member area cannot push/cover footer")
	check(viewport.encloses(view.member_scroll.get_global_rect()), "Scroll region fits the viewport")
	check(viewport.encloses(view.title_label.get_global_rect()), "Title fits the viewport")
	var ids: Array[String] = []
	for card: RunMemberResultCard in view.member_cards:
		check(card.member_id not in ids, "No duplicate cards")
		ids.append(card.member_id)
		check(card.size.x <= view.member_scroll.size.x, "Card never overflows horizontally")
		check(card.name_label.get_global_rect().end.x <= card.get_global_rect().end.x, "Name stays in card")
	check(view.member_scroll.get_h_scroll_bar().max_value <= view.member_scroll.size.x + 1, "No hidden horizontal overflow")
	observations.append({"count": count, "viewport": [root.size.x, root.size.y], "columns": view.member_grid.columns, "scroll_height": view.member_scroll.size.y, "grid_height": view.member_grid.size.y, "button_rect": str(view.new_run_button.get_global_rect())})

func show_fixture(game: RefCounted) -> void:
	if is_instance_valid(view):
		view.queue_free()
		await frames(3)
	view = EndScreen.new()
	root.add_child(view)
	view.setup(game)
	await frames(12)

func run() -> void:
	create_timer(150.0).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.content_scale_size = Vector2i.ZERO
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(output_dir)
	for resolution: Vector2i in [Vector2i(1600, 900), Vector2i(1024, 640)]:
		root.size = resolution
		for count: int in [1, 2, 3, 4, 8, 12]:
			var game: RefCounted = Fixtures.victory(count)
			var before: Dictionary = game.data.duplicate(true)
			await show_fixture(game)
			verify_layout(count)
			if count >= 8:
				var footer: Rect2 = view.new_run_button.get_global_rect()
				var event := InputEventMouseButton.new()
				event.device = 42
				event.button_index = MOUSE_BUTTON_WHEEL_DOWN
				event.pressed = true
				event.position = view.member_scroll.get_global_rect().get_center()
				root.push_input(event, true)
				event.pressed = false
				root.push_input(event, true)
				await frames(5)
				check(view.member_scroll.scroll_vertical > 0, "Native wheel scrolls members")
				view.member_scroll.scroll_vertical = 100000
				await frames(5)
				check(view.new_run_button.get_global_rect() == footer, "Scrolling never moves footer")
				var card: Control = view.member_cards.back()
				check(view.member_scroll.get_global_rect().intersects(card.get_global_rect()), "Final member is reachable by internal scroll")
			await capture("fixture-won-%d-%dx%d" % [count, resolution.x, resolution.y])
			check(game.data == before, "Rendering and scrolling never mutate Campaign")
			if count >= 8:
				var navigations: Array[String] = []
				view.main_menu_requested.connect(func() -> void: navigations.append("menu"))
				var motion := InputEventMouseMotion.new()
				motion.device = 42
				motion.position = view.menu_button.get_global_rect().get_center()
				root.push_input(motion, true)
				await frames(3)
				await click(view.menu_button)
				check(navigations == ["menu"], "Footer still accepts real input after scrolling many members")
		var lost: RefCounted = Fixtures.hunger_loss(2)
		await show_fixture(lost)
		verify_layout(2)
		check(view.empty_label.visible and view.reason_label.text.contains("连续缺粮"), "Zero living members and true hunger cause")
		await capture("fixture-starved-2-%dx%d" % [resolution.x, resolution.y])
		await show_fixture(Fixtures.combat_loss(2))
		check(view.reason_label.text.contains("战斗全灭"), "Combat failure uses combat reason")
		await capture("fixture-combat-2-%dx%d" % [resolution.x, resolution.y])
		await show_fixture(Fixtures.mixed_victory())
		verify_layout(4)
		await capture("fixture-mixed-4-%dx%d" % [resolution.x, resolution.y])
		var previous: RunMemberResultCard = view.member_cards[0]
		var first := preload("res://ui/run_member_result_card.gd").new()
		view.member_grid.remove_child(previous)
		previous.queue_free()
		view.member_grid.add_child(first)
		view.member_grid.move_child(first, 0)
		first.setup({"member_id": "isolated:long-name", "survivor_id": "fixture", "display_name": "一位拥有非常非常长名字的幸存者 LONG SURVIVOR NAME", "portrait_path": "res://missing_fixture.png", "status": "unknown"})
		view.member_cards[0] = first
		await frames(8)
		verify_layout(4)
		await capture("fixture-long-name-missing-portrait-%dx%d" % [resolution.x, resolution.y])
		var actions: Array[String] = []
		view.main_menu_requested.connect(func() -> void: actions.append("menu"))
		view.new_run_requested.connect(func() -> void: actions.append("new"))
		await click(view.new_run_button)
		await click(view.new_run_button)
		await click(view.menu_button)
		check(actions == ["new"], "Repeated native clicks emit only one navigation action")
	# Exercise the actual missing-portrait input path, rather than assigning another character's art.
	await show_fixture(Fixtures.victory(1))
	var card := preload("res://ui/run_member_result_card.gd").new()
	root.add_child(card)
	card.setup({"member_id": "isolated:missing", "survivor_id": "fixture", "display_name": "长姓名 LONG NAME", "portrait_path": "res://missing_fixture.png", "status": "unknown"})
	check(card.portrait.texture == null and card.placeholder.visible, "Missing portrait has a neutral placeholder")
	card.queue_free()
	var empty: RefCounted = Fixtures.combat_loss(1)
	empty.data.history = []
	await show_fixture(empty)
	check(view.member_cards.is_empty() and view.empty_label.visible, "Zero recorded members produce no blank cards")
	await capture("fixture-zero-recorded-members-1024x640")
	FileAccess.open(output_dir + "population-runtime.json", FileAccess.WRITE).store_string(JSON.stringify({"method": "native rendering and synthetic input; isolated Campaign API population fixtures, not production five-day playthrough", "checks": checks, "failures": failures, "observations": observations}, "\t"))
	print("RUN END RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	view.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
