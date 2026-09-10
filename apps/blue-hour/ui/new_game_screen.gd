extends Control

const UI = preload("res://ui/ui_style.gd")
const MenuArt = preload("res://ui/menu_art.gd")
const Art = preload("res://ui/new_run_art.gd")
const SHADE = preload("res://ui/menu_shade.gdshader")

var app: Node
var selected := "scavenge"
var selected_effect := 1
var tabs: Dictionary = {}
var tab_glows: Dictionary = {}
var tab_tapes: Dictionary = {}
var cards: Array[Button] = []
var card_plates: Array[TextureRect] = []
var card_art: Array[TextureRect] = []
var card_glows: Array[TextureRect] = []
var effect_titles: Array[Label] = []
var effect_descriptions: Array[Label] = []
var confirm_button: Button
var unlock_button: Button
var composition: Control
var tooltip_title: Label
var tooltip_badge: Label
var tooltip_flavor: Label
var tooltip_prefix: Label
var tooltip_summary: Label
var tab_focus_id := ""
var menu_buttons: Array[Button] = []
var menu_window: Window
var previous_aspect: Window.ContentScaleAspect
var body_font: Font
var body_bold: Font
var title_font: Font

func setup(owner_app: Node) -> void:
	app = owner_app
	menu_window = get_window()
	previous_aspect = menu_window.content_scale_aspect
	menu_window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = MenuArt.theme()
	body_font = Art.body_font()
	body_bold = Art.body_font(700)
	title_font = Art.title_font()
	_build_background()
	composition = Control.new()
	composition.name = "NewRunComposition"
	composition.mouse_filter = Control.MOUSE_FILTER_IGNORE
	composition.size = Art.REFERENCE
	add_child(composition)
	_build_header()
	_build_tabs()
	_build_board()
	_build_progress_and_actions()
	_wire_focus()
	select_specialization(selected)
	resized.connect(_layout)
	_layout()
	tabs[selected].grab_focus.call_deferred()
	composition.modulate.a = 0.0
	create_tween().tween_property(composition, "modulate:a", 1.0, 0.24).set_trans(Tween.TRANS_SINE)

func _build_background() -> void:
	var image := _image(self, MenuArt.BACKGROUND, Rect2(Vector2.ZERO, size), TextureRect.STRETCH_KEEP_ASPECT_COVERED)
	image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = SHADE
	material.set_shader_parameter("strength", 0.76)
	shade.material = material
	add_child(shade)
	var wash := ColorRect.new()
	wash.color = Color(0.015, 0.06, 0.13, 0.12)
	wash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	wash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(wash)

func _build_header() -> void:
	_image(composition, Art.LOGO, Rect2(51, 44, 249, 170))
	_image(composition, Art.COMPASS, Rect2(672, 25, 327, 51))
	_image(composition, Art.ROUTE_TITLE, Rect2(598, 76, 476, 56))
	_image(composition, Art.TITLE_LINE_LEFT, Rect2(535, 99, 51, 15))
	_image(composition, Art.TITLE_LINE_RIGHT, Rect2(1086, 99, 52, 15))
	var subtitle := _label(composition, "R U N   P R E P   /   S P E C I A L I Z A T I O N", Rect2(605, 137, 462, 26), 14, Art.WHITE, HORIZONTAL_ALIGNMENT_CENTER, body_bold)
	subtitle.add_theme_constant_override("outline_size", 2)
	subtitle.add_theme_color_override("font_outline_color", Color(0.02, 0.09, 0.18, 0.7))

