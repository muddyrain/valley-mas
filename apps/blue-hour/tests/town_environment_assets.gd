extends SceneTree

const Catalog = preload("res://data/world_asset_catalog.gd")
const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
var output: String = "res://test-output/medium-town-environment-m00"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var street_life := OS.get_cmdline_user_args().has("--street-life")
	if street_life:
		output = "res://test-output/medium-town-environment-m01"
	var audit: Array[Dictionary] = []
	var failures: Array[String] = []
	for definition: Resource in Catalog.ALL:
		if String(definition.id).begins_with("BLD_"):
			continue
		if not street_life and not preload("res://maps/town/environment/town_environment_rules.gd").COUNTS.has(definition.id):
			continue
		var instance: Node3D = definition.scene.instantiate()
		root.add_child(instance)
		var mesh := Geometry.bounds(instance)
		var collision := Geometry.bounds(instance, true)
		var simple: bool = true
		for shape: CollisionShape3D in instance.find_children("*", "CollisionShape3D", true, false):
			simple = simple and shape.shape != null and not shape.shape is ConcavePolygonShape3D
		var valid: bool = instance.transform == Transform3D.IDENTITY and absf(mesh.position.y) < 0.05 and mesh.size.distance_to(definition.bounding_size) < 0.2 and collision.size.length() > 0 and simple
		if preload("res://maps/town/environment/town_reuse_rules.gd").COUNTS.has(definition.id):
			var active_shapes := instance.find_children("*", "CollisionShape3D", true, false).filter(func(shape: CollisionShape3D) -> bool: return not shape.disabled)
			valid = valid and not definition.searchable and instance.get("asset_id") == definition.id and instance.has_node("Anchors/FrontMarker") and active_shapes.size() == 1
			var second: Node3D = definition.scene.instantiate()
			var meshes := instance.find_children("*", "MeshInstance3D", true, false)
			var copies := second.find_children("*", "MeshInstance3D", true, false)
			for index: int in meshes.size():
				valid = valid and meshes[index].mesh == copies[index].mesh
				for surface: int in meshes[index].mesh.get_surface_count():
					var material: Material = meshes[index].get_active_material(surface)
					valid = valid and material == copies[index].get_active_material(surface)
					if material is BaseMaterial3D and material.albedo_texture != null:
						valid = valid and material.albedo_texture.get_width() > 0 and material.albedo_texture.get_height() > 0
			second.free()
		if not valid:
			failures.append(definition.id)
		audit.append({"id": definition.id, "scene": definition.scene.resource_path, "identity_root": instance.transform == Transform3D.IDENTITY, "mesh_bounds": var_to_str(mesh), "collision_bounds": var_to_str(collision), "ground_pivot": absf(mesh.position.y) < 0.05, "simple_collision": simple, "catalog_dimensions_match": mesh.size.distance_to(definition.bounding_size) < 0.2, "local_road_anchor": var_to_str(instance.get_node("Anchors/RoadAnchor").position), "safe_instance": valid})
		instance.free()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output))
	FileAccess.open(output.path_join("asset-audit.json"), FileAccess.WRITE).store_string(JSON.stringify({"assets": audit, "failures": failures}, "\t"))
	print("ENVIRONMENT ASSETS: %d audited, %d failures" % [audit.size(), failures.size()])
	quit(0 if failures.is_empty() else 1)
