extends Node
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Campaign = preload("res://core/campaign.gd")
const Store = preload("res://core/save_store.gd")
const GameSettings = preload("res://core/game_settings.gd")
const Mission = preload("res://missions/mission.gd")
const HUD = preload("res://ui/mission_hud.gd")
const Settlement = preload("res://ui/settlement_screen.gd")
const UI = preload("res://ui/ui_style.gd")
const NewGame = preload("res://ui/new_game_screen.gd")
const GameConfirmation = preload("res://ui/game_confirmation.gd")
const Title = preload("res://ui/title_screen.gd")
const TodayAction = preload("res://ui/today_action_screen.gd")
const ShelterView = preload("res://ui/shelter_view.gd")
const CampHUDRoot = preload("res://ui/camp_hud/camp_hud_root.tscn")
const LoadingScreenV2 = preload("res://scenes/loading/LoadingScreenV2.tscn")
var selected_member := ""
var catalog := Catalog.new()
var ledger := Ledger.new()
var campaign: RefCounted
var store: RefCounted
var settings: RefCounted
var save_path := "user://homeward/run.json"
var settings_path := "user://homeward/settings.json"
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
var camp_view: Node3D
var camp_ui: Control
var selected_mission_id := ""
var selected_mission_data: Resource
var selected_party: Array[String] = []
var selected_mission_config: Dictionary = {}
var random_mission_counter: int = 0
var departure_fade: ColorRect
var continue_loading: Control
var _today_action_closing := false
var _menu_transitioning := false
var _loading_timing_usec: int = 0

func get_camp_view() -> Node3D:
	if is_instance_valid(camp_view) and not camp_view.matches_run(campaign):
		_clear_camp()
	if not is_instance_valid(camp_view):
		camp_view = ShelterView.new()
		add_child(camp_view)
		camp_view.setup(campaign)
		camp_view.member_selected.connect(select_member)
	else:
		camp_view.refresh_members(campaign)
	return camp_view

func prepare_camp_for_loading() -> void:
	if state == "loading_continue" and not is_instance_valid(screen):
		show_shelter()

func _fullscreen_camp() -> void:
	var view := get_camp_view()
	view.interaction_locked = true
	view.select("")

func _clear_camp() -> void:
	if is_instance_valid(camp_view):
		camp_view.get_parent().remove_child(camp_view)
		camp_view.queue_free()
	camp_view = null

func _ready() -> void:
	if "--town-street-life" in OS.get_cmdline_user_args() or "--town-environment-polish" in OS.get_cmdline_user_args():
		get_tree().change_scene_to_file.call_deferred("res://scenes/debug/medium_town_runtime_test.tscn")
		return
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
	if save_path.begins_with("user://test-runs/"):
		settings_path = save_path.get_base_dir() + "/" + save_path.get_file().get_basename() + "-settings.json"
	if fresh_test_run and "--test-menu" in OS.get_cmdline_user_args():
		fresh_test_run = false
	settings = GameSettings.new(settings_path, get_window())
	campaign = Campaign.new(catalog)
	store = Store.new(save_path)
	ui_layer = CanvasLayer.new()
	ui_layer.name = "CanvasLayer"
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
	if OS.is_debug_build() and "--loading-v2" in OS.get_cmdline_user_args():
		state = "loading_continue"
		continue_loading = LoadingScreenV2.instantiate() as Control
		ui_layer.add_child(continue_loading)
		continue_loading.call("setup", self)
		continue_loading.completed.connect(_continue_loading_completed, CONNECT_ONE_SHOT)
		return
	if fresh_test_run:
		_refresh_screen()
		if "--test-weapons" in OS.get_cmdline_user_args():
			screen.show_weapons.call_deferred()
		if "--test-today-action" in OS.get_cmdline_user_args():
			show_today_action.call_deferred()
		if "--test-expedition" in OS.get_cmdline_user_args():
			start_mission.call_deferred()
	else:
		show_main_menu()

func _input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.physical_keycode == KEY_F1 and OS.is_debug_build():
		if state == "mission" and hud != null:
			hud.toggle_debug()
		elif state == "shelter" and screen != null and screen.has_method("toggle_debug"):
			screen.toggle_debug()
		get_viewport().set_input_as_handled()
	elif event.physical_keycode == KEY_ESCAPE and state in ["shelter", "today_action", "departure"] and is_instance_valid(camp_ui):
		if state == "today_action" and is_instance_valid(screen):
			screen.call("_request_cancel")
		elif state == "shelter":
			show_main_menu()
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
	get_tree().quit()

