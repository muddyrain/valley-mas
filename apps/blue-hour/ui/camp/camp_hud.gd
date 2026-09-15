extends Control
## A screen-space 1920x1080 composition, fitted locally without changing the
## game's viewport/stretch settings or the camp camera.
const CampArt = preload("res://ui/camp/camp_skin.gd")
const Surface = preload("res://ui/camp/camp_surface.gd")
const CampButton = preload("res://ui/camp/camp_texture_button.gd")
const Model = preload("res://ui/camp/camp_view_model.gd")
const REFERENCE := Vector2(1920, 1080)
var owner_ui: Control
var app: Node
var model: RefCounted
var composition: Control
var resource_values: Dictionary = {}
var phase_label: Label
var phase_time: Label
var phase_remaining: Label
var phase_caption: Label
var day_label: Label
var phase_icon: TextureRect
var phase_dots: Array[TextureRect] = []
var phase_progress: ColorRect
var roster_heading: Label
var slot_buttons: Array[Button] = []
var quick_buttons: Array[Button] = []
var _elapsed: float = 0.0
var _resource_previous: Dictionary = {}

func setup(screen: Control) -> void:
	owner_ui = screen
	app = screen.app
	model = Model.new(app)
	name = "CampHUD"
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	mouse_filter = MOUSE_FILTER_IGNORE
	theme = CampArt.theme()
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	composition = Control.new()
	composition.name = "CampComposition1920"
	composition.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(composition)
	composition.size = REFERENCE
	resized.connect(_fit)
	_build_identity()
	_build_timeline()
	_build_resources()
	_build_roster()
	_build_powers()
	_build_equipment()
	var depart: Button = _button("今日行动", app.show_today_action, "depart", Rect2(1495, 891, 408, 179), null, "D E P A R T", 42)
	depart.name = "TodayActionButton"
	owner_ui.departure = depart
	var back: Button = _button("返回主菜单", app.show_main_menu, "plain", Rect2(28, 1013, 184, 41), CampArt.texture(225), "", 17)
	back.tooltip_text = "返回主菜单"
	var version := CampArt.label("Blue Hour Homeward  /  " + str(ProjectSettings.get_setting("application/config/version")), 12, CampArt.WHITE)
	version.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	CampArt.place(version, composition, Rect2(1550, 1056, 340, 22))
	_fit()
	_update_values()

func _process(delta: float) -> void:
	_elapsed += delta
	if _elapsed >= 0.25 and is_visible_in_tree():
		_elapsed = 0.0
		_update_values()

func _unhandled_key_input(event: InputEvent) -> void:
	if not is_visible_in_tree() or app.state != "shelter" or owner_ui.ui_state not in [owner_ui.Mode.NORMAL, owner_ui.Mode.SURVIVOR_PANEL]:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		var key: int = event.physical_keycode if event.physical_keycode != 0 else event.keycode
		var index: int = key - KEY_1
		if index >= 0 and index < quick_buttons.size() and not quick_buttons[index].disabled:
			quick_buttons[index].pressed.emit()
			get_viewport().set_input_as_handled()

func _fit() -> void:
	if composition == null:
		return
	var factor: float = minf(size.x / REFERENCE.x, size.y / REFERENCE.y)
	composition.scale = Vector2.ONE * factor
	composition.position = (size - REFERENCE * factor) * 0.5

func _button(value: String, callback: Callable, family: String, rect: Rect2, icon: Texture2D = null, subtitle: String = "", font_size: int = 18, parent: Control = null) -> Button:
	var result := CampButton.new()
	CampArt.place(result, composition if parent == null else parent, rect)
	result.setup(value, callback, family, icon, subtitle, font_size)
	owner_ui._buttons.append(result)
	return result

func _surface(id: int, rect: Rect2, parent: Control = null, corners: float = 80, edge: float = 0.12) -> PanelContainer:
	var result := Surface.new()
	result.configure(id, corners, edge)
	CampArt.place(result, composition if parent == null else parent, rect)
	return result

func _build_identity() -> void:
	var logo := CampArt.icon(preload("res://ui/menu_art.gd").logo(), Vector2.ZERO)
	logo.name = "OfficialBrandLogo"
	CampArt.place(logo, composition, Rect2(27, 11, 250, 99))
	var info := _surface(220, Rect2(25, 119, 276, 177), null, 120, 0.16)
	info.name = "DayStatus"
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 2)
	CampArt.place(content, composition, Rect2(46, 131, 230, 144))
	content.add_child(CampArt.label("东岸营地", 26))
	content.add_child(CampArt.label("E A S T   C O A S T   C A M P", 10, CampArt.MUTED))
	var day := HBoxContainer.new()
	day.add_theme_constant_override("separation", 22)
	content.add_child(day)
	day.add_child(CampArt.label("DAY %02d" % app.campaign.data.day, 20))
	day.add_child(CampArt.label("第 %d 天" % app.campaign.data.day, 20))
	owner_ui.day_status = CampArt.label("缺粮 · 生命上限 %d%%" % (app.campaign.health_multiplier()*100) if app.campaign.data.hunger > 0 else "已休整，准备出发。", 16)
	owner_ui.day_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	content.add_child(owner_ui.day_status)

