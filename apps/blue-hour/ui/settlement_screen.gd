extends Control
const UI = preload("res://ui/ui_style.gd")
var app: Node
var food_choices: Dictionary = {}
var consequence: Label
var confirm_button: Button

func setup(owner_app: Node) -> void:
	app = owner_app
	var game = app.campaign
	var result: Dictionary = game.data.pending
	var view: Dictionary = game.preview()
	var column := UI.page(self)
	column.add_child(UI.label("第 %d 天 · %s" % [game.data.day, "行动失败" if result.wiped else ("全员归航" if result.lost_ids.is_empty() else "归航 · 有人未能回来")], 30, UI.AMBER))
	column.add_child(UI.label("返回 %d / %d 人 · 行动 %02d:%02d · 击退 %d" % [result.returned_ids.size(), game.data.selected_party.size(), int(result.seconds) / 60, int(result.seconds) % 60, result.kills], 18))
	column.add_child(UI.wrapped("归来：" + app.member_names(result.returned_ids), 18))
	var stayed: Array = game.data.members.filter(func(id: String) -> bool: return id not in game.data.selected_party)
	if not stayed.is_empty():
		column.add_child(UI.wrapped("留守营地：" + app.member_names(stayed), 17, UI.CYAN))
	if not result.lost_ids.is_empty():
		column.add_child(UI.wrapped("战斗阵亡：" + app.member_names(result.lost_ids) + "\n其随身武器遗失。", 17, Color("#f39193")))
	column.add_child(HSeparator.new())
	column.add_child(UI.label("带回 %d 食物 / %d 废料 / %d 件装备" % [result.food, result.scrap, result.weapons.size()], 23, UI.AMBER))
	for value in result.weapons:
		column.add_child(UI.wrapped(game.gear.title(value) + " · " + game.gear.description(value), 15, UI.CYAN))
	if result.wiped:
		column.add_child(UI.label("携带收获全部遗失。", 16, UI.MUTED))
	else:
		column.add_child(UI.label("可用食物 %d · 今晚需要 %d · 结算后余粮 %d" % [view.total, view.need, view.remaining], 18))
	consequence = UI.wrapped("", 17, UI.AMBER)
	column.add_child(consequence)
	if view.fatal:
		column.add_child(UI.wrapped("已连续缺粮。选择优先供养 %d 人；未分到口粮的成员将在确认后死亡。" % view.slots, 17, Color("#f39193")))
		for id in view.members:
			var choice := CheckBox.new()
			choice.text = app.member_name(id)
			choice.custom_minimum_size.y = 40
			choice.disabled = view.slots == 0
			food_choices[id] = choice
			choice.toggled.connect(func(_on: bool): _refresh())
			column.add_child(choice)
	confirm_button = UI.button("确认结算", func(): app.return_to_shelter(selected_fed()), Vector2(0, 50))
	confirm_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	UI.footer(self).add_child(confirm_button)
	column.add_child(UI.wrapped("确认后进入下一日；已返回的结果会自动保存。", 13, UI.MUTED))
	_refresh()

func selected_fed() -> Array:
	var selected: Array = []
	for id in food_choices:
		if food_choices[id].button_pressed:
			selected.append(id)
	return selected

func _refresh() -> void:
	var view: Dictionary = app.campaign.preview()
	if view.fatal:
		var selected := selected_fed()
		var lost: Array = []
		for id in view.members:
			if id not in selected:
				lost.append(id)
		confirm_button.disabled = selected.size() != view.slots
		consequence.text = "已供养 %d / %d 人\n将因缺粮失去：%s" % [selected.size(), view.slots, app.member_names(lost)]
	else:
		consequence.text = "首次缺粮 · 有一天补粮机会\n次日生命上限为正常的 %d%%；再次缺粮将损失成员。" % [app.catalog.loop.hunger_health_multiplier * 100] if view.shortage else "口粮充足 · 生还成员休整至满血"
		if app.campaign.data.pending.wiped and view.members.is_empty():
			consequence.text = "没有人回来，这轮生存结束了。"
