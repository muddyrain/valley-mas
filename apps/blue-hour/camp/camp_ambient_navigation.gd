extends Node3D
## A ground-only map for Ambient. Departure retains the authored navigation map.
const CLEARANCE := 0.40
const PROJECTION_LIMIT := 0.45
var map := RID()
var mesh := NavigationMesh.new()
var exclusions: Array[Rect2] = []
var _region := RID()

func _exit_tree() -> void:
	if _region.is_valid():
		NavigationServer3D.free_rid(_region)
	if map.is_valid():
		NavigationServer3D.free_rid(map)

func setup(camp: Node3D) -> void:
	var source := NavigationMeshSourceGeometryData3D.new()
	source.add_faces(PackedVector3Array([
		Vector3(-11.8, -0.05, -8), Vector3(11.8, -0.05, 8), Vector3(-11.8, -0.05, 8),
		Vector3(-11.8, -0.05, -8), Vector3(11.8, -0.05, -8), Vector3(11.8, -0.05, 8)
	]), Transform3D.IDENTITY)
	for shape: CollisionShape3D in camp.find_children("*", "CollisionShape3D", true, false):
		if shape.disabled or not shape.shape is BoxShape3D or not shape.get_parent() is StaticBody3D:
			continue
		if shape.get_parent().name in [&"TerrainBase", &"Road"]:
			continue
		var box := shape.shape as BoxShape3D
		var bounds := AABB(-box.size * 0.5, box.size)
		var world_bounds := shape.global_transform * bounds
		if world_bounds.position.y > 1.85:
			continue
		_add_exclusion(source, Rect2(Vector2(world_bounds.position.x, world_bounds.position.z),
				Vector2(world_bounds.size.x, world_bounds.size.z)).grow(CLEARANCE))
	# Visible dressing is batched without collision. These three substantial silhouettes
	# and the entire assembly/vehicle corridor still need explicit ground exclusions.
	for rect: Rect2 in [
		Rect2(-9.0, 0.0, 6.5, 4.8),
		Rect2(0.55, 0.36, 2.0, 0.66).grow(CLEARANCE),
		Rect2(0.55, 2.29, 2.0, 0.66).grow(CLEARANCE),
		Rect2(-1.0, 1.20, 0.9, 0.9).grow(CLEARANCE),
		Rect2(1.35, -3.8, 2.2, 0.55).grow(CLEARANCE),
	]:
		_add_exclusion(source, rect)
	mesh.cell_size = 0.10
	mesh.cell_height = 0.05
	mesh.agent_radius = 0.30
	mesh.agent_height = 1.75
	mesh.agent_max_climb = 0.0
	mesh.agent_max_slope = 5.0
	mesh.edge_max_error = 0.1
	NavigationServer3D.bake_from_source_geometry_data(mesh, source)
	print("AMBIENT BAKE: ", mesh.get_polygon_count(), " polygons; ", exclusions.size(), " exclusions")
	map = NavigationServer3D.map_create()
	NavigationServer3D.map_set_use_async_iterations(map, false)
	NavigationServer3D.map_set_cell_size(map, mesh.cell_size)
	NavigationServer3D.map_set_cell_height(map, mesh.cell_height)
	NavigationServer3D.map_set_active(map, true)
	_region = NavigationServer3D.region_create()
	NavigationServer3D.region_set_navigation_mesh(_region, mesh)
	NavigationServer3D.region_set_map(_region, map)
	NavigationServer3D.map_force_update(map)

func _add_exclusion(source: NavigationMeshSourceGeometryData3D, rect: Rect2) -> void:
	exclusions.append(rect)
	# Recast rounds contours to cells; reserve an extra cell beyond physical clearance.
	rect = rect.grow(0.15)
	var a := rect.position
	var b := rect.end
	source.add_projected_obstruction(PackedVector3Array([
		Vector3(a.x, 0, a.y), Vector3(b.x, 0, a.y),
		Vector3(b.x, 0, b.y), Vector3(a.x, 0, b.y)]), -1.0, 8.0, true)

func project(point: Vector3) -> Vector3:
	return NavigationServer3D.map_get_closest_point(map, point)

func is_safe(point: Vector3, tolerance: float = PROJECTION_LIMIT) -> bool:
	if not map.is_valid() or NavigationServer3D.map_get_iteration_id(map) == 0:
		return false
	for rect: Rect2 in exclusions:
		if rect.grow(-0.03).has_point(Vector2(point.x, point.z)):
			return false
	return point.distance_to(project(point)) <= tolerance

func valid_path(start: Vector3, target: Vector3) -> PackedVector3Array:
	if not is_safe(target) or not is_safe(start):
		return PackedVector3Array()
	var end := project(target)
	var path := NavigationServer3D.map_get_path(map, project(start), end, true)
	if path.is_empty() or path[-1].distance_to(end) > 0.20:
		return PackedVector3Array()
	var length := 0.0
	for index: int in range(1, path.size()):
		var segment := path[index - 1].distance_to(path[index])
		length += segment
		for step: int in range(1, int(ceilf(segment / 0.1))):
			var point := path[index - 1].lerp(path[index], step * 0.1 / segment)
			if not is_safe(point, 0.12):
				return PackedVector3Array()
	if length > 38.0 or length > maxf(8.0, start.distance_to(target) * 3.0):
		return PackedVector3Array()
	return path
