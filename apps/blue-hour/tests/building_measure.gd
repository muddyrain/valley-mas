extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var rows: Array[Dictionary] = []
	for d: Resource in preload("res://data/world_asset_catalog.gd").ALL:
		if not d.id.begins_with("BLD_"):
			continue
		var instance: Node3D = d.scene.instantiate()
		root.add_child(instance)
		var bounds := AABB()
		var first := true
		for mesh: MeshInstance3D in instance.get_node("ModelRoot").find_children("*", "MeshInstance3D", true, false):
			var box: AABB = instance.global_transform.affine_inverse() * mesh.global_transform * mesh.get_aabb()
			bounds = box if first else bounds.merge(box)
			first = false
		rows.append({"id": d.id, "min": [bounds.position.x, bounds.position.y, bounds.position.z], "size": [bounds.size.x, bounds.size.y, bounds.size.z], "scene": d.scene.resource_path, "definition": d.resource_path})
		instance.free()
	DirAccess.make_dir_recursive_absolute("res://test-output/random-map")
	FileAccess.open("res://test-output/random-map/measured.json", FileAccess.WRITE).store_string(JSON.stringify(rows, "\t"))
	print(JSON.stringify(rows))
	quit()