func _build_tabs() -> void:
	var ids := ["combat", "scavenge", "survey"]
	var backgrounds := [Art.TAB_COMBAT, Art.TAB_SCAVENGE, Art.TAB_SURVEY]
	var icons := [Art.ICON_COMBAT, Art.ICON_SCAVENGE, Art.ICON_SURVEY]
	var descriptions := ["更好地面对危险。", "带回更多生存资源。", "看得更远，走得更稳。"]
	for index in range(ids.size()):
		var spec: Resource = app.catalog.by_id(app.catalog.specializations, ids[index])
		var tab := _make_tab(ids[index], spec.display_name, descriptions[index], backgrounds[index], icons[index], Vector2(281 + 277 * index, 198))
		tabs[ids[index]] = tab
		menu_buttons.append(tab)
	var locked := _make_tab("locked", "???", "尚未解锁的路线。", Art.TAB_LOCKED, Art.ICON_LOCK, Vector2(1112, 198), true)
	locked.tooltip_text = "尚未解锁的路线"

func _make_tab(id: String, heading: String, description: String, background: Texture2D, icon: Texture2D, at: Vector2, locked: bool = false) -> Button:
	var button := Button.new()
	button.name = "Route_" + id
	button.text = heading
	button.toggle_mode = not locked
	button.position = at
	button.size = Vector2(274, 160)
	Art.empty_button(button)
	composition.add_child(button)
	_image(button, background, Rect2(-10, 0, 300, 160))
	var glow := _image(button, Art.TAB_SELECTED, Rect2(-10, 0, 300, 160))
	glow.visible = false
	tab_glows[id] = glow
	var tape := _image(button, Art.TAB_TAPE, Rect2(-17, -13, 39, 41))
	tape.visible = false
	tab_tapes[id] = tape
	_image(button, icon, Rect2(33, 14, 62, 62))
	var heading_label := _label(button, heading, Rect2(92, 13, 152, 48), 31, Art.INK, HORIZONTAL_ALIGNMENT_LEFT, title_font)
	heading_label.add_theme_constant_override("outline_size", 1)
	heading_label.add_theme_color_override("font_outline_color", Color(0.75, 0.86, 0.92, 0.24))
	_label(button, "0/21", Rect2(70, 61, 140, 27), 16, Art.INK, HORIZONTAL_ALIGNMENT_CENTER, body_font)
	_image(button, Art.TAB_PROGRESS, Rect2(28, 82, 224, 24))
	_label(button, description, Rect2(24, 106, 232, 38), 16, Art.INK_SOFT, HORIZONTAL_ALIGNMENT_CENTER, body_font)
	if locked:
		button.disabled = true
		button.focus_mode = Control.FOCUS_NONE
		button.mouse_default_cursor_shape = Control.CURSOR_FORBIDDEN
	else:
		button.pressed.connect(select_specialization.bind(id))
		button.mouse_entered.connect(button.grab_focus)
		button.focus_entered.connect(_set_tab_focus.bind(id, true))
		button.focus_exited.connect(_set_tab_focus.bind(id, false))
	return button

func _build_board() -> void:
	_image(composition, Art.BOARD, Rect2(258, 327, 1158, 464))
	_build_card(0, Vector2(525, 370), "起始道具", "S U P P L Y")
	_build_card(1, Vector2(845, 370), "起始技能", "S K I L L")
	_label(composition, "下次解锁：", Rect2(661, 718, 116, 48), 20, Art.INK, HORIZONTAL_ALIGNMENT_RIGHT, body_bold)
	_image(composition, Art.TENT_STICKER, Rect2(782, 706, 69, 63))
	unlock_button = _decorated_button("查看解锁", "查看解锁", Art.BUTTON_UNLOCK, Rect2(858, 708, 160, 72), _show_unlock_hint, 19, Art.WHITE, Art.SMALL_ARROW)
	unlock_button.tooltip_text = "查看尚未开放的路线"
	menu_buttons.append(unlock_button)
	_build_tooltip()

