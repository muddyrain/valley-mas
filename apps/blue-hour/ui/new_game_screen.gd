extends Control

const UI = preload("res://ui/ui_style.gd")
const MenuArt = preload("res://ui/menu_art.gd")
const Art = preload("res://ui/new_run_art.gd")
const SHADE = preload("res://ui/menu_shade.gdshader")
const PAPER_CARD_HOVER = preload("res://ui/paper_card_hover.gd")
const TAB_BACKGROUND_POSITION := Vector2(-10, 0)
const TAB_BACKGROUND_SIZE := Vector2(300, 160)
const TOOLTIP_WIDTH := 404.0
const TOOLTIP_MIN_HEIGHT := 200.0
const TOOLTIP_HORIZONTAL_PADDING := 26.0
const TOOLTIP_PREFIX_WIDTH := 55.0
const TOOLTIP_ROW_GAP := 3.0
const TOOLTIP_CONTENT_WIDTH := TOOLTIP_WIDTH - TOOLTIP_HORIZONTAL_PADDING * 2.0
const TOOLTIP_VALUE_WIDTH := TOOLTIP_CONTENT_WIDTH - TOOLTIP_PREFIX_WIDTH - TOOLTIP_ROW_GAP
const TOOLTIP_GAP := 18.0
const TOOLTIP_Y_OFFSET := 18.0
const TOOLTIP_ENTER_DURATION := 0.14
const TOOLTIP_EXIT_DURATION := 0.10
const TOOLTIP_PAPER := Color("#f3ead8")
const TOOLTIP_EDGE := Color(0.35, 0.29, 0.20, 0.34)

var app: Node
var selected := "scavenge"
var selected_effect := 1
var tabs: Dictionary = {}
var tab_backgrounds: Dictionary = {}
var tab_normal_textures: Dictionary = {}
var tab_selected_textures: Dictionary = {}
var tab_tapes: Dictionary = {}
var cards: Array[Button] = []
var card_plates: Array[TextureRect] = []
var card_art: Array[TextureRect] = []
var card_hovers: Array[PaperCardHover] = []
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
var tooltip_upgrade_prefix: Label
var tooltip_upgrade_summary: Label
var tooltip_panel: PanelContainer
var tooltip_shadow_glow: Line2D
var tooltip_shadow: Polygon2D
var tooltip_paper: Polygon2D
var tooltip_outline: Line2D
var tooltip_content: VBoxContainer
var tooltip_upgrade_gap: Control
var tooltip_upgrade_row: HBoxContainer
var tooltip_tween: Tween
var tooltip_active_index := -1
var tooltip_target_position := Vector2.ZERO
var tooltip_entry_offset := Vector2.ZERO
var tooltip_points_right := false
var tooltip_pointer_y := 48.0
var menu_buttons: Array[Button] = []
var menu_window: Window
var previous_aspect: Window.ContentScaleAspect
var body_font: Font
var body_bold: Font
var title_font: Font
var _back_transitioning := false

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
	_play_enter_animation()

func _play_enter_animation() -> void:
	composition.modulate.a = 0.0
	for card: Button in cards:
		card.modulate.a = 0.0
		card.scale = Vector2.ONE * 0.95
		card.position.y += 14.0
		card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var intro := create_tween()
	intro.tween_property(composition, "modulate:a", 1.0, 0.22).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	for index in range(cards.size()):
		var card := cards[index]
		var card_tween := create_tween()
		card_tween.set_parallel(true)
		card_tween.tween_property(card, "modulate:a", 1.0, 0.20).set_delay(0.10 + index * 0.075).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		card_tween.tween_property(card, "scale", Vector2.ONE, 0.22).set_delay(0.10 + index * 0.075).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		card_tween.tween_property(card, "position:y", card.position.y - 14.0, 0.22).set_delay(0.10 + index * 0.075).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		card_tween.finished.connect(func() -> void:
			card.mouse_filter = Control.MOUSE_FILTER_STOP
		)

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
	var selected_backgrounds := [Art.TAB_COMBAT_SELECTED, Art.TAB_SCAVENGE_SELECTED, Art.TAB_SURVEY_SELECTED]
	var icons := [Art.ICON_COMBAT, Art.ICON_SCAVENGE, Art.ICON_SURVEY]
	var descriptions := ["更好地面对危险。", "带回更多生存资源。", "看得更远，走得更稳。"]
	for index in range(ids.size()):
		var spec: Resource = app.catalog.by_id(app.catalog.specializations, ids[index])
		var tab := _make_tab(ids[index], spec.display_name, descriptions[index], backgrounds[index], selected_backgrounds[index], icons[index], Vector2(281 + 277 * index, 198))
		tabs[ids[index]] = tab
		menu_buttons.append(tab)
	var locked := _make_tab("locked", "???", "尚未解锁的路线。", Art.TAB_LOCKED, null, Art.ICON_LOCK, Vector2(1112, 198), true)
	locked.tooltip_text = "尚未解锁的路线"

