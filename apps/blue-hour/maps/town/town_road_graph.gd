extends RefCounted
## Split centre lines at real junctions. Distances use the resulting graph, not air distance.

static func build(roads: Array[Dictionary]) -> Dictionary:
	var points: Array[Vector2] = []
	var adjacency: Array[Dictionary] = []
	for road: Dictionary in roads:
		var cuts: Array[Vector2] = [road.start, road.end]
		for other: Dictionary in roads:
			var crossing: Variant = Geometry2D.segment_intersects_segment(road.start, road.end, other.start, other.end)
			if crossing is Vector2 and not cuts.has(crossing):
				cuts.append(crossing)
		cuts.sort_custom(func(a: Vector2, b: Vector2) -> bool: return a.distance_squared_to(road.start) < b.distance_squared_to(road.start))
		for index: int in range(cuts.size() - 1):
			var a := _node(cuts[index], points, adjacency)
			var b := _node(cuts[index + 1], points, adjacency)
			if a != b:
				adjacency[a][b] = points[a].distance_to(points[b])
				adjacency[b][a] = adjacency[a][b]
	var visited: Dictionary = {}
	var pending: Array[int] = [0]
	while not pending.is_empty():
		var node: int = pending.pop_back()
		if visited.has(node):
			continue
		visited[node] = true
		for neighbor: int in adjacency[node]:
			pending.append(neighbor)
	var intersections := 0
	var dead_ends := 0
	var edges := 0
	for neighbors: Dictionary in adjacency:
		intersections += int(neighbors.size() >= 3)
		dead_ends += int(neighbors.size() == 1)
		edges += neighbors.size()
	var cycles: int = edges / 2 - points.size() + 1
	return {"points": points, "adjacency": adjacency, "connectivity": visited.size() == points.size(), "intersection_count": intersections, "dead_end_count": dead_ends, "loop_count": cycles, "alternative_route_count": 2 if cycles > 0 and visited.size() == points.size() else 1, "road_count": roads.size()}

static func distance(graph: Dictionary, from: Vector2, to: Vector2) -> float:
	var astar := AStar2D.new()
	for index: int in graph.points.size():
		astar.add_point(index, graph.points[index])
	for index: int in graph.adjacency.size():
		for neighbor: int in graph.adjacency[index]:
			astar.connect_points(index, neighbor)
	var start := _attach(astar, graph, from)
	var finish := _attach(astar, graph, to)
	if (start.a == finish.a and start.b == finish.b) or (start.a == finish.b and start.b == finish.a):
		astar.connect_points(start.projection_id, finish.projection_id)
	var path := astar.get_point_path(start.id, finish.id)
	if path.is_empty():
		return INF
	var total := 0.0
	for index: int in range(1, path.size()):
		total += path[index - 1].distance_to(path[index])
	return total

static func _attach(astar: AStar2D, graph: Dictionary, at: Vector2) -> Dictionary:
	var id := astar.get_available_point_id()
	astar.add_point(id, at)
	var best := INF
	var a := 0
	var b := 0
	var projected := Vector2.ZERO
	for index: int in graph.adjacency.size():
		for neighbor: int in graph.adjacency[index]:
			var point := Geometry2D.get_closest_point_to_segment(at, graph.points[index], graph.points[neighbor])
			if point.distance_to(at) < best:
				best = point.distance_to(at)
				projected = point
				a = index
				b = neighbor
	var projection_id := astar.get_available_point_id()
	astar.add_point(projection_id, projected)
	astar.connect_points(id, projection_id)
	astar.connect_points(projection_id, a)
	astar.connect_points(projection_id, b)
	return {"id": id, "projection_id": projection_id, "a": a, "b": b}

static func _node(point: Vector2, points: Array[Vector2], adjacency: Array[Dictionary]) -> int:
	for index: int in points.size():
		if points[index].distance_to(point) < 0.001:
			return index
	points.append(point)
	adjacency.append({})
	return points.size() - 1
