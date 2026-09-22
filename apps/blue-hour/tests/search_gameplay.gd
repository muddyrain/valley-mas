extends "res://tests/expedition_hud_2.gd"
const Loot = preload("res://maps/generation/loot_spawner.gd")
const Resolver = preload("res://core/loot_resolver.gd")
const Card = preload("res://ui/expedition/search_card.gd")
const OUTPUT: String = "res://test-output/search-gameplay/"
var completed_ids: Array[String] = []
var cancelled_ids: Array[String] = []

func run() -> void:
	create_timer(100).timeout.connect(func() -> void: quit(2))
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	root.unfocusable = true
	root.size = Vector2i(1920, 1080)
	root.add_child(InputGate.new())
	check_profiles()
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	mission.setup(Catalog.new(), Ledger.new(), loadout, 772)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var layer := CanvasLayer.new()
	root.add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	check(mission.has_method("search_target_state"), "Mission exposes the shared target lifecycle")
	if not mission.has_method("search_target_state"):
		await finish_search(layer)
		return
	mission.search_completed.connect(func(id: String, _name: String, _loot: Dictionary) -> void: completed_ids.append(id))
	mission.search_cancelled.connect(func(id: String) -> void: cancelled_ids.append(id))
	var inventory: Array[Dictionary] = []
	for id: String in mission.city.sites:
		var spec: Dictionary = mission.city.sites[id].spec
		inventory.append({"id": id, "name": spec.name, "vehicle": mission.city.sites[id].vehicle, "type": spec.search_kind, "seconds": spec.search_seconds, "profile": spec.loot_profile})
	FileAccess.open(OUTPUT + "targets.json", FileAccess.WRITE).store_string(JSON.stringify(inventory, "\t"))
	var house: String = "arrival_house"
	var vehicle: String = "van_south"
	# Keep the parallel fixture active while cancellation assertions run; the
	# production profile is covered separately in check_profiles().
	mission.city.sites[vehicle].spec.search_seconds = 46.0
	check(mission.search_target_state(house).state == "AVAILABLE", "Unassigned house is available")
	for index: int in range(3):
		mission.survivors[index].position = mission.city.nearest_open(Vector3(0, 0, 10 + index))
	mission.survivors[0].position = mission.city.sites[house].spec.entry + Vector3(0, 0, -2)
	mission.survivors[1].position = mission.city.sites[vehicle].spec.entry + Vector3(0, 0, -2)
	mission.command_search(house)
	mission.command_search(vehicle)
	check(mission.search_target_state(house).state == "APPROACHING", "House dispatch reserves a worker before arrival")
	var a: Node3D = mission.search_tasks[house].worker
	var b: Node3D = mission.search_tasks[vehicle].worker
	check(a != b, "Building and vehicle reserve different survivors")
	await step(3.0)
	check(Card.is_searching(mission, house) and Card.is_searching(mission, vehicle), "Both targets reach actual searching through normal movement")
	check(mission.search_target_state(house).state == "SEARCHING", "Interior search maps to the shared lifecycle")
	mission.camera_controller.following = false
	mission.camera_center = mission.city.sites[house].spec.entry
	mission.camera_controller.apply()
	await screenshot("parallel-search")
	var before: float = mission.city.sites[house].progress
	check(mission.command_move(Vector3(0, 0, 15)), "Idle C accepts a ground move while A and B search")
	check(a.searching and b.searching, "Move cannot interrupt either started search")
	await step(.2)
	check(mission.city.sites[house].progress > before, "Search progresses continuously while C moves")
	var saved: float = mission.city.sites[house].progress
	hud.poi_context.cards[house]._act()
	check(mission.search_target_state(house).state == "CANCELLED" and mission.search_target_state(house).can_search, "Explicit cancel releases ownership and allows resumption")
	check(cancelled_ids == [house] and not hud.poi_context.cards[house].visible, "Cancel event and card cleanup occur immediately")
	check(mission.search_tasks[vehicle].worker == b and b.searching, "Cancel does not alter the other worker")
	await step(.5)
	check(mission.city.sites[house].progress == saved, "Cancelled progress remains stable")
	await screenshot("cancelled-house")
	a.position = mission.city.sites[house].spec.entry
	mission.command_search(house)
	await step(.5)
	check(mission.city.sites[house].progress > saved, "Reassignment resumes saved progress")
	# Complete both with the exact remaining duration, without an extra frame at 99%.
	for id: String in [house, vehicle]:
		var task: RefCounted = mission.search_tasks[id]
		var site: Dictionary = mission.city.sites[id]
		var seconds: float = mission.effects.search_seconds(site.spec.search_seconds, task.worker.talent.search_multiplier)
		task.advance((1.0 - site.progress) * seconds, mission)
		check(site.progress == 1.0 and site.searched, "Exact duration reaches 100%: " + id)
		check(mission.search_target_state(id).state == "COMPLETED" and not mission.search_target_state(id).can_search, "Completed target cannot be reserved again: " + id)
		check(not Card.is_searching(mission, id) and not hud.poi_context.cards[id].visible, "Completion hides the card in the same call: " + id)
		task.advance(20, mission)
	check(completed_ids == [house, vehicle], "Each target emits exactly one completion")
	check(mission.pickups.size() == 2 and mission.ledger.food == 0 and mission.ledger.scrap == 0, "Completion creates two drops, with no premature inventory credit")
	check(hud.toast_panel.visible and hud.toast.text.contains(a.data.display_name) and hud.toast.text.contains(mission.city.sites[house].spec.name), "Completion feedback identifies worker and target")
	await screenshot("completed-found")
	mission._prune_tasks()
	var expected := Vector2i.ZERO
	for pickup: Dictionary in mission.pickups:
		expected += Vector2i(pickup.food, pickup.scrap)
	await step(.5)
	check(mission.pickups.is_empty() and Vector2i(mission.ledger.food, mission.ledger.scrap) == expected, "Each real drop is collected once after workers exit")
	check(hud.toast.text.contains("获得") and hud.toast.text.contains(a.data.display_name), "Pickup updates the same feedback with actual credited quantities")
	await screenshot("completed-collected")
	for id: String in [house, vehicle]:
		mission.command_search(id)
	await step(.5)
	check(mission.search_tasks.is_empty() and completed_ids.size() == 2 and Vector2i(mission.ledger.food, mission.ledger.scrap) == expected, "Repeated completed-target commands cannot generate loot")
	hud._process(1.1)
	check(hud.toast.text.contains(b.data.display_name) and hud.toast.text.contains(mission.city.sites[vehicle].spec.name), "Parallel completion retains the second worker's result")
	await screenshot("vehicle-result")
	hud._process(1.1)
	check(not hud.toast_panel.visible, "Result feedback expires")
	await natural_lifecycle("west_house")
	await natural_lifecycle("car_west")
	check_data_modifiers()
	await finish_search(layer)