func _make_tab(id: String, heading: String, description: String, background: Texture2D, selected_background: Texture2D, icon: Texture2D, at: Vector2, locked: bool = false) -> Button:
	var button := Button.new()
	button.name = "Route_" + id
	button.text = heading
	button.toggle_mode = not locked
	button.position = at
	button.size = Vector2(274, 160)
	Art.empty_button(button)
	composition.add_child(button)
	var background_view := _image(button, background, Rect2(TAB_BACKGROUND_POSITION, TAB_BACKGROUND_SIZE))
	if selected_background != null:
		tab_backgrounds[id] = background_view
		tab_normal_textures[id] = background
		tab_selected_textures[id] = selected_background
	var tape := _image(button, Art.TAB_TAPE, Rect2(-17, -13, 39, 41))
	tape.visible = false
	tab_tapes[id] = tape
	var title_row := HBoxContainer.new()
	title_row.name = "TabTitleRow"
	title_row.position = Vector2(34, 13)
	title_row.size = Vector2(206, 50)
	title_row.alignment = BoxContainer.ALIGNMENT_CENTER
	title_row.add_theme_constant_override("separation", 4)
	title_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	button.add_child(title_row)
	var icon_view := _image(title_row, icon, Rect2(0, 0, 46, 50))
	icon_view.name = "TabIcon"
	icon_view.custom_minimum_size = Vector2(46, 50)
	var heading_label := _label(title_row, heading, Rect2(0, 0, 80, 50), 28, Art.INK, HORIZONTAL_ALIGNMENT_LEFT, title_font)
	heading_label.name = "TabTitle"
	heading_label.add_theme_constant_override("outline_size", 1)
	heading_label.add_theme_color_override("font_outline_color", Color(0.75, 0.86, 0.92, 0.24))
	var progress_text := _label(button, "0 / 21", Rect2(92, 53, 90, 22), 14, Art.INK, HORIZONTAL_ALIGNMENT_CENTER, body_bold)
	progress_text.name = "TabProgressText"
	var progress_bar := _image(button, Art.TAB_PROGRESS, Rect2(25, 72, 224, 24))
	progress_bar.name = "TabProgress"
	var description_label := _label(button, description, Rect2(22, 98, 230, 27), 14, Art.INK_SOFT, HORIZONTAL_ALIGNMENT_CENTER, body_font)
	description_label.name = "TabDescription"
	if locked:
		button.disabled = true
		button.focus_mode = Control.FOCUS_NONE
		button.mouse_default_cursor_shape = Control.CURSOR_FORBIDDEN
	else:
		button.pressed.connect(select_specialization.bind(id))
		button.mouse_entered.connect(button.grab_focus)
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
	var visual := Control.new()
	visual.name = "CardVisual"
	visual.size = button.size
	visual.mouse_filter = Control.MOUSE_FILTER_IGNORE
	button.add_child(visual)
	var plate := _image(visual, Art.CARD_COMPOSITE, Rect2(0, 0, 300, 336))
	card_plates.append(plate)
	var illustration := _image(visual, Art.ICON_COMBAT, Rect2(94, 89, 112, 112))
	card_art.append(illustration)
	_label(visual, section, Rect2(30, 13, 240, 35), 25, Art.INK, HORIZONTAL_ALIGNMENT_CENTER, title_font)
	_label(visual, english, Rect2(30, 43, 240, 20), 11, Art.INK_SOFT, HORIZONTAL_ALIGNMENT_CENTER, body_bold)
	var effect_title := _label(visual, "", Rect2(48, 208, 204, 50), 24, Art.INK, HORIZONTAL_ALIGNMENT_CENTER, body_bold)
	effect_titles.append(effect_title)
	var description := _label(visual, "", Rect2(27, 258, 246, 62), 17, Art.INK_SOFT, HORIZONTAL_ALIGNMENT_CENTER, body_font, true)
	effect_descriptions.append(description)
	var hover := PAPER_CARD_HOVER.new() as PaperCardHover
	button.add_child(hover)
	hover.setup(button, visual, plate)
	card_hovers.append(hover)
	button.pressed.connect(_select_effect.bind(index))
	button.mouse_entered.connect(_show_effect_tooltip.bind(index))
	button.mouse_exited.connect(_hide_effect_tooltip.bind(index))
	button.focus_entered.connect(_show_effect_tooltip.bind(index))
	button.focus_exited.connect(_hide_effect_tooltip.bind(index))
	cards.append(button)
	menu_buttons.append(button)

