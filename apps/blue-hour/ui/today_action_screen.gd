extends Control
## A draft selection; only the parent can persist it and start an expedition.

signal departure_confirmed(action_id: String)
signal cancelled

const Art = preload("res://ui/new_run_art.gd")
const MenuArt = preload("res://ui/menu_art.gd")
const CardHover = preload("res://ui/paper_card_hover.gd")
const REFERENCE := Vector2(1600, 900)
const BOARD: Texture2D = preload("res://assets/ui/today_action/today_action_board.png")
const CARD: Texture2D = preload("res://assets/ui/today_action/today_action_task_card.png")
const STATUS: Texture2D = preload("res://assets/ui/today_action/today_action_status_bar.png")
const SELECTION: Texture2D = preload("res://assets/ui/today_action/today_action_selection_bar.png")
const BLUE: Texture2D = preload("res://assets/ui/today_action/today_action_button_blue.png")
const RED: Texture2D = preload("res://assets/ui/today_action/today_action_button_red.png")
const GREEN: Texture2D = preload("res://assets/ui/today_action/today_action_button_green.png")
const INK := Color("#233a4b")
const MUTED := Color("#64717b")
const BUTTON_TEXT_OPTICAL_SHIFT := 3.0
const STAT_SLOT_POSITION_Y := 372.0
const STAT_SLOT_HEIGHT := 45.0

var selected_id: String = ""
var selected_party: Array[String] = []
var party_buttons: Dictionary[String, Button] = {}
var party_status: Label
var cards: Dictionary[String, Button] = {}
var confirm_button: Button
var cancel_button: Button
var composition: Control
var selection_title: Label
var selection_description: Label
var _selection_thumbnail: Polygon2D
var _selection_placeholder: Label
var _marks: Dictionary[String, Label] = {}
var _rims: Dictionary[String, TextureRect] = {}
var _actions: Array[Resource] = []
var _base_map: Resource
var _font: Font = Art.body_font()
var _bold: Font = Art.body_font(700)
var _title_font: Font = Art.title_font()
var _window: Window
var _previous_aspect: Window.ContentScaleAspect
var _wash: ColorRect
var _is_closing := false


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") and not event.is_echo():
		get_viewport().set_input_as_handled()
		_request_cancel()


func _exit_tree() -> void:
	if is_instance_valid(_window):
		_window.content_scale_aspect = _previous_aspect


func setup(actions: Array[Resource], base_map: Resource, state: Dictionary, rules: Resource, modifiers: RefCounted) -> void:
	_actions = actions
	_base_map = base_map
	_window = get_window()
	_previous_aspect = _window.content_scale_aspect
	_window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = MenuArt.theme()
	_wash = ColorRect.new()
	_wash.name = "CampDimmer"
	_wash.color = Color(0.035, 0.085, 0.14, 0.46)
	_wash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_wash.modulate.a = 0.0
	add_child(_wash)
	_wash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	composition = Control.new()
	composition.name = "TodayActionComposition"
	composition.size = REFERENCE
	composition.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(composition)
	_build_header(state, rules)
	var board := NinePatchRect.new()
	board.texture = BOARD
	board.position = Vector2(110, 229)
	board.size = Vector2(1380, 460)
	board.patch_margin_left = 65
	board.patch_margin_right = 65
	board.patch_margin_top = 65
	board.patch_margin_bottom = 65
	board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	composition.add_child(board)
	for index: int in range(actions.size()):
		_build_card(actions[index], Vector2(222 + index * 402, 231), modifiers)
	_build_footer()
	_wire_focus()
	var previous: String = str(state.get("selected_action", ""))
	if cards.has(previous):
		select_action(previous)
	resized.connect(_layout)
	_layout()
	if not cards.is_empty():
		var first: Button = cards[previous] if cards.has(previous) else cards.values()[0]
		first.grab_focus.call_deferred()
	composition.pivot_offset = REFERENCE * 0.5
	var target_scale := composition.scale
	composition.scale = target_scale * 0.94
	composition.position += Vector2(0, 24)
	composition.modulate.a = 0.0
	var intro := create_tween().set_parallel(true)
	intro.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	intro.tween_property(composition, "modulate:a", 1.0, 0.24)
	intro.tween_property(composition, "scale", target_scale, 0.34)
	intro.tween_property(composition, "position", (size - REFERENCE * target_scale) * 0.5, 0.34)
	intro.tween_property(_wash, "modulate:a", 1.0, 0.22)

