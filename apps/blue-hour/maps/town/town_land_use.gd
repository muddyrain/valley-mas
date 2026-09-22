extends RefCounted
## Blueprint policy layered onto the existing road, frontage and catalog pipeline.

const Graph = preload("res://maps/town/town_road_graph.gd")
const USES: Array[String] = ["RESIDENTIAL_A", "RESIDENTIAL_B", "COMMERCIAL_CORE", "MIXED_TRANSITION", "INDUSTRIAL_SERVICE", "OPEN_SPACE", "MISSION_POI_ZONE", "ARRIVAL_ZONE"]

static func assign(town: Dictionary) -> void:
	for block: Dictionary in town.blocks:
		var use := "OPEN_SPACE"
		if block.type.begins_with("COMMERCIAL"):
			use = "COMMERCIAL_CORE"
		elif block.type.begins_with("RESIDENTIAL"):
			use = "RESIDENTIAL_A" if block.center.y < 0 else "RESIDENTIAL_B"
		elif block.type == "MIXED_BLOCK_A":
			use = "MIXED_TRANSITION"
		elif block.type in ["INDUSTRIAL_BLOCK_A", "PARKING_SERVICE_BLOCK"]:
			use = "INDUSTRIAL_SERVICE"
		block.land_use_type = use
		for row: Dictionary in block.rows:
			if use == "RESIDENTIAL_B":
				row.gap = 4.2
		block.zone_tags = [use]
		block.space_use = "small_park" if block.type == "COMMUNITY_PARK" else "community_green" if use == "OPEN_SPACE" else "backyard" if use.begins_with("RESIDENTIAL") else "loading_yard" if use == "INDUSTRIAL_SERVICE" else "rear_access"

static func finish(town: Dictionary, arrivals: Array, rng: RandomNumberGenerator) -> void:
	town.arrival_candidates = arrivals
	for candidate: Dictionary in arrivals:
		var road: Dictionary = town.roads[candidate.road_index]
		var point := Vector2(candidate.position.x, candidate.position.z)
		candidate.connected = town.town_metrics.connectivity and road.width >= 7 and Geometry2D.get_closest_point_to_segment(point, road.start, road.end).distance_to(point) < 0.01
	# Ground spaces are independent of the arrival point, so build them before scoring.
	# This lets the first view prefer a real parking surface instead of an empty road edge.
	town.arrival = arrivals[0] if not arrivals.is_empty() else {}
	_cover_ground(town)
	_add_arrival_support_parking(town)
	town.arrival = _select_arrival(town, arrivals, rng)
	town.extraction = town.arrival
	var farthest := -1.0
	var origin := Vector2(town.arrival.position.x, town.arrival.position.z)
	for site: Dictionary in town.buildings:
		if not site.searchable or site.land_use_type == "COMMERCIAL_CORE":
			continue
		if town.mission_type == "rescue" and site.category != "residential":
			continue
		var distance: float = Graph.distance(town.town_metrics, origin, Vector2(site.road_point.x, site.road_point.z)) + site.entry.distance_to(site.road_point)
		if distance > farthest:
			farthest = distance
			town.poi = site
	town.poi.poi = true
	town.poi.reachable = is_finite(farthest)
	town.road_distance_to_poi = farthest
	town.estimated_travel_time = farthest / 4.5
	var arrival_block: Dictionary = town.blocks[0]
	var nearest := INF
	for block: Dictionary in town.blocks:
		if block.id == town.poi.block_id:
			block.zone_tags.append("MISSION_POI_ZONE")
		if block.center.distance_to(origin) < nearest:
			nearest = block.center.distance_to(origin)
			arrival_block = block
	arrival_block.zone_tags.append("ARRIVAL_ZONE")
	town.exploration_routes = _routes(town)
	town.blueprint = _metrics(town)
	_orient(town, rng.randi_range(0, 3))
	town.town_metrics.alternative_route_count = town.exploration_routes.size()

