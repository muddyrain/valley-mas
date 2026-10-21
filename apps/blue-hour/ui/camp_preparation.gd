extends Control
## Read-only Campaign presentation. Main owns every mutation and save transaction.
signal closed
signal operation_requested(action: String, member_id: String, uid: String, expected: Dictionary)
signal effect_requested(category: String, previous: String, replacement: String, expected: Dictionary)

const Art = preload("res://ui/menu_art.gd")
const UI = preload("res://ui/ui_style.gd")
const Confirmation = preload("res://ui/game_confirmation.gd")
var app: Node
var page: String = "inventory"
var member_id: String = ""
var member_select: OptionButton
var close_button: Button
var training_button: Button
var confirmation: Control
var action_buttons: Dictionary = {}
var tabs: Dictionary = {}
var panel: PanelContainer
var balance: Label
var content: VBoxContainer
var _refreshing: bool = false

func setup(owner_app: Node, selected: String = "", selected_page: String = "inventory") -> void:
	app = owner_app
	member_id = selected
	page = selected_page
	name = "CampPreparation"
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	mouse_filter = MOUSE_FILTER_STOP
	z_index = 900
	theme = Art.theme()
	var shade := ColorRect.new()
	shade.color = Color(0.015, 0.03, 0.055, 0.76)
	shade.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	add_child(shade)
	panel = PanelContainer.new()
	panel.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	panel.anchor_left = 0.07
	panel.anchor_top = 0.08
	panel.anchor_right = 0.93
	panel.anchor_bottom = 0.92
	panel.add_theme_stylebox_override("panel", Art.dialog_paper())
	add_child(panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	panel.add_child(column)
	var heading := HBoxContainer.new()
	column.add_child(heading)
	var title := _label("营地整备  /  PREPARATION", 30)
	title.size_flags_horizontal = SIZE_EXPAND_FILL
	heading.add_child(title)
	close_button = _button("返回营地", func() -> void: closed.emit())
	heading.add_child(close_button)
	balance = _label("", 22)
	column.add_child(balance)
	var tab_bar := HBoxContainer.new()
	column.add_child(tab_bar)
	for key: String in ["inventory", "shop", "training", "powers"]:
		var names := {"inventory": "库存与装备", "shop": "今日备用装备", "training": "食物训练", "powers": "外勤能力"}
		var tab := _button(names[key], show_page.bind(key))
		tab.size_flags_horizontal = SIZE_EXPAND_FILL
		tabs[key] = tab
		tab_bar.add_child(tab)
	member_select = OptionButton.new()
	member_select.custom_minimum_size.y = 48
	member_select.add_theme_font_size_override("font_size", 22)
	member_select.item_selected.connect(_select_member)
	column.add_child(member_select)
	var scroll := ScrollContainer.new()
	scroll.follow_focus = true
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = SIZE_EXPAND_FILL
	column.add_child(scroll)
	content = VBoxContainer.new()
	content.size_flags_horizontal = SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 12)
	scroll.add_child(content)
	refresh()
	close_button.grab_focus.call_deferred()

func _label(value: String, font_size: int = 20) -> Label:
	return UI.label(value, font_size, Art.INK)

func _button(value: String, action: Callable) -> Button:
	var button := Art.button(value, action)
	button.custom_minimum_size = Vector2(150, 48)
	button.add_theme_font_size_override("font_size", 20)
	for state: String in ["normal", "hover", "pressed"]:
		var style: StyleBox = button.get_theme_stylebox(state).duplicate()
		style.content_margin_top = 8
		style.content_margin_bottom = 8
		button.add_theme_stylebox_override(state, style)
	return button

func show_page(value: String) -> void:
	if is_instance_valid(confirmation):
		return
	page = value
	refresh()

func _select_member(index: int) -> void:
	if _refreshing:
		return
	member_id = str(member_select.get_item_metadata(index))
	refresh()

func refresh() -> void:
	_refreshing = true
	var state: Dictionary = app.campaign.data
	if member_id not in state.members:
		member_id = str(state.members.front()) if not state.members.is_empty() else ""
	balance.text = "第 %d 天     食物 %d · 今晚需 %d     废料 %d" % [state.day, state.food, state.members.size() * app.catalog.loop.food_per_member, state.scrap]
	member_select.clear()
	for id: String in state.members:
		member_select.add_item("%s · Lv.%d" % [app.member_name(id), app.campaign.member_level(id)])
		var index: int = member_select.item_count - 1
		member_select.set_item_metadata(index, id)
		if id == member_id:
			member_select.select(index)
	member_select.visible = page in ["inventory", "training"]
	for child: Node in content.get_children():
		content.remove_child(child)
		child.queue_free()
	action_buttons.clear()
	training_button = null
	for key: String in tabs:
		tabs[key].disabled = key == page
	match page:
		"inventory": _inventory()
		"shop": _shop()
		"training": _training()
		"powers": _powers()
	_refreshing = false

