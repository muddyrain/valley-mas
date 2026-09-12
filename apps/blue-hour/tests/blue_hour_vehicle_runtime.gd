extends SceneTree
## Native render and physical acceptance for the single formal vehicle asset.

const WRAPPER := "res://scenes/world/vehicles/veh_blue_hour.tscn"
const OUTPUT := "res://test-output/blue-hour-vehicle/"
const VIEWPORT := Vector2i(1280, 720)

var _failures: Array[String] = []
var _checks := 0
var _measurements: Dictionary = {}


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	create_timer(45.0).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.content_scale_size = VIEWPORT
	root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_IGNORE
	root.size = VIEWPORT
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var camp: Node3D = load("res://scenes/camp/camp_main.tscn").instantiate()
	root.add_child(camp)
	await _frames(12)
	var vehicle := camp.get_node("NavigationSource/BlueHourBerth") as Node3D
	_check(vehicle.scene_file_path == WRAPPER, "Camp uses the formal wrapper")
	_check(vehicle.position.is_equal_approx(Vector3(-6.9, 0, 3.05)), "Frozen Camp berth is unchanged")
	_check(is_equal_approx(vehicle.rotation.y, -0.174533), "Frozen Camp vehicle yaw is unchanged")
	var bounds := _bounds(vehicle)
	_check(bounds.size.distance_to(Vector3(2.289688, 2.75, 5.264315)) < .002, "Native source dimensions are preserved")
	_check(absf(bounds.position.y) < .002, "Tires meet the ground")
	_check(absf(bounds.get_center().x) < .002 and absf(bounds.get_center().z) < .002, "Pivot is centered on the ground footprint")
	for node: Node3D in [vehicle, vehicle.get_node("Visual"), vehicle.get_node("Visual/Model")]:
		_check(node.scale.is_equal_approx(Vector3.ONE), "%s has unit scale" % node.name)
	_check(vehicle.find_children("*", "MeshInstance3D", true, false).size() == 1, "No old render meshes remain in the vehicle")
	var visual := vehicle.get_node("Visual") as Node3D
	_check((visual.basis * Vector3.LEFT).is_equal_approx(Vector3.BACK), "Source -X nose faces project +Z")
	var shape := vehicle.get_node("Collision/CollisionShape3D") as CollisionShape3D
	_check(shape.shape is BoxShape3D, "Collision uses a simple Box, never render triangles")
	_check(vehicle.find_children("*", "CollisionShape3D", true, false).size() == 1, "Vehicle owns exactly one collision")
	await physics_frame
	await physics_frame
	var state := camp.get_world_3d().direct_space_state
	for axis: Vector3 in [Vector3.RIGHT, Vector3.LEFT, Vector3.FORWARD, Vector3.BACK]:
		var start: Vector3 = vehicle.to_global(axis * 3.0 + Vector3.UP)
		var end: Vector3 = vehicle.to_global(Vector3.UP)
		var hit := state.intersect_ray(PhysicsRayQueryParameters3D.create(start, end, 1))
		_check(not hit.is_empty() and hit.collider == shape.get_parent(), "Vehicle stops a body-height ray from %s" % axis)
	var entry := vehicle.get_node("VehicleEntryPoint") as Marker3D
	var entry_ray := PhysicsRayQueryParameters3D.create(entry.global_position + Vector3.UP * 2, entry.global_position + Vector3.UP * .2, 1)
	_check(state.intersect_ray(entry_ray).is_empty(), "Passenger entry side is physically clear")
	var character_heights: Dictionary = {}
	for actor: Node in get_nodes_in_group("camp_scale_character"):
		var height: float = _bounds(actor as Node3D).size.y
		character_heights[actor.name] = height
		_check(height > 1.4 and height < 2.0, "Real Camp character has human scale: %s" % actor.name)
		_check(bounds.size.y / height > 1.35 and bounds.size.y / height < 1.95, "Vehicle/character height ratio is plausible: %s" % actor.name)
	_measurements = {"vehicle_xyz_m": [bounds.size.x, bounds.size.y, bounds.size.z], "ground_y": bounds.position.y,
		"root_scale": vehicle.scale, "visual_scale": visual.scale, "visual_yaw_degrees": visual.rotation_degrees.y,
		"collision_xyz_m": shape.shape.size, "character_heights_m": character_heights,
		"main_building_xyz_m": camp.get_node("NavigationSource/MainBuilding").get_meta("blockout_size"),
		"workshop_footprint_m": camp.get_node("NavigationSource/Workshop").get_meta("blockout_footprint")}
	await _capture("camp-16x9")
	camp.free()
	await _frames(3)
	var app: Node = load("res://core/main.tscn").instantiate()
	app.save_path = "user://test-runs/blue-hour-vehicle-%d.json" % Time.get_ticks_usec()
	app.fresh_test_run = true
	root.add_child(app)
	await _frames(12)
	var shelter_vehicles := get_nodes_in_group("blue_hour_vehicle")
	_check(shelter_vehicles.size() == 1 and shelter_vehicles[0].scene_file_path == WRAPPER, "Production shelter uses the same wrapper")
	app.start_mission()
	await _frames(12)
	app.mission.set_physics_process(false)
	var city: Node3D = app.mission.city
	var expedition_vehicle := city.get_node("BlueHourVehicle") as Node3D
	_check(expedition_vehicle.scene_file_path == WRAPPER, "Production expedition uses the same wrapper")
	_check(_bounds(expedition_vehicle).size.distance_to(bounds.size) < .002, "Camp and expedition share the same dimensions")
	_check(expedition_vehicle.find_children("*", "CollisionShape3D", true, false).size() == 1, "Expedition retains the shared simple collision")
	_check(not city.grid.is_point_solid(city.cell_at(app.catalog.map.bus_position)), "Existing boarding area remains navigable")
	_check(city.bus_door is Marker3D and not city.bus_door.get_meta("visual_animation_available"), "Extraction keeps its timing target and declares missing door animation")
	await _capture("expedition-16x9")
	app.free()
	await _frames(3)
	var report := {"checks": _checks, "failures": _failures, "measurements": _measurements,
		"engine": Engine.get_version_info().string, "renderer": RenderingServer.get_current_rendering_method(),
		"viewport": [VIEWPORT.x, VIEWPORT.y], "evidence": "Native Godot rendered viewport and physics; isolated test save"}
	FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("BLUE HOUR VEHICLE: %d checks, %d failures" % [_checks, _failures.size()])
	quit(0 if _failures.is_empty() else 1)


func _bounds(node: Node3D) -> AABB:
	var result := AABB()
	var first := true
	for mesh: MeshInstance3D in node.find_children("*", "MeshInstance3D", true, false):
		var local := node.global_transform.affine_inverse() * mesh.global_transform * mesh.get_aabb()
		result = local if first else result.merge(local)
		first = false
	return result


func _frames(count: int) -> void:
	for index: int in range(count):
		await process_frame


func _capture(name: String) -> void:
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	_check(image.get_size() == VIEWPORT, name + " is actual 16:9")
	_check(image.save_png(OUTPUT + name + ".png") == OK, name + " captured")


func _check(value: bool, message: String) -> void:
	_checks += 1
	if not value:
		_failures.append(message)
		push_error(message)
