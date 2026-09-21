extends SceneTree

const MAIN := preload("res://core/main.tscn")
const OUTPUT := "res://test-output/camp-survivor-roster-phase1/"
var failures: Array[String] = []

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	root.size = Vector2i(1600, 900)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/m04-phase1.json"
	app.fresh_test_run = true
	root.add_child(app)
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	await process_frame
	app.show_shelter()
	await _frames(20)
	var roster: Control = app.camp_ui.get_node("M04_SurvivorRoster")
	var scroll: ScrollContainer = roster.get_node("RosterContainer/ScrollContainer")
	var entries: Array[Node] = roster.find_children("SurvivorEntry_*", "Button", true, false)
	_check(entries.size() == 12, "M04 creates 12 data-driven entries")
	_check(roster.get_node("Header/Count").text == "3/12", "Header shows party count over catalog count")
	_check(entries[0].name == "SurvivorEntry_SUR_001", "First entry uses Survivor ID")
	_check(entries[11].name == "SurvivorEntry_SUR_012", "Last entry uses Survivor ID")
	_check(entries[0].get_node("PortraitTexture").texture != null, "Formal portrait is loaded")
	_check(entries[2].get_node("Fallback").visible, "Missing portrait uses fallback")
	_check(entries[2].get_node("NameLabel").text == "林见月", "Fallback entry retains authored name")
	_check(not app.camp_ui.get_node("M05_SurvivorDetail").visible, "M05 starts hidden")
	await _capture("camp-default-1600x900.png")
	scroll.scroll_vertical = int(scroll.get_v_scroll_bar().max_value * 0.5)
	await _frames(2)
	await _capture("camp-scroll-middle-1600x900.png")
	scroll.scroll_vertical = scroll.get_v_scroll_bar().max_value
	await _frames(2)
	await _capture("camp-scroll-bottom-1600x900.png")
	entries[11].emit_signal("pressed")
	await _frames(2)
	_check(roster.selected_survivor_id == "SUR_012", "Selection emits Survivor ID")
	_check(app.camp_ui.selected_survivor_id == "SUR_012", "CampHUDRoot routes Survivor ID")
	_check(app.camp_ui.get_node("M05_SurvivorDetail").visible, "Selection opens existing detail")
	_check(app.camp_ui.get_node("M05_SurvivorDetail/HeaderPanel/SurvivorName").text == "宋时雨", "Selected data reaches detail")
	await _capture("camp-sur012-selected-1600x900.png")
	print("M04 PHASE 1: %d failures" % failures.size())
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

func _capture(filename: String) -> void:
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	_check(screenshot.get_size() == Vector2i(1600, 900), "Screenshot is 1600x900")
	_check(screenshot.save_png(OUTPUT + filename) == OK, "Saved " + filename)
