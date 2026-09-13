extends Control
## Persistent Camp UI; Campaign remains the authority for all gameplay values.
const UI = preload("res://ui/ui_style.gd")
const Style = preload("res://ui/camp_style.gd")
const Drawer = preload("res://ui/camp/camp_survivor_detail.gd")
const CampHUD = preload("res://ui/camp/camp_hud.gd")
const WeaponBrowser = preload("res://ui/weapon_browser.gd")
const DetailCard = preload("res://ui/camp_detail_card.gd")
enum Mode { NORMAL, SURVIVOR_PANEL, FACILITY_PANEL, INVENTORY, EFFECTS, WEAPONS, MENU, DEBUG, TODAY_ACTION, DEPARTURE, TRANSITION }
var app: Node
var ui_state := Mode.NORMAL
var view: Node3D
var hud_root: Control
var party_panel: PanelContainer
var drawer: PanelContainer
var facility_panel: PanelContainer
var active_interactable: Node3D
var browser: Control
var today_action: Control
var departure: Button
var day_status: Label
var debug_panel: PanelContainer
var member_buttons: Dictionary = {}
var shop_panel: PanelContainer
var shop_backdrop: ColorRect
var effects_panel: PanelContainer
var effects_backdrop: ColorRect
var effect_buttons: Dictionary = {}
var _buttons: Array[Button] = []
var detail_card: PanelContainer
var _hint_generation := 0
var training_button: Button:
	get:
		return drawer.training_button if is_instance_valid(drawer) else null

func setup(owner_app: Node) -> void:
	app = owner_app
	name = "CampUI"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Style.theme()
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	if app.campaign.data.status in ["won", "lost"]:
		_ending(UI.page(self))
		return
	view = app.get_camp_view()
	if app.selected_member not in app.campaign.data.members:
		app.selected_member = app.campaign.data.members[0]
	_build()

func refresh() -> void:
	var previous := ui_state
	var descriptor := active_interactable
	var inventory_mode: bool = browser.inventory_mode if is_instance_valid(browser) else false
	var selected_uid: String = browser.selected_uid if is_instance_valid(browser) else ""
	close_context()
	for child: Node in get_children():
		remove_child(child)
		child.queue_free()
	member_buttons.clear()
	effect_buttons.clear()
	_buttons.clear()
	view.refresh_members(app.campaign)
	_build()
	match previous:
		Mode.SURVIVOR_PANEL: show_survivor(app.selected_member)
		Mode.FACILITY_PANEL: show_facility(descriptor)
		Mode.INVENTORY: show_shop()
		Mode.EFFECTS: show_effects()
		Mode.WEAPONS:
			show_weapons()
			browser._show_list(inventory_mode)
			if not selected_uid.is_empty():
				browser._show_details(app.campaign.weapon(selected_uid), app.campaign.item(selected_uid))

func _build() -> void:
	hud_root = CampHUD.new()
	add_child(hud_root)
	hud_root.setup(self)
	_build_shop()
	_build_effects()
	if OS.is_debug_build():
		_build_debug()
	_set_state(Mode.NORMAL)
	show_survivor(app.selected_member)

func _bind_hint(source: Control, callback: Callable) -> void:
	source.mouse_entered.connect(func():
		_hint_generation += 1
		var generation := _hint_generation
		await get_tree().create_timer(0.22).timeout
		if generation == _hint_generation and app.state == "shelter" and ui_state in [Mode.NORMAL, Mode.SURVIVOR_PANEL]:
			# Hover and click resolve to the same card so the UI never creates two
			# competing information boards for one skill or item.
			callback.call())
	source.mouse_exited.connect(func():
		_hint_generation += 1
		if is_instance_valid(detail_card) and not detail_card.interactive:
			_clear_detail())

func _clear_detail() -> void:
	_hint_generation += 1
	if is_instance_valid(detail_card):
		remove_child(detail_card)
		detail_card.queue_free()
	detail_card = null

