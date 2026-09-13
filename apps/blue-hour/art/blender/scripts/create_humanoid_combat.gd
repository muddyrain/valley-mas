extends SceneTree
## Bake only new upper-body keys against the existing reference; never recook locomotion.
const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const Arm = preload("res://survivors/humanoid_arm_constraint.gd")
const Pose = preload("res://weapons/weapon_pose_profile.gd")
const OUTPUT := "res://assets/animations/humanoid/combat/bh_humanoid_long_gun.tres"

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var reference := Reference.instantiate()
	root.add_child(reference)
	var skeleton := reference.get_node("Skeleton3D") as Skeleton3D
	var library := AnimationLibrary.new()
	for name: StringName in [&"long_gun_ready", &"long_gun_aim", &"long_gun_shoot"]:
		var clip := Animation.new()
		clip.length = .20 if name == &"long_gun_shoot" else 2.4
		clip.loop_mode = Animation.LOOP_NONE if name == &"long_gun_shoot" else Animation.LOOP_LINEAR
		clip.set_meta("rig_spec", "BH_Humanoid_Rig_v1")
		clip.set_meta("animation_profile", "long_gun")
		var bones := Arm.upper_body_bones(skeleton)
		var spine := skeleton.find_bone("Spine")
		for bone in bones:
			var track := clip.add_track(Animation.TYPE_ROTATION_3D)
			clip.track_set_path(track, NodePath("Skeleton3D:" + skeleton.get_bone_name(bone)))
		var times: Array[float] = [0.0, .6, 1.2, 1.8, 2.4]
		if name == &"long_gun_shoot":
			times.assign([0.0, .025, .065, .12, .20])
		for time: float in times:
			skeleton.reset_bone_poses()
			var aiming := name != &"long_gun_ready"
			var recoil := 0.0
			if name == &"long_gun_shoot":
				recoil = 1.0 if is_equal_approx(time, .025) else (.45 if is_equal_approx(time, .065) else (.08 if is_equal_approx(time, .12) else 0.0))
			var breath := sin(time / 2.4 * TAU) * .002 if name != &"long_gun_shoot" else 0.0
			skeleton.set_bone_pose_rotation(spine, Quaternion(Vector3.UP, -.65) * Quaternion(Vector3.RIGHT, (.12 if aiming else .095) - recoil * .11))
			skeleton.set_bone_pose_rotation(skeleton.find_bone("Chest"), Quaternion(Vector3.RIGHT, -recoil * .045))
			skeleton.set_bone_pose_rotation(skeleton.find_bone("Neck"), Quaternion(Vector3.UP, .35) * Quaternion(Vector3.RIGHT, -.06))
			skeleton.set_bone_pose_rotation(skeleton.find_bone("Head"), Quaternion(Vector3.UP, .30) * Quaternion(Vector3.RIGHT, -.035))
			# Bring the support shoulder forward before bending the arm. Pulling the gun
			# behind the chest to shorten the reach would bury its stock in the torso.
			var support_shoulder := skeleton.find_bone("LeftShoulder")
			Arm.orient(skeleton, support_shoulder, Basis(Vector3.UP, -1.4) * skeleton.get_bone_global_rest(support_shoulder).basis)
			var wrist := Vector3(-.105, 1.205 if aiming else 1.08, .15 if aiming else .17)
			wrist += Vector3(0, breath + recoil * .014, -recoil * .055)
			var tilt := Basis(Vector3.RIGHT, (.015 if aiming else .36) - recoil * .055)
			var hand_basis := tilt * Pose.hand_basis()
			Arm.solve(skeleton, skeleton.find_bone("RightUpperArm"), skeleton.find_bone("RightLowerArm"), skeleton.find_bone("RightHand"), Transform3D(hand_basis, wrist), Vector3(-.49, .98, .02))
			# A shared neutral support pose; the runtime constraint follows each weapon's marker.
			var support := wrist + tilt * Vector3(0, -.001, .315)
			var left_basis := Basis(Vector3.RIGHT, Vector3.BACK, Vector3.DOWN)
			Arm.solve(skeleton, skeleton.find_bone("LeftUpperArm"), skeleton.find_bone("LeftLowerArm"), skeleton.find_bone("LeftHand"), Transform3D(tilt * left_basis, support), Vector3(.40, .95, .1))
			for track in bones.size():
				clip.rotation_track_insert_key(track, time, skeleton.get_bone_pose_rotation(bones[track]))
		library.add_animation(name, clip)
	DirAccess.make_dir_recursive_absolute(OUTPUT.get_base_dir())
	assert(ResourceSaver.save(library, OUTPUT) == OK)
	print("BH_Humanoid public combat: ", library.get_animation_list())
	reference.free()
	quit()