func _build_card(index: int, at: Vector2, section: String, english: String) -> void:
	var button := Button.new()
	button.name = "EffectCard_%d" % index
	button.text = section
	button.toggle_mode = true
	button.position = at
	button.size = Vector2(300, 336)
	Art.empty_button(button)
	composition.add_child(button)
	var plate := _image(button, Art.CARD_COMPOSITE, Rect2(0, 0, 300, 336))
	card_plates.append(plate)
	var illustration := _image(button, Art.ICON_COMBAT, Rect2(94, 89, 112, 112))
	card_art.append(illustration)
	_label(button, section, Rect2(30, 13, 240, 35), 25, Art.INK, HORIZONTAL_ALIGNMENT_CENTER, title_font)
	_label(button, english, Rect2(30, 43, 240, 20), 11, Art.INK_SOFT, HORIZONTAL_ALIGNMENT_CENTER, body_bold)
	var effect_title := _label(button, "", Rect2(48, 208, 204, 50), 24, Art.INK, HORIZONTAL_ALIGNMENT_CENTER, body_bold)
	effect_titles.append(effect_title)
	var description := _label(button, "", Rect2(27, 258, 246, 62), 17, Art.INK_SOFT, HORIZONTAL_ALIGNMENT_CENTER, body_font, true)
	effect_descriptions.append(description)
	var glow := _image(button, Art.CARD_SELECTED, Rect2(-14, -8, 328, 352))
	glow.visible = false
	card_glows.append(glow)
	button.pressed.connect(_select_effect.bind(index))
	button.focus_entered.connect(_select_effect.bind(index))
	button.mouse_entered.connect(button.grab_focus)
	cards.append(button)
	menu_buttons.append(button)

func _build_tooltip() -> void:
	var panel := Control.new()
	panel.name = "EffectTooltip"
	panel.position = Vector2(1125, 366)
	panel.size = Vector2(356, 233)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	composition.add_child(panel)
	_image(panel, Art.TOOLTIP, Rect2(0, 0, 356, 233))
	tooltip_title = _label(panel, "", Rect2(31, 14, 205, 40), 25, Art.INK, HORIZONTAL_ALIGNMENT_LEFT, body_bold)
	_image(panel, Art.TOOLTIP_BADGE, Rect2(235, 13, 106, 38))
	tooltip_badge = _label(panel, "", Rect2(240, 13, 96, 38), 16, Art.INK, HORIZONTAL_ALIGNMENT_CENTER, body_bold)
	tooltip_flavor = _label(panel, "", Rect2(31, 55, 294, 65), 18, Art.INK_SOFT, HORIZONTAL_ALIGNMENT_LEFT, body_font, true)
	_image(panel, Art.TOOLTIP_RULE, Rect2(36, 118, 284, 12))
	tooltip_prefix = _label(panel, "效果：", Rect2(31, 133, 62, 35), 18, Art.ORANGE, HORIZONTAL_ALIGNMENT_LEFT, body_bold)
	tooltip_summary = _label(panel, "", Rect2(88, 133, 237, 70), 17, Art.INK_SOFT, HORIZONTAL_ALIGNMENT_LEFT, body_font, true)

func _build_progress_and_actions() -> void:
	_image(composition, Art.XP_TRACK, Rect2(478, 817, 717, 32))
	_image(composition, Art.XP_FILL, Rect2(482, 825, 12, 16))
	_label(composition, "1级", Rect2(478, 850, 90, 34), 21, Art.WHITE, HORIZONTAL_ALIGNMENT_LEFT, body_bold)
	_label(composition, "0/125", Rect2(754, 850, 164, 34), 21, Art.WHITE, HORIZONTAL_ALIGNMENT_CENTER, body_bold)
	_label(composition, "2级", Rect2(1105, 850, 90, 34), 21, Art.WHITE, HORIZONTAL_ALIGNMENT_RIGHT, body_bold)
	var cancel := _decorated_button("取消", "取消", Art.BUTTON_CANCEL, Rect2(1302, 836, 140, 72), _back, 26, Art.WHITE)
	menu_buttons.append(cancel)
	confirm_button = _decorated_button("确认创建", "确认", Art.BUTTON_CONFIRM, Rect2(1452, 829, 193, 84), func(): app.confirm_creation(selected), 28, Art.WHITE, Art.CONFIRM_ARROW)
	menu_buttons.append(confirm_button)

