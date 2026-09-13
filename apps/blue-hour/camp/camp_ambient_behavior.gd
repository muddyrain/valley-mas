class_name CampAmbientBehavior
extends Node
## Owns camp intent, reservations and bounded navigation recovery.
signal state_changed(member_id: String, state: String)
enum State { DISABLED, IDLE, SELECT_POI, MOVE_TO_POI, ARRIVE, POI_IDLE, RETURN_IDLE, DEPARTURE_OVERRIDE }
const Navigation = preload("res://camp/camp_ambient_navigation.gd")
const DebugView = preload("res://camp/camp_ambient_debug.gd")
const STUCK_SECONDS := 2.0
const RETRY_SECONDS := 1.75
const STUCK_DISTANCE := 0.12
const MAX_TRAVEL_SECONDS := 38.0
const POIS: Array[Dictionary] = [
	{"id": "workbench", "position": Vector3(-7.9, 0, -3.25), "facing": Vector3(-7.9, 0, -4.5), "stay": Vector2(12, 22)},
	{"id": "notice_board", "position": Vector3(-2.14, 0, -2.95), "facing": Vector3(-2.3, 0, -4.12), "stay": Vector2(12, 22)},
	{"id": "main_station", "position": Vector3(0, 0, -2.35), "facing": Vector3(0, 0, -6.75), "stay": Vector2(12, 24)},
	{"id": "storage", "position": Vector3(9.6, 0, -1.35), "facing": Vector3(9.6, 0, -2.6), "stay": Vector2(12, 24)},
	{"id": "rest_table", "position": Vector3(1.55, 0, -0.85), "facing": Vector3(1.55, 0, 1.65), "stay": Vector2(18, 30)},
	{"id": "rest_fire", "position": Vector3(-1.8, 0, 0.5), "facing": Vector3(-0.55, 0, 1.65), "stay": Vector2(18, 30)},
	{"id": "rest_bench", "position": Vector3(1.55, 0, 4.0), "facing": Vector3(1.55, 0, 2.62), "stay": Vector2(18, 30)},
]
var camp: Node3D
var navigation: Node3D
var pois: Array[Dictionary] = []
var reservations: Dictionary = {}
var repath_count: Dictionary = {}
var recoveries: Dictionary = {}
var _actors: Array[Node3D] = []
var _states: Dictionary = {}
var _targets: Dictionary = {}
var _timers: Dictionary = {}
var _cooldowns: Dictionary = {}
var _progress: Dictionary = {}
var _stuck: Dictionary = {}
var _repathed: Dictionary = {}
var _travel: Dictionary = {}
var _original: Dictionary = {}
var _rng := RandomNumberGenerator.new()
var _enabled := false
var _cancelled := false
var _application: Node
var _selection_paused := false

func _physics_process(delta: float) -> void:
	if _selection_paused and is_instance_valid(_application) and _application.state == "shelter":
		_selection_paused = false
		_cancelled = false
		_enabled = true
		for actor: Node3D in _actors:
			_use_ambient_navigation(actor)
			_timers[actor.member_id] = _rng.randf_range(8.0, 18.0)
			_set_state(actor.member_id, State.IDLE)
	if not _enabled:
		return
	for actor: Node3D in _actors:
		if is_instance_valid(actor):
			if actor.boarded:
				_release(actor.member_id)
			else:
				_advance(actor, delta)

