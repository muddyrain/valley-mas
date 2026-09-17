extends SceneTree

const Generator = preload("res://maps/town/town_generator.gd")
const Assets = preload("res://data/world_asset_catalog.gd")
var failures: Array[String] = []
var checks: int = 0
var rows: Array[Dictionary] = []
var poi_sides: Dictionary = {}
var road_layouts: Dictionary = {}

func _initialize() -> void:
	var seeds: Array[int] = [4101, 4102, 4103, 17, 91, 1209]
	for value: int in 24:
		seeds.append(value)
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--town-seed="):
			seeds = [int(argument.trim_prefix("--town-seed="))]
	for seed_value: int in seeds:
		var town: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
		check(town.ok, "Generate seed %d: %s" % [seed_value, town.get("error", "OK")])
		if not town.ok:
			continue
		check(town.has("parcels"), "Street frontage and parcels exist")
		if not town.has("parcels"):
			continue
		_check_blueprint(town)
		poi_sides[signf(town.poi.position.x)] = true
		road_layouts[var_to_str(town.roads)] = true
		var repeat: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
		check(var_to_str(town) == var_to_str(repeat), "Seed determinism")
		for block: Dictionary in town.blocks:
			check(not block.street_edges.is_empty() or block.land_use_type == "OPEN_SPACE", "Developed block has street edges")
			check(town.bounds.encloses(block.bounds), "Entire block remains inside town")
			for road: Dictionary in town.roads:
				check(Geometry2D.intersect_polygons(block.polygon, _rect_polygon(road.bounds.grow(-0.001))).is_empty(), "Actual block polygon does not cover road")
			for other: Dictionary in town.blocks:
				if block.id < other.id:
					check(Geometry2D.intersect_polygons(block.polygon, other.polygon).is_empty(), "Actual block polygons are disjoint")
			for edge: Dictionary in block.street_edges:
				check(not edge.road_id.is_empty(), "Street edge references actual road")
		for parcel: Dictionary in town.parcels:
			check(parcel.frontage_length > 0 and parcel.depth > 0, "Positive parcel dimensions")
			check(parcel.bounds.encloses(parcel.building_bounds.grow(-0.001)), "Building fits parcel")
			var block: Dictionary = town.blocks.filter(func(item: Dictionary) -> bool: return item.id == parcel.block_id)[0]
			check(block.bounds.grow(0.001).encloses(parcel.bounds), "Parcel fits block")
			if block.has("polygon"):
				var outline := _rect_polygon(parcel.bounds.grow(-0.001))
				check(Geometry2D.clip_polygons(outline, block.polygon).is_empty(), "Entire parcel fits actual block polygon")
		for building: Dictionary in town.buildings:
			var instance: Node3D = preload("res://maps/town/town_urban_view.gd").instantiate_building(building)
			var front: Vector3 = instance.get_node("Anchors/FrontMarker").position
			var basis := Basis(Vector3.UP, building.yaw)
			var facing := basis * front.normalized()
			check(facing.dot(building.front_direction) > 0.99, "Authored front faces street")
			if instance.has_meta("source_front_correction"):
				var model: Node3D = instance.get_node("ModelRoot")
				var source_axis: Vector3 = instance.get_meta("audited_facade_local")
				check((basis * model.basis * source_axis).normalized().dot(building.front_direction) > 0.99, "Audited visible facade follows FrontMarker")
			var anchor: Vector3 = building.position + basis * instance.get_node("Anchors/RoadAnchor").position
			check(anchor.distance_to(building.road_anchor) < 0.001, "Runtime RoadAnchor matches placement")
			var road_point := Vector2(building.road_point.x, building.road_point.z)
			check(_on_road(road_point, town.roads), "Building frontage reaches a road")
			var measured := AABB()
			var first := true
			for mesh: MeshInstance3D in instance.get_node("ModelRoot").find_children("*", "MeshInstance3D", true, false):
				var transform := Transform3D.IDENTITY
				var node: Node3D = mesh
				while node != instance:
					transform = node.transform * transform
					node = node.get_parent() as Node3D
				var box: AABB = Transform3D(basis, building.position) * transform * mesh.get_aabb()
				measured = box if first else measured.merge(box)
				first = false
			var measured_rect := Rect2(Vector2(measured.position.x, measured.position.z), Vector2(measured.size.x, measured.size.z))
			check(building.bounds.grow(0.02).encloses(measured_rect), "Runtime mesh fits definition bounds")
			check(town.bounds.encloses(measured_rect), "Runtime mesh inside town")
			instance.free()
		var overlaps := 0
		var road_collisions := 0
		for i: int in town.buildings.size():
			var a: Rect2 = town.buildings[i].bounds
			for j: int in range(i + 1, town.buildings.size()):
				check(not a.intersects(town.buildings[j].bounds), "No building overlap")
				overlaps += int(a.intersects(town.buildings[j].bounds))
			for road: Dictionary in town.roads:
				check(not a.intersects(road.bounds), "No building-road intersection")
				road_collisions += int(a.intersects(road.bounds))
		for i: int in town.parcels.size():
			for j: int in range(i + 1, town.parcels.size()):
				check(not town.parcels[i].bounds.grow(-0.001).intersects(town.parcels[j].bounds), "Parcels do not overlap")
		check(town.town_metrics.connectivity, "Connected road graph")
		check(_connected(town.roads), "Independent road segment connectivity")
		check(_on_road(Vector2(town.arrival.position.x, town.arrival.position.z), town.roads), "Arrival on connected drivable road")
		check(town.arrival.connected and town.poi.reachable, "Arrival and POI reachable")
		check(town.road_distance_to_poi > 140, "POI is multiple blocks from arrival")
		var counts := {"residential": 0, "commercial": 0, "mixed": 0, "industrial": 0, "service": 0}
		for building: Dictionary in town.buildings:
			var group := "mixed" if building.block_type == "MIXED_BLOCK_A" else "service" if building.category == "special" else str(building.category)
			counts[group] += 1
		var gaps := _measure_gaps(town)
		rows.append({"seed": seed_value, "bounds": str(town.bounds), "developed_envelope": str(town.developed_envelope), "blocks": town.blocks.size(), "parcels": town.parcels.size(), "buildings": town.buildings.size(), "blueprint": town.blueprint, "orientation_quarters": town.orientation_quarters, "arrival": town.arrival, "poi": town.poi.id, "routes": town.exploration_routes, "counts_by_block_use": counts, "average_residential_gap": _average(gaps.residential), "average_commercial_gap": _average(gaps.commercial), "building_road_collisions": road_collisions, "building_overlaps": overlaps, "road_connected": _connected(town.roads), "poi_road_distance": town.road_distance_to_poi})
	if seeds.size() > 1:
		check(poi_sides.size() == 2, "POI changes town side across seeds")
		check(road_layouts.size() >= 24, "Seed changes actual road coordinates")
	print("URBAN FABRIC: %d checks, %d failures" % [checks, failures.size()])
	for failure: String in failures:
		printerr(failure)
	DirAccess.make_dir_recursive_absolute("res://test-output/medium-town-blueprint")
	FileAccess.open("res://test-output/medium-town-blueprint/validation.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "cases": rows}, "\t"))
	quit(0 if failures.is_empty() else 1)

func check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)

