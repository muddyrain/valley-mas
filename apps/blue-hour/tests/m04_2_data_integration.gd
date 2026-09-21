extends SceneTree

const MAIN := preload("res://core/main.tscn")
const OUTPUT := "res://test-output/camp-survivor-roster-m04-2/"
var failures: Array[String] = []

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	root.size = Vector2i(1600, 900)
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/m04-2-data-integration.json"
	app.fresh_test_run = true
	root.add_child(app)
	await _frames(30)
	app.show_shelter()
	await _frames(30)
	var hud: Control = app.camp_ui
	var roster: Control = hud.get_node("M04_SurvivorRoster")
	var detail: Control = hud.get_node("M05_SurvivorDetail")
	var entries: Array[Node] = roster.find_children("SurvivorEntry_*", "Button", true, false)
	_check(entries.size() == 12, "Formal catalog creates 12 roster entries")
	_check(entries[0].name == "SurvivorEntry_SUR_001", "First entry is keyed by SUR_001")
	_check(entries[11].name == "SurvivorEntry_SUR_012", "Last entry is keyed by SUR_012")
	_check(entries[0].get_node("NameLabel").text == "夏知遥", "SUR_001 uses authored display name")
	_check(entries[11].get_node("NameLabel").text == "宋时雨", "SUR_012 uses authored display name")
	_check(entries[2].get_node("Fallback").visible, "Missing portrait uses fallback without duplicating another portrait")
	_check(not detail.visible, "M05 starts hidden before selection")
	await _capture("m04-2-roster-12-1600x900.png")
	entries[0].emit_signal("pressed")
	await _frames(2)
	_check(detail.visible and hud.selected_survivor_id == "SUR_001", "Selecting SUR_001 opens M05 by ID")
	_check(detail.get_node("HeaderPanel/SurvivorName").text == "夏知遥", "M05 name comes from SurvivorDefinition")
	_check(detail.get_node("HeaderPanel/SurvivorNameEn").text.contains("SUR_001") and detail.get_node("HeaderPanel/SurvivorNameEn").text.contains("Lv.1") and detail.get_node("HeaderPanel/SurvivorNameEn").text.contains("HP 100/100"), "M05 displays ID, level, and HP")
	_check(detail.get_node("TraitPanel/TraitName").text.contains("搜寻直觉") and detail.get_node("TraitPanel/TraitName").text.contains("Lv.1"), "M05 displays formal trait and current level")
	_check(detail.get_node("TraitPanel/TraitDescription").text != "", "M05 displays current trait description")
	_check(detail.get_node("CombatPanel/WeaponName").text == "未装备", "Unassigned survivor displays 未装备")
	await _capture("m04-2-sur001-detail-1600x900.png")
	entries[2].emit_signal("pressed")
	await _frames(2)
	_check(detail.get_node("CombatPanel/WeaponName").text != "未装备", "Assigned survivor reads equipment from Campaign")
	entries[11].emit_signal("pressed")
	await _frames(2)
	_check(hud.selected_survivor_id == "SUR_012", "Selecting SUR_012 switches by ID")
	_check(detail.get_node("HeaderPanel/SurvivorName").text == "宋时雨", "SUR_012 detail uses authored name")
	_check(detail.get_node("TraitPanel/TraitName").text.contains("从容不迫"), "SUR_012 detail uses its formal trait")
	_check(detail.get_instance_id() == hud.get_node("M05_SurvivorDetail").get_instance_id(), "M05 instance is reused")
	await _capture("m04-2-sur012-detail-1600x900.png")
	var report := FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": failures.size() + 1, "failures": failures}, "\t"))
	print("M04.2 DATA INTEGRATION: %d failures" % failures.size())
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
