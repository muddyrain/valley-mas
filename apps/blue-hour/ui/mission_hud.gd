extends Control
signal main_menu_requested
const UI = preload("res://ui/ui_style.gd")
const Style = preload("res://ui/expedition_theme.gd")
const Art = preload("res://ui/new_run_art.gd")
const SquadCard = preload("res://ui/expedition/squad_card.gd")
const PoiEntry = preload("res://ui/expedition/poi_entry.gd")
const PoiContext = preload("res://ui/expedition/poi_context.gd")
const ActionIcon = preload("res://ui/expedition/action_icon.gd")
const DebugMenu = preload("res://debug/debug_menu.gd")
const SettingsView = preload("res://ui/settings_view.gd")
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const WorldMarkers = preload("res://ui/expedition/world_markers.gd")
const Visual = preload("res://ui/expedition/hud_visual_profile.gd")
const Minimap = preload("res://ui/expedition/minimap.gd")
const HotkeyBadge = preload("res://ui/expedition/hotkey_badge.gd")
const HUD_SCALE: float = .8
var mission: Node3D
var game_settings: RefCounted
var phase_label: Label
var phase_icon: TextureRect
var phase_steps: Array[Label] = []
var day_label: Label
var clock_label: Label
var squad_labels: Array[Label] = []
var squad_cards: Array[PanelContainer] = []
var squad_heading: Label
var site_buttons: Dictionary = {}
var order_label: Label
var toast: Label
var toast_panel: PanelContainer
var toast_left: float = 0.0
var search_notices: Array[Dictionary] = []
var objective: Label
var debug_menu: PanelContainer
var refresh_left: float = 0.0
var extract_button: Button
var paused: bool = false
var pause_button: Button
var pause_menu: PanelContainer
var settings_menu: PanelContainer
var settings_view: VBoxContainer
var rally_button: Button
var menu_backdrop: ColorRect
var power_buttons: Dictionary = {}
var power_panel: PanelContainer
var watch_label: Label
var focus_label: Label
var poi_context: Control
var phase_progress: ProgressBar
var top_time_root: HBoxContainer
var top_panel: PanelContainer
var squad_panel: PanelContainer
var sites_panel: PanelContainer
var command_panel: PanelContainer
var day_panel: PanelContainer

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
var clock_surface: StyleBox
var ui_viewport: Viewport
var world_markers: Node3D
var squad_scroll: ScrollContainer
var squad_column: VBoxContainer
var selected_member: Node3D
var minimap: Control
var roster_ids: Array[int] = []

func _exit_tree() -> void:
	if is_instance_valid(ui_viewport) and ui_viewport.size_changed.is_connected(_fit_window):
		ui_viewport.size_changed.disconnect(_fit_window)

func setup(target: Node3D, preferences: RefCounted = null) -> void:
	mission = target
	game_settings = preferences
	ui_viewport = get_viewport()
	set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	texture_repeat = CanvasItem.TEXTURE_REPEAT_DISABLED
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
	world_markers = WorldMarkers.new()
	add_child(world_markers)
	world_markers.setup(mission, poi_context)
	if not mission.survivors.is_empty():
		selected_member = mission.survivors[0]
		mission.selected_search_member = selected_member
		world_markers.selected_member = selected_member
		if is_instance_valid(mission.world_interaction_vfx):
			mission.world_interaction_vfx.set_selected_member(selected_member)
	HudArt.pass_decorations(self)
	_build_menus()
	minimap = Minimap.new()
	minimap.name = "Minimap"
	minimap.set_anchors_and_offsets_preset(PRESET_BOTTOM_LEFT)
	minimap.offset_left = 24
	minimap.offset_top = -312
	minimap.offset_right = 344
	minimap.offset_bottom = -48
	add_child(minimap)
	minimap.setup(mission)
	ui_viewport.size_changed.connect(_fit_window)
	_fit_window()
	mission.notice.connect(show_notice)
	mission.search_completed.connect(_show_search_result)
	mission.search_loot_collected.connect(func(id: String, worker_name: String, loot: Dictionary) -> void: _show_search_result(id, worker_name, loot, true))
	refresh()

