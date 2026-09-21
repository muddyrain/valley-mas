extends SceneTree

const MAIN := preload("res://core/main.tscn")
var failures: Array[String] = []

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	root.size = Vector2i(1600, 900)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/m04-1-scroll-ux.json"
	app.fresh_test_run = true
	root.add_child(app)
	await _frames(2)
	app.show_shelter()
	await _frames(20)

	var roster: Control = app.camp_ui.get_node("M04_SurvivorRoster")
	var scroll: ScrollContainer = roster.get_node("RosterContainer/ScrollContainer")
	var overlay: VScrollBar = roster.get_node("RosterContainer/OverlayScrollBar")
	var roster_rect := roster.get_global_rect()
	_check(roster_rect.size == Vector2(118, 436), "Roster outer size remains fixed")
	_check(overlay.visible, "12-person roster shows overlay scrollbar")
	_check(scroll.vertical_scroll_mode == 3, "Native scrollbar does not reserve layout width")
	var first: Control = roster.find_child("SurvivorEntry_SUR_001", true, false)
	var first_x := first.get_global_rect().position.x
	var first_y := first.get_global_rect().position.y
	scroll.scroll_vertical = int(scroll.get_v_scroll_bar().max_value)
	await _frames(3)
	_check(roster.get_global_rect() == roster_rect, "Scrolling keeps roster outer rect fixed")
	_check(first.get_global_rect().position.x == first_x, "Scrolling does not shift cards horizontally")
	_check(first.get_global_rect().position.y < first_y, "Cards scroll vertically")

	var full_survivors: Array[Resource] = app.catalog.survivors.duplicate()
	app.catalog.survivors = full_survivors.slice(0, 4)
	roster.configure(app.catalog, app.campaign)
	await _frames(3)
	_check(not overlay.visible, "Four-person roster hides overlay scrollbar")
	_check(roster.get_global_rect() == roster_rect, "Four-person roster keeps outer rect fixed")

	app.catalog.survivors = full_survivors
	roster.configure(app.catalog, app.campaign)
	await _frames(3)
	_check(overlay.visible, "Restored full roster shows overlay scrollbar")
	scroll.scroll_vertical = int(scroll.get_v_scroll_bar().max_value)
	await _frames(3)
	var last: Control = roster.find_child("SurvivorEntry_SUR_012", true, false)
	last.emit_signal("pressed")
	await _frames(2)
	_check(roster.selected_survivor_id == "SUR_012", "Scrolling preserves ID-based selection")
	_check(app.camp_ui.selected_survivor_id == "SUR_012", "M05 route remains ID-based")
	_check(app.camp_ui.get_node("M05_SurvivorDetail").visible, "M05 remains compatible after scrolling")

	print("M04.1 SCROLL UX: %d failures" % failures.size())
	for failure: String in failures:
		push_error(failure)
	app.queue_free()
	await _frames(2)
	quit(0 if failures.is_empty() else 1)

func _frames(count: int) -> void:
	for _index: int in range(count):
		await process_frame

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
