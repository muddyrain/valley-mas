extends RefCounted
## Compatibility entry for directed commands; all shot mechanics live in one controller.

static func fire(member: Node3D, mission: Node3D, point: Vector3) -> void:
	member.combat.try_attack(member, mission, point)
