extends Control
## A draft selection; only the parent can persist it and start an expedition.

signal departure_confirmed(action_id: String)
signal cancelled

const Art = preload("res://ui/new_run_art.gd")
const MenuArt = preload("res://ui/menu_art.gd")
const CardHover = preload("res://ui/paper_card_hover.gd")
const REFERENCE := Vector2(1600, 900)
const BOARD: Texture2D = preload("res://assets/ui/today_action/today_action_board.png")
const CARD: Texture2D = preload("res://assets/ui/common/cards/ui_common_card_paper.png")
const PAPER: Texture2D = preload("res://assets/ui/common/panels/ui_common_paper_panel.png")
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
var selection_meta: Label
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
var _board: NinePatchRect
var _header: Control
var _footer: Control
var _briefing: Control
var _opening := true
var _closed := false
var _intro: Tween
var _selection_tween: Tween
var _hover_tweens: Dictionary[String, Tween] = {}
var _day_extension: float = 0.0
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
	_day_extension = modifiers.amount("day_extension")
	_window = get_window()
	_previous_aspect = _window.content_scale_aspect
	_window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = MenuArt.theme()
	_wash = ColorRect.new()
	_wash.name = "CampDimmer"
	_wash.color = Color.WHITE
	var atmosphere := Shader.new()
	atmosphere.code = """
shader_type canvas_item;
render_mode unshaded;

void fragment() {
	float fade = COLOR.a;
	vec2 centered = (UV - vec2(0.5, 0.48)) / vec2(0.70, 0.68);
	float edge = smoothstep(0.15, 1.0, length(centered));
	float vertical = smoothstep(0.25, 1.0, abs(UV.y - 0.48) * 2.0);
	vec3 blue_gray = mix(vec3(0.045, 0.085, 0.135), vec3(0.012, 0.027, 0.055), edge);
	float opacity = clamp(0.53 + edge * 0.29 + vertical * 0.035, 0.0, 0.86);
	COLOR = vec4(blue_gray, opacity * fade);
}
"""
	var atmosphere_material := ShaderMaterial.new()
	atmosphere_material.shader = atmosphere
	_wash.material = atmosphere_material
	_wash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_wash.modulate.a = 0.0
	add_child(_wash)
	_wash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	composition = Control.new()
	composition.name = "TodayActionComposition"
	composition.size = REFERENCE
	composition.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(composition)
	_header = _group("Header")
	_build_header(state, rules)
	var board := NinePatchRect.new()
	board.texture = BOARD
	board.position = Vector2(110, 209)
	board.size = Vector2(1380, 478)
	board.patch_margin_left = 90
	board.patch_margin_right = 90
	board.patch_margin_top = 90
	board.patch_margin_bottom = 90
	board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	composition.add_child(board)
	_board = board
	for index: int in range(actions.size()):
		_build_card(actions[index], Vector2(222 + index * 402, 218), modifiers)
	_footer = _group("Footer")
	_build_footer()
	_wire_focus()
	var previous: String = str(state.get("selected_action", ""))
	if cards.has(previous):
		select_action(previous)
	resized.connect(_layout)
	_layout()
	_open_animation()


func _group(node_name: String) -> Control:
	var group := Control.new()
	group.name = node_name
	group.size = REFERENCE
	group.mouse_filter = Control.MOUSE_FILTER_IGNORE
	composition.add_child(group)
	return group


func _reveal(tween: Tween, node: Control, delay: float, duration: float, shift: float) -> void:
	var destination := node.position
	node.modulate.a = 0.0
	node.position.y += shift
	tween.tween_property(node, "modulate:a", 1.0, duration).set_delay(delay)
	tween.tween_property(node, "position", destination, duration).set_delay(delay)


func _open_animation() -> void:
	_cancel_input()
	_intro = create_tween().set_parallel(true).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_intro.tween_property(_wash, "modulate:a", 1.0, 0.22)
	_board.pivot_offset = _board.size * 0.5
	_board.scale = Vector2.ONE * 0.97
	_reveal(_intro, _board, 0.03, 0.23, 16.0)
	_intro.tween_property(_board, "scale", Vector2.ONE, 0.23).set_delay(0.03)
	_reveal(_intro, _header, 0.10, 0.18, 0.0)
	var index := 0
	for card: Button in cards.values():
		_reveal(_intro, card, 0.12 + index * 0.06, 0.20, 18.0)
		index += 1
	_reveal(_intro, _footer, 0.30, 0.18, 10.0)
	await _intro.finished
	_opening = false
	for card: Button in cards.values():
		card.disabled = false
	cancel_button.disabled = false
	_refresh_party()


