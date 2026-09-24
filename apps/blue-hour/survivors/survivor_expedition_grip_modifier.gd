extends SkeletonModifier3D
## Keeps Xia's support palm on the equipped long gun after the baked run pose.

const Arm = preload("res://survivors/humanoid_arm_constraint.gd")
const PALM_OFFSET := Vector3(0.0, 0.045, 0.0)

var bridge: Node
var visual: WeaponVisualController
var weight: float = 0.0
var _upper: int = -1
var _lower: int = -1
var _hand: int = -1

func initialize() -> void:
	var skeleton := get_skeleton()
	_upper = skeleton.find_bone("LeftUpperArm")
	_lower = skeleton.find_bone("LeftLowerArm")
	_hand = skeleton.find_bone("LeftHand")

func update_grip(delta: float, moving: bool) -> void:
	var desired := 1.0 if moving and bridge != null and bridge.combat_weight > 0.0 and bridge.uses_long_gun() else 0.0
	weight = move_toward(weight, desired, delta * 8.0)

func _process_modification_with_delta(_delta: float) -> void:
	if weight <= 0.0 or _hand < 0 or visual == null or visual.model == null:
		return
	var marker := visual.get_support_grip()
	var skeleton := get_skeleton()
	if marker == null or skeleton == null or not skeleton.is_visible_in_tree():
		return
	if absf(skeleton.global_basis.determinant()) < 0.000001:
		return
	var goal: Transform3D = skeleton.global_transform.affine_inverse() * visual.get_marker_transform(marker, skeleton)
	var hand_pose: Transform3D = skeleton.get_bone_global_pose(_hand)
	goal.origin -= hand_pose.basis * PALM_OFFSET
	goal.basis = hand_pose.basis
	var pole: Vector3 = skeleton.get_bone_global_pose(_lower).origin
	var upper_rotation: Quaternion = skeleton.get_bone_pose_rotation(_upper)
	var lower_rotation: Quaternion = skeleton.get_bone_pose_rotation(_lower)
	var hand_rotation: Quaternion = skeleton.get_bone_pose_rotation(_hand)
	Arm.solve(skeleton, _upper, _lower, _hand, goal, pole)
	if weight < 1.0:
		skeleton.set_bone_pose_rotation(_upper, upper_rotation.slerp(skeleton.get_bone_pose_rotation(_upper), weight))
		skeleton.set_bone_pose_rotation(_lower, lower_rotation.slerp(skeleton.get_bone_pose_rotation(_lower), weight))
		skeleton.set_bone_pose_rotation(_hand, hand_rotation.slerp(skeleton.get_bone_pose_rotation(_hand), weight))
