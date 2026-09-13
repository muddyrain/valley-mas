extends SkeletonModifier3D
## Reference-skeleton presentation before retargeting. No world transforms or live IK.
const TRANSITIONS = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_jog_transitions.tres")
const ARMS = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_unarmed_arms_v2.tres")
enum Stage { IDLE, START, JOG, STOP }
const STAGE_NAMES: Array[StringName] = [&"Idle", &"JogStart", &"Jog", &"JogStop"]
const START_DURATION: float = .24
const STOP_DURATION: float = .28
const START_EXIT_PHASE: float = .35

var state: StringName:
	get: return STAGE_NAMES[_stage]
var presenting: bool = false
var locomotion_phase: float = 0.0
var lean_degrees: float = 0.0
var start_count: int = 0
var stop_count: int = 0
var seek_phase: float = -1.0
var _stage: Stage = Stage.IDLE
var _elapsed: float = 0.0
var _previous_speed: float = 0.0
var _previous_yaw: float = 0.0
var _previous_direction := Vector3.ZERO
var _has_direction: bool = false
var _head_turn: float = 0.0
var _chest_turn: float = 0.0
var _hips_turn: float = 0.0
var _entry_rotations: Array[Quaternion] = []
var _last_rotations: Array[Quaternion] = []
var _entry_hips := Vector3.ZERO
var _last_hips := Vector3.ZERO
var _stop_clip: Animation
var _bones: Dictionary[StringName, int] = {}
var _rest_axes: Dictionary[int, Basis] = {}
var transitions: AnimationLibrary = TRANSITIONS
var combat_weight: float = 0.0
var _upper_body: PackedByteArray = PackedByteArray()
var arm_swing_v2_enabled: bool = false
var _arm_tracks: PackedInt32Array = PackedInt32Array()

func initialize() -> void:
	var skeleton := get_skeleton()
	_upper_body.resize(skeleton.get_bone_count())
	_arm_tracks.resize(skeleton.get_bone_count())
	_arm_tracks.fill(-1)
	var arms := ARMS.get_animation(&"unarmed_arms")
	for track in arms.get_track_count():
		_arm_tracks[skeleton.find_bone(String(arms.track_get_path(track).get_subname(0)))] = track
	var spine := skeleton.find_bone("Spine")
	for bone in skeleton.get_bone_count():
		var ancestor := bone
		while ancestor >= 0:
			if ancestor == spine:
				_upper_body[bone] = 1
				break
			ancestor = skeleton.get_bone_parent(ancestor)
		_bones[StringName(skeleton.get_bone_name(bone))] = bone
		_rest_axes[bone] = skeleton.get_bone_global_rest(bone).basis.orthonormalized().inverse()
		_last_rotations.append(skeleton.get_bone_pose_rotation(bone))
	_last_hips = skeleton.get_bone_pose_position(_bones[&"Hips"])

func advance(speed: float, velocity: Vector3, facing_yaw: float, stopping: bool, delta: float, use_layer: bool) -> void:
	seek_phase = -1.0
	presenting = use_layer
	if not presenting:
		_stage = Stage.IDLE
		_elapsed = 0
		lean_degrees = 0
		_head_turn = 0
		_chest_turn = 0
		_hips_turn = 0
		_has_direction = false
		_previous_speed = speed
		return
	_elapsed += delta
	var moving := speed > (.08 if _stage == Stage.IDLE else .035)
	var braking := stopping and speed < _previous_speed - .015
	match _stage:
		Stage.IDLE:
			if moving:
				enter(Stage.START)
		Stage.START:
			if not moving or braking:
				enter(Stage.STOP)
			elif _elapsed >= START_DURATION:
				enter(Stage.JOG)
				seek_phase = START_EXIT_PHASE
		Stage.JOG:
			if not moving or braking:
				enter(Stage.STOP)
		Stage.STOP:
			if moving and not stopping and speed > _previous_speed + .015:
				enter(Stage.JOG)
				seek_phase = locomotion_phase
			elif _elapsed >= STOP_DURATION and not moving:
				enter(Stage.IDLE)
	update_turn(speed, velocity, facing_yaw, delta)
	_previous_speed = speed

func enter(next: Stage) -> void:
	_stage = next
	_elapsed = 0
	_entry_rotations = _last_rotations.duplicate()
	_entry_hips = _last_hips
	if next == Stage.START:
		start_count += 1
	elif next == Stage.STOP:
		stop_count += 1
		# The last landing side follows the existing phase; stopping never runs a loop.
		var right := locomotion_phase >= .5
		_stop_clip = transitions.get_animation(&"jog_stop_right" if right else &"jog_stop_left")

func update_phase(time: float, duration: float) -> void:
	if presenting and _stage in [Stage.START, Stage.JOG]:
		locomotion_phase = fposmod(time / duration, 1.0)