func _build_timeline() -> void:
	_surface(220, Rect2(571, 20, 686, 88), null, 80, 0.17)
	var phase := _button("", func(): owner_ui._show_phase(true), "plain", Rect2(582, 28, 145, 70))
	phase.name = "PhaseStatus"
	# Timeline details open on click, keeping hover purely visual and stable.
	phase_icon = CampArt.icon(CampArt.texture(204), Vector2.ZERO)
	CampArt.place(phase_icon, phase, Rect2(8, 12, 45, 45))
	phase_label = CampArt.label("", 25)
	CampArt.place(phase_label, phase, Rect2(62, 4, 94, 36))
	phase_time = CampArt.label("", 17)
	CampArt.place(phase_time, phase, Rect2(62, 38, 94, 28))
	var track := CampArt.icon(CampArt.texture(11), Vector2.ZERO)
	# Use the original track between its baked example markers; all four current
	# markers remain independent and can follow the real clock.
	var strip := AtlasTexture.new()
	strip.atlas = CampArt.texture(11)
	strip.region = Rect2(180, 54, 330, 31)
	track.texture = strip
	track.stretch_mode = TextureRect.STRETCH_SCALE
	CampArt.place(track, composition, Rect2(782, 43, 315, 10))
	phase_progress = ColorRect.new()
	phase_progress.mouse_filter = MOUSE_FILTER_IGNORE
	phase_progress.color = CampArt.CYAN
	CampArt.place(phase_progress, composition, Rect2(771, 46, 0, 4))
	for index: int in range(4):
		var dot := CampArt.icon(CampArt.texture(204 + index), Vector2.ZERO)
		dot.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		dot.clip_contents = true
		# Use a square box for every marker so source icon aspect ratios cannot
		# introduce the compressed/expanded look seen in the timeline.
		CampArt.place(dot, composition, Rect2(769 + index * 105, 32, 30, 30))
		phase_dots.append(dot)
		var label := CampArt.label(["白昼", "黄昏预警", "蓝时", "夜晚"][index], 13)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		CampArt.place(label, composition, Rect2(742 + index * 105, 67, 85, 25))
	day_label = CampArt.label("", 23)
	day_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CampArt.place(day_label, composition, Rect2(1134, 27, 101, 29))
	phase_caption = CampArt.label("", 12)
	phase_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CampArt.place(phase_caption, composition, Rect2(1134, 59, 101, 17))
	phase_remaining = CampArt.label("", 16)
	phase_remaining.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CampArt.place(phase_remaining, composition, Rect2(1134, 76, 101, 23))

func _build_resources() -> void:
	var definitions: Array[Array] = [["food", "食物", 201], ["scrap", "废料", 202], ["intel", "情报", 203]]
	for index: int in range(3):
		var definition: Array = definitions[index]
		var x: float = 1340 + index * 140
		_surface(20, Rect2(x, 25, 123, 69), null, 95, 0.10)
		CampArt.place(CampArt.icon(CampArt.texture(definition[2]), Vector2.ZERO), composition, Rect2(x+12, 39, 39, 39))
		CampArt.place(CampArt.label(definition[1], 16), composition, Rect2(x+60, 31, 61, 25))
		var amount := CampArt.label("", 24)
		CampArt.place(amount, composition, Rect2(x+60, 53, 61, 30))
		resource_values[definition[0]] = amount
	var menu := _button("菜单", owner_ui.show_menu, "secondary", Rect2(1773, 25, 128, 69), CampArt.texture(208), "M E N U", 20)
	menu.name = "CampMenu"
	menu.icon_view.custom_minimum_size = Vector2(34, 34)

