extends "res://tests/camp_campaign_runtime.gd"
## Real five-day empty-return loss; separately labelled pending-victory fixture.

const Fixtures = preload("res://tests/run_end_fixtures.gd")
const END_OUT := "res://test-output/p1-b-run-end-20261020/"
var end_output_dir: String = "res://test-output/" + OS.get_environment("BLUE_HOUR_RUN_END_OUTPUT").get_file() + "/" if not OS.get_environment("BLUE_HOUR_RUN_END_OUTPUT").is_empty() else END_OUT

func capture(id: String) -> void:
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png(end_output_dir + id + ".png") == OK, "Captured " + id)

func wait_state(expected: String) -> void:
	var deadline: int = Time.get_ticks_msec() + 45000
	while Time.get_ticks_msec() < deadline:
		if app.state == expected and not is_instance_valid(app.continue_loading):
			await frames(10)
			return
		await process_frame
	check(false, "Reached " + expected + ", actual=" + str(app.state))

func return_once() -> void:
	await click(app.camp_ui.get_node("M08_DepartAction/Entry"))
	await create_timer(.7).timeout
	await click(app.screen.cards.residential)
	await click(app.screen.confirm_button)
	check(app.state == "mission" and not app.mission.invincible and app.mission.director_enabled, "Production sortie uses live director and normal damage")
	await key(KEY_E)
	await wait_state("result")
	check(app.campaign.data.pending.food == 0 and app.campaign.data.pending.scrap == 0, "No injected loot in actual empty return")
	await click(app.screen.confirm_button)
	await wait_state("ended" if app.campaign.data.status in ["won", "lost"] else "shelter")

func verify_terminal(context: String) -> void:
	check(app.state == "ended" and is_instance_valid(app.screen), context + ": actual end page exists")
	check(app.screen.member_cards.size() == 2, context + ": includes both actual Run members")
	check(app.mission == null and app.camp_ui == null, context + ": gameplay views are cleared")
	var data: Dictionary = app.campaign.data.duplicate(true)
	var saved: String = FileAccess.get_file_as_string(run_save)
	for repeat: int in 4:
		app.show_shelter()
		await frames(5)
	check(app.campaign.data == data and FileAccess.get_file_as_string(run_save) == saved, context + ": repeated entry neither settles nor saves")
	check(not app.campaign.commit_day(), context + ": terminal commit is rejected")
	# JSON changes packed arrays/numeric Variant types; compare the complete persisted representation.
	check(app.store.read(app.campaign.valid_state).data == JSON.parse_string(JSON.stringify(data)), context + ": terminal disk agrees")

func run() -> void:
	create_timer(420.0).timeout.connect(func() -> void: printerr("RUN END FLOW TIMEOUT"); quit(2))
	root.unfocusable = true
	root.content_scale_size = Vector2i.ZERO
	root.size = Vector2i(1600, 900)
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(end_output_dir)
	run_save = "user://test-runs/p1-b-flow-%d-%d.json" % [OS.get_process_id(), Time.get_ticks_usec()]
	await launch(false)
	await create_from_menu()
	var original_ids: Array = app.campaign.data.members.duplicate()
	for day: int in 5:
		await return_once()
		check(app.campaign.data.history.size() == day + 1, "One actual history entry per day")
	check(app.campaign.data.status == "lost" and app.campaign.data.day == 5, "Natural empty returns end in Day 5 hunger loss")
	check(app.screen.reason_label.text.contains("连续缺粮"), "Natural failure displays recorded hunger cause")
	for card: RunMemberResultCard in app.screen.member_cards:
		check(card.member_id in original_ids and card.final_status == "starved", "Actual member identity and cause are preserved")
	await verify_terminal("Natural five-day loss")
	await capture("actual-five-day-loss-1600x900")
	root.size = Vector2i(1024, 640)
	await frames(12)
	await capture("actual-five-day-loss-1024x640")
	await click(app.screen.menu_button)
	check(app.state == "menu", "End page returns to main menu through actual input")
	await launch(false)
	await click(app.screen.menu_buttons[1])
	await wait_state("ended")
	await verify_terminal("Restored lost Run")
	await capture("actual-restored-loss-1024x640")
	var old: Dictionary = app.campaign.data.duplicate(true)
	var saved: String = FileAccess.get_file_as_string(run_save)
	await click(app.screen.new_run_button)
	check(app.state == "new_game", "New Run opens existing specialization selection")
	check(app.campaign.data == old and FileAccess.get_file_as_string(run_save) == saved, "Opening new draft keeps terminal save intact")
	await create_timer(.7).timeout
	await click(button("取消"))
	await wait_state("menu")
	check(app.state == "menu" and FileAccess.get_file_as_string(run_save) == saved, "Cancelling restart draft preserves terminal save")
	await click(app.screen.menu_buttons[1])
	await wait_state("ended")
	await click(app.screen.new_run_button)
	await create_timer(.7).timeout
	await click(app.screen.confirm_button)
	await wait_for_camp()
	check(app.campaign.data.day == 1 and app.campaign.data.food == 6 and app.campaign.data.scrap == 0, "Confirmed restart restores actual initial resources")
	check(app.campaign.data.history.is_empty() and app.campaign.data.members.size() == 2, "Confirmed restart has no historical losses or stale cards")
	# API-created victory fixture: four committed days, persisted final pending result.
	app.campaign = Fixtures.fresh(2)
	for day: int in 4:
		check(Fixtures.stage(app.campaign, 2) and app.campaign.commit_day(), "Controlled victory day commits")
	check(Fixtures.stage(app.campaign, 2), "Controlled final pending result")
	check(app._save(), "Pending victory fixture persists through normal Store")
	await launch(false)
	await click(app.screen.menu_buttons[1])
	await wait_state("result")
	check(app.campaign.data.status == "pending" and app.campaign.data.history.size() == 4, "Continue restores uncommitted final result")
	await click(app.screen.confirm_button)
	await wait_state("ended")
	check(app.campaign.data.status == "won" and app.campaign.data.history.size() == 5, "Actual final-confirm input creates won once from pending fixture")
	await verify_terminal("Controlled final victory transition")
	root.size = Vector2i(1600, 900)
	await frames(12)
	await capture("controlled-final-victory-1600x900")
	await click(app.screen.menu_button)
	await launch(false)
	await click(app.screen.menu_buttons[1])
	await wait_state("ended")
	check(app.campaign.data.status == "won" and app.campaign.data.history.size() == 5, "Won terminal restores without re-settlement")
	await capture("controlled-restored-victory-1600x900")
	FileAccess.open(end_output_dir + "flow-runtime.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "save_path": run_save, "method": "Native main.tscn and synthetic input: actual five-day empty-return loss; separately API-created pending-victory fixture and real final-confirm/continue/restart input. Not a naturally played victory run."}, "\t"))
	print("RUN END FLOW: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(8)
	quit(0 if failures.is_empty() else 1)