func setup(world: Node3D, seed: int = 0) -> void:
	camp = world
	_rng.seed = seed if seed != 0 else 1337
	navigation = Navigation.new()
	navigation.name = "AmbientGroundNavigation"
	camp.add_child(navigation)
	navigation.setup(camp)
	await get_tree().physics_frame
	await get_tree().physics_frame
	if _cancelled:
		return
	while NavigationServer3D.map_get_iteration_id(navigation.map) == 0:
		await get_tree().physics_frame
		if not is_inside_tree() or _cancelled:
			return
	pois = POIS.duplicate(true)
	var anchors := Node3D.new()
	anchors.name = "SafeAmbientAnchors"
	camp.add_child(anchors)
	for poi: Dictionary in pois:
		var anchor := Marker3D.new()
		anchor.name = str(poi.id)
		anchors.add_child(anchor)
		anchor.global_position = poi.position
		poi.safe_radius = 0.35
		poi.capacity = 1
		poi.enabled = navigation.is_safe(poi.position)
		poi.projected = navigation.project(poi.position)
		if not poi.enabled:
			push_warning("Unsafe Ambient anchor disabled: %s (projection %.3fm)" %
					[poi.id, poi.position.distance_to(poi.projected)])
	var index := 0
	for id: String in world.members:
		var actor: Node3D = world.members[id]
		_actors.append(actor)
		_original[id] = {"map": actor.agent.get_navigation_map(), "height": actor.agent.path_height_offset,
			"speed": actor.move_speed, "mask": actor.collision_mask}
		_use_ambient_navigation(actor)
		_cooldowns[id] = {}
		_stuck[id] = 0.0
		repath_count[id] = 0
		recoveries[id] = 0
		# Stratified random intervals keep the initial pair visibly staggered.
		_timers[id] = _rng.randf_range(6.0, 9.5) if index % 2 == 0 else _rng.randf_range(10.5, 14.0)
		_set_state(id, State.IDLE)
		index += 1
	_enabled = true
	_application = camp.get_parent()
	while _application != null and not _application.has_method("show_today_action"):
		_application = _application.get_parent()
	if _application != null:
		var button := _application.find_child("TodayActionButton", true, false) as Button
		if button != null:
			button.pressed.connect(_pause_for_selection)
	if "--camp-ambient-debug" in OS.get_cmdline_user_args():
		var view := DebugView.new()
		camp.add_child(view)
		view.setup(self)

func disable() -> void:
	_stop(State.DISABLED)

func departure_override() -> void:
	_selection_paused = false
	_stop(State.DEPARTURE_OVERRIDE)

func _pause_for_selection() -> void:
	if is_instance_valid(_application) and _application.state == "today_action":
		_stop(State.DEPARTURE_OVERRIDE)
		_selection_paused = true

func _use_ambient_navigation(actor: Node3D) -> void:
	actor.agent.set_navigation_map(navigation.map)
	actor.agent.path_height_offset = 0.05
	actor.move_speed = 1.15
	actor.collision_mask = 3

func _stop(state: State) -> void:
	_enabled = false
	_cancelled = true
	for actor: Node3D in _actors:
		if not is_instance_valid(actor):
			continue
		var id: String = actor.member_id
		actor.cancel_navigation()
		_release(id)
		var original: Dictionary = _original[id]
		actor.agent.set_navigation_map(original.map)
		actor.agent.path_height_offset = original.height
		actor.move_speed = original.speed
		actor.collision_mask = original.mask
		_set_state(id, state)

func request_poi(actor: Node3D, poi_id: String) -> bool:
	var id: String = actor.member_id
	if not _enabled or not _states.has(id):
		return false
	var poi := _poi(poi_id)
	if poi.is_empty() or not poi.enabled or reservations.has(poi_id):
		return false
	for other: Node3D in _actors:
		if other != actor and other.global_position.distance_to(poi.position) < 0.85:
			return false
	var path: PackedVector3Array = navigation.valid_path(actor.global_position, poi.position)
	if path.is_empty():
		return false
	# Reserve only after validation, then release the previous standing place.
	_release(id)
	reservations[poi_id] = id
	_targets[id] = poi_id
	_progress[id] = actor.global_position
	_stuck[id] = 0.0
	_repathed[id] = false
	_travel[id] = 0.0
	actor.move_to(poi.projected)
	_set_state(id, State.MOVE_TO_POI)
	return true