func _check_blueprint(town: Dictionary) -> void:
	check(town.has("blueprint"), "Blueprint metrics exist")
	if not town.has("blueprint"):
		return
	print("BLUEPRINT seed=%d buildings=%d core=%.3f residential=%.3f routes=%d" % [town.seed, town.buildings.size(), town.blueprint.commercial_frontage_occupancy, town.blueprint.residential_frontage_occupancy, town.exploration_routes.size()])
	var uses: Dictionary = {}
	for block: Dictionary in town.blocks:
		check(not str(block.get("land_use_type", "")).is_empty(), "No undefined block")
		uses[block.get("land_use_type", "")] = true
	for kind: String in ["COMMERCIAL_CORE", "RESIDENTIAL_A", "RESIDENTIAL_B", "MIXED_TRANSITION", "INDUSTRIAL_SERVICE", "OPEN_SPACE"]:
		check(uses.has(kind), "Land use exists: " + kind)
	check(town.arrival_candidates.size() >= 3, "At least three arrival candidates")
	for candidate: Dictionary in town.arrival_candidates:
		var road: Dictionary = town.roads[candidate.road_index]
		check(candidate.connected and road.width >= 7, "Every arrival candidate is bus-drivable")
		check(_on_road(Vector2(candidate.position.x, candidate.position.z), town.roads), "Candidate lies on road centerline")
		for block: Dictionary in town.blocks:
			if block.land_use_type == "COMMERCIAL_CORE":
				check(Vector2(candidate.position.x, candidate.position.z).distance_to(block.center) > 60, "Arrival stays outside core")
	check(town.exploration_routes.size() >= 3, "Three exploration routes")
	var signatures: Dictionary = {}
	for route: Dictionary in town.exploration_routes:
		var visited: Dictionary = {}
		for point: Vector2 in route.points:
			check(not visited.has(point), "Exploration route has no backtracking")
			visited[point] = true
			check(_on_road(point, town.roads), "Route lies on actual road graph")
		check(route.points[0].distance_to(Vector2(town.arrival.position.x, town.arrival.position.z)) < 0.01, "Route starts at arrival")
		check(route.points[-1].distance_to(Vector2(town.poi.road_point.x, town.poi.road_point.z)) < 0.01, "Route ends at POI frontage")
		check(route.zones.size() >= 3, "Exploration crosses multiple land uses")
		for i: int in range(1, route.points.size()):
			check(_on_road(route.points[i - 1].lerp(route.points[i], 0.5), town.roads), "Route segment does not shortcut through a block")
		signatures[var_to_str(route.points)] = true
	check(signatures.size() >= 3, "Routes are geometrically distinct")
	check(town.blueprint.undefined_core_space_area < 0.1, "No unassigned developed core ground")
	check(town.blueprint.commercial_frontage_occupancy >= 0.65 and town.blueprint.commercial_frontage_occupancy <= 0.81, "Commercial frontage occupancy 65-80 percent")
	check(town.blueprint.residential_frontage_occupancy >= 0.45 and town.blueprint.residential_frontage_occupancy <= 0.71, "Residential frontage occupancy 45-70 percent")
	check(town.blueprint.coverage.COMMERCIAL_CORE > town.blueprint.coverage.RESIDENTIAL_A and town.blueprint.coverage.COMMERCIAL_CORE > town.blueprint.coverage.RESIDENTIAL_B, "Core has highest building coverage")
	for kind: String in town.blueprint.coverage:
		check(town.blueprint.coverage.COMMERCIAL_CORE >= town.blueprint.coverage[kind], "Core denser than " + kind)

