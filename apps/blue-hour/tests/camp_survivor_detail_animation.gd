extends SceneTree

const MAIN := preload("res://core/main.tscn")
const OUTPUT := "res://test-output/camp-survivor-detail-animation/"

var failures: Array[String] = []

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	root.size = Vector2i(1600, 900)
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-survivor-detail-animation.json"
	app.fresh_test_run = true
	root.add_child(app)
	await _frames(30)
	app.campaign.new_run(64001, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await _frames(30)
	var hud: Control = app.camp_ui
	var roster: Control = hud.get_node("M04_SurvivorRoster")
	var detail: Control = hud.get_node("M05_SurvivorDetail")
	var entry_001 := roster.find_child("SurvivorEntry_SUR_001", true, false) as Button
	var entry_002 := roster.find_child("SurvivorEntry_SUR_002", true, false) as Button
	var before: Dictionary = app.campaign.data.duplicate(true)
	var rest_x: float = detail.position.x
	_check(not detail.visible and hud.selected_survivor_id == null, "Default panel is closed")
	await _capture("closed-1600x900.png")

	entry_001.emit_signal("pressed")
	_check(detail.visible and detail.modulate.a < 0.1 and detail.position.x > rest_x and is_equal_approx(detail.scale.x, 0.96), "Open starts offset, transparent, and slightly reduced")
	await create_timer(0.12).timeout
	await process_frame
	_check(detail.modulate.a > 0.0 and detail.modulate.a < 1.0 and detail.scale.x > 0.96 and detail.scale.x < 1.0, "Open eases opacity and scale together")
	await _capture("opening-1600x900.png")
	await create_timer(0.23).timeout
	_check(detail.visible and is_equal_approx(detail.modulate.a, 1.0) and is_equal_approx(detail.position.x, rest_x) and is_equal_approx(detail.scale.x, 1.0), "Open settles at full opacity, scale, and layout position")
	_check(detail.survivor_id == "SUR_001" and detail.get_node("HeaderPanel/SurvivorName").text == "夏知遥", "Open renders SUR_001")
	_check(detail.get_node("HeaderPanel/PortraitContainer/HalfPortrait").texture == roster.get_survivor_view_data("SUR_001").get("portrait"), "Open portrait follows SUR_001 view")
	await _capture("open-sur001-1600x900.png")

	entry_002.emit_signal("pressed")
	_check(detail.visible and is_equal_approx(detail.modulate.a, 1.0) and is_equal_approx(detail.position.x, rest_x), "Switch keeps the panel shell stable")
	await create_timer(0.05).timeout
	_check(is_equal_approx(detail.modulate.a, 1.0), "Switch fades content without fading the shell")
	await _capture("switching-1600x900.png")
	await create_timer(0.15).timeout
	_check(detail.survivor_id == "SUR_002" and detail.get_node("HeaderPanel/SurvivorName").text == "苏晚星", "Switch renders SUR_002 without stale name")
	_check(detail.get_node("HeaderPanel/PortraitContainer/HalfPortrait").texture == roster.get_survivor_view_data("SUR_002").get("portrait"), "Switch portrait follows SUR_002 view")
	_check(is_equal_approx(detail.get_node("HeaderPanel").modulate.a, 1.0), "Switch content settles fully opaque")
	await _capture("switch-sur002-1600x900.png")

	entry_002.emit_signal("pressed")
	_check(detail.visible and hud.selected_survivor_id == null and roster.selected_survivor_id.is_empty(), "Reselect clears selection and begins close")
	await create_timer(0.10).timeout
	await process_frame
	_check(detail.visible and detail.modulate.a > 0.0 and detail.modulate.a < 1.0, "Close passes through a soft intermediate opacity")
	await _capture("closing-1600x900.png")
	await create_timer(0.22).timeout
	_check(not detail.visible and is_zero_approx(detail.modulate.a) and is_equal_approx(detail.position.x, rest_x), "Close hides and resets the shell")
	await _capture("closed-after-selection-1600x900.png")

	entry_001.emit_signal("pressed")
	await create_timer(0.05).timeout
	entry_001.emit_signal("pressed")
	await create_timer(0.28).timeout
	_check(not detail.visible and roster.selected_survivor_id.is_empty(), "Reselect during open closes without a stranded panel")

	entry_001.emit_signal("pressed")
	await create_timer(0.06).timeout
	entry_002.emit_signal("pressed")
	await create_timer(0.05).timeout
	entry_001.emit_signal("pressed")
	await create_timer(0.66).timeout
	_check(detail.survivor_id == "SUR_001" and detail.get_node("HeaderPanel/SurvivorName").text == "夏知遥", "Rapid clicks during open keep the latest selected survivor")
	_check(is_equal_approx(detail.modulate.a, 1.0) and is_equal_approx(detail.get_node("HeaderPanel").modulate.a, 1.0), "Rapid open clicks do not strand partial alpha")

	entry_002.emit_signal("pressed")
	await create_timer(0.03).timeout
	entry_001.emit_signal("pressed")
	await create_timer(0.40).timeout
	_check(detail.survivor_id == "SUR_001" and roster.selected_survivor_id == "SUR_001", "Rapid clicks during switch keep the latest ID")
	_check(is_equal_approx(detail.get_node("HeaderPanel").modulate.a, 1.0), "Interrupted switch does not strand content alpha")

	entry_001.emit_signal("pressed")
	await create_timer(0.07).timeout
	entry_002.emit_signal("pressed")
	await create_timer(0.36).timeout
	_check(detail.visible and detail.survivor_id == "SUR_002" and is_equal_approx(detail.modulate.a, 1.0), "New selection interrupts close and opens cleanly")
	_check(detail.get_node("HeaderPanel/PortraitContainer/HalfPortrait").texture == roster.get_survivor_view_data("SUR_002").get("portrait"), "Interrupted close preserves portrait binding")

	hud.set_hud_visible(false)
	_check(not detail.visible, "Temporary Camp HUD hide cancels active transitions")
	hud.set_hud_visible(true)
	await create_timer(0.35).timeout
	_check(detail.visible and detail.survivor_id == "SUR_002", "Returning to Camp restores the selected detail")
	_check(app.campaign.data == before, "Panel animation never mutates Campaign state")

	var report := FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"failures": failures}, "\t"))
	print("CAMP SURVIVOR DETAIL ANIMATION: %d failures" % failures.size())
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
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	_check(screenshot.get_size() == Vector2i(1600, 900), "Screenshot is 1600x900")
	_check(screenshot.save_png(OUTPUT + filename) == OK, "Saved " + filename)
