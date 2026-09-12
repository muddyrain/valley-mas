extends Node
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Campaign = preload("res://core/campaign.gd")
const Store = preload("res://core/save_store.gd")
const Mission = preload("res://missions/mission.gd")
const HUD = preload("res://ui/mission_hud.gd")
const Shelter = preload("res://ui/shelter_screen.gd")
const Settlement = preload("res://ui/settlement_screen.gd")
const UI = preload("res://ui/ui_style.gd")
const NewGame = preload("res://ui/new_game_screen.gd")
const Title = preload("res://ui/title_screen.gd")
const TodayAction = preload("res://ui/today_action_screen.gd")
var selected_member := ""
var catalog := Catalog.new()
var ledger := Ledger.new()
var campaign: RefCounted
var store: RefCounted
var save_path := "user://homeward/run.json"
var fresh_test_run := false
var mission: Node3D
var hud: Control
var ui_layer: CanvasLayer
var screen: Control
var result: Dictionary = {}
var state := "loading"
var status_message := ""
var save_blocked := false
var save_error_dialog: AcceptDialog
var base_map: Resource

func _ready() -> void:
	if "--art-showcase" in OS.get_cmdline_user_args():
		get_tree().change_scene_to_file.call_deferred("res://scenes/debug/art_showcase.tscn")
		return
	var errors := catalog.validate()
	base_map = catalog.map.duplicate(true)
	if not errors.is_empty():
		push_error("Invalid content: " + str(errors))
		get_tree().quit(1)
		return
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--test-save="):
			save_path = "user://test-runs/" + arg.trim_prefix("--test-save=").get_file()
			fresh_test_run = true
	if fresh_test_run and "--test-menu" in OS.get_cmdline_user_args():
		fresh_test_run = false
	campaign = Campaign.new(catalog)
	store = Store.new(save_path)
	ui_layer = CanvasLayer.new()
	add_child(ui_layer)
	get_tree().auto_accept_quit = false
	var stored: Dictionary = store.read(campaign.valid_state)
	if fresh_test_run or (not stored.ok and stored.get("missing", false)):
		if fresh_test_run:
			# Explicit three-member regression fixture, isolated from player saves.
			campaign.new_run(772, "", ["lin", "qiao", "yan"])
			_save()
	elif not stored.ok or not campaign.restore(stored.data):
		state = "save_error"
		var page := Control.new()
		ui_layer.add_child(page)
		var column := UI.page(page)
		column.add_child(UI.wrapped("无法读取这份存档，现有文件已保留。\n" + ProjectSettings.globalize_path(save_path), 20, UI.AMBER))
		column.add_child(UI.button("关闭游戏", get_tree().quit))
		return
	elif stored.recovered:
		status_message = "已恢复上一份有效存档。"
	if fresh_test_run:
		_refresh_screen()
		if "--test-today-action" in OS.get_cmdline_user_args():
			show_today_action.call_deferred()
	else:
		show_main_menu()

func _input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.physical_keycode == KEY_F1:
		if state == "mission" and hud != null:
			hud.toggle_debug()
		elif state == "shelter" and screen != null:
			screen.toggle_debug()
		get_viewport().set_input_as_handled()
	elif event.physical_keycode == KEY_ESCAPE and state == "mission" and hud != null:
		hud.toggle_menu()
		get_viewport().set_input_as_handled()
	elif event.physical_keycode == KEY_SPACE and state == "mission" and hud != null:
		hud.toggle_pause()
		get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		request_quit()

func request_quit() -> void:
	if state == "mission":
		if not hud.pause_menu.visible and not hud.debug_menu.visible:
			hud.toggle_menu()
		var dialog := ConfirmationDialog.new()
		dialog.title = "退出游戏"
		dialog.ok_button_text = "退出"
		dialog.cancel_button_text = "留在行动"
		dialog.dialog_text = "退出后，续玩将从今天出发前重新开始。\n当前搜索与战斗进度不会保留。"
		dialog.confirmed.connect(get_tree().quit)
		dialog.canceled.connect(dialog.queue_free)
		add_child(dialog)
		dialog.popup_centered()
	else:
		get_tree().quit()