func _fit_window() -> void:
	# PNG dimensions are reduced by HUD_SCALE; native text remains sharp at both target resolutions.
	var stretch: Vector2 = get_viewport().get_stretch_transform().get_scale()
	var pixels: Vector2 = get_viewport_rect().size * stretch
	var responsive: float = minf(pixels.x / 1920.0, pixels.y / 1080.0)
	scale = Vector2.ONE * responsive / stretch
	size = pixels / responsive
	squad_panel.offset_top = 192
	squad_scroll.custom_minimum_size.y = minf(squad_column.get_combined_minimum_size().y, size.y - 320)
	squad_panel.reset_size()
	top_panel.scale = Vector2.ONE * Visual.TIME_SCALE
	top_panel.pivot_offset = Vector2(top_panel.size.x * .5, 0)
	squad_panel.scale = Vector2.ONE * Visual.PARTY_SCALE
	sites_panel.scale = Vector2.ONE * Visual.OBJECTIVE_SCALE
	sites_panel.pivot_offset = Vector2(sites_panel.size.x, 0)
	command_panel.scale = Vector2.ONE * Visual.ACTION_SCALE
	command_panel.pivot_offset = Vector2(command_panel.size.x * .5, command_panel.size.y)
	extract_button.set_visual_scale(Visual.RETURN_SCALE)
	_fit_tracker()

func _fit_tracker() -> void:
	var shown: int = site_buttons.values().filter(func(entry: Button): return entry.visible).size()
	var content_height: float = shown * 56 + maxi(shown - 1, 0) * 6
	sites_scroll.custom_minimum_size.y = minf(content_height, minf(308 if objectives_expanded else 152, maxf(0, size.y - 360)))
	sites_panel.size.y = 0
	sites_panel.reset_size()

func inspect_member(member: Node3D, locate: bool = true) -> void:
	if member.dead:
		return
	selected_member = member
	mission.selected_search_member = member
	world_markers.selected_member = member
	if is_instance_valid(mission.world_interaction_vfx):
		mission.world_interaction_vfx.set_selected_member(member)
	if locate:
		mission.camera_controller.following = false
		mission.camera_center = member.position
		mission.camera_controller.apply()
	refresh()

func _input(event: InputEvent) -> void:
	if mission == null or not mission.input_enabled or not event is InputEventMouseButton:
		return
	if not event.pressed or event.button_index != MOUSE_BUTTON_LEFT or mission.controls.over_ui() or mission.controls.aiming or mission.controls.dragging:
		return
	for member: Node3D in mission.survivors:
		if member.dead or member.inside_building or member.boarding:
			continue
		var foot: Vector2 = mission.camera.unproject_position(member.rig.global_position)
		var head: Vector2 = mission.camera.unproject_position(member.rig.global_position + Vector3.UP * 1.7)
		var hit := Rect2(Vector2(head.x - 14, head.y), Vector2(28, maxf(20, foot.y - head.y)))
		if hit.has_point(event.position):
			inspect_member(member, false)
			get_viewport().set_input_as_handled()
			return