func _request_cancel() -> void:
	if _is_closing or _opening:
		return
	await close_with_animation()
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
	if _closed:
		return
	if _is_closing:
		while not _closed:
			await get_tree().process_frame
		return
	_is_closing = true
	_cancel_input()
	if _selection_tween and _selection_tween.is_running():
		_selection_tween.kill()
	var outro := create_tween().set_parallel(true).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	outro.tween_property(_footer, "modulate:a", 0.0, 0.10)
	for card: Button in cards.values():
		outro.tween_property(card, "modulate:a", 0.0, 0.13).set_delay(0.04)
	outro.tween_property(_header, "modulate:a", 0.0, 0.16).set_delay(0.04)
	outro.tween_property(_board, "scale", Vector2.ONE * 0.985, 0.20).set_delay(0.06)
	outro.tween_property(_board, "modulate:a", 0.0, 0.20).set_delay(0.06)
	outro.tween_property(_wash, "modulate:a", 0.0, 0.22).set_delay(0.08)
	await outro.finished
	_closed = true


func setup_party(game: RefCounted) -> void:
	selected_party.assign(game.data.selected_party)
	_refresh_party()


func _refresh_party() -> void:
	party_status.text = "外勤小队  %d 人" % selected_party.size()
	confirm_button.disabled = _opening or _is_closing or selected_id.is_empty() or selected_party.is_empty()
	_wire_focus()


func select_action(id: String) -> void:
	if not cards.has(id) or _is_closing:
		return
	selected_id = id
	if _selection_tween and _selection_tween.is_running():
		_selection_tween.kill()
	_selection_tween = create_tween().set_parallel(true)
	for action: Resource in _actions:
		var active: bool = action.id == id
		cards[action.id].set_pressed_no_signal(active)
		_selection_tween.tween_property(_marks[action.id], "modulate:a", 1.0 if active else 0.0, 0.16)
		_selection_tween.tween_property(_rims[action.id], "modulate:a", 1.0 if active else 0.0, 0.16)
	# Keep the old content visible while a snapshot fades over the new content.
	var old_content := _briefing.duplicate() as Control
	_footer.add_child(old_content)
	for action: Resource in _actions:
		if action.id == id:
			selection_title.text = "已选择  /  " + _ui_title(action)
			selection_description.text = _ui_description(action)
			selection_meta.text = _ui_selection_meta(action)
			_fit_selection_thumbnail(action.thumbnail)
	_selection_thumbnail.show()
	_selection_placeholder.hide()
	_briefing.modulate.a = 0.0
	_selection_tween.tween_property(_briefing, "modulate:a", 1.0, 0.16)
	_selection_tween.tween_property(old_content, "modulate:a", 0.0, 0.16)
	# Independent cleanup also runs when rapid selection interrupts this tween.
	get_tree().create_timer(0.17).timeout.connect(old_content.queue_free)
	_refresh_party()


func _build_header(state: Dictionary, rules: Resource) -> void:
	_image(_header, Art.LOGO, Rect2(112, 16, 211, 110))
	_label(_header, "今日行动", Rect2(520, 26, 560, 66), 42, Art.WHITE, HORIZONTAL_ALIGNMENT_CENTER, _title_font)
	_label(_header, "TODAY'S EXPEDITION", Rect2(570, 92, 460, 24), 14, Color("#c1ced4"), HORIZONTAL_ALIGNMENT_CENTER, _bold)
	_label(_header, "第 %02d 天  /  %02d" % [state.day, rules.end_day], Rect2(1230, 51, 252, 36), 22, Art.WHITE, HORIZONTAL_ALIGNMENT_RIGHT, _bold)
	_label(_header, "出勤后 %d 秒进入蓝时" % int(_base_map.day_seconds + _day_extension), Rect2(1120, 90, 362, 24), 14, Color("#c1ced4"), HORIZONTAL_ALIGNMENT_RIGHT)
	var status_paper := NinePatchRect.new()
	status_paper.name = "ResourceStrip"
	# Tile only clean paper; repeating the illustrated corners creates visible notches.
	status_paper.texture = _region(CARD, Rect2(40, 100, 220, 64))
	status_paper.position = Vector2(174, 134)
	status_paper.size = Vector2(1252, 61)
	status_paper.axis_stretch_horizontal = NinePatchRect.AXIS_STRETCH_MODE_TILE_FIT
	status_paper.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_header.add_child(status_paper)
	var need: int = state.members.size() * rules.food_per_member
	var values: Array[String] = ["食物  %d  ·  今晚需 %d" % [state.food, need], "废料  %d" % state.scrap, "外勤小队  %d 人" % state.members.size()]
	for index: int in range(values.size()):
		var color: Color = Color("#9a3c32") if index == 0 and state.food < need else INK
		var label := _label(_header, values[index], Rect2(210 + index * 402, 142, 360, 42), 20, color, HORIZONTAL_ALIGNMENT_CENTER, _bold)
		if index == 2:
			party_status = label
		else:
			var icon: Texture2D = load("res://assets/ui/camp/m03/m03_icon_%s.png" % ("food" if index == 0 else "scrap"))
			_image(_header, icon, Rect2(204 + index * 402, 149, 28, 28))
			var divider := ColorRect.new()
			divider.color = Color(0.3, 0.4, 0.45, 0.25)
			divider.position = Vector2(598 + index * 402, 150)
			divider.size = Vector2(1, 28)
			divider.mouse_filter = Control.MOUSE_FILTER_IGNORE
			_header.add_child(divider)