func return_to_main_menu() -> void:
	if state != "mission" or not campaign.abandon_action():
		return
	show_main_menu()

func member_name(id: String) -> String:
	var member: Resource = campaign.member_template(id)
	return member.display_name if member else id

func member_names(ids: Array) -> String:
	var names: PackedStringArray = []
	for id in ids:
		names.append(member_name(id))
	return "、".join(names) if not names.is_empty() else "无"

func _clear_screen() -> void:
	if is_instance_valid(screen) and screen != camp_ui:
		screen.get_parent().remove_child(screen)
		screen.queue_free()
	if is_instance_valid(camp_ui):
		camp_ui.get_parent().remove_child(camp_ui)
		camp_ui.queue_free()
	camp_ui = null
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

func continue_from_menu() -> void:
	if state != "menu" or campaign.data.is_empty() or is_instance_valid(continue_loading):
		return
	state = "loading_continue"
	# Remove the title screen before prewarming Camp; otherwise its live node is
	# mistaken for the prepared destination and remains visible after Loading.
	_clear_screen()
	_loading_timing_usec = Time.get_ticks_usec()
	loading_timing("T_continue_clicked")
	loading_timing("T_loading_instantiated")
	continue_loading = LoadingScreenV2.instantiate() as Control
	ui_layer.add_child(continue_loading)
	loading_timing("T_loading_added_to_tree")
	continue_loading.call("setup", self)
	continue_loading.completed.connect(_continue_loading_completed, CONNECT_ONE_SHOT)

func _continue_loading_completed() -> void:
	if not is_instance_valid(continue_loading):
		return
	if not is_instance_valid(screen):
		_refresh_screen()
	loading_timing("T_show_shelter_called")
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	loading_timing("T_camp_first_frame_ready")
	if is_instance_valid(continue_loading):
		ui_layer.remove_child(continue_loading)
		continue_loading.queue_free()
		continue_loading = null
		loading_timing("T_loading_hidden")
		loading_timing("T_loading_freed")
	loading_timing("T_fade_in_to_camp_start")
	loading_timing("T_transition_done")

func loading_timing(label: String) -> void:
	if _loading_timing_usec == 0:
		_loading_timing_usec = Time.get_ticks_usec()
	var elapsed_ms := float(Time.get_ticks_usec() - _loading_timing_usec) / 1000.0
	print("[LoadingV2] %s +%.1fms" % [label, elapsed_ms])

func show_shelter() -> void:
	if state == "departure":
		return
	if campaign.data.status == "pending":
		_show_result()
		return
	if campaign.data.status in ["won", "lost"]:
		_clear_camp()
	_clear_screen()
	state = "ended" if campaign.data.status in ["won", "lost"] else "shelter"
	if state == "shelter":
		get_camp_view().interaction_locked = false
		get_camp_view().select("")
		camp_ui = CampHUDRoot.instantiate()
		ui_layer.add_child(camp_ui)
		camp_ui.depart_requested.connect(show_today_action)
		camp_ui.menu_requested.connect(show_main_menu)
		screen = camp_ui

func show_today_action() -> void:
	while _today_action_closing:
		await get_tree().process_frame
	if state != "shelter" or campaign.data.status != "shelter" or campaign.data.members.is_empty():
		return
	camp_ui.set_hud_visible(false)
	camp_view.interaction_locked = true
	state = "today_action"
	screen = TodayAction.new()
	camp_ui.add_child(screen)
	screen.setup(catalog.today_actions, base_map, campaign.data, catalog.loop, campaign.passive_modifiers())
	screen.setup_party(campaign)
	screen.departure_confirmed.connect(start_mission)
	screen.cancelled.connect(_close_today_action)

func _close_today_action() -> void:
	if _today_action_closing or state != "today_action" or not is_instance_valid(screen):
		return
	_today_action_closing = true
	var action_screen := screen as TodayAction
	state = "shelter"
	# Expose the camp state immediately while the outgoing panel finishes its visual exit.
	camp_ui.set_hud_visible(true)
	camp_view.interaction_locked = false
	screen = camp_ui
	if action_screen != null:
		await action_screen.close_with_animation()
	if is_instance_valid(action_screen) and is_instance_valid(camp_ui):
		camp_ui.remove_child(action_screen)
		action_screen.queue_free()
	_today_action_closing = false

