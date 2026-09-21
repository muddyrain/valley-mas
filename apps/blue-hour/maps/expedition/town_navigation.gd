extends RefCounted
## Same AStarGrid2D backend as City, rasterized from runtime static collisions.

# Survivor is a Node3D, without a physics capsule. Its widest body radius is
# .35 m (Visuals.body), top is 1.95 m; reserve .10 m clearance around that body.
const BODY_RADIUS: float = 0.35
const AGENT_RADIUS: float = BODY_RADIUS + 0.10
const AGENT_HEIGHT: float = 1.95
const STEP_HEIGHT: float = 0.20
const CELL_SIZE: float = 0.75
const Ground = preload("res://maps/expedition/walkable_ground.gd")
var ground: RefCounted = Ground.new()

var grid: AStarGrid2D = AStarGrid2D.new()
var bounds: Rect2
var obstacles: Array[Dictionary] = []
var metrics: Dictionary = {}
var ready: bool = false
var _query_count: int = 0
var _query_total_usec: int = 0
var _query_longest_usec: int = 0
var _astar_total_usec: int = 0
var _simplify_total_usec: int = 0

func build(world: Node3D, town_bounds: Rect2) -> void:
	var started: int = Time.get_ticks_usec()
	ready = false
	obstacles.clear()
	ground.build(world)
	bounds = town_bounds.grow(-AGENT_RADIUS)
	grid.region = Rect2i(Vector2i((town_bounds.position / CELL_SIZE).floor()), Vector2i((town_bounds.size / CELL_SIZE).ceil()) + Vector2i.ONE)
	grid.cell_size = Vector2.ONE * CELL_SIZE
	grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	grid.update()
	for node: Node in world.find_children("*", "CollisionShape3D", true, false):
		var collision: CollisionShape3D = node as CollisionShape3D
		if collision.disabled or collision.shape == null or not collision.get_parent() is StaticBody3D:
			continue
		var shape_bounds: AABB = collision.shape.get_debug_mesh().get_aabb()
		var transform: Transform3D = world.global_transform.affine_inverse() * collision.global_transform
		var box: AABB = transform * shape_bounds
		var surface_y: float = ground.get_walkable_ground_height(Vector2(box.get_center().x, box.get_center().z))
		if not is_finite(surface_y):
			surface_y = ground.minimum_height
		if box.end.y <= surface_y + STEP_HEIGHT or box.position.y >= surface_y + AGENT_HEIGHT:
			continue
		var corners: PackedVector2Array = []
		for i: int in 8:
			var point: Vector3 = transform * shape_bounds.get_endpoint(i)
			corners.append(Vector2(point.x, point.z))
		var hull: PackedVector2Array = Geometry2D.convex_hull(corners)
		var polygon: PackedVector2Array = Geometry2D.offset_polygon(hull, AGENT_RADIUS, Geometry2D.JOIN_MITER)[0]
		var obstacle_bounds: Rect2 = Rect2(polygon[0], Vector2.ZERO)
		for point: Vector2 in polygon:
			obstacle_bounds = obstacle_bounds.expand(point)
		var source: String = str(world.get_path_to(collision))
		var asset_id: String = ""
		var ancestor: Node = collision
		while ancestor != world:
			if ancestor.get_script() == preload("res://maps/world/world_asset.gd"):
				asset_id = str(ancestor.get("asset_id"))
				break
			ancestor = ancestor.get_parent()
		var category: String = "prop"
		if source.begins_with("Buildings/"):
			category = "building"
		elif "BusArrival" in source or asset_id.begins_with("VEH_"):
			category = "vehicle"
		elif asset_id.begins_with("BAR_"):
			category = "fence"
		obstacles.append({"polygon": polygon, "bounds": obstacle_bounds, "category": category, "source": source, "asset_id": asset_id})
		# Cover the cell square too: an edge between open cells cannot cut a corner.
		var raster: PackedVector2Array = Geometry2D.offset_polygon(polygon, CELL_SIZE * sqrt(0.5), Geometry2D.JOIN_MITER)[0]
		var low: Vector2i = Vector2i((obstacle_bounds.position / CELL_SIZE).floor()) - Vector2i.ONE
		var high: Vector2i = Vector2i((obstacle_bounds.end / CELL_SIZE).ceil()) + Vector2i.ONE
		for x: int in range(low.x, high.x + 1):
			for z: int in range(low.y, high.y + 1):
				var cell: Vector2i = Vector2i(x, z)
				if grid.is_in_boundsv(cell) and Geometry2D.is_point_in_polygon(Vector2(cell) * CELL_SIZE, raster):
					grid.set_point_solid(cell)
	var solids: PackedByteArray = []
	for x: int in range(grid.region.position.x, grid.region.end.x):
		for z: int in range(grid.region.position.y, grid.region.end.y):
			var cell: Vector2i = Vector2i(x, z)
			if not bounds.has_point(Vector2(cell) * CELL_SIZE):
				grid.set_point_solid(cell)
			solids.append(int(grid.is_point_solid(cell)))
	metrics = {"build_ms": (Time.get_ticks_usec() - started) / 1000.0, "backend": "AStarGrid2D", "region_count": 1, "navmesh_count": 0, "cell_count": solids.size(), "obstacle_count": obstacles.size(), "signature": solids.hex_encode().sha256_text(), "memory_bytes": "NOT_AVAILABLE", "agent_radius": AGENT_RADIUS, "agent_height": AGENT_HEIGHT, "step_height": STEP_HEIGHT, "max_slope": "2D routes with rendered-surface height projection", "edge_connection_margin": "N/A: grid", "path_desired_distance": 0.0, "target_desired_distance": 0.0, "avoidance_enabled": false}
	ready = true

