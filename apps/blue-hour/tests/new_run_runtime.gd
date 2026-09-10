extends "res://tests/day_loop_runtime.gd"
var run_save := "user://test-runs/new-run-ui-%d.json" % Time.get_ticks_usec()

func launch(_fresh: bool) -> void:
	if app != null:
		app.queue_free()
		await frames()
	app = load("res://core/main.gd").new()
	app.save_path = run_save
	root.add_child(app)
	await frames(12)

func run() -> void:
	create_timer(60).timeout.connect(func(): printerr("NEW RUN UI TIMEOUT"); quit(2))
	root.unfocusable = true
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output")
	await launch(true)
	check(app.state == "menu" and app.campaign.data.is_empty(), "Missing save starts at menu, not an implicit run")
	check(not FileAccess.file_exists(run_save), "Menu alone never writes a run")
	await capture("20-main-menu")
	await click(button("开始游戏"))
	for choice in ["scavenge", "survey", "combat"]:
		await click(app.screen.tabs[choice])
		check(app.screen.selected == choice, "Tab selects " + choice)
	await click(app.screen.tabs.scavenge)
	check(app.screen.cards.size() == 2 and app.screen.selected_effect == 1, "Route preview exposes two selectable rewards")
	await click(app.screen.cards[0])
	check(app.screen.selected_effect == 0 and app.screen.tooltip_title.text == "备件复制台", "Passive card updates the detail callout")
	await click(app.screen.cards[1])
	check(app.screen.selected_effect == 1 and app.screen.tooltip_title.text == "疾行号令", "Skill card updates the detail callout")
	await capture("21-specialization")
	await click(button("取消"))
	check(app.state == "menu" and app.campaign.data.is_empty(), "Cancel leaves no created run")
	await click(button("开始游戏"))
	await click(app.screen.tabs.survey)
	await click(app.screen.confirm_button)
	check(app.state == "shelter" and app.campaign.data.members.size() == 2, "Confirmation creates two-member shelter")
	check(app.campaign.data.specialization == "survey", "Chosen specialization reaches saved run")
	var members: Array = app.campaign.data.members.duplicate()
	await click_at(app.screen.view.get_global_rect().position + app.screen.view.member_point(members[1]))
	check(app.selected_member == members[1], "Clicking 3D survivor selects the matching member")
	var food: int = app.campaign.data.food
	await click(app.screen.training_button)
	check(app.campaign.member_level(members[1]) == 2 and app.campaign.data.food == food - 1, "Native training button spends food and grows member")
	await click(app.screen.member_buttons[members[0]])
	check(app.selected_member == members[0], "Roster click selects the same identity as the world")
	await capture("22-new-run-shelter")
	var selected_weapon: String = app.campaign.data.equipment[members[0]]
	var select: OptionButton = app.screen.weapon_selects[0]
	await click(select)
	var popup := select.get_popup()
	await click_at(Vector2(popup.position) + Vector2(40, popup.size.y - 24))
	check(app.campaign.data.equipment[members[1]] == selected_weapon, "Two members can exchange individual weapons")
	await click(button("主菜单"))
	var saved: String = FileAccess.get_file_as_string(run_save)
	await click(button("开始游戏"))
	await click(app.screen.tabs.combat)
	await click(app.screen.confirm_button)
	var dialog: ConfirmationDialog
	for node in app.get_children():
		if node is ConfirmationDialog:
			dialog = node
	check(dialog != null and dialog.visible, "Replacing an active run has a concrete confirmation")
	await click_at(Vector2(dialog.position) + dialog.get_cancel_button().get_global_rect().get_center())
	await click(button("取消"))
	check(FileAccess.get_file_as_string(run_save) == saved, "Cancel replacement preserves exact old save")
	await launch(false)
	await click(button("继续"))
	check(app.campaign.data.members == members and app.campaign.member_level(members[1]) == 2, "Continue retains team and training")
	root.size = Vector2i(1024, 640)
	await frames(12)
	check(root.get_visible_rect().encloses(app.screen.departure.get_global_rect()), "Departure visible at minimum size")
	check(root.get_visible_rect().encloses(app.screen.training_button.get_global_rect()), "Training visible at minimum size")
	await capture("23-new-run-small")
	root.size = Vector2i(1440, 900)
	await frames()
	await click(button("整装出发"))
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	app.mission.survivors[0].hp = 10
	app.mission.survivors[1].hp = 20
	await click(app.hud.power_button)
	check(app.mission.powers.used and app.mission.survivors[0].hp > 10 and app.mission.survivors[1].hp > 20, "HUD casts global aid on both members")
	check(app.hud.power_button.disabled, "Used power cannot be cast again")
	await capture("24-special-power")
	app.mission.ledger.add_loot(3, 4)
	app.mission._finish(false)
	await frames(10)
	await click(button("确认结算"))
	check(app.campaign.data.day == 2 and app.campaign.member_level(members[1]) == 2, "Return preserves individual level into next day")
	await click(button("整装出发"))
	check(not app.mission.powers.used, "Next day recharges the equipped power")
	# Controlled I/O failure: no player save is touched and domain state must roll back.
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	app.mission._finish(false)
	await frames(10)
	await click(button("确认结算"))
	var before: Dictionary = app.campaign.data.duplicate(true)
	var good_store = app.store
	app.store = load("res://core/save_store.gd").new(run_save + "/blocked.json")
	app.train_member(members[0])
	check(app.campaign.data == before, "Failed training write rolls back food and level")
	for node in app.get_children():
		if node is AcceptDialog and node.visible:
			await click_at(Vector2(node.position) + node.get_ok_button().get_global_rect().get_center())
			check(not is_instance_valid(node) or not node.visible, "Save error can be dismissed")
	app.create_run("combat")
	check(app.campaign.data == before, "Failed creation write preserves previous run")
	app.store = good_store
	var report := FileAccess.open("res://test-output/new-run-runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "evidence":"native synthetic mouse input, isolated save, real 3D viewport and mission powers"}, "\t"))
	print("NEW RUN NATIVE: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(8)
	quit(0 if failures.is_empty() else 1)