func _request_cancel() -> void:
	if _is_closing:
		return
	_is_closing = true
	_cancel_input()
	cancelled.emit()

func _cancel_input() -> void:
	for card: Button in cards.values():
		card.disabled = true
	for choice: Button in party_buttons.values():
		choice.disabled = true
	if is_instance_valid(confirm_button):
		confirm_button.disabled = true
	if is_instance_valid(cancel_button):
		cancel_button.disabled = true

func close_with_animation() -> void:
	if not is_instance_valid(composition):
		return
	var target_position := (size - REFERENCE * composition.scale.x) * 0.5
	var outro := create_tween().set_parallel(true)
	outro.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	outro.tween_property(composition, "modulate:a", 0.0, 0.05)
	outro.tween_property(composition, "scale", composition.scale * 0.95, 0.06)
	outro.tween_property(composition, "position", target_position + Vector2(0, 18), 0.06)
	outro.tween_property(_wash, "modulate:a", 0.0, 0.05)
	await outro.finished

func setup_party(game: RefCounted) -> void:
	selected_party.assign(game.data.selected_party)
	var strip := HBoxContainer.new()
	strip.name = "PartySelection"
	strip.position = Vector2(195, 177)
	strip.size = Vector2(1200, 46)
	strip.add_theme_constant_override("separation", 12)
	composition.add_child(strip)
	for id: String in game.data.members:
		var choice := Button.new()
		choice.text = ("✓ " if id in selected_party else "＋ ") + game.member_template(id).display_name
		choice.custom_minimum_size = Vector2(165, 40)
		choice.toggle_mode = true
		choice.theme = preload("res://ui/camp_style.gd").paper_theme()
		choice.add_theme_font_override("font", _bold)
		choice.add_theme_font_size_override("font_size", 17)
		choice.button_pressed = id in selected_party
		choice.toggled.connect(func(_selected: bool):
			selected_party.clear()
			for member: String in game.data.members:
				if party_buttons[member].button_pressed:
					selected_party.append(member)
				party_buttons[member].text = ("✓ " if party_buttons[member].button_pressed else "＋ ") + game.member_template(member).display_name
			_refresh_party())
		strip.add_child(choice)
		party_buttons[id] = choice
	_refresh_party()

func _refresh_party() -> void:
	party_status.text = "外勤小队  %d 人" % selected_party.size()
	confirm_button.disabled = selected_id.is_empty() or selected_party.is_empty()
	_wire_focus()


func select_action(id: String) -> void:
	if not cards.has(id):
		return
	selected_id = id
	for action: Resource in _actions:
		var active: bool = action.id == id
		cards[action.id].set_pressed_no_signal(active)
		_marks[action.id].visible = active
		_rims[action.id].visible = active
		if active:
			selection_title.text = "已选择  /  " + action.display_name
			selection_description.text = action.description
			_fit_selection_thumbnail(action.thumbnail)
	_selection_thumbnail.show()
	_selection_placeholder.hide()
	confirm_button.disabled = not party_buttons.is_empty() and selected_party.is_empty()
	_wire_focus()


func _build_header(state: Dictionary, rules: Resource) -> void:
	_image(composition, Art.LOGO, Rect2(112, 26, 211, 90))
	_label(composition, "今日行动", Rect2(520, 26, 560, 66), 42, Art.WHITE, HORIZONTAL_ALIGNMENT_CENTER, _title_font)
	_label(composition, "TODAY'S EXPEDITION", Rect2(570, 92, 460, 24), 14, Color("#c1cdd4"), HORIZONTAL_ALIGNMENT_CENTER, _bold)
	_label(composition, "第 %02d 天  /  %02d" % [state.day, rules.end_day], Rect2(1230, 61, 252, 36), 22, Art.WHITE, HORIZONTAL_ALIGNMENT_RIGHT, _bold)
	_image(composition, _region(STATUS, Rect2(0, 150, 2015, 327)), Rect2(174, 122, 1252, 53), TextureRect.STRETCH_SCALE)
	var need: int = state.members.size() * rules.food_per_member
	var values: Array[String] = ["食物  %d  ·  今晚需 %d" % [state.food, need], "废料  %d" % state.scrap, "外勤小队  %d 人" % state.members.size()]
	for index: int in range(values.size()):
		var color: Color = Color("#9a3c32") if index == 0 and state.food < need else INK
		var label := _label(composition, values[index], Rect2(196 + index * 412, 125, 384, 44), 20, color, HORIZONTAL_ALIGNMENT_CENTER, _bold)
		if index == 2:
			party_status = label


