extends SceneTree
## Author a shared running cycle offline. The saved clip has no root motion or live IK.
const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const Joint = preload("res://survivors/humanoid_arm_constraint.gd")
const OUTPUT := "res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2_0.tres"
const DURATION: float = .70
const STANCE: float = .38
const CONTACT_Z: float = .27
const PUSH_Z: float = -.44
const FOOT_LIFT: float = .27
const FRAMES: int = 80

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
	clip.set_meta("version", 2)
	clip.set_meta("nominal_speed", (CONTACT_Z - PUSH_Z) / (DURATION * STANCE))
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
	print("MISSION JOG V2: ", DURATION, "s; nominal=", clip.get_meta("nominal_speed"), "; no root travel")
	reference.free()
	quit()

func sample(skeleton: Skeleton3D, phase: float) -> void:
	skeleton.reset_bone_poses()
	var cycle := phase * TAU
	var step := fposmod(phase, .5)
	# Load the supporting knee, extend out of compression, then crest in flight.
	var height: float
	if step < .10:
		height = lerpf(-.062, -.100, smoothstep(0, .10, step))
	elif step < .43:
		height = lerpf(-.100, -.045, smoothstep(.10, .43, step))
	else:
		height = lerpf(-.045, -.062, smoothstep(.43, .5, step))
	var hips := skeleton.find_bone("Hips")
	skeleton.set_bone_pose_position(hips, skeleton.get_bone_rest(hips).origin + Vector3(0, height, 0))
	var exchange := cos(cycle - .28)
	pose(skeleton, "Hips", Vector3(deg_to_rad(3), deg_to_rad(-6) * exchange, deg_to_rad(1.2) * sin(cycle)))
	pose(skeleton, "Spine", Vector3(deg_to_rad(5), deg_to_rad(5) * exchange, 0))
	pose(skeleton, "Chest", Vector3(deg_to_rad(3) + deg_to_rad(.8) * sin(2 * cycle - .35), deg_to_rad(8) * exchange, 0))
	# The large head absorbs the body's pitch with a small delayed landing response.
	pose(skeleton, "Neck", Vector3(deg_to_rad(-7) + deg_to_rad(1.2) * sin(2 * cycle - .65), deg_to_rad(-3) * exchange, 0))
	pose(skeleton, "Head", Vector3(deg_to_rad(-3) + deg_to_rad(.7) * sin(2 * cycle - .95), deg_to_rad(-2) * exchange, 0))
	for side: String in ["Left", "Right"]:
		var p := fposmod(phase + (0.0 if side == "Left" else .5), 1.0)
		var forward: float
		var lift: float
		var foot_pitch: float
		if p < STANCE:
			forward = lerpf(CONTACT_Z, PUSH_Z, p / STANCE)
			var push := smoothstep(.22, STANCE, p)
			lift = .065 * push
			foot_pitch = deg_to_rad(24) * push
		else:
			var u := (p - STANCE) / (1.0 - STANCE)
			# Recover the heel early, drive the knee forward, then lower into contact.
			forward = lerpf(PUSH_Z, CONTACT_Z, smoothstep(0, .86, u))
			if u < .42:
				lift = lerpf(.065, FOOT_LIFT, smoothstep(0, .42, u))
			else:
				lift = lerpf(FOOT_LIFT, 0, smoothstep(.42, 1, u))
			foot_pitch = lerpf(deg_to_rad(24), deg_to_rad(-12), smoothstep(0, .55, u))
			foot_pitch = lerpf(foot_pitch, 0, smoothstep(.72, 1, u))
		var foot := skeleton.find_bone(side + "Foot")
		var rest := skeleton.get_bone_global_rest(foot)
		var goal := Transform3D(Basis(Vector3.RIGHT, foot_pitch) * rest.basis, Vector3(rest.origin.x, .16 + lift, forward))
		Joint.solve(skeleton, skeleton.find_bone(side + "UpperLeg"), skeleton.find_bone(side + "LowerLeg"), foot, goal, Vector3(rest.origin.x, .7, 1))
		var arm_swing := deg_to_rad(34) * cos(TAU * p - .20)
		var inward := deg_to_rad(17) if side == "Right" else deg_to_rad(-17)
		pose(skeleton, side + "UpperArm", Vector3(arm_swing, 0, inward))
		pose(skeleton, side + "LowerArm", Vector3(deg_to_rad(-85) + deg_to_rad(10) * sin(TAU * p - .35), 0, 0))

func pose(skeleton: Skeleton3D, name: String, angles: Vector3) -> void:
	var bone := skeleton.find_bone(name)
	var rest := skeleton.get_bone_global_rest(bone).basis.orthonormalized()
	var rotation := Quaternion(rest.inverse() * Vector3.UP, angles.y) * Quaternion(rest.inverse() * Vector3.RIGHT, angles.x) * Quaternion(rest.inverse() * Vector3.BACK, angles.z)
	skeleton.set_bone_pose_rotation(bone, skeleton.get_bone_rest(bone).basis.get_rotation_quaternion() * rotation)
