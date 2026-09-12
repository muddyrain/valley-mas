extends Control
signal quit_requested
const UI = preload("res://ui/ui_style.gd")
const Style = preload("res://ui/expedition_theme.gd")
const Art = preload("res://ui/new_run_art.gd")
const SquadCard = preload("res://ui/expedition/squad_card.gd")
const PoiEntry = preload("res://ui/expedition/poi_entry.gd")
const PoiContext = preload("res://ui/expedition/poi_context.gd")
const ActionIcon = preload("res://ui/expedition/action_icon.gd")
const DebugMenu = preload("res://debug/debug_menu.gd")
var mission: Node3D
var phase_label: Label
var clock_label: Label
var squad_labels: Array[Label] = []
var squad_cards: Array[PanelContainer] = []
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
var power_buttons: Dictionary = {}
var power_panel: PanelContainer
var watch_label: Label
var focus_label: Label
var poi_context: PanelContainer
var phase_progress: ProgressBar
var top_panel: PanelContainer
var squad_panel: PanelContainer
var sites_panel: PanelContainer
var command_panel: PanelContainer

var brand_panel: PanelContainer
var resources_panel: PanelContainer
var phase_hint: Label
var resource_counts: Array[Label] = []
var sites_scroll: ScrollContainer
var site_list: VBoxContainer
var expand_button: Button
var objectives_expanded: bool = false
var tracker_left: float = 0.0
var command_buttons: Dictionary = {}
var return_surface: StyleBox
var clock_surface: StyleBox

func setup(target: Node3D) -> void:
	mission = target
	set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme = Style.theme()
	_build_top()
	_build_squad()
	_build_sites()
	_build_commands()
	poi_context = PoiContext.new()
	poi_context.name = "PoiContext"
	add_child(poi_context)
	poi_context.setup(mission)
	_build_menus()
	get_viewport().size_changed.connect(_fit_window)
	_fit_window()
	mission.notice.connect(show_notice)
	refresh()

func _fit_window() -> void:
	# Keep expedition text and hit targets at readable pixel sizes; other screens retain their canvas.
	var stretch: Vector2 = get_viewport().get_stretch_transform().get_scale()
	if scale.is_equal_approx(Vector2.ONE / stretch) and size.is_equal_approx(get_viewport_rect().size * stretch):
		return
	scale = Vector2.ONE / stretch
	size = get_viewport_rect().size * stretch
	var compact: bool = size.y < 740
	squad_panel.offset_top = 96 if compact else 120
	for card: PanelContainer in squad_cards:
		card.set_compact(compact)
		card.portrait.custom_minimum_size.y = 64 if compact else 72
		card.custom_minimum_size.y = 74 if compact else 82
		card.reset_size()

