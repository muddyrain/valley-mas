extends RefCounted
## Resolves a prefab's authored entrance transform against one assigned street frontage.

const ROAD_PRIORITY: Dictionary = {
	"main": 3,
	"secondary": 2,
	"connector": 1,
	"alley": 0,
}

static func select_frontage(block: Dictionary, row: Dictionary, seed_value: int, row_index: int) -> Dictionary:
	var assigned_side: String = str(row.get("side", ""))
	if not assigned_side.is_empty():
		for edge: Dictionary in block.street_edges:
			if str(edge.side) == assigned_side:
				return edge
	var candidates: Array[Dictionary] = []
	for edge: Dictionary in block.street_edges:
		candidates.append(edge)
	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var priority_a: int = int(ROAD_PRIORITY.get(str(a.get("road_kind", "")), -1))
		var priority_b: int = int(ROAD_PRIORITY.get(str(b.get("road_kind", "")), -1))
		if priority_a != priority_b:
			return priority_a > priority_b
		var length_a: float = float(a.get("length", 0.0))
		var length_b: float = float(b.get("length", 0.0))
		if not is_equal_approx(length_a, length_b):
			return length_a > length_b
		return _tie_key(a, seed_value, str(block.get("id", "")), row_index) < _tie_key(b, seed_value, str(block.get("id", "")), row_index)
	)
	return candidates[0] if not candidates.is_empty() else {}

static func placement_yaw(local_forward: Vector3, assigned_forward: Vector3) -> float:
	var local_flat := Vector2(local_forward.x, local_forward.z).normalized()
	var assigned_flat := Vector2(assigned_forward.x, assigned_forward.z).normalized()
	if local_flat.is_zero_approx() or assigned_flat.is_zero_approx():
		return 0.0
	return atan2(-assigned_flat.x, -assigned_flat.y) - atan2(-local_flat.x, -local_flat.y)

static func world_anchor(position: Vector3, yaw: float, local_anchor: Vector3) -> Vector3:
	return position + Basis(Vector3.UP, yaw) * local_anchor

static func world_forward(yaw: float, local_forward: Vector3) -> Vector3:
	return (Basis(Vector3.UP, yaw) * local_forward).normalized()

static func _tie_key(edge: Dictionary, seed_value: int, block_id: String, row_index: int) -> int:
	return hash("%d:%s:%d:%s:%s" % [seed_value, block_id, row_index, str(edge.get("road_id", "")), str(edge.get("side", ""))])
