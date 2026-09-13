extends Control
const UI = preload("res://ui/ui_style.gd")
const Art = preload("res://ui/menu_art.gd")
const Entry = preload("res://ui/menu_entry.gd")
const SettingsView = preload("res://ui/settings_view.gd")
const BRAND = preload("res://assets/ui/common/branding/ui_common_logo_tagline.png")
const POSTER = preload("res://assets/ui/main_menu/main_menu_poster.png")
const SOCIAL = preload("res://assets/ui/main_menu/main_menu_social_entries.png")
const REFERENCE := Vector2(1919, 1080)
var app: Node
var menu_buttons: Array[Button] = []
var social_buttons: Array[Button] = []
var composition: Control
var menu_window: Window
var previous_aspect: Window.ContentScaleAspect
var overlay: Control
var return_focus: Control
var settings_view: Control

func setup(owner_app: Node) -> void:
	app = owner_app
	menu_window = get_window()
	previous_aspect = menu_window.content_scale_aspect
	menu_window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Art.theme()
	var background := _image(self, Art.BACKGROUND)
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var material := ShaderMaterial.new()
	material.shader = preload("res://ui/title_backdrop.gdshader")
	background.material = material
	# A contained reference canvas preserves the composition; extra aspect space
	# belongs to the background. Groups anchor within it; menus flow in containers.
	composition = Control.new()
	composition.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(composition)
	composition.size = REFERENCE
	var brand := _image(composition, _region(BRAND, Rect2(160,0,1460,887)))
	_anchor_box(brand, Vector2(92,48)/REFERENCE, Vector2(516,314))
	var column := VBoxContainer.new()
	composition.add_child(column)
	_anchor_box(column, Vector2(122,408)/REFERENCE, Vector2(373,470))
	column.add_theme_constant_override("separation", 10)
	var labels := ["开始游戏", "继续", "角色图鉴", "营地档案", "设置", "退出"]
	var actions: Array[Callable] = [app.show_new_game, _continue, _show_characters, _show_archive, _show_settings, app.request_quit]
	for index in range(labels.size()):
		var entry := Entry.new()
		column.add_child(entry)
		entry.setup(labels[index], index, actions[index])
		menu_buttons.append(entry)
	if app.campaign.data.is_empty():
		menu_buttons[1].tooltip_text = "还没有存档"
	var poster := _image(composition, POSTER)
	poster.name = "StaticPoster"
	_anchor_box(poster, Vector2(1305,-32)/REFERENCE, Vector2(614,810))
	var social_row := HBoxContainer.new()
	composition.add_child(social_row)
	_anchor_box(social_row, Vector2(120,927)/REFERENCE, Vector2(380,100))
	social_row.add_theme_constant_override("separation", 62)
	for index in range(3):
		var entry := Button.new()
		entry.name = ["Wishlist", "Community", "Credits"][index]
		entry.custom_minimum_size = Vector2(86,100)
		entry.focus_mode = Control.FOCUS_ALL
		entry.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		entry.tooltip_text = ["愿望单暂未开放", "社区暂未开放", "制作组信息暂未公开"][index]
		for state in ["normal", "pressed", "hover", "focus"]:
			entry.add_theme_stylebox_override(state, StyleBoxEmpty.new())
		social_row.add_child(entry)
		var sprite := _image(entry, _region(SOCIAL, Rect2(index*724+146,56,500,482)))
		sprite.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
		sprite.offset_left = 6
		sprite.offset_right = -6
		sprite.offset_bottom = 74
		var caption := UI.label(["愿望单", "社区", "制作组"][index], 20, Art.WHITE)
		caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		entry.add_child(caption)
		caption.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
		caption.offset_top = -24
		entry.mouse_entered.connect(entry.grab_focus)
		entry.focus_entered.connect(func(): sprite.modulate = Color(1.22,1.22,1.22))
		entry.focus_exited.connect(func(): sprite.modulate = Color.WHITE)
		entry.pressed.connect(func(): _show_notice(entry.tooltip_text))
		social_buttons.append(entry)
	var version := UI.label("Blue Hour Homeward   v%s Demo" % ProjectSettings.get_setting("application/config/version"), 14, Art.WHITE)
	version.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	composition.add_child(version)
	_anchor_box(version, Vector2(1330,1035)/REFERENCE, Vector2(548,24))
	Art.flow_focus(menu_buttons + social_buttons)
	for index in range(social_buttons.size()):
		social_buttons[index].focus_neighbor_left = social_buttons[posmod(index-1,3)].get_path()
		social_buttons[index].focus_neighbor_right = social_buttons[(index+1)%3].get_path()
	resized.connect(_layout)
	_layout()
	menu_buttons[0 if app.campaign.data.is_empty() else 1].grab_focus.call_deferred()

