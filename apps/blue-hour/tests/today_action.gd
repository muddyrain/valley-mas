extends "res://tests/day_loop_runtime.gd"

class TestInputGate extends Node:
	func _input(event: InputEvent) -> void:
		if event.device != 42 and not event.has_meta("today_action_test"):
			get_viewport().set_input_as_handled()


class FailingStore extends RefCounted:
	func write(_data: Dictionary, _validator: Callable) -> String:
		return "测试：无法保存"


func key(code: Key, receiver: Viewport = null) -> void:
	# Built-in UI actions match keyboard device 0; a tag isolates synthetic input.
	for pressed: bool in [true, false]:
		var event := InputEventKey.new()
		event.set_meta("today_action_test", true)
		event.keycode = code
		event.physical_keycode = code
		event.pressed = pressed
		(receiver if receiver != null else root).push_input(event, true)
		await process_frame
	await frames()


func run() -> void:
	create_timer(90).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.add_child(TestInputGate.new())
	app = load("res://core/main.gd").new()
	app.save_path = "user://test-runs/today-action-%d.json" % Time.get_ticks_usec()
	app.fresh_test_run = true
	root.add_child(app)
	await frames(8)
	var before: Dictionary = app.campaign.data.duplicate(true)
	await click(app.screen.departure)
	check(app.state == "today_action" and app.mission == null, "Camp departure opens selection before creating a mission")
	if app.state != "today_action":
		quit(1)
		return
	check(app.screen.confirm_button.disabled, "Departure requires an explicit selection")
	await key(KEY_RIGHT)
	check(app.screen.selected_id.is_empty(), "Moving keyboard focus does not select a destination")
	await click(app.screen.cards["commercial"])
	check(app.screen.selected_id == "commercial" and not app.screen.confirm_button.disabled, "Card click selects and enables confirmation")
	check(app.campaign.data == before, "Browsing destinations never mutates the campaign")
	await key(KEY_ESCAPE)
	check(app.state == "shelter" and app.campaign.data == before, "Escape returns without spending a day or changing supplies")
	var base: Resource = app.catalog.map.duplicate(true)
	var totals: Array[Vector2i] = []
	var enemy_counts: Array[int] = []
	for action: Resource in app.catalog.today_actions:
		var map: Resource = action.make_map(base)
		var total := Vector2i.ZERO
		for site: Dictionary in map.buildings + map.vehicles:
			total += Vector2i(site.food, site.scrap)
		totals.append(total)
		enemy_counts.append(map.initial_enemies.size())
		check(map.id == action.id and map.buildings.size() == base.buildings.size(), "Destination preserves playable city sites: " + action.id)
		check(map.bus_position == base.bus_position, "Destination preserves evacuation access: " + action.id)
	check(totals[0].x > totals[1].x and totals[1].x > totals[2].x, "Residential route offers the most food")
	check(totals[1].y > totals[0].y and totals[1].y > totals[2].y, "Commercial route offers the most scrap")
	check(enemy_counts[0] < enemy_counts[1] and enemy_counts[1] < enemy_counts[2], "Initial danger increases across the three destinations")
	check(app.catalog.map.buildings == base.buildings, "Preview never mutates the base map")
	await click(app.screen.departure)
	await click(app.screen.cards["airdrop"])
	var store: RefCounted = app.store
	app.store = FailingStore.new()
	await click(app.screen.confirm_button)
	check(app.state == "today_action" and app.mission == null and app.campaign.data == before, "Save failure retains selection and rolls back mission state")
	app.save_error_dialog.hide()
	app.store = store
	await click(app.screen.confirm_button)
	check(app.state == "mission" and app.mission.catalog.map.id == "airdrop", "Confirmed destination reaches the actual mission")
	check(app.campaign.data.selected_action == "airdrop", "Confirmed destination is saved")
	app.start_mission("residential")
	check(app.mission.catalog.map.id == "airdrop", "Repeated confirmation cannot create or replace an active mission")
	var saved: Dictionary = app.store.read(app.campaign.valid_state).data
	var restored: RefCounted = load("res://core/campaign.gd").new(app.catalog)
	check(restored.restore(saved) and restored.data.status == "shelter", "Mid-mission save resumes at camp")
	check(restored.data.selected_action == "airdrop" and restored.data.day_rewards == app.campaign.data.day_rewards, "Retry preserves destination and equipment rewards")
	var invalid: Dictionary = saved.duplicate(true)
	invalid.selected_action = "missing"
	check(not restored.valid_state(invalid), "Unknown destination in a save is rejected")
	var old_save: Dictionary = before.duplicate(true)
	old_save.erase("selected_action")
	check(restored.restore(old_save), "Existing saves without a destination remain readable")
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	check(not app.mission.reward_for_site("depot").is_empty(), "Airdrop route has actual equipment rewards")
	app.mission._finish(false)
	await frames(8)
	app.return_to_shelter()
	await frames(8)
	check(app.state == "shelter" and app.campaign.data.day == 2, "Selected mission settles and advances exactly one day")
	check(app.campaign.data.get("selected_action", "").is_empty(), "New day clears the previous destination")
	var expected_site_count: int = app.base_map.buildings.size() + app.base_map.vehicles.size()
	for action_id: String in ["residential", "commercial"]:
		app.show_today_action()
		await frames()
		await click(app.screen.cards[action_id])
		await click(app.screen.confirm_button)
		check(app.state == "mission" and app.mission.city.sites.size() == expected_site_count, "Playable destination starts: " + action_id)
		check(app.mission.reward_for_site("depot").is_empty(), "Lower risk destinations do not promise airdrop equipment")
		app.mission.director_enabled = false
		app.mission.debug_clear_enemies()
		app.mission.ledger.add_loot(6, 0)
		app.mission._finish(false)
		await frames(8)
		app.return_to_shelter()
		await frames(8)
	print("TODAY ACTION: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames()
	quit(0 if failures.is_empty() else 1)