func _build_top() -> void:
	brand_panel = Style.anchored(self, "Brand", PRESET_TOP_LEFT, Rect2(20, 20, 178, 60))
	brand_panel.add_theme_stylebox_override("panel", Style.plate(Color("#122b39d0"), Color("#7397a15c"), 10))
	var brand := VBoxContainer.new()
	brand_panel.add_child(brand)
	var name_label := UI.label("蓝时归航", 22, Style.PAPER)
	name_label.add_theme_font_override("font", Art.title_font())
	brand.add_child(name_label)
	brand.add_child(UI.label("东岸旧街  /  HOMEWARD", 10, Style.MUTED))
	top_panel = Style.anchored(self, "PhaseClock", PRESET_CENTER_TOP, Rect2(-104, 16, 208, 76))
	clock_surface = Style.plate(Color("#122b3970"), Style.CYAN, 3)
	clock_surface.clock_face = true
	top_panel.add_theme_stylebox_override("panel", clock_surface)
	var state := VBoxContainer.new()
	state.add_theme_constant_override("separation", 0)
	top_panel.add_child(state)
	phase_label = UI.label("DAY", 14, Style.GOLD)
	phase_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	state.add_child(phase_label)
	clock_label = UI.label("02:30", 30, Style.PAPER)
	clock_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	state.add_child(clock_label)
	phase_hint = UI.label("", 0, Style.MUTED)
	phase_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	phase_hint.visible = false
	state.add_child(phase_hint)
	phase_progress = ProgressBar.new()
	phase_progress.show_percentage = false
	phase_progress.custom_minimum_size.y = 3
	state.add_child(phase_progress)
	resources_panel = Style.anchored(self, "Supplies", PRESET_TOP_RIGHT, Rect2(-292, 20, 272, 48))
	resources_panel.add_theme_stylebox_override("panel", Style.plate(Color("#122b39db"), Color("#7397a15c"), 6))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	resources_panel.add_child(row)
	var textures: Array[Texture2D] = [preload("res://assets/ui/expedition/icons/food.svg"), preload("res://assets/ui/expedition/icons/scrap.svg"), preload("res://assets/ui/expedition/icons/gear.svg")]
	for i: int in range(3):
		var picture := TextureRect.new()
		picture.texture = textures[i]
		picture.custom_minimum_size = Vector2(20, 28)
		picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		picture.tooltip_text = ["食物", "废料", "装备"][i]
		row.add_child(picture)
		var count := UI.label("00", 14, Style.PAPER)
		row.add_child(count)
		resource_counts.append(count)
	pause_button = UI.button("Ⅱ", toggle_pause, Vector2(32, 32))
	pause_button.tooltip_text = "暂停 / 继续 · 空格"
	row.add_child(pause_button)
	watch_label = UI.label("腕表预警", 12, Style.GOLD)
	watch_label.set_anchors_and_offsets_preset(PRESET_CENTER_TOP)
	watch_label.offset_left = -46
	watch_label.offset_top = 94
	add_child(watch_label)
	focus_label = UI.label("", 12, Style.CYAN)
	focus_label.set_anchors_and_offsets_preset(PRESET_CENTER_TOP)
	focus_label.offset_left = -75
	focus_label.offset_top = 111
	add_child(focus_label)

func _build_squad() -> void:
	squad_panel = Style.anchored(self, "SquadPortraits", PRESET_TOP_LEFT, Rect2(20, 120, 178, 0))
	squad_panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	var squad := VBoxContainer.new()
	squad.add_theme_constant_override("separation", 8)
	squad_panel.add_child(squad)
	squad_heading = UI.label("外勤小队", 11, Style.PAPER)
	squad.add_child(squad_heading)
	for i: int in range(mission.survivors.size()):
		var survivor: Node3D = mission.survivors[i]
		var card := SquadCard.new()
		squad.add_child(card)
		card.setup(survivor, func():
			var task = mission.task_for(survivor)
			if task != null:
				mission.command_search(task.site_id)
			else:
				mission.command_reassign(i)
		, mission.campaign.member_template(survivor.data.id).id if mission.campaign != null else survivor.data.id)
		squad_cards.append(card)
		squad_labels.append(card.summary)
		assign_buttons.append(card.action)
	task_label = UI.label("", 11, Style.GOLD)
	task_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	squad.add_child(task_label)
	recall_button = UI.button("取消当前搜索", mission.command_recall, Vector2(0, 26))
	recall_button.add_theme_font_size_override("font_size", 12)
	squad.add_child(recall_button)
	rally_button = UI.button("集合  [R]", mission.command_recall_all, Vector2(0, 28))
	rally_button.icon = preload("res://assets/ui/expedition/icons/rally.svg")
	rally_button.expand_icon = true
	rally_button.add_theme_constant_override("icon_max_width", 20)
	rally_button.add_theme_font_size_override("font_size", 12)
	squad.add_child(rally_button)