func _detail(title: String, subtitle: String, source: Control, side: String, pinned: bool) -> PanelContainer:
	if pinned:
		close_context()
	else:
		_clear_detail()
	detail_card = DetailCard.new()
	add_child(detail_card)
	detail_card.setup(title, subtitle, source, side, pinned)
	detail_card.closed.connect(close_context)
	if pinned:
		_set_state(Mode.FACILITY_PANEL)
	return detail_card

func show_effect_detail(category: String, id: String, pinned: bool) -> void:
	if app.state != "shelter":
		return
	var source := hud_root.find_child("Effect_" + category + "_" + id, true, false) as Control
	if source == null:
		return
	var definition: Resource = app.campaign.effect_definition(category, id)
	var title: String = definition.display_name if definition != null else ("空道具槽" if category == "passive" else "空技能槽")
	var card := _detail(title, "被动道具 · 随队生效" if category == "passive" else "战术能力 · 每次出勤可用一次", source, "above" if category == "passive" else "right", pinned)
	if pinned:
		source.set_selected(true)
	if definition == null:
		card.describe("从已持有的装备中选择一项。")
	else:
		card.describe(definition.description(), Style.INK)
		if pinned:
			card.describe("已完成升级" if definition.is_upgraded else definition.upgrade_description(), Style.ACCENT)
	if pinned:
		card.action("装备" if definition == null else "更换", func(): _show_replacements(category, id))
		if definition != null:
			card.action("已升级" if definition.is_upgraded else "升级 · 待开放", func(): pass, false)
			if not definition.is_upgraded:
				card.describe("升级暂未开放。", Style.MUTED)

func _show_replacements(category: String, old_id: String) -> void:
	var source: Control = detail_card.source
	var side: String = detail_card.side
	var card := _detail("更换道具" if category == "passive" else "更换技能", "已持有", source, side, true)
	var choices := 0
	for id: String in app.campaign.data[category + "_items"]:
		if id in app.campaign.data[category + "_slots"]:
			continue
		var definition: Resource = app.campaign.effect_definition(category, id)
		choices += 1
		card.action(definition.display_name, func(): app.replace_camp_effect(category, old_id, id))
		card.describe(definition.description())
	if choices == 0:
		card.describe("暂无可更换的装备。")
	if not old_id.is_empty():
		card.action("卸下", func(): app.replace_camp_effect(category, old_id, ""))

func show_slot_detail(category: String, pinned: bool) -> void:
	if app.state != "shelter":
		return
	var capacity: int = app.campaign.data[category + "_capacity"]
	var count: int = app.campaign.data[category + "_slots"].size()
	var title := "道具槽" if category == "passive" else "技能槽"
	var source := hud_root.find_child("Unlock_" + category, true, false) as Control
	var card := _detail(title, "已装备 %d / %d" % [count, capacity], source, "above" if category == "passive" else "right", pinned)
	card.describe("扩展容量后，可同时携带更多" + ("被动道具。" if category == "passive" else "战术能力。"))
	card.describe("槽位解锁暂未开放。")
	if pinned:
		card.action("解锁 · 待开放", func(): pass, false)

func _show_phase(pinned: bool) -> void:
	if app.state != "shelter":
		return
	var source := hud_root.find_child("PhaseStatus", true, false) as Control
	var card := _detail("白昼与蓝时", "出勤时段", source, "below", pinned)
	var modifiers: RefCounted = app.campaign.passive_modifiers()
	card.describe("白昼 %d 秒 · 蓝时 %d 秒" % [app.base_map.day_seconds + modifiers.amount("day_extension"), app.base_map.blue_seconds], Style.INK)
	card.describe("蓝时结束后进入夜晚。夜间每停留 %d 秒，感染者威胁继续上升。" % app.base_map.night_threat_seconds)
	if pinned:
		card.describe("夜间威胁每次出勤重新计算。天黑前规划好归航路线。", Style.ACCENT)

func _set_state(value: Mode) -> void:
	ui_state = value
	if is_instance_valid(hud_root):
		hud_root.visible = value != Mode.TODAY_ACTION
	view.interaction_locked = value not in [Mode.NORMAL, Mode.SURVIVOR_PANEL, Mode.FACILITY_PANEL]

