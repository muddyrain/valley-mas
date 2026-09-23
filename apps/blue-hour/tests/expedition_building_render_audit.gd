extends "res://tests/expedition_minimap.gd"
## Read-only render contract for Medium Town building layering and duplication.

var audit_failures: Array[String] = []
var audit_checks: int = 0
var building_records: Array[Dictionary] = []

func audit_check(value: bool, message: String) -> void:
	audit_checks += 1
	if not value:
		audit_failures.append(message)
		push_error(message)

func run() -> void:
	var app: Node = await create_app(4101)
	var mission: Node3D = app.mission
	var city: Node3D = mission.city
	var buildings: Node3D = city.get_node_or_null("Buildings") as Node3D
	audit_check(buildings != null, "Medium Town exposes a single Buildings root")
	if buildings != null:
		var ids: Dictionary = {}
		for child: Node in buildings.get_children():
			var id: String = str(child.name)
			audit_check(not ids.has(id), "Building wrapper names are unique: %s" % id)
			ids[id] = true
			audit_check(child.get_meta("parcel_id", "") == id, "Building wrapper carries its parcel identity: %s" % id)
			var visuals: Array[Dictionary] = []
			_collect_visuals(child, visuals)
			audit_check(not visuals.is_empty(), "Building wrapper has visual mesh content: %s" % id)
			var record: Dictionary = {"id": id, "wrapper_position": var_to_str((child as Node3D).global_position),
				"wrapper_visible": child.is_visible_in_tree(), "mesh_instances": visuals.size(), "visuals": visuals}
			building_records.append(record)
			print("[BUILDING_RENDER] %s" % JSON.stringify(record))
		var entries: Array = mission.runtime_data.get("building_entries", [])
		audit_check(buildings.get_child_count() == entries.size(), "One visual wrapper exists per runtime building entry")
	for prefix: String in ["Foundation_", "Entrance_"]:
		var count: int = 0
		for child: Node in city.get_children():
			if child.name.begins_with(prefix):
				count += 1
				audit_check(child is MeshInstance3D, "%s nodes are MeshInstance3D" % prefix)
				var y: float = (child as Node3D).position.y
				if prefix == "Foundation_":
					audit_check(is_equal_approx(y, -0.005), "Foundation layer stays below buildings")
				else:
					audit_check(is_equal_approx(y, 0.015), "Entrance layer stays above foundation")
		audit_check(count == mission.runtime_data.get("building_entries", []).size(), "%s layer covers every building" % prefix)
	var sun: DirectionalLight3D = mission.atmosphere.sun
	audit_check(sun.shadow_enabled, "Directional shadow remains enabled")
	audit_check(sun.shadow_normal_bias >= 2.0, "Shadow normal bias covers thin ground layers")
	audit_check(int(ProjectSettings.get_setting("rendering/anti_aliasing/quality/msaa_3d", 0)) == 3, "3D MSAA remains enabled")
	app.queue_free()
	await process_frame
	var output_directory: String = "res://test-output/minimap-marker-rendering-v2"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_directory))
	var output: FileAccess = FileAccess.open(ProjectSettings.globalize_path(output_directory.path_join("building-render-audit.json")), FileAccess.WRITE)
	output.store_string(JSON.stringify({"checks": audit_checks, "failures": audit_failures, "buildings": building_records}, "\t"))
	print("BUILDING RENDER AUDIT: %d checks, %d failures" % [audit_checks, audit_failures.size()])
	quit(0 if audit_failures.is_empty() else 1)

func _collect_visuals(root_node: Node, visuals: Array[Dictionary]) -> void:
	for child: Node in root_node.get_children():
		if child is MeshInstance3D:
			var instance: MeshInstance3D = child as MeshInstance3D
			var mesh_name: String = instance.mesh.resource_path if not instance.mesh.resource_path.is_empty() else instance.mesh.resource_name
			var materials: Array[String] = []
			for surface_index: int in instance.mesh.get_surface_count():
				var material: Material = instance.get_active_material(surface_index)
				if material == null:
					materials.append("<none>")
				else:
					var material_name: String = material.resource_path if not material.resource_path.is_empty() else material.resource_name
					materials.append(material_name if not material_name.is_empty() else material.get_class())
			visuals.append({"node": str(root_node.get_path_to(instance)), "mesh": mesh_name,
				"position": var_to_str(instance.global_position), "materials": materials,
				"visible": instance.is_visible_in_tree(), "cast_shadow": instance.cast_shadow})
		_collect_visuals(child, visuals)
