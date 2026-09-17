extends "res://maps/town/environment/town_street_life_pass.gd"
## A reversible presentation pass over the unchanged M01 result.

var _slots_by_id: Dictionary = {}
var _blocks_by_id: Dictionary = {}
var _move_reasons: Dictionary = {}

func generate(town: Dictionary) -> Dictionary:
	super.generate(town)
	var baseline: Array = _result.instances.duplicate(true)
	_slots_by_id.clear()
	_blocks_by_id.clear()
	_move_reasons.clear()
	for slot: Dictionary in _result.slots:
		_slots_by_id[slot.id] = slot
	for block: Dictionary in town.blocks:
		_blocks_by_id[block.id] = block
	_rng.seed = int(town.seed) ^ 0x504F4C49
	_result.phase = "M01.1"
	_result.driveways = []
	_result.park_nodes = []
	_thin_buffers()
	_cargo_nodes()
	_park_nodes()
	_commercial_visibility()
	_residential_surfaces(town)
	_summarize(baseline)
	return _result

func _items(asset: String, block_id: String) -> Array:
	return _result.instances.filter(func(item: Dictionary) -> bool: return item.asset == asset and item.block_id == block_id)

func _valid(rect: Rect2, slot: Dictionary, ignored: Array, others: Array = []) -> bool:
	if not Geometry.contains(slot.polygon, rect):
		return false
	for zone: Dictionary in _result.clear_zones:
		if rect.intersects(zone.bounds):
			return false
	for item: Dictionary in _result.instances:
		if item.id not in ignored and rect.grow(0.35).intersects(item.bounds):
			return false
	for other: Rect2 in others:
		if rect.grow(0.35).intersects(other):
			return false
	return true

func _move(item: Dictionary, point: Vector2, yaw: float, reason: String) -> bool:
	var rect := Geometry.footprint(_boxes[item.asset], point, yaw, item.scale)
	if not _valid(rect, _slots_by_id[item.slot_id], [item.id]):
		return false
	item.position = Vector3(point.x, item.position.y, point.y)
	item.yaw = yaw
	item.bounds = rect
	_move_reasons[item.id] = reason
	return true

func _thin_buffers() -> void:
	var candidates: Array[Dictionary] = []
	for item: Dictionary in _result.instances:
		if item.asset != Rules.BUSH or item.slot_type not in ["GREEN_BUFFER", "RESIDENTIAL_BUFFER", "RESIDENTIAL_YARD", "TOWN_EDGE"]:
			continue
		var nearest_tree := 100.0
		for tree: Dictionary in _items(Rules.TREE, item.block_id):
			nearest_tree = minf(nearest_tree, item.position.distance_to(tree.position))
		var neighbors := 0
		for bush: Dictionary in _items(Rules.BUSH, item.block_id):
			if bush.id != item.id and item.position.distance_to(bush.position) < 3.5:
				neighbors += 1
		# Remove isolated outer dots first; retain tree-root groups and dense cores.
		candidates.append({"id": item.id, "score": nearest_tree - minf(neighbors, 3) * 1.8})
	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.score > b.score if not is_equal_approx(a.score, b.score) else a.id < b.id)
	var removed: Array[String] = []
	for candidate: Dictionary in candidates.slice(0, floori(candidates.size() * 0.38)):
		removed.append(candidate.id)
	_result.instances = _result.instances.filter(func(item: Dictionary) -> bool: return item.id not in removed)
	_result.bush_removed = removed.size()
	_result.removed_bush_ids = removed

func _cargo_nodes() -> void:
	for group: Dictionary in _result.groups:
		if group.kind != "cargo":
			continue
		var members: Array = _result.instances.filter(func(item: Dictionary) -> bool: return item.id in group.members)
		var slot: Dictionary = _slots_by_id[group.slot_id]
		var anchors: Array[Dictionary] = []
		for van: Dictionary in _items(Rules.VAN, slot.block_id):
			var forward := Vector2(-sin(van.yaw), -cos(van.yaw))
			var side := Vector2(forward.y, -forward.x)
			for lateral: float in [0.0, -2.5, 2.5]:
				anchors.append({"point": Geometry.xz(van.position) - forward * 4.2 + side * lateral, "yaw": van.yaw, "van": van.id})
		for retry: int in 12:
			var edge := _edge(slot, retry, 1.4)
			anchors.append({"point": edge.point, "yaw": edge.yaw, "van": ""})
		for anchor: Dictionary in anchors:
			var points: Array[Vector2] = []
			var rects: Array = []
			var pallets := 0
			var valid := true
			for member: Dictionary in members:
				var offset := Vector2(0, 1.4)
				if member.asset == Reuse.PALLET:
					offset = Vector2(pallets * 1.6, 0)
					pallets += 1
				elif member.asset == Reuse.WOOD:
					offset = Vector2(1.45, 1.4)
				var point: Vector2 = anchor.point + offset.rotated(-anchor.yaw)
				var rect := Geometry.footprint(_boxes[member.asset], point, anchor.yaw)
				if not _valid(rect, slot, group.members, rects):
					valid = false
					break
				points.append(point)
				rects.append(rect)
			if not valid:
				continue
			for index: int in members.size():
				var member: Dictionary = members[index]
				member.position = Vector3(points[index].x, 0, points[index].y)
				member.yaw = anchor.yaw
				member.bounds = rects[index]
				_move_reasons[member.id] = "cargo_loading_node"
			group.nearby_van = anchor.van
			break
		var center := Vector3.ZERO
		for member: Dictionary in members:
			center += member.position
		group.center = center / members.size()
		group.nearby_edge = ""
		var nearest := 14.0
		for item: Dictionary in _result.instances:
			if item.block_id == slot.block_id and item.asset in [Rules.FENCE, Reuse.CONCRETE, Reuse.BARRICADE, Reuse.DAMAGED]:
				var distance: float = item.position.distance_to(group.center)
				if distance < nearest:
					nearest = distance
					group.nearby_edge = item.id