func _build_sites() -> void:
	sites_panel = Style.anchored(self, "ObjectiveTracker", PRESET_TOP_RIGHT, Rect2(-266, 104, 246, 198))
	sites_panel.add_theme_stylebox_override("panel", Style.plate(Color("#112938a8"), Color.TRANSPARENT, 8))
	var sites := VBoxContainer.new()
	sites.add_theme_constant_override("separation", 6)
	sites_panel.add_child(sites)
	objective = UI.label("", 14, Style.GOLD)
	sites.add_child(objective)
	sites_scroll = ScrollContainer.new()
	sites_scroll.name = "SiteScroll"
	sites_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sites_scroll.size_flags_vertical = SIZE_EXPAND_FILL
	sites_scroll.custom_minimum_size.y = 116
	sites.add_child(sites_scroll)
	site_list = VBoxContainer.new()
	site_list.size_flags_horizontal = SIZE_EXPAND_FILL
	site_list.add_theme_constant_override("separation", 4)
	sites_scroll.add_child(site_list)
	for id: String in mission.city.sites:
		var entry := PoiEntry.new()
		site_list.add_child(entry)
		entry.setup(mission.city.sites[id], func(): mission.command_search(id); refresh())
		entry.mouse_entered.connect(func(): poi_context.focused_id = id)
		entry.mouse_exited.connect(func(): if poi_context.focused_id == id: poi_context.focused_id = "")
		entry.focus_entered.connect(func(): poi_context.focused_id = id)
		entry.focus_exited.connect(func(): if poi_context.focused_id == id: poi_context.focused_id = "")
		site_buttons[id] = entry
	expand_button = UI.button("查看全部  +", func(): set_objectives_expanded(not objectives_expanded), Vector2(0, 24))
	expand_button.add_theme_font_size_override("font_size", 11)
	sites.add_child(expand_button)
	_update_tracker()

func set_objectives_expanded(expanded: bool) -> void:
	objectives_expanded = expanded
	sites_scroll.custom_minimum_size.y = 296 if expanded else 116
	expand_button.text = "收起  −" if expanded else "查看全部  +"
	_update_tracker()
	sites_panel.reset_size()

func _update_tracker() -> void:
	var ids: Array = mission.city.sites.keys()
	ids.sort_custom(func(a: String, b: String): return _site_priority(a) < _site_priority(b))
	var shown: int = 0
	for i: int in range(ids.size()):
		var id: String = ids[i]
		var entry: Button = site_buttons[id]
		entry.visible = objectives_expanded or (shown < 3 and not mission.city.sites[id].searched)
		if entry.visible:
			shown += 1
		site_list.move_child(entry, i)

func _site_priority(id: String) -> float:
	var site: Dictionary = mission.city.sites[id]
	return (-20000.0 if mission.search_tasks.has(id) else -10000.0 if mission.poi_selected_id == id else 0.0) + (100000.0 if site.searched else 0.0) + site.spec.entry.distance_squared_to(mission.squad_center())