func member_name(id: String) -> String:
	var member: Resource = campaign.member_template(id)
	return member.display_name if member else id

func member_names(ids: Array) -> String:
	var names: PackedStringArray = []
	for id in ids:
		names.append(member_name(id))
	return "、".join(names) if not names.is_empty() else "无"

func _clear_screen() -> void:
	if screen != null:
		ui_layer.remove_child(screen)
		screen.queue_free()
		screen = null

func _clear_mission() -> void:
	if hud != null:
		ui_layer.remove_child(hud)
		hud.queue_free()
		hud = null
	if mission != null:
		remove_child(mission)
		mission.queue_free()
		mission = null

func _refresh_screen() -> void:
	if campaign.data.status == "pending":
		_show_result()
	else:
		show_shelter()

func show_shelter() -> void:
	if campaign.data.status == "pending":
		_show_result()
		return
	_clear_screen()
	state = "ended" if campaign.data.status in ["won", "lost"] else "shelter"
	screen = Shelter.new()
	ui_layer.add_child(screen)
	screen.setup(self)

func show_today_action() -> void:
	if state != "shelter" or campaign.data.status != "shelter" or campaign.data.members.is_empty():
		return
	_clear_screen()
	state = "today_action"
	screen = TodayAction.new()
	ui_layer.add_child(screen)
	screen.setup(catalog.today_actions, base_map, campaign.data, catalog.loop, campaign.passive_modifiers())
	screen.departure_confirmed.connect(start_mission)
	screen.cancelled.connect(show_shelter)

func show_main_menu() -> void:
	_clear_screen()
	_clear_mission()
	state = "menu"
	screen = Title.new()
	ui_layer.add_child(screen)
	screen.setup(self)

func show_new_game() -> void:
	_clear_screen()
	_clear_mission()
	state = "new_game"
	screen = NewGame.new()
	ui_layer.add_child(screen)
	screen.setup(self)

func select_member(id: String) -> void:
	selected_member = id
	show_shelter()

func train_member(id: String) -> void:
	var before: Dictionary = campaign.data.duplicate(true)
	if campaign.train(id) and _save(before):
		status_message = "%s · 已升至 %d 级" % [member_name(id), campaign.member_level(id)]
	show_shelter()

func _save(before: Dictionary = {}) -> bool:
	var message: String = store.write(campaign.data, campaign.valid_state)
	save_blocked = not message.is_empty()
	if save_blocked:
		if not before.is_empty():
			campaign.data = before
		status_message = message
		if not is_instance_valid(save_error_dialog):
			save_error_dialog = AcceptDialog.new()
			save_error_dialog.confirmed.connect(save_error_dialog.queue_free)
			add_child(save_error_dialog)
		save_error_dialog.dialog_text = message
		if not save_error_dialog.visible:
			save_error_dialog.popup_centered()
		return false
	return true

func equip_member(member: String, uid: String) -> void:
	var before: Dictionary = campaign.data.duplicate(true)
	if campaign.equip(member, uid):
		_save(before)
	show_shelter()

func buy_weapon(uid: String) -> void:
	var before: Dictionary = campaign.data.duplicate(true)
	if campaign.buy(uid):
		_save(before)
	show_shelter()

func set_effect_equipped(category: String, id: String, equipped: bool) -> void:
	if state != "shelter":
		return
	var before: Dictionary = campaign.data.duplicate(true)
	var changed: bool = campaign.equip_effect(category, id) if equipped else campaign.unequip_effect(category, id)
	if changed:
		_save(before)
	show_shelter()
	screen.show_effects()

func debug_effects(upgrade_owned: bool) -> void:
	if state != "shelter":
		return
	var before: Dictionary = campaign.data.duplicate(true)
	for category: String in ["passive", "power"]:
		var definitions: Array = catalog.passives if category == "passive" else catalog.powers
		if not upgrade_owned:
			var extra: int = definitions.size() - campaign.data[category + "_capacity"]
			if extra > 0:
				campaign.expand_effect_slots(category, extra)
		for definition: Resource in definitions:
			if upgrade_owned:
				campaign.upgrade_effect(category, definition.id)
			else:
				campaign.grant_effect(category, definition.id)
				campaign.equip_effect(category, definition.id)
	campaign.data.modified = true
	_save(before)
	show_shelter()
	screen.show_effects()

