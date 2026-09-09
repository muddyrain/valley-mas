extends Control
const UI = preload("res://ui/ui_style.gd")
const ShelterView = preload("res://ui/shelter_view.gd")
var app: Node
var debug_panel: PanelContainer
var weapon_selects: Array[OptionButton] = []
var departure: Button
var view: SubViewportContainer
var training_button: Button
var member_buttons: Dictionary = {}
var shop_panel: PanelContainer
var shop_backdrop: ColorRect

func setup(owner_app: Node) -> void:
	app = owner_app
	var game = app.campaign
	var column := UI.page(self)
	column.add_child(UI.label("东岸安全屋", 30))
	column.add_child(UI.label("第 %d / %d 天    食物 %d · 今日需 %d    废料 %d" % [game.data.day, app.catalog.loop.end_day, game.data.food, game.data.members.size() * app.catalog.loop.food_per_member, game.data.scrap], 19, UI.AMBER))
	if game.data.status in ["won", "lost"]:
		_ending(column)
		return
	column.add_child(UI.wrapped("饥饿 · 出勤生命上限 %d%% · 已连续缺粮 %d 天" % [app.catalog.loop.hunger_health_multiplier * 100, game.data.hunger] if game.data.hunger > 0 else "已休整 · 准备出发", 14, UI.MUTED))
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 20)
	column.add_child(columns)
	var scene_column := VBoxContainer.new()
	scene_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	columns.add_child(scene_column)
	view = ShelterView.new()
	scene_column.add_child(view)
	view.setup(game)
	view.member_selected.connect(app.select_member)
	var selected: String = app.selected_member if app.selected_member in game.data.members else game.data.members[0]
	app.selected_member = selected
	view.select(selected)
	for entry in game.data.passive_slots + game.data.power_slots:
		var passive: bool = entry in game.data.passive_slots
		var effect: Resource = app.catalog.by_id(app.catalog.passives if passive else app.catalog.powers, entry)
		scene_column.add_child(UI.label(("被动 · " if passive else "特殊能力 · ") + effect.display_name, 17, UI.CYAN))
		scene_column.add_child(UI.wrapped(effect.description() + ("" if passive else " · 每日一次"), 14, UI.MUTED))
	var roster := VBoxContainer.new()
	roster.custom_minimum_size.x = 350
	roster.add_theme_constant_override("separation", 12)
	columns.add_child(roster)
	roster.add_child(UI.label("外勤小队", 18, UI.AMBER))
	var row := HBoxContainer.new()
	roster.add_child(row)
	for id in game.data.members:
		var member_button := UI.button(app.member_name(id), func(): app.select_member(id), Vector2(0, 42))
		member_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if id == selected:
			member_button.add_theme_stylebox_override("normal", UI.panel(Color("#294453"), UI.CYAN))
		row.add_child(member_button)
		member_buttons[id] = member_button
	var spec: Resource = game.member_template(selected)
	var talent: Resource = game.member_trait(selected)
	roster.add_child(UI.label("%s · %d 级" % [spec.display_name, game.member_level(selected)], 26, spec.color.lightened(0.3)))
	roster.add_child(UI.label(talent.display_name, 19, UI.CYAN))
	roster.add_child(UI.wrapped(talent.summary(), 16))
	roster.add_child(UI.label("生命上限 %.0f" % (spec.max_hp * game.health_multiplier()), 15, UI.MUTED))
	var select := OptionButton.new()
	select.custom_minimum_size.y = 40
	select.fit_to_longest_item = false
	for i in range(game.data.inventory.size()):
		var item: Dictionary = game.data.inventory[i]
		var holder := ""
		for member in game.data.equipment:
			if game.data.equipment[member] == item.uid:
				holder = " · " + app.member_name(member)
		select.add_item("%d. %s%s" % [i + 1, game.gear.title(item), holder])
		select.set_item_metadata(i, item.uid)
		if item.uid == game.data.equipment[selected]:
			select.selected = i
	select.item_selected.connect(func(index: int): app.equip_member(selected, select.get_item_metadata(index)))
	roster.add_child(select)
	weapon_selects.append(select)
	var equipped: Resource = game.weapon(game.data.equipment[selected])
	roster.add_child(UI.wrapped(game.gear.description(game.item(game.data.equipment[selected])), 14, UI.MUTED))
	roster.add_child(UI.label("伤害 %.1f · 含特质与被动" % (equipped.damage * game.member_trait(selected, equipped).damage_multiplier), 16))
	var cost: int = game.training_cost(selected)
	if cost >= 0:
		var next: Resource = app.catalog.by_id(app.catalog.traits, spec.trait_id).at_level(game.member_level(selected) + 1)
		roster.add_child(UI.wrapped("下一级 · " + next.summary(), 15, UI.CYAN))
		roster.add_child(UI.label("升级后食物 %d · 今日口粮 %d" % [maxi(0, game.data.food - cost), game.data.members.size() * app.catalog.loop.food_per_member], 14, UI.MUTED))
	training_button = UI.button("已达等级上限" if cost < 0 else "升级成员 · %d 食物" % cost, func(): app.train_member(selected))
	training_button.disabled = cost < 0 or game.data.food < cost
	roster.add_child(training_button)
	column.add_child(UI.wrapped(app.status_message, 14, UI.CYAN))
	var actions := UI.footer(self)
	departure = UI.button("整装出发", app.start_mission, Vector2(0, 48))
	departure.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_child(departure)
	actions.add_child(UI.button("备用装备", func(): shop_backdrop.show(); shop_panel.show(), Vector2(140, 48)))
	actions.add_child(UI.button("主菜单", app.show_main_menu, Vector2(115, 48)))
	actions.add_child(UI.button("调试 [F1]", toggle_debug, Vector2(125, 48)))
	_build_shop()
	_build_debug()

func _build_shop() -> void:
	shop_backdrop = ColorRect.new()
	shop_backdrop.color = Color(0, 0, 0, 0.65)
	shop_backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shop_backdrop)
	shop_backdrop.hide()
	shop_panel = PanelContainer.new()
	shop_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	shop_panel.offset_left = -380
	shop_panel.offset_right = 380
	shop_panel.offset_top = -240
	shop_panel.offset_bottom = 240
	add_child(shop_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	shop_panel.add_child(box)
	box.add_child(UI.label("今日备用装备", 24, UI.AMBER))
	for offer in app.campaign.data.shop:
		box.add_child(UI.label(app.campaign.gear.title(offer), 18))
		box.add_child(UI.wrapped(app.campaign.gear.description(offer), 14, UI.MUTED))
		var buy := UI.button("已售出" if offer.sold else "购买 · %d 废料" % offer.price, func(): app.buy_weapon(offer.uid), Vector2(0, 36))
		buy.name = "Buy_" + offer.uid.replace(":", "_")
		buy.disabled = offer.sold or app.campaign.data.scrap < offer.price
		box.add_child(buy)
	box.add_child(UI.button("关闭", func(): shop_panel.hide(); shop_backdrop.hide()))
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
	var affix := OptionButton.new()
	affix.add_item("基础武器")
	for value in app.catalog.affixes:
		affix.add_item(value.display_name + " · " + value.description)
	box.add_child(affix)
	box.add_child(UI.button("给予选定差异武器", func(): app.debug_weapon(app.catalog.weapons[kind.selected].id, "" if affix.selected == 0 else app.catalog.affixes[affix.selected - 1].id)))
	box.add_child(UI.button("关闭", toggle_debug))
	debug_panel.visible = false

func toggle_debug() -> void:
	if debug_panel != null:
		debug_panel.visible = not debug_panel.visible
