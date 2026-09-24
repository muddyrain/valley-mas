extends SkeletonModifier3D
## Turns Xia's baked upper body toward an existing combat target without moving legs.

const Arm = preload("res://survivors/humanoid_arm_constraint.gd")
const MAX_TORSO_YAW: float = 1.7453293

var bridge: Node
var aim_yaw: float = 0.0
var _spine: int = -1

func initialize() -> void:
	_spine = get_skeleton().find_bone("Spine")

func update_aim(delta: float) -> void:
	var skeleton := get_skeleton()
	if skeleton == null or absf(skeleton.global_basis.determinant()) < 0.000001:
		return
	var desired: float = 0.0
	if bridge != null and bridge.aiming and bridge.uses_long_gun() and not bridge.aim_direction.is_zero_approx():
		var local: Vector3 = skeleton.global_basis.inverse() * bridge.aim_direction
		desired = clampf(atan2(local.x, local.z), -MAX_TORSO_YAW, MAX_TORSO_YAW)
	aim_yaw = move_toward(aim_yaw, desired, delta * 8.0)

func _process_modification_with_delta(_delta: float) -> void:
	if _spine < 0 or bridge == null or bridge.combat_weight <= 0.0 or is_zero_approx(aim_yaw):
		return
	var skeleton := get_skeleton()
	if not skeleton.is_visible_in_tree() or absf(skeleton.global_basis.determinant()) < 0.000001:
		return
	var rest: Basis = skeleton.get_bone_global_rest(_spine).basis.orthonormalized()
	var local_rest: Basis = skeleton.get_bone_rest(_spine).basis.orthonormalized()
	var authored: Basis = local_rest.inverse() * Basis(skeleton.get_bone_pose_rotation(_spine))
	var desired: Basis = Basis(Vector3.UP, aim_yaw) * rest * authored
	Arm.orient(skeleton, _spine, desired)