func _build_roster() -> void:
	var rail := _surface(226, Rect2(1778, 154, 122, 1), null, 80, 0.12)
	rail.name = "PartyPanel"
	# Stable rail aligned with the survivor detail card; overflow scrolls without
	# exposing a scrollbar and therefore remains usable for larger rosters.
	var member_count: int = app.campaign.data.members.size()
	var rail_height: float = 48.0 + member_count * 108.0 + maxf(0, member_count - 1) * 7.0 + 18.0
	rail.size = Vector2(122, rail_height)
	owner_ui.party_panel = rail
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	rail.add_child(column)
	roster_heading = CampArt.label("幸存者 %d/%d" % [app.campaign.data.selected_party.size(), app.campaign.data.members.size()], 14, CampArt.WHITE)
	roster_heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(roster_heading)
	var scroll := ScrollContainer.new()
	scroll.name = "SurvivorRosterScroll"
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	scroll.add_theme_constant_override("scrollbar_width", 0)
	scroll.custom_minimum_size.y = member_count * 108.0 + maxf(0, member_count - 1) * 7.0
	column.add_child(scroll)
	var cards := VBoxContainer.new()
	cards.size_flags_horizontal = SIZE_EXPAND_FILL
	cards.add_theme_constant_override("separation", 7)
	scroll.add_child(cards)
	for id: String in app.campaign.data.members:
		var member: Dictionary = model.survivor(id)
		var card := CampButton.new()
		cards.add_child(card)
		card.custom_minimum_size = Vector2(108, 108)
		card.setup("", func(): app.select_member(id), "roster")
		card.name = "Party_" + id.replace(":", "_")
		card.toggle_mode = true
		card.set_pressed_no_signal(id == app.selected_member)
		card.set_selected(id == app.selected_member)
		owner_ui.member_buttons[id] = card
		owner_ui._buttons.append(card)
		var portrait: TextureRect = CampArt.icon(member.portrait, Vector2.ZERO)
		if member.portrait != null:
			var face := AtlasTexture.new()
			face.atlas = member.portrait
			face.region = Rect2(Vector2(0.20, 0.015) * member.portrait.get_size(), Vector2(0.60, 0.67) * member.portrait.get_size())
			portrait.texture = face
		card.add_child(portrait)
		CampArt.full_rect(portrait)
		portrait.offset_left = 6
		portrait.offset_top = 6
		portrait.offset_right = -6
		portrait.offset_bottom = -13
		if portrait.texture == null:
			var initial := CampArt.label(str(member.name).left(1), 42, CampArt.WHITE)
			initial.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			portrait.add_child(initial)
			CampArt.full_rect(initial)
		card.move_child(card.skin, card.get_child_count()-1)
		var readiness := CampArt.label("Lv.%d" % member.level, 12, CampArt.WHITE)
		readiness.name = "Readiness"
		readiness.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		card.add_child(readiness)
		readiness.set_anchors_and_offsets_preset(PRESET_BOTTOM_WIDE)
		readiness.offset_top = -22
		readiness.offset_bottom = -3
		if app.campaign.data.hunger > 0:
			var warning := CampArt.icon(CampArt.texture(44), Vector2.ZERO)
			card.add_child(warning)
			CampArt.full_rect(warning)

func _build_powers() -> void:
	var scroll := ScrollContainer.new()
	scroll.name = "PowerSlots"
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	CampArt.place(scroll, composition, Rect2(32, 333, 135, 452))
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 18)
	scroll.add_child(column)
	var slots: Array = app.campaign.data.power_slots
	for index: int in range(app.campaign.data.power_capacity):
		var id: String = str(slots[index]) if index < slots.size() else ""
		var definition: Resource = app.campaign.effect_definition("power", id)
		var group := VBoxContainer.new()
		group.add_theme_constant_override("separation", 2)
		column.add_child(group)
		var entry := CampButton.new()
		entry.custom_minimum_size = Vector2(109, 109)
		group.add_child(entry)
		entry.setup("", func(): owner_ui.show_effect_detail("power", id, true), "quick", definition.icon if definition != null else null)
		entry.icon_view.custom_minimum_size = Vector2(61, 61)
		entry.name = "Effect_power_" + id
		owner_ui._buttons.append(entry)
		quick_buttons.append(entry)
		# Details open on click only; this prevents a transient hover card from
		# competing with the persistent replacement panel.
		var label := _button(definition.display_name if definition != null else "选择技能", func(): owner_ui.show_effect_detail("power", id, true), "secondary", Rect2(), null, "", 15, group)
		label.custom_minimum_size = Vector2(123, 28)
		label.name = "QuickActionLabel"
		var key_hint := CampArt.label(str(index + 1) + "  ·  出勤可用", 12, CampArt.WHITE)
		key_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		group.add_child(key_hint)
	var locked_center := CenterContainer.new()
	locked_center.custom_minimum_size = Vector2(135, 109)
	column.add_child(locked_center)
	var locked := CampButton.new()
	locked_center.add_child(locked)
	locked.custom_minimum_size = Vector2(109, 109)
	locked.setup("", func(): owner_ui.show_slot_detail("power", true), "quick", CampArt.texture(223))
	locked.name = "Unlock_power"
	locked.disabled = true
	# The lock artwork includes a soft outer glow; keep it inside a smaller,
	# centered box so it does not overpower the quick-action plate.
	locked.size_flags_horizontal = SIZE_SHRINK_CENTER
	locked.icon_view.custom_minimum_size = Vector2(40, 40)
	locked.icon_view.size_flags_horizontal = SIZE_SHRINK_CENTER
	locked.icon_view.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	owner_ui._buttons.append(locked)
	var unlock_label := CampArt.label("后续解锁", 16, Color("#a1b7c7"))
	unlock_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(unlock_label)

