extends SceneTree

const MAIN := preload("res://core/main.tscn")
const Catalog := preload("res://data/catalog.gd")
const Campaign := preload("res://core/campaign.gd")
const SaveStore := preload("res://core/save_store.gd")
const Roster := preload("res://data/survivor_roster_manager.gd")

const SAVE_PATH := "user://test-runs/camp-roster-integration.json"
const OUTPUT := "res://test-output/camp-survivor-panel/"

var failures: Array[String] = []
var app: Node
var catalog: RefCounted

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	root.size = Vector2i(1600, 900)
	catalog = Catalog.new()
	app = MAIN.instantiate()
	app.save_path = SAVE_PATH
	app.fresh_test_run = true
	root.add_child(app)
	await _frames(30)
	app.campaign.new_run(64001, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await _frames(30)

	var hud: Control = app.camp_ui
	var roster: Control = hud.get_node("M04_SurvivorRoster")
	var detail: Control = hud.get_node("M05_SurvivorDetail")
	var entries: Array[Node] = roster.find_children("SurvivorEntry_*", "Button", true, false)
	var entry_001 := roster.find_child("SurvivorEntry_SUR_001", true, false) as Button
	var entry_002 := roster.find_child("SurvivorEntry_SUR_002", true, false) as Button
	_check(entries.size() == 2, "Camp builds entries only for recruited Survivors")
	_check(roster.get_node("Header/Title").text == "营地成员" and roster.get_node("Header/Count").text == "2", "Camp shows current member count")
	_check(roster.get_survivor_view_data("SUR_001").get("is_recruited", false), "SUR_001 is a recruited view")
	_check(roster.get_survivor_view_data("SUR_001").get("display_name", "") == "夏知遥", "Recruited view exposes authored name")
	_check(roster.get_survivor_view_data("SUR_001").get("trait_name", "") == "搜寻直觉", "Recruited view exposes authored Trait")
	_check(roster.get_survivor_view_data("SUR_003").is_empty(), "Unrecruited Survivor has no Camp view")
	_check(roster.find_child("SurvivorEntry_SUR_003", true, false) == null, "Unrecruited Survivor has no Camp card")
	_check(entry_001.get_node("NameLabel").text == "夏知遥", "SUR_001 card shows Xia Zhiyao")
	_check(entry_001.get_node("MetaLabel").text == "Lv.1", "Roster card keeps a compact level label")
	_check(not entry_001.get_node("EnglishLabel").visible and not entry_001.get_node("StatusDots").visible, "Roster cards prioritize the portrait")
	_check(entry_001.size.y > entry_001.size.x, "Roster cards use a vertical portrait layout")
	_check(str(entry_001.get_node("PortraitTexture").texture.resource_path) == "res://assets/characters/xia_zhiyao/portrait/avatar_square.png", "SUR_001 card uses Xia Zhiyao's character portrait")
	_check(entry_002.get_node("NameLabel").text == "苏晚星", "SUR_002 card shows Su Wanxing")
	_check(str(entry_002.get_node("PortraitTexture").texture.resource_path) == "res://assets/characters/su_wanxing/portrait/avatar_square.png", "SUR_002 card uses Su Wanxing's character portrait")
	_check(not detail.visible, "Default Camp view has no detail panel")
	await _capture("camp-default-1600x900.png")
	entry_001.mouse_entered.emit()
	await create_timer(0.20).timeout
	_check(is_equal_approx(entry_001.scale.x, 1.02) and is_equal_approx(entry_001.pivot_offset.y, entry_001.size.y), "Roster hover brightens and lifts from the portrait card baseline")
	await _capture("camp-hover-1600x900.png")
	entry_001.mouse_exited.emit()
	await create_timer(0.20).timeout
	roster.select_survivor("SUR_001")
	await create_timer(0.35).timeout
	_check(detail.survivor_id == "SUR_001" and detail.visible, "Detail opens from selected Survivor ID")
	_check(is_equal_approx(entry_001.scale.x, 1.03) and is_equal_approx(entry_001.pivot_offset.y, entry_001.size.y * 0.5), "Selected roster card scales around its center with clear emphasis")
	_check(detail.get_node("HeaderPanel/SurvivorName").text == "夏知遥", "Detail name follows selected ID")
	_check(detail.get_node("HeaderPanel/SurvivorNameEn").text.contains("SUR_001") and detail.get_node("HeaderPanel/SurvivorNameEn").text.contains("Lv.1"), "Detail ID and level follow selected ID")
	_check(detail.get_node("HeaderPanel/TraitBadge/Label").text == "探索专家", "SUR_001 has a concise exploration role tag")
	_check(detail.get_node("TraitPanel/TraitName").text.contains("搜寻直觉"), "Detail Trait follows selected ID")
	_check(not detail.get_node("BackgroundPanel").visible and not detail.get_node("HeaderPanel/RoleLabel").visible, "Detail keeps the mission header free of profile copy")
	_check(detail.get_node("CombatPanel/WeaponIconSlot") != null, "Equipment panel reserves a future icon slot")
	_check(detail.get_node("HeaderPanel/PortraitContainer/HalfPortrait").texture == entry_001.get_node("PortraitTexture").texture, "Detail portrait matches selected card")
	_check(detail.get_global_rect().size == Vector2(390, 526), "Detail keeps a compact dossier footprint")
	await _capture("camp-sur001-1600x900.png")
	roster.select_survivor("SUR_002")
	await create_timer(0.35).timeout
	_check(detail.survivor_id == "SUR_002" and detail.get_node("HeaderPanel/SurvivorName").text == "苏晚星", "SUR_002 detail shows Su Wanxing")
	_check(detail.get_node("HeaderPanel/TraitBadge/Label").text == "资源管理", "SUR_002 has a concise resource role tag")
	_check(detail.get_node("HeaderPanel/PortraitContainer/HalfPortrait").texture == entry_002.get_node("PortraitTexture").texture, "SUR_002 detail uses the card portrait")
	await _capture("camp-sur002-1600x900.png")

	_check(app.campaign.discover_survivor("SUR_004"), "Roster discovery changes ownership state")
	hud.refresh_roster()
	await _frames(2)
	var discovered: Dictionary = roster.get_survivor_view_data("SUR_004")
	_check(discovered.is_empty(), "Discovered Survivor stays outside Camp")
	_check(roster.get_node("Header/Count").text == "2", "Discovery does not change Camp count")

	_check(app.campaign.recruit_survivor("SUR_004"), "Roster recruitment changes ownership state")
	hud.refresh_roster()
	await _frames(2)
	_check(roster.get_node("Header/Count").text == "3", "Recruitment refresh updates count")
	var recruited: Dictionary = roster.get_survivor_view_data("SUR_004")
	_check(recruited.get("is_recruited", false), "Recruited view reflects RECRUITED state")
	_check(recruited.get("display_name", "") == "陆清禾", "Recruited view exposes authored name")
	_check(str(recruited.get("status", "")).contains("已招募"), "Recruited view shows recruited status")
	roster.select_survivor("SUR_004")
	await create_timer(0.35).timeout
	_check(detail.survivor_id == "SUR_004" and detail.get_node("HeaderPanel/SurvivorName").text == "陆清禾", "Detail switches to recruited ID")
	_check(detail.get_node("HeaderPanel/PortraitContainer/HalfPortrait").texture == recruited.get("portrait"), "Recruited detail portrait matches view")
	var store := SaveStore.new(SAVE_PATH)
	_check(store.write(app.campaign.data, app.campaign.valid_state).is_empty(), "Roster state saves through Campaign")
	var restored := Campaign.new(catalog)
	var loaded: Dictionary = store.read(restored.valid_state)
	_check(loaded.ok and restored.restore(loaded.data), "Roster state loads through Campaign")
	_check(restored.survivor_roster.get_state("SUR_004") == Roster.RECRUITED, "Recruited state survives Save/Load")
	hud.configure_roster(catalog, restored)
	await _frames(2)
	_check(roster.get_node("Header/Count").text == "3", "Camp count survives Save/Load")
	_check(roster.get_survivor_view_data("SUR_004").get("is_recruited", false), "Camp reload shows recruited Survivor")
	for survivor_id: String in ["SUR_003", "SUR_005"]:
		_check(restored.discover_survivor(survivor_id) and restored.recruit_survivor(survivor_id), "Roster supports an additional recruitment")
	hud.refresh_roster()
	await _frames(2)
	_check(roster.get_node("Header/Count").text == "5", "Dynamic roster supports five recruited Survivors")
	for survivor_id: String in ["SUR_006", "SUR_007", "SUR_008", "SUR_009", "SUR_010", "SUR_011", "SUR_012"]:
		_check(restored.discover_survivor(survivor_id) and restored.recruit_survivor(survivor_id), "Roster supports full-catalog recruitment")
	hud.refresh_roster()
	await _frames(2)
	_check(roster.get_node("Header/Count").text == "12", "Dynamic roster supports twelve recruited Survivors")
	_check(roster.get_global_rect().size.y == 500.0, "Roster rail caps at four visible portrait cards")
	_check(roster.get_node("RosterContainer/OverlayScrollBar").visible, "Additional members enable the light overlay scrollbar")
	roster.get_node("RosterContainer/OverlayScrollBar").value = 114.0
	await _frames(2)
	_check(roster.get_node("RosterContainer/ScrollContainer").scroll_vertical > 0, "Additional portrait cards remain scrollable")

	_cleanup()
	app.queue_free()
	await _frames(2)
	print("CAMP ROSTER INTEGRATION: %d failures" % failures.size())
	for failure: String in failures:
		printerr(failure)
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
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	_check(screenshot.get_size() == Vector2i(1600, 900), "Camp screenshot is 1600x900")
	_check(screenshot.save_png(OUTPUT + filename) == OK, "Camp screenshot saved")

func _cleanup() -> void:
	for suffix: String in ["", ".bak", ".tmp"]:
		var path := SAVE_PATH + suffix
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
