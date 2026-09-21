extends Control
## Static building anchors are projected after camera motion, once per rendered frame.
const Card = preload("res://ui/expedition/search_card.gd")
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const Style = preload("res://ui/expedition_theme.gd")
const UI = preload("res://ui/ui_style.gd")
const MAX_ANCHOR_ADJUSTMENT: Vector2 = Vector2(24, 12)
const DISCOVERY_CARD_SIZE: Vector2 = Vector2(210, 58)
const COMPLETION_FEEDBACK_SECONDS: float = 2.4

class MouseLeftGlyph extends Control:
	func _ready() -> void:
		custom_minimum_size = Vector2(18, 16)
		size = custom_minimum_size
		mouse_filter = MOUSE_FILTER_IGNORE
		queue_redraw()

	func _draw() -> void:
		var shell := StyleBoxFlat.new()
		shell.bg_color = Color("#d9edf0")
		shell.border_color = Color("#4a8f9b")
		shell.set_border_width_all(1)
		shell.set_corner_radius_all(4)
		draw_style_box(shell, Rect2(1, 1, 16, 14))
		draw_line(Vector2(9, 2), Vector2(9, 8), Color("#4a8f9b"), 1.0)
		draw_circle(Vector2(5, 5), 1.2, Color("#4a8f9b"))

var mission: Node3D
var focused_id: String = ""
var displayed_id: String = ""
var hovered_id: String = ""
var cards: Dictionary = {}
var _completion_feedback: Dictionary = {}
var detail: Label:
	get: return _focus_card.detail
var progress: ProgressBar:
	get: return _focus_card.progress
var title: Label:
	get: return _focus_card.title
var _focus_card: PanelContainer
var _preview_card: PanelContainer
var _discovery_card: PanelContainer
var _discovery_icon: TextureRect
var _discovery_title: Label
var _discovery_status: Label
var _discovery_mouse_hint: MouseLeftGlyph
var _refresh_left: float = 0.0
var _last_selected_id: String = ""

func setup(target: Node3D) -> void:
	mission = target
	mission.search_completed.connect(func(id: String, _worker: String, loot: Dictionary) -> void:
		_record_completion(id, loot)
		refresh())
	mission.search_cancelled.connect(func(_id: String) -> void: refresh())
	mouse_filter = MOUSE_FILTER_IGNORE
	process_priority = 100
	_discovery_card = _create_discovery_card()
	add_child(_discovery_card)
	_preview_card = Card.new()
	add_child(_preview_card)
	_preview_card.setup(mission)
	_preview_card.hide()
	_focus_card = _preview_card

func _process(delta: float) -> void:
	for id: String in _completion_feedback.keys():
		var feedback: Dictionary = _completion_feedback[id]
		feedback.left = float(feedback.left) - delta
		if float(feedback.left) <= 0.0:
			_completion_feedback.erase(id)
	_refresh_left -= delta
	if _refresh_left <= 0:
		_refresh_left = .1
		refresh()
	_project_cards(delta)

func refresh() -> void:
	hovered_id = _world_hover_id()
	var selected_id: String = mission.poi_selected_id if mission.city.sites.has(mission.poi_selected_id) else ""
	if not selected_id.is_empty() and not mission.city.sites[selected_id].discovered:
		selected_id = ""
	if selected_id != _last_selected_id:
		_last_selected_id = selected_id
		if not selected_id.is_empty():
			_pop_discovery_card()
	var hovered_busy: bool = not hovered_id.is_empty() and Card.is_searching(mission, hovered_id)
	var selected_busy: bool = not selected_id.is_empty() and Card.is_searching(mission, selected_id)
	if hovered_busy:
		displayed_id = hovered_id
	elif selected_busy or not selected_id.is_empty():
		displayed_id = selected_id
	else:
		displayed_id = hovered_id
	if displayed_id.is_empty() and mission.city.sites.has(focused_id):
		displayed_id = focused_id
	if displayed_id.is_empty():
		for id: String in mission.search_tasks:
			displayed_id = id
			break
	_update_discovery_card(displayed_id, selected_id)
	for id: String in mission.city.sites:
		# Keep the map readable: one active search card, otherwise one hover/selected card.
		# Keep a lightweight object for callers that inspect a hovered site, but
		# only active searches are shown in world space.
		var live: bool = Card.is_searching(mission, id)
		var should_exist: bool = live or id == focused_id or id == mission.poi_selected_id
		# One persistent view per task; hover/selection only changes emphasis.
		if should_exist:
			if not cards.has(id):
				var card := Card.new()
				add_child(card)
				card.setup(mission)
				cards[id] = card
			cards[id].update_site(id, mission.poi_selected_id == id)
			cards[id].visible = live
		elif cards.has(id):
			cards[id].hide()
	_focus_card = cards.get(displayed_id, _preview_card)
	_preview_card.hide()
	_project_cards()