func _build_top() -> void:
	brand_panel = Style.anchored(self, "Brand", PRESET_TOP_LEFT, Rect2(24, 16, 264, 99))
	brand_panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	var brand := VBoxContainer.new()
	brand.add_theme_constant_override("separation", 4)
	brand_panel.add_child(brand)
	var logo := HudArt.picture("logo_final", Vector2(264, 99))
	logo.self_modulate = Color(1, 1, 1, .94)
	brand.add_child(logo)
	top_panel = Style.anchored(self, "PhaseClock", PRESET_CENTER_TOP, Rect2(0, 0, 330, 64))
	clock_surface = HudArt.panel("hud_time_panel", Vector4(14, 10, 14, 10))
	top_panel.add_theme_stylebox_override("panel", clock_surface)
	var phases := HBoxContainer.new()
	phases.alignment = BoxContainer.ALIGNMENT_CENTER
	phases.add_theme_constant_override("separation", 0)
	top_panel.add_child(phases)
	var phase_names: Array[String] = ["白昼", "黄昏预警", "蓝时", "夜晚"]
	var phase_icons: Array[String] = ["icon_phase_day", "icon_phase_warning", "icon_phase_blue_hour", "icon_phase_night"]
	for index: int in range(phase_names.size()):
		var cell := VBoxContainer.new()
		cell.size_flags_horizontal = SIZE_EXPAND_FILL
		cell.add_theme_constant_override("separation", 2)
		phases.add_child(cell)
		cell.add_child(HudArt.picture(phase_icons[index], Vector2(20, 20)))
		var step := UI.label(phase_names[index], 12, Style.MUTED)
		step.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		cell.add_child(step)
		phase_steps.append(step)
	day_panel = Style.anchored(self, "DayStatus", PRESET_CENTER_TOP, Rect2(0, 0, 146, 64))
	day_panel.add_theme_stylebox_override("panel", HudArt.panel("hud_day_panel", Vector4(16, 10, 16, 10)))
	var state := HBoxContainer.new()
	state.add_theme_constant_override("separation", 12)
	day_panel.add_child(state)
	phase_icon = TextureRect.new()
	phase_icon.custom_minimum_size = Vector2(16, 16)
	phase_icon.visible = false
	phase_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	phase_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	phase_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	state.add_child(phase_icon)
	var date_column := VBoxContainer.new()
	date_column.size_flags_horizontal = SIZE_EXPAND_FILL
	date_column.add_theme_constant_override("separation", 1)
	state.add_child(date_column)
	day_label = UI.label("第 1 天", 14, Style.INK)

	phase_label = UI.label("白昼", 12, Style.INK)
	date_column.add_child(phase_label)
	date_column.visible = false
	var clock_column := VBoxContainer.new()
	clock_column.size_flags_horizontal = SIZE_EXPAND_FILL
	clock_column.add_theme_constant_override("separation", 0)
	state.add_child(clock_column)
	clock_label = UI.label("02:30", 25, Style.PAPER)
	clock_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	clock_column.add_child(day_label)
	day_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	day_label.add_theme_font_size_override("font_size", 15)
	day_label.add_theme_color_override("font_color", Style.MUTED)
	clock_label.add_theme_font_size_override("font_size", 21)
	clock_column.add_child(clock_label)
	phase_hint = UI.label("", 10, Style.MUTED)
	phase_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	phase_hint.visible = false
	clock_column.add_child(phase_hint)
	phase_progress = ProgressBar.new()
	phase_progress.show_percentage = false
	phase_progress.custom_minimum_size.y = 2
	HudArt.progress(phase_progress)
	clock_column.add_child(phase_progress)
	phase_progress.hide()
	top_time_root = HBoxContainer.new()
	top_time_root.name = "TopTimeRoot"
	add_child(top_time_root)
	top_time_root.set_anchors_and_offsets_preset(PRESET_CENTER_TOP)
	top_time_root.offset_left = -344
	top_time_root.offset_right = 133
	top_time_root.offset_top = 20
	top_time_root.offset_bottom = 84
	top_time_root.add_theme_constant_override("separation", 6)
	top_time_root.mouse_filter = MOUSE_FILTER_IGNORE
	top_panel.reparent(top_time_root)
	day_panel.reparent(top_time_root)
	top_panel.custom_minimum_size = Vector2(330, 64)
	day_panel.custom_minimum_size = Vector2(146, 64)
	resources_panel = Style.anchored(self, "Supplies", PRESET_TOP_RIGHT, Rect2(-640, 20, 616, 66))
	resources_panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	resources_panel.add_child(row)
	var textures: Array[Texture2D] = [HudArt.texture("icon_bag"), HudArt.texture("icon_loot"), HudArt.texture("icon_ammo")]
	for i: int in range(3):
		var card_panel := PanelContainer.new()
		card_panel.custom_minimum_size = Vector2(124, 64)
		card_panel.add_theme_stylebox_override("panel", HudArt.surface("hud_resource_card_bg", Vector4(10, 8, 10, 8)))
		var card := HBoxContainer.new()
		card.add_theme_constant_override("separation", 8)
		card_panel.add_child(card)
		var picture := TextureRect.new()
		picture.texture = HudArt.fitted_icon(textures[i])
		picture.custom_minimum_size = Vector2(36, 36)
		picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		picture.tooltip_text = ["食物", "废料", "情报"][i]
		var heading := VBoxContainer.new()
		heading.alignment = BoxContainer.ALIGNMENT_CENTER
		heading.add_theme_constant_override("separation", 6)
		card.add_child(picture)
		heading.add_child(UI.label(["食物", "废料", "情报"][i], 14, Style.PAPER))
		card.add_child(heading)
		var count := UI.label("—", 18, Style.PAPER)
		count.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		count.custom_minimum_size.x = 30
		heading.add_child(count)
		row.add_child(card_panel)
		resource_counts.append(count)
	pause_button = UI.button("菜单", toggle_menu, Vector2(168, 64))
	pause_button.icon = HudArt.fitted_icon(HudArt.texture("icon_menu"))
	pause_button.expand_icon = true
	pause_button.add_theme_constant_override("icon_max_width", 24)
	pause_button.add_theme_constant_override("h_separation", 8)
	pause_button.size_flags_vertical = SIZE_SHRINK_CENTER
	pause_button.add_theme_font_size_override("font_size", 18)
	HudArt.button(pause_button, "hud_menu_button")
	pause_button.tooltip_text = "打开菜单 · Esc"
	row.add_child(pause_button)
	watch_label = UI.label("腕表预警", 12, Style.GOLD)
	watch_label.set_anchors_and_offsets_preset(PRESET_CENTER_TOP)
	watch_label.offset_left = -46
	watch_label.offset_top = 172
	add_child(watch_label)
	focus_label = UI.label("", 12, Style.CYAN)
	focus_label.set_anchors_and_offsets_preset(PRESET_CENTER_TOP)
	focus_label.offset_left = -75
	focus_label.offset_top = 190
	add_child(focus_label)

