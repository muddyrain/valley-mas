extends Node
## Presentation around the existing mission camera; manual pan always wins over following.

const DEFAULT_SIZE: float = 25.0
const MIN_SIZE: float = 20.0
const MAX_SIZE: float = 35.0
const OFFSET := Vector3(34, 42, 43)
const LOOK_AHEAD := Vector3(0, 0, -4)
var following: bool = true
var mission: Node3D

func setup(target: Node3D) -> void:
	mission = target
	mission.camera.size = DEFAULT_SIZE
	center_squad()

func update(delta: float) -> void:
	if following and not mission.living().is_empty():
		var target: Vector3 = mission.squad_center() + LOOK_AHEAD
		mission.camera_center = mission.camera_center.lerp(target, 1.0 - exp(-delta * 6.0))
		apply()

func pan(amount: Vector2) -> void:
	following = false
	var right: Vector3 = mission.camera.global_basis.x
	var forward: Vector3 = -mission.camera.global_basis.z
	forward.y = 0
	mission.camera_center += right * amount.x - forward.normalized() * amount.y
	apply()

func zoom(amount: float) -> void:
	mission.camera.size = clampf(mission.camera.size + amount, MIN_SIZE, MAX_SIZE)

func center_squad() -> void:
	following = true
	mission.camera_center = mission.squad_center() + LOOK_AHEAD
	apply()

func apply() -> void:
	mission.camera_center.x = clampf(mission.camera_center.x, -mission.catalog.map.half_width + 8, mission.catalog.map.half_width - 8)
	mission.camera_center.z = clampf(mission.camera_center.z, -mission.catalog.map.half_depth + 8, mission.catalog.map.half_depth - 8)
	mission.camera.position = mission.camera_center + OFFSET
	mission.camera.look_at(mission.camera_center, Vector3.UP)
