extends RefCounted
## A fixed two-segment arm, no iterations, bone translation, or rig-specific lengths.

static func upper_body_bones(skeleton: Skeleton3D) -> Array[int]:
	var result: Array[int] = []
	var spine := skeleton.find_bone("Spine")
	if spine < 0:
		return result
	for bone in skeleton.get_bone_count():
		var ancestor := bone
		while ancestor >= 0:
			if ancestor == spine:
				result.append(bone)
				break
			ancestor = skeleton.get_bone_parent(ancestor)
	return result

static func orient(skeleton: Skeleton3D, bone: int, basis: Basis) -> void:
	var parent := skeleton.get_bone_parent(bone)
	var parent_basis := skeleton.get_bone_global_pose(parent).basis.orthonormalized()
	skeleton.set_bone_pose_rotation(bone, (parent_basis.inverse() * basis.orthonormalized()).get_rotation_quaternion())

static func solve(skeleton: Skeleton3D, upper: int, lower: int, hand: int, goal: Transform3D, pole: Vector3) -> void:
	var shoulder := skeleton.get_bone_global_pose(upper).origin
	var upper_length := skeleton.get_bone_rest(lower).origin.length()
	var lower_length := skeleton.get_bone_rest(hand).origin.length()
	var offset := goal.origin - shoulder
	var distance := clampf(offset.length(), absf(upper_length - lower_length) + .0001, upper_length + lower_length - .0001)
	var forward := offset.normalized()
	if forward.is_zero_approx():
		return
	var bend := (pole - shoulder).slide(forward).normalized()
	if bend.is_zero_approx():
		bend = Vector3.DOWN.slide(forward).normalized()
	var along := (upper_length * upper_length - lower_length * lower_length + distance * distance) / (2.0 * distance)
	var height := sqrt(maxf(0, upper_length * upper_length - along * along))
	var elbow := shoulder + forward * along + bend * height
	_point(skeleton, upper, lower, elbow)
	_point(skeleton, lower, hand, shoulder + forward * distance)
	orient(skeleton, hand, goal.basis)

static func _point(skeleton: Skeleton3D, bone: int, child: int, point: Vector3) -> void:
	var pose := skeleton.get_bone_global_pose(bone)
	var from := (skeleton.get_bone_global_pose(child).origin - pose.origin).normalized()
	var to := (point - pose.origin).normalized()
	orient(skeleton, bone, Basis(Quaternion(from, to)) * pose.basis.orthonormalized())