static func _select_arrival(town: Dictionary, arrivals: Array, rng: RandomNumberGenerator) -> Dictionary:
	var selected: Dictionary = arrivals[0] if not arrivals.is_empty() else {}
	if not arrivals.is_empty():
		rng.randi_range(0, arrivals.size() - 1) # Preserve the legacy RNG stream before orientation.
	var best_score := -INF
	for candidate: Dictionary in arrivals:
		var point := Vector2(candidate.position.x, candidate.position.z)
		var junctions := 0
		for road: Dictionary in town.roads:
			if Geometry2D.get_closest_point_to_segment(point, road.start, road.end).distance_to(point) < 0.01:
				junctions += 1
		var nearest_building := INF
		var commercial_near := 0
		for site: Dictionary in town.buildings:
			var distance := point.distance_to(site.bounds.get_center())
			nearest_building = minf(nearest_building, distance)
			if site.land_use_type == "COMMERCIAL_CORE" and distance <= 34.0:
				commercial_near += 1
		var parking_near := 0
		for space: Dictionary in town.ground_spaces:
			if space.kind == "parking" and _polygon_bounds(space.polygon).get_center().distance_to(point) <= 70.0:
				parking_near += 1
		for block: Dictionary in town.blocks:
			for space: Dictionary in block.spaces:
				if space.kind == "parking" and space.bounds.get_center().distance_to(point) <= 70.0:
					parking_near += 1
		# Junctions establish the readable first view; nearby frontage keeps it urban.
		var score := float(junctions) * 100.0
		if is_finite(nearest_building):
			score += maxf(0.0, 42.0 - nearest_building)
		score += float(commercial_near) * 12.0
		score += float(parking_near) * 45.0
		# A hash tie-break preserves seeded variation without consuming the RNG stream
		# used later for town orientation and POI selection.
		score += float(abs(hash("%d:%s" % [town.seed, candidate.id]) % 1000)) * 0.00001
		if score > best_score:
			best_score = score
			selected = candidate
	return selected

static func _polygon_bounds(polygon: PackedVector2Array) -> Rect2:
	if polygon.is_empty():
		return Rect2()
	var bounds := Rect2(polygon[0], Vector2.ZERO)
	for point: Vector2 in polygon:
		bounds = bounds.expand(point)
	return bounds

static func _add_arrival_support_parking(town: Dictionary) -> void:
	if town.arrival_candidates.is_empty():
		return
	for candidate: Dictionary in town.arrival_candidates:
		var point := Vector2(candidate.position.x, candidate.position.z)
		# A small street-side apron sits beyond the road shoulder at each seeded
		# gateway candidate. Environment placement can then select any candidate
		# without falling back to an empty road edge.
		var polygon := rect_polygon(Rect2(point + Vector2(7.0, 7.0), Vector2(14.0, 7.0)))
		var owner: Dictionary = town.blocks[0]
		var nearest := INF
		for block: Dictionary in town.blocks:
			var distance := point.distance_to(block.bounds.get_center())
			if distance < nearest:
				nearest = distance
				owner = block
		var support := {"kind": "parking", "owner_block": owner.id, "polygon": polygon, "bounds": _polygon_bounds(polygon)}
		town.ground_spaces.append(support)

static func area(polygon: PackedVector2Array) -> float:
	var total := 0.0
	for i: int in polygon.size():
		total += polygon[i].cross(polygon[(i + 1) % polygon.size()]) * 0.5
	return absf(total)

static func rect_polygon(rect: Rect2) -> PackedVector2Array:
	return PackedVector2Array([rect.position, Vector2(rect.end.x, rect.position.y), rect.end, Vector2(rect.position.x, rect.end.y)])

static func _routes(town: Dictionary) -> Array[Dictionary]:
	# Split the existing graph edges at both endpoints, so routes cannot backtrack via a projection.
	var origin := Vector2(town.arrival.position.x, town.arrival.position.z)
	var destination := Vector2(town.poi.road_point.x, town.poi.road_point.z)
	var segments: Array[Dictionary] = []
	for road: Dictionary in town.roads:
		var cuts: Array[Vector2] = [road.start, road.end]
		for point: Vector2 in [origin, destination]:
			if Geometry2D.get_closest_point_to_segment(point, road.start, road.end).distance_to(point) < 0.01 and not cuts.has(point):
				cuts.append(point)
		cuts.sort_custom(func(a: Vector2, b: Vector2) -> bool: return a.distance_squared_to(road.start) < b.distance_squared_to(road.start))
		for i: int in range(1, cuts.size()):
			segments.append({"start": cuts[i - 1], "end": cuts[i]})
	var graph := Graph.build(segments)
	var start: int = graph.points.find(origin)
	var finish: int = graph.points.find(destination)
	var paths: Array[Dictionary] = []
	if start >= 0 and finish >= 0:
		_walk(graph, start, finish, [], paths)
	paths.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.length < b.length)
	if paths.size() > 3:
		paths.resize(3)
	for i: int in paths.size():
		paths[i].id = "Route_%s" % ["A", "B", "C"][i]
		paths[i].zones = []
		for j: int in range(1, paths[i].points.size()):
			var a: Vector2 = paths[i].points[j - 1]
			var b: Vector2 = paths[i].points[j]
			for sample: int in 9:
				var point := a.lerp(b, sample / 8.0)
				for block: Dictionary in town.blocks:
					for edge: Dictionary in block.street_edges:
						var gap := Geometry2D.get_closest_point_to_segment(point, edge.start, edge.start + edge.tangent * edge.length).distance_to(point)
						if gap <= edge.road_half_width + 0.1 and not paths[i].zones.has(block.land_use_type):
							paths[i].zones.append(block.land_use_type)
	return paths

