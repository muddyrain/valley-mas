extends SceneTree

const MAIN := preload("res://core/main.tscn")
const OUTPUT := "res://test-output/camp-survivor-detail-m05/"
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
	await _frames(2)
	_check(detail.visible, "Selecting a survivor reveals M05")
	_check(detail.survivor_id == "SUR_001", "M05 tracks the selected survivor ID")
	_check(detail.get_node("HeaderPanel/SurvivorName").text == "夏知遥", "SUR_001 display name is authored")
	_check(detail.get_node("HeaderPanel/SurvivorNameEn").text == "SUR_001 · Lv.1" and detail.get_node("HeaderPanel/HPLabel").text == "HP 100 / 100", "M05 separates ID, level, and HP")
	_check(detail.has_node("HeaderPanel/PortraitContainer/HalfPortrait"), "M05 keeps an independent portrait container")
	_check(detail.get_node("BackgroundPanel/SectionTitle").text == "灾变前身份" and detail.get_node("BackgroundPanel/BackgroundRole").text.contains("城市徒步"), "M05 uses background title")
	_check(detail.get_node("BackgroundPanel/BackgroundDescription").text == "她以前就喜欢钻进城市那些不太有人注意的小巷、旧街区和废弃建筑，习惯用相机记录路线和有趣的小角落。灾变以后，这种对环境异常敏感的习惯让她总能更快找到入口、储藏间以及容易被遗漏的物资。", "M05 uses background description")
	_check(detail.get_node("BackgroundPanel/BackgroundDescription").autowrap_mode > 0 and detail.get_node("BackgroundPanel/BackgroundDescription").clip_text, "M05 constrains background description")
	_check(detail.get_node("CombatPanel/EquipmentTitle").text == "装备", "M05 has a distinct equipment section")
	_check(detail.get_node("TraitPanel/TraitName").text == "搜寻直觉 · Lv.1", "M05 uses formal trait and current level")
	_check(detail.get_node("TraitPanel/TraitDescription").text.contains("搜索速度"), "M05 uses current trait level description")
	_check(detail.get_node("CombatPanel/WeaponName").text == "未装备", "Empty equipment uses adapter fallback")
	_check(detail.get_node("ActionBar/SwitchButton").disabled and detail.get_node("ActionBar/EquipmentButton").disabled and detail.get_node("ActionBar/UpgradeButton").disabled, "M05 action states remain disabled")
	_check(detail.get_global_rect().size == Vector2(354, 452), "M05 geometry remains fixed")
	await _capture("sur001-detail-1600x900.png")
	entry_012.emit_signal("pressed")
	await _frames(2)
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
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	_check(screenshot.get_size() == Vector2i(1600, 900), "Screenshot is 1600x900")
	_check(screenshot.save_png(OUTPUT + filename) == OK, "Saved " + filename)
