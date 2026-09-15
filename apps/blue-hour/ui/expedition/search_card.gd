extends PanelContainer
const UI = preload("res://ui/ui_style.gd")
const Style = preload("res://ui/expedition_theme.gd")
const Copy = preload("res://ui/expedition/poi_copy.gd")
const Portraits = preload("res://ui/expedition/squad_card.gd")
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const Visual = preload("res://ui/expedition/hud_visual_profile.gd")
var title: Label
var detail: Label
var progress: ProgressBar
var portrait: TextureRect
var action: Button
var content: Control
var search_icon: TextureRect
var site_id: String = ""
var mission: Node3D
var remaining_label: Label
var _shown_tween: Tween
var _has_shown: bool = false
var _layout_tween: Tween
var _expanded: bool = false
var _layout_id: String = ""
var time_icon: TextureRect
var pointer: TextureRect

func setup(target: Node3D) -> void:
	mission = target
	mouse_filter = MOUSE_FILTER_IGNORE
	add_theme_stylebox_override("panel", HudArt.panel("hud_world_interact_panel", Vector4(14, 20, 14, 18)))
	clip_contents = false
	content = Control.new()
	content.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(content)
	title = UI.label("", 15, Style.INK)
	title.position = Vector2(0, 0)
	title.size = Vector2(288, 24)
	title.clip_text = true
	title.mouse_filter = MOUSE_FILTER_IGNORE
	content.add_child(title)
	search_icon = TextureRect.new()
	search_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	search_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	search_icon.texture = HudArt.texture("icon_house_large")
	search_icon.position = Vector2(0, -2)
	search_icon.size = Vector2(28, 28)
	search_icon.mouse_filter = MOUSE_FILTER_IGNORE
	content.add_child(search_icon)
	portrait = TextureRect.new()
	portrait.position = Vector2(0, 30)
	portrait.size = Vector2(34, 42)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	portrait.mouse_filter = MOUSE_FILTER_IGNORE
	content.add_child(portrait)
	detail = UI.label("", 12, Style.INK)
	detail.position = Vector2(44, 30)
	detail.size = Vector2(244, 42)
	detail.clip_text = true
	detail.mouse_filter = MOUSE_FILTER_IGNORE
	content.add_child(detail)
	remaining_label = UI.label("", 12, Style.INK)
	remaining_label.position = Vector2(0, 75)
	remaining_label.size = Vector2(276, 20)
	content.add_child(remaining_label)
	time_icon = HudArt.picture("icon_search", Vector2.ZERO)
	time_icon.position = Vector2(0, 77)
	time_icon.size = Vector2(16, 16)
	content.add_child(time_icon)
	remaining_label.position.x = 20
	pointer = HudArt.picture("panel_pointer", Vector2.ZERO)
	pointer.rotation = PI
	content.add_child(pointer)
	progress = ProgressBar.new()
	progress.step = 0
	progress.position = Vector2(0, 97)
	progress.size = Vector2(288, 10)
	progress.show_percentage = false
	progress.add_theme_font_size_override("font_size", 1)
	progress.mouse_filter = MOUSE_FILTER_IGNORE
	HudArt.progress(progress)
	# The retained 11px track cannot support the generic 12px corner margins.
	for state: String in ["background", "fill"]:
		var skin: StyleBoxTexture = progress.get_theme_stylebox(state)
		for side: int in range(4):
			skin.set_texture_margin(side, 2)
	content.add_child(progress)
	progress.size.y = 12
	action = UI.button("派遣", _act, Vector2(160, 36))
	action.position = Vector2(58, 116)
	action.size = Vector2(160, 36)
	action.add_theme_font_size_override("font_size", 14)
	action.expand_icon = true
	# Keep the close icon in its own leading slot so it cannot overlap the label.
	action.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
	action.alignment = HORIZONTAL_ALIGNMENT_CENTER
	action.add_theme_constant_override("icon_max_width", 16)
	action.add_theme_constant_override("h_separation", 6)
	HudArt.button(action)
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		var button_skin: StyleBoxTexture = action.get_theme_stylebox(state)
		button_skin.texture_margin_top = 6
		button_skin.texture_margin_bottom = 6
	content.add_child(action)
	visibility_changed.connect(_animate_show)
	HudArt.pass_decorations(self)
	_resize_card(Visual.COMPACT_SIZE)

