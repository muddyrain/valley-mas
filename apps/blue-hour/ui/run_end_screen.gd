extends Control

signal new_run_requested
signal main_menu_requested

const Art = preload("res://ui/run_end_art.gd")
const MenuArt = preload("res://ui/menu_art.gd")
const Summary = preload("res://ui/run_end_summary.gd")
const MemberCard = preload("res://ui/run_member_result_card.gd")

var member_cards: Array[RunMemberResultCard] = []
var member_scroll: ScrollContainer
var member_grid: GridContainer
var menu_button: Button
var new_run_button: Button
var title_label: Label
var reason_label: Label
var empty_label: Label
var summary_values: Array[Label] = []
var summary_icons: Array[TextureRect] = []
var paper_panel: PanelContainer
var actions: HBoxContainer
var closing_label: Label
var _canvas: Control
var _heading: Control
var _brand: TextureRect
var _motto: Label
var _crest: TextureRect
var _english: Label
var _message: Label
var _paper_stack: Control
var _paper_backings: Array[NinePatchRect] = []
var _postcard: PanelContainer
var _footer: Label
var _body: VBoxContainer
var _action_taken: bool = false
var _window: Window
var _previous_aspect: Window.ContentScaleAspect

func setup(campaign: RefCounted) -> void:
	_window = get_window()
	_previous_aspect = _window.content_scale_aspect
	_window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = MenuArt.theme()
	var result: Dictionary = Summary.from_campaign(campaign)
	if result.is_empty():
		return
	var won: bool = result.status == "won"
	var background := Art.image(self, Art.BACKGROUND)
	background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var atmosphere := ShaderMaterial.new()
	atmosphere.shader = preload("res://ui/run_end_backdrop.gdshader")
	atmosphere.set_shader_parameter("saturation", .94 if won else .32)
	atmosphere.set_shader_parameter("exposure", 1.08 if won else .78)
	atmosphere.set_shader_parameter("tint", Color(1.0, .98, .94) if won else Color(.82, .91, 1.0))
	background.material = atmosphere
	_canvas = Control.new()
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_canvas)
	_brand = Art.image(_canvas, MenuArt.logo())
	_motto = Art.label("无论多远，\n总有可以回家的路。", 25, Art.CREAM, 400)
	_motto.add_theme_font_override("font", Art.handwriting_font())
	_motto.rotation = -.04
	_canvas.add_child(_motto)
	_heading = Control.new()
	_heading.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.add_child(_heading)
	_crest = Art.image(_heading, Art.CREST)
	_crest.modulate = Color(.78, .87, .94, .84)
	var title: String = ("五日生存成功" if result.end_day == 5 else "%d 日生存成功" % result.end_day) if won else "归航中断"
	title_label = Art.label(title, 88, Color("#fff1ce") if won else Color("#edc1b5"), 900)
	title_label.add_theme_font_override("font", Art.headline_font())
	title_label.add_theme_color_override("font_shadow_color", Color(.02, .08, .15, .85))
	title_label.add_theme_constant_override("shadow_offset_x", 2)
	title_label.add_theme_constant_override("shadow_offset_y", 4)
	title_label.add_theme_constant_override("outline_size", 1)
	title_label.add_theme_color_override("font_outline_color", title_label.get_theme_color("font_color"))
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_heading.add_child(title_label)
	_english = Art.label("R U N   C O M P L E T E" if won else "R U N   F A I L E D", 15, Art.CREAM)
	_english.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_heading.add_child(_english)
	_message = Art.label("天还没黑，而我们已经走向明天。" if won else "这一次，我们没能把所有人带回家。", 25, Art.CREAM, 400)
	_message.add_theme_font_override("font", Art.handwriting_font())
	_message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_heading.add_child(_message)
	_paper_stack = Control.new()
	_paper_stack.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.add_child(_paper_stack)
	for index: int in 2:
		var backing := NinePatchRect.new()
		backing.texture = Art.PAPER
		backing.patch_margin_left = 18
		backing.patch_margin_right = 18
		backing.patch_margin_top = 18
		backing.patch_margin_bottom = 18
		backing.modulate = Color("#b8b2a2") if index == 0 else Color("#ddd1ba")
		backing.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_paper_stack.add_child(backing)
		_paper_backings.append(backing)
	paper_panel = PanelContainer.new()
	paper_panel.add_theme_stylebox_override("panel", Art.paper(20, Color.WHITE if won else Color(.96, .98, 1.0)))
	_paper_stack.add_child(paper_panel)
	paper_panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	_body = VBoxContainer.new()
	_body.add_theme_constant_override("separation", 6)
	paper_panel.add_child(_body)
	_body.add_child(Art.section("生存总结", "S U M M A R Y"))
	_body.add_child(Art.rule())
	var stats := HBoxContainer.new()
	stats.custom_minimum_size.y = 66
	stats.add_theme_constant_override("separation", 10)
	_body.add_child(stats)
	var captions: Array[String] = ["生存天数" if won else "坚持天数", "幸存成员", "最终食物", "最终废料"]
	var values: Array[String] = ["%d / %d" % [result.day, result.end_day] if won else "%d 天" % result.day, str(result.alive_count), str(result.food), str(result.scrap)]
	var kinds: Array[String] = ["calendar", "members", "food", "scrap"]
	for index: int in captions.size():
		if index > 0:
			var divider := ColorRect.new()
			divider.color = Color(.18, .29, .4, .22)
			divider.custom_minimum_size = Vector2(1, 44)
			divider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			divider.mouse_filter = Control.MOUSE_FILTER_IGNORE
			stats.add_child(divider)
		var stat := HBoxContainer.new()
		stat.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		stat.add_theme_constant_override("separation", 10)
		stats.add_child(stat)
		var icon := Art.image(stat, Art.icon(kinds[index]), Vector2(40, 40))
		icon.modulate = Art.INK
		icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		summary_icons.append(icon)
		var copy := VBoxContainer.new()
		copy.alignment = BoxContainer.ALIGNMENT_CENTER
		copy.add_theme_constant_override("separation", 0)
		stat.add_child(copy)
		copy.add_child(Art.label(captions[index], 17, Art.INK, 800))
		var value := Art.label(values[index], 32, Art.INK, 800)
		copy.add_child(value)
		summary_values.append(value)
	var reason := PanelContainer.new()
	var reason_style := StyleBoxFlat.new()
	reason_style.bg_color = Color(.65, .27, .22, .07)
	reason_style.content_margin_left = 8
	reason_style.content_margin_right = 8
	reason_style.content_margin_top = 4
	reason_style.content_margin_bottom = 4
	reason.add_theme_stylebox_override("panel", reason_style)
	reason.visible = not won
	_body.add_child(reason)
	var reason_row := HBoxContainer.new()
	reason_row.add_theme_constant_override("separation", 10)
	reason.add_child(reason_row)
	var warning := Art.image(reason_row, Art.icon("warning"), Vector2(22, 22))
	warning.modulate = Color("#9b4d43")
	warning.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	reason_label = Art.label("失败原因  /  " + str(result.reason), 18, Color("#9b4d43"), 700)
	reason_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	reason_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	reason_label.visible = not won
	reason_row.add_child(reason_label)
	_body.add_child(Art.rule())
	var members_heading := Art.section("成员状态", "S U R V I V O R S")
	_body.add_child(members_heading)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	members_heading.add_child(spacer)
	empty_label = Art.label("无人生还", 16, Color("#9b4d43"))
	empty_label.visible = result.alive_count == 0
	members_heading.add_child(empty_label)
	member_scroll = ScrollContainer.new()
	member_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	member_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	member_scroll.custom_minimum_size.y = 90
	member_scroll.follow_focus = true
	_body.add_child(member_scroll)
	member_grid = GridContainer.new()
	member_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	member_grid.add_theme_constant_override("h_separation", 14)
	member_grid.add_theme_constant_override("v_separation", 12)
	member_scroll.add_child(member_grid)
	for member: Dictionary in result.members:
		var card: RunMemberResultCard = MemberCard.new()
		member_grid.add_child(card)
		card.setup(member)
		member_cards.append(card)
	var closing := VBoxContainer.new()
	closing.add_theme_constant_override("separation", 2)
	_body.add_child(closing)
	closing_label = Art.label("在废墟之上，你们守住了回家的路。" if won else "不是每一次归航都能顺利抵达。", 26, Art.INK, 400)
	closing_label.add_theme_font_override("font", Art.handwriting_font())
	closing.add_child(closing_label)
	closing.add_child(Art.rule())
	_decorate_paper()
	_build_postcard()
	actions = HBoxContainer.new()
	actions.add_theme_constant_override("separation", 18)
	_canvas.add_child(actions)
	menu_button = Art.button("返回主菜单", "M A I N   M E N U", "home", _request_menu, false)
	new_run_button = Art.button("重新出发", "N E W   R U N", "arrow", _request_new_run, true)
	actions.add_child(menu_button)
	actions.add_child(new_run_button)
	MenuArt.flow_focus([menu_button, new_run_button])
	_footer = Art.label("TO A BRIGHTER TOMORROW.   ///", 11, Color(.86, .88, .88, .74), 400)
	_canvas.add_child(_footer)
	resized.connect(_layout)
	_body.minimum_size_changed.connect(_layout, CONNECT_DEFERRED)
	member_scroll.resized.connect(_reflow_members)
	_layout()
	new_run_button.grab_focus.call_deferred()

