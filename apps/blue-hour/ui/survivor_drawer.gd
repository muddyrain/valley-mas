extends PanelContainer
signal closed
const UI = preload("res://ui/ui_style.gd")
const Style = preload("res://ui/camp_style.gd")
var app: Node
var weapon_selects: Array[OptionButton] = []
var training_button: Button
var roster: VBoxContainer
var scroll: ScrollContainer
var close_button: Button
var effects_toggle: Button

func setup(owner_app: Node, selected: String) -> void:
	app = owner_app
	name = "SurvivorDrawer"
	theme = Style.paper_theme()
	set_anchors_and_offsets_preset(Control.PRESET_RIGHT_WIDE)
	offset_left = -628
	offset_right = -226
	offset_top = 106
	offset_bottom = -100
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 12)
	add_child(layout)
	var heading := HBoxContainer.new()
	layout.add_child(heading)
	var title := Style.label("幸存者档案", 14, Style.MUTED)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(title)
	close_button = Style.button("关闭", func(): closed.emit(), Vector2(62, 32))
	heading.add_child(close_button)
	scroll = ScrollContainer.new()
	scroll.name = "SurvivorDetailsScroll"
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	# Reserve the gutter even while hidden so expanding bonuses never reflows the card.
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_RESERVE
	scroll.follow_focus = true
	scroll.get_v_scroll_bar().focus_mode = Control.FOCUS_ALL
	layout.add_child(scroll)
	roster = VBoxContainer.new()
	roster.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	roster.add_theme_constant_override("separation", 6)
	scroll.add_child(roster)
	var game: RefCounted = app.campaign
	var spec: Resource = game.member_template(selected)
	var talent: Resource = game.member_trait(selected)
	var identity := HBoxContainer.new()
	identity.add_theme_constant_override("separation", 16)
	roster.add_child(identity)
	identity.add_child(Style.portrait(spec, Vector2(68, 76)))
	var bio := VBoxContainer.new()
	identity.add_child(bio)
	bio.add_child(Style.label(spec.display_name, 28))
	bio.add_child(Style.label("Lv.%d  /  %s" % [game.member_level(selected), spec.profession_name if not spec.profession_name.is_empty() else "幸存者"], 14, Style.MUTED))
	bio.add_child(Style.label("生命  %.0f / %.0f" % [spec.max_hp * game.health_multiplier(), spec.max_hp * game.health_multiplier()], 15, Style.ACCENT))
	roster.add_child(HSeparator.new())
	roster.add_child(Style.label(talent.display_name, 18, Style.ACCENT))
	roster.add_child(Style.wrapped(talent.summary(), 15))
	roster.add_child(HSeparator.new())
	var equipped: Resource = game.weapon(game.data.equipment[selected])
	if equipped != null:
		var weapon_row := HBoxContainer.new()
		weapon_row.add_theme_constant_override("separation", 12)
		roster.add_child(weapon_row)
		weapon_row.add_child(Style.icon(equipped.icon(), Vector2(76, 66)))
		var weapon_info := VBoxContainer.new()
		weapon_row.add_child(weapon_info)
		weapon_info.add_child(Style.label(equipped.display_name, 18))
		weapon_info.add_child(Style.label("%.1f  伤害" % game.passive_modifiers().outgoing_damage(equipped.damage * talent.damage_multiplier, equipped.melee), 28))
		_stat(roster, "攻击频率", "%.2f 次 / 秒" % (1.0 / game.passive_modifiers().attack_interval(equipped.cooldown, equipped.melee)))
		_stat(roster, "射程", "%.1f 米" % equipped.range)
		_stat(roster, "弹匣 / 换弹", "近战" if equipped.melee else "%d 发 / %.1f 秒" % [equipped.magazine_size, equipped.reload_time])
	else:
		roster.add_child(Style.label("未装备武器", 19))
	roster.add_child(Style.label("更换武器", 13, Style.MUTED))
	var equipment_row := HBoxContainer.new()
	equipment_row.add_theme_constant_override("separation", 8)
	roster.add_child(equipment_row)
	var select := OptionButton.new()
	select.custom_minimum_size.y = 40
	select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	select.clip_text = true
	select.fit_to_longest_item = false
	select.add_item("未装备")
	select.set_item_metadata(0, "")
	for i in range(game.data.inventory.size()):
		var item: Dictionary = game.data.inventory[i]
		var holder := ""
		for member in game.data.equipment:
			if game.data.equipment[member] == item.uid:
				holder = " · " + app.member_name(member)
		select.add_item("%d. %s%s" % [i + 1, game.gear.title(item), holder])
		select.set_item_metadata(i + 1, item.uid)
		if item.uid == game.data.equipment[selected]:
			select.selected = i + 1
	select.item_selected.connect(func(index: int):
		if index == 0:
			app.unequip_member(selected)
		else:
			app.equip_member(selected, select.get_item_metadata(index)))
	equipment_row.add_child(select)
	weapon_selects.append(select)
	if equipped != null:
		equipment_row.add_child(Style.button("卸下武器", func(): app.unequip_member(selected), Vector2(82, 40)))
	var cost: int = game.training_cost(selected)
	var footer := VBoxContainer.new()
	footer.add_theme_constant_override("separation", 8)
	layout.add_child(footer)
	footer.add_child(HSeparator.new())
	if cost >= 0:
		var next: Resource = app.catalog.by_id(app.catalog.traits, spec.trait_id).at_level(game.member_level(selected) + 1)
		footer.add_child(Style.wrapped("下一级 · " + next.summary(), 15, Style.ACCENT))
		footer.add_child(Style.label("升级后食物 %d · 今日口粮 %d" % [maxi(0, game.data.food - cost), game.data.members.size() * app.catalog.loop.food_per_member], 13, Style.MUTED))
	training_button = UI.button("已达等级上限" if cost < 0 else "升级成员 · %d 食物" % cost, func(): app.train_member(selected))
	training_button.disabled = cost < 0 or game.data.food < cost
	footer.add_child(training_button)
	var effects := VBoxContainer.new()
	effects.add_theme_constant_override("separation", 8)
	var effect_count := 0
	for category: String in ["passive", "power"]:
		for effect: Resource in game.equipped_effects(category):
			effect_count += 1
			effects.add_child(Style.wrapped(effect.display_name + " · " + effect.description(), 13))
	effects.add_child(Style.button("查看道具与技能", app.camp_ui.show_effects))
	effects_toggle = Style.button("队伍加成 · %d  ▾" % effect_count, func():
		effects.visible = not effects.visible
		effects_toggle.text = "队伍加成 · %d  %s" % [effect_count, "▴" if effects.visible else "▾"], Vector2(0, 34))
	effects_toggle.alignment = HORIZONTAL_ALIGNMENT_LEFT
	roster.add_child(effects_toggle)
	roster.add_child(effects)
	effects.hide()
	modulate.a = 0.65
	create_tween().tween_property(self, "modulate:a", 1.0, 0.12)

func _stat(parent: VBoxContainer, title: String, value: String) -> void:
	var row := HBoxContainer.new()
	parent.add_child(row)
	var label := Style.label(title, 14, Style.MUTED)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(label)
	row.add_child(Style.label(value, 15))
