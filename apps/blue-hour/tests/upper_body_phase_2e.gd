extends SceneTree
## Asset boundary first; runtime grip, motion and gameplay are checked in the Mission review.
const ARMS_PATH := "res://assets/animations/humanoid/locomotion/bh_humanoid_unarmed_arms_v2.tres"
const JOG_PATH := "res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2_2.tres"
const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const ARMS: Array[String] = ["LeftUpperArm", "LeftLowerArm", "LeftHand", "RightUpperArm", "RightLowerArm", "RightHand"]
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	check(FileAccess.get_sha256(JOG_PATH).to_upper() == "8EF7161436ABB27CE0BE6C59A039614C04EA59E1F9BB846D5D1A6ED94A865B5A", "V2.2 complete resource remains byte locked")
	check(FileAccess.get_sha256("res://assets/animations/humanoid/locomotion/bh_humanoid_jog_transitions_v2_2.tres").to_upper() == "DD0E10C2D73656571D27BCB6B0C5A997E4594C04A28D6D719596CE272192C13A", "Start/Stop resource remains byte locked")
	check(ResourceLoader.exists(ARMS_PATH), "Shared Unarmed Arm Swing V2 exists")
	if not failures.is_empty():
		quit(1)
		return
	var clip: Animation = (load(ARMS_PATH) as AnimationLibrary).get_animation(&"unarmed_arms")
	var jog: Animation = (load(JOG_PATH) as AnimationLibrary).get_animation(&"mission_jog")
	check(clip.length == jog.length and clip.loop_mode == jog.loop_mode, "Arms use the existing Jog clock")
	check(clip.get_track_count() == ARMS.size(), "Only six arm rotations are authored")
	for track in clip.get_track_count():
		check(clip.track_get_type(track) == Animation.TYPE_ROTATION_3D, "No position, scale, method or gameplay track")
		check(String(clip.track_get_path(track).get_subname(0)) in ARMS, "No torso, hips or lower-body changes")
		var start: Quaternion = clip.track_get_key_value(track, 0)
		var end: Quaternion = clip.track_get_key_value(track, clip.track_get_key_count(track) - 1)
		check(start.is_equal_approx(end), "Seamless arm loop")
		var baseline_track := jog.find_track(clip.track_get_path(track), Animation.TYPE_ROTATION_3D)
		var old_range := 0.0
		var new_range := 0.0
		for a in 40:
			for b in 40:
				old_range = maxf(old_range, jog.rotation_track_interpolate(baseline_track, a * .7 / 40).angle_to(jog.rotation_track_interpolate(baseline_track, b * .7 / 40)))
				new_range = maxf(new_range, clip.rotation_track_interpolate(track, a * .7 / 40).angle_to(clip.rotation_track_interpolate(track, b * .7 / 40)))
		if "UpperArm" in String(clip.track_get_path(track)):
			check(new_range < old_range * .8 and new_range > old_range * .6, "Compact upper-arm arc without freezing")
		if "Hand" in String(clip.track_get_path(track)):
			check(new_range > deg_to_rad(1) and new_range < deg_to_rad(5), "Restrained wrist follow-through")
	var reference := Reference.instantiate()
	root.add_child(reference)
	var skeleton := reference.get_node("Skeleton3D") as Skeleton3D
	var minimum_elbow := 180.0
	var maximum_elbow := 0.0
	for frame in 120:
		var time := frame * clip.length / 120.0
		for track in clip.get_track_count():
			var bone := skeleton.find_bone(String(clip.track_get_path(track).get_subname(0)))
			skeleton.set_bone_pose_rotation(bone, clip.rotation_track_interpolate(track, time))
		for side: String in ["Left", "Right"]:
			var shoulder := skeleton.get_bone_global_pose(skeleton.find_bone(side + "UpperArm")).origin
			var elbow := skeleton.get_bone_global_pose(skeleton.find_bone(side + "LowerArm")).origin
			var wrist := skeleton.get_bone_global_pose(skeleton.find_bone(side + "Hand")).origin
			var bend := 180.0 - rad_to_deg((shoulder - elbow).angle_to(wrist - elbow))
			minimum_elbow = minf(minimum_elbow, bend)
			maximum_elbow = maxf(maximum_elbow, bend)
			check(bend > 75 and bend < 105, "Geometric elbow bend includes the rest rig, not only the authored channel")
	reference.free()
	print("PHASE 2E ASSETS: ", checks, " checks; failures=", failures, "; elbow=", minimum_elbow, "..", maximum_elbow)
	quit(0 if failures.is_empty() else 1)

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)
