extends SkeletonModifier3D
## Applied after retargeting. Only arm rotations change; locomotion/root stay authored.
var profile: WeaponPoseProfile

func _process_modification_with_delta(_delta: float) -> void:
	if profile == null:
		return
	var skeleton := get_skeleton()
	if skeleton == null:
		return
	_point_arm(skeleton, &"RightUpperArm", profile.right_upper_arm)
	_point_arm(skeleton, &"RightLowerArm", profile.right_lower_arm)
	_orient(skeleton, &"RightHand", WeaponPoseProfile.hand_basis(), 1.0)
	if profile.left_upper_arm != Vector3.ZERO:
		_point_arm(skeleton, &"LeftUpperArm", profile.left_upper_arm)
		_point_arm(skeleton, &"LeftLowerArm", profile.left_lower_arm)

func _point_arm(skeleton: Skeleton3D, bone_name: StringName, direction: Vector3) -> void:
	var index := skeleton.find_bone(bone_name)
	if index < 0 or direction.is_zero_approx():
		return
	var rest := skeleton.get_bone_global_rest(index).basis.orthonormalized()
	var desired := Basis(Quaternion(rest.y, direction.normalized())) * rest
	_orient(skeleton, bone_name, desired, profile.arm_weight)

func _orient(skeleton: Skeleton3D, bone_name: StringName, desired: Basis, weight: float) -> void:
	var index := skeleton.find_bone(bone_name)
	if index < 0:
		return
	var parent := skeleton.get_bone_parent(index)
	var parent_basis := skeleton.get_bone_global_pose(parent).basis.orthonormalized()
	var local := (parent_basis.inverse() * desired).get_rotation_quaternion()
	skeleton.set_bone_pose_rotation(index, skeleton.get_bone_pose_rotation(index).slerp(local, weight))
