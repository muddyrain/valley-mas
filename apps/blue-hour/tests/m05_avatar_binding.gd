extends SceneTree

const MAIN := preload("res://core/main.tscn")
const CHARACTER_ROOT := "res://assets/characters/"
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
	var definition_paths: Dictionary = {}
	for definition: Resource in app.catalog.survivors:
		var survivor_id := str(definition.survivor_id)
		var formal_path := str(definition.portrait)
		definition_paths[survivor_id] = formal_path
		var owner_root := str(definition.model_resource).get_base_dir().get_base_dir()
		_check(owner_root.begins_with(CHARACTER_ROOT) and formal_path == owner_root + "/portrait/avatar_square.png", survivor_id + " portrait belongs to its model owner")
		_check(ResourceLoader.exists(formal_path), survivor_id + " definition has an imported formal portrait")
	_check(entries.size() == app.campaign.roster_manager().get_recruited_survivors().size(), "Avatar test sees only recruited roster entries")
	_check(roster.find_child("SurvivorEntry_SUR_012", true, false) == null, "Unrecruited avatar has no Camp card")
	for entry_node: Node in entries:
		var entry := entry_node as Button
		var survivor_id := str(entry.name).trim_prefix("SurvivorEntry_")
		var expected_path := str(roster.get_survivor_view_data(survivor_id).get("portrait_path", ""))
		var portrait := entry.get_node("PortraitTexture") as TextureRect
		_check(expected_path.begins_with(CHARACTER_ROOT), survivor_id + " view uses character-owned portrait")
		_check(expected_path == str(definition_paths.get(survivor_id, "")), survivor_id + " view reads its definition portrait")
		_check(portrait.texture != null and portrait.texture.resource_path == expected_path, survivor_id + " card uses its view portrait")
		_check(portrait.stretch_mode == TextureRect.STRETCH_KEEP_ASPECT_COVERED, survivor_id + " roster avatar uses center crop")
		_check(not entry.get_node("Fallback").visible, survivor_id + " does not use fallback portrait")
	_check(roster.get_survivor_view_data("SUR_001").get("portrait_path", "") == "res://assets/characters/xia_zhiyao/portrait/avatar_square.png", "SUR_001 uses Xia Zhiyao's character portrait")
	_check(roster.get_survivor_view_data("SUR_002").get("portrait_path", "") == "res://assets/characters/su_wanxing/portrait/avatar_square.png", "SUR_002 uses Su Wanxing's character portrait")
	_check(roster.find_child("SurvivorEntry_SUR_001", true, false).get_node("NameLabel").text == "夏知遥", "SUR_001 card names Xia Zhiyao")
	_check(roster.find_child("SurvivorEntry_SUR_002", true, false).get_node("NameLabel").text == "苏晚星", "SUR_002 card names Su Wanxing")
	var hover_entry := roster.find_child("SurvivorEntry_SUR_002", true, false) as Button
	var hover_texture: Texture2D = hover_entry.get_node("PortraitTexture").texture
	var hover_event := InputEventMouseMotion.new()
	hover_event.device = 42
	hover_event.position = hover_entry.get_global_rect().get_center()
	root.push_input(hover_event, true)
	await _frames(12)
	_check(hover_entry.scale.x > 1.0 and hover_entry.get_node("PortraitTexture").texture == hover_texture, "Hover highlights SUR_002 without changing portrait")
	await _capture("camp-avatar-hover-1600x900.png")
	var exit_event := InputEventMouseMotion.new()
	exit_event.device = 42
	exit_event.position = Vector2(800, 400)
	root.push_input(exit_event, true)
	await _frames(12)
	_check(is_equal_approx(hover_entry.scale.x, 1.0), "Hover highlight resets")
	_check(app.campaign.discover_survivor("SUR_012"), "SUR_012 can be discovered before detail avatar validation")
	_check(app.campaign.recruit_survivor("SUR_012"), "SUR_012 can be recruited before detail avatar validation")
	hud.refresh_roster()
	await _frames(2)

	var selection_ids: Array[String] = ["SUR_001", "SUR_002", "SUR_012"]
	for selected_id: String in selection_ids:
		roster.select_survivor(selected_id)
		await create_timer(0.35).timeout
		var detail_portrait := detail.get_node("HeaderPanel/PortraitContainer/HalfPortrait") as TextureRect
		var view: Dictionary = roster.get_survivor_view_data(selected_id)
		_check(detail.survivor_id == selected_id, selected_id + " detail selection uses Survivor ID")
		_check(detail_portrait.texture != null and detail_portrait.texture == view.get("portrait"), selected_id + " detail portrait matches its card view")
		var detail_path := str(detail_portrait.texture.resource_path) if detail_portrait.texture != null else ""
		_check(detail_path == str(definition_paths.get(selected_id, "")), selected_id + " detail uses its definition portrait")
		_check(detail_portrait.stretch_mode == TextureRect.STRETCH_KEEP_ASPECT_COVERED, selected_id + " detail avatar uses center crop")

	roster.select_survivor("SUR_002")
	await create_timer(0.35).timeout
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