func close_context() -> void:
	if ui_state in [Mode.DEPARTURE, Mode.TRANSITION]:
		return
	_clear_detail()
	if is_instance_valid(hud_root):
		hud_root.clear_slot_selection()
	for panel: Control in [drawer, facility_panel, browser]:
		if is_instance_valid(panel):
			panel.get_parent().remove_child(panel)
			panel.queue_free()
	drawer = null
	facility_panel = null
	browser = null
	for panel: Control in [shop_panel, shop_backdrop, effects_panel, effects_backdrop, debug_panel]:
		if is_instance_valid(panel):
			panel.hide()
	if is_instance_valid(party_panel):
		party_panel.show()
	_set_state(Mode.NORMAL)

func handle_back() -> void:
	if ui_state in [Mode.DEPARTURE, Mode.TRANSITION]:
		return
	if ui_state == Mode.TODAY_ACTION:
		app.show_shelter()
	elif ui_state == Mode.NORMAL:
		show_menu()
	else:
		close_context()

func show_survivor(id: String) -> void:
	if app.state != "shelter" or id not in app.campaign.data.members:
		return
	close_context()
	drawer = Drawer.new()
	hud_root.composition.add_child(drawer)
	var member_index: int = app.campaign.data.members.find(id)
	# Align the card header with the selected portrait row while keeping the
	# lower action area clear of the departure button.
	drawer.position = Vector2(1330, minf(190.0 + member_index * 120.0, 340.0))
	drawer.size = Vector2(430, 530)
	drawer.setup(app, id)
	drawer.closed.connect(close_context)
	hud_root.select_member(id)
	view.select(id)
	_set_state(Mode.SURVIVOR_PANEL)

func show_survivors() -> void:
	show_survivor(app.selected_member)

func show_facility(descriptor: Node3D) -> void:
	if app.state != "shelter" or not is_instance_valid(descriptor):
		return
	close_context()
	active_interactable = descriptor
	var column := _context(descriptor.display_name)
	column.add_child(Style.wrapped(descriptor.description, 16))
	if descriptor.panel_type == "vehicle":
		column.add_child(Style.wrapped("外勤队伍 · " + app.member_names(app.campaign.data.selected_party), 17, Style.INK))
		var action: Resource = app.catalog.by_id(app.catalog.today_actions, app.campaign.data.selected_action)
		column.add_child(Style.wrapped("今日任务 · " + (action.display_name if action != null else "待选择"), 16, Style.ACCENT))
	var entries := {"today_action": ["今日行动", app.show_today_action], "shop": ["备用装备", show_shop], "weapons": ["武器", show_weapons], "effects": ["道具与技能", show_effects]}
	for key: String in descriptor.actions:
		if entries.has(key):
			column.add_child(Style.button(entries[key][0], entries[key][1]))
	_set_state(Mode.FACILITY_PANEL)

func _context(title: String) -> VBoxContainer:
	facility_panel = PanelContainer.new()
	facility_panel.theme = Style.paper_theme()
	facility_panel.name = "ContextPanel"
	add_child(facility_panel)
	facility_panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	facility_panel.offset_left = -596
	facility_panel.offset_right = -226
	facility_panel.offset_top = 110
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 16)
	facility_panel.add_child(column)
	var heading := HBoxContainer.new()
	column.add_child(heading)
	var label := Style.label(title, 24)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(label)
	heading.add_child(Style.button("关闭", close_context, Vector2(62, 34)))
	return column

func show_menu() -> void:
	if app.state != "shelter":
		return
	close_context()
	var column := _context("营地")
	column.add_child(Style.button("返回营地", close_context))
	column.add_child(Style.button("幸存者", show_survivors))
	column.add_child(Style.button("武器", show_weapons))
	column.add_child(Style.button("备用装备", show_shop))
	column.add_child(Style.button("道具与技能", show_effects))
	column.add_child(Style.button("主菜单", app.show_main_menu))
	column.add_child(Style.button("退出游戏", app.request_quit))
	_set_state(Mode.MENU)

