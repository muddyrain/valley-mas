extends SceneTree
var checks := 0
var failures := 0

func check(value: bool, description: String) -> void:
	checks += 1
	if not value:
		failures += 1
		print("FAIL: " + description)

func outcome(game, alive: Array, food: int = 0, scrap: int = 0, weapons: Array = []) -> Dictionary:
	var lost: Array = []
	for id in game.data.members:
		if id not in alive:
			lost.append(id)
	return {"returned_ids": alive.duplicate(), "lost_ids": lost, "food": food, "scrap": scrap, "weapons": weapons, "wiped": alive.is_empty(), "seconds": 120.0, "kills": 3}

func _initialize() -> void:
	if not FileAccess.file_exists("res://core/campaign.gd"):
		check(false, "Cross-day campaign must exist; current slice resets every sortie")
		quit(1)
		return
	var Catalog = load("res://data/catalog.gd")
	var Campaign = load("res://core/campaign.gd")
	var Store = load("res://core/save_store.gd")
	var catalog = Catalog.new()
	var game = Campaign.new(catalog)
	game.new_run(772, "", ["lin", "qiao", "yan"])
	check(game.data.members.size() == 3 and game.data.food == 6, "Three members and two days of initial food")
	check(game.start_action() and not game.start_action(), "Duplicate departure rejected")
	var members: Array = game.data.members.duplicate()
	var lost_weapon: String = game.data.equipment[members[2]]
	check(game.stage_result(outcome(game, members.slice(0, 2), 0, 10)), "Stage casualties before food settlement")
	check(game.preview().need == 2, "Only returning members need food")
	check(game.commit_day(), "Commit normal return")
	check(game.data.members.size() == 2 and game.data.day == 2 and game.data.food == 4, "Casualty persists and day advances once")
	check(game.item(lost_weapon).is_empty(), "Combat casualty loses equipped weapon")
	var settled := JSON.stringify(game.data)
	check(not game.commit_day() and not game.stage_result(outcome(game, [])) and JSON.stringify(game.data) == settled, "Repeated result/commit cannot mutate settled state")
	game.data.food = 0
	game.start_action()
	game.stage_result(outcome(game, game.data.members))
	check(not game.preview().fatal, "First shortage grants grace")
	game.commit_day()
	check(game.data.hunger == 1 and game.health_multiplier() == 0.8 and game.data.members.size() == 2, "Hunger affects next day without immediate death")
	game.start_action()
	game.stage_result(outcome(game, game.data.members, 1))
	check(game.preview().fatal and game.preview().slots == 1, "Consecutive shortage has explicit ration slots")
	check(not game.commit_day([]), "Must select correct number of fed members")
	var fed: String = game.data.members[1]
	var starved: String = game.data.members[0]
	var retained: String = game.data.equipment[starved]
	check(game.commit_day([fed]), "Confirm chosen ration recipient")
	check(game.data.members == [fed] and not game.item(retained).is_empty(), "Starvation removes chosen casualty but retains shelter weapon")
	check(game.data.hunger == 2 and game.health_multiplier() == 0.8, "Hunger cap never stacks")
	game.start_action()
	game.stage_result(outcome(game, [fed], 1))
	game.commit_day()
	check(game.data.hunger == 0 and game.health_multiplier() == 1.0, "Adequate food resets community hunger")
	game.start_action()
	game.stage_result(outcome(game, [fed], 1))
	game.commit_day()
	check(game.data.status == "won" and game.data.day == 5 and not game.start_action(), "Day five ends after settlement with one survivor")
	game.new_run(773, "", ["lin", "qiao", "yan"])
	check(game.data.members.size() == 3 and game.data.history.is_empty() and game.data.scrap == 0, "New run resets state, restores character availability")
	var original = game.data.duplicate(true)
	game.data.scrap = 100
	var offer: Dictionary = game.data.shop[0]
	check(game.buy(offer.uid) and not game.buy(offer.uid), "Shop item bought once")
	check(game.data.scrap == 100 - offer.price, "Purchase charges exact visible price")
	game.data.scrap = 0
	var before := JSON.stringify(game.data)
	check(not game.buy(game.data.shop[1].uid) and JSON.stringify(game.data) == before, "Insufficient funds change nothing")
	var first: Dictionary = game.data.inventory[0]
	var second: Dictionary = {"uid": "test-twin", "kind": first.kind, "affix": "extended"}
	game.data.inventory.append(second)
	check(game.equip(game.data.members[1], second.uid), "Equip another instance of same weapon kind")
	check(game.data.equipment[game.data.members[0]] != game.data.equipment[game.data.members[1]], "Instances are separate")
	check(game.weapon(second.uid).magazine > game.weapon(first.uid).magazine, "Affix modifies only its own instance")
	check(catalog.by_id(catalog.weapons, first.kind).magazine == game.weapon(first.uid).magazine, "Shared template remains unchanged")
	game.equip(game.data.members[0], second.uid)
	check(game.data.equipment[game.data.members[1]] == "" and game.weapon_inventory.has_weapon(first.uid), "Transferred instance has one holder; old weapon stays in stock")
	game.new_run(773, "", ["lin", "qiao", "yan"])
	check(game.data.day_rewards == original.day_rewards and game.data.shop == original.shop, "Seed fixes daily rewards and shop")
	var loot: Dictionary = game.data.day_rewards.values()[0]
	game.start_action()
	game.stage_result(outcome(game, game.data.members, 3, 0, [loot]))
	var pending = game.data.duplicate(true)
	check(game.commit_day() and not game.item(loot.uid).is_empty(), "Carried weapon enters stock exactly on settlement")
	var restored = Campaign.new(catalog)
	check(restored.restore(pending) and restored.data.status == "pending", "Pending ration/result screen resumes")
	check(restored.commit_day() and restored.data == game.data, "Pending restore commits same outcome")
	game.new_run(99, "", ["lin", "qiao", "yan"])
	game.start_action()
	var rewards = game.data.day_rewards.duplicate(true)
	check(restored.restore(game.data) and restored.data.status == "shelter" and restored.data.day_rewards == rewards, "Mid-action restart returns to departure without reward reroll")
	game.stage_result(outcome(game, []))
	game.commit_day()
	check(game.data.status == "lost" and game.data.members.is_empty(), "Wipe ends run and rejects further departure")
	var broken = pending.duplicate(true)
	broken.equipment[broken.members[0]] = "missing"
	check(not restored.restore(broken), "Invalid equipment references rejected")
	var store = Store.new("user://test-runs/day-loop/run.json")
	check(store.write(pending).is_empty() and store.write(game.data).is_empty(), "Save writes with valid backup")
	check(store.read().ok and store.read().data.status == "lost", "Save round trip")
	var file = FileAccess.open(store.path, FileAccess.WRITE)
	file.store_string("interrupted")
	file.close()
	var recovery: Dictionary = store.read()
	check(recovery.ok and recovery.recovered and recovery.data.status == "pending", "Corrupt primary recovers prior valid backup")
	check(store.write(pending).is_empty(), "Saving after recovery keeps a usable record")
	broken = pending.duplicate(true)
	broken.history = [null]
	check(not restored.restore(broken), "Malformed history is rejected before rendering")
	store.write(broken)
	recovery = store.read(restored.valid_state)
	check(recovery.ok and recovery.recovered and recovery.data.history.is_empty(), "Semantically invalid primary falls back to valid history")
	var impossible = Store.new("user://test-runs/day-loop/run.json/blocked.json")
	var safe_before: Dictionary = store.read(restored.valid_state).data
	check(not impossible.write(game.data).is_empty() and store.read(restored.valid_state).data == safe_before, "I/O failure cannot overwrite existing valid record")
	game.new_run(801, "", ["lin", "qiao", "yan"])
	game.data.food = 0
	for i in range(2):
		game.start_action()
		game.stage_result(outcome(game, game.data.members))
		game.commit_day([])
	check(game.data.status == "lost" and game.data.history.back().starved_ids.size() == 3, "Consecutive zero rations can end the run")
	game.new_run(802, "", ["lin", "qiao", "yan"])
	game.data.food = 2
	game.data.hunger = 1
	game.start_action()
	game.stage_result(outcome(game, game.data.members))
	before = JSON.stringify(game.data)
	check(not game.commit_day([game.data.members[0], game.data.members[0]]) and JSON.stringify(game.data) == before, "Duplicate ration recipients cannot bypass allocation")
	check(not game.gear.valid({"uid": "bad", "kind": "crowbar", "affix": "extended"}), "Melee cannot receive a magazine affix")
	print("Day loop: %d checks, %d failures" % [checks, failures])
	quit(1 if failures else 0)
