extends SceneTree
# Actual Godot import validation; runs after each batch, before continuing.
var failures: Array[String] = []
var checked := 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	var manifest = JSON.parse_string(FileAccess.get_file_as_string("res://assets/generated/manifest.json"))
	check(manifest is Dictionary and manifest.has("assets"), "Asset manifest available")
	if not manifest is Dictionary:
		quit(1)
		return
	var batch := ""
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--batch="):
			batch = argument.trim_prefix("--batch=")
	for id in manifest.assets:
		var spec: Dictionary = manifest.assets[id]
		if not batch.is_empty() and spec.batch != batch:
			continue
		checked += 1
		var resource = load("res://" + spec.path)
		check(resource is PackedScene, id + " imported PackedScene")
		if not resource is PackedScene:
			continue
		var instance: Node3D = resource.instantiate()
		root.add_child(instance)
		var meshes := instance.find_children("*", "MeshInstance3D", true, false)
		var shapes := instance.find_children("*", "CollisionShape3D", true, false)
		check(not meshes.is_empty(), id + " has render mesh")
		check(shapes.size() == int(spec.collision_proxies), id + " imports all collision proxies")
		for shape in shapes:
			check(shape.shape is ConvexPolygonShape3D or shape.shape is BoxShape3D, id + " uses simple convex collision")
			if shape.shape is ConvexPolygonShape3D:
				check(shape.shape.points.size() <= 8, id + " proxy has at most eight corners")
		var bounds := AABB()
		var first := true
		for view in meshes:
			check(not String(view.name).contains("COL_"), id + " proxy is not rendered")
			var local_bounds: AABB = view.global_transform * view.get_aabb()
			bounds = local_bounds if first else bounds.merge(local_bounds)
			first = false
			for surface in range(view.mesh.get_surface_count()):
				var mat = view.get_active_material(surface)
				check(mat != null and mat.resource_name in spec.materials, id + " shared named material")
		var expected := Vector3(spec.dimensions[0], spec.dimensions[1], spec.dimensions[2])
		check(bounds.size.distance_to(expected) < .015, id + " Godot meter dimensions match GLB")
		instance.free()
	check(checked > 0, "At least one asset checked")
	print("GODOT ART ASSETS: %d assets, %d failures" % [checked, failures.size()])
	quit(0 if failures.is_empty() else 1)