func _build_squad() -> void:
	squad_panel = Style.anchored(self, "SquadPortraits", PRESET_TOP_LEFT, Rect2(24, 192, 304, 0))
	squad_panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	squad_scroll = ScrollContainer.new()
	squad_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	squad_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	squad_scroll.mouse_force_pass_scroll_events = true
	squad_scroll.add_theme_constant_override("scrollbar_width", 0)
	squad_panel.add_child(squad_scroll)
	var squad := VBoxContainer.new()
	squad_column = squad
	squad.size_flags_horizontal = SIZE_EXPAND_FILL
	squad.add_theme_constant_override("separation", 14)
	squad_scroll.add_child(squad)
	squad_heading = UI.label("外勤小队", 12, Color("#c9d9d6"))
	squad.add_child(squad_heading)
	squad_heading.hide()
	for i: int in range(mission.survivors.size()):
		var survivor: Node3D = mission.survivors[i]
		roster_ids.append(survivor.get_instance_id())
		var card := SquadCard.new()
		squad.add_child(card)
		card.setup(survivor, mission.campaign.member_template(survivor.data.id).id if mission.campaign != null else survivor.data.id)
		card.set_index(i + 1)
		card.inspected.connect(inspect_member.bind(survivor))
		squad_cards.append(card)
		squad_labels.append(card.summary)
	rally_button = UI.button("集合", mission.command_recall_all, Vector2(0, 40))
	rally_button.icon = HudArt.fitted_icon(HudArt.texture("icon_team"))
	HudArt.button(rally_button, "hud_group_button")
	rally_button.expand_icon = true
	rally_button.add_theme_constant_override("icon_max_width", 20)
	rally_button.add_theme_font_size_override("font_size", 16)
	rally_button.add_theme_color_override("font_color", Color("#eef5f2"))
	rally_button.add_theme_color_override("font_hover_color", Color.WHITE)
	rally_button.add_theme_color_override("font_pressed_color", Color.WHITE)
	squad.add_child(rally_button)
	var rally_key := HotkeyBadge.new()
	rally_button.add_child(rally_key)
	rally_key.setup("R")
	rally_key.set_anchors_and_offsets_preset(PRESET_CENTER_RIGHT)
	rally_key.offset_left = -46
	rally_key.offset_right = -18
	rally_key.offset_top = -14
	rally_key.offset_bottom = 14
	rally_button.mouse_entered.connect(func(): rally_key.set_active(not rally_button.disabled))
	rally_button.mouse_exited.connect(func(): rally_key.set_active(false))

