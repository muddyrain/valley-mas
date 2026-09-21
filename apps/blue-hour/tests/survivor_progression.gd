extends SceneTree

const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Save = preload("res://core/save_store.gd")
const Progression = preload("res://data/survivor_progression.gd")

var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		printerr(message)

func run() -> void:
	var catalog := Catalog.new()
	var campaign := Campaign.new(catalog)
	campaign.new_run(7301, "", ["xia_zhiyao", "su_wanxing"])
	var xia_id: String = campaign.data.members[0]
	check(campaign.data.version == 5, "New runs use progression schema v5")
	check(campaign.member_level(xia_id) == 1 and campaign.member_trait_level(xia_id) == 1, "New survivor starts at level one")
	check(campaign.member_xp(xia_id) == 0 and campaign.member_total_xp(xia_id) == 0 and campaign.member_xp_to_next_level(xia_id) == 2, "New survivor has the first XP threshold")
	check(Progression.default_event_xp(Progression.EventType.SEARCH_COMPLETE) == 1, "Search completion uses the configured XP value")
	check(Progression.default_event_xp(Progression.EventType.KILL_ENEMY) == 1, "Enemy kill uses the configured XP value")
	check(Progression.default_event_xp(Progression.EventType.MISSION_COMPLETE) == 5, "Mission completion uses the configured XP value")
	check(Progression.default_event_xp(Progression.EventType.EXTRACTION_SUCCESS) == 3, "Successful extraction uses the configured XP value")

	check(campaign.record_xp_event(xia_id, Progression.EventType.SEARCH_COMPLETE) == 1, "Search event awards XP")
	check(campaign.member_level(xia_id) == 1 and campaign.member_xp(xia_id) == 1 and campaign.member_xp_to_next_level(xia_id) == 1, "XP remains within level one")
	check(campaign.record_xp_event(xia_id, Progression.EventType.EXTRACTION_SUCCESS) == 3, "Extraction event awards the configured XP")
	check(campaign.member_level(xia_id) == 2 and campaign.member_trait_level(xia_id) == 2 and campaign.member_xp(xia_id) == 2, "Level two synchronizes Trait level")
	check(campaign.member_total_xp(xia_id) == 4 and campaign.member_xp_to_next_level(xia_id) == 1, "Level two threshold accounts for carried XP")

	check(campaign.add_xp(xia_id, 3) == 3, "Direct XP API accepts a batch")
	check(campaign.member_level(xia_id) == 3 and campaign.member_trait_level(xia_id) == 3, "Batch XP advances to level three")
	check(campaign.add_xp(xia_id, 5) == 5 and campaign.member_level(xia_id) == 4, "Level three threshold is five XP")
	check(campaign.add_xp(xia_id, 8) == 8 and campaign.member_level(xia_id) == 5 and campaign.member_trait_level(xia_id) == 5, "Level four threshold is eight XP")
	check(not campaign.can_level_up(xia_id) and not campaign.apply_level_up(xia_id), "Level five cannot advance")
	var total_at_cap: int = campaign.member_total_xp(xia_id)
	check(campaign.add_xp(xia_id, 100) == 100 and campaign.member_level(xia_id) == 5 and campaign.member_total_xp(xia_id) == total_at_cap + 100, "Level five keeps the cap while recording lifetime XP")

	var level_three := Campaign.new(catalog)
	level_three.new_run(7302, "", ["xia_zhiyao"])
	var level_three_id: String = level_three.data.members[0]
	level_three.add_xp(level_three_id, 5)
	var store := Save.new("user://test-runs/survivor-progression-%d.json" % OS.get_process_id())
	check(store.write(level_three.data, level_three.valid_state).is_empty(), "Level three progression saves")
	var restored := Campaign.new(catalog)
	var saved: Dictionary = store.read(restored.valid_state)
	check(saved.ok and restored.restore(saved.data), "Level three progression loads")
	check(restored.member_level(level_three_id) == 3 and restored.member_trait_level(level_three_id) == 3 and restored.member_xp(level_three_id) == 0 and restored.member_total_xp(level_three_id) == 5, "Level three and XP survive save/load")

	var legacy_v4: Dictionary = level_three.data.duplicate(true)
	legacy_v4.version = 4
	for member: Dictionary in legacy_v4.roster.values():
		member.erase("current_level")
		member.erase("current_xp")
		member.erase("total_xp")
		member.erase("xp_to_next_level")
	var migrated := Campaign.new(catalog)
	check(migrated.valid_state(legacy_v4), "Pre-progression v4 state remains readable")
	check(migrated.restore(legacy_v4) and migrated.data.version == 5, "v4 state migrates to progression schema")
	check(migrated.member_level(level_three_id) == 3 and migrated.member_total_xp(level_three_id) == 5, "Migrated level derives minimum lifetime XP")

	var mission_campaign := Campaign.new(catalog)
	mission_campaign.new_run(7303, "", ["xia_zhiyao", "su_wanxing"])
	var deployed_id: String = mission_campaign.data.members[0]
	var shelter_id: String = mission_campaign.data.members[1]
	check(mission_campaign.start_action("", [deployed_id]), "A selected party starts an action")
	var outcome := {"returned_ids": [deployed_id], "lost_ids": [], "food": 0, "scrap": 0, "weapons": [], "wiped": false, "seconds": 12, "kills": 0}
	check(mission_campaign.stage_result(outcome), "Mission completion enters the pending state")
	check(mission_campaign.member_total_xp(deployed_id) == 8 and mission_campaign.member_level(deployed_id) == 3, "Mission and extraction XP apply to the deployed survivor")
	check(mission_campaign.member_total_xp(shelter_id) == 0, "A non-deployed survivor receives no mission XP")
	check(not mission_campaign.stage_result(outcome) and mission_campaign.member_total_xp(deployed_id) == 8, "Repeated mission completion cannot duplicate XP")

	FileAccess.open("res://test-output/survivor-progression.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("SURVIVOR PROGRESSION: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