func _build_card(action: Resource, at: Vector2, modifiers: RefCounted) -> void:
	var card := Button.new()
	card.name = "Destination_" + action.id
	card.text = action.display_name
	card.position = at
	card.size = Vector2(350, 448)
	card.toggle_mode = true
	Art.empty_button(card)
	composition.add_child(card)
	cards[action.id] = card
	var visual := Control.new()
	visual.name = "CardVisual"
	visual.size = card.size
	visual.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(visual)
	var plate := _image(visual, _region(CARD, Rect2(0, 108, 984, 1260)), Rect2(Vector2.ZERO, card.size), TextureRect.STRETCH_SCALE)
	var rim := _image(visual, plate.texture, Rect2(Vector2(-14, -14), card.size + Vector2(28, 28)), TextureRect.STRETCH_SCALE)
	var outline := ShaderMaterial.new()
	outline.shader = CardHover.EFFECT_SHADER
	outline.set_shader_parameter("card_texture", plate.texture)
	outline.set_shader_parameter("hover_amount", 1.0)
	outline.set_shader_parameter("outline_color", action.accent.lightened(0.3))
	outline.set_shader_parameter("glow_color", Color(action.accent, 0.25))
	outline.set_shader_parameter("content_origin_uv", Vector2(14, 14) / rim.size)
	outline.set_shader_parameter("content_size_uv", card.size / rim.size)
	rim.material = outline
	visual.move_child(rim, 0)
	rim.hide()
	_rims[action.id] = rim
	_label(visual, action.display_name, Rect2(29, 23, 292, 37), 27, INK, HORIZONTAL_ALIGNMENT_CENTER, _title_font)
	_image(visual, action.thumbnail, Rect2(29, 71, 292, 130), TextureRect.STRETCH_KEEP_ASPECT_COVERED)
	var mark := _label(visual, "已选择", Rect2(237, 161, 84, 32), 17, Art.WHITE, HORIZONTAL_ALIGNMENT_CENTER, _bold)
	var badge := StyleBoxFlat.new()
	badge.bg_color = action.accent
	badge.set_corner_radius_all(4)
	mark.add_theme_stylebox_override("normal", badge)
	mark.hide()
	_marks[action.id] = mark
	var rows: Array[String] = [action.subtitle, "白昼  %d 秒" % int(_base_map.day_seconds + modifiers.amount("day_extension")), "危险程度  " + action.danger]
	var symbols: Array[String] = ["◎", "◷", "!"]
	for index: int in range(rows.size()):
		_label(visual, symbols[index], Rect2(30, 226 + index * 43, 31, 31), 22, action.accent, HORIZONTAL_ALIGNMENT_CENTER, _bold)
		_label(visual, rows[index], Rect2(70, 224 + index * 43, 248, 33), 19, action.accent if index == 2 else INK, HORIZONTAL_ALIGNMENT_LEFT, _bold)
	var map: Resource = action.make_map(_base_map)
	var food := 0
	var scrap := 0
	var searchable: Array = map.buildings.filter(func(site: Dictionary): return site.get("searchable", true)) + map.vehicles
	for site: Dictionary in searchable:
		food += int(site.food)
		scrap += int(site.scrap)
	var names: Array[String] = ["食物", "废料", "装备", "地点"]
	var amounts: Array[int] = [food, scrap, action.weapon_sites.size(), searchable.size()]
	for index: int in range(names.size()):
		_build_stat(visual, names[index], amounts[index], index)
	card.tooltip_text = action.description + "\n物资为全图基础储量；实际带回量取决于搜索、加成与撤离。"
	var hover := CardHover.new()
	card.add_child(hover)
	hover.setup(card, visual, plate)
	card.pressed.connect(select_action.bind(action.id))