func natural_lifecycle(id: String) -> void:
	var site: Dictionary = mission.city.sites[id]
	var worker: Node3D = mission.survivors[0]
	worker.position = site.spec.entry
	worker.stop()
	mission.command_search(id)
	var task: RefCounted = mission.search_tasks.get(id)
	check(task != null and task.worker == worker, "Natural dispatch reserves nearest worker: " + id)
	if task == null:
		return
	var seconds: float = mission.effects.search_seconds(site.spec.search_seconds, worker.talent.search_multiplier)
	var progressed_seconds: float = 0.0
	var stable: bool = true
	var before_food: int = mission.ledger.food
	var before_scrap: int = mission.ledger.scrap
	for tick: int in range(600):
		var before: float = site.progress
		mission._physics_process(1.0 / 30.0)
		if site.progress > before: progressed_seconds += 1.0 / 30.0
		stable = stable and site.progress >= before and site.progress - before <= 1.0 / (30.0 * seconds) + 0.000001
		if site.searched: break
		if tick % 30 == 0: await process_frame
	check(site.searched and stable, "Unmodified target advances steadily from zero to completion: " + id)
	check(absf(progressed_seconds - seconds) <= 1.0 / 30.0 + 0.000001, "Finishes within one physics tick of configured duration: " + id)
	check(not Card.is_searching(mission, id) and not mission.search_tasks.has(id), "Natural 100% completion removes ownership and active UI: " + id)
	await step(.5)
	check(mission.ledger.food == before_food + site.spec.food and mission.ledger.scrap == before_scrap + site.spec.scrap, "Natural completion credits its real reward once: " + id)

