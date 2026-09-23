extends SceneTree

const MAIN := preload("res://core/main.tscn")
const OUTPUT := "res://test-output/camp-survivor-panel/"
var failures: Array[String] = []

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	root.size = Vector2i(1600, 900)
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/m05-selected-detail.json"
	app.fresh_test_run = true
	root.add_child(app)
	await _frames(30)
	app.show_shelter()
	await _frames(30)
	var hud: Control = app.camp_ui
	var roster: Control = hud.get_node("M04_SurvivorRoster")
	var detail: Control = hud.get_node("M05_SurvivorDetail")
	var before: Dictionary = app.campaign.data.duplicate(true)
	var entry_001: Button = roster.find_child("SurvivorEntry_SUR_001", true, false)
	var entry_012: Button = roster.find_child("SurvivorEntry_SUR_012", true, false)
	_check(not detail.visible, "M05 starts hidden")
	entry_001.emit_signal("pressed")
	await create_timer(0.35).timeout
	_check(detail.visible, "Selecting a survivor reveals M05")
	_check(detail.survivor_id == "SUR_001", "M05 tracks the selected survivor ID")
	_check(detail.get_node("HeaderPanel/SurvivorName").text == "夏知遥", "SUR_001 display name is authored")
	_check(detail.get_node("HeaderPanel/SurvivorNameEn").text.contains("SUR_001") and detail.get_node("HeaderPanel/SurvivorNameEn").text.contains("Lv.1") and detail.get_node("HeaderPanel/HPLabel").text == "HP 100 / 100", "M05 separates ID, level, state, and HP")
	_check(detail.get_node("HeaderPanel/TraitBadge/Label").text == roster.get_survivor_view_data("SUR_001").get("tags"), "M05 surfaces role tags from the selected view")
	_check(detail.has_node("HeaderPanel/PortraitContainer/HalfPortrait"), "M05 keeps an independent portrait container")
	_check(detail.get_node("BackgroundPanel/SectionTitle").text == "人物小记" and detail.get_node("HeaderPanel/RoleLabel").text.contains("城市徒步"), "M05 uses background title")
	_check(app.catalog.by_id(app.catalog.profiles, "SUR_001").before_apocalypse.begins_with(detail.get_node("BackgroundPanel/BackgroundDescription").text.left(6)), "M05 uses the matching SurvivorProfile")
	_check(detail.get_node("BackgroundPanel/BackgroundDescription").autowrap_mode > 0 and detail.get_node("BackgroundPanel/BackgroundDescription").clip_text, "M05 constrains background description")
	_check(detail.get_node("CombatPanel/EquipmentTitle").text == "装备", "M05 has a distinct equipment section")
	_check(detail.get_node("TraitPanel/TraitName").text == "搜寻直觉 · Lv.1", "M05 uses formal trait and current level")
	_check(detail.get_node("TraitPanel/TraitDescription").text.contains("搜索速度"), "M05 uses current trait level description")
	_check(detail.get_node("CombatPanel/WeaponName").text == "未装备", "Empty equipment uses adapter fallback")
	_check(detail.get_node("ActionBar/SwitchButton").disabled and detail.get_node("ActionBar/EquipmentButton").disabled and detail.get_node("ActionBar/UpgradeButton").disabled, "M05 action states remain disabled")
	_check(detail.get_global_rect().size == Vector2(378, 500), "M05 uses a larger presentation layout")
	await _capture("sur001-detail-1600x900.png")
	_check(app.campaign.discover_survivor("SUR_012"), "SUR_012 can be discovered before detail switching")
	_check(app.campaign.recruit_survivor("SUR_012"), "SUR_012 can be recruited before detail switching")
	before = app.campaign.data.duplicate(true)
	hud.refresh_roster()
	await _frames(2)
	_check(roster.get_survivor_view_data("SUR_012").get("is_recruited", false), "SUR_012 roster view is recruited before detail switching")
	roster.select_survivor("SUR_012")
	await create_timer(0.35).timeout
	_check(detail.survivor_id == "SUR_012", "M05 switches by survivor ID")
	_check(detail.get_node("HeaderPanel/SurvivorName").text == "宋时雨", "SUR_012 display name is authored")
	_check(detail.get_node("HeaderPanel/RoleLabel").text.contains("活动统筹"), "SUR_012 background title is authored")
	_check(detail.get_node("TraitPanel/TraitName").text == "从容不迫 · Lv.1", "SUR_012 trait is formal and leveled")
	_check(detail.get_node("TraitPanel/TraitDescription").text.contains("冷却"), "SUR_012 trait description is formal data")
	_check(detail.get_instance_id() == hud.get_node("M05_SurvivorDetail").get_instance_id(), "Detail instance is reused")
	await _capture("sur012-detail-1600x900.png")
	_check(app.campaign.data == before, "Detail presentation does not mutate Campaign")
	var report := FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"failures": failures}, "\t"))
	print("M05 SELECTED DETAIL DATA: %d failures" % failures.size())
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