func _build_sites() -> void:
	sites_panel = Style.anchored(self, "ObjectiveTracker", PRESET_TOP_RIGHT, Rect2(-332, 136, 308, 200))
	sites_panel.add_theme_stylebox_override("panel", HudArt.panel("hud_discovery_panel", Vector4(22, 20, 22, 14)))
	var sites := VBoxContainer.new()
	sites.add_theme_constant_override("separation", 9)
	sites_panel.add_child(sites)
	objective = UI.label("", 17, Style.INK)
	var discovery_heading := HBoxContainer.new()
	discovery_heading.add_theme_constant_override("separation", 7)
	discovery_heading.add_child(HudArt.picture("icon_location_pin", Vector2(16, 20)))
	discovery_heading.add_child(objective)
	sites.add_child(discovery_heading)
	var header_gap := Control.new()
	header_gap.custom_minimum_size.y = 10
	sites.add_child(header_gap)
	sites_scroll = ScrollContainer.new()
	sites_scroll.name = "SiteScroll"
	sites_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sites_scroll.mouse_force_pass_scroll_events = true
	sites_scroll.size_flags_vertical = SIZE_FILL
	sites_scroll.custom_minimum_size.y = 116
	sites.add_child(sites_scroll)
	site_list = VBoxContainer.new()
	site_list.size_flags_horizontal = SIZE_EXPAND_FILL
	site_list.add_theme_constant_override("separation", 6)
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
	expand_button = UI.button("查看全部", func(): set_objectives_expanded(not objectives_expanded), Vector2(0, 40))
	expand_button.icon = HudArt.texture("icon_arrow_right")
	expand_button.expand_icon = true
	expand_button.icon_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	expand_button.add_theme_constant_override("icon_max_width", 18)
	expand_button.add_theme_font_size_override("font_size", 15)
	# The discovery artwork already includes its footer button plate.
	for state: String in ["normal", "hover", "pressed", "disabled", "focus"]:
		var footer_inset := StyleBoxEmpty.new()
		footer_inset.content_margin_left = 20
		footer_inset.content_margin_right = 20
		expand_button.add_theme_stylebox_override(state, footer_inset)
	expand_button.add_theme_color_override("font_color", Color("#e8f0ea"))
	expand_button.add_theme_color_override("font_hover_color", Color.WHITE)
	expand_button.add_theme_color_override("font_pressed_color", Color.WHITE)
	sites.add_child(expand_button)
	_update_tracker()

func set_objectives_expanded(expanded: bool) -> void:
	objectives_expanded = expanded
	sites_scroll.custom_minimum_size.y = 296 if expanded else 116
	expand_button.text = "收起" if expanded else "查看全部"
	expand_button.icon = HudArt.texture("icon_chevron_down" if expanded else "icon_arrow_right")
	_update_tracker()
	sites_panel.reset_size()

func _update_tracker() -> void:
	var ids: Array = mission.city.sites.keys()
	ids.sort_custom(func(a: String, b: String): return _site_priority(a) < _site_priority(b))
	var shown: int = 0
	for i: int in range(ids.size()):
		var id: String = ids[i]
		var entry: Button = site_buttons[id]
		entry.visible = mission.city.sites[id].discovered and (objectives_expanded or (shown < 3 and not mission.city.sites[id].searched))
		if entry.visible:
			shown += 1
		site_list.move_child(entry, i)
	_fit_tracker()

func _site_priority(id: String) -> float:
	var site: Dictionary = mission.city.sites[id]
	return (-20000.0 if mission.search_tasks.has(id) else -10000.0 if mission.poi_selected_id == id else 0.0) + (100000.0 if site.searched else 0.0) + site.spec.entry.distance_squared_to(mission.squad_center())

