extends Control
## Static building anchors are projected after camera motion, once per rendered frame.
const Card = preload("res://ui/expedition/search_card.gd")
const MAX_ANCHOR_ADJUSTMENT: Vector2 = Vector2(24, 12)
var mission: Node3D
var focused_id: String = ""
var displayed_id: String = ""
var cards: Dictionary = {}
var detail: Label:
	get: return _focus_card.detail
var progress: ProgressBar:
	get: return _focus_card.progress
var title: Label:
	get: return _focus_card.title
var _focus_card: PanelContainer
var _preview_card: PanelContainer
var _refresh_left: float = 0.0

func setup(target: Node3D) -> void:
	mission = target
	mission.search_completed.connect(func(_id: String, _worker: String, _loot: Dictionary) -> void: refresh())
	mission.search_cancelled.connect(func(_id: String) -> void: refresh())
	mouse_filter = MOUSE_FILTER_IGNORE
	process_priority = 100
	_preview_card = Card.new()
	add_child(_preview_card)
	_preview_card.setup(mission)
	_preview_card.hide()
	_focus_card = _preview_card

func _process(delta: float) -> void:
	_refresh_left -= delta
	if _refresh_left <= 0:
		_refresh_left = .1
		refresh()
	_project_cards(delta)

func refresh() -> void:
	var hovered: String = ""
	# The displayed card owns its hover region, including transparent labels.
	# A button must not invalidate the very world hover that made it appear.
	var pointed_card: PanelContainer = _card_under_pointer()
	var selected_search_id: String = ""
	if not mission.search_tasks.is_empty():
		selected_search_id = mission.search_tasks.keys()[0]
	# World hover no longer opens a large information card; only active searches
	# retain a compact progress surface.
	# Selection is represented by the discovery list; world cards are reserved for tasks.
	if not hovered.is_empty() and (not mission.city.sites.has(hovered) or not mission.city.sites[hovered].discovered):
		hovered = ""
	displayed_id = hovered if not hovered.is_empty() else mission.poi_selected_id
	if not mission.city.sites.has(displayed_id) or not mission.city.sites[displayed_id].discovered:
		displayed_id = selected_search_id
	for id: String in mission.city.sites:
		# Keep the map readable: one active search card, otherwise one hover/selected card.
		# Keep a lightweight object for callers that inspect a hovered site, but
		# only active searches are shown in world space.
		var live: bool = Card.is_searching(mission, id)
		var should_exist: bool = live or id == focused_id
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
	visible = mission.input_enabled and not mission.extraction and (not displayed_id.is_empty() or not cards.is_empty())
	if not visible:
		return
	if _preview_card.visible:
		_project(_preview_card, displayed_id, delta)
	for id: String in cards:
		# Read the task every rendered frame so cancellation and completion cannot linger.
		cards[id].update_site(id, mission.poi_selected_id == id)
		if not cards[id].visible:
			cards[id].hide()
			continue
		_project(cards[id], id, delta)

func _project(card: PanelContainer, id: String, delta: float) -> void:
	var anchor: Vector3 = mission.city.sites[id].search_anchor.global_position
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
