extends Control
signal quit_requested
const UI = preload("res://ui/ui_style.gd")
const DebugMenu = preload("res://debug/debug_menu.gd")
var mission: Node3D
var phase_label: Label
var clock_label: Label
var resource_label: Label
var squad_labels: Array[Label] = []
var assign_buttons: Array[Button] = []
var task_label: Label
var recall_button: Button
var squad_heading: Label
var site_buttons: Dictionary = {}
var order_label: Label
var toast: Label
var toast_left: float = 0.0
var objective: Label
var debug_menu: PanelContainer
var refresh_left: float = 0.0
var extract_button: Button
var paused: bool = false
var pause_button: Button
var pause_menu: PanelContainer
var rally_button: Button
var menu_backdrop: ColorRect
var power_button: Button

func setup(target: Node3D) -> void:
	mission = target
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme = UI.theme()
	var top := UI.margin(self, Rect2(22, 18, 1396, 84))
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	top.offset_left = 22
	top.offset_right = -22
	top.offset_top = 18
	top.offset_bottom = 102
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 30)
	top.add_child(row)
	var brand := VBoxContainer.new()
	row.add_child(brand)
	brand.add_child(UI.label("蓝时归航", 24))
	brand.add_child(UI.label("BLUE HOUR: HOMEWARD", 11, UI.MUTED))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)
	phase_label = UI.label("DAY", 26, UI.AMBER)
	row.add_child(phase_label)
	clock_label = UI.label("", 16)
	row.add_child(clock_label)
	var spacer2 := Control.new()
	spacer2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer2)
	resource_label = UI.label("", 16, UI.AMBER)
	row.add_child(resource_label)
	pause_button = UI.button("暂停", toggle_pause, Vector2(65, 42))
	row.add_child(pause_button)
	row.add_child(UI.button("F1", toggle_debug, Vector2(48, 42)))
	var squad_panel := UI.margin(self, Rect2(22, 121, 264, 466))
	var squad := VBoxContainer.new()
	squad.add_theme_constant_override("separation", 10)
	squad_panel.add_child(squad)
	squad_heading = UI.label("外勤小队", 14, UI.MUTED)
	squad.add_child(squad_heading)
	for i in range(mission.survivors.size()):
		var survivor = mission.survivors[i]
		var card := VBoxContainer.new()
		card.add_theme_constant_override("separation", 3)
		squad.add_child(card)
		var label := UI.label("", 15, survivor.data.color.lightened(0.2))
		card.add_child(label)
		squad_labels.append(label)
		var assign := UI.button("改派搜索", func():
			var task = mission.task_for(survivor)
			if task != null:
				mission.command_search(task.site_id)
			else:
				mission.command_reassign(i)
		, Vector2(0, 30))
		assign.add_theme_font_size_override("font_size", 12)
		card.add_child(assign)
		assign_buttons.append(assign)
	task_label = UI.label("暂无搜索任务", 13, UI.AMBER)
	task_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	task_label.custom_minimum_size.y = 48
	squad.add_child(task_label)
	recall_button = UI.button("取消当前搜索", mission.command_recall, Vector2(0, 36))
	squad.add_child(recall_button)
	rally_button = UI.button("全队集合  [R]", mission.command_recall_all, Vector2(0, 36))
	squad.add_child(rally_button)
	var sites_panel := UI.margin(self, Rect2(1160, 121, 258, 463))
	sites_panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	sites_panel.offset_left = -280
	sites_panel.offset_right = -22
	sites_panel.offset_top = 121
	var sites := VBoxContainer.new()
	sites.add_theme_constant_override("separation", 7)
	sites_panel.add_child(sites)
	objective = UI.label("东岸旧街", 18, UI.AMBER)
	sites.add_child(objective)
	for id in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		var button := UI.button(site.spec.name, func(): mission.command_search(id), Vector2(224, 52))
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.add_theme_font_size_override("font_size", 13)
		button.add_theme_color_override("font_disabled_color", UI.MUTED)
		button.tooltip_text = "搜索 %.0f 秒 · %d 食物 · %d 废料" % [site.spec.search_seconds, site.spec.food, site.spec.scrap]
		sites.add_child(button)
		site_buttons[id] = button
	var bottom := UI.margin(self, Rect2(288, 790, 864, 88))
	bottom.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	bottom.offset_left = -470
	bottom.offset_right = 470
	bottom.offset_top = -107
	bottom.offset_bottom = -22
	var commands := HBoxContainer.new()
	commands.add_theme_constant_override("separation", 12)
	bottom.add_child(commands)
	commands.add_child(UI.button("停止  [X]", mission.command_stop, Vector2(123, 45)))
	commands.add_child(UI.button("集火  [F]", mission.command_focus_nearest, Vector2(123, 45)))
	commands.add_child(UI.button("定位小队", mission.center_squad, Vector2(114, 45)))
	order_label = UI.label("", 14, UI.MUTED)
	order_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	order_label.clip_text = true
	commands.add_child(order_label)
	extract_button = UI.button("全队归航  [E]", mission.command_extract, Vector2(170, 45))
	commands.add_child(extract_button)
	toast = UI.label("", 22, UI.CYAN)
	toast.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	toast.offset_left = -400
	toast.offset_right = 400
	toast.offset_top = 121
	toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(toast)
	var help := UI.label("按住左键跟随 · Ctrl 指向射击 · 空格暂停 · WASD / 右键拖动视角 · 滚轮缩放", 12, UI.MUTED)
	help.add_theme_color_override("font_outline_color", UI.INK)
	help.add_theme_constant_override("outline_size", 4)
	help.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	help.offset_left = -420
	help.offset_right = 420
	help.offset_top = -132
	help.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(help)
	if mission.powers.definition != null:
		power_button = UI.button(mission.powers.caption(), func(): mission.powers.activate(); refresh(), Vector2(250, 48))
		power_button.tooltip_text = mission.powers.definition.description() + " · 每日一次"
		power_button.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
		power_button.offset_left = -140
		power_button.offset_right = 140
		power_button.offset_top = -198
		power_button.offset_bottom = -150
		add_child(power_button)
	menu_backdrop = ColorRect.new()
	menu_backdrop.color = Color(0.02, 0.04, 0.07, 0.65)
	menu_backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	menu_backdrop.hide()
	add_child(menu_backdrop)
	debug_menu = DebugMenu.new()
	add_child(debug_menu)
	debug_menu.setup(mission)
	debug_menu.toggled.connect(_sync_pause)
	pause_menu = UI.margin(self, Rect2(490, 285, 460, 300))
	var menu_column := VBoxContainer.new()
	menu_column.add_theme_constant_override("separation", 18)
	pause_menu.add_child(menu_column)
	menu_column.add_child(UI.label("行动暂停", 26, UI.CYAN))
	menu_column.add_child(UI.label("空格：暂停时可下达命令\nEsc：打开或关闭菜单", 16, UI.MUTED))
	menu_column.add_child(UI.button("继续行动", func():
		paused = false
		pause_menu.hide()
		_sync_pause()
	))
	menu_column.add_child(UI.button("退出游戏", func(): quit_requested.emit()))
	pause_menu.hide()
	mission.notice.connect(show_notice)
	show_notice("搜集物资，带全队回来。")
	refresh()

