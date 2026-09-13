extends SceneTree

var failures: Array[String] = []
var checks := 0

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _initialize() -> void:
	var catalog: RefCounted = load("res://data/catalog.gd").new()
	var game: RefCounted = load("res://core/campaign.gd").new(catalog)
	for wiped: bool in [false, true]:
		game.new_run(772, "", ["xia_zhiyao", "su_wanxing", "lin", "qiao"])
		game.data.food = 20
		var original: Dictionary = game.data.duplicate(true)
		check(game.callv("start_action", ["commercial", ["xia_zhiyao"]]) == true, "One member can depart from a four-member camp")
		check(game.data.get("selected_party") == ["xia_zhiyao"], "Locked party belongs to the existing Campaign save")
		check(game.valid_state(game.data), "Selected party saves validate")
		var invalid: Dictionary = game.data.duplicate(true)
		invalid.selected_party = ["missing"]
		check(not game.valid_state(invalid), "Unknown party identities are rejected")
		invalid.selected_party = ["xia_zhiyao", "xia_zhiyao"]
		check(not game.valid_state(invalid), "Repeated party identities are rejected")
		var result := {"returned_ids": [] if wiped else ["xia_zhiyao"], "lost_ids": ["xia_zhiyao"] if wiped else [], "weapons": [], "food": 0, "scrap": 0, "kills": 0, "seconds": 20, "wiped": wiped}
		check(game.stage_result(result), "Only deployed members are required in an outcome")
		if game.data.status != "pending":
			continue
		check(game.preview().members.size() == (3 if wiped else 4), "Daily rations include the members who stayed at camp")
		var restored: RefCounted = load("res://core/campaign.gd").new(catalog)
		check(restored.restore(game.data), "Pending partial-party outcome survives reload")
		check(restored.commit_day(), "Partial-party outcome advances the existing day loop")
		check(restored.data.status == "shelter" and restored.data.day == 2, "A deployed-party wipe does not end a populated camp")
		for id: String in ["su_wanxing", "lin", "qiao"]:
			check(id in restored.data.members and restored.data.equipment[id] == original.equipment[id], "Resident and their equipment remain: " + id)
		check(restored.data.food == 20 - (3 if wiped else 4) * catalog.loop.food_per_member, "All surviving camp members eat once")
		check(not restored.commit_day(), "Day settlement cannot be applied twice")
	game.new_run(772, "", ["lin", "qiao"])
	var old: Dictionary = game.data.duplicate(true)
	old.erase("selected_party")
	check(game.restore(old) and game.data.get("selected_party") == game.data.members, "Existing saves default to the full alive roster")
	print("CAMP PARTY: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
