extends Node3D
## The formal Camp shares the main viewport; CanvasLayer owns only its controls.
signal member_selected(id: String)
signal facility_selected(descriptor: Node3D)
const CAMP = preload("res://scenes/camp/camp_main.tscn")
var camera: Camera3D
var camp: Node3D
var members: Dictionary = {}
var interaction_locked := false
var _run_seed := 0
var _templates: Array[String] = []
var interactables: Dictionary = {}
var _selected := ""
var _hovered := ""

func setup(game: RefCounted) -> void:
	_run_seed = game.data.seed
	for id: String in game.data.members:
		_templates.append(game.member_template(id).id)
	camp = CAMP.instantiate()
	add_child(camp)
	camp.configure(game)
	camera = camp.get_node("CameraRig/PitchPivot/Camera3D")
	camera.make_current()
	members = camp.members
	for descriptor: Node3D in get_tree().get_nodes_in_group("camp_interactables"):
		if camp.is_ancestor_of(descriptor):
			interactables[descriptor.id] = descriptor

func matches_run(game: RefCounted) -> bool:
	if _run_seed != game.data.seed or members.keys() != game.data.members:
		return false
	for index: int in range(_templates.size()):
		if _templates[index] != game.member_template(game.data.members[index]).id:
			return false
	return true

func refresh_members(game: RefCounted) -> void:
	for id: String in members:
		members[id].refresh_equipment(game)

func member_point(id: String) -> Vector2:
	return camera.unproject_position(members[id].global_position + Vector3.UP)

func interactable_point(id: String) -> Vector2:
	var descriptor: Node3D = interactables[id]
	return camera.unproject_position(descriptor.to_global(descriptor.pick_center))

func _member_at(point: Vector2) -> String:
	var closest := ""
	var distance := 32.0
	for id: String in members:
		var current: float = member_point(id).distance_to(point)
		if current < distance:
			closest = id
			distance = current
	return closest

func _process(_delta: float) -> void:
	# Camp uses the same world_select_ring resource as Expedition. Keep the
	# legacy duty ring hidden even when survivor refresh/ambient state updates it.
	for key: String in members:
		var visual = members[key].visual
		visual.duty_ring.visible = false
		visual.selection_ring.visible = key == _selected or key == _hovered
	var hovered := "" if interaction_locked or get_viewport().gui_get_hovered_control() != null else _member_at(get_viewport().get_mouse_position())
	if hovered != _hovered:
		_hovered = hovered
		select(_selected)

func _unhandled_input(event: InputEvent) -> void:
	if interaction_locked:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var closest := _member_at(event.position)
		if not closest.is_empty():
			get_viewport().set_input_as_handled()
			member_selected.emit(closest)
			return
		var origin := camera.project_ray_origin(event.position)
		var query := PhysicsRayQueryParameters3D.create(origin, origin + camera.project_ray_normal(event.position) * 100, 8)
		query.collide_with_areas = true
		query.collide_with_bodies = false
		var hit := get_world_3d().direct_space_state.intersect_ray(query)
		if not hit.is_empty():
			var descriptor: Node3D = hit.collider.get_meta("camp_interactable")
			if descriptor.enabled:
				get_viewport().set_input_as_handled()
				facility_selected.emit(descriptor)

func select(id: String) -> void:
	_selected = id
	for key: String in members:
		var visual = members[key].visual
		visual.duty_ring.visible = false
		visual.selection_ring.visible = key == id or key == _hovered