func start_mission(action_id: String = "") -> void:
	if state not in ["shelter", "today_action"]:
		return
	if state == "today_action" and action_id.is_empty():
		return
	var before: Dictionary = campaign.data.duplicate(true)
	if not campaign.start_action(action_id) or not _save(before):
		return
	var action: Resource = catalog.by_id(catalog.today_actions, action_id)
	catalog.map = action.make_map(base_map) if action != null else base_map.duplicate(true)
	_clear_screen()
	_clear_mission()
	mission = Mission.new()
	add_child(mission)
	var no_template_loadout: Array[String] = []
	mission.setup(catalog, ledger, no_template_loadout, 0, campaign)
	mission.completed.connect(_mission_complete)
	hud = HUD.new()
	ui_layer.add_child(hud)
	hud.setup(mission)
	hud.quit_requested.connect(request_quit)
	state = "mission"

func _mission_complete(outcome: Dictionary) -> void:
	if not campaign.stage_result(outcome):
		return
	result = outcome
	state = "result"
	_save()
	call_deferred("_show_result")

func _show_result() -> void:
	if hud != null:
		ui_layer.remove_child(hud)
		hud.queue_free()
		hud = null
	_clear_screen()
	state = "result"
	result = campaign.data.pending
	screen = Settlement.new()
	ui_layer.add_child(screen)
	screen.setup(self)

func return_to_shelter(fed: Array = []) -> void:
	# Persist pending outcome before the next transaction, including after an I/O failure.
	if not _save():
		return
	var before: Dictionary = campaign.data.duplicate(true)
	if campaign.commit_day(fed):
		if not _save(before):
			return
		status_message = "已保存 · 第 %d 天" % campaign.data.day
		var copies: Array = campaign.data.history.back().get("copied_weapons", [])
		if not copies.is_empty():
			status_message += " · 备件复制台获得 " + campaign.gear.title(copies[0])
		_clear_mission()
		_refresh_screen()

func confirm_new_run() -> void:
	show_new_game()

func confirm_creation(specialization: String) -> void:
	if campaign.data.is_empty() or campaign.data.status in ["won", "lost"]:
		create_run(specialization)
		return
	var dialog := ConfirmationDialog.new()
	dialog.title = "创建新游戏"
	dialog.dialog_text = "新游戏将替换当前第 %d 天的进度。\n确认带新的队伍出发？" % campaign.data.day
	dialog.ok_button_text = "创建新游戏"
	dialog.cancel_button_text = "保留当前进度"
	dialog.confirmed.connect(func(): create_run(specialization); dialog.queue_free())
	dialog.canceled.connect(dialog.queue_free)
	add_child(dialog)
	dialog.popup_centered()

func new_run() -> void:
	show_new_game()

func create_run(specialization: String) -> void:
	if catalog.by_id(catalog.specializations, specialization) == null:
		return
	var before: Dictionary = campaign.data.duplicate(true)
	campaign.new_run(0, specialization)
	if _save(before):
		_clear_mission()
		selected_member = ""
		status_message = "新的一轮 · 带大家回来。"
		show_shelter()
	else:
		campaign.data = before

func debug_change(field: String, amount: int) -> void:
	if state != "shelter" or field not in ["food", "scrap", "day", "hunger"]:
		return
	var before: Dictionary = campaign.data.duplicate(true)
	campaign.data[field] = maxi(0, int(campaign.data[field]) + amount)
	if field == "day":
		campaign.data.day = clampi(campaign.data.day, 1, catalog.loop.end_day)
		campaign._prepare_day()
	campaign.data.modified = true
	_save(before)
	show_shelter()

func debug_weapon(kind: String, affix: String) -> void:
	if state != "shelter":
		return
	var value := {"uid": "debug:%d" % Time.get_ticks_usec(), "kind": kind, "affix": affix}
	if not campaign.gear.valid(value):
		status_message = "该词条不适用于所选武器。"
	else:
		var before: Dictionary = campaign.data.duplicate(true)
		campaign.data.inventory.append(value)
		campaign.data.modified = true
		_save(before)
	show_shelter()
