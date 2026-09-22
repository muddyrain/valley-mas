extends "res://tests/expedition_minimap.gd"
## Read-only render contract for Medium Town building layering and duplication.

var audit_failures: Array[String] = []
var audit_checks: int = 0

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
			audit_check(_mesh_descendant_count(child) > 0, "Building wrapper has visual mesh content: %s" % id)
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
	print("BUILDING RENDER AUDIT: %d checks, %d failures" % [audit_checks, audit_failures.size()])
	quit(0 if audit_failures.is_empty() else 1)

func _mesh_descendant_count(root_node: Node) -> int:
	var count: int = 0
	for child: Node in root_node.get_children():
		if child is MeshInstance3D:
			count += 1
		count += _mesh_descendant_count(child)
	return count