func _build_equipment() -> void:
	var capacity: int = app.campaign.data.passive_capacity
	var slots: Array = app.campaign.data.passive_slots
	var width: float = minf(510, 169 + (capacity + 1) * 84)
	var origin := Vector2(960 - width * 0.5, 933)
	_surface(80, Rect2(origin, Vector2(width, 103)), null, 90, 0.17)
	CampArt.place(CampArt.icon(CampArt.texture(212), Vector2.ZERO), composition, Rect2(origin+Vector2(15, 25), Vector2(48, 48)))
	CampArt.place(CampArt.label("作战装备", 17), composition, Rect2(origin+Vector2(74, 24), Vector2(88, 25)))
	CampArt.place(CampArt.label("%d/%d" % [slots.size(), capacity], 27), composition, Rect2(origin+Vector2(74, 49), Vector2(83, 35)))
	var scroll := ScrollContainer.new()
	scroll.name = "ItemSlots"
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	CampArt.place(scroll, composition, Rect2(origin+Vector2(163, 14), Vector2(width-180, 79)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 9)
	scroll.add_child(row)
	for index: int in range(capacity):
		var id: String = str(slots[index]) if index < slots.size() else ""
		var definition: Resource = app.campaign.effect_definition("passive", id)
		var entry := _button("＋" if id.is_empty() else "", func(): owner_ui.show_effect_detail("passive", id, true), "slot", Rect2(), definition.icon if definition != null else null, "", 32, row)
		entry.name = "Effect_passive_" + id
		entry.custom_minimum_size = Vector2(73, 73)
		entry.icon_view.custom_minimum_size = Vector2(53, 53)
		entry.main_label.add_theme_color_override("font_color", CampArt.MUTED)
		# Details open on click only; keep one information surface per item.
		slot_buttons.append(entry)
	var locked := _button("", func(): owner_ui.show_slot_detail("passive", true), "slot", Rect2(), CampArt.texture(223), "", 18, row)
	locked.name = "Unlock_passive"
	locked.custom_minimum_size = Vector2(73, 73)
	locked.size_flags_horizontal = SIZE_SHRINK_CENTER
	locked.icon_view.custom_minimum_size = Vector2(36, 36)
	locked.icon_view.size_flags_horizontal = SIZE_SHRINK_CENTER
	locked.icon_view.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	locked.disabled = true
	locked.tooltip_text = "槽位尚未解锁"

func _update_values() -> void:
	var stock: Dictionary = model.resources()
	for id: String in resource_values:
		var next_value: String = str(stock[id])
		var previous_value: String = str(_resource_previous.get(id, next_value))
		resource_values[id].text = next_value
		if previous_value != next_value and next_value.is_valid_int() and previous_value.is_valid_int():
			_show_resource_feedback(id, int(next_value) - int(previous_value))
		_resource_previous[id] = next_value
	var clock: Dictionary = model.timeline()
	phase_label.text = clock.phase
	phase_time.text = clock.elapsed
	phase_remaining.text = clock.remaining
	phase_caption.text = clock.caption
	day_label.text = "第 %d 天" % clock.day
	phase_icon.texture = CampArt.texture(204 + int(clock.stage))
	phase_progress.size.x = 315 * clock.progress
	for index: int in range(phase_dots.size()):
		phase_dots[index].modulate = Color.WHITE if index == clock.stage else Color(0.52, 0.61, 0.68)

func _show_resource_feedback(id: String, delta: int) -> void:
	var label := CampArt.label(("+" if delta > 0 else "") + str(delta), 14, CampArt.CYAN if delta > 0 else Color("#f0c17c"))
	var anchor: Label = resource_values[id]
	label.position = anchor.position + Vector2(anchor.size.x - 28, -4)
	composition.add_child(label)
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "position", label.position + Vector2(0, -18), 0.9)
	tween.tween_property(label, "modulate", Color(1, 1, 1, 0), 0.9)
	tween.chain().tween_callback(label.queue_free)

func select_member(id: String) -> void:
	for member: String in owner_ui.member_buttons:
		var button: Button = owner_ui.member_buttons[member]
		button.set_pressed_no_signal(member == id)
		button.set_selected(member == id)

func clear_slot_selection() -> void:
	for button: Button in slot_buttons + quick_buttons:
		button.set_selected(false)