func show_main_menu() -> void:
	if state == "departure":
		return
	_clear_camp()
	_clear_screen()
	_clear_mission()
	state = "menu"
	screen = Title.new()
	ui_layer.add_child(screen)
	screen.setup(self)

func show_new_game() -> void:
	if state == "departure" or _menu_transitioning:
		return
	if state == "menu" and is_instance_valid(screen):
		_start_new_game_transition()
		return
	_open_new_game_screen()

func _open_new_game_screen() -> void:
	_clear_camp()
	_clear_screen()
	_clear_mission()
	state = "new_game"
	screen = NewGame.new()
	ui_layer.add_child(screen)
	screen.setup(self)

func _start_new_game_transition() -> void:
	if _menu_transitioning or state != "menu" or not is_instance_valid(screen):
		return
	_menu_transitioning = true
	state = "menu_transition"
	var outgoing := screen
	outgoing.process_mode = Node.PROCESS_MODE_DISABLED
	for child: Node in outgoing.get_children():
		if child is Control:
			(child as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
	var press_target := outgoing.get_viewport().gui_get_focus_owner() as Control
	if press_target != null:
		var press_tween := create_tween()
		press_tween.tween_property(press_target, "scale", Vector2.ONE * 0.96, 0.08).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		press_tween.tween_property(press_target, "scale", Vector2.ONE, 0.07).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	await get_tree().create_timer(0.08).timeout
	var exit_tween := create_tween()
	exit_tween.tween_property(outgoing, "modulate:a", 0.0, 0.24).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	var dim := ColorRect.new()
	dim.name = "MenuTransitionDim"
	dim.color = Color(0.01, 0.04, 0.10, 0.0)
	dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_layer.add_child(dim)
	var dim_tween := create_tween()
	dim_tween.tween_property(dim, "color:a", 0.12, 0.22).set_trans(Tween.TRANS_SINE)
	await get_tree().create_timer(0.27).timeout
	_open_new_game_screen()
	if is_instance_valid(dim):
		var reveal := create_tween()
		reveal.tween_property(dim, "color:a", 0.0, 0.22).set_trans(Tween.TRANS_SINE)
		reveal.tween_callback(dim.queue_free)
	_menu_transitioning = false

func select_member(id: String) -> void:
	if state != "shelter" or not is_instance_valid(camp_ui) or not camp_ui.has_method("show_survivor"):
		return
	selected_member = id
	camp_ui.show_survivor(id)

func train_member(id: String) -> void:
	if state != "shelter":
		return
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
	if state != "shelter":
		return
	var before: Dictionary = campaign.data.duplicate(true)
	if campaign.equip(member, uid):
		_save(before)
	show_shelter()

func unequip_member(member: String) -> void:
	if state != "shelter":
		return
	var before: Dictionary = campaign.data.duplicate(true)
	if campaign.unequip_weapon(member):
		_save(before)
	show_shelter()

func buy_weapon(uid: String) -> void:
	if state != "shelter":
		return
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

func replace_camp_effect(category: String, previous: String, replacement: String) -> void:
	if state != "shelter" or category not in ["passive", "power"]:
		return
	var before: Dictionary = campaign.data.duplicate(true)
	if not previous.is_empty() and not campaign.unequip_effect(category, previous):
		return
	if not replacement.is_empty() and not campaign.equip_effect(category, replacement):
		campaign.data = before
		return
	_save(before)
	camp_ui.close_context()
	show_shelter()
	if not replacement.is_empty():
		camp_ui.show_effect_detail(category, replacement, true)

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
	var party: Array = screen.selected_party if state == "today_action" else campaign.data.members
	if party.is_empty() or not campaign.start_action(action_id, party) or not _save(before):
		return
	var action: Resource = catalog.by_id(catalog.today_actions, action_id)
	selected_mission_id = action_id
	selected_mission_data = action.make_map(base_map) if action != null else base_map.duplicate(true)
	selected_mission_config = _mission_config(action_id)
	selected_party.assign(campaign.data.selected_party)
	if action_id.is_empty():
		# Existing internal rule/smoke entry has no selection UI or performance contract.
		_load_selected_mission()
		return
	state = "departure"
	_fullscreen_camp()
	camp_ui.lock_departure()
	if screen != camp_ui:
		screen.process_mode = Node.PROCESS_MODE_DISABLED
		screen.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var tween := create_tween()
		tween.tween_property(screen, "modulate:a", 0.0, 0.18)
		await tween.finished
		camp_ui.remove_child(screen)
		screen.queue_free()
	screen = camp_ui
	camp_view.camp.departure.completed.connect(_departure_complete, CONNECT_ONE_SHOT)
	camp_view.camp.begin_departure(selected_party)

func _departure_complete() -> void:
	camp_ui.set_hud_visible(false)
	departure_fade = ColorRect.new()
	departure_fade.color = Color(0, 0, 0, 0)
	ui_layer.add_child(departure_fade)
	departure_fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var tween := create_tween()
	tween.tween_property(departure_fade, "color:a", 1.0, 0.4)
	await tween.finished
	_load_selected_mission()
	ui_layer.move_child(departure_fade, -1)
	var reveal := create_tween()
	reveal.tween_property(departure_fade, "color:a", 0.0, 0.25)
	reveal.tween_callback(departure_fade.queue_free)

func _load_selected_mission() -> void:
	catalog.map = selected_mission_data
	_clear_screen()
	_clear_camp()
	_clear_mission()
	mission = Mission.new()
	add_child(mission)
	var no_template_loadout: Array[String] = []
	mission.setup(catalog, ledger, no_template_loadout, int(selected_mission_config.get("seed", 0)), campaign, selected_party, selected_mission_config)
	if not selected_mission_id.is_empty():
		mission.begin_arrival()
	mission.completed.connect(_mission_complete)
	hud = HUD.new()
	ui_layer.add_child(hud)
	hud.setup(mission, settings)
	hud.main_menu_requested.connect(return_to_main_menu)
	state = "mission"

func _mission_config(action_id: String) -> Dictionary:
	random_mission_counter += 1
	var mission_type := "supply_search"
	var layout := ""
	match action_id:
		"commercial":
			mission_type = "food_supply"
		"airdrop":
			mission_type = "rescue"
	var runtime_nonce: int = int(Time.get_ticks_usec() & 0x7fffffff)
	var runtime_seed: int = int(campaign.data.seed) + int(campaign.data.day) * 7919 + random_mission_counter * 104729 + runtime_nonce
	return {"use_random_map": true, "mission_type": mission_type, "seed": runtime_seed, "layout": layout, "district_size": layout, "zombie_density": 1.0, "required_poi_tags": []}

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
	if state != "new_game" or not is_instance_valid(screen):
		return
	var existing := screen.get_node_or_null("NewRunConfirmation") as Control
	if existing != null:
		var safe_action := existing.find_child("KeepProgressButton", true, false) as Button
		if safe_action != null:
			safe_action.grab_focus()
		return
	var confirmation := GameConfirmation.new()
	screen.add_child(confirmation)
	confirmation.setup(
		"创建新游戏",
		"当前第 %d 天的进度将被替换。\n确认带新的队伍重新出发？" % campaign.data.day,
		"创建新游戏",
		"保留当前进度",
	)
	confirmation.confirmed.connect(create_run.bind(specialization))

func new_run() -> void:
	show_new_game()

func create_run(specialization: String) -> void:
	if state == "departure":
		return
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

func debug_weapon(kind: String, affix: String, rarity: int = 0) -> void:
	if state != "shelter":
		return
	var rng := RandomNumberGenerator.new()
	var value: Dictionary = campaign.gear.create(kind, "debug:%d" % Time.get_ticks_usec(), rng, rarity).to_dict()
	if not affix.is_empty():
		value.affix = affix
		value.rarity = maxi(1, rarity)
	if not campaign.gear.valid(value):
		status_message = "该词条不适用于所选武器。"
	else:
		var before: Dictionary = campaign.data.duplicate(true)
		campaign.weapon_inventory.add_weapon(Campaign.WeaponInstanceData.from_dict(value))
		campaign.data.modified = true
		_save(before)
	show_shelter()
