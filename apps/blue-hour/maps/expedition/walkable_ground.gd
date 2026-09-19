extends RefCounted
## Downward projection onto the same explicitly registered triangles used to render terrain.
## Props, roofs, input planes and transparent HUD rings never enter this index.

const SURFACE_META: StringName = &"walkable_ground"
const BUCKET_SIZE: float = 4.0
const MARKER_CLEARANCE: float = 0.012
var triangles: Array[Dictionary] = []
var buckets: Dictionary = {}
var minimum_height: float = INF
var maximum_height: float = -INF

func build(world: Node3D) -> void:
	triangles.clear()
	buckets.clear()
	minimum_height = INF
	maximum_height = -INF
	for node: Node in world.find_children("*", "MeshInstance3D", true, false):
		var view := node as MeshInstance3D
		if not view.get_meta(SURFACE_META, false) or view.mesh == null:
			continue
		var faces: PackedVector3Array = view.mesh.get_faces()
		for index: int in range(0, faces.size(), 3):
			_add_triangle(view.global_transform * faces[index], view.global_transform * faces[index + 1], view.global_transform * faces[index + 2])

func _add_triangle(a: Vector3, b: Vector3, c: Vector3) -> void:
	var ab := b - a
	var ac := c - a
	var determinant := ab.x * ac.z - ab.z * ac.x
	if absf(determinant) < 0.00000001:
		return
	var rect := Rect2(Vector2(a.x, a.z), Vector2.ZERO).expand(Vector2(b.x, b.z)).expand(Vector2(c.x, c.z))
	var id: int = triangles.size()
	triangles.append({"a": a, "ab": ab, "ac": ac, "inverse": 1.0 / determinant, "bounds": rect.grow(0.00001)})
	minimum_height = minf(minimum_height, minf(a.y, minf(b.y, c.y)))
	maximum_height = maxf(maximum_height, maxf(a.y, maxf(b.y, c.y)))
	var low: Vector2i = Vector2i((rect.position / BUCKET_SIZE).floor())
	var high: Vector2i = Vector2i((rect.end / BUCKET_SIZE).floor())
	for x: int in range(low.x, high.x + 1):
		for z: int in range(low.y, high.y + 1):
			var key := Vector2i(x, z)
			if not buckets.has(key):
				buckets[key] = PackedInt32Array()
			buckets[key].append(id)

func get_walkable_ground_height(world_xz: Vector2) -> float:
	var key: Vector2i = Vector2i((world_xz / BUCKET_SIZE).floor())
	var highest: float = -INF
	for index: int in buckets.get(key, PackedInt32Array()):
		var triangle: Dictionary = triangles[index]
		if not triangle.bounds.has_point(world_xz):
			continue
		var a: Vector3 = triangle.a
		var ab: Vector3 = triangle.ab
		var ac: Vector3 = triangle.ac
		var offset := world_xz - Vector2(a.x, a.z)
		var u: float = (offset.x * ac.z - offset.y * ac.x) * triangle.inverse
		var v: float = (ab.x * offset.y - ab.z * offset.x) * triangle.inverse
		if u >= -0.00001 and v >= -0.00001 and u + v <= 1.00001:
			highest = maxf(highest, a.y + u * ab.y + v * ac.y)
	return highest if is_finite(highest) else NAN

func project(point: Vector3) -> Vector3:
	var height := get_walkable_ground_height(Vector2(point.x, point.z))
	return Vector3(point.x, height, point.z) if is_finite(height) else Vector3.INF