func _world_hover_id() -> String:
	if not mission.input_enabled or mission.extraction or mission.controls.over_ui():
		return ""
	var origin: Vector3 = mission.camera.project_ray_origin(mission.controls.pointer)
	var ray: Vector3 = mission.camera.project_ray_normal(mission.controls.pointer)
	var query := PhysicsRayQueryParameters3D.create(origin, origin + ray * 250.0, 2)
	query.collide_with_areas = true
	var hit: Dictionary = mission.get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return ""
	var collider: Object = hit.collider
	if not collider.has_meta("site_id"):
		return ""
	var id: String = str(collider.get_meta("site_id"))
	return id if mission.city.sites.has(id) and mission.city.sites[id].discovered else ""

func _create_discovery_card() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.name = "SearchDiscoverabilityCard"
	panel.custom_minimum_size = DISCOVERY_CARD_SIZE
	panel.size = DISCOVERY_CARD_SIZE
	panel.mouse_filter = MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override("panel", _discovery_style(false))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = MOUSE_FILTER_IGNORE
	panel.add_child(row)
	_discovery_icon = HudArt.picture("icon_search", Vector2(24, 24))
	_discovery_icon.custom_minimum_size = Vector2(24, 24)
	row.add_child(_discovery_icon)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 1)
	row.add_child(column)
	_discovery_title = UI.label("", 15, Style.INK)
	_discovery_title.clip_text = true
	_discovery_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	column.add_child(_discovery_title)
	var prompt := HBoxContainer.new()
	prompt.name = "SearchPrompt"
	prompt.add_theme_constant_override("separation", 5)
	prompt.mouse_filter = MOUSE_FILTER_IGNORE
	column.add_child(prompt)
	_discovery_mouse_hint = MouseLeftGlyph.new()
	prompt.add_child(_discovery_mouse_hint)
	_discovery_status = UI.label("", 12, Style.MUTED)
	_discovery_status.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	prompt.add_child(_discovery_status)
	return panel

func _discovery_style(active: bool) -> StyleBoxFlat:
	var panel := StyleBoxFlat.new()
	panel.bg_color = Color("#eff5f3e6") if active else Color("#e8f0eedb")
	panel.border_color = Color("#4ab9c4") if active else Color("#78969a")
	panel.set_border_width_all(1)
	panel.set_corner_radius_all(6)
	panel.content_margin_left = 12
	panel.content_margin_right = 12
	panel.content_margin_top = 8
	panel.content_margin_bottom = 8
	return panel

func _update_discovery_card(id: String, selected_id: String) -> void:
	if id.is_empty() or not mission.city.sites.has(id):
		_discovery_card.hide()
		return
	var site: Dictionary = mission.city.sites[id]
	if not site.discovered:
		_discovery_card.hide()
		return
	var state: Dictionary = mission.search_target_state(id)
	var busy: bool = Card.is_searching(mission, id)
	var show_complete: bool = _completion_feedback.has(id)
	var selected: bool = id == selected_id
	if busy:
		_discovery_card.hide()
		return
	_discovery_title.text = site.spec.name
	_discovery_icon.texture = HudArt.texture("icon_vehicle" if site.vehicle else "icon_search")
	_discovery_card.add_theme_stylebox_override("panel", _discovery_style(selected or show_complete))
	if show_complete:
		_discovery_mouse_hint.hide()
		_discovery_status.text = "搜索完成 · " + str(_completion_feedback_text(id))
		_discovery_status.add_theme_color_override("font_color", Style.CYAN)
	elif site.searched or state.completed:
		if id != hovered_id:
			_discovery_card.hide()
			return
		_discovery_mouse_hint.hide()
		_discovery_status.text = "已搜索"
		_discovery_status.add_theme_color_override("font_color", Style.MUTED)
	elif selected:
		_discovery_mouse_hint.show()
		_discovery_status.text = "前往搜索" if mission.search_tasks.has(id) else "搜索目标"
		_discovery_status.add_theme_color_override("font_color", Style.CYAN)
	else:
		_discovery_mouse_hint.show()
		_discovery_status.text = "搜索"
		_discovery_status.add_theme_color_override("font_color", Style.INK)
	_discovery_card.show()

