extends PanelContainer
signal toggled
const UI = preload("res://ui/ui_style.gd")
var mission: Node3D
var speed: float = 1.0

func setup(target: Node3D) -> void:
	mission = target
	theme = UI.theme()
	position = Vector2(468, 142)
	custom_minimum_size = Vector2(504, 590)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	add_child(column)
	column.add_child(UI.label("DEBUG MENU", 23, UI.CYAN))
	column.add_child(UI.label("调试中 · 行动暂停", 14, UI.MUTED))
	var phases := HBoxContainer.new()
	column.add_child(phases)
	for index in range(3):
		phases.add_child(UI.button(["Day", "BLUE HOUR", "Night"][index], func(): mission.clock.set_phase(index), Vector2(145, 40)))
	var resources := HBoxContainer.new()
	column.add_child(resources)
	resources.add_child(UI.button("+10 食物", func(): mission.ledger.add_loot(10, 0), Vector2(145, 40)))
	resources.add_child(UI.button("−10 食物", func(): mission.ledger.add_loot(-10, 0), Vector2(145, 40)))
	resources.add_child(UI.button("+20 废料", func(): mission.ledger.add_loot(0, 20), Vector2(145, 40)))
	column.add_child(UI.label("生成敌人", 16, UI.AMBER))
	var enemy_row := HBoxContainer.new()
	column.add_child(enemy_row)
	for enemy in mission.catalog.enemies:
		enemy_row.add_child(UI.button(enemy.display_name, func(): mission.spawn_enemy(enemy.id, mission.squad_center() + Vector3(0, 0, -9)), Vector2(109, 40)))
	column.add_child(UI.button("清除敌人", mission.debug_clear_enemies))
	column.add_child(UI.label("给予武器", 16, UI.AMBER))
	var member_select := OptionButton.new()
	for survivor in mission.survivors:
		member_select.add_item(survivor.data.display_name)
	column.add_child(member_select)
	var weapon_select := OptionButton.new()
	for weapon in mission.catalog.weapons:
		weapon_select.add_item(weapon.display_name)
	column.add_child(weapon_select)
	column.add_child(UI.button("给予选定武器", func():
		mission.debug_equip(member_select.selected, mission.catalog.weapons[weapon_select.selected])
	))
	var invincible := CheckButton.new()
	invincible.text = "全队无敌"
	invincible.toggled.connect(func(value: bool): mission.invincible = value)
	column.add_child(invincible)
	var speed_select := OptionButton.new()
	for value in [1, 2, 4]:
		speed_select.add_item("时间 ×%d" % value)
	speed_select.item_selected.connect(func(index: int): speed = [1.0, 2.0, 4.0][index])
	column.add_child(speed_select)
	column.add_child(UI.button("返回行动  [F1]", toggle))
	visible = false

func toggle() -> void:
	if not mission.active:
		return
	visible = not visible
	mission.time_scale = 0.0 if visible else speed
	toggled.emit()
