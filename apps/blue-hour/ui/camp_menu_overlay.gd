extends Control
## In-place Camp menu. It owns modal input while Main keeps the Camp scene alive.

signal continue_requested
signal main_menu_requested
signal quit_requested

const MenuArt = preload("res://ui/menu_art.gd")
const SettingsView = preload("res://ui/settings_view.gd")
const CampMenuButton = preload("res://ui/camp_menu_button.gd")

var continue_button: StateButton
var settings_button: StateButton
var return_main_menu_button: StateButton
var quit_button: StateButton
var menu_panel: PanelContainer
var settings_panel: PanelContainer
var settings_view: VBoxContainer


func setup(preferences: RefCounted) -> void:
	name = "CampMenuOverlay"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	process_mode = Node.PROCESS_MODE_ALWAYS
	z_index = 1000
	theme = MenuArt.theme()
	_build_backdrop()
	_build_menu_panel()
	_build_settings_panel(preferences)
	continue_button.grab_focus.call_deferred()


func _gui_input(_event: InputEvent) -> void:
	accept_event()


func _build_backdrop() -> void:
	var dim_background := ColorRect.new()
	dim_background.name = "DimBackground"
	dim_background.color = Color(0.01, 0.025, 0.055, 0.78)
	dim_background.mouse_filter = Control.MOUSE_FILTER_STOP
	dim_background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim_background)


func _build_menu_panel() -> void:
	var center := CenterContainer.new()
	center.name = "Center"
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	menu_panel = PanelContainer.new()
	menu_panel.name = "MenuPanel"
	menu_panel.custom_minimum_size = Vector2(400, 440)
	menu_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	menu_panel.add_theme_stylebox_override("panel", MenuArt.dialog_paper())
	center.add_child(menu_panel)
	var column := VBoxContainer.new()
	column.name = "MenuColumn"
	column.add_theme_constant_override("separation", 12)
	menu_panel.add_child(column)
	var title := Label.new()
	title.name = "TitleLabel"
	title.text = "菜单"
	title.custom_minimum_size.y = 54
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 32)
	title.add_theme_color_override("font_color", MenuArt.INK)
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(title)
	continue_button = _menu_button("ContinueButton", "继续游戏", func() -> void: continue_requested.emit())
	settings_button = _menu_button("SettingsButton", "设置", _open_settings)
	return_main_menu_button = _menu_button("ReturnMainMenuButton", "返回主菜单", func() -> void: main_menu_requested.emit())
	quit_button = _menu_button("QuitButton", "退出游戏", func() -> void: quit_requested.emit())
	for button: StateButton in [continue_button, settings_button, return_main_menu_button, quit_button]:
		column.add_child(button)
	_flow_focus([continue_button, settings_button, return_main_menu_button, quit_button])


func _build_settings_panel(preferences: RefCounted) -> void:
	var center := get_node("Center") as CenterContainer
	settings_panel = PanelContainer.new()
	settings_panel.name = "SettingsPanel"
	settings_panel.custom_minimum_size = Vector2(660, 620)
	settings_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	settings_panel.add_theme_stylebox_override("panel", MenuArt.dialog_paper())
	center.add_child(settings_panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	settings_panel.add_child(column)
	var heading := Label.new()
	heading.name = "SettingsHeading"
	heading.text = "设置"
	heading.custom_minimum_size.y = 46
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	heading.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	heading.add_theme_font_size_override("font_size", 34)
	heading.add_theme_color_override("font_color", MenuArt.INK)
	heading.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(heading)
	settings_view = SettingsView.new()
	column.add_child(settings_view)
	settings_view.setup(preferences, MenuArt.INK, MenuArt.MUTED, MenuArt.GOLD)
	settings_view.close_requested.connect(_close_settings)
	settings_panel.hide()


func _menu_button(node_name: String, label_text: String, action: Callable) -> StateButton:
	var button := CampMenuButton.new()
	button.name = node_name
	button.setup(label_text, action)
	return button


func _flow_focus(buttons: Array[StateButton]) -> void:
	for index: int in range(buttons.size()):
		var previous := buttons[posmod(index - 1, buttons.size())].get_path()
		var next := buttons[(index + 1) % buttons.size()].get_path()
		buttons[index].focus_previous = previous
		buttons[index].focus_next = next
		buttons[index].focus_neighbor_top = previous
		buttons[index].focus_neighbor_bottom = next


func _open_settings() -> void:
	menu_panel.hide()
	settings_panel.show()
	settings_view.focus_first.call_deferred()


func _close_settings() -> void:
	settings_view.commit()
	settings_panel.hide()
	menu_panel.show()
	settings_button.grab_focus.call_deferred()