func _path_target(point: Vector2, block: Dictionary) -> Vector2:
	var center: Vector2 = block.bounds.get_center()
	return Vector2(point.x, center.y) if absf(point.y - center.y) < absf(point.x - center.x) else Vector2(center.x, point.y)

func _park_nodes() -> void:
	for block: Dictionary in _blocks_by_id.values():
		if block.land_use_type != "OPEN_SPACE":
			continue
		var trees := _items(Rules.TREE, block.id)
		var benches := _items(Reuse.BENCH, block.id)
		var used: Array[String] = []
		var rest_positions: Array[Vector2] = []
		for bench: Dictionary in benches:
			if bench.id in used:
				continue
			var options := trees.duplicate()
			options.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.position.distance_squared_to(bench.position) < b.position.distance_squared_to(bench.position))
			for tree: Dictionary in options:
				var target := _path_target(Geometry.xz(tree.position), block)
				var normal := (Geometry.xz(tree.position) - target).normalized()
				if normal.is_zero_approx():
					continue
				var point := target + normal * 2.5
				if rest_positions.any(func(existing: Vector2) -> bool: return existing.distance_to(point) < 9.0):
					continue
				if point.distance_to(Geometry.xz(tree.position)) > 10:
					continue
				if _move(bench, point, atan2(normal.x, normal.y), "park_rest_node"):
					break
			var target := _path_target(Geometry.xz(bench.position), block)
			var facing := (target - Geometry.xz(bench.position)).normalized()
			_move(bench, Geometry.xz(bench.position), atan2(-facing.x, -facing.y), "park_path_facing")
			var rest_members: Array[String] = [bench.id]
			rest_positions.append(Geometry.xz(bench.position))
			used.append(bench.id)
			var tangent := Vector2(-facing.y, facing.x)
			for partner: Dictionary in benches:
				if partner.id in used or partner.slot_id != bench.slot_id:
					continue
				if _move(partner, Geometry.xz(bench.position) + tangent * 3.2 - facing * 0.35, bench.yaw, "park_bench_pair"):
					rest_members.append(partner.id)
					used.append(partner.id)
					break
			var nearest_tree := ""
			var distance := INF
			for tree: Dictionary in trees:
				var gap: float = tree.position.distance_to(bench.position)
				if gap < distance:
					distance = gap
					nearest_tree = tree.id
			_result.park_nodes.append({"kind": "rest", "members": rest_members, "tree": nearest_tree, "tree_distance": distance, "block_id": block.id, "focus": bench.position, "path_target": target})
		var grouped: Array[String] = []
		for tree: Dictionary in trees:
			if tree.id in grouped:
				continue
			var members: Array[String] = [tree.id]
			var nearby := _items(Rules.TREE, block.id) + _items(Rules.BUSH, block.id)
			nearby.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.position.distance_squared_to(tree.position) < b.position.distance_squared_to(tree.position))
			for item: Dictionary in nearby:
				if item.id == tree.id or item.id in grouped or members.size() >= 4:
					continue
				if item.position.distance_to(tree.position) <= 7.0:
					members.append(item.id)
			if members.size() >= 2:
				grouped.append_array(members)
				_result.park_nodes.append({"kind": "tree_cluster", "members": members, "block_id": block.id, "focus": tree.position})
		for lamp: Dictionary in _items(Rules.LAMP, block.id):
			var bins := _items(Rules.BIN, block.id)
			bins.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.position.distance_squared_to(lamp.position) < b.position.distance_squared_to(lamp.position))
			if not bins.is_empty() and bins[0].position.distance_to(lamp.position) < 8:
				_result.park_nodes.append({"kind": "entrance", "members": [lamp.id, bins[0].id], "block_id": block.id, "focus": lamp.position})
		_result.park_nodes.append({"kind": "open_lawn", "block_id": block.id, "bounds": Rect2(block.bounds.get_center() - Vector2(6, 6), Vector2(12, 12))})