func _advance(actor: Node3D, delta: float) -> void:
	var id: String = actor.member_id
	for key: String in _cooldowns[id].keys():
		_cooldowns[id][key] = maxf(0.0, float(_cooldowns[id][key]) - delta)
	_timers[id] = float(_timers.get(id, 0.0)) - delta
	var state: State = _states[id]
	match state:
		State.IDLE, State.RETURN_IDLE:
			if _timers[id] <= 0.0:
				_select(actor)
		State.MOVE_TO_POI:
			_move(actor, delta)
		State.ARRIVE:
			_face(actor, delta)
			if _timers[id] <= 0.0:
				var stay: Vector2 = _poi(poi_for(id)).stay
				_timers[id] = _rng.randf_range(stay.x, stay.y)
				_set_state(id, State.POI_IDLE)
		State.POI_IDLE:
			_face(actor, delta)
			if _timers[id] <= 0.0:
				# Keep the reservation while still physically standing here.
				_timers[id] = _rng.randf_range(8.0, 18.0)
				_set_state(id, State.RETURN_IDLE)

func _select(actor: Node3D) -> void:
	var id: String = actor.member_id
	_set_state(id, State.SELECT_POI)
	var choices: Array[Dictionary] = []
	for poi: Dictionary in pois:
		if poi.enabled and not reservations.has(poi.id) and float(_cooldowns[id].get(poi.id, 0)) <= 0:
			choices.append(poi)
	while not choices.is_empty():
		var index := _rng.randi_range(0, choices.size() - 1)
		var poi: Dictionary = choices.pop_at(index)
		if request_poi(actor, poi.id):
			return
	_timers[id] = _rng.randf_range(8.0, 18.0)
	_set_state(id, State.IDLE)

func _move(actor: Node3D, delta: float) -> void:
	var id: String = actor.member_id
	_travel[id] += delta
	if actor.arrived():
		actor.cancel_navigation()
		_stuck[id] = 0.0
		_timers[id] = 0.8
		_set_state(id, State.ARRIVE)
		return
	var offset: Vector3 = actor.global_position - Vector3(_progress[id])
	if Vector2(offset.x, offset.z).length() >= STUCK_DISTANCE:
		_progress[id] = actor.global_position
		_stuck[id] = 0.0
	else:
		_stuck[id] += delta
	if _travel[id] >= MAX_TRAVEL_SECONDS:
		_recover(actor)
	elif _stuck[id] >= (RETRY_SECONDS if _repathed[id] else STUCK_SECONDS):
		if _repathed[id]:
			_recover(actor)
			return
		_repathed[id] = true
		repath_count[id] += 1
		_stuck[id] = 0.0
		_progress[id] = actor.global_position
		var target: Vector3 = _poi(poi_for(id)).position
		if navigation.valid_path(actor.global_position, target).is_empty():
			_recover(actor)
		else:
			actor.cancel_navigation()
			actor.move_to(navigation.project(target))

func _recover(actor: Node3D) -> void:
	var id: String = actor.member_id
	actor.cancel_navigation()
	_release(id)
	recoveries[id] += 1
	_stuck[id] = 0.0
	_timers[id] = _rng.randf_range(3.0, 6.0)
	_set_state(id, State.IDLE)

func _release(id: String) -> void:
	var poi_id := poi_for(id)
	if not poi_id.is_empty():
		_cooldowns[id][poi_id] = _rng.randf_range(20.0, 40.0)
		reservations.erase(poi_id)
	_targets.erase(id)

func _face(actor: Node3D, delta: float) -> void:
	var poi := _poi(poi_for(actor.member_id))
	if not poi.is_empty():
		actor.face_smooth(poi.facing, delta)

func _poi(id: String) -> Dictionary:
	for poi: Dictionary in pois:
		if poi.id == id:
			return poi
	return {}

func _set_state(id: String, state: State) -> void:
	if _states.get(id, State.DISABLED) == state:
		return
	_states[id] = state
	state_changed.emit(id, State.keys()[state])

func state_for(id: String) -> String:
	return State.keys()[_states.get(id, State.DISABLED)]

func poi_for(id: String) -> String:
	return str(_targets.get(id, ""))

func stuck_for(id: String) -> float:
	return float(_stuck.get(id, 0.0))