func _decorated_button(internal_text: String, visible_text: String, texture: Texture2D, rect: Rect2, action: Callable, font_size: int, color: Color, arrow: Texture2D = null) -> Button:
	var button := Button.new()
	button.text = internal_text
	button.position = rect.position
	button.size = rect.size
	Art.empty_button(button)
	composition.add_child(button)
	var texture_size := Vector2(texture.get_width(), texture.get_height())
	var plate := _image(button, texture, Rect2((rect.size - texture_size) * 0.5, texture_size))
	var text_right := 24.0 if arrow != null else 0.0
	_label(button, visible_text, Rect2(8, 0, rect.size.x - 16 - text_right, rect.size.y), font_size, color, HORIZONTAL_ALIGNMENT_CENTER, body_bold)
	if arrow != null:
		var arrow_size := Vector2(arrow.get_width(), arrow.get_height())
		_image(button, arrow, Rect2(rect.size.x - arrow_size.x - 16, (rect.size.y - arrow_size.y) * 0.5, arrow_size.x, arrow_size.y))
	button.pressed.connect(action)
	button.mouse_entered.connect(button.grab_focus)
	button.focus_entered.connect(func(): plate.modulate = Color(1.12, 1.12, 1.12))
	button.focus_exited.connect(func(): plate.modulate = Color.WHITE)
	return button

func select_specialization(id: String) -> void:
	var spec: Resource = app.catalog.by_id(app.catalog.specializations, id)
	if spec == null:
		return
	selected = id
	for key in tabs:
		tabs[key].set_pressed_no_signal(key == id)
	for card in cards:
		card.focus_neighbor_top = tabs[selected].get_path()
	_refresh_tab_visuals()
	var effects: Array = [app.catalog.by_id(app.catalog.passives, spec.passive_id), app.catalog.by_id(app.catalog.powers, spec.power_id)]
	for index in range(effects.size()):
		var effect: Resource = effects[index]
		cards[index].text = effect.display_name
		cards[index].tooltip_text = effect.description()
		effect_titles[index].text = effect.display_name
		effect_descriptions[index].text = _card_description(effect.id)
		card_plates[index].texture = _card_plate(effect.id)
		card_art[index].texture = _effect_art(effect.id)
		card_art[index].visible = effect.id not in ["replicator", "sprint"]
	_select_effect(1)

func _select_effect(index: int) -> void:
	if index < 0 or index >= cards.size():
		return
	selected_effect = index
	for card_index in range(cards.size()):
		cards[card_index].set_pressed_no_signal(card_index == index)
		card_glows[card_index].visible = card_index == index
	var spec: Resource = app.catalog.by_id(app.catalog.specializations, selected)
	var effect_id: String = spec.passive_id if index == 0 else spec.power_id
	var effect: Resource = app.catalog.by_id(app.catalog.passives if index == 0 else app.catalog.powers, effect_id)
	tooltip_title.text = effect.display_name
	tooltip_badge.text = "起始道具" if index == 0 else "特殊技能"
	tooltip_flavor.text = _effect_flavor(effect.id)
	tooltip_prefix.text = "效果："
	tooltip_summary.text = effect.description()

func _show_unlock_hint() -> void:
	selected_effect = -1
	for index in range(cards.size()):
		cards[index].set_pressed_no_signal(false)
		card_glows[index].visible = false
	tooltip_title.text = "下一条路线"
	tooltip_badge.text = "尚未解锁"
	tooltip_flavor.text = "更远的地方，还有新的路线。"
	tooltip_prefix.text = "状态："
	tooltip_summary.text = "更多路线仍在筹备。"

func _card_plate(effect_id: String) -> Texture2D:
	match effect_id:
		"replicator": return Art.CARD_PRINTER
		"sprint": return Art.CARD_SPEED
	return Art.CARD_COMPOSITE

func _effect_art(effect_id: String) -> Texture2D:
	match effect_id:
		"calibration": return Art.ICON_COMBAT
		"burst": return Art.ICON_RUN
		"early_start": return Art.ICON_SURVEY
		"aid": return Art.ICON_TENT
	return Art.ICON_SCAVENGE