func _process(delta: float) -> void:
	toast_left -= delta
	toast.visible = toast_left > 0
	refresh_left -= delta
	if refresh_left <= 0:
		refresh_left = 0.1
		refresh()

func refresh() -> void:
	if mission == null:
		return
	if power_button != null:
		power_button.text = mission.powers.caption()
		power_button.disabled = mission.powers.used or not mission.active or not mission.input_enabled
	var clock = mission.clock
	phase_label.text = ["DAY", "BLUE HOUR", "NIGHT"][clock.phase]
	phase_label.add_theme_color_override("font_color", [UI.AMBER, UI.CYAN, Color("#f28a93")][clock.phase])
	var seconds := int(ceil(clock.remaining()))
	clock_label.text = ("%02d:%02d" % [seconds / 60, seconds % 60]) + ("  警戒 %d" % clock.threat_level() if clock.phase == clock.NIGHT else "  距" + ("蓝时" if clock.phase == clock.DAY else "夜幕"))
	resource_label.text = "食物 %02d   废料 %02d" % [mission.ledger.food, mission.ledger.scrap]
	if mission.campaign != null:
		resource_label.text += "   装备 %d" % mission.ledger.weapons.size()
	var busy: bool = not mission.search_id.is_empty()
	squad_heading.text = "外勤 %d · 掩护 %d · 搜索 %d" % [mission.living().size(), mission.guards().size(), mission.search_tasks.size()]
	for i in range(mission.survivors.size()):
		var survivor = mission.survivors[i]
		var health := "阵亡" if survivor.dead else "%d / %d HP" % [survivor.hp, survivor.data.max_hp]
		var ammo := "近战" if survivor.weapon.melee else ("换弹中" if survivor.reload_left > 0 else "%d/%d" % [survivor.ammo, survivor.weapon.magazine])
		squad_labels[i].text = "%s  ·  %s\n%s  ·  %s\n%s · %s" % [survivor.data.display_name, health, survivor.talent.display_name, survivor.weapon.display_name, ammo, mission.member_status(survivor)]
		squad_labels[i].tooltip_text = survivor.talent.description
		var task = mission.task_for(survivor)
		var selected: bool = task != null and task == mission.search_task
		assign_buttons[i].disabled = survivor.dead or not mission.active or selected or (task == null and not busy)
		assign_buttons[i].text = ("当前搜索" if selected else "查看搜索") if task != null else "改派当前搜索"
		if task != null:
			squad_labels[i].text += "\n" + mission.city.sites[task.site_id].spec.name
	task_label.text = mission.search_status if busy else "暂无搜索任务"
	recall_button.disabled = not busy or not mission.active
	rally_button.disabled = not mission.active or mission.closing_left >= 0
	var remaining := 0
	for id in site_buttons:
		var site: Dictionary = mission.city.sites[id]
		site_buttons[id].disabled = site.searched or mission.closing_left >= 0 or not mission.active
		var task = mission.search_tasks.get(id)
		site_buttons[id].text = ("✓ " if site.searched else ("▶ " if mission.search_id == id else ("↗ " if task != null else "◇ "))) + site.spec.name + ("  %d%%" % (site.progress * 100) if site.progress > 0 and not site.searched else "")
		if not site.searched:
			site_buttons[id].text += ("\n   " + task.worker.data.display_name + " · " + mission.member_status(task.worker)) if task != null else "\n   %d 食物 · %d 废料 · %.0fs" % [site.spec.food, site.spec.scrap, site.spec.search_seconds]
			if task == null and not mission.reward_for_site(id).is_empty():
				site_buttons[id].text += " · 装备"
		if not site.searched:
			remaining += 1
	objective.text = "东岸旧街  ·  %d 处待搜" % remaining
	if mission.campaign != null:
		objective.text = "第 %d 天 · %d 处待搜" % [mission.campaign.data.day, remaining]
	order_label.text = mission.order
	if mission.extraction:
		order_label.text = "归航 %d/%d · %.1fs" % [mission.board_count(), mission.living().size(), mission.extraction_left]
	extract_button.disabled = not mission.active or mission.closing_left >= 0
	if mission.closing_left >= 0:
		order_label.text = "车门关闭 · 归航"
	pause_button.text = "继续" if paused else "暂停"

func show_notice(text: String) -> void:
	toast.text = text
	toast_left = 4.0

func toggle_pause() -> void:
	if debug_menu.visible or pause_menu.visible:
		return
	paused = not paused
	_sync_pause()
	show_notice("行动暂停" if paused else "继续行动")

func toggle_debug() -> void:
	if pause_menu.visible:
		return
	debug_menu.toggle()

func toggle_menu() -> void:
	if debug_menu.visible:
		debug_menu.toggle()
		return
	pause_menu.visible = not pause_menu.visible
	_sync_pause()

func _sync_pause() -> void:
	menu_backdrop.visible = pause_menu.visible or debug_menu.visible
	mission.time_scale = 0.0 if paused or pause_menu.visible or debug_menu.visible else debug_menu.speed
	mission.input_enabled = not pause_menu.visible and not debug_menu.visible
	mission.controls.reset()
