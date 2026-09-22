extends RefCounted
## Road-relative composition: branch chains own junctions; land follows their exposed edges.

static func generate(rng: RandomNumberGenerator) -> Dictionary:
	var sw := -68.0 + rng.randf_range(-3, 3)
	var nw := -42.0 + rng.randf_range(-2, 2)
	var ne := 32.0 + rng.randf_range(-3, 3)
	var se := 82.0 + rng.randf_range(-2, 2)
	var north := -94.0 + rng.randf_range(-4, 4)
	var neck := -58.0 + rng.randf_range(-2, 2)
	var outer := ne + rng.randf_range(22, 26)
	var west_bend := 68.0 + rng.randf_range(-2, 2)
	var west_tip := 124.0 + rng.randf_range(-3, 3)
	var west_stem := sw + rng.randf_range(28, 32)
	var east_bend := 76.0 + rng.randf_range(-2, 2)
	var east_tip := 130.0 + rng.randf_range(-3, 3)
	var east_stem := se - rng.randf_range(40, 44)
	var roads: Array[Dictionary] = [_road(Vector2(-124, 0), Vector2(124, 0), 12, "main", "MainStreet")]
	_chain(roads, "WestResidential", [Vector2(sw, 0), Vector2(sw, west_bend), Vector2(west_stem, west_bend), Vector2(west_stem, west_tip)])
	_chain(roads, "NorthResidential", [Vector2(nw, 0), Vector2(nw, north)])
	_chain(roads, "EastResidential", [Vector2(ne, 0), Vector2(ne, neck), Vector2(outer, neck), Vector2(outer, north)])
	_chain(roads, "ServiceBranch", [Vector2(se, 0), Vector2(se, east_bend), Vector2(east_stem, east_bend), Vector2(east_stem, east_tip)])
	roads.append(_road(Vector2(nw, north), Vector2(outer, north), 7, "connector", "NorthLink"))
	roads.append(_road(Vector2(nw, neck), Vector2(ne, neck), 7, "connector", "ParkLink"))
	# A short arrival access lane makes the main-street gateway a real T-junction
	# while staying in the open shoulder beyond the generated blocks.
	roads.append(_road(Vector2(-116, 0), Vector2(-116, 24), 7, "connector", "ArrivalLink"))
	var blocks: Array[Dictionary] = []
	blocks.append(_lot(roads[0], -120, nw - 4, "north", 24, "LONG_STRIP", "RESIDENTIAL_BLOCK_A", "residential", 5))
	blocks.append(_lot(roads[0], sw + 8, ne - 8, "south", 13, "LONG_STRIP", "COMMERCIAL_STRIP_A", "commercial", 8))
	var corner := _block("COMMERCIAL_CORNER_A", "CORNER", PackedVector2Array([
		Vector2(nw + 4, neck + 4), Vector2(nw + 17, neck + 4), Vector2(nw + 17, -19),
		Vector2(ne - 4, -19), Vector2(ne - 4, -6), Vector2(nw + 4, -6)]), roads)
	corner.rows = [{"side": "south", "category": "commercial", "count": 7, "gap": 1.8}, {"side": "west", "category": "commercial", "count": 2, "gap": 1.8, "trim_end": 17.0}]
	blocks.append(corner)
	blocks.append(_lot(roads[4], north + 10, -34, "west", 29, "RECTANGLE", "RESIDENTIAL_BLOCK_A", "residential", 4))
	blocks.append(_lot(roads[11], nw + 12, ne - 10, "south", 25, "IRREGULAR", "RESIDENTIAL_BLOCK_A", "residential", 4))
	blocks.append(_lot(roads[5], neck + 6, -10, "east", 27, "RECTANGLE", "RESIDENTIAL_BLOCK_B", "residential", 4))
	blocks.append(_lot(roads[1], 12, west_bend - 6, "west", 28, "IRREGULAR", "RESIDENTIAL_BLOCK_A", "residential", 4))
	blocks.append(_lot(roads[3], west_bend + 6, west_tip - 2, "east", 31, "DEAD_END_BLOCK", "RESIDENTIAL_BLOCK_B", "residential", 3))
	var mixed := _block("MIXED_BLOCK_A", "L_SHAPE", PackedVector2Array([
		Vector2(se - 26, 12), Vector2(se - 4, 12), Vector2(se - 4, east_bend - 4),
		Vector2(east_stem + 3, east_bend - 4), Vector2(east_stem + 3, east_bend - 26), Vector2(se - 26, east_bend - 26)]), roads)
	mixed.rows = [{"side": "east", "category": "commercial", "count": 2, "gap": 2.0, "trim_end": east_bend - 44.0}, {"side": "south", "category": "residential", "count": 2, "gap": 3.0}]
	blocks.append(mixed)
	blocks.append(_lot(roads[8], 12, east_bend - 6, "east", 36, "IRREGULAR", "INDUSTRIAL_BLOCK_A", "industrial", 2))
	blocks.append(_lot(roads[10], east_bend + 8, east_tip - 4, "east", 38, "SERVICE_YARD", "INDUSTRIAL_BLOCK_A", "industrial", 2))
	blocks.append(_lot(roads[10], east_bend + 26, east_tip - 2, "west", 25, "SERVICE_YARD", "PARKING_SERVICE_BLOCK", "special", 1))
	blocks.append(_lot(roads[1], 34, west_bend - 6, "east", 25, "RECTANGLE", "RESIDENTIAL_BLOCK_B", "residential", 2))
	blocks.append(_lot(roads[3], west_bend + 6, west_tip - 2, "west", 28, "RECTANGLE", "RESIDENTIAL_BLOCK_B", "residential", 3))
	var park := _block("COMMUNITY_PARK", "COURTYARD", PackedVector2Array([
		Vector2(nw + 18, neck + 4), Vector2(ne - 4, neck + 4), Vector2(ne - 4, -20), Vector2(nw + 18, -20)]), roads)
	blocks.append(park)
	var green := _block("COMMUNITY_GREEN", "COURTYARD", PackedVector2Array([
		Vector2(sw + 32, 30), Vector2(se - 28, 30), Vector2(se - 28, east_bend - 28),
		Vector2(east_stem, east_bend - 28), Vector2(east_stem, west_bend - 4), Vector2(sw + 32, west_bend - 4)]), roads)
	blocks.append(green)
	for i: int in blocks.size():
		blocks[i].id = "A%02d" % i
	var arrivals: Array[Dictionary] = []
	arrivals.append({"id": "Arrival_GatewayJunction", "position": Vector3(-116, 0, 0), "road_index": 0, "yaw": -PI * 0.5})
	for side: int in [-1, 1]:
		arrivals.append({"id": "Arrival_MainStart" if side < 0 else "Arrival_MainEnd", "position": Vector3(side * 116, 0, 0), "road_index": 0, "yaw": side * PI * 0.5})
	arrivals.append({"id": "Arrival_ResidentialEdge", "position": Vector3(west_stem, 0, west_tip - 3), "road_index": 3, "yaw": PI})
	arrivals.append({"id": "Arrival_ServiceEdge", "position": Vector3(east_stem, 0, east_tip - 3), "road_index": 10, "yaw": PI})
	return {"id": "PROFILE_A_MAIN_STREET", "bounds": Rect2(-130, -155, 260, 310), "roads": roads, "blocks": blocks, "arrivals": arrivals}