func _rect_polygon(rect: Rect2) -> PackedVector2Array:
	return PackedVector2Array([rect.position, Vector2(rect.end.x, rect.position.y), rect.end, Vector2(rect.position.x, rect.end.y)])

func _check_composition(town: Dictionary) -> void:
	check(town.has("composition"), "A.2 composition metrics exist")
	if not town.has("composition"):
		return
	var mains: Array = town.roads.filter(func(road: Dictionary) -> bool: return road.kind == "main")
	check(mains.size() == 1, "One core main street")
	var branches: Dictionary = {}
	for road: Dictionary in town.roads:
		if road.get("branch_id", "") != "":
			branches[road.branch_id] = float(branches.get(road.branch_id, 0)) + road.start.distance_to(road.end)
	check(branches.size() >= 3 and branches.size() <= 5, "3-5 actual branch chains")
	var lengths: Array = branches.values()
	lengths.sort()
	check(lengths.back() - lengths.front() > 30, "Branch lengths differ materially")
	check(mains[0].start.distance_to(mains[0].end) > lengths.back() * 1.3, "Main street dominates branch lengths")
	var horizontal_branches := 0
	var residential_branches: Dictionary = {}
	for road: Dictionary in town.roads:
		if road.get("branch_id", "") != "" and is_equal_approx(road.start.y, road.end.y):
			horizontal_branches += 1
		for block: Dictionary in town.blocks:
			if not block.type.begins_with("RESIDENTIAL"):
				continue
			for edge: Dictionary in block.street_edges:
				if edge.road_id == road.id and road.has("branch_id"):
					residential_branches[road.branch_id] = true
	check(horizontal_branches >= 1, "Branches include bends, not parallel stubs")
	check(residential_branches.size() >= 2, "Housing fronts multiple distinct branches")
	var tees := 0
	var crosses := 0
	var dead_ends := 0
	for neighbors: Dictionary in town.town_metrics.adjacency:
		tees += int(neighbors.size() == 3)
		crosses += int(neighbors.size() == 4)
		dead_ends += int(neighbors.size() == 1)
	check(tees >= 2 and tees <= 4 and crosses <= 2, "Real graph junction degrees")
	check(dead_ends >= 1, "Real graph dead ends")
	check(town.composition.offset_junction_count >= 1, "Opposite-side offset junction pair")
	for offset: Dictionary in town.composition.offset_junctions:
		for x: float in [offset.first_x, offset.second_x]:
			var found := false
			for i: int in town.town_metrics.points.size():
				if town.town_metrics.points[i].distance_to(Vector2(x, 0)) < 0.001:
					found = town.town_metrics.adjacency[i].size() == 3
			check(found, "Offset pair consists of actual main-street T junctions")
	var shapes: Dictionary = {}
	var areas: Array[float] = []
	for block: Dictionary in town.blocks:
		check(block.has("polygon"), "Block has actual polygon")
		if not block.has("polygon"):
			continue
		var area := 0.0
		for i: int in block.polygon.size():
			area += block.polygon[i].cross(block.polygon[(i + 1) % block.polygon.size()]) * 0.5
		areas.append(absf(area))
		shapes[block.shape] = int(shapes.get(block.shape, 0)) + 1
		if block.shape not in ["RECTANGLE", "LONG_STRIP"]:
			check(absf(area) < block.bounds.get_area() * 0.94, "Nonrectangular shape changes actual land area")
	check(int(shapes.get("RECTANGLE", 0)) <= town.blocks.size() / 2, "Rectangles at most half")
	for shape: String in ["RECTANGLE", "LONG_STRIP", "L_SHAPE", "CORNER", "IRREGULAR", "DEAD_END_BLOCK", "SERVICE_YARD"]:
		check(shapes.has(shape), "Real shape present: " + shape)
	areas.sort()
	check(areas.back() > areas.front() * 2, "Small and large block areas coexist")
	var strips := 0
	for block: Dictionary in town.blocks:
		if block.type == "COMMERCIAL_STRIP_A":
			var sites: Array = town.buildings.filter(func(site: Dictionary) -> bool: return site.block_id == block.id)
			check(sites.size() >= 4 and sites.size() <= 8, "Continuous 4-8 storefront stretch")
			strips += 1
	check(strips >= 2, "Two main-street commercial stretches")