func show_shop() -> void:
	if app.state != "shelter":
		return
	close_context()
	shop_backdrop.show()
	shop_panel.show()
	_set_state(Mode.INVENTORY)

func show_weapons() -> void:
	if app.state != "shelter":
		return
	close_context()
	browser = WeaponBrowser.new()
	add_child(browser)
	browser.setup(app)
	browser.closed.connect(close_context)
	_set_state(Mode.WEAPONS)

func show_effects() -> void:
	if app.state != "shelter":
		return
	close_context()
	effects_backdrop.show()
	effects_panel.show()
	_set_state(Mode.EFFECTS)

func toggle_debug() -> void:
	if app.state != "shelter" or not OS.is_debug_build() or not is_instance_valid(debug_panel):
		return
	if ui_state == Mode.DEBUG:
		close_context()
	else:
		close_context()
		debug_panel.show()
		_set_state(Mode.DEBUG)

func lock_departure() -> void:
	close_context()
	_set_state(Mode.DEPARTURE)
	party_panel.get_child(0).get_child(0).text = "外勤小队  /  %d" % app.campaign.data.selected_party.size()
	for id: String in member_buttons:
		member_buttons[id].visible = id in app.campaign.data.selected_party
		member_buttons[id].find_child("Readiness", true, false).text = "Lv.%d · 出发中" % app.campaign.member_level(id)
	party_panel.reset_size()
	for button: Button in _buttons:
		button.disabled = true
		button.modulate.a = 0.78
		button.add_theme_color_override("font_disabled_color", UI.MUTED)
	departure.text = "准备出发…"
	day_status.text = "外勤小队 · 正在出发"
	view.select("")

func _build_effects() -> void:
	effects_backdrop = ColorRect.new()
	effects_backdrop.color = Color(0.035, 0.085, 0.14, 0.22)
	effects_backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(effects_backdrop)
	effects_backdrop.hide()
	effects_panel = PanelContainer.new()
	effects_panel.theme = Style.paper_theme()
	effects_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	effects_panel.offset_left = -380
	effects_panel.offset_right = 380
	effects_panel.offset_top = -270
	effects_panel.offset_bottom = 270
	add_child(effects_panel)
	var column := VBoxContainer.new()
	effects_panel.add_child(column)
	column.add_child(Style.label("道具与技能", 24))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	var content := VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 12)
	scroll.add_child(content)
	for category: String in ["passive", "power"]:
		var slots: Array = app.campaign.data[category + "_slots"]
		content.add_child(Style.label(("被动道具" if category == "passive" else "特殊技能 · 每日一次") + "  %d / %d" % [slots.size(), app.campaign.data[category + "_capacity"]], 18, Style.ACCENT))
		for id: String in app.campaign.data[category + "_items"]:
			var definition: Resource = app.campaign.effect_definition(category, id)
			var row := HBoxContainer.new()
			content.add_child(row)
			var icon := TextureRect.new()
			icon.texture = definition.icon
			icon.custom_minimum_size = Vector2(52, 52)
			icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			row.add_child(icon)
			var text := VBoxContainer.new()
			text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			row.add_child(text)
			text.add_child(Style.label(definition.display_name + (" · 已升级" if definition.is_upgraded else ""), 17))
			text.add_child(Style.wrapped(definition.description(), 14))
			var button := UI.button("卸下" if id in slots else "装备", func(): app.set_effect_equipped(category, id, id not in slots), Vector2(80, 40))
			button.disabled = id not in slots and slots.size() >= app.campaign.data[category + "_capacity"]
			if not definition.is_upgraded:
				text.add_child(Style.wrapped(definition.upgrade_description(), 13, Style.ACCENT))
			row.add_child(button)
			effect_buttons[id] = button
	column.add_child(UI.button("关闭", close_context))
	effects_panel.hide()