static func _walk(graph: Dictionary, at: int, finish: int, visited: Array[int], output: Array[Dictionary]) -> void:
	if visited.has(at) or output.size() >= 32:
		return
	var path := visited.duplicate()
	path.append(at)
	if at == finish:
		var points := PackedVector2Array()
		var length := 0.0
		for id: int in path:
			if not points.is_empty():
				length += points[-1].distance_to(graph.points[id])
			points.append(graph.points[id])
		output.append({"points": points, "length": length})
		return
	for neighbor: int in graph.adjacency[at]:
		_walk(graph, neighbor, finish, path, output)

static func _cover_ground(town: Dictionary) -> void:
	var envelope: Rect2 = town.roads[0].bounds
	for block: Dictionary in town.blocks:
		envelope = envelope.merge(block.bounds)
	town.developed_envelope = envelope
	town.ground_spaces = []
	# Small clipping cells avoid polygon holes. Adjacent cells share material without visible seams.
	for x: float in range(floori(envelope.position.x), ceili(envelope.end.x), 16):
		for y: float in range(floori(envelope.position.y), ceili(envelope.end.y), 16):
			var pieces: Array[PackedVector2Array] = [rect_polygon(Rect2(x, y, 16, 16).intersection(envelope))]
			for block: Dictionary in town.blocks:
				pieces = _subtract(pieces, block.polygon)
			for road: Dictionary in town.roads:
				pieces = _subtract(pieces, rect_polygon(road.bounds.grow(2.2)))
			for polygon: PackedVector2Array in pieces:
				if area(polygon) < 0.01:
					continue
				var center := Vector2.ZERO
				for point: Vector2 in polygon:
					center += point / float(polygon.size())
				var closest: Dictionary = town.blocks[0]
				var distance := INF
				for block: Dictionary in town.blocks:
					var gap := center.distance_to(center.clamp(block.bounds.position, block.bounds.end))
					if gap < distance:
						distance = gap
						closest = block
				var kind: String = closest.space_use if distance < 10 else "green_buffer"
				if closest.land_use_type == "COMMERCIAL_CORE" and distance >= 4 and distance < 10:
					kind = "parking"
				town.ground_spaces.append({"kind": kind, "owner_block": closest.id, "polygon": polygon})

static func _subtract(pieces: Array[PackedVector2Array], polygon: PackedVector2Array) -> Array[PackedVector2Array]:
	var result: Array[PackedVector2Array] = []
	for piece: PackedVector2Array in pieces:
		result.append_array(Geometry2D.clip_polygons(piece, polygon))
	return result

static func _metrics(town: Dictionary) -> Dictionary:
	var distribution: Dictionary = {}
	var roles := {"ARRIVAL_ZONE": 0, "MISSION_POI_ZONE": 0}
	var land: Dictionary = {}
	var built: Dictionary = {}
	var frontage := {"commercial": 0.0, "residential": 0.0}
	var occupied := {"commercial": 0.0, "residential": 0.0}
	var open_area := 0.0
	var undefined_blocks := 0
	for block: Dictionary in town.blocks:
		var use: String = block.land_use_type
		undefined_blocks += int(use not in USES)
		for tag: String in block.zone_tags:
			if roles.has(tag):
				roles[tag] += 1
		distribution[use] = int(distribution.get(use, 0)) + 1
		land[use] = float(land.get(use, 0.0)) + area(block.polygon)
		if use == "OPEN_SPACE":
			open_area += area(block.polygon)
		for row: Dictionary in block.rows:
			if row.category not in frontage or use not in ["COMMERCIAL_CORE", "RESIDENTIAL_A", "RESIDENTIAL_B"]:
				continue
			for edge: Dictionary in block.street_edges:
				if edge.side == row.side:
					frontage[row.category] += edge.length - row.get("trim_start", 0.0) - row.get("trim_end", 0.0)
	for site: Dictionary in town.buildings:
		built[site.land_use_type] = float(built.get(site.land_use_type, 0.0)) + site.bounds.get_area()
		if site.category in occupied and site.land_use_type in ["COMMERCIAL_CORE", "RESIDENTIAL_A", "RESIDENTIAL_B"]:
			# Commercial entrance aprons are rendered 0.55 m beyond each facade edge.
			occupied[site.category] += site.footprint.x + (1.1 if site.category == "commercial" else 0.0)
	var coverage: Dictionary = {}
	for use: String in land:
		coverage[use] = float(built.get(use, 0.0)) / land[use]
	var assigned_area := 0.0
	var spaces: Dictionary = {}
	for space: Dictionary in town.ground_spaces:
		var size := area(space.polygon)
		assigned_area += size
		spaces[space.kind] = float(spaces.get(space.kind, 0.0)) + size
	# Unassigned ground is measured independently by subtracting roads, blocks and explicit spaces.
	var undefined := 0.0
	for x: int in range(floori(town.developed_envelope.position.x), ceili(town.developed_envelope.end.x), 8):
		for y: int in range(floori(town.developed_envelope.position.y), ceili(town.developed_envelope.end.y), 8):
			var remaining: Array[PackedVector2Array] = [rect_polygon(Rect2(x, y, 8, 8).intersection(town.developed_envelope))]
			for road: Dictionary in town.roads:
				remaining = _subtract(remaining, rect_polygon(road.bounds.grow(2.2)))
			for block: Dictionary in town.blocks:
				remaining = _subtract(remaining, block.polygon)
			for space: Dictionary in town.ground_spaces:
				remaining = _subtract(remaining, space.polygon)
			for polygon: PackedVector2Array in remaining:
				undefined += area(polygon)
	return {"land_use_distribution": distribution, "zone_role_distribution": roles, "coverage": coverage, "commercial_frontage_occupancy": occupied.commercial / frontage.commercial, "residential_frontage_occupancy": occupied.residential / frontage.residential, "open_space_area": open_area, "assigned_support_space_area": assigned_area, "support_space_distribution": spaces, "undefined_core_space_area": undefined, "undefined_core_blocks": undefined_blocks}

