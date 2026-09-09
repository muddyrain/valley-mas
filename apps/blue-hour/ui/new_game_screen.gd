extends Control
const UI = preload("res://ui/ui_style.gd")
const Art = preload("res://ui/menu_art.gd")
const SHADE = preload("res://ui/menu_shade.gdshader")
var app: Node
var selected := "combat"
var tabs: Dictionary = {}
var details: VBoxContainer
var confirm_button: Button
var content: MarginContainer
var column: VBoxContainer
var brand: TextureRect
var footer: MarginContainer
var menu_buttons: Array[Button] = []
var effect_titles: Array[Label] = []
var effect_descriptions: Array[Label] = []
var paper_panels: Array[PanelContainer] = []
var title: Label
var menu_window: Window
var previous_aspect: Window.ContentScaleAspect

func setup(owner_app: Node) -> void:
	app = owner_app
	menu_window = get_window()
	previous_aspect = menu_window.content_scale_aspect
	menu_window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Art.theme()
	_build_background()
	content = MarginContainer.new()
	content.set_anchors_and_offsets_preset(Control.PRESET_CENTER_RIGHT)
	add_child(content)
	column = VBoxContainer.new()
	column.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	column.add_theme_constant_override("separation", 16)
	content.add_child(column)
	_build_creation()
	_build_footer()
	resized.connect(_layout)
	_layout()
	Art.flow_focus(menu_buttons)
	var ids: Array = tabs.keys()
	for index in range(ids.size()):
		tabs[ids[index]].focus_neighbor_left = tabs[ids[posmod(index-1,ids.size())]].get_path()
		tabs[ids[index]].focus_neighbor_right = tabs[ids[(index+1)%ids.size()]].get_path()
	menu_buttons[0].grab_focus.call_deferred()
	# One short reveal; the illustration stays still and no state is polled per frame.
	column.modulate.a = 0
	create_tween().tween_property(column, "modulate:a", 1.0, .24).set_trans(Tween.TRANS_SINE)

func _build_background() -> void:
	var image := TextureRect.new()
	image.texture = Art.BACKGROUND
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(image)
	var shade := ColorRect.new()
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = SHADE
	material.set_shader_parameter("strength", 1.1)
	shade.material = material
	add_child(shade)

func _make_brand(parent: Node) -> TextureRect:
	var result := TextureRect.new()
	result.texture = Art.logo()
	result.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	result.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(result)
	return result

func _paper(parent: Node) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", Art.paper())
	parent.add_child(panel)
	paper_panels.append(panel)
	return panel

func _build_creation() -> void:
	brand = _make_brand(self)
	brand.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	var header := _paper(column)
	var header_row := HBoxContainer.new()
	header.add_child(header_row)
	title = UI.label("新建游戏", 30, Art.INK)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_row.add_child(title)
	header_row.add_child(UI.label("NEW JOURNEY", 13, Art.MUTED))
	column.add_child(UI.label("选择开局专精", 19, Art.WHITE))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	column.add_child(row)
	for spec in app.catalog.specializations:
		var tab := Art.button(spec.display_name, func(): select_specialization(spec.id))
		tab.toggle_mode = true
		tab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tab.add_theme_font_size_override("font_size", 22)
		row.add_child(tab)
		tabs[spec.id] = tab
		menu_buttons.append(tab)
	var panel := _paper(column)
	details = VBoxContainer.new()
	details.add_theme_constant_override("separation", 12)
	panel.add_child(details)
	for index in range(2):
		if index == 1:
			var line := HSeparator.new()
			details.add_child(line)
		var box := VBoxContainer.new()
		box.add_theme_constant_override("separation", 5)
		details.add_child(box)
		box.add_child(UI.label("起始被动" if index == 0 else "特殊能力  /  每日一次", 13, Art.MUTED))
		var effect_title := UI.label("", 23, Art.INK)
		box.add_child(effect_title)
		effect_titles.append(effect_title)
		var description := UI.wrapped("", 18, Art.INK)
		box.add_child(description)
		effect_descriptions.append(description)
	var team := _paper(column)
	var team_column := VBoxContainer.new()
	team.add_child(team_column)
	team_column.add_child(UI.label("起始队伍  /  随机 %d 人" % app.catalog.start_rules.starting_count, 19, Art.INK))
	team_column.add_child(UI.label("保留个人特质 · 武器自由分配", 14, Art.MUTED))
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 14)
	column.add_child(actions)
	var cancel := Art.button("取消", _back, false, true)
	cancel.custom_minimum_size.x = 96
	actions.add_child(cancel)
	menu_buttons.append(cancel)
	confirm_button = Art.button("确认创建", func(): app.confirm_creation(selected), true)
	confirm_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_child(confirm_button)
	menu_buttons.append(confirm_button)
	select_specialization(selected)

