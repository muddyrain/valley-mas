class_name WeaponPoseProfile
extends Resource
## Directions in BH_Humanoid_Rig_v1 skeleton space (+Z faces the character front).
## This is a ready stance, independent of fire/reload/aim state.
@export var right_upper_arm := Vector3(-.3, -.9, .3)
@export var right_lower_arm := Vector3(0, -.25, 1)
@export var left_upper_arm := Vector3.ZERO
@export var left_lower_arm := Vector3.ZERO
@export_range(0, 1) var arm_weight: float = .94
@export var grip_offset := Vector3(0, .05, .005)
@export var weapon_rotation_degrees := Vector3.ZERO

static func hand_basis() -> Basis:
	return Basis(Vector3.LEFT, Vector3(0, -.6, .8), Vector3(0, .8, .6))

func attachment_transform() -> Transform3D:
	var forward_basis := Basis(Vector3.UP, PI)
	var correction := Basis.from_euler(weapon_rotation_degrees * PI / 180.0)
	return Transform3D(hand_basis().inverse() * forward_basis * correction, grip_offset)
