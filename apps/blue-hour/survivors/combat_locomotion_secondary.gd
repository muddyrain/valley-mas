extends RefCounted
## Presentation after the combat pose: torso carries the gait, arms absorb it at a stable hand goal.
const Arm = preload("res://survivors/humanoid_arm_constraint.gd")
const READY_CHEST_WEIGHT: float = .50
const READY_SHOULDER_WEIGHT: float = .28
const AIM_WEIGHT: float = .35
const SHOT_WEIGHT: float = .28
var enabled: bool = true
var motion_weight: float = 0.0
var state_weight: float = 1.0
var phase: float = 0.0
var lean_degrees: float = 0.0
var _recoil_damping: float = 0.0
var _spine: int
var _chest: int
var _neck: int
var _head: int
var _hips: int
var _left_shoulder: int
var _right_shoulder: int
var _right_upper: int
var _right_lower: int
var _right_hand: int

func initialize(skeleton: Skeleton3D) -> void:
	_spine = skeleton.find_bone("Spine")
	_chest = skeleton.find_bone("Chest")
	_neck = skeleton.find_bone("Neck")
	_head = skeleton.find_bone("Head")
	_hips = skeleton.find_bone("Hips")
	_left_shoulder = skeleton.find_bone("LeftShoulder")
	_right_shoulder = skeleton.find_bone("RightShoulder")
	_right_upper = skeleton.find_bone("RightUpperArm")
	_right_lower = skeleton.find_bone("RightLowerArm")
	_right_hand = skeleton.find_bone("RightHand")

func advance(speed: float, layer: SkeletonModifier3D, delta: float, mission_active: bool, aim_weight: float, shooting: bool) -> void:
	var desired := smoothstep(.035, 2.0, speed) if mission_active and enabled else 0.0
	motion_weight = move_toward(motion_weight, desired, delta / .16)
	phase = layer.locomotion_phase
	lean_degrees = layer.lean_degrees
	_recoil_damping = move_toward(_recoil_damping, 1.0 if shooting else 0.0, delta / (.018 if shooting else .10))
	state_weight = lerpf(1.0, AIM_WEIGHT, smoothstep(0, 1, aim_weight)) * lerpf(1.0, SHOT_WEIGHT, _recoil_damping)

func apply(skeleton: Skeleton3D, aim_yaw: float, combat_weight: float) -> void:
	var weight := motion_weight * state_weight * combat_weight
	if weight <= 0.0:
		return
	var cycle := phase * TAU
	var facing := Basis(Vector3.UP, aim_yaw)
	# Capture the authored pose (including recoil) before adding locomotion.
	# Resolving the right hand from this frame avoids a socket/IK feedback loop.
	var hand_goal := skeleton.get_bone_global_pose(_right_hand)
	var hips_height := skeleton.get_bone_pose_position(_hips).y - skeleton.get_bone_rest(_hips).origin.y
	hand_goal.origin.y -= (hips_height + .077) * motion_weight * combat_weight
	hand_goal.origin += facing * Vector3(.0015 * sin(cycle - .45), .0045 * sin(2 * cycle - .8), -.012) * weight
	var weapon_rotation := Vector3(deg_to_rad(.65) * sin(2 * cycle - .9) * weight, deg_to_rad(.30) * sin(cycle - .6) * weight, deg_to_rad(lean_degrees * .45) * motion_weight * combat_weight)
	hand_goal.basis = facing * Basis.from_euler(weapon_rotation) * facing.inverse() * hand_goal.basis
	# Hips+Spine counter-rotation remains connected; chest takes half the free gait.
	rotate(skeleton, _spine, facing, Vector3(2.0, -1.2 * cos(cycle - .24) * .70, .84 * sin(cycle) - lean_degrees * .255) * weight)
	rotate(skeleton, _chest, facing, Vector3(sin(2 * cycle - .55) * READY_CHEST_WEIGHT, 9.5 * cos(cycle - .60) * READY_CHEST_WEIGHT, lean_degrees * .305) * weight)
	var shoulder_load := sin(2 * cycle - .8) * READY_SHOULDER_WEIGHT
	rotate(skeleton, _left_shoulder, facing, Vector3(.6 * shoulder_load, 0, .8 * shoulder_load) * weight)
	rotate(skeleton, _right_shoulder, facing, Vector3(.6 * shoulder_load, 0, -.8 * shoulder_load) * weight)
	rotate(skeleton, _neck, facing, Vector3(.65 * sin(2 * cycle - 1.0), -1.4 * cos(cycle - .72), 0) * weight)
	rotate(skeleton, _head, facing, Vector3(.35 * sin(2 * cycle - 1.25), -.6 * cos(cycle - .88), 0) * weight)
	var shoulder := skeleton.get_bone_global_pose(_right_upper).origin
	var pole := shoulder + facing * Vector3(-.28, -.36 + .008 * sin(2 * cycle - .8) * weight, .08)
	Arm.solve(skeleton, _right_upper, _right_lower, _right_hand, hand_goal, pole)

func rotate(skeleton: Skeleton3D, bone: int, facing: Basis, degrees: Vector3) -> void:
	var offset := facing * Basis.from_euler(degrees * (PI / 180.0)) * facing.inverse()
	Arm.orient(skeleton, bone, offset * skeleton.get_bone_global_pose(bone).basis.orthonormalized())
