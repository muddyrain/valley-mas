extends SceneTree
const Catalog = preload("res://data/catalog.gd")
const Assets = preload("res://data/world_asset_catalog.gd")
const City = preload("res://maps/city.gd")
const Road = preload("res://maps/generation/road_generator.gd")
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures.append(message)
		push_error(message)

func run() -> void:
	var catalog := Catalog.new()
	check(catalog.validate().is_empty(), "The production catalog is valid")
	var city := City.new()
	root.add_child(city)
	city.build(catalog.map)
	await physics_frame
	await physics_frame
	check(city.sites.size() == 18, "Fifteen buildings and three searchable vehicles form the expedition")
	check(Assets.ALL.size() == 16, "All sixteen core assets have runtime definitions")
	check(city.accent_lights.size() == 4, "Four shadow-free street lights, shared phase material")
	for definition: Resource in Assets.ALL:
		var wrapper: Node3D = definition.scene.instantiate()
		check(wrapper.transform == Transform3D.IDENTITY, "Normalized runtime root: " + definition.id)
		check(wrapper.get_node_or_null("ModelRoot") != null, "Source correction boundary: " + definition.id)
		check(wrapper.get_node_or_null("Collision") is StaticBody3D, "Primitive collision: " + definition.id)
		check(wrapper.get_node_or_null("Anchors/RoadAnchor") != null, "Road anchor: " + definition.id)
		wrapper.free()
	for site: Dictionary in city.sites.values():
		var spec: Dictionary = site.spec
		check(not city.grid.is_point_solid(city.cell_at(spec.entry)), "Unblocked exact entrance: " + spec.id)
		var path: PackedVector3Array = city.path(catalog.map.bus_position, spec.entry)
		check(not path.is_empty() and path[-1].distance_to(spec.entry) < .01, "Reachable exact entrance: " + spec.id)
		var home: PackedVector3Array = city.path(spec.entry, catalog.map.bus_position)
		check(not home.is_empty() and home[-1].distance_to(catalog.map.bus_position) < .01, "Return route: " + spec.id)
		if not site.vehicle:
			var front: Vector3 = -site.body.basis.z
			var road_direction: Vector3 = (spec.road_anchor - site.body.position).normalized()
			check(front.dot(road_direction) > .99, "Building front faces assigned road: " + spec.id)
		for point: Vector3 in path:
			check(not city.grid.is_point_solid(city.cell_at(point)), "Search path stays out of obstacles: " + spec.id)
		var solid: Vector3 = site.body.get_node("Collision/Shape0").global_position
		var ray := PhysicsRayQueryParameters3D.create(solid + Vector3.UP * 20, solid - Vector3.UP * 20, 1)
		var hit: Dictionary = city.get_world_3d().direct_space_state.intersect_ray(ray)
		check(not hit.is_empty() and hit.collider.get_meta("site_id", "") == spec.id, "Physical picking belongs to POI: " + spec.id)
	for offset: Vector3 in [Vector3(-1.2, 0, 0), Vector3(1.2, 0, 0), Vector3(0, 0, -1.4)]:
		check(not city.grid.is_point_solid(city.cell_at(catalog.map.bus_position + offset)), "Spawn clear of world obstacles")
	for enemy: Dictionary in catalog.map.initial_enemies:
		check(not city.grid.is_point_solid(city.cell_at(enemy.position)), "Enemy starts in open space: " + str(enemy.position))
		check(enemy.position.distance_to(catalog.map.bus_position) > 14, "No initial enemy overlaps player arrival")
	for x: int in range(-43, 44):
		check(not city.grid.is_point_solid(Vector2i(x, 0)), "Main road connected at " + str(x))
	for z: int in range(-27, 28):
		check(not city.grid.is_point_solid(Vector2i(0, z)), "Secondary road connected at " + str(z))
	for side: int in [-1, 1]:
		for x: int in range(-43, 44):
			check(not city.grid.is_point_solid(Vector2i(x, side * 6)), "Main sidewalk lane: " + str(Vector2i(x, side * 6)))
		for z: int in range(-27, 28):
			check(not city.grid.is_point_solid(Vector2i(side * 6, z)), "Secondary sidewalk lane: " + str(Vector2i(side * 6, z)))
	for i: int in range(catalog.map.buildings.size()):
		var a: Node3D = city.sites[catalog.map.buildings[i].id].body
		var a_size: Vector3 = Assets.asset(a.asset_id).bounding_size
		var a_bounds := a.transform * AABB(-Vector3(a_size.x, 0, a_size.z) * .5, a_size)
		for j: int in range(i + 1, catalog.map.buildings.size()):
			var b: Node3D = city.sites[catalog.map.buildings[j].id].body
			var b_size: Vector3 = Assets.asset(b.asset_id).bounding_size
			var b_bounds := b.transform * AABB(-Vector3(b_size.x, 0, b_size.z) * .5, b_size)
			check(not a_bounds.intersects(b_bounds), "Building source bounds do not interpenetrate")
	var fences: Array = city.get_children().filter(func(node: Node) -> bool: return node.is_in_group("world_assets") and node.asset_id == "BAR_001_chainlink_fence")
	var joined: int = 0
	for a: Node3D in fences:
		for b: Node3D in fences:
			if a == b:
				continue
			if a.get_node("Anchors/RightSnapAnchor").global_position.distance_to(b.get_node("Anchors/LeftSnapAnchor").global_position) < .001:
				joined += 1
	check(fences.size() == 32 and joined == 28, "Four rows of eight standard fences join without gaps, leaving intentional exits")
	check(catalog.map.half_width * catalog.map.half_depth * 4 == 19200, "Playable area reaches 160 by 120 metres")
	check(catalog.map.districts.size() == 6, "Six authored district areas")
	check(catalog.map.parking_placements.size() == 12, "Twelve vehicles with only three lootable")
	var intersections: int = 0
	for tile: Node in city.get_node("RoadNetwork").get_children():
		if tile.get_meta("connection_count", 0) >= 3:
			intersections += 1
	check(intersections == 3, "Two crossroads and a T junction")
	for cell: Vector2i in Road.cells(catalog.map):
		check(not city.path(catalog.map.bus_position, Vector3(cell.x, 0, cell.y)).is_empty(), "Every road branch connects to the return point")
	var again := Catalog.new()
	check(var_to_str(catalog.map.buildings) == var_to_str(again.map.buildings), "Same fixed seed reproduces plot data")
	var second := City.new()
	root.add_child(second)
	second.build(again.map)
	var first_assets: Array = city.get_children().filter(func(node: Node) -> bool: return node.is_in_group("world_assets"))
	var second_assets: Array = second.get_children().filter(func(node: Node) -> bool: return node.is_in_group("world_assets"))
	check(first_assets.size() == catalog.map.plots.size() + catalog.map.parking_placements.size() + catalog.map.props.size() + catalog.map.vegetation.size(), "Every authored world instance participates in seed verification")
	check(first_assets.size() == second_assets.size(), "Reproducible instance count")
	for i: int in range(first_assets.size()):
		check(first_assets[i].transform == second_assets[i].transform, "Seed reproduces all placement transforms")
	second.free()
	for kind: String in ["straight", "corner", "t_junction", "crossroad"]:
		var road: Node3D = Road.module(city, kind, Vector3(100, 0, 100))
		check(road.get_child(0).mesh.size == Vector3(8, .12, 8), "Connecting road module dimensions: " + kind)
		road.free()
	city.free()
	print("WORLD MAP: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
