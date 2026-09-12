extends Button
const Style = preload("res://ui/expedition_theme.gd")
const UI = preload("res://ui/ui_style.gd")
const Copy = preload("res://ui/expedition/poi_copy.gd")
var status: Label
var normal_style: StyleBox
var selected_style: StyleBox

func setup(site: Dictionary, command: Callable) -> void:
	custom_minimum_size = Vector2(222, 36)
	alignment = HORIZONTAL_ALIGNMENT_LEFT
	add_theme_font_size_override("font_size", 13)
	mouse_default_cursor_shape = CURSOR_POINTING_HAND
	icon = preload("res://assets/ui/expedition/icons/gear.svg") if not site.vehicle else preload("res://assets/ui/expedition/icons/scrap.svg")
	expand_icon = true
	add_theme_constant_override("icon_max_width", 20)
	add_theme_constant_override("h_separation", 6)
	normal_style = Style.plate(Color.TRANSPARENT, Color.TRANSPARENT, 6)
	selected_style = Style.plate(Color("#245063b0"), Style.CYAN, 6)
	add_theme_stylebox_override("hover", selected_style)
	add_theme_stylebox_override("pressed", selected_style)
	add_theme_stylebox_override("disabled", normal_style)
	status = UI.label("", 11, Style.MUTED)
	status.set_anchors_and_offsets_preset(PRESET_RIGHT_WIDE)
	status.offset_left = -66
	status.offset_right = -8
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	status.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	status.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(status)
	pressed.connect(command)

func update_site(id: String, mission: Node3D) -> void:
	var site: Dictionary = mission.city.sites[id]
	var task = mission.search_tasks.get(id)
	disabled = site.searched or mission.closing_left >= 0 or not mission.active
	add_theme_stylebox_override("normal", selected_style if mission.poi_selected_id == id else normal_style)
	text = site.spec.name
	status.text = "已搜" if site.searched else "%ds" % site.spec.search_seconds
	if task != null:
		status.text = "%d%%" % (site.progress * 100)
		status.modulate = Style.CYAN
	else:
		status.modulate = Color.WHITE
	tooltip_text = "%s · %s\n%s%s\n%s" % [Copy.category(site), site.spec.name, Copy.loot(site), " · 装备" if not mission.reward_for_site(id).is_empty() else "", "已清点" if site.searched else (task.worker.data.display_name + " · 搜索中" if task != null else "待搜")]