func _resize_card(dimensions: Vector2) -> void:
	custom_minimum_size = dimensions
	size = dimensions
	title.position.x = 32
	title.size.x = dimensions.x - 60
	progress.size.x = dimensions.x - 28
	remaining_label.size.x = dimensions.x - 28
	action.position.x = (dimensions.x - 28 - action.size.x) * .5
	pointer.position = Vector2((dimensions.x - 28) * .5 + 10, dimensions.y - 12)
	pointer.size = Vector2(20, 14)

func _set_expanded(expanded: bool, id: String) -> void:
	var next_size: Vector2 = Visual.SEARCH_SIZE if expanded else Visual.COMPACT_SIZE
	if _layout_id != id:
		if _layout_tween != null:
			_layout_tween.kill()
		_resize_card(next_size)
	elif _expanded != expanded:
		if _layout_tween != null:
			_layout_tween.kill()
		_layout_tween = create_tween()
		_layout_tween.tween_method(_resize_card, size, next_size, Visual.INTERACTION_SECONDS).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_layout_id = id
	_expanded = expanded

func _animate_show() -> void:
	if not is_visible_in_tree():
		return
	if _has_shown:
		modulate.a = 1.0
		return
	_has_shown = true
	if _shown_tween != null:
		_shown_tween.kill()
	modulate.a = 0.0
	_shown_tween = create_tween()
	_shown_tween.tween_property(self, "modulate:a", 1.0, .18)

func update_site(id: String, _selected: bool) -> void:
	site_id = id
	var site: Dictionary = mission.city.sites[id]
	var task: RefCounted = mission.search_tasks.get(id)
	title.text = site.spec.name + (" · 已搜" if site.searched else "")
	search_icon.texture = HudArt.texture("icon_vehicle" if site.vehicle else "icon_house_large")
	var active_task: bool = task != null and is_instance_valid(task.worker) and task.phase in [task.Phase.SEARCHING_INSIDE, task.Phase.SEARCHING_OUTSIDE]
	var expanded: bool = false
	_set_expanded(expanded, id)
	detail.visible = false
	progress.visible = active_task
	remaining_label.visible = active_task
	time_icon.visible = active_task
	portrait.visible = false
	action.visible = active_task
	action.disabled = not mission.active or mission.closing_left >= 0
	action.text = "取消搜索" if active_task else "派遣"
	# Cancellation is already explicit in the label; the extra cross only competes for space.
	action.icon = null if active_task else HudArt.fitted_icon(HudArt.texture("icon_search"))
	if active_task:
		_resize_card(Visual.COMPACT_SIZE)
		title.visible = false
		action.size = Vector2(82, 26)
		action.position = Vector2(90, 5)
		var seconds: float = mission.effects.search_seconds(site.spec.search_seconds, task.worker.talent.search_multiplier) * (1.0 - site.progress)
		remaining_label.position = Vector2(20, 9)
		remaining_label.text = "%d%%" % [site.progress * 100]
		remaining_label.add_theme_color_override("font_color", Style.CYAN)
		progress.value = site.progress * 100
		var path: String = task.worker.data.portrait_path
		var template_id: String = mission.campaign.member_template(task.worker.data.id).id if mission.campaign != null else task.worker.data.id
		portrait.texture = load(path) if not path.is_empty() else Portraits.PORTRAITS.get(template_id)
	else:
		title.visible = true
		detail.position = Vector2(32, 28)
		detail.size.x = size.x - 60
		var supplies: Array[String] = []
		if site.spec.food > 0:
			supplies.append("食物")
		if site.spec.scrap > 0:
			supplies.append("废料")
		detail.text = "主要资源：%s\n搜索：约 %d 秒" % [" / ".join(supplies) if not supplies.is_empty() else Copy.loot(site), site.spec.search_seconds]

func _act() -> void:
	if mission.search_tasks.has(site_id):
		mission.command_recall(site_id)
	else:
		mission.command_search(site_id)
