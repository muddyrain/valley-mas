extends SceneTree
const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Mission = preload("res://missions/mission.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Store = preload("res://core/save_store.gd")
var checks := 0
var failures: Array[String] = []
var reports: Array[Dictionary] = []
var equipment_reports: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func step(mission: Node3D, seconds: float) -> void:
	for i in range(ceili(seconds * 30)):
		if not mission.active:
			break
		mission._physics_process(1.0 / 30.0)
		if i % 90 == 0:
			await process_frame

func sortie(game: RefCounted) -> Node3D:
	check(game.start_action(), "Start valid next day")
	var mission := Mission.new()
	root.add_child(mission)
	var empty: Array[String] = []
	mission.setup(game.catalog, Ledger.new(), empty, 0, game)
	mission.set_physics_process(false)
	mission.completed.connect(func(value: Dictionary): check(game.stage_result(value), "Stage real mission result"))
	return mission

func run() -> void:
	create_timer(100).timeout.connect(func(): printerr("DAY LOOP FLOW TIMEOUT"); quit(2))
	var catalog := Catalog.new()
	var game := Campaign.new(catalog)
	game.new_run(772, "", ["lin", "qiao", "yan"])
	var store := Store.new("user://test-runs/five-days.json")
	for day in range(1, catalog.loop.end_day + 1):
		var mission := sortie(game)
		var visits: Array = []
		for id in ["corner", "van_south", "garage"]:
			if not mission.active:
				break
			mission.command_search(id)
			mission.command_move(mission.city.sites[id].spec.entry + Vector3(0, 0, 3))
			var deadline: float = mission.clock.elapsed + 125
			while mission.active and not mission.city.sites[id].searched and mission.clock.elapsed < deadline:
				await step(mission, 1.0)
			visits.append({"site": id, "searched": mission.city.sites[id].searched, "at": snappedf(mission.clock.elapsed, 0.1)})
			check(mission.city.sites[id].searched, "Five-day route completes " + id)
		if mission.active:
			mission.command_extract()
			await step(mission, 80)
		check(game.data.status == "pending" and not mission.active, "Real route returns for daily settlement")
		if game.data.status != "pending":
			mission.queue_free()
			break
		check(not game.data.pending.wiped and game.data.pending.weapons.size() == 1, "Route returns alive with a distinct weapon")
		var reward: Dictionary = game.data.pending.weapons[0] if not game.data.pending.weapons.is_empty() else {}
		check(game.commit_day(), "Food settlement completes once")
		reports.append({"day": day, "seconds": snappedf(mission.clock.elapsed, 0.1), "visits": visits, "food": game.data.food, "scrap": game.data.scrap, "alive": game.data.members.size(), "hp": mission.survivors.map(func(member): return snappedf(member.hp, 0.1)), "reward": reward, "invincible": mission.invincible})
		if game.data.status == "shelter" and not reward.is_empty():
			check(game.equip(game.data.members[2], reward.uid), "Equip recovered weapon for next real route")
		check(store.write(game.data).is_empty(), "Save next day")
		var reloaded := Campaign.new(catalog)
		check(reloaded.restore(store.read().data), "Reload real run between days")
		game = reloaded
		mission.queue_free()
		await process_frame
	check(game.data.status == "won" and game.data.history.size() == 5, "Five real days reach the playable endpoint")
	# The same map also permits choosing equipment at the cost of daily food.
	game.new_run(772, "", ["lin", "qiao", "yan"])
	var hunger_seen := false
	var shortage_losses := false
	for day in range(1, 6):
		if game.data.status != "shelter":
			break
		var expedition := sortie(game)
		for id in ["garage", "car_west"]:
			if not expedition.active:
				break
			expedition.command_search(id)
			expedition.command_move(expedition.city.sites[id].spec.entry + Vector3(0, 0, 3))
			var deadline: float = expedition.clock.elapsed + 125
			while expedition.active and not expedition.city.sites[id].searched and expedition.clock.elapsed < deadline:
				await step(expedition, 1)
		if expedition.active:
			expedition.command_extract()
			await step(expedition, 80)
		check(game.data.status == "pending", "Equipment-focused route reaches settlement")
		if game.data.status != "pending":
			expedition.queue_free()
			break
		var view := game.preview()
		var fed: Array = view.members.slice(0, int(view.slots)) if view.fatal else []
		game.commit_day(fed)
		hunger_seen = hunger_seen or game.data.hunger > 0
		shortage_losses = shortage_losses or not game.data.history.back().starved_ids.is_empty()
		equipment_reports.append({"day": day, "food": game.data.food, "hunger": game.data.hunger, "status": game.data.status, "outcome": game.data.history.back(), "invincible": expedition.invincible})
		expedition.queue_free()
		await process_frame
	check(hunger_seen and shortage_losses, "Ignoring food on repeated real equipment routes creates grace then loss")
	# Isolated combat fixtures verify the final member's controls, not difficulty balance.
	game.new_run(882, "", ["lin", "qiao", "yan"])
	var first := sortie(game)
	first.director_enabled = false
	first.debug_clear_enemies()
	first.survivors[1].take_damage(1000)
	first.survivors[2].take_damage(1000)
	first.command_extract()
	await step(first, 12)
	check(game.commit_day() and game.data.members.size() == 1, "Two combat casualties persist into next sortie")
	first.queue_free()
	await process_frame
	var solo := sortie(game)
	solo.director_enabled = false
	solo.debug_clear_enemies()
	check(solo.survivors.size() == 1, "Only remaining member spawns")
	solo.command_search("corner")
	await step(solo, 10)
	check(solo.search_task.worker != null and solo.guards().is_empty(), "Last member can work with zero guards")
	var member: Node3D = solo.survivors[0]
	var enemy: Node3D = solo.spawn_enemy("shambler", member.position + Vector3(0, 0, 1))
	enemy.hp = 500
	await step(solo, 0.2)
	check(not member.searching and member.hp < member.data.max_hp, "Solo worker is vulnerable and pauses for self-defense")
	solo.debug_clear_enemies()
	solo.command_recall()
	solo.command_move(Vector3(0, 0, 12))
	await step(solo, 8)
	check(member.position.distance_to(Vector3(0, 0, 12)) < 3, "Recall restores solo movement control")
	solo.command_search("corner")
	await step(solo, 60)
	check(solo.city.sites.corner.searched and solo.search_id.is_empty(), "Solo task completes and releases worker")
	solo.command_extract()
	await step(solo, 25)
	check(not solo.active and game.data.pending.returned_ids.size() == 1, "Solo member completes 1/1 bus extraction")
	game.commit_day()
	solo.queue_free()
	await process_frame
	var last := sortie(game)
	last.survivors[0].take_damage(1000)
	await step(last, 0.2)
	check(game.commit_day() and game.data.status == "lost", "Last member death ends run once")
	check(not game.commit_day() and not game.start_action(), "No repeated final settlement or zero-person departure")
	last.queue_free()
	await process_frame
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var file := FileAccess.open("res://test-output/day-loop-flow.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks": checks, "failures": failures, "five_day_routes": reports, "equipment_routes": equipment_reports, "solo_fixture": "director disabled; actual combat damage and movement"}, "\t"))
	print("DAY LOOP FLOW: %d checks, %d failures" % [checks, failures.size()])
	await create_timer(0.1).timeout
	quit(0 if failures.is_empty() else 1)
