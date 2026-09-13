extends SceneTree

## Validates Camp V1.3 structure, navigation, collisions, framing, and native rendering.

const CAMP_SCENE_PATH := "res://scenes/camp/camp_main.tscn"
const CAPTURE_PATH := "res://test-output/camp/camp-v1-3-16x9.png"
const REPORT_PATH := "res://test-output/camp/camp-v1-3-runtime.json"
const EXPECTED_VIEWPORT := Vector2i(1280, 720)
const PATH_CHECKS: Array[Array] = [
	[Vector3(0, 0, -3.5), Vector3(0, 0, 0.2)],
	[Vector3(0, 0, 0.2), Vector3(-4.7, 0, -2.1)],
	[Vector3(0, 0, 0.2), Vector3(4.8, 0, -1.5)],
	[Vector3(0, 0, 0.2), Vector3(-3.95, 0, 1.0)],
	[Vector3(-3.95, 0, 1.0), Vector3(-3.0, 0, 3.5)],
	[Vector3(-4.7, 0, -2.1), Vector3(4.8, 0, -1.5)],
	[Vector3(-4.7, 0, -2.1), Vector3(-3.95, 0, 1.0)],
	[Vector3(-1.8, 0, 1.65), Vector3(3.8, 0, 1.65)],
	[Vector3(-3.0, 0, 3.5), Vector3(-3.0, 0, 8.0)],
]

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	create_timer(30.0).timeout.connect(_on_timeout)
	root.content_scale_size = EXPECTED_VIEWPORT
	root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_IGNORE
	root.size = EXPECTED_VIEWPORT
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://test-output/camp"))

	var packed_scene := load(CAMP_SCENE_PATH) as PackedScene
	_check(packed_scene != null, "Camp scene loads")
	if packed_scene == null:
		_finish()
		return

	var camp := packed_scene.instantiate() as Node3D
	root.add_child(camp)
	await _frames(8)

	_check(camp.get_meta("layout_version") == "1.3", "Existing Camp scene is marked as layout V1.3")
	_check(root.size == EXPECTED_VIEWPORT, "Viewport is 16:9 at 1280x720")
	var camera := camp.get_node("CameraRig/PitchPivot/Camera3D") as Camera3D
	var pitch_pivot := camera.get_parent_node_3d()
	var camera_rig := pitch_pivot.get_parent_node_3d()
	_check(camera.projection == Camera3D.PROJECTION_ORTHOGONAL, "Camera is orthographic")
	_check(is_equal_approx(rad_to_deg(pitch_pivot.rotation.x), -46.0), "Camera pitch is 46 degrees")
	_check(is_equal_approx(rad_to_deg(camera_rig.rotation.y), 12.0), "Camera yaw is 12 degrees")
	_check(is_equal_approx(camera.size, 18.8), "Orthographic framing uses the Pass 02 gameplay scale")
	_check(camera_rig.position.is_equal_approx(Vector3(0, 0, -1.15)), "Camera framing preserves station headroom and favors the camp")
	var character_scale_ratio := (
		cos(deg_to_rad(46.0)) / camera.size
		/ (cos(deg_to_rad(48.0)) / 20.5)
	)
	_check(character_scale_ratio >= 1.10 and character_scale_ratio <= 1.16, "Projected character height increases 10-16 percent from Pass 01")
	_check(camera.current, "Camp camera is fixed as the current camera")

	var terrain_mesh_instance := camp.get_node("NavigationSource/TerrainBase/MeshInstance3D") as MeshInstance3D
	var terrain_mesh := terrain_mesh_instance.mesh as BoxMesh
	_check(Vector2(terrain_mesh.size.x, terrain_mesh.size.z).is_equal_approx(Vector2(24, 18)), "Camp activity footprint remains 24x18m")
	var road_mesh_instance := camp.get_node("NavigationSource/Road/MeshInstance3D") as MeshInstance3D
	var road_mesh := road_mesh_instance.mesh as BoxMesh
	_check(Vector2(road_mesh.size.x, road_mesh.size.z).is_equal_approx(Vector2(42, 5.5)), "Road runs across the lower edge at 5.5m wide")
	_check(camp.has_node("NavigationSource/BerthDriveway"), "Vehicle berth has a dedicated driveway connected to the road")

	var main_building := camp.get_node("NavigationSource/MainBuilding") as Node3D
	var workshop := camp.get_node("NavigationSource/Workshop") as Node3D
	var greenhouse := camp.get_node("NavigationSource/Greenhouse") as Node3D
	_check(main_building.position.is_equal_approx(Vector3(0, 0, -6.75)), "Main building remains at its frozen V1.2 position")
	_check(workshop.position.is_equal_approx(Vector3(-7.7, 0, -4.4)), "Workshop remains at its frozen V1.2 position")
	_check(greenhouse.position.is_equal_approx(Vector3(7.45, 0, -3.25)), "Greenhouse remains at its frozen V1.2 position")
	_check(main_building.get_meta("blockout_size") == Vector3(12, 3.8, 4.5), "Main building matches 12x4.5x3.8m")
	_check(workshop.get_meta("blockout_footprint") == Vector2(5, 3.5), "Workshop footprint matches 5x3.5m")
	_check(greenhouse.get_meta("blockout_footprint") == Vector2(4, 3), "Greenhouse footprint matches 4x3m")
	_check(main_building.has_node("Visual/Model"), "Main building uses the official station model")
	_check(main_building.has_node("EntrancePoint"), "Main building preserves a clear entrance approach")
	var station_bounds := _local_bounds(main_building)
	_check(station_bounds.size.distance_to(Vector3(12, 4.17005, 6.7043)) < 0.01, "Official station measured bounds include antennas and entrance steps")
	_check(absf(station_bounds.position.y) < 0.001, "Station meets visible ground")
	_check(main_building.scale.is_equal_approx(Vector3.ONE) and main_building.rotation.is_equal_approx(Vector3.ZERO), "Station root preserves the frozen identity basis")
	_check(main_building.get_node("Visual").scale.is_equal_approx(Vector3.ONE * 1.097386), "Only station Visual applies a small uniform scale")
	var station_collisions := main_building.find_children("*", "CollisionShape3D", true, false).filter(func(shape: CollisionShape3D): return shape.get_parent() is PhysicsBody3D)
	_check(station_collisions.size() == 3 and station_collisions.all(func(shape: CollisionShape3D): return shape.shape is BoxShape3D), "Station collision uses three simple boxes")
	var picking: Area3D = main_building.get_node("CampInteractable").get_child(0)
	_check(picking.collision_layer == 8 and picking.collision_mask == 0, "Facility picking stays separate from physical collision")
	print("STATION MEASURED: ", station_bounds)
	_check(camp.has_node("NavigationSource/MainForecourt"), "Main building entrance opens onto a readable forecourt")
	_check(workshop.has_node("LeanToRoof") and workshop.has_node("RepairBench"), "Workshop reads as an attached open repair bay")
	_check(
		workshop.position.x + 2.5 > main_building.position.x - 6.0
		and workshop.position.z - 1.75 < main_building.position.z + 2.25,
		"Workshop footprint overlaps the main-building service edge",
	)
	_check(greenhouse.has_node("RoofLeft") and greenhouse.has_node("RoofRight") and greenhouse.has_node("PlanterLeft") and greenhouse.has_node("PlanterRight"), "Greenhouse preserves its pitched roof and planting-bed anchors")
	_check(
		greenhouse.position.x - 2.0 < main_building.position.x + 6.0
		and greenhouse.position.z - 1.5 < main_building.position.z + 2.25,
		"Greenhouse footprint overlaps the main-building garden edge",
	)
	var central_area := camp.get_node("NavigationSource/CentralLivingArea") as Node3D
	_check(central_area.get_meta("activity_size") == Vector2(8, 6), "Central living area reserves 8x6m")
	_check(central_area.has_node("TestTable"), "Central living area has one table")
	_check(central_area.has_node("TestChair01") and central_area.has_node("TestChair02"), "Central living area has two seats")
	_check(central_area.has_node("CrateSeat01") and central_area.has_node("CrateSeat02"), "Central living area has two crate seats")
	_check(central_area.has_node("FirepitPosition"), "Central living area has a firepit position")
	_check(central_area.has_node("Clutter01") and central_area.has_node("Clutter02"), "Central living area has restrained clutter placeholders")

	var characters := get_nodes_in_group("camp_scale_character")
	_check(characters.size() == 4, "Four native character models are present")
	for character: Node in characters:
		var character_3d := character as Node3D
		_check(character_3d.scale.is_equal_approx(Vector3.ONE), "%s retains native scale" % character.name)
		_check(character_3d.scene_file_path.ends_with(".glb"), "%s is a real project GLB instance" % character.name)

	var bus := camp.get_node("NavigationSource/BlueHourBerth") as Node3D
	_check(bus.scale.is_equal_approx(Vector3.ONE), "Blue Hour vehicle is instanced at native scale")
	var bus_yaw_degrees := absf(rad_to_deg(bus.rotation.y))
	_check(bus_yaw_degrees < 0.01, "Blue Hour vehicle faces the main road squarely")
	_check(bus.position.is_equal_approx(Vector3(-7.15, 0, 2.8)), "Blue Hour vehicle uses the aligned departure berth")
	_check(not bus.find_children("*", "CollisionObject3D", true, false).is_empty(), "Blue Hour vehicle has imported collision")
	for node_path: String in [
		"NavigationSource/MainBuilding/StaticBody3D/CollisionShape3D",
		"NavigationSource/Workshop/StaticBody3D/BackCollision",
		"NavigationSource/Workshop/StaticBody3D/WorkbenchCollision",
		"NavigationSource/Greenhouse/StaticBody3D/CollisionShape3D",
		"NavigationSource/CentralLivingArea/TestTable/StaticBody3D/CollisionShape3D",
		"NavigationSource/BoundaryBlockouts/RightMiddle/CollisionShape3D",
	]:
		_check(camp.get_node(node_path) is CollisionShape3D, "%s has blockout collision" % node_path)

	for index: int in range(1, 5):
		var party_point := camp.get_node("PartyAssembly/PartyPoint%02d" % index) as Marker3D
		_check(party_point != null, "PartyPoint%02d exists" % index)
		_check(party_point.position.x > bus.position.x, "PartyPoint%02d is in the clear assembly area right of the vehicle" % index)
	for slot_name: String in ["FacilitySlot_A", "FacilitySlot_B", "FacilitySlot_C"]:
		_check(camp.get_node("ExpansionSlots/" + slot_name) is Marker3D, slot_name + " exists without visuals")
	var decoration_placeholders := camp.get_node("DecorationPlaceholders") as Node3D
	_check(decoration_placeholders.get_child_count() == 3, "Right-front density test uses only three decoration placeholders")
	_check(
		decoration_placeholders.find_children("*", "CollisionObject3D", true, false).is_empty(),
		"Decoration placeholders have no collision or gameplay behavior",
	)
	for placeholder: Node in decoration_placeholders.get_children():
		_check(placeholder.name.begins_with("DecorationPlaceholder"), "%s is explicitly disposable whitebox decoration" % placeholder.name)
		var placeholder_3d := placeholder as Node3D
		for index: int in range(1, 5):
			var party_point := camp.get_node("PartyAssembly/PartyPoint%02d" % index) as Marker3D
			_check(placeholder_3d.position.distance_to(party_point.position) > 2.0, "%s stays clear of PartyPoint%02d" % [placeholder.name, index])
		for slot_name: String in ["FacilitySlot_A", "FacilitySlot_B", "FacilitySlot_C"]:
			var facility_slot := camp.get_node("ExpansionSlots/" + slot_name) as Marker3D
			_check(placeholder_3d.position.distance_to(facility_slot.position) > 1.2, "%s stays clear of %s" % [placeholder.name, slot_name])
	var camp_scene_files: PackedStringArray = DirAccess.get_files_at("res://scenes/camp")
	var tscn_count := 0
	for file_name: String in camp_scene_files:
		if file_name.ends_with(".tscn"):
			tscn_count += 1
	_check(tscn_count == 1, "No duplicate Camp layout scene was created")

	var region := camp.get_node("NavigationRegion3D") as NavigationRegion3D
	var navigation_mesh := region.navigation_mesh
	_check(navigation_mesh != null and navigation_mesh.get_polygon_count() > 0, "NavigationRegion3D has baked navigation")
	_check(navigation_mesh.geometry_parsed_geometry_type == NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS, "Navigation uses simple static collision geometry")
	await _frames(4)
	var navigation_map := region.get_navigation_map()
	for pair: Array in PATH_CHECKS:
		var path := NavigationServer3D.map_get_path(navigation_map, pair[0], pair[1], true)
		_check(path.size() >= 2, "Navigation path exists from %s to %s" % [pair[0], pair[1]])

	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	_check(
		image.get_size() == EXPECTED_VIEWPORT,
		"Captured image is 1280x720 (actual %s)" % image.get_size(),
	)
	_check(image.save_png(CAPTURE_PATH) == OK, "Camp acceptance image was saved")
	_finish()


func _frames(count: int) -> void:
	for _index: int in range(count):
		await process_frame

func _local_bounds(node: Node3D) -> AABB:
	var result := AABB()
	var first := true
	for mesh: MeshInstance3D in node.find_children("*", "MeshInstance3D", true, false):
		var bounds := node.global_transform.affine_inverse() * mesh.global_transform * mesh.get_aabb()
		result = bounds if first else result.merge(bounds)
		first = false
	return result


func _check(value: bool, message: String) -> void:
	_checks += 1
	if value:
		return
	_failures.append(message)
	push_error(message)


func _finish() -> void:
	var report := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if report != null:
		report.store_string(
			JSON.stringify(
				{
					"checks": _checks,
					"failures": _failures,
					"capture": CAPTURE_PATH,
					"engine": Engine.get_version_info().string,
					"renderer": RenderingServer.get_current_rendering_method(),
					"viewport": [root.size.x, root.size.y],
				},
				"\t",
			)
		)
	print("CAMP RUNTIME: %d checks, %d failures" % [_checks, _failures.size()])
	quit(0 if _failures.is_empty() else 1)


func _on_timeout() -> void:
	printerr("CAMP RUNTIME TIMEOUT")
	quit(2)
