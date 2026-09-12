extends Control
const UI = preload("res://ui/ui_style.gd")
const Modifiers = preload("res://weapons/weapon_modifiers.gd")
var app: Node
var details: VBoxContainer
var entries: Dictionary = {}
var selected_definition: Resource
var inventory_mode := false

func setup(owner_app: Node) -> void:
	app = owner_app
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var backdrop := ColorRect.new()
	backdrop.color = Color(0, 0, 0, 0.7)
	backdrop.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	add_child(backdrop)
	var panel := PanelContainer.new()
	add_child(panel)
	panel.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	panel.offset_left = 40
	panel.offset_right = -40
	panel.offset_top = 35
	panel.offset_bottom = -35
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	panel.add_child(column)
	var heading := HBoxContainer.new()
	column.add_child(heading)
	var title := UI.label("武器", 26, UI.AMBER)
	title.size_flags_horizontal = SIZE_EXPAND_FILL
	heading.add_child(title)
	heading.add_child(UI.button("图鉴", func(): _show_list(false), Vector2(100, 40)))
	heading.add_child(UI.button("武器库存", func(): _show_list(true), Vector2(120, 40)))
	heading.add_child(UI.button("关闭", queue_free, Vector2(90, 40)))
	var columns := HBoxContainer.new()
	columns.name = "Columns"
	columns.add_theme_constant_override("separation", 22)
	columns.size_flags_vertical = SIZE_EXPAND_FILL
	column.add_child(columns)
	var scroll := ScrollContainer.new()
	scroll.name = "ListScroll"
	scroll.custom_minimum_size.x = 290
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	columns.add_child(scroll)
	var list := VBoxContainer.new()
	list.name = "WeaponList"
	list.size_flags_horizontal = SIZE_EXPAND_FILL
	scroll.add_child(list)
	var detail_scroll := ScrollContainer.new()
	detail_scroll.size_flags_horizontal = SIZE_EXPAND_FILL
	detail_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	columns.add_child(detail_scroll)
	details = VBoxContainer.new()
	details.size_flags_horizontal = SIZE_EXPAND_FILL
	details.add_theme_constant_override("separation", 9)
	detail_scroll.add_child(details)
	_show_list(false)

func _show_list(owned: bool) -> void:
	inventory_mode = owned
	var list: VBoxContainer = find_child("WeaponList", true, false)
	for child: Node in list.get_children():
		list.remove_child(child)
		child.queue_free()
	entries.clear()
	if owned:
		for instance: WeaponInstance in app.campaign.weapon_inventory.get_all_weapons():
			var definition: Resource = app.campaign.gear.resource(instance.to_dict())
			_entry(list, definition, instance.to_dict())
		if list.get_child_count() == 0:
			list.add_child(UI.label("暂无武器"))
			_show_details(null)
		else:
			_show_details(app.campaign.weapon(app.campaign.data.inventory[0].uid), app.campaign.data.inventory[0])
	else:
		for definition: Resource in app.catalog.weapons:
			_entry(list, definition)
		_show_details(app.catalog.weapons[0])

func _entry(list: VBoxContainer, definition: Resource, item: Dictionary = {}) -> void:
	var button := UI.button(definition.display_name, func(): _show_details(definition, item), Vector2(280, 60))
	button.icon = definition.icon()
	button.expand_icon = true
	button.add_theme_constant_override("icon_max_width", 52)
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	button.add_theme_font_size_override("font_size", 15)
	button.add_theme_stylebox_override("normal", UI.panel(UI.PANEL, Modifiers.RARITY_COLORS[definition.rarity]))
	list.add_child(button)
	entries[item.get("uid", definition.id)] = button

func _show_details(definition: Resource, item: Dictionary = {}) -> void:
	selected_definition = definition
	for child: Node in details.get_children():
		details.remove_child(child)
		child.queue_free()
	if definition == null:
		return
	var icon := TextureRect.new()
	icon.name = "WeaponIcon"
	icon.texture = definition.icon()
	icon.custom_minimum_size = Vector2(200, 200)
	icon.size_flags_horizontal = SIZE_SHRINK_BEGIN
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	details.add_child(icon)
	details.add_child(UI.label(definition.display_name, 24))
	details.add_child(UI.label(definition.type_name() + " · " + Modifiers.RARITY_NAMES[definition.rarity], 17, Modifiers.RARITY_COLORS[definition.rarity]))
	details.add_child(UI.wrapped(definition.description, 16))
	var stats := "伤害  %.1f%s\n攻击速度  %.2f 次/秒\n射程  %.2f m" % [definition.damage, " / 弹丸" if definition.pellet_count > 1 else "", definition.attack_rate, definition.range]
	if not definition.melee:
		stats += "\n弹匣  %d\n换弹时间  %.2f 秒\n精准度  %s" % [definition.magazine_size, definition.reload_time, "散射 · %.1f°" % definition.spread_angle if definition.pellet_count > 1 else "%.0f%%" % (definition.accuracy * 100)]
	if definition.move_speed_modifier != 0:
		stats += "\n移动速度  %+.0f%%" % (definition.move_speed_modifier * 100)
	var label := UI.wrapped(stats, 17)
	label.name = "WeaponStats"
	details.add_child(label)
	for id: String in item.get("modifiers", []):
		details.add_child(UI.label(Modifiers.RULES[id].label, 16, UI.CYAN))
	if not str(item.get("affix", "")).is_empty():
		details.add_child(UI.wrapped(app.catalog.by_id(app.catalog.affixes, item.affix).description, 16, UI.CYAN))
	if item.is_empty():
		return
	var holder := ""
	for member: String in app.campaign.data.equipment:
		if app.campaign.data.equipment[member] == item.uid:
			holder = member
	details.add_child(UI.label("库存中" if holder.is_empty() else "已装备 · " + app.member_name(holder), 16, UI.AMBER))
	var selected: String = app.selected_member
	if holder == selected:
		details.add_child(UI.button("卸下武器", func(): app.unequip_member(selected)))
	else:
		var text: String = ("转交给 " if not holder.is_empty() else "装备给 ") + app.member_name(selected)
		details.add_child(UI.button(text, func(): app.equip_member(selected, item.uid)))