func _build_commands() -> void:
	var dock_width: float = 3 * 70 + mission.powers.states.size() * 76 + (mission.powers.states.size() + 2) * 6
	command_panel = Style.anchored(self, "ActionIcons", PRESET_CENTER_BOTTOM, Rect2(-dock_width / 2, -92, dock_width, 76))
	command_panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	command_panel.add_child(row)
	var actions: Array[Array] = [
		["停止", "X", preload("res://assets/ui/expedition/icons/stop.svg"), mission.command_stop],
		["集火", "F", preload("res://assets/ui/expedition/icons/focus.svg"), mission.command_focus_nearest],
		["定位", "", preload("res://assets/ui/expedition/icons/locate.svg"), mission.center_squad]
	]
	for spec: Array in actions:
		var action := ActionIcon.new()
		row.add_child(action)
		action.setup(spec[0], spec[1], spec[2], spec[3])
		command_buttons[spec[0]] = action
	command_buttons["定位"].tooltip_text = "恢复镜头跟随 · WASD / 拖动自由查看 · 滚轮缩放"
	power_panel = PanelContainer.new()
	power_panel.name = "Abilities"
	power_panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	row.add_child(power_panel)
	var abilities := HBoxContainer.new()
	abilities.add_theme_constant_override("separation", 6)
	power_panel.add_child(abilities)
	for id: String in mission.powers.states:
		var definition: Resource = mission.powers.states[id].definition
		var ability := ActionIcon.new()
		abilities.add_child(ability)
		ability.setup(definition.display_name, "1", definition.icon, func(): mission.powers.activate(id); refresh(), 76)
		ability.tooltip_text = definition.description() + " · 每日一次"
		power_buttons[id] = ability
	extract_button = ActionIcon.new()
	extract_button.name = "ReturnHome"
	add_child(extract_button)
	extract_button.set_anchors_and_offsets_preset(PRESET_BOTTOM_RIGHT)
	extract_button.offset_left = -148
	extract_button.offset_right = -20
	extract_button.offset_top = -92
	extract_button.offset_bottom = -16
	extract_button.setup("全队归航", "E", preload("res://assets/ui/expedition/icons/return.svg"), mission.command_extract, 128)
	return_surface = Style.plate(Color("#3b3540ed"), Style.GOLD, 10)
	return_surface.content_margin_bottom = 27
	extract_button.add_theme_stylebox_override("normal", return_surface)
	order_label = UI.label("", 11, Style.PAPER)
	order_label.set_anchors_and_offsets_preset(PRESET_CENTER_BOTTOM)
	order_label.offset_left = -dock_width / 2
	order_label.offset_top = -114
	add_child(order_label)
	toast = UI.label("", 13, Style.GOLD)
	toast.set_anchors_and_offsets_preset(PRESET_CENTER_BOTTOM)
	toast.offset_left = -170
	toast.offset_top = -144
	add_child(toast)

func _process(delta: float) -> void:
	toast_left -= delta
	toast.visible = toast_left > 0
	tracker_left -= delta
	if tracker_left <= 0:
		tracker_left = 1.0
		# Stable hit targets while the user is reading or pointing at the tracker.
		if not sites_panel.get_global_rect().has_point(get_global_mouse_position()):
			_update_tracker()
	refresh_left -= delta
	if refresh_left <= 0:
		refresh_left = .1
		_fit_window()
		refresh()