func _row(text: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	row.custom_minimum_size.y = 68
	content.add_child(row)
	var label := _label(text)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = SIZE_EXPAND_FILL
	row.add_child(label)
	return row

func _inventory() -> void:
	for item: Dictionary in app.campaign.data.inventory:
		var uid: String = item.uid
		var holder: String = ""
		for id: String in app.campaign.data.equipment:
			if app.campaign.data.equipment[id] == uid:
				holder = id
		var text: String = "%s\n%s\n%s" % [app.campaign.gear.title(item), app.campaign.gear.description(item), "库存中" if holder.is_empty() else "已装备 · " + app.member_name(holder)]
		var row := _row(text)
		var action: String = "unequip" if holder == member_id else "equip"
		var caption: String = "卸下武器" if action == "unequip" else ("转交给 " if not holder.is_empty() else "装备给 ") + app.member_name(member_id)
		var button := _button(caption, request_operation.bind(action, member_id, uid))
		button.disabled = member_id.is_empty()
		button.tooltip_text = uid
		row.add_child(button)
		action_buttons[uid] = button
	if app.campaign.data.inventory.is_empty():
		content.add_child(_label("暂无库存武器"))

func _shop() -> void:
	for offer: Dictionary in app.campaign.data.shop:
		var row := _row("%s\n%s\n%d 废料" % [app.campaign.gear.title(offer), app.campaign.gear.description(offer), offer.price])
		var button := _button("已购入" if offer.sold else "购买", request_operation.bind("buy", "", offer.uid))
		button.disabled = offer.sold or app.campaign.data.scrap < offer.price
		row.add_child(button)
		action_buttons[offer.uid] = button

func _training() -> void:
	if member_id.is_empty():
		content.add_child(_label("没有可训练的成员"))
		return
	var cost: int = app.campaign.training_cost(member_id)
	var definition: Resource = app.campaign.member_template(member_id)
	var portrait := TextureRect.new()
	portrait.texture = load(definition.portrait_path)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait.custom_minimum_size = Vector2(130, 130)
	content.add_child(portrait)
	content.add_child(_label("%s · Lv.%d\n%s" % [app.member_name(member_id), app.campaign.member_level(member_id), app.campaign.member_trait(member_id).summary()], 24))
	content.add_child(_label("已达到训练上限" if cost < 0 else "消耗 %d 食物 · 训练后 Lv.%d" % [cost, app.campaign.member_level(member_id) + 1]))
	training_button = _button("训练", request_operation.bind("train", member_id, ""))
	training_button.disabled = cost < 0 or app.campaign.data.food < cost
	content.add_child(training_button)

func _powers() -> void:
	for category: String in ["passive", "power"]:
		var slots: Array = app.campaign.data[category + "_slots"]
		for id: String in app.campaign.data[category + "_items"]:
			var definition: Resource = app.campaign.effect_definition(category, id)
			var extra: String = "被动道具" if category == "passive" else "外勤中施放 · 冷却 %.0f 秒" % definition.cooldown_duration()
			var row := _row("%s · %s · %s\n%s" % [definition.display_name, extra, "已装备" if id in slots else "库存中", definition.description()])
			var equipped: bool = id in slots
			var button := _button("卸下" if equipped else "装备", _request_effect.bind(category, id if equipped else "", "" if equipped else id))
			if not equipped and slots.size() >= int(app.campaign.data[category + "_capacity"]):
				var choices := OptionButton.new()
				choices.add_item("选择替换槽位")
				for previous: String in slots:
					choices.add_item(app.campaign.effect_definition(category, previous).display_name)
					choices.set_item_metadata(choices.item_count - 1, previous)
				button.disabled = true
				button.text = "替换"
				for connection: Dictionary in button.pressed.get_connections():
					button.pressed.disconnect(connection.callable)
				button.pressed.connect(func() -> void: _request_effect(category, str(choices.get_item_metadata(choices.selected)), id))
				choices.item_selected.connect(func(index: int) -> void: button.disabled = index == 0)
				row.add_child(choices)
			row.add_child(button)
			action_buttons[category + ":" + id] = button
	content.add_child(_label("道具与能力升级、槽位扩容：暂未开放", 18))

func _request_effect(category: String, previous: String, replacement: String) -> void:
	if is_instance_valid(confirmation):
		return
	var expected: Dictionary = app.campaign.data.duplicate(true)
	confirmation = Confirmation.new()
	add_child(confirmation)
	confirmation.setup("确认配装", "更改本轮已持有的外勤配装。", "确认", "取消")
	confirmation.confirmed.connect(func() -> void:
		confirmation = null
		effect_requested.emit(category, previous, replacement, expected))
	confirmation.cancelled.connect(func() -> void: confirmation = null)

func request_operation(action: String, target: String, uid: String) -> void:
	if is_instance_valid(confirmation):
		return
	var expected: Dictionary = app.campaign.data.duplicate(true)
	var message: String
	match action:
		"train": message = "%s：消耗 %d 食物训练。" % [app.member_name(target), app.campaign.training_cost(target)]
		"buy": message = "购买此件备用装备？"
		"unequip": message = "卸下 %s 的武器，保留在库存。" % app.member_name(target)
		_: message = "将此件武器交给 %s。原持有人将解除装备。" % app.member_name(target)
	confirmation = Confirmation.new()
	add_child(confirmation)
	confirmation.setup("确认整备", message, "确认", "取消")
	confirmation.name = "PreparationConfirmation"
	confirmation.confirmed.connect(func() -> void:
		confirmation = null
		operation_requested.emit(action, target, uid, expected))
	confirmation.cancelled.connect(func() -> void: confirmation = null)

func cancel_or_close() -> void:
	if is_instance_valid(confirmation):
		confirmation.call("_cancel")
	else:
		closed.emit()
