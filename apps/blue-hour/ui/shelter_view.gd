extends Node3D
## The formal Camp shares the main viewport; CanvasLayer owns only its controls.
signal member_selected(id: String)
const CAMP = preload("res://scenes/camp/camp_main.tscn")
var camera: Camera3D
var camp: Node3D
var members: Dictionary = {}
var interaction_locked := false
var _run_seed := 0
var _templates: Array[String] = []

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

func _unhandled_input(event: InputEvent) -> void:
	if interaction_locked:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var closest := ""
		var distance := 48.0
		for id: String in members:
			var current: float = member_point(id).distance_to(event.position)
			if current < distance:
				closest = id
				distance = current
		if not closest.is_empty():
			get_viewport().set_input_as_handled()
			member_selected.emit(closest)

func select(id: String) -> void:
	for key: String in members:
		members[key].visual.duty_ring.visible = key == id