func _layout() -> void:
	if _canvas == null:
		return
	# Keep the same readable physical layout with or without project canvas scaling.
	var window_width: float = maxf(1.0, get_window().size.x)
	var native_scale: float = window_width / maxf(1.0, size.x)
	var factor: float = clampf(window_width / 1600.0, .8, 1.25) / native_scale
	_canvas.scale = Vector2.ONE * factor
	_canvas.size = size / factor
	var extent: Vector2 = _canvas.size
	var compact: bool = extent.y < 830
	var left: float = extent.x * (.35 if extent.x < 1400 else .46)
	var width: float = extent.x - left - 34
	_brand.position = Vector2(28, 26)
	_brand.size = Vector2(310, 150)
	_motto.position = Vector2(54, 182)
	_motto.size = Vector2(284, 90)
	_heading.position = Vector2(left, 16 if compact else 28)
	_heading.size = Vector2(width, 210)
	_crest.position = Vector2(width * .5 - 170, 0)
	_crest.size = Vector2(340, 58 if compact else 66)
	title_label.position = Vector2(0, 30 if compact else 48)
	title_label.size = Vector2(width, 96 if compact else 112)
	title_label.add_theme_font_size_override("font_size", 68 if compact else 88)
	_english.position = Vector2(0, 116 if compact else 156)
	_english.size = Vector2(width, 22)
	_message.position = Vector2(0, 145 if compact else 190)
	_message.size = Vector2(width, 32)
	_message.add_theme_font_size_override("font_size", 22 if compact else 25)
	var action_y: float = extent.y - (110 if compact else 130)
	var paper_y: float = 196 if compact else 258
	_paper_stack.position = Vector2(left, paper_y)
	_paper_stack.size = Vector2(width, action_y - paper_y - 16)
	paper_panel.size = _paper_stack.size
	for index: int in _paper_backings.size():
		_paper_backings[index].position = Vector2(-4 + index * 6, 5 + index * 2)
		_paper_backings[index].size = _paper_stack.size + Vector2(3, 2)
	actions.position = Vector2(left, action_y)
	actions.size = Vector2(width, 78)
	_postcard.position = Vector2(extent.x - 160, 124 if compact else 174)
	_postcard.size = Vector2(120, 108)
	_postcard.rotation = .10
	_footer.position = Vector2(30, extent.y - 26)
	for card: RunMemberResultCard in member_cards:
		card.set_compact(compact)
	_reflow_members()