func check_data_modifiers() -> void:
	var base: Resource = mission.catalog.map
	var snapshot: Array[Dictionary] = base.buildings.duplicate(true)
	var valid: bool = true
	for action: Resource in mission.catalog.today_actions:
		var modified: Resource = action.make_map(base)
		for index: int in range(base.buildings.size()):
			var original: Dictionary = base.buildings[index]
			var changed: Dictionary = modified.buildings[index]
			for row: int in range(original.loot_table.entries.size()):
				var entry: Dictionary = original.loot_table.entries[row]
				var result: Dictionary = changed.loot_table.entries[row]
				valid = valid and result == entry
		var final_loot: Dictionary = modified.mission_profile.modify_loot({"food": 10, "scrap": 10})
		valid = valid and final_loot.food == roundi(10 * action.food_multiplier) and final_loot.scrap == roundi(10 * action.scrap_multiplier)
	check(valid and base.buildings == snapshot, "Today-action final modifiers preserve base tables and chances")
	check(is_equal_approx(mission.effects.search_seconds(8.0, 2.0), 4.0), "Existing search trait modifier still affects the centralized duration")

func check_profiles() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 728
	var totals: Dictionary = {}
	for profile: String in Loot.PROFILES:
		var site: Dictionary = {"poi_type": "vehicle" if profile.begins_with("vehicle_") else "house"}
		Loot.apply(site, profile)
		check(site.search_seconds >= 4 and site.search_seconds <= 18, "Short centralized duration: " + profile)
		var total := Vector2i.ZERO
		var valid: bool = true
		for roll: int in range(1000):
			for item: Dictionary in Resolver.roll_dict(site.loot_table, rng):
				valid = valid and item.id in ["food", "scrap"] and item.amount > 0
				if item.id == "food": total.x += item.amount
				else: total.y += item.amount
		totals[profile] = total
		check(valid, "1000 rolls contain only existing positive resources: " + profile)
	check(totals.food_high.x > totals.general.x * 1.7, "Supermarkets favor food")
	check(totals.materials_tools.y > totals.general.y * 2, "Warehouses yield more materials")
	var never: Dictionary = {"entries": [{"loot_id": "food", "weight": 1.0, "chance": 0.0, "min_amount": 3, "max_amount": 3}]}
	check(Resolver.roll_dict(never, rng).is_empty(), "Zero probability never drops a resource")
	never.entries[0].chance = 0.25
	var hits: int = 0
	for roll: int in range(1000):
		if not Resolver.roll_dict(never, rng).is_empty(): hits += 1
	check(hits > 190 and hits < 310, "Independent probability affects frequency, not only entry filtering")
	var workshop: Dictionary = {"asset": "BLD_008_auto_repair_shop"}
	Loot.apply(workshop, "vehicle_parts_tools")
	check(workshop.search_seconds == 18, "An auto repair building is not classified as a small vehicle")
	var hardware: Dictionary = {"asset": "BLD_020_hardware_store_a"}
	Loot.apply(hardware, "general")
	check(hardware.search_seconds == 12 and hardware.loot_profile == "materials_tools", "A small hardware shop uses shop duration and material rewards")
	var generator: GDScript = preload("res://maps/random/random_map_generator.gd")
	var plan: Dictionary = generator.generate("supply_search", 17102799)
	var valid_targets: bool = plan.ok
	for spec: Dictionary in plan.get("buildings", []):
		valid_targets = valid_targets and spec.has("search_kind") and spec.search_seconds in [8.0, 12.0, 18.0] and not spec.loot_table.entries.is_empty()
	check(valid_targets, "Existing random map targets consume the same profiles without generator changes")

func screenshot(id: String) -> void:
	await frames(3)
	if DisplayServer.get_name() != "headless":
		await capture("search-gameplay/" + id)

func finish_search(layer: CanvasLayer) -> void:
	FileAccess.open(OUTPUT + "results.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("SEARCH GAMEPLAY: %d checks, %d failures" % [checks, failures.size()])
	layer.queue_free()
	mission.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
