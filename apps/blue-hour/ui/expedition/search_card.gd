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

func setup(target: Node3D) -> void:
	mission = target
	mouse_filter = MOUSE_FILTER_IGNORE
	add_theme_stylebox_override("panel", HudArt.panel("hud_world_interact_panel", Vector4(14, 20, 14, 18)))
	clip_contents = true
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
	search_icon.texture = HudArt.texture("icon_house")
	search_icon.position = Vector2(0, 3)
	search_icon.size = Vector2(18, 18)
	search_icon.mouse_filter = MOUSE_FILTER_IGNORE
	content.add_child(search_icon)
	portrait = TextureRect.new()
	portrait.position = Vector2(0, 27)
	portrait.size = Vector2(34, 42)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	portrait.mouse_filter = MOUSE_FILTER_IGNORE
	content.add_child(portrait)
	detail = UI.label("", 12, Style.INK)
	detail.position = Vector2(44, 27)
	detail.size = Vector2(244, 42)
	detail.clip_text = true
	detail.mouse_filter = MOUSE_FILTER_IGNORE
	content.add_child(detail)
	remaining_label = UI.label("", 12, Style.INK)
	remaining_label.position = Vector2(0, 75)
	remaining_label.size = Vector2(276, 20)
	content.add_child(remaining_label)
	progress = ProgressBar.new()
	progress.position = Vector2(0, 98)
	progress.size = Vector2(288, 10)
	progress.show_percentage = false
	progress.add_theme_font_size_override("font_size", 1)
	progress.mouse_filter = MOUSE_FILTER_IGNORE
	HudArt.progress(progress)
	content.add_child(progress)
	action = UI.button("派遣", _act, Vector2(160, 30))
	action.position = Vector2(58, 133)
	action.size = Vector2(160, 30)
	action.add_theme_font_size_override("font_size", 14)
	action.expand_icon = true
	# Keep the close icon in its own leading slot so it cannot overlap the label.
	action.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
	action.alignment = HORIZONTAL_ALIGNMENT_CENTER
	action.add_theme_constant_override("icon_max_width", 16)
	action.add_theme_constant_override("h_separation", 6)
	HudArt.button(action)
	content.add_child(action)
	visibility_changed.connect(_animate_show)
	HudArt.pass_decorations(self)
	_resize_card(Visual.COMPACT_SIZE)

func _resize_card(dimensions: Vector2) -> void:
	custom_minimum_size = dimensions
	size = dimensions
	title.position.x = 24
	title.size.x = dimensions.x - 52
	progress.size.x = dimensions.x - 28
	remaining_label.size.x = dimensions.x - 28
	action.position.x = (dimensions.x - 28 - action.size.x) * .5

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
	search_icon.texture = HudArt.texture("icon_complete" if site.searched else "icon_vehicle" if site.vehicle else "icon_house")
	var active_task: bool = task != null and task.worker != null
	var expanded: bool = not site.searched and active_task
	_set_expanded(expanded, id)
	detail.visible = expanded
	progress.visible = active_task
	remaining_label.visible = active_task
	portrait.visible = active_task
	action.visible = expanded
	action.disabled = not mission.active or mission.closing_left >= 0
	action.text = "取消搜索" if active_task else "派遣"
	# Cancellation is already explicit in the label; the extra cross only competes for space.
	action.icon = null if active_task else HudArt.fitted_icon(HudArt.texture("icon_search"))
	if active_task:
		var seconds: float = mission.effects.search_seconds(site.spec.search_seconds, task.worker.talent.search_multiplier) * (1.0 - site.progress)
		detail.position.x = 44
		detail.text = "%s\n%s" % [task.worker.data.display_name, task.action_label()]
		remaining_label.text = "剩余 %d 秒  ·  %d%%" % [ceili(seconds), site.progress * 100]
		progress.value = site.progress * 100
		var path: String = task.worker.data.portrait_path
		var template_id: String = mission.campaign.member_template(task.worker.data.id).id if mission.campaign != null else task.worker.data.id
		portrait.texture = load(path) if not path.is_empty() else Portraits.PORTRAITS.get(template_id)
	else:
		detail.position.x = 0
		detail.text = "主要资源：%s\n预计搜索：%ds" % [Copy.loot(site), site.spec.search_seconds]

func _act() -> void:
	if mission.search_tasks.has(site_id):
		mission.command_recall(site_id)
	else:
		mission.command_search(site_id)
