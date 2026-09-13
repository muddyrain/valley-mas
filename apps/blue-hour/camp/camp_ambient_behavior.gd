extends Node
class_name CampAmbientBehavior
## POI-driven ambient director. It owns intent and timing; CampActor owns movement presentation.
signal state_changed(member_id: String, state: String)

enum State { DISABLED, IDLE, SELECT_POI, MOVE_TO_POI, ARRIVE, POI_IDLE, RETURN_IDLE, DEPARTURE_OVERRIDE }

const MIN_IDLE_SECONDS := 4.0
const MAX_IDLE_SECONDS := 8.0
const MIN_POI_SECONDS := 3.0
const MAX_POI_SECONDS := 7.0
const ARRIVAL_EPSILON := 0.24
const POIS: Array[Dictionary] = [
	{"id": "workshop", "offset": Vector3(0.85, 0, 0.95)},
	{"id": "main_entry", "offset": Vector3(-1.45, 0, 0.95)},
	{"id": "living", "offset": Vector3(-1.55, 0, 0.35)},
	{"id": "greenhouse", "offset": Vector3(-2.35, 0, 1.35)},
]

var camp: Node3D
var _actors: Array[Node3D] = []
var _states: Dictionary = {}
var _targets: Dictionary = {}
var _timers: Dictionary = {}
var _last_poi: Dictionary = {}
var _rng := RandomNumberGenerator.new()
var _enabled := false

func setup(world: Node3D, seed: int = 0) -> void:
	camp = world
	_rng.seed = seed if seed != 0 else 1337
	_enabled = true
	for id: String in world.members:
		var actor := world.members[id] as Node3D
		_actors.append(actor)
		_states[id] = State.IDLE
		_timers[id] = 1.5 + _actors.size() * 1.2
		_last_poi[id] = ""
		state_changed.emit(id, _state_name(State.IDLE))

func disable() -> void:
	_enabled = false
	for actor: Node3D in _actors:
		if is_instance_valid(actor) and not actor.boarded:
			actor.moving = false
		_set_state(actor.member_id, State.DISABLED)

func _process(delta: float) -> void:
	if not _enabled or camp == null:
		return
	if _departure_active():
		_enter_departure_override()
		return
	for actor: Node3D in _actors:
		if not is_instance_valid(actor) or actor.boarded:
			continue
		_advance_actor(actor, delta)

func _advance_actor(actor: Node3D, delta: float) -> void:
	var id: String = actor.member_id
	var state: State = _states.get(id, State.DISABLED)
	if state == State.DEPARTURE_OVERRIDE or state == State.DISABLED:
		return
	var remaining: float = float(_timers.get(id, 0.0)) - delta
	_timers[id] = remaining
	match state:
		State.IDLE, State.RETURN_IDLE:
			if remaining <= 0.0:
				_set_state(id, State.SELECT_POI)
				_select_poi(actor)
		State.MOVE_TO_POI:
			if actor.arrived():
				_set_state(id, State.ARRIVE)
				_timers[id] = 0.45
			else:
				actor.moving = true
		State.ARRIVE:
			if remaining <= 0.0:
				_set_state(id, State.POI_IDLE)
				_timers[id] = _rng.randf_range(MIN_POI_SECONDS, MAX_POI_SECONDS)
		State.POI_IDLE:
			if remaining <= 0.0:
				_set_state(id, State.RETURN_IDLE)
				_timers[id] = _rng.randf_range(MIN_IDLE_SECONDS, MAX_IDLE_SECONDS)
				_targets.erase(id)
		State.SELECT_POI:
			_select_poi(actor)

func _select_poi(actor: Node3D) -> void:
	var id: String = actor.member_id
	var choices: Array[Dictionary] = []
	for poi: Dictionary in POIS:
		if poi.id != _last_poi.get(id, ""):
			choices.append(poi)
	if choices.is_empty():
		choices = POIS.duplicate()
	var poi: Dictionary = choices[_rng.randi_range(0, choices.size() - 1)]
	var target := _poi_position(poi)
	_last_poi[id] = poi.id
	_targets[id] = poi.id
	actor.move_to(target)
	_set_state(id, State.MOVE_TO_POI)

func _poi_position(poi: Dictionary) -> Vector3:
	var anchor: Node3D
	match String(poi.id):
		"workshop": anchor = camp.get_node("NavigationSource/Workshop")
		"main_entry": anchor = camp.get_node("NavigationSource/MainBuilding/EntrancePoint")
		"living": anchor = camp.get_node("NavigationSource/CentralLivingArea")
		"greenhouse": anchor = camp.get_node("NavigationSource/Greenhouse")
		_: anchor = camp.get_node("NavigationSource/CentralLivingArea")
	return anchor.global_position + poi.offset

func _departure_active() -> bool:
	var departure := camp.get_node_or_null("CampDepartureController")
	return departure != null and int(departure.stage) != 0

func _enter_departure_override() -> void:
	for actor: Node3D in _actors:
		if is_instance_valid(actor) and not actor.boarded:
			_set_state(actor.member_id, State.DEPARTURE_OVERRIDE)

func _set_state(id: String, value: State) -> void:
	if _states.get(id, State.DISABLED) == value:
		return
	_states[id] = value
	state_changed.emit(id, _state_name(value))

func _state_name(value: State) -> String:
	return State.keys()[value]

func state_for(id: String) -> String:
	return _state_name(_states.get(id, State.DISABLED))

func poi_for(id: String) -> String:
	return str(_targets.get(id, ""))
