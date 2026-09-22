extends SceneTree

const MAIN := preload("res://core/main.tscn")
const OUTPUT := "res://test-output/camp-survivor-card-2/"
var failures: Array[String] = []

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	root.size = Vector2i(1600, 900)
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-survivor-card-2.json"
	app.fresh_test_run = true
	root.add_child(app)
	await _frames(30)
	app.show_shelter()
	await _frames(30)
	var hud: Control = app.camp_ui
	var roster: Control = hud.get_node("M04_SurvivorRoster")
	var detail: Control = hud.get_node("M05_SurvivorDetail")
	var entries: Array[Node] = roster.find_children("SurvivorEntry_*", "Button", true, false)
	_check(entries.size() == 12, "Card 2.0 renders 12 survivor entries")
	_check(not detail.visible, "Detail starts hidden")
	for entry_node: Node in entries:
		var entry := entry_node as Button
		_check(entry.get_node("NameLabel").get_theme_font_size("font_size") >= 13, entry.name + " name hierarchy is emphasized")
		_check(entry.get_node("EnglishLabel").text != "", entry.name + " has auxiliary English/ID text")
		_check(entry.get_node("MetaLabel").text != "", entry.name + " has auxiliary level/role text")
	var entry_001 := roster.find_child("SurvivorEntry_SUR_001", true, false) as Button
	var entry_012 := roster.find_child("SurvivorEntry_SUR_012", true, false) as Button
	_check(entry_001.get_node("NameLabel").text == "夏知遥", "SUR_001 Chinese name remains visible")
	_check(entry_012.get_node("NameLabel").text == "未知幸存者", "Locked SUR_012 hides identity while keeping the card")
	await _capture("camp-overall-1600x900.png")

	var first := entry_001
	var hover_event := InputEventMouseMotion.new()
	hover_event.position = first.get_global_rect().get_center()
	root.push_input(hover_event, true)
	await _frames(12)
	_check(first.get_node("InfoBand").self_modulate != Color(0.94, 0.97, 0.98, 1), "Hover updates card highlight state")
	await _capture("camp-hover-1600x900.png")

	first.emit_signal("pressed")
	await _frames(2)
	_check(first.selected, "Selected state is applied to the clicked card")
	_check(detail.visible and detail.survivor_id == "SUR_001", "Selected card opens matching detail")
	_check(detail.get_node("HeaderPanel/TraitBadge/Label").text == "搜寻直觉", "Detail header shows selected trait")
	await _capture("camp-selected-1600x900.png")
	await _capture("m05-detail-1600x900.png")

	var report := FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"failures": failures}, "\t"))
	print("CAMP SURVIVOR CARD 2.0: %d failures" % failures.size())
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