func _paper(parent: Node, rect: Rect2) -> NinePatchRect:
	var paper := NinePatchRect.new()
	paper.texture = _region(PAPER, Rect2(110, 140, 1954, 439))
	paper.position = rect.position
	paper.size = rect.size
	paper.patch_margin_left = 72
	paper.patch_margin_right = 72
	paper.patch_margin_top = 24
	paper.patch_margin_bottom = 24
	paper.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(paper)
	return paper


func _build_card(action: Resource, at: Vector2, _modifiers: RefCounted) -> void:
	var card := Button.new()
	card.name = "Destination_" + action.id
	card.text = _ui_title(action)
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
	var plate := _image(visual, CARD, Rect2(Vector2.ZERO, card.size), TextureRect.STRETCH_SCALE)
	var rim := _image(visual, plate.texture, Rect2(Vector2(-14, -14), card.size + Vector2(28, 28)), TextureRect.STRETCH_SCALE)
	var outline := ShaderMaterial.new()
	outline.shader = CardHover.EFFECT_SHADER
	outline.set_shader_parameter("card_texture", plate.texture)
	outline.set_shader_parameter("hover_amount", 1.0)
	outline.set_shader_parameter("outline_color", Color("#78b4d6"))
	outline.set_shader_parameter("glow_color", Color(0.3, 0.65, 0.9, 0.12))
	outline.set_shader_parameter("content_origin_uv", Vector2(14, 14) / rim.size)
	outline.set_shader_parameter("content_size_uv", card.size / rim.size)
	rim.material = outline
	visual.move_child(rim, 0)
	rim.modulate.a = 0.0
	_rims[action.id] = rim
	_label(visual, _ui_title(action), Rect2(29, 23, 292, 37), 27, INK, HORIZONTAL_ALIGNMENT_CENTER, _title_font)
	_image(visual, action.thumbnail, Rect2(29, 71, 292, 130), TextureRect.STRETCH_KEEP_ASPECT_COVERED)
	var mark := _label(visual, "已选择", Rect2(237, 161, 84, 32), 17, Art.WHITE, HORIZONTAL_ALIGNMENT_CENTER, _bold)
	var badge := StyleBoxFlat.new()
	badge.bg_color = Color("#5485a2")
	badge.set_corner_radius_all(4)
	mark.add_theme_stylebox_override("normal", badge)
	mark.modulate.a = 0.0
	_marks[action.id] = mark
	var rows: Array[String] = [_mission_type(action), "距离  " + _distance_label(action), "物资倾向  " + _material_tendency(action)]
	var symbols: Array[String] = ["◎", "⌁", "◆"]
	for index: int in range(rows.size()):
		_label(visual, symbols[index], Rect2(30, 226 + index * 43, 31, 31), 22, action.accent, HORIZONTAL_ALIGNMENT_CENTER, _bold)
		_label(visual, rows[index], Rect2(70, 224 + index * 43, 248, 33), 19, action.accent if index == 2 else INK, HORIZONTAL_ALIGNMENT_LEFT, _bold)
	_build_rating(visual, "物资", _material_rating(action), 0)
	_build_rating(visual, "危险", _danger_rating(action), 1)
	_build_rating(visual, "路程", _distance_rating(action), 2)
	card.tooltip_text = _ui_description(action) + "\n实际带回量取决于搜索、拾取、加成与撤离。"
	card.mouse_entered.connect(_hover.bind(action.id, true))
	card.mouse_exited.connect(_hover.bind(action.id, false))
	card.focus_entered.connect(_hover.bind(action.id, true))
	card.focus_exited.connect(_hover.bind(action.id, false))
	card.pressed.connect(select_action.bind(action.id))


