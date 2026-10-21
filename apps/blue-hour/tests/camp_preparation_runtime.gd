extends "res://tests/camp_campaign_runtime.gd"
## Native preparation acceptance. Economy/duplicate stock fixtures are labelled;
## the later weapon search, pickup, return and next sortie use the live Town.
const StateSuite = preload("res://tests/camp_preparation.gd")
var p_output_dir: String = "res://test-output/" + OS.get_environment("BLUE_HOUR_PREPARATION_OUTPUT").get_file() + "/" if not OS.get_environment("BLUE_HOUR_PREPARATION_OUTPUT").is_empty() else "res://test-output/p1-c-preparation/"

func capture(id: String) -> void:
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png(p_output_dir + id + ".png") == OK, "Native screenshot: " + id)

func action(name: String) -> void:
	for pressed: bool in [true, false]:
		var event := InputEventAction.new()
		event.device = 42
		event.action = name
		event.pressed = pressed
		root.push_input(event, true)
		await process_frame
	await frames(5)

func confirm_operation() -> void:
	check(is_instance_valid(app.preparation.confirmation), "Real confirmation exists")
	await click(app.preparation.confirmation.create_run_button)
	await frames(5)

func run() -> void:
	create_timer(450).timeout.connect(func() -> void: printerr("PREPARATION NATIVE TIMEOUT"); quit(2))
	root.unfocusable = true
	root.content_scale_size = Vector2i.ZERO
	root.size = Vector2i(1600, 900)
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(p_output_dir)
	run_save = "user://test-runs/preparation-native-%d.json" % OS.get_process_id()
	await launch(false)
	await create_from_menu()
	app.campaign.new_run(772, "combat")
	app.show_shelter()
	await frames(12)
	var ids: Array = app.campaign.data.members.duplicate()
	var member: String = ids[0]
	var other: String = ids[1]
	var camp: Node3D = app.camp_view.camp
	var camera: Transform3D = app.camp_view.camera.global_transform
	# Isolated currency/duplicate-instance fixture, not claimed as natural earnings.
	app.campaign.data.food = 30
	app.campaign.data.scrap = 100
	var duplicate: Dictionary = app.campaign.item(app.campaign.data.equipment[member]).duplicate(true)
	duplicate.uid = "fixture-duplicate-instance"
	app.campaign.data.inventory.append(duplicate)
	check(app._save(), "Isolated preparation fixture saved")
	app.camp_ui.refresh_roster()
	await click(app.camp_ui.preparation_button)
	check(is_instance_valid(app.preparation) and app.camp_view.interaction_locked, "Formal Camp opens and locks preparation")
	var panel: Control = app.preparation
	var current: Dictionary = app.campaign.data.duplicate(true)
	await click(panel.action_buttons[duplicate.uid])
	await click(panel.confirmation.keep_progress_button)
	check(app.campaign.data == current, "Cancel equipment confirmation preserves full state")
	await click(panel.action_buttons[duplicate.uid])
	await confirm_operation()
	check(app.campaign.data.equipment[member] == duplicate.uid, "Real input equips distinct duplicate UID")
	# Select the other stable ID through the native OptionButton's normal signal.
	for index: int in panel.member_select.item_count:
		if panel.member_select.get_item_metadata(index) == other:
			panel.member_select.select(index)
			panel.member_select.item_selected.emit(index)
			break
	await click(panel.action_buttons[duplicate.uid])
	await confirm_operation()
	check(app.campaign.data.equipment[other] == duplicate.uid and app.campaign.data.equipment[member] == "", "Transfer leaves one actual holder")
	await click(panel.action_buttons[duplicate.uid])
	await confirm_operation()
	check(app.campaign.data.equipment[other] == "" and not app.campaign.item(duplicate.uid).is_empty(), "Unequip keeps the weapon in stock")
	# Put both members back into armed status using real inventory controls.
	await click(panel.action_buttons["initial:" + other])
	await confirm_operation()
	panel.member_select.select(0)
	panel.member_select.item_selected.emit(0)
	var initial: String = "initial:" + member
	await click(panel.action_buttons[initial])
	await confirm_operation()
	await click(panel.tabs.shop)
	var offer: Dictionary = app.campaign.data.shop[0].duplicate(true)
	var counted := StateSuite.CountingStore.new()
	counted.delegate = app.store
	app.store = counted
	counted.fail = true
	current = app.campaign.data.duplicate(true)
	await click(panel.action_buttons[offer.uid])
	await confirm_operation()
	check(app.campaign.data == current and app.save_error_dialog.visible, "Native failed purchase rolls back and reports error")
	app.save_error_dialog.hide()
	await capture("purchase-write-failure-1600x900")
	counted.fail = false
	var calls: int = counted.writes
	await click(panel.action_buttons[offer.uid])
	var confirmation: Control = panel.confirmation
	confirmation.create_run_button.pressed.connect(func() -> void: confirmation._confirm())
	await click(confirmation.create_run_button)
	check(counted.writes == calls + 1 and app.campaign.data.scrap == current.scrap - offer.price, "Repeated confirm buys once and saves once")
	check(panel.action_buttons[offer.uid].disabled, "Sold offer cannot be bought again")
	await capture("shop-1600x900")
	await click(panel.tabs.training)
	var cost: int = app.campaign.training_cost(member)
	var level: int = app.campaign.member_level(member)
	var food: int = app.campaign.data.food
	await click(panel.training_button)
	await confirm_operation()
	check(app.campaign.member_level(member) == level + 1 and app.campaign.data.food == food - cost, "Training uses real cost and progression")
	await capture("training-1600x900")
	check(app.camp_view.camp == camp and app.camp_view.camera.global_transform == camera, "Transactions preserve Camp and camera identity")
	for dimensions: Vector2i in [Vector2i(1600, 900), Vector2i(1024, 640)]:
		root.size = dimensions
		await frames(10)
		for page: String in ["inventory", "shop", "training", "powers"]:
			panel.show_page(page)
			await frames(8)
			var bounds := Rect2(Vector2.ZERO, Vector2(root.size))
			check(bounds.encloses(panel.panel.get_global_rect()) and bounds.encloses(panel.close_button.get_global_rect()), "Panel and return button fit " + page + str(dimensions))
			for button: Button in panel.tabs.values():
				check(panel.panel.get_global_rect().encloses(button.get_global_rect()), "Tabs fit current viewport")
			await capture(page + "-%dx%d" % [dimensions.x, dimensions.y])
			if page == "training" and dimensions == Vector2i(1024, 640):
				var unchanged: Dictionary = app.campaign.data.duplicate(true)
				panel.training_button.grab_focus()
				await frames(8)
				check(panel.training_button.get_parent().get_parent().get_global_rect().encloses(panel.training_button.get_global_rect()), "Keyboard focus scrolls the minimum-window training action fully into view")
				await capture("training-keyboard-1024x640")
				await action("ui_accept")
				check(is_instance_valid(panel.confirmation), "Minimum-window keyboard opens real training confirmation")
				await key(KEY_ESCAPE)
				check(app.campaign.data == unchanged, "Keyboard cancel leaves minimum-window training unchanged")
	panel.close_button.grab_focus()
	await action("ui_accept")
	check(not is_instance_valid(app.preparation) and not app.camp_view.interaction_locked, "Keyboard closes and restores Camp input")
	await key(KEY_I)
	check(is_instance_valid(app.preparation), "Keyboard opens real preparation")
	await key(KEY_ESCAPE)
	check(not is_instance_valid(app.preparation), "Escape closes preparation before leaving Camp")
	var rail: Control = app.camp_ui.get_node("M06_CampActionRail")
	check(not rail.get_node("TemporaryBuff").disabled and rail.get_node("MedicalSupport").disabled, "Left actions reflect actual combat loadout, not fictitious healing")
	current = app.campaign.data.duplicate(true)
	await click(rail.get_node("TemporaryBuff"))
	check(app.preparation.page == "powers" and app.campaign.data == current, "Left action opens actual ability details without casting or consuming")
	await key(KEY_ESCAPE)
	# Extra ownership is an explicit fixture, not a new normal reward source.
	check(app.campaign.grant_effect("power", "aid") and app._save(), "Owned ability replacement fixture persists")
	await key(KEY_I)
	await click(app.preparation.tabs.powers)
	var replace: Button = app.preparation.action_buttons["power:aid"]
	check(replace.disabled, "Full capacity requires an explicit replacement slot")
	var choices: OptionButton = replace.get_parent().get_child(1)
	choices.select(1)
	choices.item_selected.emit(1)
	await click(replace)
	await confirm_operation()
	check(app.campaign.data.power_slots == ["aid"], "Native ability replacement uses existing owned ID and slot")
	await key(KEY_ESCAPE)
	check(rail.get_node("TemporaryBuff").disabled and not rail.get_node("MedicalSupport").disabled, "Left action availability refreshes after actual loadout change")
	var persisted: Dictionary = JSON.parse_string(JSON.stringify(app.campaign.data))
	app.show_main_menu()
	await launch(false)
	await click(app.screen.menu_buttons[1])
	await wait_for_camp()
	check(JSON.parse_string(JSON.stringify(app.campaign.data)) == persisted, "Continue restores inventory, resources, growth, UID holders and owned ability slots")
	await key(KEY_I)
	check(app.preparation.member_id in app.campaign.data.members, "Restored preparation selects a current member")
	await key(KEY_ESCAPE)
	# Formal live Town: choose an existing deterministic weapon source, issue real
	# search/move commands, wait for real pickup, then use keyboard E and settlement.
	root.size = Vector2i(1600, 900)
	await click(app.camp_ui.get_node("M08_DepartAction/Entry"))
	await create_timer(.7).timeout
	await click(app.screen.cards.airdrop)
	await click(app.screen.confirm_button)
	var mission: Node3D = app.mission
	check(not mission.invincible and mission.director_enabled and mission.map_provider == "MEDIUM_TOWN_V1", "Live formal Town uses normal rules")
	var source: String = ""
	var nearest: float = INF
	var approach := Vector3.ZERO
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		var route: PackedVector3Array = mission.city.path(mission.squad_center(), site.spec.entry)
		if mission.reward_for_site(id).is_empty() or route.is_empty():
			continue
		var candidate: Vector3 = site.spec.entry
		for waypoint: Vector3 in route:
			if waypoint.distance_to(site.spec.entry) >= 8.0 and waypoint.distance_to(site.spec.entry) <= 15.0:
				candidate = waypoint
		var valid: bool = true
		var slots: Dictionary = mission._town_formation_slots(candidate, mission.living())
		var reserved: Array[Vector3] = []
		var reserved_paths: Array[PackedVector3Array] = []
		for actor: Node3D in mission.living():
			valid = valid and not mission.city.formation_order(actor.position, slots[actor.get_instance_id()], reserved, reserved_paths).is_empty()
		if not valid:
			continue
		var distance: float = 0.0
		for index: int in range(1, route.size()):
			distance += route[index - 1].distance_to(route[index])
		if distance < nearest:
			nearest = distance
			source = id
			approach = candidate
	check(not source.is_empty(), "Current generated map has a reachable deterministic weapon source")
	if not source.is_empty():
		var moved: bool = mission.command_move(approach)
		check(moved, "Covering formation accepts the real approach: " + mission.last_command_rejection)
		print("PREPARATION ROUTE: ", {"site": source, "entry": mission.city.sites[source].spec.entry, "approach": approach, "route_length": nearest, "accepted": moved})
		var discovery_deadline: int = Time.get_ticks_msec() + 45000
		while mission.active and not mission.city.sites[source].discovered and Time.get_ticks_msec() < discovery_deadline:
			await process_frame
		print("PREPARATION ARRIVAL: ", {"clock": mission.clock.elapsed, "active": mission.active, "scale": mission.time_scale, "members": mission.living().map(func(actor: Node3D) -> Dictionary: return {"position": actor.position, "path_size": actor.path.size(), "hp": actor.hp}), "discovered": mission.city.sites[source].discovered})
		check(mission.city.sites[source].discovered, "Search source is visible through the current exploration rules")
		check(mission.command_search(source), "Search reserves its worker after the covering move order")
		var deadline: int = Time.get_ticks_msec() + 140000
		while app.state == "mission" and mission.ledger.weapons.is_empty() and Time.get_ticks_msec() < deadline:
			await process_frame
		print("PREPARATION SEARCH: ", {"clock": mission.clock.elapsed, "active": mission.active, "members": mission.living().map(func(actor: Node3D) -> Dictionary: return {"position": actor.position, "path_size": actor.path.size(), "hp": actor.hp}), "weapons": mission.ledger.weapons})
		check(not mission.ledger.weapons.is_empty(), "Live search produces and physically collects a real weapon")
		if not mission.ledger.weapons.is_empty():
			var recovered: String = mission.ledger.weapons[0].uid
			await key(KEY_E)
			deadline = Time.get_ticks_msec() + 150000
			while app.state == "mission" and Time.get_ticks_msec() < deadline:
				await process_frame
			check(app.state == "result", "Real team boards and returns for settlement")
			if app.state == "result":
				await click(app.screen.confirm_button)
				await wait_for_camp()
				check(not app.campaign.item(recovered).is_empty(), "Recovered UID enters real Campaign inventory")
				await click(app.camp_ui.preparation_button)
				await click(app.preparation.action_buttons[recovered])
				await confirm_operation()
				var expected: Resource = app.campaign.weapon(recovered)
				await key(KEY_ESCAPE)
				await click(app.camp_ui.get_node("M08_DepartAction/Entry"))
				await create_timer(.7).timeout
				await click(app.screen.cards.residential)
				await click(app.screen.confirm_button)
				for actor: Node3D in app.mission.survivors:
					if actor.data.id == member:
						check(actor.combat.weapon_uid == recovered and is_equal_approx(actor.weapon.damage, expected.damage), "Next actual sortie consumes recovered UID and derived stats")
						check(is_equal_approx(actor.weapon.range, expected.range) and is_equal_approx(actor.weapon.reload_time, expected.reload_time), "Next sortie preserves the actual RANGE_UP and RELOAD_SPEED_UP instance derivation")
						print("PREPARATION NEXT LOADOUT: ", {"uid": actor.combat.weapon_uid, "damage": actor.weapon.damage, "range": actor.weapon.range, "reload_time": actor.weapon.reload_time})
	var result: Dictionary = {"checks": checks, "failures": failures, "seed": app.campaign.data.seed, "method": "Native Main input; isolated seed/money/duplicate-stock fixture; live deterministic-source search and pickup, keyboard extraction, settlement and next sortie. OptionButton identity selection uses its native signal; no injected loot or forced outcome."}
	FileAccess.open(p_output_dir + "runtime.json", FileAccess.WRITE).store_string(JSON.stringify(result, "\t"))
	print("CAMP PREPARATION NATIVE: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(8)
	quit(0 if failures.is_empty() else 1)
