extends Node

signal state_changed(value: String)
signal member_boarded(id: String)
signal engine_start_requested(vehicle: Node3D)
signal completed
signal fallback_used(reason: String)

enum Stage { IDLE, ASSEMBLING, BOARDING, VEHICLE_STARTING, DEPARTING, TRANSITIONING }
const ASSEMBLY_TIMEOUT := 9.0
const BOARDING_TIMEOUT := 6.0
const START_SECONDS := 0.75
const DRIVE_SECONDS := 4.5
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

func begin(world: Node3D, party: Array[String]) -> void:
	if stage != Stage.IDLE:
		return
	camp = world
	vehicle = camp.get_node("NavigationSource/BlueHourBerth")
	entry = vehicle.get_node("VehicleEntryPoint")
	follower = camp.get_node("DeparturePath/PathFollow3D")
	for index: int in range(party.size()):
		var actor: Node3D = camp.members[party[index]]
		actors.append(actor)
		actor.move_to(camp.get_node("PartyAssembly/PartyPoint%02d" % (index + 1)).global_position)
	_set_stage(Stage.ASSEMBLING)

func _set_stage(value: Stage) -> void:
	stage = value
	elapsed = 0
	state_changed.emit(Stage.keys()[stage])

func _physics_process(delta: float) -> void:
	elapsed += delta
	match stage:
		Stage.ASSEMBLING: _assemble()
		Stage.BOARDING: _board_queue(delta)
		Stage.VEHICLE_STARTING:
			if elapsed >= START_SECONDS:
				vehicle.reparent(follower)
				vehicle.transform = Transform3D.IDENTITY
				_set_stage(Stage.DEPARTING)
		Stage.DEPARTING: _drive()

func _assemble() -> void:
	var ready := true
	for actor: Node3D in actors:
		if not actor.arrived():
			if elapsed < ASSEMBLY_TIMEOUT:
				ready = false
			else:
				_correct(actor, actor.destination, "assembly")
	if ready:
		_set_stage(Stage.BOARDING)
		_next_boarder()

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
	actors[queue_index].move_to(entry.global_position)

func _board_queue(delta: float) -> void:
	var actor: Node3D = actors[queue_index]
	if actor.boarded:
		if door_pause >= 0.3:
			queue_index += 1
			_next_boarder()
		else:
			door_pause += delta
		return
	if not actor.arrived() and elapsed >= BOARDING_TIMEOUT:
		_correct(actor, entry.global_position, "boarding")
	if actor.arrived() or elapsed >= BOARDING_TIMEOUT:
		actor.moving = false
		actor.face(vehicle.get_node("DoorMotion").global_position)
		door_pause = maxf(0, door_pause) + delta
		if door_pause >= 0.22:
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
