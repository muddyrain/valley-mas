extends PanelContainer
## One context card, driven by existing site/task state. No second selection command system.
const UI = preload("res://ui/ui_style.gd")
const Style = preload("res://ui/expedition_theme.gd")
const Copy = preload("res://ui/expedition/poi_copy.gd")
var mission: Node3D
var title: Label
var detail: Label
var progress: ProgressBar
var focused_id: String = ""
var displayed_id: String = ""

func setup(target: Node3D) -> void:
	mission = target
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_theme_stylebox_override("panel", Style.plate(Color("#1c3543"), Style.GOLD, 9))
	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(column)
	title = UI.label("", 15, Style.GOLD)
	column.add_child(title)
	detail = UI.label("", 12)
	column.add_child(detail)
	progress = ProgressBar.new()
	progress.show_percentage = false
	progress.custom_minimum_size.y = 4
	progress.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(progress)
	hide()

func refresh() -> void:
	var hovered := focused_id
	if hovered.is_empty() and mission.input_enabled and not mission.controls.over_ui():
		var point: Vector2 = mission.controls.pointer
		var origin: Vector3 = mission.camera.project_ray_origin(point)
		var query := PhysicsRayQueryParameters3D.create(origin, origin + mission.camera.project_ray_normal(point) * 200, 3)
		query.collide_with_areas = true
		var hit: Dictionary = mission.get_world_3d().direct_space_state.intersect_ray(query)
		if not hit.is_empty() and hit.collider.has_meta("site_id"):
			hovered = hit.collider.get_meta("site_id")
	displayed_id = hovered if not hovered.is_empty() else mission.poi_selected_id
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		site.ring.visible = not site.searched and (id == displayed_id or mission.search_tasks.has(id))
	visible = mission.input_enabled and mission.city.sites.has(displayed_id)
	if not visible:
		return
	var site: Dictionary = mission.city.sites[displayed_id]
	var task = mission.search_tasks.get(displayed_id)
	var selected: bool = mission.poi_selected_id == displayed_id
	title.text = site.spec.name + (" · 已搜" if site.searched else "")
	title.modulate = Style.MUTED if site.searched else Color.WHITE
	detail.visible = not site.searched and (selected or task != null)
	progress.visible = task != null
	if task != null:
		var seconds: float = mission.effects.search_seconds(site.spec.search_seconds, task.worker.talent.search_multiplier) * (1.0 - site.progress)
		detail.text = "%s · %s\n剩余 %ds · %d%%" % [task.worker.data.display_name, mission.member_status(task.worker), ceili(seconds), site.progress * 100]
		progress.value = site.progress * 100
	else:
		detail.text = "%s · 可搜刮\n%s · %ds" % [Copy.category(site), Copy.loot(site), site.spec.search_seconds]
	reset_size()
	var anchor: Vector3 = site.spec.entry + Vector3(0, 2.4, 0)
	var point: Vector2 = get_parent().get_global_transform().affine_inverse() * mission.camera.unproject_position(anchor)
	var viewport_size: Vector2 = get_parent().size
	if viewport_size.x <= 504 or viewport_size.y <= 234:
		hide()
		return
	# Hide off-screen selections; the edge list continues to show their state.
	if mission.camera.is_position_behind(anchor) or not Rect2(Vector2(216, 128), viewport_size - Vector2(504, 234)).has_point(point):
		hide()
		return
	position = Vector2(clampf(point.x - size.x * .5, 216, viewport_size.x - 288 - size.x), clampf(point.y - size.y - 12, 128, viewport_size.y - 106 - size.y))