func _reflow_members() -> void:
	if member_grid != null:
		member_grid.columns = 1 if member_cards.size() <= 1 or member_scroll.size.x < 570 else 2

func _decorate_paper() -> void:
	var decoration := Control.new()
	decoration.mouse_filter = Control.MOUSE_FILTER_IGNORE
	paper_panel.add_child(decoration)
	var tape := Art.image(decoration, Art.TAPE)
	tape.position = Vector2(-28, -5)
	tape.size = Vector2(90, 38)
	tape.rotation = -.55
	var edge_tape := Art.image(decoration, Art.TAPE)
	edge_tape.anchor_left = 1
	edge_tape.anchor_top = .55
	edge_tape.position = Vector2(-18, 0)
	edge_tape.size = Vector2(38, 90)
	edge_tape.rotation = -.08
	edge_tape.modulate.a = .75

func _build_postcard() -> void:
	_postcard = PanelContainer.new()
	_postcard.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_postcard.add_theme_stylebox_override("panel", Art.paper(8))
	_canvas.add_child(_postcard)
	var photo := VBoxContainer.new()
	photo.add_theme_constant_override("separation", 4)
	photo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_postcard.add_child(photo)
	var scene := AtlasTexture.new()
	scene.atlas = Art.BACKGROUND
	scene.region = Rect2(Art.BACKGROUND.get_width() * .48, Art.BACKGROUND.get_height() * .5, Art.BACKGROUND.get_width() * .48, Art.BACKGROUND.get_height() * .32)
	var picture := Art.image(photo, scene, Vector2(0, 63))
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var caption := Art.label("H O M E W A R D", 10, Art.MUTED, 400)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	photo.add_child(caption)

func _request_new_run() -> void:
	if _action_taken:
		return
	_action_taken = true
	new_run_requested.emit()

func _request_menu() -> void:
	if _action_taken:
		return
	_action_taken = true
	main_menu_requested.emit()

func _exit_tree() -> void:
	if is_instance_valid(_window):
		_window.content_scale_aspect = _previous_aspect
