extends SkeletonModifier3D
## Runs on the skinned target after retargeting; consumes current-frame weapon transforms.
const Arm = preload("res://survivors/humanoid_arm_constraint.gd")
const Secondary = preload("res://survivors/combat_locomotion_secondary.gd")
const MAX_TORSO_YAW: float = PI / 3.0
var bridge: Node
var visual: WeaponVisualController
var aim_yaw: float = 0.0
var _spine: int
var _upper: int
var _lower: int
var _hand: int
var secondary := Secondary.new()

func initialize() -> void:
	var skeleton := get_skeleton()
	_spine = skeleton.find_bone("Spine")
	_upper = skeleton.find_bone("LeftUpperArm")
	_lower = skeleton.find_bone("LeftLowerArm")
	_hand = skeleton.find_bone("LeftHand")
	secondary.initialize(skeleton)

func update_aim(delta: float) -> void:
	if absf(get_skeleton().global_basis.determinant()) < .000001:
		return
	var desired := 0.0
	if bridge.aiming and not bridge.aim_direction.is_zero_approx():
		var local: Vector3 = get_skeleton().global_basis.inverse() * bridge.aim_direction
		desired = clampf(atan2(local.x, local.z), -MAX_TORSO_YAW, MAX_TORSO_YAW)
	aim_yaw = move_toward(aim_yaw, desired, delta * 8.0)

func _process_modification_with_delta(_delta: float) -> void:
	if bridge == null or bridge.combat_weight <= 0.0:
		return
	var skeleton := get_skeleton()
	# Extraction scales the visual to zero before disposing it. Such a transform
	# has no inverse and no visible pose to constrain.
	if not skeleton.is_visible_in_tree() or absf(skeleton.global_basis.determinant()) < .000001:
		return
	var weight := smoothstep(0.0, 1.0, bridge.combat_weight)
	# Counter the gait's pelvis rotation without touching its position or legs.
	var pose := skeleton.get_bone_global_pose(_spine).basis.orthonormalized()
	var rest := skeleton.get_bone_rest(_spine).basis.orthonormalized()
	var authored := rest.inverse() * Basis(skeleton.get_bone_pose_rotation(_spine))
	var desired := Basis(Vector3.UP, aim_yaw) * skeleton.get_bone_global_rest(_spine).basis.orthonormalized() * authored
	Arm.orient(skeleton, _spine, pose.slerp(desired, weight))
	secondary.apply(skeleton, aim_yaw, weight)
	var grip := visual.get_support_grip()
	if grip == null:
		return
	# BoneAttachment updates after all modifiers. Reading its previous global transform
	# here creates a one-frame feedback loop, so the visual owner resolves this pose.
	var support := skeleton.global_transform.affine_inverse() * visual.get_marker_transform(grip, skeleton)
	var palm_basis := support.basis.orthonormalized() * Basis(Vector3.LEFT, Vector3.FORWARD, Vector3.DOWN)
	# The marker is the palm contact; the rig's Hand bone starts at the wrist.
	var goal := Transform3D(palm_basis, support.origin - palm_basis * Vector3(0, .045, 0))
	var original_upper := skeleton.get_bone_pose_rotation(_upper)
	var original_lower := skeleton.get_bone_pose_rotation(_lower)
	var original_hand := skeleton.get_bone_pose_rotation(_hand)
	var shoulder := skeleton.get_bone_global_pose(_upper).origin
	var pole := shoulder + Basis(Vector3.UP, aim_yaw) * Vector3(.28, -.36, .08)
	Arm.solve(skeleton, _upper, _lower, _hand, goal, pole)
	skeleton.set_bone_pose_rotation(_upper, original_upper.slerp(skeleton.get_bone_pose_rotation(_upper), weight))
	skeleton.set_bone_pose_rotation(_lower, original_lower.slerp(skeleton.get_bone_pose_rotation(_lower), weight))
	skeleton.set_bone_pose_rotation(_hand, original_hand.slerp(skeleton.get_bone_pose_rotation(_hand), weight))