func refresh() -> void:
	if mission == null:
		return
	for id: String in power_buttons:
		var state = mission.powers.states[id]
		power_buttons[id].set_state(mission.powers.can_activate(id), state.active, str(ceili(state.remaining_duration)) if state.active else "0" if state.used_today else "1")
	watch_label.visible = mission.watch_warning_active
	var priority: Node3D = mission.powers.target()
	focus_label.visible = priority != null or mission.effects.amount("freeze_day_clock") > 0
	focus_label.text = ("集火 · " + priority.data.display_name if priority != null else "") + (" 暮色延缓" if mission.effects.amount("freeze_day_clock") > 0 else "")
	var clock = mission.clock
	phase_label.text = ["DAY", "BLUE HOUR", "NIGHT"][clock.phase]
	var phase_color: Color = [Style.GOLD.lerp(Style.CYAN, clampf(1.0 - clock.remaining() / 40.0, 0, 1)), Style.CYAN, Color("#e8a8a3")][clock.phase]
	phase_label.add_theme_color_override("font_color", phase_color)
	clock_surface.fill = Color("#202a47a8") if clock.phase == clock.BLUE_HOUR else Color("#142a3890")
	clock_surface.edge = Color(phase_color, .65)
	clock_surface.emit_changed()
	var seconds: int = ceili(clock.remaining())
	clock_label.text = "%02d:%02d" % [seconds / 60, seconds % 60]
	phase_hint.text = "距蓝时" if clock.phase == clock.DAY else "距夜幕 · 尽快归航" if clock.phase == clock.BLUE_HOUR else "夜幕警戒 %d" % clock.threat_level()
	phase_progress.modulate = phase_color
	phase_progress.value = clock.remaining()
	phase_progress.max_value = clock.settings.day_seconds if clock.phase == clock.DAY else clock.settings.blue_seconds
	resource_counts[0].text = "%02d" % mission.ledger.food
	resource_counts[1].text = "%02d" % mission.ledger.scrap
	resource_counts[2].text = str(mission.ledger.weapons.size())
	squad_heading.text = "外勤 %d · 掩护 %d · 搜索 %d" % [mission.living().size(), mission.guards().size(), mission.search_tasks.size()]
	for i: int in range(squad_cards.size()):
		squad_cards[i].update_member(mission.survivors[i], mission)
	var busy: bool = not mission.search_id.is_empty()
	task_label.visible = busy
	task_label.text = (mission.city.sites[mission.search_id].spec.name + (" · 自卫" if mission.search_task.phase == 2 else "")) if busy else ""
	recall_button.visible = busy
	recall_button.disabled = not busy or not mission.active
	rally_button.disabled = not mission.active or mission.closing_left >= 0
	var remaining: int = 0
	for id: String in site_buttons:
		site_buttons[id].update_site(id, mission)
		if not mission.city.sites[id].searched:
			remaining += 1
	objective.text = "第 %d 天 · %d 处待搜" % [mission.campaign.data.day if mission.campaign != null else 1, remaining]
	order_label.text = mission.order
	extract_button.caption.text = "全队归航"
	if mission.extraction:
		order_label.text = "归航 %d/%d · %.1fs" % [mission.board_count(), mission.living().size(), mission.extraction_left]
		extract_button.caption.text = "集合 %d/%d" % [mission.board_count(), mission.living().size()]
	elif clock.phase != clock.DAY:
		extract_button.caption.text = "立即归航"
	elif clock.remaining() <= 30:
		extract_button.caption.text = "准备归航"
	var urgent: bool = clock.phase == clock.NIGHT or (clock.phase == clock.BLUE_HOUR and clock.remaining() <= 6)
	return_surface.edge = Color("#ffc3ad") if urgent else Style.CYAN if clock.phase == clock.BLUE_HOUR else Color(Style.GOLD, 1.0 if clock.remaining() <= 30 else .5)
	return_surface.fill = Color("#4a3542ef") if urgent else Color("#202e46ed") if clock.phase == clock.BLUE_HOUR else Color("#302e35e8")
	return_surface.emit_changed()
	extract_button.state_line.color = return_surface.edge
	extract_button.disabled = not mission.active or mission.closing_left >= 0
	if mission.closing_left >= 0:
		order_label.text = "车门关闭 · 归航"
		extract_button.caption.text = "正在归航"
	pause_button.text = "▷" if paused else "Ⅱ"
	squad_panel.reset_size()
	poi_context.refresh()

func _build_menus() -> void:
	menu_backdrop = ColorRect.new()
	menu_backdrop.color = Color(0.02, 0.04, 0.07, 0.65)
	menu_backdrop.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	menu_backdrop.hide()
	add_child(menu_backdrop)
	debug_menu = DebugMenu.new()
	add_child(debug_menu)
	debug_menu.setup(mission)
	debug_menu.toggled.connect(_sync_pause)
	pause_menu = Style.anchored(self, "PauseMenu", PRESET_CENTER, Rect2(-230, -150, 460, 300))
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 18)
	pause_menu.add_child(column)
	column.add_child(UI.label("行动暂停", 26, Style.CYAN))
	column.add_child(UI.label("空格：暂停时可下达命令\nEsc：打开或关闭菜单", 16, Style.MUTED))
	column.add_child(UI.button("继续行动", func():
		paused = false
		pause_menu.hide()
		_sync_pause()
	))
	column.add_child(UI.button("退出游戏", func(): quit_requested.emit()))
	pause_menu.hide()

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
