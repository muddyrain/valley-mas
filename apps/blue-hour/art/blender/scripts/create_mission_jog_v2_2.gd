extends SceneTree
## Read V2.1; replace only airborne leg keys. Never regenerate its approved body.
const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const Joint = preload("res://survivors/humanoid_arm_constraint.gd")
const V21 = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2.tres")
const TRANSITIONS = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_jog_transitions.tres")
const OUTPUT := "res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2_2.tres"
const START_OUTPUT := "res://assets/animations/humanoid/locomotion/bh_humanoid_jog_transitions_v2_2.tres"
const STANCE: float = .38
const FOOT_LIFT: float = .22
const SWING_TIMES: Array[float] = [0.0, .20, .48, .72, 1.0]
const FORWARD: Array[float] = [-.44, -.32, -.02, .225, .27]
const FORWARD_TANGENTS: Array[float] = [0.0, 1.02, 1.10, .30, 0.0]

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var reference := Reference.instantiate()
	root.add_child(reference)
	var skeleton := reference.get_node("Skeleton3D") as Skeleton3D
	var before := V21.get_animation(&"mission_jog")
	var clip := before.duplicate(true) as Animation
	clip.set_meta("version", 2.2)
	clip.set_meta("rear_foot_lift", FOOT_LIFT)
	clip.set_meta("cadence_c_seconds", .51)
	for side: String in ["Left", "Right"]:
		var offset := .5 if side == "Right" else 0.0
		# Insert the old interpolated toe-off pose so neighboring swing keys cannot
		# alter the approved support interval, including the last partial sample.
		var boundary := fposmod(STANCE - offset, 1.0) * clip.length
		for part: String in ["UpperLeg", "LowerLeg", "Foot"]:
			var track := clip.find_track(NodePath("Skeleton3D:" + side + part), Animation.TYPE_ROTATION_3D)
			clip.rotation_track_insert_key(track, boundary, before.rotation_track_interpolate(track, boundary))
		for frame in 81:
			var phase := float(frame % 80) / 80.0
			var leg_phase := fposmod(phase + offset, 1.0)
			if leg_phase <= STANCE:
				continue
			apply_clip(skeleton, before, phase * clip.length)
			var foot := skeleton.find_bone(side + "Foot")
			var rest := skeleton.get_bone_global_rest(foot)
			var toes := skeleton.get_bone_global_rest(skeleton.find_bone(side + "Toes")).origin - rest.origin
			var heel_rise := toes.y - (Basis(Vector3.RIGHT, deg_to_rad(36)) * toes).y
			var u := (leg_phase - STANCE) / (1.0 - STANCE)
			var heights: Array[float] = [heel_rise + .048, FOOT_LIFT, .16, .06, 0.0]
			var height_tangents: Array[float] = [0.0, 0.0, -.45, -.33, 0.0]
			var forward := swing_curve(u, FORWARD, FORWARD_TANGENTS)
			var lift := swing_curve(u, heights, height_tangents)
			# Keep V2.1 ankle orientation; only its flight position changes.
			var goal := skeleton.get_bone_global_pose(foot)
			goal.origin = Vector3(rest.origin.x, .16 + lift, forward)
			Joint.solve(skeleton, skeleton.find_bone(side + "UpperLeg"), skeleton.find_bone(side + "LowerLeg"), foot, goal, Vector3(rest.origin.x, .7, 1))
			for part: String in ["UpperLeg", "LowerLeg", "Foot"]:
				var track := clip.find_track(NodePath("Skeleton3D:" + side + part), Animation.TYPE_ROTATION_3D)
				clip.rotation_track_insert_key(track, float(frame) / 80.0 * clip.length, skeleton.get_bone_pose_rotation(skeleton.find_bone(side + part)))
	var library := AnimationLibrary.new()
	library.add_animation(&"mission_jog", clip)
	assert(ResourceSaver.save(library, OUTPUT) == OK)
	align_start(before, clip)
	print("MISSION JOG V2.2: rear heel=.22m; low forward swing; body/support copied from V2.1; C=.51s")
	reference.free()
	quit()

func swing_curve(u: float, values: Array[float], tangents: Array[float]) -> float:
	for index in SWING_TIMES.size() - 1:
		if u <= SWING_TIMES[index + 1]:
			var span := SWING_TIMES[index + 1] - SWING_TIMES[index]
			var t := (u - SWING_TIMES[index]) / span
			var t2 := t * t
			var t3 := t2 * t
			return (2 * t3 - 3 * t2 + 1) * values[index] + (t3 - 2 * t2 + t) * span * tangents[index] + (-2 * t3 + 3 * t2) * values[index + 1] + (t3 - t2) * span * tangents[index + 1]
	return values[-1]

func apply_clip(skeleton: Skeleton3D, clip: Animation, time: float) -> void:
	for track in clip.get_track_count():
		var bone := skeleton.find_bone(String(clip.track_get_path(track).get_subname(0)))
		if clip.track_get_type(track) == Animation.TYPE_ROTATION_3D:
			skeleton.set_bone_pose_rotation(bone, clip.rotation_track_interpolate(track, time))
		else:
			skeleton.set_bone_pose_position(bone, clip.position_track_interpolate(track, time))

func align_start(before: Animation, after: Animation) -> void:
	var library := TRANSITIONS.duplicate(true) as AnimationLibrary
	var start := library.get_animation(&"jog_start")
	for track in start.get_track_count():
		var bone := String(start.track_get_path(track).get_subname(0))
		if not (bone.ends_with("UpperLeg") or bone.ends_with("LowerLeg") or bone.ends_with("Foot")):
			continue
		var old_end := before.rotation_track_interpolate(track, .35 * before.length)
		var new_end := after.rotation_track_interpolate(track, .35 * after.length)
		var correction := old_end.inverse() * new_end
		for key in start.track_get_key_count(track):
			var time := start.track_get_key_time(track, key)
			if time <= .192:
				continue
			var original: Quaternion = start.track_get_key_value(track, key)
			start.track_set_key_value(track, key, original * Quaternion.IDENTITY.slerp(correction, smoothstep(.192, .24, time)))
	assert(ResourceSaver.save(library, START_OUTPUT) == OK)