func select_specialization(id: String) -> void:
	selected = id
	var spec: Resource = app.catalog.by_id(app.catalog.specializations, id)
	for key in tabs:
		var active: bool = key == id
		tabs[key].set_pressed_no_signal(active)
		tabs[key].text = ("✓  " if active else "") + app.catalog.by_id(app.catalog.specializations, key).display_name
		var style: StyleBox = Art.paper() if active else UI.panel(Color("#102839"), Color("#648493"))
		style.content_margin_left = 12
		style.content_margin_right = 12
		style.content_margin_top = 10
		style.content_margin_bottom = 10
		for state in ["normal", "pressed", "hover", "hover_pressed"]:
			tabs[key].add_theme_stylebox_override(state, style)
		for state in ["font_color", "font_pressed_color", "font_hover_color", "font_hover_pressed_color", "font_focus_color"]:
			tabs[key].add_theme_color_override(state, Art.INK if active else Art.WHITE)
	var effects: Array = [app.catalog.by_id(app.catalog.passives, spec.passive_id), app.catalog.by_id(app.catalog.powers, spec.power_id)]
	for index in range(effects.size()):
		effect_titles[index].text = effects[index].display_name
		effect_descriptions[index].text = effects[index].description()

func _build_footer() -> void:
	footer = MarginContainer.new()
	footer.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	footer.offset_top = -44
	footer.offset_bottom = -18
	add_child(footer)
	var row := HBoxContainer.new()
	footer.add_child(row)
	var hint := UI.label("Esc  返回主菜单", 14, Art.WHITE)
	hint.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(hint)
	row.add_child(UI.label("BLUE HOUR: HOMEWARD   /   " + str(ProjectSettings.get_setting("application/config/version")), 12, Color("#abc0cd")))

func _layout() -> void:
	if content == null:
		return
	var compact := size.y < 760 or size.x < 1200
	var edge := maxf(28, size.x * .045)
	var width := minf(530, size.x * .49)
	content.offset_left = -edge - width
	content.offset_right = -edge
	content.offset_top = -size.y * .44
	content.offset_bottom = size.y * .41
	column.add_theme_constant_override("separation", 10 if compact else 16)
	footer.offset_left = edge
	footer.offset_right = -edge
	brand.position = Vector2(edge, 26)
	brand.size = Vector2(250 if compact else 320, 125 if compact else 160)
	title.add_theme_font_size_override("font_size", 26 if compact else 30)
	for tab in tabs.values():
		tab.custom_minimum_size.y = 56 if compact else 72
	for text in effect_titles:
		text.add_theme_font_size_override("font_size", 20 if compact else 23)
	for text in effect_descriptions:
		text.add_theme_font_size_override("font_size", 16 if compact else 18)
	confirm_button.custom_minimum_size.y = 68 if compact else 82
	for panel in paper_panels:
		var style: StyleBox = panel.get_theme_stylebox("panel")
		style.content_margin_top = 12 if compact else 20
		style.content_margin_bottom = 12 if compact else 20
		style.content_margin_left = 22 if compact else 28
		style.content_margin_right = 22 if compact else 28

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
	# Full-bleed menus can expand without changing the established mission layout.
	if is_instance_valid(menu_window):
		menu_window.content_scale_aspect = previous_aspect
