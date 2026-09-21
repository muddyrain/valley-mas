extends "res://tests/camp_departure.gd"

## Spatial contract for the authored berth; samples actual physics and baked navigation.
func run() -> void:
	create_timer(60).timeout.connect(func(): printerr("BERTH LAYOUT TIMEOUT"); quit(2))
	root.size = Vector2i(1920, 1080)
	root.unfocusable = true
	root.add_child(InputGate.new())
	await launch(true)
	app.save_path = "user://test-runs/camp-departure-layout.json"
	app.store = load("res://core/save_store.gd").new(app.save_path)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing", "lin_jianyue", "lu_qinghe"])
	app.show_shelter()
	await frames(20)
	var camp: Node3D = app.camp_view.camp
	var camp_identity := camp.get_instance_id()
	var car: Node3D = camp.get_node("NavigationSource/BlueHourBerth")
	var pad: MeshInstance3D = camp.get_node("NavigationSource/BerthDriveway")
	var path: Path3D = camp.get_node("DeparturePath")
	var entry: Marker3D = car.get_node("VehicleEntryPoint")
	var nav: RID = camp.get_node("NavigationRegion3D").get_navigation_map()
	check(car.rotation.is_zero_approx() and pad.rotation.is_zero_approx(), "Vehicle and hardstand face the road squarely")
	check(is_equal_approx(car.position.x, pad.position.x), "Vehicle sits on the driveway centerline")
	check(path.curve.get_point_position(0).is_equal_approx(car.position), "Departure curve starts at the exact parked position")
	check(path.curve.get_point_out(0).normalized().dot(car.basis.z) > 0.999, "Departure tangent matches the vehicle nose without a snap")
	check(pad.position.z + pad.mesh.size.z / 2.0 >= 9.0, "Hardstand reaches the main road edge")
	check(entry.position == Vector3(1.65, 0, 1.25), "Original side door marker is preserved in vehicle space")
	var assembly: Array[Vector3] = []
	for marker: Marker3D in camp.get_node("PartyAssembly").get_children():
		assembly.append(marker.global_position)
		check(marker.position.x > car.position.x + 2.0, "Assembly stays clear of the vehicle lane")
		var closest := NavigationServer3D.map_get_closest_point(nav, marker.global_position)
		check(Vector2(closest.x, closest.z).distance_to(Vector2(marker.position.x, marker.position.z)) < 0.2, "Assembly slot lies on baked walkable ground")
	for i: int in range(assembly.size()):
		for j: int in range(i + 1, assembly.size()):
			check(assembly[i].distance_to(assembly[j]) >= 1.1, "Four survivors have separate gathering space")
		var route := NavigationServer3D.map_get_path(nav, assembly[i], entry.global_position, true)
		check(route.size() >= 2 and Vector2(route[-1].x, route[-1].z).distance_to(Vector2(entry.global_position.x, entry.global_position.z)) < 0.2, "Every assembly slot can reach the side door")
	var original := car.transform
	var clear := true
	var road: Node3D = camp.get_node("NavigationSource/Road")
	var distance := 0.0
	while distance <= path.curve.get_baked_length():
		car.transform = path.curve.sample_baked_with_rotation(distance, true, false)
		car.rotate_object_local(Vector3.UP, PI)
		await physics_frame
		clear = clear and vehicle_clear(car)
		if car.position.x > 0.0:
			check(absf(car.position.z - road.position.z) < 0.02, "Vehicle follows the road center after the turn")
		distance += 0.5
	check(clear, "Entire vehicle swept along the departure curve clears static collision")
	car.transform = original
	await frames(4)
	await click_at(app.camp_view.interactable_point("blue_hour"))
	check(app.camp_ui.active_interactable != null and app.camp_ui.active_interactable.id == "blue_hour", "Aligned vehicle opens the correct departure interaction")
	await key(KEY_ESCAPE)
	# Arrival is the existing result-to-camp reconstruction, not a new driving animation.
	app.show_shelter()
	await stage_return(8)
	await click(button("确认结算"))
	check(app.state == "shelter", "A completed action returns through the normal settlement flow")
	var returned: Node3D = app.camp_view.camp
	check(returned.get_instance_id() != camp_identity, "Return reconstructs the authored camp")
	var returned_car: Node3D = returned.get_node("NavigationSource/BlueHourBerth")
	check(returned_car.transform.is_equal_approx(original), "Return restores the vehicle to the aligned berth")
	check(returned.departure.stage == returned.departure.Stage.IDLE, "Returned vehicle is ready for another departure")
	DirAccess.make_dir_recursive_absolute("res://test-output/camp-visual-polish-02")
	FileAccess.open("res://test-output/camp-visual-polish-02/layout-validation.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("CAMP DEPARTURE LAYOUT: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
