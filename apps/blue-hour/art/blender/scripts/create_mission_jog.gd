extends SceneTree
## Offline joint baking on the shared reference. No runtime foot solver or root motion.
const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const Joint = preload("res://survivors/humanoid_arm_constraint.gd")
const OUTPUT := "res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog.tres"
const DURATION: float = .78
const STANCE: float = .32
const REACH: float = .35
const FRAMES: int = 48

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var reference := Reference.instantiate()
	root.add_child(reference)
	var skeleton := reference.get_node("Skeleton3D") as Skeleton3D
	var clip := Animation.new()
	clip.length = DURATION
	clip.loop_mode = Animation.LOOP_LINEAR
	clip.set_meta("rig_spec", "BH_Humanoid_Rig_v1")
	clip.set_meta("in_place", true)
	clip.set_meta("nominal_speed", 2.0 * REACH / (DURATION * STANCE))
	clip.set_meta("stance_ratio", STANCE)
	for bone in skeleton.get_bone_count():
		var track := clip.add_track(Animation.TYPE_ROTATION_3D)
		clip.track_set_path(track, NodePath("Skeleton3D:" + skeleton.get_bone_name(bone)))
	var hips_track := clip.add_track(Animation.TYPE_POSITION_3D)
	clip.track_set_path(hips_track, ^"Skeleton3D:Hips")
	for frame in range(FRAMES + 1):
		var phase := float(frame % FRAMES) / FRAMES
		sample(skeleton, phase)
		var time := float(frame) / FRAMES * DURATION
		for bone in skeleton.get_bone_count():
			clip.rotation_track_insert_key(bone, time, skeleton.get_bone_pose_rotation(bone))
		clip.position_track_insert_key(hips_track, time, skeleton.get_bone_pose_position(skeleton.find_bone("Hips")))
	var library := AnimationLibrary.new()
	library.add_animation(&"mission_jog", clip)
	assert(ResourceSaver.save(library, OUTPUT) == OK)
	print("PUBLIC MISSION JOG: ", DURATION, "s, nominal ", clip.get_meta("nominal_speed"), "m/s; zero root travel")
	reference.free()
	quit()

func sample(skeleton: Skeleton3D, phase: float) -> void:
	skeleton.reset_bone_poses()
	var cycle := phase * TAU
	# Two short flight phases and a soft landing, with only 18mm of vertical travel.
	var hips := skeleton.find_bone("Hips")
	skeleton.set_bone_pose_position(hips, skeleton.get_bone_rest(hips).origin + Vector3(0, -.103 + .018 * pow(sin(cycle), 2), 0))
	rotate(skeleton, "Hips", Vector3.UP, .035 * sin(cycle))
	rotate(skeleton, "Spine", Vector3.RIGHT, .14)
	rotate(skeleton, "Chest", Vector3.UP, -.055 * sin(cycle))
	rotate(skeleton, "Neck", Vector3.RIGHT, -.08)
	rotate(skeleton, "Head", Vector3.RIGHT, -.06)
	for side: String in ["Left", "Right"]:
		var p := fposmod(phase + (0.0 if side == "Left" else .5), 1.0)
		var forward: float
		var lift: float
		var foot_pitch: float = 0.0
		if p < STANCE:
			forward = REACH * (1.0 - 2.0 * p / STANCE)
			lift = 0.0
		else:
			var u := (p - STANCE) / (1.0 - STANCE)
			forward = REACH * (2.0 * smoothstep(0.0, 1.0, u) - 1.0)
			lift = .175 * pow(sin(PI * u), 2)
			foot_pitch = -.20 * sin(PI * u)
		var foot := skeleton.find_bone(side + "Foot")
		var rest := skeleton.get_bone_global_rest(foot)
		var goal := Transform3D(Basis(Vector3.RIGHT, foot_pitch) * rest.basis, Vector3(rest.origin.x, .16 + lift, forward))
		Joint.solve(skeleton, skeleton.find_bone(side + "UpperLeg"), skeleton.find_bone(side + "LowerLeg"), foot, goal, Vector3(rest.origin.x, .7, 1))
		# Bent elbows and opposing shoulder swing distinguish jogging from a fast walk.
		var upper_arm := skeleton.find_bone(side + "UpperArm")
		var arm_rest := skeleton.get_bone_global_rest(upper_arm).basis.orthonormalized()
		var inward := .28 if side == "Right" else -.28
		var bend_in := Quaternion(arm_rest.inverse() * Vector3.BACK, inward)
		var swing := Quaternion(arm_rest.inverse() * Vector3.RIGHT, .52 * cos(TAU * p))
		skeleton.set_bone_pose_rotation(upper_arm, skeleton.get_bone_rest(upper_arm).basis.get_rotation_quaternion() * bend_in * swing)
		rotate(skeleton, side + "LowerArm", Vector3.RIGHT, -.95 - .10 * sin(TAU * p))

func rotate(skeleton: Skeleton3D, name: String, axis: Vector3, angle: float) -> void:
	var bone := skeleton.find_bone(name)
	var rest := skeleton.get_bone_global_rest(bone).basis.orthonormalized()
	var local_axis := rest.inverse() * axis
	skeleton.set_bone_pose_rotation(bone, skeleton.get_bone_rest(bone).basis.get_rotation_quaternion() * Quaternion(local_axis, angle))
