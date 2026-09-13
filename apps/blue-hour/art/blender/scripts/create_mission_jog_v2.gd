extends SceneTree
## Author a shared running cycle offline. The saved clip has no root motion or live IK.
const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const Joint = preload("res://survivors/humanoid_arm_constraint.gd")
const OUTPUT := "res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2.tres"
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
	clip.set_meta("version", 2.1)
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
	print("MISSION JOG V2.1: ", DURATION, "s; nominal=", clip.get_meta("nominal_speed"), "; no root travel")
	reference.free()
	quit()

func sample(skeleton: Skeleton3D, phase: float) -> void:
	skeleton.reset_bone_poses()
	var cycle := phase * TAU
	var step := fposmod(phase, .5)
	# A quick load and brief low hold precede the rebound. Keep the old flight ceiling
	# so added weight comes from compression rather than a higher airborne bounce.
	var height: float
	if step < .08:
		height = lerpf(-.067, -.116, smoothstep(0, .08, step))
	elif step < .11:
		height = -.116
	elif step < .32:
		height = lerpf(-.116, -.052, smoothstep(.11, .32, step))
	elif step < .43:
		height = lerpf(-.052, -.045, smoothstep(.32, .43, step))
	else:
		height = lerpf(-.045, -.067, smoothstep(.43, .5, step))
	var hips := skeleton.find_bone("Hips")
	skeleton.set_bone_pose_position(hips, skeleton.get_bone_rest(hips).origin + Vector3(0, height, 0))
	var exchange := cos(cycle - .24)
	var shoulder_exchange := cos(cycle - .60)
	pose(skeleton, "Hips", Vector3(deg_to_rad(3.75), deg_to_rad(-7.2) * exchange, deg_to_rad(1.2) * sin(cycle)))
	pose(skeleton, "Spine", Vector3(deg_to_rad(6.25), deg_to_rad(6) * exchange, 0))
	pose(skeleton, "Chest", Vector3(deg_to_rad(3.75) + deg_to_rad(1) * sin(2 * cycle - .55), deg_to_rad(9.5) * shoulder_exchange, 0))
	# The large head absorbs the body's pitch with a small delayed landing response.
	pose(skeleton, "Neck", Vector3(deg_to_rad(-8.75) + deg_to_rad(1.0) * sin(2 * cycle - .90), deg_to_rad(-3.4) * cos(cycle - .72), 0))
	pose(skeleton, "Head", Vector3(deg_to_rad(-3.75) + deg_to_rad(.65) * sin(2 * cycle - 1.22), deg_to_rad(-2.8) * cos(cycle - .88), 0))
	for side: String in ["Left", "Right"]:
		var p := fposmod(phase + (0.0 if side == "Left" else .5), 1.0)
		var foot := skeleton.find_bone(side + "Foot")
		var rest := skeleton.get_bone_global_rest(foot)
		var toe_offset := skeleton.get_bone_global_rest(skeleton.find_bone(side + "Toes")).origin - rest.origin
		var heel_rise := toe_offset.y - (Basis(Vector3.RIGHT, deg_to_rad(36)) * toe_offset).y
		var forward: float
		var lift: float
		var foot_pitch: float
		var toe_flex: float = 0.0
		if p < STANCE:
			forward = lerpf(CONTACT_Z, PUSH_Z, p / STANCE)
			# The hip rebound starts extending the knee before the heel rolls up.
			# Toe clearance only follows the roll, rather than lifting the whole foot.
			foot_pitch = deg_to_rad(36) * smoothstep(.21, .33, p)
			var roll_height := toe_offset.y - (Basis(Vector3.RIGHT, foot_pitch) * toe_offset).y
			var release := smoothstep(.325, STANCE, p)
			lift = roll_height + .048 * release
			toe_flex = -foot_pitch * (1.0 - release)
		else:
			var u := (p - STANCE) / (1.0 - STANCE)
			# Tuck the recovering heel first; carry the knee forward while the ankle
			# remains high, then unfold into the unchanged contact reach.
			if u < .20:
				forward = lerpf(PUSH_Z, -.32, smoothstep(0, .20, u))
				lift = lerpf(heel_rise + .048, FOOT_LIFT, smoothstep(0, .20, u))
			elif u < .58:
				forward = lerpf(-.32, .25, smoothstep(.20, .58, u))
				lift = lerpf(FOOT_LIFT, .255, smoothstep(.42, .58, u))
			else:
				forward = lerpf(.25, CONTACT_Z, smoothstep(.58, 1, u))
				lift = lerpf(.255, 0, smoothstep(.58, 1, u))
			foot_pitch = lerpf(deg_to_rad(36), deg_to_rad(-12), smoothstep(0, .52, u))
			foot_pitch = lerpf(foot_pitch, 0, smoothstep(.72, 1, u))
		var goal := Transform3D(Basis(Vector3.RIGHT, foot_pitch) * rest.basis, Vector3(rest.origin.x, .16 + lift, forward))
		Joint.solve(skeleton, skeleton.find_bone(side + "UpperLeg"), skeleton.find_bone(side + "LowerLeg"), foot, goal, Vector3(rest.origin.x, .7, 1))
		pose(skeleton, side + "Toes", Vector3(toe_flex, 0, 0))
		var arm_swing := deg_to_rad(34) * cos(TAU * p - .30)
		var inward := deg_to_rad(17) if side == "Right" else deg_to_rad(-17)
		pose(skeleton, side + "UpperArm", Vector3(arm_swing, 0, inward))
		pose(skeleton, side + "LowerArm", Vector3(deg_to_rad(-85) + deg_to_rad(10) * sin(TAU * p - .35), 0, 0))

func pose(skeleton: Skeleton3D, name: String, angles: Vector3) -> void:
	var bone := skeleton.find_bone(name)
	var rest := skeleton.get_bone_global_rest(bone).basis.orthonormalized()
	var rotation := Quaternion(rest.inverse() * Vector3.UP, angles.y) * Quaternion(rest.inverse() * Vector3.RIGHT, angles.x) * Quaternion(rest.inverse() * Vector3.BACK, angles.z)
	skeleton.set_bone_pose_rotation(bone, skeleton.get_bone_rest(bone).basis.get_rotation_quaternion() * rotation)
