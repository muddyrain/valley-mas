extends SceneTree
const City = preload("res://maps/city.gd")
const Catalog = preload("res://data/catalog.gd")
const Assets = preload("res://vfx/generated_assets.gd")
var failures: Array[String] = []
var checks := 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	var catalog := Catalog.new()
	var city := City.new()
	root.add_child(city)
	city.build(catalog.map)
	await physics_frame
	check(city.sites.size() == 22, "Nineteen searchable buildings and three vehicles integrated")
	for spec in catalog.map.buildings + catalog.map.vehicles:
		if not spec.get("searchable", true):
			check(city.buildings.has(spec.id) and not city.sites.has(spec.id), "Decorative building participates in the world without a search target: " + spec.id)
			continue
		check(city.sites.has(spec.id), "Search ID retained: " + spec.id)
		check(city.sites[spec.id].spec == spec, "Search data retained: " + spec.id)
		check(city.sites[spec.id].body.has_meta("world_asset"), "Runtime wrapper visual: " + spec.id)
		check(not city.grid.is_point_solid(city.cell_at(spec.entry)), "Entrance not blocked: " + spec.id)
		var outward: PackedVector3Array = city.path(catalog.map.bus_position, spec.entry)
		var homeward: PackedVector3Array = city.path(spec.entry, catalog.map.bus_position)
		check(not outward.is_empty() and outward[-1].distance_to(spec.entry) < .01, "Exact entrance reachable: " + spec.id)
		check(not homeward.is_empty() and homeward[-1].distance_to(catalog.map.bus_position) < .01, "Return path available: " + spec.id)
		var solid: Vector3 = city.sites[spec.id].body.get_node("Collision/Shape0").global_position
		var ray := PhysicsRayQueryParameters3D.create(solid+Vector3.UP*20, solid-Vector3.UP*20, 1)
		var hit: Dictionary = city.get_world_3d().direct_space_state.intersect_ray(ray)
		check(not hit.is_empty() and hit.collider.get_meta("site_id", "") == spec.id, "Building / vehicle body retains search picking: " + spec.id)
	var vehicle := city.get_node("BlueHourVehicle") as Node3D
	check(vehicle.scene_file_path == "res://scenes/world/vehicles/veh_blue_hour.tscn", "Expedition uses the shared Blue Hour vehicle scene")
	check(city.bus_door is Marker3D, "Fused source mesh preserves the independent door timing target")
	check(vehicle.get_node("Visual/Model").scene_file_path == "res://assets/world/vehicles/VEH_BLUE_HOUR.glb", "Vehicle uses the formal source model")
	check(city.lamps.size() >= 12, "Wrapper lights participate in existing day/night presentation")
	check(city.accent_lights.size() == 4, "Street lighting stays within four shadow-free accents")
	check(is_equal_approx(city.bus_door.position.x + .8, float(city.bus_door.get_meta("closed_x"))), "Door starts open for the existing closing tween")
	for body in city.find_children("*", "CollisionObject3D", true, false):
		check(not String(body.name).contains("COL_"), "No duplicate GLB collision in navigation city")
	# Material identity across different assets, not just equal-looking colors.
	var first := Assets.spawn("BH_MetalCrate", city)
	var second := Assets.spawn("BH_Car_Sedan_01", city)
	var found := false
	for view in first.find_children("*", "MeshInstance3D", true, false):
		for surface in range(view.mesh.get_surface_count()):
			var mat: Material = view.get_active_material(surface)
			check(mat == Assets.materials[mat.resource_name], "Shared material identity")
			found = true
	check(found, "Shared palette actually instantiated")
	first.free()
	second.free()
	city.free()
	print("ART INTEGRATION: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
