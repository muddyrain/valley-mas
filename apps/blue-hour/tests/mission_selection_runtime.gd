extends "res://tests/day_loop_runtime.gd"
## Native rendering and input against an isolated campaign, never the player save.

func run() -> void:
	var recording := "--record-selection" in OS.get_cmdline_user_args()
	app = load("res://core/main.gd").new()
	app.save_path = "user://test-runs/mission-selection-runtime.json"
	app.fresh_test_run = true
	root.add_child(app)
	await create_timer(1.0).timeout
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i(1600, 900)
	await frames(10)
	var camp: Node = app.camp_view
	var original_party: Array = app.campaign.data.selected_party.duplicate()
	await capture("mission-selection-camp")
	await click_at(app.camp_ui.get_node("M08_DepartAction/Entry").get_global_rect().get_center())
	check(app.state == "today_action", "Camp entry opens task page")
	var page: Control = app.screen
	check(page.cancel_button.disabled, "Opening rejects repeated input")
	page._request_cancel()
	check(app.state == "today_action", "Opening Escape cannot close or pass through")
	await create_timer(0.6).timeout
	check(not page.cancel_button.disabled, "Open animation releases controls")
	check(page.find_child("PartySelection", true, false) == null, "No member name chips")
	check(page.find_child("MissionSelectionBackground", true, false) == null, "No opaque background")
	check(page.selected_party == original_party, "Party contract retained")
	await click_at(page.cards["commercial"].get_global_rect().get_center())
	await create_timer(0.25).timeout
	check(page.selected_id == "commercial", "Native click changes mission")
	check("商业街" in page.selection_title.text, "Briefing matches selected mission")
	await capture("mission-selection-1600")
	var motion := InputEventMouseMotion.new()
	motion.device = 42
	motion.position = page.cards["commercial"].get_global_rect().get_center()
	root.push_input(motion, true)
	await create_timer(0.2).timeout
	await capture("mission-selection-hover")
	if recording:
		await create_timer(0.8).timeout
	await click_at(page.cards["airdrop"].get_global_rect().get_center())
	await create_timer(0.25).timeout
	check(page.cards["airdrop"].text == "空投区域" and "空投区域" in page.selection_title.text, "Unified display name")
	if not recording:
		root.size = Vector2i(1280, 720)
		root.content_scale_size = Vector2i(1280, 720)
	await create_timer(0.3).timeout
	if not recording:
		await capture("mission-selection-1280")
	else:
		await create_timer(0.8).timeout
	for card: Button in page.cards.values():
		check(root.get_visible_rect().encloses(card.get_global_rect()), "Card stays in viewport")
	await click_at(page.cancel_button.get_global_rect().get_center())
	check(app.state == "today_action" and app.camp_view.interaction_locked, "Camp stays locked during exit")
	page._request_cancel()
	await create_timer(0.4).timeout
	check(app.state == "shelter" and app.camp_view == camp, "Exit restores same Camp after animation")
	check(not app.camp_view.interaction_locked, "Camp unlocks after exit")
	check(app.campaign.data.selected_party == original_party, "Return leaves party unchanged")
	await capture("mission-selection-return")
	if recording:
		await create_timer(0.8).timeout
		print("Mission selection recording: %d checks, %d failures" % [checks, failures.size()])
		app.queue_free()
		await frames(3)
		quit(0 if failures.is_empty() else 1)
		return
	await click_at(app.camp_ui.get_node("M08_DepartAction/Entry").get_global_rect().get_center())
	await create_timer(0.6).timeout
	page = app.screen
	await click_at(page.cards["residential"].get_global_rect().get_center())
	await create_timer(0.2).timeout
	await click_at(page.confirm_button.get_global_rect().get_center())
	check(app.state in ["departure", "mission"], "Confirmation retains departure contract")
	print("Mission selection: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