func _build_tooltip() -> void:
	tooltip_panel = PanelContainer.new()
	tooltip_panel.name = "EffectTooltip"
	tooltip_panel.custom_minimum_size = Vector2(TOOLTIP_WIDTH, TOOLTIP_MIN_HEIGHT)
	tooltip_panel.size = Vector2(TOOLTIP_WIDTH, TOOLTIP_MIN_HEIGHT)
	tooltip_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tooltip_panel.z_index = 20
	var surface := StyleBoxFlat.new()
	surface.bg_color = Color.TRANSPARENT
	tooltip_panel.add_theme_stylebox_override("panel", surface)
	composition.add_child(tooltip_panel)
	tooltip_panel.resized.connect(_refresh_tooltip_outline)
	tooltip_shadow_glow = Line2D.new()
	tooltip_shadow_glow.name = "TooltipPaperShadowGlow"
	tooltip_shadow_glow.default_color = Color(0.02, 0.06, 0.11, 0.055)
	tooltip_shadow_glow.width = 10.0
	tooltip_shadow_glow.antialiased = true
	tooltip_shadow_glow.position = Vector2(0, 5)
	tooltip_panel.add_child(tooltip_shadow_glow)
	tooltip_shadow = Polygon2D.new()
	tooltip_shadow.name = "TooltipPaperShadow"
	tooltip_shadow.color = Color(0.02, 0.06, 0.11, 0.14)
	tooltip_shadow.position = Vector2(0, 5)
	tooltip_panel.add_child(tooltip_shadow)
	tooltip_paper = Polygon2D.new()
	tooltip_paper.name = "TooltipPaper"
	tooltip_paper.color = TOOLTIP_PAPER
	tooltip_panel.add_child(tooltip_paper)
	tooltip_outline = Line2D.new()
	tooltip_outline.name = "TooltipPaperOutline"
	tooltip_outline.default_color = TOOLTIP_EDGE
	tooltip_outline.width = 1.2
	tooltip_outline.antialiased = true
	tooltip_panel.add_child(tooltip_outline)
	var margin := MarginContainer.new()
	margin.name = "TooltipMargins"
	margin.add_theme_constant_override("margin_left", 26)
	margin.add_theme_constant_override("margin_top", 17)
	margin.add_theme_constant_override("margin_right", 26)
	margin.add_theme_constant_override("margin_bottom", 21)
	tooltip_panel.add_child(margin)
	tooltip_content = VBoxContainer.new()
	tooltip_content.name = "TooltipContent"
	tooltip_content.add_theme_constant_override("separation", 0)
	margin.add_child(tooltip_content)
	tooltip_title = _tooltip_label(tooltip_content, "", 25, Art.INK, body_bold)
	tooltip_title.custom_minimum_size.y = 32.0
	tooltip_title.add_theme_constant_override("outline_size", 1)
	tooltip_title.add_theme_color_override("font_outline_color", Color(0.75, 0.63, 0.42, 0.18))
	var badge_holder := Control.new()
	badge_holder.name = "TooltipBadge"
	badge_holder.custom_minimum_size = Vector2(112, 31)
	badge_holder.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	tooltip_content.add_child(badge_holder)
	_image(badge_holder, Art.TOOLTIP_BADGE, Rect2(-4, -1, 112, 34))
	tooltip_badge = _label(badge_holder, "", Rect2(0, 0, 104, 31), 15, Art.INK, HORIZONTAL_ALIGNMENT_CENTER, body_bold)
	_tooltip_spacer(tooltip_content, 6.0)
	tooltip_flavor = _tooltip_label(tooltip_content, "", 16, Art.INK_SOFT, body_font, true)
	tooltip_flavor.custom_minimum_size.x = TOOLTIP_CONTENT_WIDTH
	tooltip_flavor.add_theme_constant_override("line_spacing", 3)
	_tooltip_spacer(tooltip_content, 11.0)
	var effect_row := _tooltip_row(tooltip_content, "EffectRow")
	tooltip_prefix = _tooltip_prefix(effect_row, "效果：", Art.ORANGE)
	tooltip_summary = _tooltip_label(effect_row, "", 16, Art.INK_SOFT, body_font, true)
	tooltip_summary.custom_minimum_size.x = TOOLTIP_VALUE_WIDTH
	tooltip_summary.add_theme_constant_override("line_spacing", 3)
	tooltip_upgrade_gap = _tooltip_spacer(tooltip_content, 12.0)
	tooltip_upgrade_row = _tooltip_row(tooltip_content, "UpgradeRow")
	tooltip_upgrade_prefix = _tooltip_prefix(tooltip_upgrade_row, "升级：", Color("#d88a00"))
	tooltip_upgrade_summary = _tooltip_label(tooltip_upgrade_row, "", 16, Color("#b87400"), body_font, true)
	tooltip_upgrade_summary.custom_minimum_size.x = TOOLTIP_VALUE_WIDTH
	tooltip_upgrade_summary.add_theme_constant_override("line_spacing", 3)
	tooltip_panel.visible = false
	tooltip_panel.modulate.a = 0.0
	_refresh_tooltip_layout()

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
		effect_titles[index].text = effect.display_name
		effect_descriptions[index].text = effect.short_description
		card_plates[index].texture = effect.card_art if effect.card_art != null else Art.CARD_COMPOSITE
		card_hovers[index].set_texture(card_plates[index].texture)
		card_art[index].texture = effect.icon
		card_art[index].visible = effect.card_art == null
	_select_effect(1)
	_hide_tooltip_immediately()

