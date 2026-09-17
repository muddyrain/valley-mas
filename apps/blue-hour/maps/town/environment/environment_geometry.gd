extends RefCounted
## Measure wrapper geometry without changing shared scenes or catalog resources.

static func bounds(root: Node3D, collision: bool = false) -> AABB:
	var boxes: Array[AABB] = []
	_collect(root, Transform3D.IDENTITY, collision, boxes)
	var result := AABB()
	for index: int in boxes.size():
		result = boxes[index] if index == 0 else result.merge(boxes[index])
	return result

static func _collect(node: Node3D, transform: Transform3D, collision: bool, boxes: Array[AABB]) -> void:
	if not collision and node is MeshInstance3D and node.mesh != null:
		boxes.append(transform * node.get_aabb())
	if collision and node is CollisionShape3D and node.shape != null and not node.disabled and node.get_parent() is StaticBody3D:
		boxes.append(transform * node.shape.get_debug_mesh().get_aabb())
	for child: Node in node.get_children():
		if child is Node3D:
			_collect(child, transform * child.transform, collision, boxes)

static func footprint(box: AABB, point: Vector2, yaw: float, size_scale: float = 1.0) -> Rect2:
	var world := Transform3D(Basis(Vector3.UP, yaw).scaled(Vector3.ONE * size_scale), Vector3(point.x, 0, point.y)) * box
	return Rect2(Vector2(world.position.x, world.position.z), Vector2(world.size.x, world.size.z))

static func polygon(rect: Rect2) -> PackedVector2Array:
	return PackedVector2Array([rect.position, Vector2(rect.end.x, rect.position.y), rect.end, Vector2(rect.position.x, rect.end.y)])

static func polygon_bounds(points: PackedVector2Array) -> Rect2:
	var result := Rect2(points[0], Vector2.ZERO)
	for point: Vector2 in points:
		result = result.expand(point)
	return result

static func contains(points: PackedVector2Array, rect: Rect2) -> bool:
	return Geometry2D.clip_polygons(polygon(rect), points).is_empty()

static func xz(point: Vector3) -> Vector2:
	return Vector2(point.x, point.z)
