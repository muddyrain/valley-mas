extends Node

signal state_changed(value: String)
signal member_boarded(id: String)
signal engine_start_requested(vehicle: Node3D)
signal completed
signal fallback_used(reason: String)

enum Stage { IDLE, ASSEMBLING, BOARDING, VEHICLE_STARTING, DEPARTING, TRANSITIONING }
const ASSEMBLY_TIMEOUT := 9.0
const BOARDING_TIMEOUT := 6.0
const START_SECONDS := 0.35
const DRIVE_SECONDS := 2.8
const DEPARTURE_SPEED_MULTIPLIER := 1.7
const DOOR_SECONDS := 0.12
const BOARDING_GAP := 0.12
var stage := Stage.IDLE
var elapsed := 0.0
var actors: Array[Node3D] = []
var camp: Node3D
var vehicle: Node3D
var entry: Marker3D
var follower: PathFollow3D
var queue_index := 0
var door_pause := -1.0
var warnings: Array[String] = []
var vehicle_outside_camera := false
var approached: Array[bool] = []
var queue_direction := Vector3.ZERO

func begin(world: Node3D, party: Array[String]) -> void:
	if stage != Stage.IDLE:
		return
	camp = world
	vehicle = camp.get_node("NavigationSource/BlueHourBerth")
	entry = vehicle.get_node("VehicleEntryPoint")
	follower = camp.get_node("DeparturePath/PathFollow3D")
	queue_direction = (camp.get_node("PartyAssembly/PartyPoint01").global_position - entry.global_position).normalized()
	queue_direction.y = 0
	for index: int in range(party.size()):
		var actor: Node3D = camp.members[party[index]]
		actors.append(actor)
		approached.append(false)
		actor.move_speed *= DEPARTURE_SPEED_MULTIPLIER
		var assembly_index := index - 1 if index > 0 and approached[0] else index
		actor.move_to(camp.get_node("PartyAssembly/PartyPoint%02d" % (assembly_index + 1)).global_position)
		# The first member already beside the berth can approach the existing door
		# directly; making them walk past it to an assembly slot adds a U-turn.
		if index == 0 and actor.global_position.distance_to(entry.global_position) < 3.0:
			approached[index] = true
			actor.move_to(entry.global_position)
	_set_stage(Stage.ASSEMBLING)

func _set_stage(value: Stage) -> void:
	stage = value
	elapsed = 0
	state_changed.emit(Stage.keys()[stage])

func _physics_process(delta: float) -> void:
	elapsed += delta
	match stage:
		Stage.ASSEMBLING:
			_advance_approach()
			if approached[0]:
				_set_stage(Stage.BOARDING)
		Stage.BOARDING:
			_advance_approach()
			_board_queue(delta)
		Stage.VEHICLE_STARTING:
			if elapsed >= START_SECONDS:
				vehicle.reparent(follower)
				vehicle.transform = Transform3D.IDENTITY
				_set_stage(Stage.DEPARTING)
		Stage.DEPARTING: _drive()

func _advance_approach() -> void:
	# Each member passes their existing PartyPoint independently. The door queue
	# advances while later members are still navigating across the camp.
	for index: int in range(queue_index, actors.size()):
		var actor: Node3D = actors[index]
		if actor.boarded:
			continue
		if not approached[index]:
			if not actor.arrived() and elapsed >= ASSEMBLY_TIMEOUT:
				_correct(actor, actor.destination, "assembly")
			if actor.arrived():
				approached[index] = true
		if approached[index]:
			var target := entry.global_position + queue_direction * 0.8 * (index - queue_index)
			if not actor.destination.is_equal_approx(target):
				actor.move_to(target)

func _next_boarder() -> void:
	elapsed = 0
	door_pause = -1
	if queue_index == actors.size():
		engine_start_requested.emit(vehicle)
		var engine := vehicle.get_node_or_null("Audio/EngineStart") as AudioStreamPlayer3D
		if engine != null and engine.stream != null:
			engine.play()
		_set_stage(Stage.VEHICLE_STARTING)
		return
	_advance_approach()

func _board_queue(delta: float) -> void:
	var actor: Node3D = actors[queue_index]
	if actor.boarded:
		if door_pause >= BOARDING_GAP:
			queue_index += 1
			_next_boarder()
		else:
			door_pause += delta
		return
	if not actor.arrived() and elapsed >= BOARDING_TIMEOUT:
		_correct(actor, entry.global_position, "boarding")
	if (approached[queue_index] and actor.arrived()) or elapsed >= BOARDING_TIMEOUT:
		actor.moving = false
		actor.face(vehicle.get_node("DoorMotion").global_position)
		door_pause = maxf(0, door_pause) + delta
		if door_pause >= DOOR_SECONDS:
			actor.board()
			member_boarded.emit(actor.member_id)
			door_pause = 0

func _correct(actor: Node3D, point: Vector3, phase: String) -> void:
	var corrected: bool = actor.correct_to_safe_position(point)
	var reason := "%s: %s navigation timeout; %s" % [phase, actor.member_id, "safe position corrected" if corrected else "no safe correction; continuing from current clear position"]
	warnings.append(reason)
	push_warning(reason)
	fallback_used.emit(reason)

func _drive() -> void:
	var length := (follower.get_parent() as Path3D).curve.get_baked_length()
	# Accelerate during the first second, then keep a constant road speed.
	var speed := length / (DRIVE_SECONDS - 0.5)
	var distance := speed * (0.5 * elapsed * elapsed if elapsed < 1.0 else elapsed - 0.5)
	follower.progress = minf(distance, length)
	if elapsed >= DRIVE_SECONDS:
		vehicle_outside_camera = _outside_camera()
		if vehicle_outside_camera:
			_set_stage(Stage.TRANSITIONING)
			completed.emit()
		elif elapsed >= DRIVE_SECONDS + 2.0:
			# A changed camera/path must never strand a persisted departure.
			var reason := "Departure camera/path mismatch; transition timeout"
			warnings.append(reason)
			push_warning(reason)
			fallback_used.emit(reason)
			_set_stage(Stage.TRANSITIONING)
			completed.emit()

func _outside_camera() -> bool:
	var camera := camp.get_node("CameraRig/PitchPivot/Camera3D") as Camera3D
	var bounds := Rect2()
	var first := true
	for mesh: MeshInstance3D in vehicle.find_children("*", "MeshInstance3D", true, false):
		for corner: int in range(8):
			var point := camera.unproject_position(mesh.global_transform * mesh.get_aabb().get_endpoint(corner))
			if first:
				bounds = Rect2(point, Vector2.ZERO)
				first = false
			else:
				bounds = bounds.expand(point)
	return not Rect2(Vector2.ZERO, camera.get_viewport().get_visible_rect().size).intersects(bounds)