func _select_effect(index: int) -> void:
	if index < 0 or index >= cards.size():
		return
	selected_effect = index
	for card_index in range(cards.size()):
		cards[card_index].set_pressed_no_signal(card_index == index)
	var spec: Resource = app.catalog.by_id(app.catalog.specializations, selected)
	var effect_id: String = spec.passive_id if index == 0 else spec.power_id
	var effect: Resource = app.catalog.by_id(app.catalog.passives if index == 0 else app.catalog.powers, effect_id)
	tooltip_title.text = effect.display_name
	tooltip_badge.text = "起始道具" if index == 0 else "特殊技能"
	tooltip_flavor.text = effect.flavor
	tooltip_prefix.text = "效果："
	tooltip_summary.text = effect.description()
	tooltip_upgrade_prefix.text = "升级："
	tooltip_upgrade_summary.text = effect.upgrade_description().trim_prefix("升级：")
	tooltip_upgrade_gap.visible = true
	tooltip_upgrade_row.visible = true
	_refresh_tooltip_layout()

func _show_unlock_hint() -> void:
	selected_effect = -1
	for index in range(cards.size()):
		cards[index].set_pressed_no_signal(false)
	tooltip_title.text = "下一条路线"
	tooltip_badge.text = "尚未解锁"
	tooltip_flavor.text = "更远的地方，还有新的路线。"
	tooltip_prefix.text = "状态："
	tooltip_summary.text = "更多路线仍在筹备。"
	tooltip_upgrade_gap.visible = false
	tooltip_upgrade_row.visible = false
	_refresh_tooltip_layout()
	tooltip_active_index = -2
	_set_tooltip_pointer(false, 184.0)
	tooltip_target_position = Vector2(
		unlock_button.position.x + unlock_button.size.x + TOOLTIP_GAP,
		unlock_button.position.y + unlock_button.size.y - tooltip_panel.size.y,
	)
	tooltip_entry_offset = Vector2.LEFT * 10.0
	tooltip_panel.pivot_offset = Vector2(0.0, 194.0)
	_animate_tooltip_in()

