extends VBoxContainer
## Shared settings content for the title screen and expedition pause menu.

signal close_requested

const UI = preload("res://ui/ui_style.gd")

var settings: RefCounted
var display_mode: OptionButton
var resolution_picker: OptionButton
var vsync_toggle: CheckButton
var volume_sliders: Dictionary = {}
var volume_values: Dictionary = {}
var reset_button: Button
var back_button: Button
var status_label: Label
var focus_controls: Array[Control] = []
var _dirty := false
var _text_color := Color.WHITE
var _muted_color := Color("#97afbc")
var _accent_color := Color("#83d9df")

func _exit_tree() -> void:
	commit()

func setup(preferences: RefCounted, text_color: Color, muted_color: Color, accent_color: Color) -> void:
	settings = preferences
	_text_color = text_color
	_muted_color = muted_color
	_accent_color = accent_color
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 8)
	_build_display()
	add_child(HSeparator.new())
	_build_audio()
	add_child(HSeparator.new())
	_build_footer()
	settings.save_failed.connect(_show_save_error)
	_flow_focus()

func focus_first() -> void:
	if not focus_controls.is_empty() and is_visible_in_tree():
		focus_controls[0].grab_focus()

func commit() -> void:
	if not _dirty or settings == null:
		return
	_dirty = not settings.persist()

func _build_display() -> void:
	add_child(UI.label("显示", 20, _accent_color))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 18)
	grid.add_theme_constant_override("v_separation", 8)
	add_child(grid)
	grid.add_child(_row_label("显示模式"))
	display_mode = OptionButton.new()
	display_mode.name = "DisplayMode"
	display_mode.custom_minimum_size.y = 44
	display_mode.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	display_mode.add_item("窗口")
	display_mode.add_item("全屏")
	display_mode.select(1 if settings.data.window_mode == "fullscreen" else 0)
	display_mode.item_selected.connect(func(index: int): settings.set_window_mode(index == 1))
	grid.add_child(display_mode)
	focus_controls.append(display_mode)
	grid.add_child(_row_label("分辨率"))
	resolution_picker = OptionButton.new()
	resolution_picker.name = "Resolution"
	resolution_picker.custom_minimum_size.y = 44
	resolution_picker.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var resolutions: Array[Vector2i] = settings.available_resolutions()
	for index: int in range(resolutions.size()):
		var value: Vector2i = resolutions[index]
		resolution_picker.add_item("%d × %d" % [value.x, value.y])
		resolution_picker.set_item_metadata(index, value)
		if value == settings.resolution():
			resolution_picker.select(index)
	resolution_picker.item_selected.connect(func(index: int): settings.set_resolution(resolution_picker.get_item_metadata(index)))
	grid.add_child(resolution_picker)
	focus_controls.append(resolution_picker)
	grid.add_child(_row_label("垂直同步"))
	vsync_toggle = CheckButton.new()
	vsync_toggle.name = "VSync"
	vsync_toggle.text = "开启" if settings.data.vsync else "关闭"
	vsync_toggle.button_pressed = settings.data.vsync
	vsync_toggle.custom_minimum_size.y = 44
	vsync_toggle.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vsync_toggle.toggled.connect(_set_vsync)
	grid.add_child(vsync_toggle)
	focus_controls.append(vsync_toggle)

func _build_audio() -> void:
	add_child(UI.label("音频", 20, _accent_color))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 18)
	grid.add_theme_constant_override("v_separation", 8)
	add_child(grid)
	_add_volume(grid, "总音量", "master_volume", "MasterVolume")
	_add_volume(grid, "音乐音量", "music_volume", "MusicVolume")
	_add_volume(grid, "音效音量", "effects_volume", "EffectsVolume")

func _add_volume(grid: GridContainer, caption: String, key: String, node_name: String) -> void:
	grid.add_child(_row_label(caption))
	var row := HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 10)
	grid.add_child(row)
	var slider := HSlider.new()
	slider.name = node_name
	slider.custom_minimum_size.y = 44
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slider.add_theme_stylebox_override("slider", _slider_track(_muted_color, 0.28))
	slider.add_theme_stylebox_override("grabber_area", _slider_track(_accent_color, 0.88))
	slider.add_theme_stylebox_override("grabber_area_highlight", _slider_track(_accent_color.lightened(0.12), 1.0))
	slider.min_value = 0.0
	slider.max_value = 1.0
	slider.step = 0.05
	slider.value = float(settings.data[key])
	slider.value_changed.connect(func(value: float): _preview_volume(key, value))
	slider.drag_ended.connect(func(_changed: bool): commit())
	row.add_child(slider)
	var value_label := UI.label(_percent(slider.value), 14, _muted_color)
	value_label.custom_minimum_size = Vector2(56, 44)
	value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	value_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(value_label)
	volume_sliders[key] = slider
	volume_values[key] = value_label
	focus_controls.append(slider)

func _build_footer() -> void:
	status_label = UI.label("", 14, _muted_color)
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(status_label)
	var row := HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 10)
	add_child(row)
	reset_button = UI.button("恢复默认", _reset, Vector2(0, 44))
	reset_button.focus_mode = Control.FOCUS_ALL
	reset_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(reset_button)
	back_button = UI.button("返回", _close, Vector2(0, 44))
	back_button.focus_mode = Control.FOCUS_ALL
	back_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(back_button)
	focus_controls.append(reset_button)
	focus_controls.append(back_button)

func _set_vsync(enabled: bool) -> void:
	vsync_toggle.text = "开启" if enabled else "关闭"
	settings.set_vsync(enabled)

func _preview_volume(key: String, value: float) -> void:
	settings.set_volume(key, value)
	var label := volume_values[key] as Label
	label.text = _percent(value)
	_dirty = true
	status_label.text = ""

func _reset() -> void:
	if not settings.reset_defaults():
		return
	_dirty = false
	display_mode.select(0)
	var current: Vector2i = settings.resolution()
	for index: int in range(resolution_picker.item_count):
		if resolution_picker.get_item_metadata(index) == current:
			resolution_picker.select(index)
			break
	vsync_toggle.set_block_signals(true)
	vsync_toggle.button_pressed = true
	vsync_toggle.text = "开启"
	vsync_toggle.set_block_signals(false)
	for key: String in volume_sliders:
		var slider := volume_sliders[key] as HSlider
		slider.set_block_signals(true)
		slider.value = float(settings.data[key])
		slider.set_block_signals(false)
		var label := volume_values[key] as Label
		label.text = _percent(slider.value)
	status_label.text = "已恢复默认设置"

func _close() -> void:
	commit()
	close_requested.emit()

func _show_save_error(_message: String) -> void:
	status_label.text = "设置未保存"

func _flow_focus() -> void:
	for index: int in range(focus_controls.size()):
		var previous: NodePath = focus_controls[posmod(index - 1, focus_controls.size())].get_path()
		var next: NodePath = focus_controls[(index + 1) % focus_controls.size()].get_path()
		focus_controls[index].focus_neighbor_top = previous
		focus_controls[index].focus_neighbor_bottom = next

func _row_label(text: String) -> Label:
	var label := UI.label(text, 16, _text_color)
	label.custom_minimum_size.y = 44
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return label

func _slider_track(color: Color, alpha: float) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(color.r, color.g, color.b, alpha)
	style.set_corner_radius_all(3)
	style.content_margin_top = 3
	style.content_margin_bottom = 3
	return style

func _percent(value: float) -> String:
	return "%d%%" % roundi(value * 100.0)