func _pop_discovery_card() -> void:
	_discovery_card.pivot_offset = _discovery_card.size * .5
	_discovery_card.scale = Vector2(.94, .94)
	var tween := create_tween()
	tween.tween_property(_discovery_card, "scale", Vector2.ONE, .14).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func _completion_feedback_text(id: String) -> String:
	var feedback: Dictionary = _completion_feedback.get(id, {})
	var result: Dictionary = feedback.get("loot", {})
	var parts: PackedStringArray = []
	if int(result.get("food", 0)) > 0:
		parts.append("食物 +%d" % int(result.food))
	if int(result.get("scrap", 0)) > 0:
		parts.append("废料 +%d" % int(result.scrap))
	return " · ".join(parts) if not parts.is_empty() else "暂无物资"

func _record_completion(id: String, loot: Dictionary) -> void:
	_completion_feedback[id] = {"left": COMPLETION_FEEDBACK_SECONDS, "loot": loot.duplicate(true)}

func _card_under_pointer() -> PanelContainer:
	if not mission.input_enabled or mission.extraction:
		return null
	var children: Array[Node] = get_children()
	children.reverse()
	for child: Node in children:
		if child is PanelContainer and not child.is_queued_for_deletion() and child.is_visible_in_tree() and child.get_global_rect().has_point(mission.controls.pointer):
			return child
	return null

func _project_cards(delta: float = 0.0) -> void:
	visible = mission.input_enabled and not mission.extraction and (_discovery_card.visible or not cards.is_empty())
	if not visible:
		return
	if _preview_card.visible:
		_project(_preview_card, displayed_id, delta)
	if _discovery_card.visible:
		_project(_discovery_card, displayed_id, delta)
	for id: String in cards:
		# Read the task every rendered frame so cancellation and completion cannot linger.
		cards[id].update_site(id, mission.poi_selected_id == id)
		if not cards[id].visible:
			cards[id].hide()
			continue
		_project(cards[id], id, delta)

func _project(card: PanelContainer, id: String, delta: float) -> void:
	var anchor: Vector3 = _site_ui_anchor(mission.city.sites[id])
	var point: Vector2 = get_global_transform().affine_inverse() * mission.camera.unproject_position(anchor)
	var area: Vector2 = get_parent().size
	if area.x <= 475 or area.y <= 214:
		card.hide()
		return
	var viewport_scale: Vector2 = get_global_transform().get_scale() * get_viewport().get_stretch_transform().get_scale()
	var screen: Rect2 = Rect2(Vector2.ZERO, area)
	card.visible = not mission.camera.is_position_behind(anchor) and screen.has_point(point)
	if not card.visible:
		card.remove_meta("anchor_id")
		return
	var desired: Vector2 = point - Vector2(card.size.x * .5, card.size.y + 12)
	var to_local: Transform2D = get_global_transform().affine_inverse()
	var squad_end: Vector2 = to_local * get_parent().squad_panel.get_global_rect().end
	var objective_start: Vector2 = to_local * get_parent().sites_panel.get_global_rect().position
	var clock_end: Vector2 = to_local * get_parent().top_panel.get_global_rect().end
	var minimum := Vector2(squad_end.x + 12, clock_end.y + 12)
	var maximum := Vector2(objective_start.x - card.size.x - 12, area.y - card.size.y - 136)
	# Keep the baked pointer near its search anchor, even beside HUD or viewport edges.
	minimum = minimum.max(desired - MAX_ANCHOR_ADJUSTMENT)
	maximum = maximum.min(desired + MAX_ANCHOR_ADJUSTMENT)
	if minimum.x > maximum.x or minimum.y > maximum.y:
		card.hide()
		card.remove_meta("anchor_id")
		return
	desired = desired.clamp(minimum, maximum)
	var initial: bool = card.get_meta("anchor_id", "") != id or card.get_meta("layout_size", Vector2.ZERO) != card.size or card.get_meta("viewport_area", Vector2.ZERO) != area
	var current: Vector2 = card.get_meta("smoothed_position", desired)
	var distance_pixels: float = ((desired - current) * viewport_scale).length()
	if initial or distance_pixels > 180:
		current = desired
	elif delta > 0.0 and distance_pixels > 1.5:
		current = current.lerp(desired, 1.0 - exp(-delta / .045))
	card.set_meta("anchor_id", id)
	card.set_meta("layout_size", card.size)
	card.set_meta("viewport_area", area)
	card.set_meta("smoothed_position", current)
	card.position = ((current * viewport_scale).round() / viewport_scale).clamp(minimum, maximum)

func _site_ui_anchor(site: Dictionary) -> Vector3:
	var anchor: Variant = site.get("search_ui_anchor", site.get("search_anchor"))
	if anchor is Node3D:
		return (anchor as Node3D).global_position
	return site.spec.entry + Vector3.UP * 2.0
