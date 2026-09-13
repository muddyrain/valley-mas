extends RefCounted
## Uses the existing vehicle and survivor motion; no second scene or save state.
var elapsed: float = 0.0
var finished: bool = false
var destinations: Array[Vector3] = []
var released: Array[bool] = []
var bus_position := Vector3.ZERO
var door_position := Vector3.ZERO

func setup(mission: Node3D) -> void:
	bus_position = mission.city.bus_root.position
	door_position = mission.city.bus_door.position
	mission.input_enabled = false
	for member: Node3D in mission.survivors:
		destinations.append(mission.city.nearest_open(member.position))
		released.append(false)
		member.boarding = true
		member.visible = false
	mission.city.bus_root.position = bus_position + Vector3(-4, 0, 0)
	mission.city.bus_door.position = door_position + Vector3(-4, 0, 0)

func advance(delta: float, mission: Node3D) -> void:
	elapsed += delta
	var config: Resource = mission.catalog.map.encounter
	var stop: float = clampf(elapsed / config.arrival_stop_seconds, 0, 1)
	var offset := Vector3(-4, 0, 0) * pow(1.0 - stop, 2)
	mission.city.bus_root.position = bus_position + offset
	mission.city.bus_door.position = door_position + offset
	var all_out: bool = true
	for i: int in range(mission.survivors.size()):
		var member: Node3D = mission.survivors[i]
		var release_at: float = config.arrival_stop_seconds + i * config.disembark_spacing
		if elapsed < release_at:
			all_out = false
			continue
		if not released[i]:
			released[i] = true
			member.position = mission.city.nearest_open(mission.catalog.map.bus_position + Vector3(0, 0, 1.5))
			member.visible = true
			member.boarding = false
			member.order_move(destinations[i], mission.city)
		var before: Vector3 = member.position
		member._move(delta, mission)
		if member.animation_controller != null:
			member.animation_controller.update_motion(before.distance_to(member.position) / maxf(delta, 0.00001), member.data.move_speed, delta)
		all_out = all_out and member.path.is_empty()
	if all_out and elapsed >= config.arrival_stop_seconds + config.disembark_seconds:
		finished = true
		mission.input_enabled = true