func _build_commands() -> void:
	var dock_width: float = (3 + mission.powers.states.size()) * 120 + (mission.powers.states.size() + 2) * 12
	command_panel = Style.anchored(self, "ActionIcons", PRESET_CENTER_BOTTOM, Rect2(-dock_width / 2, -172, dock_width, 132))
	command_panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	command_panel.add_child(row)
	var actions: Array[Array] = [
		["停止", "X", HudArt.texture("icon_stop"), mission.command_stop],
		["集火", "F", HudArt.texture("icon_focus_fire"), mission.command_focus_nearest],
		["定位", "L", HudArt.texture("icon_locate"), mission.center_squad]
	]
	for spec: Array in actions:
		var action := ActionIcon.new()
		row.add_child(action)
		action.setup(spec[0], spec[1], spec[2], spec[3])
		command_buttons[spec[0]] = action
	var locate_key := InputEventKey.new()
	locate_key.physical_keycode = KEY_L
	command_buttons["定位"].shortcut = Shortcut.new()
	command_buttons["定位"].shortcut.events = [locate_key]
	command_buttons["定位"].shortcut_in_tooltip = false
	command_buttons["定位"].tooltip_text = "L · 恢复镜头跟随 · WASD / 拖动自由查看 · 滚轮缩放"
	power_panel = PanelContainer.new()
	power_panel.name = "Abilities"
	power_panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	row.add_child(power_panel)
	var abilities := HBoxContainer.new()
	abilities.add_theme_constant_override("separation", 12)
	power_panel.add_child(abilities)
	var power_index: int = 0
	for id: String in mission.powers.states:
		var definition: Resource = mission.powers.states[id].definition
		var ability := ActionIcon.new()
		abilities.add_child(ability)
		power_index += 1
		var ability_icon: Texture2D = HudArt.texture("icon_rage") if id == "rage" else definition.icon
		ability.setup(definition.display_name, str(power_index), ability_icon, func(): mission.powers.activate(id); refresh(), 120)
		var key_event := InputEventKey.new()
		key_event.physical_keycode = KEY_0 + power_index
		ability.shortcut = Shortcut.new()
		ability.shortcut.events = [key_event]
		ability.shortcut_in_tooltip = false
		ability.tooltip_text = str(power_index) + " · " + definition.description() + " · 每日一次"
		power_buttons[id] = ability
	extract_button = ActionIcon.new()
	extract_button.name = "ReturnHome"
	add_child(extract_button)
	extract_button.set_anchors_and_offsets_preset(PRESET_BOTTOM_RIGHT)
	extract_button.family = "hud_return"
	extract_button.offset_left = -286
	extract_button.offset_right = -24
	extract_button.offset_top = -140
	extract_button.offset_bottom = -24
	extract_button.setup("返回巴士", "E", HudArt.texture("icon_return"), mission.command_extract, 262)
	order_label = UI.label("", 11, Style.PAPER)
	order_label.set_anchors_and_offsets_preset(PRESET_CENTER_BOTTOM)
	order_label.offset_left = -dock_width / 2
	order_label.offset_top = -202
	add_child(order_label)
	toast_panel = Style.anchored(self, "LootToast", PRESET_CENTER_BOTTOM, Rect2(-240, -248, 480, 72))
	toast_panel.add_theme_stylebox_override("panel", HudArt.surface("loot_toast_bg", Vector4(12, 8, 12, 8)))
	toast = UI.label("", 14, Style.INK)
	toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	toast_panel.add_child(toast)
	toast_panel.hide()

