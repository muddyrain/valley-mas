extends SceneTree
## Six shared rotation tracks; the approved torso and lower-body resource is never rewritten.
const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const OUTPUT := "res://assets/animations/humanoid/locomotion/bh_humanoid_unarmed_arms_v2.tres"
const DURATION: float = .7
const CADENCE_C_CYCLE: float = .51
const FRAMES: int = 120

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
	clip.set_meta("upper_arm_peak_degrees", 23.0)
	clip.set_meta("forearm_local_center_degrees", 105.0)
	clip.set_meta("forearm_lag_seconds_at_nominal_cadence", Vector2(.024, .029))
	clip.set_meta("wrist_extra_lag_seconds_at_nominal_cadence", .016)
	for side: String in ["Left", "Right"]:
		for part: String in ["UpperArm", "LowerArm", "Hand"]:
			var bone := skeleton.find_bone(side + part)
			var track := clip.add_track(Animation.TYPE_ROTATION_3D)
			clip.track_set_path(track, NodePath("Skeleton3D:" + side + part))
			var axes := skeleton.get_bone_global_rest(bone).basis.orthonormalized().inverse()
			var rest := skeleton.get_bone_rest(bone).basis.get_rotation_quaternion()
			for frame in range(FRAMES + 1):
				var phase := float(frame % FRAMES) / FRAMES + (0.0 if side == "Left" else .5)
				var cycle := TAU * phase - .30 + (0.0 if side == "Left" else .018)
				var lag := TAU * (.024 if side == "Left" else .029) / CADENCE_C_CYCLE
				var angles := Vector3.ZERO
				if part == "UpperArm":
					# A small harmonic softens the reversal without adding an extra swing.
					angles = Vector3(23.0 * cos(cycle) + .8 * sin(2 * cycle), 0, -17 if side == "Left" else 17)
				elif part == "LowerArm":
					# The rest rig contributes an open elbow angle. Author the local
					# rotation for a geometric bend near ninety degrees after retargeting.
					angles.x = -105.0 + 8.0 * cos(cycle - lag) + 1.2 * sin(2 * cycle - lag)
				else:
					var wrist_phase := cycle - lag - TAU * .016 / CADENCE_C_CYCLE
					angles = Vector3(1.6 * cos(wrist_phase), .65 * sin(wrist_phase), .4 * sin(wrist_phase - .3))
				var offset := Quaternion(axes * Vector3.UP, deg_to_rad(angles.y)) * Quaternion(axes * Vector3.RIGHT, deg_to_rad(angles.x)) * Quaternion(axes * Vector3.BACK, deg_to_rad(angles.z))
				clip.rotation_track_insert_key(track, float(frame) / FRAMES * DURATION, rest * offset)
	var library := AnimationLibrary.new()
	library.add_animation(&"unarmed_arms", clip)
	assert(ResourceSaver.save(library, OUTPUT) == OK)
	print("UNARMED ARMS V2: six rotations; 23 degree upper arm; 24/29 ms forearm follow")
	reference.free()
	quit()
