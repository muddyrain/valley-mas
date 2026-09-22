extends SceneTree

const MAIN := preload("res://core/main.tscn")
const Catalog := preload("res://data/catalog.gd")
const Campaign := preload("res://core/campaign.gd")
const SaveStore := preload("res://core/save_store.gd")
const Roster := preload("res://data/survivor_roster_manager.gd")

const SAVE_PATH := "user://test-runs/camp-roster-integration.json"

var failures: Array[String] = []
var app: Node
var catalog: RefCounted

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
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
	var entries: Array[Node] = roster.find_children("SurvivorEntry_*", "Button", true, false)
	_check(entries.size() == 12, "Camp builds one dynamic entry for every catalog Survivor")
	_check(roster.get_node("Header/Count").text == "2/12", "Initial Camp count is recruited/total")
	_check(roster.get_survivor_view_data("SUR_001").get("is_recruited", false), "SUR_001 is a recruited view")
	_check(roster.get_survivor_view_data("SUR_001").get("display_name", "") == "夏知遥", "Recruited view exposes authored name")
	_check(roster.get_survivor_view_data("SUR_001").get("trait_name", "") == "搜寻直觉", "Recruited view exposes authored Trait")
	_check(entries[0].get_node("EnglishLabel").text == "搜寻直觉", "Camp slot displays Trait name")
	_check(entries[0].get_node("MetaLabel").text.contains("已招募"), "Camp slot displays recruitment state")
	_check(roster.get_survivor_view_data("SUR_003").get("display_name", "") == "未知幸存者", "Locked view hides complete identity")
	_check(roster.get_survivor_view_data("SUR_003").get("portrait") == null, "Locked view hides portrait")
	_check(roster.get_survivor_view_data("SUR_003").get("status", "") == "未知幸存者", "Locked view exposes unknown status")

	_check(app.campaign.discover_survivor("SUR_004"), "Roster discovery changes ownership state")
	hud.refresh_roster()
	await _frames(2)
	var discovered: Dictionary = roster.get_survivor_view_data("SUR_004")
	_check(discovered.get("is_discovered", false), "Discovered view reflects DISCOVERED state")
	_check(discovered.get("display_name", "") == "陆清禾", "Discovered view exposes discovered name")
	_check(str(discovered.get("status", "")).contains("已发现"), "Discovered view shows waiting status")

	_check(app.campaign.recruit_survivor("SUR_004"), "Roster recruitment changes ownership state")
	hud.refresh_roster()
	await _frames(2)
	_check(roster.get_node("Header/Count").text == "3/12", "Recruitment refresh updates count")
	var recruited: Dictionary = roster.get_survivor_view_data("SUR_004")
	_check(recruited.get("is_recruited", false), "Recruited view reflects RECRUITED state")
	_check(recruited.get("display_name", "") == "陆清禾", "Recruited view exposes authored name")
	_check(str(recruited.get("status", "")).contains("已招募"), "Recruited view shows recruited status")
	var store := SaveStore.new(SAVE_PATH)
	_check(store.write(app.campaign.data, app.campaign.valid_state).is_empty(), "Roster state saves through Campaign")
	var restored := Campaign.new(catalog)
	var loaded: Dictionary = store.read(restored.valid_state)
	_check(loaded.ok and restored.restore(loaded.data), "Roster state loads through Campaign")
	_check(restored.survivor_roster.get_state("SUR_004") == Roster.RECRUITED, "Recruited state survives Save/Load")
	hud.configure_roster(catalog, restored)
	await _frames(2)
	_check(roster.get_node("Header/Count").text == "3/12", "Camp count survives Save/Load")
	_check(roster.get_survivor_view_data("SUR_004").get("is_recruited", false), "Camp reload shows recruited Survivor")
	for survivor_id: String in ["SUR_003", "SUR_005"]:
		_check(restored.discover_survivor(survivor_id) and restored.recruit_survivor(survivor_id), "Roster supports an additional recruitment")
	hud.refresh_roster()
	await _frames(2)
	_check(roster.get_node("Header/Count").text == "5/12", "Dynamic roster supports five recruited Survivors")
	for survivor_id: String in ["SUR_006", "SUR_007", "SUR_008", "SUR_009", "SUR_010", "SUR_011", "SUR_012"]:
		_check(restored.discover_survivor(survivor_id) and restored.recruit_survivor(survivor_id), "Roster supports full-catalog recruitment")
	hud.refresh_roster()
	await _frames(2)
	_check(roster.get_node("Header/Count").text == "12/12", "Dynamic roster supports twelve recruited Survivors")

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

func _cleanup() -> void:
	for suffix: String in ["", ".bak", ".tmp"]:
		var path := SAVE_PATH + suffix
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
