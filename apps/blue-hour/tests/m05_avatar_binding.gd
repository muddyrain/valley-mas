extends SceneTree

const MAIN := preload("res://core/main.tscn")
const AVATAR_ROOT := "res://assets/ui/camp/survivor_avatars/"
const OUTPUT := "res://test-output/camp-avatar-integration/"
var failures: Array[String] = []

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	root.size = Vector2i(1600, 900)
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/m05-avatar-binding.json"
	app.fresh_test_run = true
	root.add_child(app)
	await _frames(30)
	app.show_shelter()
	await _frames(30)
	var hud: Control = app.camp_ui
	var roster: Control = hud.get_node("M04_SurvivorRoster")
	var detail: Control = hud.get_node("M05_SurvivorDetail")
	var entries: Array[Node] = roster.find_children("SurvivorEntry_*", "Button", true, false)
	_check(entries.size() == 12, "Avatar test sees all 12 roster entries")
	for entry_node: Node in entries:
		var entry := entry_node as Button
		var survivor_id := str(entry.name).trim_prefix("SurvivorEntry_")
		var portrait := entry.get_node("PortraitTexture") as TextureRect
		_check(portrait.texture != null, survivor_id + " roster avatar texture exists")
		_check(str(portrait.texture.resource_path).begins_with(AVATAR_ROOT + survivor_id + "_"), survivor_id + " roster avatar is ID-bound")
		_check(portrait.stretch_mode == TextureRect.STRETCH_KEEP_ASPECT_COVERED, survivor_id + " roster avatar uses center crop")
		_check(not entry.get_node("Fallback").visible, survivor_id + " does not show fallback")
	_check(app.campaign.discover_survivor("SUR_012"), "SUR_012 can be discovered before detail avatar validation")
	_check(app.campaign.recruit_survivor("SUR_012"), "SUR_012 can be recruited before detail avatar validation")
	hud.refresh_roster()
	await _frames(2)

	var selection_ids: Array[String] = ["SUR_001", "SUR_002", "SUR_012"]
	for selected_id: String in selection_ids:
		roster.select_survivor(selected_id)
		await _frames(2)
		var detail_portrait := detail.get_node("HeaderPanel/PortraitContainer/HalfPortrait") as TextureRect
		_check(detail.survivor_id == selected_id, selected_id + " detail selection uses Survivor ID")
		_check(detail_portrait.texture != null, selected_id + " detail avatar texture exists")
		_check(str(detail_portrait.texture.resource_path).begins_with(AVATAR_ROOT + selected_id + "_"), selected_id + " detail avatar is ID-bound")
		_check(detail_portrait.stretch_mode == TextureRect.STRETCH_KEEP_ASPECT_COVERED, selected_id + " detail avatar uses center crop")

	await _capture("camp-avatar-integration-test.png")
	var report := FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"failures": failures}, "\t"))
	print("M05 AVATAR BINDING: %d failures" % failures.size())
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
	_check(screenshot.get_size() == Vector2i(1600, 900), "Avatar screenshot is 1600x900")
	_check(screenshot.save_png(OUTPUT + filename) == OK, "Saved " + filename)