func _show_effect_tooltip(index: int) -> void:
	if index < 0 or index >= cards.size():
		return
	_select_effect(index)
	if tooltip_active_index == index and tooltip_panel.visible:
		return
	tooltip_active_index = index
	var card := cards[index]
	if index == 0:
		tooltip_target_position = Vector2(
			card.position.x - tooltip_panel.size.x - TOOLTIP_GAP,
			card.position.y + TOOLTIP_Y_OFFSET,
		)
		tooltip_entry_offset = Vector2.RIGHT * 10.0
		_set_tooltip_pointer(true, 48.0)
		tooltip_panel.pivot_offset = Vector2(tooltip_panel.size.x, 58.0)
	else:
		tooltip_target_position = Vector2(
			card.position.x + card.size.x + TOOLTIP_GAP,
			card.position.y + TOOLTIP_Y_OFFSET,
		)
		tooltip_entry_offset = Vector2.LEFT * 10.0
		_set_tooltip_pointer(false, 48.0)
		tooltip_panel.pivot_offset = Vector2(0.0, 58.0)
	_animate_tooltip_in()

func _hide_effect_tooltip(index: int) -> void:
	if tooltip_active_index != index:
		return
	tooltip_active_index = -1
	if tooltip_tween != null and tooltip_tween.is_valid():
		tooltip_tween.kill()
	tooltip_tween = create_tween()
	tooltip_tween.set_parallel(true)
	tooltip_tween.tween_property(tooltip_panel, "position", tooltip_target_position + tooltip_entry_offset * 0.45, TOOLTIP_EXIT_DURATION).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tooltip_tween.tween_property(tooltip_panel, "scale", Vector2.ONE * 0.985, TOOLTIP_EXIT_DURATION).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tooltip_tween.tween_property(tooltip_panel, "modulate:a", 0.0, TOOLTIP_EXIT_DURATION).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tooltip_tween.finished.connect(_finish_tooltip_hide)

func _animate_tooltip_in() -> void:
	if tooltip_tween != null and tooltip_tween.is_valid():
		tooltip_tween.kill()
	tooltip_panel.position = tooltip_target_position + tooltip_entry_offset
	tooltip_panel.scale = Vector2.ONE * 0.97
	tooltip_panel.modulate.a = 0.0
	tooltip_panel.visible = true
	tooltip_tween = create_tween()
	tooltip_tween.set_parallel(true)
	tooltip_tween.tween_property(tooltip_panel, "position", tooltip_target_position, TOOLTIP_ENTER_DURATION).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tooltip_tween.tween_property(tooltip_panel, "scale", Vector2.ONE, TOOLTIP_ENTER_DURATION).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tooltip_tween.tween_property(tooltip_panel, "modulate:a", 1.0, TOOLTIP_ENTER_DURATION).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)

func _hide_tooltip_immediately() -> void:
	tooltip_active_index = -1
	if tooltip_tween != null and tooltip_tween.is_valid():
		tooltip_tween.kill()
	tooltip_panel.visible = false
	tooltip_panel.scale = Vector2.ONE
	tooltip_panel.modulate.a = 0.0

func _finish_tooltip_hide() -> void:
	if tooltip_active_index == -1:
		tooltip_panel.visible = false

func _set_tooltip_pointer(points_right: bool, y_position: float) -> void:
	tooltip_points_right = points_right
	tooltip_pointer_y = y_position
	_refresh_tooltip_outline()

func _refresh_tooltip_layout() -> void:
	if tooltip_panel == null:
		return
	tooltip_panel.size = Vector2(TOOLTIP_WIDTH, TOOLTIP_MIN_HEIGHT)
	tooltip_content.queue_sort()
	tooltip_panel.queue_sort()
	_refresh_tooltip_outline()