static func metrics(town: Dictionary) -> Dictionary:
	var branches: Dictionary = {}
	var envelope: Rect2 = town.roads[0].bounds
	var shapes: Dictionary = {}
	var starts: Array[Vector2] = []
	for road: Dictionary in town.roads:
		envelope = envelope.merge(road.bounds)
		if road.get("branch_id", "") != "":
			branches[road.branch_id] = float(branches.get(road.branch_id, 0)) + road.start.distance_to(road.end)
			if is_zero_approx(road.start.y):
				starts.append(Vector2(road.start.x, signf(road.end.y)))
	var offsets: Array[Dictionary] = []
	for i: int in starts.size():
		for j: int in range(i + 1, starts.size()):
			var separation := absf(starts[i].x - starts[j].x)
			if starts[i].y != starts[j].y and separation >= 16 and separation <= 36:
				offsets.append({"first_x": starts[i].x, "second_x": starts[j].x, "separation": separation})
	var tees := 0
	var crosses := 0
	for neighbors: Dictionary in town.town_metrics.adjacency:
		tees += int(neighbors.size() == 3)
		crosses += int(neighbors.size() == 4)
	for block: Dictionary in town.blocks:
		shapes[block.shape] = int(shapes.get(block.shape, 0)) + 1
	# Main-street terminals are boundary gateways. Report them as graph termini too.
	var residential_dead_ends := 0
	for i: int in town.town_metrics.points.size():
		if town.town_metrics.adjacency[i].size() == 1 and not is_zero_approx(town.town_metrics.points[i].y):
			residential_dead_ends += 1
	return {"main_street_length": town.roads[0].start.distance_to(town.roads[0].end), "branch_count": branches.size(), "branch_lengths": branches, "t_junction_count": tees, "cross_junction_count": crosses, "offset_junction_count": offsets.size(), "offset_junctions": offsets, "dead_end_count": residential_dead_ends, "all_graph_terminal_count": town.town_metrics.dead_end_count, "block_shape_distribution": shapes, "actual_street_envelope": str(envelope)}