func _hover(id: String, active: bool) -> void:
	if _opening or _is_closing:
		return
	if _hover_tweens.has(id):
		_hover_tweens[id].kill()
	var visual: Control = cards[id].get_node("CardVisual")
	var tween := create_tween().set_parallel(true).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(visual, "position:y", -4.0 if active else 0.0, 0.14)
	tween.tween_property(visual, "modulate", Color(1.025, 1.025, 1.025) if active else Color.WHITE, 0.14)
	_hover_tweens[id] = tween


func _mission_type(action: Resource) -> String:
	return "补给搜刮" if action.id == "residential" else "物资搜集" if action.id == "commercial" else "高风险回收"


func _build_footer() -> void:
	_paper(_footer, Rect2(118, 704, 1017, 176))
	# Only the fixed left photo/clip is reused; the baked text-area rule is excluded.
	_image(_footer, _region(SELECTION, Rect2(0, 94, 435, 423)), Rect2(118, 704, 219, 176), TextureRect.STRETCH_SCALE)
	_briefing = Control.new()
	_briefing.name = "BriefingContent"
	_briefing.size = REFERENCE
	_briefing.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_footer.add_child(_briefing)
	_selection_thumbnail = Polygon2D.new()
	_selection_thumbnail.name = "SelectedDestinationThumbnail"
	_selection_thumbnail.polygon = PackedVector2Array([Vector2(139, 743), Vector2(300, 724), Vector2(319, 833), Vector2(155, 852)])
	_briefing.add_child(_selection_thumbnail)
	_selection_thumbnail.hide()
	_selection_placeholder = _label(_briefing, "?", Rect2(158, 745, 122, 88), 42, Color("#b4c1ca"), HORIZONTAL_ALIGNMENT_CENTER, _title_font)
	selection_title = _label(_briefing, "选择今天的目的地", Rect2(354, 720, 728, 40), 27, INK, HORIZONTAL_ALIGNMENT_LEFT, _bold)
	selection_description = _label(_briefing, "进入街区搜索物资，并在蓝时前主动返航。", Rect2(354, 767, 728, 48), 18, MUTED)
	selection_description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	selection_meta = _label(_briefing, "物资倾向  —    风险提示  —", Rect2(354, 825, 728, 28), 16, Color("#526775"), HORIZONTAL_ALIGNMENT_LEFT, _bold)
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
	_footer.add_child(button)
	return button


func _build_rating(parent: Node, title: String, rating: int, index: int) -> void:
	var center := CenterContainer.new()
	center.name = "StatSlot_" + title
	center.position = Vector2(42 + index * 96, STAT_SLOT_POSITION_Y)
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
	var amount_label := _label(stack, _rating_dots(rating), Rect2(), 17, INK, HORIZONTAL_ALIGNMENT_CENTER, _bold)
	amount_label.name = "Amount"
	amount_label.custom_minimum_size = Vector2(72, 25)


func _ui_title(action: Resource) -> String:
	return "空投区域" if action.id == "airdrop" else action.display_name


func _ui_description(action: Resource) -> String:
	match action.id:
		"residential":
			return "进入住宅街区搜索食物与一般物资，风险相对可控。"
		"commercial":
			return "进入商业街搜索废料与一般补给，街区遭遇风险更高。"
		"airdrop":
			return "深入空投区域搜寻高价值物资，留意感染者并及时返航。"
		_:
			return action.description


func _ui_selection_meta(action: Resource) -> String:
	return "物资倾向  %s    ·    风险提示  %s" % [_material_tendency(action), action.danger]


func _material_tendency(action: Resource) -> String:
	match action.id:
		"residential":
			return "食物 ↑↑"
		"commercial":
			return "废料 ↑↑"
		"airdrop":
			return "高价值物资 ↑"
		_:
			return "一般补给"


func _distance_label(action: Resource) -> String:
	return "近距" if action.id == "residential" else "中距" if action.id == "commercial" else "远距"


func _material_rating(action: Resource) -> int:
	return 4 if action.id == "residential" else 4 if action.id == "commercial" else 3


func _danger_rating(action: Resource) -> int:
	return 2 if action.id == "residential" else 3 if action.id == "commercial" else 5


func _distance_rating(action: Resource) -> int:
	return 2 if action.id == "residential" else 3 if action.id == "commercial" else 5


func _rating_dots(rating: int) -> String:
	return "●".repeat(rating) + "○".repeat(5 - rating)




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
