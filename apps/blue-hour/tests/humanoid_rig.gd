extends SceneTree

const Review = preload("res://debug/humanoid_rig_review.gd")
const BoneMapping = preload("res://assets/characters/rigs/bh_humanoid_rig_v1_bone_map.tres")
var failures: Array[String] = []
var checks := 0

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func inspect_node(node: Node, skeleton: Skeleton3D) -> void:
	if node is AnimationPlayer:
		check((node as AnimationPlayer).get_animation_list().is_empty(), "No animation clips")
	if node is MeshInstance3D:
		var instance := node as MeshInstance3D
		check(instance.skin != null, "Render mesh has a Skin")
		check(instance.get_node(instance.skeleton) == skeleton, "Mesh resolves its imported Skeleton3D")
		if instance.skin:
			check(instance.skin.get_bind_count() == 23, "Skin has 23 bind poses")
			for i in instance.skin.get_bind_count():
				check(skeleton.find_bone(instance.skin.get_bind_name(i)) >= 0, "Named bind resolves")
		for surface in instance.mesh.get_surface_count():
			var material := instance.get_active_material(surface) as StandardMaterial3D
			check(material != null, "Imported material exists")
			if material:
				for texture in [material.albedo_texture, material.normal_texture, material.roughness_texture]:
					check(texture != null and texture.get_size() == Vector2(2048, 2048), "Current 2048px embedded texture exists")
			var arrays := instance.mesh.surface_get_arrays(surface)
			var bounds := instance.get_aabb()
			check(absf(bounds.size.y - 1.6) < .002 and absf(bounds.position.y) < .002, "Original height and sole-ground alignment")
			var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
			var bones: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
			check(not weights.is_empty() and weights.size() == bones.size(), "Imported vertex weights exist")
			var valid := true
			for i in range(0, weights.size(), 4):
				var total := weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3]
				valid = valid and absf(total - 1.0) < 0.001
			check(valid, "Every imported vertex has normalized four-weight skinning")
	for child in node.get_children():
		inspect_node(child, skeleton)

func run() -> void:
	var review := Review.new()
	root.add_child(review)
	await process_frame
	for character in Review.Catalog.CHARACTERS.size():
		await check_character(review, character)
	var report := {"engine": Engine.get_version_info().string, "characters": Review.Catalog.CHARACTERS.size(), "checks": checks, "failures": failures, "native_capture": "capture" in OS.get_cmdline_user_args()}
	var output := FileAccess.open("res://test-output/rig/godot-rig.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(report, "\t"))
	print("BH HUMANOID RIG: ", JSON.stringify(report))
	review.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func check_character(review: Node3D, character: int) -> void:
	review.set_character(character)
	await process_frame
	var skeleton: Skeleton3D = review.skeleton
	check(skeleton != null, "GLB creates Skeleton3D")
	check(skeleton.get_bone_count() == 23, "Exactly 23 standard bones")
	var profile := SkeletonProfileHumanoid.new()
	for i in skeleton.get_bone_count():
		var name: StringName = skeleton.get_bone_name(i)
		var profile_index := profile.find_bone(name)
		check(profile_index >= 0, "Godot humanoid name: " + name)
		check(BoneMapping.get_skeleton_bone_name(name) == name, "Identity retarget mapping: " + name)
		var parent_index := skeleton.get_bone_parent(i)
		var parent_name: StringName = skeleton.get_bone_name(parent_index) if parent_index >= 0 else &""
		check(parent_name == profile.get_bone_parent(profile_index), "Godot humanoid hierarchy: " + name)
	for i in profile.get_bone_size():
		if profile.is_required(i):
			check(skeleton.find_bone(profile.get_bone_name(i)) >= 0, "Required humanoid bone present")
	inspect_node(review.model, skeleton)
	var capture := "capture" in OS.get_cmdline_user_args()
	for pose in Review.POSES.size():
		review.set_pose(pose)
		await process_frame
		check(skeleton.get_bone_global_pose(skeleton.find_bone("Head")).is_finite(), "Finite static pose")
		var rotation_valid := true
		for bone in skeleton.get_bone_count():
			var rest_rotation := skeleton.get_bone_rest(bone).basis.get_rotation_quaternion()
			var rotation := skeleton.get_bone_pose_rotation(bone)
			rotation_valid = rotation_valid and rest_rotation.angle_to(rotation) <= deg_to_rad(60.01)
		check(rotation_valid, "Static pose preserves imported rest rotation")
		if pose in [5, 6, 7, 8]:
			check_leg_direction(skeleton, "Left" if pose in [5, 7] else "Right", pose in [7, 8])
		if capture:
			for view in 3:
				review.set_view(view)
				await process_frame
				await RenderingServer.frame_post_draw
				var suffix: String = ["", "-front", "-back"][view]
				root.get_texture().get_image().save_png("res://test-output/rig/%s-pose-%02d%s.png" % [Review.Catalog.CHARACTERS[character]["id"], pose, suffix])

func check_leg_direction(skeleton: Skeleton3D, side: String, bent: bool) -> void:
	var hip := skeleton.find_bone(side + "UpperLeg")
	var knee := skeleton.find_bone(side + "LowerLeg")
	var ankle := skeleton.find_bone(side + "Foot")
	var hip_rest := skeleton.get_bone_global_rest(hip).origin
	var knee_rest := skeleton.get_bone_global_rest(knee).origin
	var ankle_rest := skeleton.get_bone_global_rest(ankle).origin
	var hip_pose := skeleton.get_bone_global_pose(hip).origin
	var knee_pose := skeleton.get_bone_global_pose(knee).origin
	var ankle_pose := skeleton.get_bone_global_pose(ankle).origin
	# The character faces +Z. A lifted thigh must move its knee forward.
	check(knee_pose.z > knee_rest.z + 0.05, side + ": knee moves toward the character front")
	if bent:
		var rest_angle := (knee_rest - hip_rest).signed_angle_to(ankle_rest - knee_rest, Vector3.RIGHT)
		var pose_angle := (knee_pose - hip_pose).signed_angle_to(ankle_pose - knee_pose, Vector3.RIGHT)
		var flexion := rad_to_deg(wrapf(pose_angle - rest_angle, -PI, PI))
		check(flexion > 55 and flexion < 65, side + ": shin flexes backward at the knee, not into hyperextension")