static func _orient(town: Dictionary, turns: int) -> void:
	town.orientation_quarters = turns
	if turns == 0:
		return
	var angle := turns * PI * 0.5
	# Orthogonal transforms preserve all fitted parcels and the existing asset dimensions.
	for road: Dictionary in town.roads:
		road.start = _point(road.start, turns)
		road.end = _point(road.end, turns)
		road.bounds = _rect(road.bounds, turns)
	for block: Dictionary in town.blocks:
		block.polygon = _polygon(block.polygon, turns)
		block.bounds = _rect(block.bounds, turns)
		block.center = block.bounds.get_center()
		block.size = block.bounds.size
		for edge: Dictionary in block.street_edges:
			edge.start = _point(edge.start, turns)
			edge.tangent = _point(edge.tangent, turns)
			edge.outward = _point(edge.outward, turns)
			edge.side = _side(edge.side, turns)
		for row: Dictionary in block.rows:
			row.side = _side(row.side, turns)
		for space: Dictionary in block.spaces:
			space.polygon = _polygon(space.polygon, turns)
			space.bounds = _rect(space.bounds, turns)
	for site: Dictionary in town.buildings:
		for key: String in ["position", "road_anchor", "road_point", "entry", "front_direction"]:
			site[key] = _vector(site[key], turns)
		site.yaw -= angle
		site.bounds = _rect(site.bounds, turns)
	for parcel: Dictionary in town.parcels:
		parcel.bounds = _rect(parcel.bounds, turns)
		parcel.building_bounds = _rect(parcel.building_bounds, turns)
		parcel.road_point = _vector(parcel.road_point, turns)
		parcel.frontage_edge = _side(parcel.frontage_edge, turns)
	for arrival: Dictionary in town.arrival_candidates:
		arrival.position = _vector(arrival.position, turns)
		arrival.yaw -= angle
	for route: Dictionary in town.exploration_routes:
		route.points = _polygon(route.points, turns)
	for space: Dictionary in town.ground_spaces:
		space.polygon = _polygon(space.polygon, turns)
	town.bounds = _rect(town.bounds, turns)
	town.developed_envelope = _rect(town.developed_envelope, turns)
	town.town_metrics = Graph.build(town.roads)

static func _point(point: Vector2, turns: int) -> Vector2:
	for i: int in turns:
		point = Vector2(-point.y, point.x)
	return point

static func _side(side: String, turns: int) -> String:
	var sides: Array[String] = ["north", "east", "south", "west"]
	return sides[(sides.find(side) + turns) % 4]

static func _vector(point: Vector3, turns: int) -> Vector3:
	var flat := _point(Vector2(point.x, point.z), turns)
	return Vector3(flat.x, point.y, flat.y)

static func _polygon(polygon: PackedVector2Array, turns: int) -> PackedVector2Array:
	var output := PackedVector2Array()
	for point: Vector2 in polygon:
		output.append(_point(point, turns))
	return output

static func _rect(rect: Rect2, turns: int) -> Rect2:
	var polygon := _polygon(rect_polygon(rect), turns)
	var output := Rect2(polygon[0], Vector2.ZERO)
	for point: Vector2 in polygon:
		output = output.expand(point)
	return output
