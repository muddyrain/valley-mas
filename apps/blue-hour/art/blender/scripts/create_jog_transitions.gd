extends SceneTree
## Separate transition clips. Reads the approved cycle without regenerating it.
const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const Joint = preload("res://survivors/humanoid_arm_constraint.gd")
const Jog = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2.tres")
const Library = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_animations_v1.tres")
const OUTPUT := "res://assets/animations/humanoid/locomotion/bh_humanoid_jog_transitions.tres"
var skeleton: Skeleton3D

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var reference := Reference.instantiate()
	root.add_child(reference)
	skeleton = reference.get_node("Skeleton3D") as Skeleton3D
	var library := AnimationLibrary.new()
	for name: StringName in [&"jog_start", &"jog_stop_left", &"jog_stop_right"]:
		var clip := Animation.new()
		clip.length = .24 if name == &"jog_start" else .28
		clip.set_meta("in_place", true)
		clip.set_meta("rig_spec", "BH_Humanoid_Rig_v1")
		for bone in skeleton.get_bone_count():
			var track := clip.add_track(Animation.TYPE_ROTATION_3D)
			clip.track_set_path(track, NodePath("Skeleton3D:" + skeleton.get_bone_name(bone)))
		var hips_track := clip.add_track(Animation.TYPE_POSITION_3D)
		clip.track_set_path(hips_track, ^"Skeleton3D:Hips")
		for frame in 49:
			var t := float(frame) / 48.0
			if name == &"jog_start":
				start_pose(t)
			else:
				stop_pose(t, name == &"jog_stop_right")
			for bone in skeleton.get_bone_count():
				clip.rotation_track_insert_key(bone, t * clip.length, skeleton.get_bone_pose_rotation(bone))
			clip.position_track_insert_key(hips_track, t * clip.length, skeleton.get_bone_pose_position(skeleton.find_bone("Hips")))
		library.add_animation(name, clip)
	assert(ResourceSaver.save(library, OUTPUT) == OK)
	print("JOG TRANSITIONS: 0.24s start / 0.28s left and right stop; approved Jog is read-only")
	reference.free()
	quit()

func start_pose(t: float) -> void:
	var phase := .35 * smoothstep(.12, 1.0, t)
	apply_clip(Library.get_animation(&"Idle"), 0)
	var idle_y := skeleton.get_bone_pose_position(skeleton.find_bone("Hips")).y
	blend_clip(Jog.get_animation(&"mission_jog"), phase * .7, smoothstep(0, .66, t))
	var load := sin(PI * smoothstep(0, .8, t))
	add_angle("Hips", Vector3(2.5, 0, 0) * load)
	add_angle("Spine", Vector3(3.0, 0, 0) * load)
	add_angle("Chest", Vector3(1.5, 0, 0) * load)
	add_angle("Neck", Vector3(-4, 0, 0) * load)
	var hips := skeleton.find_bone("Hips")
	var position := skeleton.get_bone_pose_position(hips)
	position.y = lerpf(idle_y, position.y, smoothstep(0, .65, t)) - .025 * load
	skeleton.set_bone_pose_position(hips, position)
	for side: String in ["Left", "Right"]:
		var foot := skeleton.find_bone(side + "Foot")
		var rest := skeleton.get_bone_global_rest(foot)
		var goal := skeleton.get_bone_global_pose(foot)
		var takeoff := smoothstep(.28, .90, t)
		var original_z := rest.origin.z
		var early_z := lerpf(original_z, -.31 if side == "Left" else .20, takeoff)
		var lift := .050 * smoothstep(.55, .86, t) if side == "Left" else .22 * smoothstep(.35, .82, t)
		var pitch := deg_to_rad(30) * smoothstep(.46, .85, t) if side == "Left" else deg_to_rad(-10) * takeoff
		var planted := Transform3D(Basis(Vector3.RIGHT, pitch) * rest.basis, Vector3(rest.origin.x, .16 + lift, early_z))
		goal = planted.interpolate_with(goal, smoothstep(.80, 1.0, t))
		Joint.solve(skeleton, skeleton.find_bone(side + "UpperLeg"), skeleton.find_bone(side + "LowerLeg"), foot, goal, Vector3(rest.origin.x, .7, 1))