func _process(delta: float) -> void:
	toast_left -= delta
	if toast_left <= 0 and not search_notices.is_empty():
		search_notices.pop_front()
		if not search_notices.is_empty():
			toast.text = search_notices[0].text
			toast_left = 4.0
	toast.visible = toast_left > 0
	toast_panel.visible = toast.visible
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
	var current_ids: Array[int] = []
	for member: Node3D in mission.survivors:
		current_ids.append(member.get_instance_id())
	if current_ids != roster_ids:
		squad_panel.free()
		squad_cards.clear()
		squad_labels.clear()
		roster_ids.clear()
		_build_squad()
		HudArt.pass_decorations(squad_panel)
		_fit_window()
	for id: String in power_buttons:
		var state = mission.powers.states[id]
		power_buttons[id].set_state(mission.input_enabled and mission.powers.can_activate(id), state.active, str(ceili(state.remaining_duration)) + "s" if state.active else "已用" if state.used_today else "")
	var available: bool = mission.input_enabled and mission.active and mission.closing_left < 0
	command_buttons["停止"].set_state(available and not mission.guards().is_empty(), mission.order.begins_with("停止"))
	command_buttons["集火"].set_state(available and not mission.guards().is_empty(), is_instance_valid(mission.focus_target))
	command_buttons["定位"].set_state(available, mission.camera_controller.following)
	watch_label.visible = mission.watch_warning_active
	var priority: Node3D = mission.powers.target()
	focus_label.visible = false
	focus_label.text = ("集火 · " + priority.data.display_name if priority != null else "") + (" 暮色延缓" if mission.effects.amount("freeze_day_clock") > 0 else "")
	var clock = mission.clock
	phase_label.text = ["白昼", "蓝时", "夜晚"][clock.phase]
	phase_icon.texture = HudArt.texture(["icon_phase_day", "icon_phase_blue_hour", "icon_phase_night"][clock.phase])
	var phase_step_index: int = 0 if clock.phase == clock.DAY else 2 if clock.phase == clock.BLUE_HOUR else 3
	for index: int in range(phase_steps.size()):
		phase_steps[index].add_theme_color_override("font_color", Style.CYAN if index == phase_step_index else Style.MUTED)
	if clock.warning_active:
		phase_label.text = "黄昏预警"
		phase_icon.texture = HudArt.texture("icon_phase_warning")
		if phase_steps.size() > 1:
			phase_steps[1].add_theme_color_override("font_color", Style.GOLD)
	var phase_color: Color = [Style.GOLD.lerp(Style.CYAN, clampf(1.0 - clock.remaining() / 40.0, 0, 1)), Style.CYAN, Color("#e8a8a3")][clock.phase]
	phase_label.add_theme_color_override("font_color", phase_color)
	var seconds: int = ceili(clock.remaining())
	clock_label.text = "%02d:%02d" % [seconds / 60, seconds % 60]
	day_label.text = "第 %d 天" % (mission.campaign.data.day if mission.campaign != null else 1)
	phase_hint.text = "距蓝时" if clock.phase == clock.DAY else "距夜幕 · 尽快归航" if clock.phase == clock.BLUE_HOUR else "夜幕警戒 %d" % clock.threat_level()
	if clock.warning_active:
		phase_hint.text = "感染者正在躁动"
	phase_progress.modulate = phase_color
	phase_progress.value = clock.remaining()
	phase_progress.max_value = clock.settings.day_seconds if clock.phase == clock.DAY else clock.settings.blue_seconds
	resource_counts[0].text = "%02d" % mission.ledger.food
	resource_counts[1].text = "%02d" % mission.ledger.scrap
	resource_counts[2].text = "—"
	squad_heading.text = "外勤 %d · 掩护 %d · 搜索 %d" % [mission.living().size(), mission.guards().size(), mission.search_tasks.size()]
	for i: int in range(squad_cards.size()):
		squad_cards[i].update_member(mission.survivors[i], mission)
		squad_cards[i].set_selected(mission.survivors[i] == selected_member)
	rally_button.disabled = not mission.active or mission.closing_left >= 0
	var remaining: int = 0
	for id: String in site_buttons:
		site_buttons[id].update_site(id, mission)
		if mission.city.sites[id].discovered:
			remaining += 1
	objective.text = "第 %d 天 · 已发现 %d" % [mission.campaign.data.day if mission.campaign != null else 1, remaining]
	order_label.text = mission.order
	extract_button.caption.text = "返回巴士"
	if mission.extraction:
		order_label.text = "归航 %d/%d · %.1fs" % [mission.board_count(), mission.living().size(), mission.extraction_left]
		extract_button.caption.text = "集合 %d/%d" % [mission.board_count(), mission.living().size()]
	extract_button.set_state(available, mission.extraction and available)
	if mission.closing_left >= 0:
		order_label.text = "车门关闭 · 归航"
		extract_button.caption.text = "正在归航"
	pause_button.text = "菜单"
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
	pause_menu = Style.anchored(self, "PauseMenu", PRESET_CENTER, Rect2(-230, -180, 460, 360))
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
	if game_settings != null:
		column.add_child(UI.button("设置", _open_settings))
	column.add_child(UI.button("返回主菜单", func(): main_menu_requested.emit()))
	pause_menu.hide()
	if game_settings != null:
		settings_menu = Style.anchored(self, "SettingsMenu", PRESET_CENTER, Rect2(-330, -300, 660, 600))
		var settings_column := VBoxContainer.new()
		settings_column.add_theme_constant_override("separation", 12)
		settings_menu.add_child(settings_column)
		var settings_heading := UI.label("设置", 30, Style.CYAN)
		settings_heading.name = "SettingsHeading"
		settings_heading.custom_minimum_size.y = 44
		settings_heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		settings_heading.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		settings_column.add_child(settings_heading)
		settings_view = SettingsView.new()
		settings_column.add_child(settings_view)
		settings_view.setup(game_settings, Style.PAPER, Style.MUTED, Style.CYAN)
		settings_view.close_requested.connect(_close_settings)
		settings_menu.hide()