func _card_description(effect_id: String) -> String:
	match effect_id:
		"calibration": return "让每一次远程射击更有效。"
		"replicator": return "成功归航时，有机会复制一把武器。"
		"early_start": return "为今天争取更长的白昼。"
		"burst": return "短时间提高全队伤害。"
		"sprint": return "让全队跑得更快一些。"
		"aid": return "恢复所有存活队员的生命。"
	return ""

func _effect_flavor(effect_id: String) -> String:
	match effect_id:
		"calibration": return "把枪械调整到最可靠的状态，再去面对街上的危险。"
		"replicator": return "一次幸运的归航，也许能为营地多留下一把武器。"
		"early_start": return "趁城市还没醒来，为今天多争取一点时间。"
		"burst": return "最危险的几秒里，让所有人同时压上火力。"
		"sprint": return "偶尔得跑起来，因为有时候真的得逃命了。"
		"aid": return "先把所有人从危险边缘拉回来。"
	return ""

func _set_tab_focus(id: String, focused: bool) -> void:
	tab_focus_id = id if focused else ""
	_refresh_tab_visuals()

func _refresh_tab_visuals() -> void:
	for key in tab_glows:
		var active: bool = key == selected
		var focused: bool = key == tab_focus_id
		tab_glows[key].visible = active or focused
		tab_glows[key].modulate.a = 1.0 if active else 0.58
		tab_tapes[key].visible = active

func _wire_focus() -> void:
	MenuArt.flow_focus(menu_buttons)
	var ids := ["combat", "scavenge", "survey"]
	for index in range(ids.size()):
		var tab: Button = tabs[ids[index]]
		tab.focus_neighbor_left = tabs[ids[posmod(index - 1, ids.size())]].get_path()
		tab.focus_neighbor_right = tabs[ids[(index + 1) % ids.size()]].get_path()
		tab.focus_neighbor_bottom = cards[0 if index == 0 else 1].get_path()
	for index in range(cards.size()):
		cards[index].focus_neighbor_left = cards[posmod(index - 1, cards.size())].get_path()
		cards[index].focus_neighbor_right = cards[(index + 1) % cards.size()].get_path()
		cards[index].focus_neighbor_top = tabs[selected].get_path()
		cards[index].focus_neighbor_bottom = unlock_button.get_path() if index == 0 else confirm_button.get_path()
	unlock_button.focus_neighbor_top = cards[0].get_path()
	unlock_button.focus_neighbor_bottom = confirm_button.get_path()
	confirm_button.focus_neighbor_top = cards[1].get_path()

func _layout() -> void:
	if composition == null:
		return
	var factor := minf(size.x / Art.REFERENCE.x, size.y / Art.REFERENCE.y)
	composition.scale = Vector2.ONE * factor
	composition.position = (size - Art.REFERENCE * factor) * 0.5

func _image(parent: Node, texture: Texture2D, rect: Rect2, stretch: TextureRect.StretchMode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED) -> TextureRect:
	var result := TextureRect.new()
	result.texture = texture
	result.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	result.stretch_mode = stretch
	result.position = rect.position
	result.size = rect.size
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(result)
	return result

func _label(parent: Node, text: String, rect: Rect2, font_size: int, color: Color, alignment: HorizontalAlignment, font: Font, wrap: bool = false) -> Label:
	var result := UI.label(text, font_size, color)
	result.position = rect.position
	result.size = rect.size
	result.horizontal_alignment = alignment
	result.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	result.add_theme_font_override("font", font)
	if wrap:
		result.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(result)
	return result

func _back() -> void:
	app.show_main_menu()
	for button in app.screen.menu_buttons:
		if button.text == "开始游戏":
			button.grab_focus.call_deferred()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		_back()

func _exit_tree() -> void:
	if is_instance_valid(menu_window):
		menu_window.content_scale_aspect = previous_aspect
