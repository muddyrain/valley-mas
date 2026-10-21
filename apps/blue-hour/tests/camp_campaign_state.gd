extends SceneTree
## Camp presentation reads the current Campaign object without owning run state.

const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Store = preload("res://core/save_store.gd")
const HUD = preload("res://ui/camp_hud/camp_hud_root.tscn")
const OUT := "res://test-output/p1-a-camp-state-20261020/"

var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	run.call_deferred()

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func text(hud: Control, path: String) -> String:
	return (hud.get_node(path) as Label).text

func check_values(hud: Control, food: int, scrap: int, day: int, context: String) -> void:
	check(text(hud, "M03_ResourceBar/ResourceFood/Value") == str(food), context + ": actual food")
	check(text(hud, "M03_ResourceBar/ResourceScrap/Value") == str(scrap), context + ": actual scrap")
	check(text(hud, "M01_CampIdentity/CampInfoPanel/DayEn") == "DAY %02d" % day, context + ": English day")
	check(text(hud, "M01_CampIdentity/CampInfoPanel/DayCn") == "第 %d 天" % day, context + ": Chinese day")

func empty_return(game: RefCounted, food: int = 0, scrap: int = 0) -> void:
	check(game.start_action(), "Controlled sortie starts")
	check(game.stage_result({"returned_ids": game.data.members.duplicate(), "lost_ids": [], "food": food, "scrap": scrap, "weapons": [], "wiped": false, "seconds": 10.0, "kills": 0}), "Controlled outcome stages once")
	check(game.commit_day(), "Controlled outcome commits once")

func refresh(hud: Control) -> void:
	if hud.has_method("refresh_campaign_state"):
		hud.refresh_campaign_state()
	else:
		hud.refresh_roster()

func run() -> void:
	create_timer(60.0).timeout.connect(func() -> void: quit(2))
	DirAccess.make_dir_recursive_absolute(OUT)
	var catalog := Catalog.new()
	var game := Campaign.new(catalog)
	game.new_run(772, "survey")
	var hud: Control = HUD.instantiate()
	root.add_child(hud)
	check(text(hud, "M03_ResourceBar/ResourceFood/Value") == "—", "Unbound HUD has no invented food")
	check(text(hud, "M01_CampIdentity/CampInfoPanel/DayCn") == "—", "Unbound HUD has no invented day")
	hud.configure_roster(catalog, game)
	check_values(hud, 6, 0, 1, "New run")
	check(text(hud, "M03_ResourceBar/ResourceIntel/Value") == "—", "No unsupported intelligence balance is invented")
	check(text(hud, "M01_CampIdentity/CampInfoPanel/DescriptionLine1") == "口粮储备充足", "Fresh run has enough current rations")
	check(text(hud, "M01_CampIdentity/CampInfoPanel/DescriptionLine2") == "今晚需 2 食物", "Ration need counts all living campaign members")
	check(hud.has_method("refresh_campaign_state"), "Camp exposes an explicit read-only state refresh")
	empty_return(game)
	hud.refresh_roster()
	check_values(hud, 4, 0, 2, "Empty return")
	var store := Store.new("user://test-runs/camp-campaign-state-%d.json" % OS.get_process_id())
	check(store.write(game.data, game.valid_state).is_empty(), "Day two fixture saves")
	var before_state: Dictionary = game.data.duplicate(true)
	var before_save: String = FileAccess.get_file_as_string(store.path)
	for iteration: int in 30:
		refresh(hud)
		hud.set_hud_visible(false)
		hud.set_hud_visible(true)
	check(game.data == before_state, "Repeated refresh and visibility changes leave the full Campaign unchanged")
	check(FileAccess.get_file_as_string(store.path) == before_save, "Read-only refresh never writes the existing save")
	check(game.data.history.size() == 1 and game.data.pending.is_empty(), "Refresh never restages or repeats settlement")
	empty_return(game, 0, 9)
	hud.set_hud_visible(false)
	hud.set_hud_visible(true)
	check_values(hud, 2, 9, 3, "Second return and restored visibility")
	empty_return(game)
	refresh(hud)
	check_values(hud, 0, 9, 4, "Low stock before the next meal")
	check(game.data.hunger == 0, "Empty stock alone has not applied hunger")
	check(text(hud, "M01_CampIdentity/CampInfoPanel/DescriptionLine1") == "口粮储备不足", "Low stock is not misreported as an active hunger penalty")
	empty_return(game)
	refresh(hud)
	check_values(hud, 0, 9, 5, "First missed meal")
	check(game.data.hunger == 1, "First missed meal keeps the existing grace rule")
	check(text(hud, "M01_CampIdentity/CampInfoPanel/DescriptionLine1") == "缺粮影响未解除", "Active hunger is visible")
	check(text(hud, "M01_CampIdentity/CampInfoPanel/DescriptionLine2") == "生命上限 80%", "Hunger displays the existing rules value")
	# A rollback can replace data on the same Campaign instance; never retain that dictionary.
	game.data = before_state.duplicate(true)
	refresh(hud)
	check_values(hud, 4, 0, 2, "Replaced Campaign data after rollback")
	check(text(hud, "M01_CampIdentity/CampInfoPanel/DescriptionLine1") == "口粮储备充足", "Rollback clears a stale hunger label")
	var loaded := Campaign.new(catalog)
	check(loaded.restore(store.read(loaded.valid_state).data), "Saved Campaign restores")
	hud.configure_roster(catalog, loaded)
	check_values(hud, 4, 0, 2, "Rebound restored Campaign")
	loaded.new_run(845, "combat")
	refresh(hud)
	check_values(hud, 6, 0, 1, "New run on the same Campaign object")
	var solo := Campaign.new(catalog)
	solo.new_run(910, "", ["xia_zhiyao"])
	hud.configure_roster(catalog, solo)
	check(text(hud, "M01_CampIdentity/CampInfoPanel/DescriptionLine2") == "今晚需 1 食物", "Solo ration need does not use catalog size")
	FileAccess.open(OUT + "state-report.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "method": "real HUD and Campaign; controlled rule transactions; isolated save"}, "\t"))
	print("CAMP CAMPAIGN STATE: %d checks, %d failures" % [checks, failures.size()])
	hud.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
