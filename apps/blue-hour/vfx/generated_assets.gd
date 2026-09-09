extends RefCounted
# Visual asset boundary: gameplay never addresses imported mesh internals.
static var scenes: Dictionary = {}
static var materials: Dictionary = {}
static var manifest: Dictionary = {}

static func catalog() -> Dictionary:
	if manifest.is_empty():
		manifest = JSON.parse_string(FileAccess.get_file_as_string("res://assets/generated/manifest.json")).assets
	return manifest

static func spawn(id: String, parent: Node3D, position: Vector3 = Vector3.ZERO, yaw: float = 0.0, collision: bool = false) -> Node3D:
	if not scenes.has(id):
		scenes[id] = load("res://assets/generated/" + id + ".glb")
	var instance: Node3D = scenes[id].instantiate()
	instance.set_meta("art_asset", id)
	# Existing city collision/navigation remains authoritative.
	if not collision:
		for body in instance.find_children("*", "CollisionObject3D", true, false):
			body.free()
	for view in instance.find_children("*", "MeshInstance3D", true, false):
		for surface in range(view.mesh.get_surface_count()):
			var mat: Material = view.get_active_material(surface)
			if not materials.has(mat.resource_name):
				materials[mat.resource_name] = mat
			view.set_surface_override_material(surface, materials[mat.resource_name])
	parent.add_child(instance)
	instance.position = position
	instance.rotation.y = yaw
	return instance

static func fit_site(id: String, parent: Node3D, position: Vector3, footprint: Vector3) -> Node3D:
	var result := spawn(id, parent, position)
	var spec: Dictionary = catalog()[id]
	var native := Vector3(spec.dimensions[0], spec.dimensions[1], spec.dimensions[2])
	# Buildings assemble into the existing lots; vehicles retain their real scale.
	var vehicle: bool = spec.category == "vehicles"
	result.scale = Vector3(footprint.x / native.x, minf(1.0, footprint.y / native.y), footprint.z / native.z)
	if vehicle:
		result.scale.x = minf(result.scale.x, 1.0)
		result.scale.z = minf(result.scale.z, 1.0)
	var center := Vector3((spec.bounds_min[0] + spec.bounds_max[0]) * .5, 0, (spec.bounds_min[2] + spec.bounds_max[2]) * .5)
	result.position -= center * result.scale
	return result

static func collect_lamps(instance: Node3D, target: Array[MeshInstance3D]) -> void:
	for view in instance.find_children("*LightMesh*", "MeshInstance3D", true, false):
		target.append(view)

static func part(instance: Node3D, suffix: String) -> MeshInstance3D:
	for view in instance.find_children("*", "MeshInstance3D", true, false):
		if String(view.name).ends_with(suffix):
			return view
	return null