func _build_footer() -> void:
	_image(composition, _region(SELECTION, Rect2(0, 94, 2019, 423)), Rect2(118, 701, 1017, 179), TextureRect.STRETCH_SCALE)
	_selection_thumbnail = Polygon2D.new()
	_selection_thumbnail.name = "SelectedDestinationThumbnail"
	# The footer art is scaled differently on each axis, so its photo opening is a quadrilateral.
	_selection_thumbnail.polygon = PackedVector2Array([
		Vector2(139, 741),
		Vector2(300, 722),
		Vector2(319, 832),
		Vector2(155, 851),
	])
	composition.add_child(_selection_thumbnail)
	_selection_thumbnail.hide()
	_selection_placeholder = _label(composition, "?", Rect2(158, 745, 122, 88), 42, Color("#b4c1ca"), HORIZONTAL_ALIGNMENT_CENTER, _title_font)
	selection_title = _label(composition, "选择今天的目的地", Rect2(354, 731, 728, 45), 27, INK, HORIZONTAL_ALIGNMENT_LEFT, _bold)
	selection_description = _label(composition, "带上需要的装备，天黑前带大家回来。", Rect2(354, 808, 728, 46), 19, MUTED)
	selection_description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	confirm_button = _button("确认出发", GREEN, Rect2(30, 208, 1558, 350), Rect2(1181, 712, 288, 69))
	confirm_button.disabled = true
	confirm_button.pressed.connect(_confirm)
	cancel_button = _button("返回营地", RED, Rect2(0, 224, 1505, 408), Rect2(1181, 803, 288, 64))
	cancel_button.pressed.connect(_request_cancel)


func _fit_selection_thumbnail(texture: Texture2D) -> void:
	_selection_thumbnail.texture = texture
	var texture_size := texture.get_size()
	var quad := _selection_thumbnail.polygon
	var opening_size := Vector2(
		(quad[0].distance_to(quad[1]) + quad[3].distance_to(quad[2])) * 0.5,
		(quad[0].distance_to(quad[3]) + quad[1].distance_to(quad[2])) * 0.5
	)
	var opening_aspect := opening_size.x / opening_size.y
	var texture_aspect := texture_size.x / texture_size.y
	var uv_rect := Rect2(Vector2.ZERO, texture_size)
	if texture_aspect > opening_aspect:
		uv_rect.size.x = texture_size.y * opening_aspect
		uv_rect.position.x = (texture_size.x - uv_rect.size.x) * 0.5
	else:
		uv_rect.size.y = texture_size.x / opening_aspect
		uv_rect.position.y = (texture_size.y - uv_rect.size.y) * 0.5
	_selection_thumbnail.uv = PackedVector2Array([
		uv_rect.position,
		Vector2(uv_rect.end.x, uv_rect.position.y),
		uv_rect.end,
		Vector2(uv_rect.position.x, uv_rect.end.y),
	])


func _confirm() -> void:
	if not selected_id.is_empty() and not confirm_button.disabled:
		departure_confirmed.emit(selected_id)


func _wire_focus() -> void:
	var ordered: Array[Button] = []
	for card: Button in cards.values():
		ordered.append(card)
	for choice: Button in party_buttons.values():
		ordered.append(choice)
	if not confirm_button.disabled:
		ordered.append(confirm_button)
	ordered.append(cancel_button)
	for index: int in range(ordered.size()):
		var button: Button = ordered[index]
		button.focus_next = button.get_path_to(ordered[(index + 1) % ordered.size()])
		button.focus_previous = button.get_path_to(ordered[(index - 1 + ordered.size()) % ordered.size()])
	for index: int in range(cards.size()):
		var card: Button = ordered[index]
		card.focus_neighbor_left = card.get_path_to(ordered[(index - 1 + cards.size()) % cards.size()])
		card.focus_neighbor_right = card.get_path_to(ordered[(index + 1) % cards.size()])
		card.focus_neighbor_bottom = card.get_path_to(cancel_button if confirm_button.disabled else confirm_button)
	var selected: Button = cards[selected_id] if cards.has(selected_id) else ordered[0]
	confirm_button.focus_neighbor_top = confirm_button.get_path_to(selected)
	confirm_button.focus_neighbor_bottom = confirm_button.get_path_to(cancel_button)
	cancel_button.focus_neighbor_top = cancel_button.get_path_to(selected if confirm_button.disabled else confirm_button)
	cancel_button.focus_neighbor_bottom = cancel_button.get_path_to(selected)