func _on_road(point: Vector2, roads: Array) -> bool:
	for road: Dictionary in roads:
		if Geometry2D.get_closest_point_to_segment(point, road.start, road.end).distance_to(point) < 0.001:
			return true
	return false

func _connected(roads: Array) -> bool:
	var seen: Dictionary = {0: true}
	var pending: Array[int] = [0]
	while not pending.is_empty():
		var index: int = pending.pop_back()
		for other: int in roads.size():
			if seen.has(other):
				continue
			var touches := Geometry2D.segment_intersects_segment(roads[index].start, roads[index].end, roads[other].start, roads[other].end) != null
			for endpoint: Vector2 in [roads[index].start, roads[index].end]:
				touches = touches or Geometry2D.get_closest_point_to_segment(endpoint, roads[other].start, roads[other].end).distance_to(endpoint) < 0.001
			if touches:
				seen[other] = true
				pending.append(other)
	return seen.size() == roads.size()

func _average(values: Array) -> float:
	var total := 0.0
	for value: float in values:
		total += value
	return total / maxf(1, values.size())

func _measure_gaps(town: Dictionary) -> Dictionary:
	var result := {"residential": [], "commercial": []}
	for block: Dictionary in town.blocks:
		for edge: Dictionary in block.street_edges:
			var row: Array[Dictionary] = []
			for parcel: Dictionary in town.parcels:
				if parcel.block_id == block.id and parcel.frontage_edge == edge.side:
					row.append(parcel)
			var axis := 0 if edge.side in ["north", "south"] else 1
			row.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.building_bounds.position[axis] < b.building_bounds.position[axis])
			for i: int in range(1, row.size()):
				var category := "residential" if row[i].building_slot_type == "ResidentialSlot" else "commercial" if row[i].building_slot_type == "CommercialSlot" else "other"
				if category == "other":
					continue
				var gap: float = row[i].building_bounds.position[axis] - row[i - 1].building_bounds.end[axis]
				check(gap >= (1.0 if category == "commercial" else 2.0) and gap <= (4.0 if category == "commercial" else 6.0), "Measured outer-contour frontage gap")
				result[category].append(gap)
	return result