func _commercial_visibility() -> void:
	for item: Dictionary in _result.instances:
		if item.asset != Reuse.VENDING:
			continue
		var slot: Dictionary = _slots_by_id[item.slot_id]
		for zone: Dictionary in _result.clear_zones:
			if zone.kind != "building" or zone.bounds.get_center().distance_to(Geometry.xz(item.position)) > 14:
				continue
			var edge: Rect2 = zone.bounds.grow(0.65)
			# Keep a real wall relationship; prefer its camera-facing side only when legal.
			for candidate: Array in [[Vector2(edge.end.x, edge.get_center().y), -PI / 2], [Vector2(edge.get_center().x, edge.end.y), PI]]:
				var rect := Geometry.footprint(_boxes[item.asset], candidate[0], candidate[1])
				if _valid(rect, slot, [item.id]) and _move(item, candidate[0], candidate[1], "commercial_wall_visibility"):
					break
			break

func _residential_surfaces(town: Dictionary) -> void:
	for item: Dictionary in _result.instances:
		if not item.land_use.begins_with("RESIDENTIAL") or not item.asset.begins_with("VEH_"):
			continue
		var closest: Dictionary = {}
		var road_distance := INF
		for road: Dictionary in town.roads:
			var point := Geometry.xz(item.position)
			var near := point.clamp(road.bounds.position, road.bounds.end)
			var distance := point.distance_to(near)
			if distance < road_distance:
				road_distance = distance
				closest = road
		var point := Geometry.xz(item.position)
		var road_point := point.clamp(closest.bounds.position, closest.bounds.end)
		var delta := road_point - point
		var facing := Vector2(signf(delta.x), 0) if absf(delta.x) > absf(delta.y) else Vector2(0, signf(delta.y))
		var yaw := atan2(-facing.x, -facing.y)
		var walk_edge: Rect2 = closest.bounds.grow(2.2)
		var road_end := point.clamp(walk_edge.position, walk_edge.end)
		var box := Geometry.footprint(_boxes[item.asset], Vector2.ZERO, yaw, item.scale)
		var depth := box.size.x if absf(facing.x) > 0.5 else box.size.y
		var tangent := Vector2(-facing.y, facing.x)
		for offset: float in [0.0, -4.0, 4.0, -8.0, 8.0, -12.0, 12.0]:
			var candidate := road_end - facing * (depth * 0.5 + 1.0) + tangent * offset
			var candidate_pad := Geometry.footprint(_boxes[item.asset], candidate, yaw, item.scale).grow(0.4)
			if candidate.distance_to(point) > 20 or not _valid(candidate_pad, _slots_by_id[item.slot_id], [item.id]):
				continue
			if _move(item, candidate, yaw, "residential_driveway_alignment"):
				point = candidate
				break
		_move(item, point, yaw, "residential_road_alignment")
		var pad: Rect2 = item.bounds.grow(0.28)
		var connector := Rect2()
		var end := point.clamp(walk_edge.position, walk_edge.end)
		var connection := Rect2(point, Vector2.ZERO).expand(end)
		if absf(end.x - point.x) < 0.01:
			connection = connection.grow_individual(1.35, 0, 1.35, 0)
		elif absf(end.y - point.y) < 0.01:
			connection = connection.grow_individual(0, 1.35, 0, 1.35)
		if point.distance_to(end) < 15 and _surface_clear(connection, item.id, town):
			connector = connection
		_result.driveways.append({"vehicle_id": item.id, "block_id": item.block_id, "pad": pad, "connector": connector, "road_id": closest.id, "kind": "driveway" if connector.has_area() else "parking_pad", "surface_y": 0.0})

func _surface_clear(rect: Rect2, vehicle: String, town: Dictionary) -> bool:
	for road: Dictionary in town.roads:
		if rect.intersects(road.bounds):
			return false
	for zone: Dictionary in _result.clear_zones:
		if zone.kind in ["building", "arrival", "poi"] and rect.intersects(zone.bounds):
			return false
	for item: Dictionary in _result.instances:
		if item.id != vehicle and rect.intersects(item.bounds):
			return false
	return true

func _summarize(baseline: Array) -> void:
	var current: Dictionary = {}
	_result.statistics = {}
	_result.by_land_use = {}
	for asset: String in Rules.COUNTS.keys() + Reuse.COUNTS.keys():
		_result.statistics[_count_category(asset)] = 0
	for item: Dictionary in _result.instances:
		current[item.id] = item
		var category := _count_category(item.asset)
		_result.statistics[category] += 1
		if not _result.by_land_use.has(item.land_use):
			_result.by_land_use[item.land_use] = {}
		_result.by_land_use[item.land_use][category] = int(_result.by_land_use[item.land_use].get(category, 0)) + 1
	var changes: Array[Dictionary] = []
	var unchanged := 0
	for old: Dictionary in baseline:
		if not current.has(old.id):
			changes.append({"id": old.id, "reason": "buffer_cluster_thinning", "before": old, "after": {}})
		elif var_to_str(old) != var_to_str(current[old.id]):
			changes.append({"id": old.id, "reason": _move_reasons.get(old.id, "placement"), "before": old, "after": current[old.id]})
		else:
			unchanged += 1
	_result.preservation = {"baseline_count": baseline.size(), "unchanged": unchanged, "removed": _result.bush_removed, "moved": changes.size() - _result.bush_removed, "changes": changes}
