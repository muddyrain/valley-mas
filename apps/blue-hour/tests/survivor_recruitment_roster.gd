extends SceneTree

const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const SaveStore = preload("res://core/save_store.gd")
const Roster = preload("res://data/survivor_roster_manager.gd")

var checks: int = 0
var failures: Array[String] = []
const SAVE_PATH := "user://test-runs/survivor-recruitment-roster.json"

func _initialize() -> void:
	var catalog := Catalog.new()
	var manager := Roster.new(catalog)
	_check(manager.get_all_survivors().size() == 12, "All twelve Survivors are available to the ownership layer")
	_check(manager.get_recruited_survivors().map(func(d: Resource) -> String: return d.survivor_id) == ["SUR_001", "SUR_002"], "Initial roster recruits SUR_001 and SUR_002")
	_check(manager.get_state("SUR_003") == Roster.LOCKED and manager.get_state("lin_jianyue") == Roster.LOCKED, "Remaining Survivors start locked")
	_check(not manager.discover_survivor("SUR_001"), "Already recruited Survivor cannot be rediscovered")
	_check(manager.discover_survivor("SUR_004"), "Locked Survivor becomes discovered")
	_check(manager.get_state("lu_qinghe") == Roster.DISCOVERED, "Discovery is visible through legacy ID")
	_check(not manager.recruit_survivor("SUR_005"), "Locked Survivor cannot be recruited directly")
	_check(manager.recruit_survivor("SUR_004"), "Discovered Survivor becomes recruited")
	_check(manager.is_recruited("SUR_004"), "Recruitment query is true")
	_check(manager.get_available_party_survivors().size() == 3, "Available party contains recruited Survivors")

	var campaign := Campaign.new(catalog)
	campaign.new_run(55004, "", ["xia_zhiyao", "su_wanxing"])
	_check(campaign.data.survivor_states.get("SUR_003") == Roster.LOCKED, "New run persists locked state")
	_check(campaign.discover_survivor("SUR_004") and campaign.recruit_survivor("SUR_004"), "Campaign forwards roster transitions")
	var store := SaveStore.new(SAVE_PATH)
	_check(store.write(campaign.data, campaign.valid_state).is_empty(), "Roster state saves")
	var restored := Campaign.new(catalog)
	var loaded: Dictionary = store.read(restored.valid_state)
	_check(loaded.ok and restored.restore(loaded.data), "Roster state loads")
	_check(restored.survivor_roster.get_state("SUR_004") == Roster.RECRUITED, "Recruitment survives Save/Load")
	_check(restored.survivor_roster.get_state("SUR_003") == Roster.LOCKED, "Unrecruited state survives Save/Load")
	_check(restored.member_level(restored.data.members[0]) == 1, "Progression remains intact")
	_cleanup()
	print("SURVIVOR RECRUITMENT ROSTER: %d checks, %d failures" % [checks, failures.size()])
	for failure: String in failures:
		printerr(failure)
	quit(0 if failures.is_empty() else 1)

func _check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		printerr(label)

func _cleanup() -> void:
	for suffix: String in ["", ".bak", ".tmp"]:
		var path := SAVE_PATH + suffix
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