func stop_pose(t: float, right: bool) -> void:
	apply_clip(Jog.get_animation(&"mission_jog"), .35 if right else 0.0)
	var recovery := smoothstep(.28, 1, t)
	blend_clip(Library.get_animation(&"Idle"), 0, recovery)
	var hips := skeleton.find_bone("Hips")
	var position := skeleton.get_bone_pose_position(hips)
	position.y -= .042 * sin(PI * smoothstep(0, .72, t))
	skeleton.set_bone_pose_position(hips, position)
	var rebound := sin(PI * smoothstep(.50, 1, t))
	add_angle("Hips", Vector3(-1.0, 0, 0) * rebound)
	add_angle("Spine", Vector3(-2.0, 0, 0) * rebound)
	for side: String in ["Left", "Right"]:
		var foot := skeleton.find_bone(side + "Foot")
		var rest := skeleton.get_bone_global_rest(foot)
		var front := (side == "Right") == right
		var seconds := t * .28
		var forward: float
		var lift: float
		var pitch: float
		if front:
			# Plant after the last short reach. The baked support travel follows the
			# existing 14m/s² brake, instead of dragging two flat feet with the body.
			var remaining := maxf(0, .28 - maxf(.08, seconds))
			forward = rest.origin.z + 7.0 * remaining * remaining
			lift = .09 * (1.0 - smoothstep(0, .08, seconds))
			pitch = deg_to_rad(-8) * (1.0 - smoothstep(0, .08, seconds))
		else:
			var recover := smoothstep(.045, .235, seconds)
			forward = lerpf(-.16, rest.origin.z, recover)
			lift = .10 * sin(PI * recover)
			pitch = deg_to_rad(18) * (1.0 - recover)
		var goal := Transform3D(Basis(Vector3.RIGHT, pitch) * rest.basis, Vector3(rest.origin.x, .16 + lift, forward))
		Joint.solve(skeleton, skeleton.find_bone(side + "UpperLeg"), skeleton.find_bone(side + "LowerLeg"), foot, goal, Vector3(rest.origin.x, .7, 1))
		var toes := skeleton.find_bone(side + "Toes")
		skeleton.set_bone_pose_rotation(toes, skeleton.get_bone_rest(toes).basis.get_rotation_quaternion())
	# Close on the existing Idle pose, including its relaxed knee and ankle angles.
	blend_clip(Library.get_animation(&"Idle"), 0, smoothstep(.88, 1, t))

func apply_clip(clip: Animation, time: float) -> void:
	skeleton.reset_bone_poses()
	blend_clip(clip, time, 1.0)

func blend_clip(clip: Animation, time: float, weight: float) -> void:
	for track in clip.get_track_count():
		var bone := skeleton.find_bone(String(clip.track_get_path(track).get_subname(0)))
		if clip.track_get_type(track) == Animation.TYPE_ROTATION_3D:
			skeleton.set_bone_pose_rotation(bone, skeleton.get_bone_pose_rotation(bone).slerp(clip.rotation_track_interpolate(track, time), weight))
		elif clip.track_get_type(track) == Animation.TYPE_POSITION_3D:
			skeleton.set_bone_pose_position(bone, skeleton.get_bone_pose_position(bone).lerp(clip.position_track_interpolate(track, time), weight))

func add_angle(name: String, degrees: Vector3) -> void:
	var bone := skeleton.find_bone(name)
	var rest := skeleton.get_bone_global_rest(bone).basis.orthonormalized()
	var rotation := Quaternion(rest.inverse() * Vector3.RIGHT, deg_to_rad(degrees.x))
	skeleton.set_bone_pose_rotation(bone, skeleton.get_bone_pose_rotation(bone) * rotation)