func _layout() -> void:
	var factor := minf(size.x / REFERENCE.x, size.y / REFERENCE.y) * 0.96
	composition.scale = Vector2.ONE * factor
	composition.position = (size - REFERENCE * factor) * 0.5


func _button(text: String, texture: Texture2D, region: Rect2, rect: Rect2) -> Button:
	var button := Button.new()
	button.text = text
	button.position = rect.position
	button.size = rect.size
	button.focus_mode = Control.FOCUS_ALL
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.add_theme_font_override("font", _bold)
	button.add_theme_font_size_override("font_size", 24)
	for state: String in ["normal", "hover", "pressed", "disabled", "hover_pressed"]:
		var style := StyleBoxTexture.new()
		style.texture = _region(BLUE, Rect2(153, 172, 1177, 322)) if state == "disabled" else _region(texture, region)
		style.modulate_color = Color(0.57, 0.63, 0.69) if state == "disabled" else (Color(1.15, 1.15, 1.15) if state == "hover" else Color(0.8, 0.8, 0.8) if "pressed" in state else Color.WHITE)
		# The Chinese glyphs sit below the font metric center, so balance their visible shape against the plate.
		style.content_margin_bottom = BUTTON_TEXT_OPTICAL_SHIFT * 2.0
		button.add_theme_stylebox_override(state, style)
		button.add_theme_color_override("font_" + state + "_color" if state != "normal" else "font_color", Art.WHITE)
	var focus := StyleBoxFlat.new()
	focus.bg_color = Color.TRANSPARENT
	focus.border_color = Color("#c2e7ff")
	focus.set_border_width_all(2)
	focus.set_corner_radius_all(8)
	button.add_theme_stylebox_override("focus", focus)
	composition.add_child(button)
	return button


func _build_stat(parent: Node, title: String, amount: int, index: int) -> void:
	var center := CenterContainer.new()
	center.name = "StatSlot_" + title
	center.position = Vector2(38 + index * 76, STAT_SLOT_POSITION_Y)
	center.size = Vector2(48, STAT_SLOT_HEIGHT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(center)
	var stack := VBoxContainer.new()
	stack.name = "StatStack"
	stack.custom_minimum_size.x = 48
	stack.add_theme_constant_override("separation", -3)
	stack.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.add_child(stack)
	var title_label := _label(stack, title, Rect2(), 13, MUTED, HORIZONTAL_ALIGNMENT_CENTER)
	title_label.name = "Title"
	title_label.custom_minimum_size = Vector2(48, 17)
	var amount_label := _label(stack, str(amount), Rect2(), 20, INK, HORIZONTAL_ALIGNMENT_CENTER, _bold)
	amount_label.name = "Amount"
	amount_label.custom_minimum_size = Vector2(48, 25)


func _region(texture: Texture2D, rect: Rect2) -> AtlasTexture:
	var atlas := AtlasTexture.new()
	atlas.atlas = texture
	atlas.region = rect
	atlas.filter_clip = true
	return atlas


func _image(parent: Node, texture: Texture2D, rect: Rect2, stretch: TextureRect.StretchMode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED) -> TextureRect:
	var image := TextureRect.new()
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = stretch
	image.texture = texture
	image.position = rect.position
	image.size = rect.size
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(image)
	return image


func _label(parent: Node, text: String, rect: Rect2, font_size: int, color: Color, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT, font: Font = null) -> Label:
	var label := Label.new()
	label.text = text
	label.position = rect.position
	label.size = rect.size
	label.horizontal_alignment = align
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font", font if font != null else _font)
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	parent.add_child(label)
	return label