func _build_shop() -> void:
	shop_backdrop = ColorRect.new()
	shop_backdrop.color = Color(0.035, 0.085, 0.14, 0.22)
	shop_backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shop_backdrop)
	shop_backdrop.hide()
	shop_panel = PanelContainer.new()
	shop_panel.theme = Style.paper_theme()
	shop_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	shop_panel.offset_left = -380
	shop_panel.offset_right = 380
	shop_panel.offset_top = -240
	shop_panel.offset_bottom = 240
	add_child(shop_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	shop_panel.add_child(box)
	box.add_child(Style.label("今日备用装备", 24))
	for offer in app.campaign.data.shop:
		box.add_child(Style.label(app.campaign.gear.title(offer), 18))
		box.add_child(Style.wrapped(app.campaign.gear.description(offer), 14))
		var buy := UI.button("已售出" if offer.sold else "购买 · %d 废料" % offer.price, func(): app.buy_weapon(offer.uid), Vector2(0, 36))
		buy.name = "Buy_" + offer.uid.replace(":", "_")
		buy.disabled = offer.sold or app.campaign.data.scrap < offer.price
		box.add_child(buy)
	box.add_child(UI.button("关闭", close_context))
	shop_panel.hide()

func _ending(column: VBoxContainer) -> void:
	var game = app.campaign
	column.add_child(UI.label("五日归航" if game.data.status == "won" else "这轮旅程结束了", 30, UI.AMBER))
	column.add_child(UI.label("生还 %d / %d 人" % [game.data.members.size(), game.data.initial_count], 22))
	column.add_child(UI.wrapped("全员走过这五天。" if game.data.members.size() == game.data.initial_count else ("记住没有回来的人。" if game.data.status == "won" else "重新出发，还有另一种选择。"), 18))
	for entry in game.data.history:
		column.add_child(UI.wrapped("第 %d 天 · 归来 %d 人 · 战斗阵亡 %d 人 · 缺粮损失 %d 人 · 带回 %d 食物 / %d 废料" % [entry.day, entry.returned_ids.size(), entry.lost_ids.size(), entry.starved_ids.size(), entry.food, entry.scrap], 15, UI.MUTED))
	column.add_child(UI.label("五日试玩终点 · 后续旅程尚未开放", 14, UI.CYAN))
	column.add_child(UI.button("重新开局", app.new_run))

func _build_debug() -> void:
	debug_panel = PanelContainer.new()
	debug_panel.position = Vector2(200, 90)
	debug_panel.custom_minimum_size = Vector2(560, 0)
	add_child(debug_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	debug_panel.add_child(box)
	box.add_child(UI.label("DEBUG · 跨日状态", 22, UI.CYAN))
	var row := HBoxContainer.new()
	box.add_child(row)
	row.add_child(UI.button("食物 +10", func(): app.debug_change("food", 10)))
	row.add_child(UI.button("食物 −10", func(): app.debug_change("food", -10)))
	row.add_child(UI.button("废料 +30", func(): app.debug_change("scrap", 30)))
	var day := HBoxContainer.new()
	box.add_child(day)
	day.add_child(UI.button("日数 +1", func(): app.debug_change("day", 1)))
	day.add_child(UI.button("日数 −1", func(): app.debug_change("day", -1)))
	day.add_child(UI.button("饥饿 +1", func(): app.debug_change("hunger", 1)))
	day.add_child(UI.button("解除饥饿", func(): app.debug_change("hunger", -100)))
	var kind := OptionButton.new()
	for weapon in app.catalog.weapons:
		kind.add_item(weapon.display_name)
	box.add_child(kind)
	var quality := OptionButton.new()
	for title: String in ["普通 · 0 词条", "精良 · 1 词条", "稀有 · 2 词条", "特殊 · 3 词条"]:
		quality.add_item(title)
	box.add_child(quality)
	box.add_child(UI.button("给予选定武器", func(): app.debug_weapon(app.catalog.weapons[kind.selected].id, "", quality.selected)))
	box.add_child(UI.button("给予全部道具与技能并扩容", func(): app.debug_effects(false)))
	box.add_child(UI.button("升级全部已持有道具与技能", func(): app.debug_effects(true)))
	box.add_child(UI.button("关闭", toggle_debug))
	debug_panel.visible = false