func cell_at(point: Vector3) -> Vector2i:
	return Vector2i(roundi(point.x / CELL_SIZE), roundi(point.z / CELL_SIZE))

func open_cell(cell: Vector2i) -> bool:
	return ready and grid.is_in_boundsv(cell) and not grid.is_point_solid(cell)

func point_clear(point: Vector3) -> bool:
	return segment_clear(point, point)

func segment_clear(from: Vector3, to: Vector3) -> bool:
	var a: Vector2 = Vector2(from.x, from.z)
	var b: Vector2 = Vector2(to.x, to.z)
	if not bounds.has_point(a) or not bounds.has_point(b):
		return false
	var segment_bounds: Rect2 = Rect2(a, Vector2.ZERO).expand(b).grow(0.001)
	for obstacle: Dictionary in obstacles:
		if not segment_bounds.intersects(obstacle.bounds, true):
			continue
		var polygon: PackedVector2Array = obstacle.polygon
		if Geometry2D.is_point_in_polygon(a, polygon) or Geometry2D.is_point_in_polygon(b, polygon):
			return false
		for index: int in polygon.size():
			if Geometry2D.segment_intersects_segment(a, b, polygon[index], polygon[(index + 1) % polygon.size()]) != null:
				return false
	return true

func nearest(point: Vector3, distance_limit: float = 3.0) -> Vector3:
	var center: Vector2i = cell_at(point)
	var best: Vector3 = Vector3.INF
	var best_distance: float = distance_limit * distance_limit
	var radius: int = ceili(distance_limit / CELL_SIZE)
	for x: int in range(-radius, radius + 1):
		for z: int in range(-radius, radius + 1):
			var cell: Vector2i = center + Vector2i(x, z)
			if not open_cell(cell):
				continue
			var candidate: Vector3 = ground.project(Vector3(cell.x * CELL_SIZE, 0, cell.y * CELL_SIZE))
			if not candidate.is_finite():
				continue
			var distance: float = Vector2(candidate.x - point.x, candidate.z - point.z).length_squared()
			if distance < best_distance:
				best_distance = distance
				best = candidate
	return best

func path(from: Vector3, to: Vector3) -> PackedVector3Array:
	var started: int = Time.get_ticks_usec()
	var result: PackedVector3Array = _path(from, to)
	var duration: int = Time.get_ticks_usec() - started
	_query_count += 1
	_query_total_usec += duration
	_query_longest_usec = maxi(_query_longest_usec, duration)
	return result

func _path(from: Vector3, to: Vector3) -> PackedVector3Array:
	if not ready or not from.is_finite() or not to.is_finite() or not point_clear(from) or not point_clear(to):
		return []
	var start: Vector3 = nearest(from, 1.0)
	var end: Vector3 = nearest(to, 1.0)
	if not start.is_finite() or not end.is_finite() or not segment_clear(from, start) or not segment_clear(end, to):
		return []
	var astar_started: int = Time.get_ticks_usec()
	var cells: Array[Vector2i] = grid.get_id_path(cell_at(start), cell_at(end))
	_astar_total_usec += Time.get_ticks_usec() - astar_started
	if cells.is_empty():
		return []
	var points: PackedVector3Array = [ground.project(from)]
	for cell: Vector2i in cells:
		points.append(ground.project(Vector3(cell.x * CELL_SIZE, 0, cell.y * CELL_SIZE)))
	points.append(ground.project(to))
	for point: Vector3 in points:
		if not point.is_finite():
			return []
	# Only remove redundant points when the whole segment clears inflated collisions.
	var simplify_started: int = Time.get_ticks_usec()
	var result: PackedVector3Array = [points[0]]
	var anchor: int = 0
	while anchor < points.size() - 1:
		var next: int = anchor + 1
		if not segment_clear(points[anchor], points[next]):
			return []
		var probe_step: int = 2
		var blocked: int = points.size()
		while anchor + probe_step < points.size():
			var probe: int = anchor + probe_step
			if not segment_clear(points[anchor], points[probe]):
				blocked = probe
				break
			next = probe
			probe_step *= 2
		if blocked == points.size() and next < points.size() - 1:
			if segment_clear(points[anchor], points[-1]):
				next = points.size() - 1
			else:
				blocked = points.size() - 1
		# Refine only the bracket between the farthest clear probe and the first
		# blocked probe. Every emitted segment still passes the exact polygon test.
		var low: int = next + 1
		var high: int = blocked - 1
		while low <= high:
			var middle: int = (low + high) / 2
			if segment_clear(points[anchor], points[middle]):
				next = middle
				low = middle + 1
			else:
				high = middle - 1
		result.append(points[next])
		anchor = next
	_simplify_total_usec += Time.get_ticks_usec() - simplify_started
	return result

func performance() -> Dictionary:
	var result: Dictionary = metrics.duplicate()
	result["average_query_ms"] = _query_total_usec / (1000.0 * maxi(1, _query_count))
	result["total_query_ms"] = _query_total_usec / 1000.0
	result["longest_query_ms"] = _query_longest_usec / 1000.0
	result["astar_total_ms"] = _astar_total_usec / 1000.0
	result["simplify_total_ms"] = _simplify_total_usec / 1000.0
	result["query_count"] = _query_count
	return result