func _layout() -> void:
	var factor := minf(size.x/REFERENCE.x, size.y/REFERENCE.y)
	composition.scale = Vector2.ONE * factor
	composition.position = (size-REFERENCE*factor)/2

func _anchor_box(control: Control, anchor: Vector2, dimensions: Vector2) -> void:
	control.anchor_left = anchor.x
	control.anchor_right = anchor.x
	control.anchor_top = anchor.y
	control.anchor_bottom = anchor.y
	control.offset_right = dimensions.x
	control.offset_bottom = dimensions.y

func _image(parent: Node, texture: Texture2D) -> TextureRect:
	var result := TextureRect.new()
	result.texture = texture
	result.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	result.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(result)
	return result

func _region(texture: Texture2D, rect: Rect2) -> AtlasTexture:
	var result := AtlasTexture.new()
	result.atlas = texture
	result.region = rect
	result.filter_clip = true
	return result

func _continue() -> void:
	if app.campaign.data.is_empty():
		_show_notice("还没有存档。开始一段新的旅程吧。")
	else:
		app.continue_from_menu()

func _show_characters() -> void:
	var column := _open_overlay("角色图鉴")
	for member in app.catalog.survivors:
		var trait_data: Resource = app.catalog.by_id(app.catalog.traits, member.trait_id)
		column.add_child(UI.label(member.display_name, 25, Art.INK))
		column.add_child(UI.wrapped("%s · %s" % [trait_data.display_name, trait_data.description], 18, Art.INK))
	_finish_overlay(column)

func _show_archive() -> void:
	var column := _open_overlay("营地档案")
	if app.campaign.data.is_empty():
		column.add_child(UI.wrapped("尚未开始旅程。", 22, Art.INK))
	else:
		var data: Dictionary = app.campaign.data
		column.add_child(UI.label("第 %d 天 · %d 位幸存者" % [data.day, data.members.size()], 25, Art.INK))
		column.add_child(UI.wrapped("同行伙伴  /  " + app.member_names(data.members), 20, Art.INK))
		column.add_child(UI.label("食物  %d    零件  %d" % [data.food, data.scrap], 22, Art.INK))
	_finish_overlay(column)

func _show_settings() -> void:
	var column := _open_overlay("设置", 640)
	var settings_panel := column.get_parent() as PanelContainer
	settings_panel.add_theme_stylebox_override("panel", Art.dialog_paper())
	var heading := column.get_child(0) as Label
	heading.name = "SettingsHeading"
	heading.custom_minimum_size.y = 46
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	heading.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	heading.add_theme_font_size_override("font_size", 36)
	settings_view = SettingsView.new()
	column.add_child(settings_view)
	settings_view.setup(app.settings, Art.INK, Art.MUTED, Art.GOLD)
	settings_view.close_requested.connect(_close_overlay)
	settings_view.focus_first.call_deferred()

func _show_notice(message: String) -> void:
	var column := _open_overlay("蓝时归航")
	column.add_child(UI.wrapped(message, 22, Art.INK))
	_finish_overlay(column)

func _open_overlay(heading: String, panel_width: float = 540.0) -> VBoxContainer:
	return_focus = get_viewport().gui_get_focus_owner()
	for entry in menu_buttons + social_buttons:
		entry.focus_mode = Control.FOCUS_NONE
	overlay = Control.new()
	add_child(overlay)
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.color = Color(0.015,0.03,0.055,.68)
	overlay.add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var center := CenterContainer.new()
	overlay.add_child(center)
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = panel_width
	panel.add_theme_stylebox_override("panel", Art.paper())
	center.add_child(panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 18)
	panel.add_child(column)
	column.add_child(UI.label(heading, 32, Art.INK))
	return column

func _finish_overlay(column: VBoxContainer) -> Button:
	var close := Art.button("返回", _close_overlay)
	column.add_child(close)
	close.grab_focus.call_deferred()
	return close

func _close_overlay() -> void:
	if overlay == null:
		return
	if is_instance_valid(settings_view):
		settings_view.commit()
	remove_child(overlay)
	overlay.queue_free()
	overlay = null
	settings_view = null
	for entry in menu_buttons + social_buttons:
		entry.focus_mode = Control.FOCUS_ALL
	if is_instance_valid(return_focus):
		return_focus.grab_focus()

func _input(event: InputEvent) -> void:
	var escape_pressed: bool = event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_ESCAPE
	if overlay != null and (escape_pressed or event.is_action_pressed("ui_cancel")):
		get_viewport().set_input_as_handled()
		_close_overlay()

func _exit_tree() -> void:
	if is_instance_valid(menu_window):
		menu_window.content_scale_aspect = previous_aspect