func show_notice(text: String) -> void:
	# Completion summaries retain their worker/target identity while pickups arrive.
	if not search_notices.is_empty():
		return
	toast.text = text
	toast_left = 4.0

func _show_search_result(id: String, worker_name: String, loot: Dictionary, collected: bool = false) -> void:
	var rewards: PackedStringArray = []
	if int(loot.food) > 0:
		rewards.append("食物 +%d" % int(loot.food))
	if int(loot.scrap) > 0:
		rewards.append("废料 +%d" % int(loot.scrap))
	if not loot.get("weapon", {}).is_empty() and mission.campaign != null:
		rewards.append(mission.campaign.gear.title(loot.weapon) + " ×1")
	var text: String = "%s完成搜索：%s\n%s：%s" % [worker_name, mission.city.sites[id].spec.name,
		"获得" if collected else "找到", " · ".join(rewards) if not rewards.is_empty() else "暂无物资"]
	for index: int in range(search_notices.size()):
		if search_notices[index].id == id:
			search_notices[index].text = text
			if index == 0:
				toast.text = text
				toast_left = 4.0
			return
	search_notices.append({"id": id, "text": text})
	if search_notices.size() == 1:
		toast.text = text
		toast_left = 4.0
		toast.show()
		toast_panel.show()

func toggle_pause() -> void:
	if debug_menu.visible or pause_menu.visible or _settings_open():
		return
	paused = not paused
	_sync_pause()
	show_notice("行动暂停" if paused else "继续行动")

func toggle_debug() -> void:
	if pause_menu.visible or _settings_open():
		return
	debug_menu.toggle()

func toggle_menu() -> void:
	if debug_menu.visible:
		debug_menu.toggle()
		return
	if _settings_open():
		_close_settings()
		return
	pause_menu.visible = not pause_menu.visible
	_sync_pause()

func _sync_pause() -> void:
	menu_backdrop.visible = pause_menu.visible or _settings_open() or debug_menu.visible
	mission.time_scale = 0.0 if paused or pause_menu.visible or _settings_open() or debug_menu.visible else debug_menu.speed
	mission.input_enabled = not pause_menu.visible and not _settings_open() and not debug_menu.visible and (mission.arrival == null or mission.arrival.finished)
	mission.controls.reset()
	refresh()

func _open_settings() -> void:
	pause_menu.hide()
	settings_menu.show()
	_sync_pause()
	settings_view.focus_first.call_deferred()

func _close_settings() -> void:
	settings_view.commit()
	settings_menu.hide()
	pause_menu.show()
	_sync_pause()

func _settings_open() -> bool:
	return is_instance_valid(settings_menu) and settings_menu.visible