func _refresh_tooltip_outline() -> void:
	if tooltip_outline == null:
		return
	var width := tooltip_panel.size.x
	var height := tooltip_panel.size.y
	var pointer_top := clampf(tooltip_pointer_y, 14.0, height - 32.0)
	var paper_points := _tooltip_paper_points(width, height, tooltip_points_right, pointer_top)
	var outline_points := PackedVector2Array(paper_points)
	outline_points.append(paper_points[0])
	tooltip_shadow_glow.points = outline_points
	tooltip_shadow.polygon = paper_points
	tooltip_paper.polygon = paper_points
	tooltip_outline.points = outline_points

func _tooltip_paper_points(width: float, height: float, points_right: bool, pointer_top: float) -> PackedVector2Array:
	var points := PackedVector2Array([
		Vector2(5, 1.5),
		Vector2(width * 0.18, 0.2),
		Vector2(width * 0.41, 1.3),
		Vector2(width * 0.68, 0.0),
		Vector2(width - 6, 2.0),
	])
	if points_right:
		points.append(Vector2(width - 1.5, pointer_top))
		points.append(Vector2(width + 15.0, pointer_top + 10.0))
		points.append(Vector2(width - 1.0, pointer_top + 20.0))
		points.append(Vector2(width - 2.0, minf(height - 12.0, pointer_top + 48.0)))
	else:
		points.append(Vector2(width - 1.0, height * 0.24))
	points.append(Vector2(width - 2.2, height * 0.61))
	points.append(Vector2(width - 0.5, height - 5.0))
	points.append(Vector2(width - 6.0, height - 2.0))
	points.append(Vector2(width * 0.78, height - 0.6))
	points.append(Vector2(width * 0.55, height - 2.2))
	points.append(Vector2(width * 0.30, height - 0.2))
	points.append(Vector2(width * 0.09, height - 1.8))
	points.append(Vector2(3.0, height - 4.5))
	if points_right:
		points.append(Vector2(0.6, height * 0.72))
		points.append(Vector2(1.8, height * 0.39))
	else:
		points.append(Vector2(1.0, minf(height - 10.0, pointer_top + 45.0)))
		points.append(Vector2(1.8, pointer_top + 20.0))
		points.append(Vector2(-15.0, pointer_top + 10.0))
		points.append(Vector2(1.8, pointer_top))
		points.append(Vector2(0.7, maxf(10.0, pointer_top - 22.0)))
	points.append(Vector2(3.0, 4.0))
	return points

func _refresh_tab_visuals() -> void:
	for key in tab_backgrounds:
		var active: bool = key == selected
		tab_backgrounds[key].texture = tab_selected_textures[key] if active else tab_normal_textures[key]
		tab_backgrounds[key].size = TAB_BACKGROUND_SIZE
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

func _tooltip_label(parent: Node, text: String, font_size: int, color: Color, font: Font, wrap: bool = false) -> Label:
	var result := UI.label(text, font_size, color)
	result.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	result.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	result.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	result.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	result.add_theme_font_override("font", font)
	if wrap:
		result.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(result)
	return result

func _tooltip_prefix(parent: HBoxContainer, text: String, color: Color) -> Label:
	var result := _tooltip_label(parent, text, 16, color, body_bold)
	result.custom_minimum_size.x = TOOLTIP_PREFIX_WIDTH
	result.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	return result

func _tooltip_row(parent: VBoxContainer, node_name: String) -> HBoxContainer:
	var result := HBoxContainer.new()
	result.name = node_name
	result.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	result.add_theme_constant_override("separation", roundi(TOOLTIP_ROW_GAP))
	parent.add_child(result)
	return result

func _tooltip_spacer(parent: VBoxContainer, height: float) -> Control:
	var result := Control.new()
	result.custom_minimum_size.y = height
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(result)
	return result

func _back() -> void:
	if _back_transitioning or app == null:
		return
	_back_transitioning = true
	for button: Button in menu_buttons:
		button.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var exit_tween := create_tween()
	exit_tween.tween_property(composition, "modulate:a", 0.0, 0.20).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	await get_tree().create_timer(0.21).timeout
	app.show_main_menu()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		_back()

func _exit_tree() -> void:
	if is_instance_valid(menu_window):
		menu_window.content_scale_aspect = previous_aspect


