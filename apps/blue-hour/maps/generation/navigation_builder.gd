extends RefCounted
## The existing actors move on AStarGrid2D. Project the actual wrapper shapes, once.

static func build(city: Node3D) -> void:
	for node: Node in city.find_children("*", "CollisionShape3D", true, false):
		var collision := node as CollisionShape3D
		if not collision.get_parent() is StaticBody3D or collision.disabled:
			continue
		if not collision.shape is BoxShape3D:
			push_warning("World navigation skipped non-box primitive: " + str(collision.get_path()))
			continue
		var shape := collision.shape as BoxShape3D
		var transform: Transform3D = city.global_transform.affine_inverse() * collision.global_transform
		var bounds := transform * AABB(-shape.size * .5, shape.size)
		# Ground and canopy roofs must not close walkable space under them.
		if bounds.end.y <= .2 or bounds.position.y > 2.1:
			continue
		var inverse := transform.affine_inverse()
		var margin: float = .72
		for x: int in range(ceili(bounds.position.x - margin), floori(bounds.end.x + margin) + 1):
			for z: int in range(ceili(bounds.position.z - margin), floori(bounds.end.z + margin) + 1):
				var cell := Vector2i(x, z)
				if not city.grid.is_in_boundsv(cell):
					continue
				var local: Vector3 = inverse * Vector3(x, transform.origin.y, z)
				if absf(local.x) <= shape.size.x * .5 + margin and absf(local.z) <= shape.size.z * .5 + margin:
					city.grid.set_point_solid(cell, true)


