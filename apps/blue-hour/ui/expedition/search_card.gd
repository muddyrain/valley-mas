extends PanelContainer
## A fixed-size view of a live SearchTask; selection alone never opens this card.
const UI = preload("res://ui/ui_style.gd")
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const PANEL: Texture2D = preload("res://assets/ui/expedition/search/search_active_panel.png")
const CANCEL_NORMAL: Texture2D = preload("res://assets/ui/expedition/search/search_cancel_normal.png")
const CANCEL_HOVER: Texture2D = preload("res://assets/ui/expedition/search/search_cancel_hover.png")
const STATE_ICON: Texture2D = preload("res://assets/ui/expedition/search/search_state_icon.png")
const CARD_SIZE: Vector2 = Vector2(262, 96)
const CANCEL_SIZE: Vector2 = Vector2(96, 32)
const INK: Color = Color("#12395a")
var title: Label
var detail: Label
var percent_label: Label
var progress: ProgressBar
var action: TextureButton
var content: Control
var search_icon: TextureRect
var worker_label: Label
var site_id: String = ""
var mission: Node3D

static func is_searching(target: Node3D, id: String) -> bool:
	return bool(target.search_target_state(id).get("progressing", false))

func setup(target: Node3D) -> void:
	mission = target
	name = "SearchActiveCard"
	visible = false
	mouse_filter = MOUSE_FILTER_IGNORE
	custom_minimum_size = CARD_SIZE
	size = CARD_SIZE
	add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	content = Control.new()
	content.name = "Content"
	content.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(content)
	_picture("Background", PANEL, Vector2.ZERO, CARD_SIZE)
	search_icon = _picture("BuildingIcon", null, Vector2(16, 23), Vector2(32, 34))
	title = _label("BuildingName", 15, Vector2(60, 10), Vector2(132, 22))
	worker_label = _label("SearchWorker", 10, Vector2(194, 10), Vector2(60, 22))
	worker_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	worker_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	worker_label.add_theme_color_override("font_color", Color("#2a8fb5"))
	var search_row := HBoxContainer.new()
	search_row.name = "SearchRow"
	search_row.position = Vector2(51, 36)
	search_row.size = Vector2(203, 34)
	search_row.add_theme_constant_override("separation", 12)
	search_row.mouse_filter = MOUSE_FILTER_IGNORE
	content.add_child(search_row)
	var information := Control.new()
	information.name = "SearchInformation"
	information.custom_minimum_size = Vector2(95, 34)
	information.mouse_filter = MOUSE_FILTER_IGNORE
	search_row.add_child(information)
	var state_icon: TextureRect = _picture("SearchStateIcon", STATE_ICON, Vector2(0, 2), Vector2(16, 16))
	state_icon.reparent(information, false)
	detail = _label("StatusText", 12, Vector2(18, 0), Vector2(47, 20))
	detail.reparent(information, false)
	detail.text = "搜索中..."
	percent_label = _label("PercentLabel", 13, Vector2(67, 0), Vector2(28, 20))
	percent_label.reparent(information, false)
	percent_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	progress = ProgressBar.new()
	progress.name = "ProgressBar"
	progress.position = Vector2(9, 25)
	progress.size = Vector2(86, 9)
	progress.step = 0.0
	progress.show_percentage = false
	progress.add_theme_font_size_override("font_size", 1)
	progress.mouse_filter = MOUSE_FILTER_IGNORE
	var track := StyleBoxFlat.new()
	track.bg_color = Color("#cbd7df")
	track.border_color = Color("#7997ad")
	track.set_border_width_all(1)
	track.set_corner_radius_all(4)
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color("#278fea")
	fill.border_color = Color("#176bc0")
	fill.set_border_width_all(1)
	fill.set_corner_radius_all(4)
	progress.add_theme_stylebox_override("background", track)
	progress.add_theme_stylebox_override("fill", fill)
	information.add_child(progress)
	progress.size = Vector2(86, 9)
	action = TextureButton.new()
	action.name = "CancelButton"
	action.custom_minimum_size = CANCEL_SIZE
	action.size = CANCEL_SIZE
	action.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	action.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	# Both textures include centered text and padding; preserve their native pixels.
	action.ignore_texture_size = false
	action.stretch_mode = TextureButton.STRETCH_KEEP_CENTERED
	action.texture_normal = CANCEL_NORMAL
	action.texture_hover = CANCEL_HOVER
	action.texture_pressed = CANCEL_HOVER
	action.texture_disabled = CANCEL_NORMAL
	action.tooltip_text = "取消搜索"
	action.mouse_filter = MOUSE_FILTER_STOP
	action.pressed.connect(_act)
	search_row.add_child(action)

func update_site(id: String, _selected: bool) -> void:
	site_id = id
	visible = is_searching(mission, id)
	if not visible:
		return
	var site: Dictionary = mission.city.sites[id]
	var task: RefCounted = mission.search_tasks.get(id)
	var worker: Node3D = task.worker if task != null and is_instance_valid(task.worker) else null
	title.text = site.spec.name
	worker_label.text = "· " + worker.data.display_name.left(2) if worker != null else ""
	worker_label.tooltip_text = worker.data.display_name if worker != null else ""
	search_icon.texture = HudArt.texture("icon_vehicle" if site.vehicle else "icon_house")
	progress.value = clampf(site.progress, 0.0, 1.0) * 100.0
	percent_label.text = "%d%%" % floori(progress.value)
	action.disabled = mission.closing_left >= 0

func _picture(node_name: String, texture: Texture2D, at: Vector2, dimensions: Vector2) -> TextureRect:
	var picture := TextureRect.new()
	picture.name = node_name
	picture.texture = texture
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.position = at
	picture.size = dimensions
	picture.mouse_filter = MOUSE_FILTER_IGNORE
	content.add_child(picture)
	return picture

func _label(node_name: String, font_size: int, at: Vector2, dimensions: Vector2) -> Label:
	var label: Label = UI.label("", font_size, INK)
	label.name = node_name
	label.position = at
	label.size = dimensions
	label.clip_text = true
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	label.mouse_filter = MOUSE_FILTER_IGNORE
	label.add_theme_color_override("font_shadow_color", Color.TRANSPARENT)
	content.add_child(label)
	return label

func _act() -> void:
	if is_searching(mission, site_id):
		mission.command_recall(site_id)
	update_site(site_id, false)
