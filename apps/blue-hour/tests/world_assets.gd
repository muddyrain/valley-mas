extends SceneTree
const Assets = preload("res://data/world_asset_catalog.gd")
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures.append(message)
		push_error(message)

func bounds(node: Node3D) -> AABB:
	var result := AABB()
	var initialized: bool = false
	for mesh: MeshInstance3D in node.find_children("*", "MeshInstance3D", true, false):
		var box: AABB = node.global_transform.affine_inverse() * mesh.global_transform * mesh.get_aabb()
		result = result.merge(box) if initialized else box
		initialized = true
	return result

func run() -> void:
	var audit: Array[Dictionary] = []
	for definition: Resource in Assets.ALL:
		var first: Node3D = definition.scene.instantiate()
		root.add_child(first)
		var second: Node3D = definition.scene.instantiate()
		root.add_child(second)
		check(first.transform == Transform3D.IDENTITY, "Wrapper identity transform: " + definition.id)
		var box: AABB = bounds(first)
		check(absf(box.position.y) < .04, "Model rests on ground: " + definition.id)
		check(box.size.distance_to(definition.bounding_size) < .2, "Runtime dimensions match audited metadata: " + definition.id)
		var meshes: Array = first.find_children("*", "MeshInstance3D", true, false)
		var copies: Array = second.find_children("*", "MeshInstance3D", true, false)
		var textures: Array[Dictionary] = []
		for i: int in range(meshes.size()):
			check(meshes[i].mesh == copies[i].mesh, "Repeated objects share mesh resources: " + definition.id)
			for surface: int in range(meshes[i].mesh.get_surface_count()):
				var material: Material = meshes[i].get_active_material(surface)
				check(material == copies[i].get_active_material(surface), "Repeated objects share materials: " + definition.id)
				if material is StandardMaterial3D and material.albedo_texture != null:
					check(material.albedo_texture.get_width() == 2048, "Source texture survives embedded import: " + definition.id)
					textures.append({"type": material.albedo_texture.get_class(), "width": material.albedo_texture.get_width(), "height": material.albedo_texture.get_height()})
		for shape: CollisionShape3D in first.find_children("*", "CollisionShape3D", true, false):
			check(not shape.shape is ConcavePolygonShape3D, "No render trimesh collision: " + definition.id)
		audit.append({"id": definition.id, "runtime_bounds": {"position": var_to_str(box.position), "size": var_to_str(box.size)}, "textures": textures})
		first.free()
		second.free()
	FileAccess.open("res://test-output/world-imported-audit.json", FileAccess.WRITE).store_string(JSON.stringify(audit, "\t"))
	print("WORLD ASSETS: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