static func _chain(roads: Array[Dictionary], id: String, points: Array[Vector2]) -> void:
	for i: int in range(points.size() - 1):
		var road := _road(points[i], points[i + 1], 8, "secondary", "%s_%d" % [id, i])
		road.branch_id = id
		roads.append(road)

static func _lot(road: Dictionary, begin: float, end: float, side: String, depth: float, shape: String, kind: String, category: String, count: int) -> Dictionary:
	var horizontal := side in ["north", "south"]
	var outward := Vector2.UP if side == "south" else Vector2.DOWN if side == "north" else Vector2.LEFT if side == "east" else Vector2.RIGHT
	var tangent := Vector2.RIGHT if horizontal else Vector2.DOWN
	var centerline: Vector2 = Vector2(begin, road.start.y) if horizontal else Vector2(road.start.x, begin)
	var origin: Vector2 = centerline - outward * road.width * 0.5
	var length := end - begin
	var points: Array[Vector2] = [Vector2(0, 0), Vector2(length, 0), Vector2(length, depth), Vector2(0, depth)]
	if shape == "IRREGULAR":
		points = [Vector2(0, 0), Vector2(length, 0), Vector2(length, 19), Vector2(length * 0.7, depth), Vector2(length * 0.2, depth - 2), Vector2(0, 20)]
	elif shape == "DEAD_END_BLOCK":
		points = [Vector2(0, 0), Vector2(length, 0), Vector2(length + 10, 10), Vector2(length + 7, depth - 5), Vector2(length * 0.55, depth), Vector2(0, 20)]
	elif shape == "SERVICE_YARD":
		points = [Vector2(0, 0), Vector2(length, 0), Vector2(length, depth * 0.65), Vector2(length * 0.7, depth * 0.65), Vector2(length * 0.7, depth), Vector2(0, depth)]
	var polygon := PackedVector2Array()
	for point: Vector2 in points:
		polygon.append(origin + tangent * point.x - outward * point.y)
	var block := _block(kind, shape, polygon, [road])
	block.rows = [{"side": "south" if side == "north" else "north" if side == "south" else "west" if side == "east" else "east", "category": category, "count": count, "gap": 8.0 if category == "industrial" else 2.8 if category == "residential" else 1.8}]
	return block

static func _block(kind: String, shape: String, polygon: PackedVector2Array, roads: Array[Dictionary]) -> Dictionary:
	var bounds := Rect2(polygon[0], Vector2.ZERO)
	for point: Vector2 in polygon:
		bounds = bounds.expand(point)
	var edges: Array[Dictionary] = []
	for i: int in polygon.size():
		var a := polygon[i]
		var b := polygon[(i + 1) % polygon.size()]
		if not is_equal_approx(a.x, b.x) and not is_equal_approx(a.y, b.y):
			continue
		for road: Dictionary in roads:
			var horizontal := is_equal_approx(a.y, b.y)
			if horizontal != is_equal_approx(road.start.y, road.end.y):
				continue
			var midpoint := (a + b) * 0.5
			var projected := Geometry2D.get_closest_point_to_segment(midpoint, road.start, road.end)
			if not is_equal_approx(midpoint.distance_to(projected), road.width * 0.5):
				continue
			var outward := (projected - midpoint).normalized()
			var side := "north" if outward.y < -0.5 else "south" if outward.y > 0.5 else "west" if outward.x < -0.5 else "east"
			edges.append({"side": side, "start": a.min(b), "tangent": Vector2.RIGHT if horizontal else Vector2.DOWN, "outward": outward, "length": a.distance_to(b), "road_id": road.id, "road_kind": road.kind, "road_half_width": road.width * 0.5})
	return {"id": "", "type": kind, "shape": shape, "polygon": polygon, "bounds": bounds, "center": bounds.get_center(), "size": bounds.size, "street_edges": edges, "rows": [], "spaces": []}

static func _road(start: Vector2, end: Vector2, width: float, kind: String, id: String) -> Dictionary:
	var rect := Rect2(start.min(end), (end - start).abs())
	if is_equal_approx(start.x, end.x):
		rect.position.x -= width * 0.5
		rect.size.x = width
	else:
		rect.position.y -= width * 0.5
		rect.size.y = width
	return {"id": id, "start": start, "end": end, "width": width, "kind": kind, "bounds": rect}
