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
	check(city.sites.size() == 8, "Existing five buildings and three vehicles retained")
	for spec in catalog.map.buildings + catalog.map.vehicles:
		check(city.sites.has(spec.id), "Search ID retained: " + spec.id)
		check(city.sites[spec.id].spec == spec, "Search data retained: " + spec.id)
		check(city.sites[spec.id].body.has_meta("art_asset"), "Generated site visual: " + spec.id)
		check(not city.grid.is_point_solid(city.cell_at(spec.entry)), "Entrance not blocked: " + spec.id)
		var outward: PackedVector3Array = city.path(catalog.map.bus_position, spec.entry)
		var homeward: PackedVector3Array = city.path(spec.entry, catalog.map.bus_position)
		check(not outward.is_empty() and outward[-1].distance_to(spec.entry) < .01, "Exact entrance reachable: " + spec.id)
		check(not homeward.is_empty() and homeward[-1].distance_to(catalog.map.bus_position) < .01, "Return path available: " + spec.id)
		var ray := PhysicsRayQueryParameters3D.create(spec.position+Vector3.UP*20, spec.position-Vector3.UP, 1)
		var hit: Dictionary = city.get_world_3d().direct_space_state.intersect_ray(ray)
		check(not hit.is_empty() and hit.collider.get_meta("site_id", "") == spec.id, "Building / vehicle body retains search picking: " + spec.id)
	check(city.bus_door is MeshInstance3D and String(city.bus_door.name).contains("BH_EvacBus_01"), "Bus uses imported independent door")
	check(city.lamps.size() >= 15, "Imported lights participate in existing day/night presentation")
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