func update_turn(speed: float, velocity: Vector3, yaw: float, delta: float) -> void:
	var direction := Vector3(velocity.x, 0, velocity.z).normalized()
	var turn := 0.0
	var desired_lean := 0.0
	if speed > .3 and not direction.is_zero_approx():
		var target_yaw := atan2(-direction.x, -direction.z)
		turn = angle_difference(yaw, target_yaw)
		var angular_velocity := angle_difference(_previous_yaw, yaw) / delta if _has_direction else 0.0
		var velocity_turn := _previous_direction.signed_angle_to(direction, Vector3.UP) if _has_direction else 0.0
		var angle := maxf(absf(turn), maxf(absf(velocity_turn), absf(angular_velocity) * .10))
		var degrees := rad_to_deg(angle)
		var side := signf(turn) if absf(turn) > .01 else signf(angular_velocity)
		if degrees > 20:
			var magnitude := lerpf(3.0, 5.0, clampf((degrees - 20.0) / 40.0, 0, 1))
			magnitude += 2.0 * smoothstep(60, 100, degrees)
			desired_lean = side * magnitude * smoothstep(.3, 2.0, speed)
		_previous_direction = direction
		_has_direction = true
	_previous_yaw = yaw
	if _stage == Stage.STOP:
		desired_lean = 0
		turn = 0
	lean_degrees = lerpf(lean_degrees, desired_lean, 1.0 - exp(-delta * 24.0))
	var yaw_target := clampf(rad_to_deg(turn), -6, 6)
	_head_turn = lerpf(_head_turn, yaw_target, 1.0 - exp(-delta * 45.0))
	_chest_turn = lerpf(_chest_turn, yaw_target * .66, 1.0 - exp(-delta * 30.0))
	_hips_turn = lerpf(_hips_turn, yaw_target * .25, 1.0 - exp(-delta * 22.0))

func _process_modification_with_delta(_delta: float) -> void:
	var skeleton := get_skeleton()
	if presenting and _stage in [Stage.START, Stage.STOP]:
		var clip := transitions.get_animation(&"jog_start") if _stage == Stage.START else _stop_clip
		var time := minf(_elapsed, clip.length)
		var entry_weight := smoothstep(0, .055, time)
		for track in clip.get_track_count():
			var bone: int = _bones[StringName(clip.track_get_path(track).get_subname(0))]
			if clip.track_get_type(track) == Animation.TYPE_ROTATION_3D:
				var pose := clip.rotation_track_interpolate(track, time)
				if _stage == Stage.START and arm_swing_v2_enabled and _arm_tracks[bone] >= 0:
					var arms := ARMS.get_animation(&"unarmed_arms")
					var arm_exit := arms.rotation_track_interpolate(_arm_tracks[bone], START_EXIT_PHASE * arms.length)
					pose = pose.slerp(arm_exit, smoothstep(.192, START_DURATION, time))
				var transition_pose := _entry_rotations[bone].slerp(pose, entry_weight)
				# Keep the combat pose through starts/stops; the ten lower bones use
				# exactly the original transition result, independent of equipment.
				if _upper_body[bone] == 1:
					transition_pose = transition_pose.slerp(skeleton.get_bone_pose_rotation(bone), smoothstep(0, 1, combat_weight))
				skeleton.set_bone_pose_rotation(bone, transition_pose)
			elif clip.track_get_type(track) == Animation.TYPE_POSITION_3D:
				var position := clip.position_track_interpolate(track, time)
				skeleton.set_bone_pose_position(bone, _entry_hips.lerp(position, entry_weight))
	# Transition snapshots exclude the additive turn. Otherwise braking mid-turn
	# would apply last frame's lean twice while the entry pose fades out.
	for bone in skeleton.get_bone_count():
		_last_rotations[bone] = skeleton.get_bone_pose_rotation(bone)
	_last_hips = skeleton.get_bone_pose_position(_bones[&"Hips"])
	if presenting:
		rotate_bone(&"Hips", _hips_turn, -lean_degrees * .45)
		rotate_bone(&"Spine", 0, -lean_degrees * .20)
		rotate_bone(&"Chest", _chest_turn - _hips_turn, -lean_degrees * .35)
		rotate_bone(&"Head", _head_turn - _chest_turn, lean_degrees * .25)

func rotate_bone(name: StringName, yaw: float, roll: float) -> void:
	var bone: int = _bones[name]
	var axes: Basis = _rest_axes[bone]
	var offset := Quaternion(axes * Vector3.UP, deg_to_rad(yaw)) * Quaternion(axes * Vector3.BACK, deg_to_rad(roll))
	var skeleton := get_skeleton()
	skeleton.set_bone_pose_rotation(bone, skeleton.get_bone_pose_rotation(bone) * offset)
