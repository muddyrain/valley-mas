extends RefCounted
## Read-only M02 consumer. All new data belongs to the independent visual layer.

const Targeted = preload("res://maps/town/environment/town_targeted_props.gd")
const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const SEGMENTS := 12
const WIRE_RADIUS := 0.014
const HARD_MAX := 42.0
const SAFE_HEIGHT := 6.0
var _rng := RandomNumberGenerator.new()
var _obstacles: Array[Dictionary] = []
var _buildings: Dictionary = {}

func generate(town: Dictionary, baseline: Dictionary) -> Dictionary:
	_rng.seed = int(town.seed) ^ 0x4D303356
	_obstacles.clear()
	_buildings.clear()
	_measure_obstacles(town, baseline)
	var result := {"seed": town.seed, "phase": "M03", "wires": [], "wire_candidates": [], "parking_marks": [], "commercial_accents": [], "ground_rejections": []}
	var instances: Dictionary = {}
	for item: Dictionary in baseline.instances:
		instances[item.id] = item
	var seen: Dictionary = {}
	for link: Dictionary in baseline.future_wire_links:
		var ordered: Array[String] = [link.from, link.to]
		ordered.sort()
		var key := ordered[0] + ":" + ordered[1]
		var reason := ""
		var pair: Dictionary = {}
		if seen.has(key):
			reason = "duplicate_pair"
		elif not instances.has(link.from) or not instances.has(link.to):
			reason = "missing_endpoint"
		else:
			pair = _wire_pair(link, instances[link.from], instances[link.to])
			reason = pair.rejection_reason
		seen[key] = true
		result.wire_candidates.append({"id": key, "from": link.from, "to": link.to, "accepted": reason.is_empty(), "rejection_reason": reason})
		if reason.is_empty():
			pair.id = key
			result.wires.append(pair)
	_parking_details(baseline, result)
	_frontage_details(town, baseline, result)
	var sum_span := 0.0
	var max_span := 0.0
	var sum_sag := 0.0
	var rejected: Dictionary = {}
	for pair: Dictionary in result.wires:
		sum_span += pair.span
		max_span = maxf(max_span, pair.span)
		sum_sag += pair.sag
	for candidate: Dictionary in result.wire_candidates:
		if not candidate.accepted:
			rejected[candidate.rejection_reason] = int(rejected.get(candidate.rejection_reason, 0)) + 1
	result.statistics = {"seed": town.seed, "m02_base_instance_count": baseline.instances.size(), "wire_candidate_pair_count": baseline.future_wire_links.size(), "wire_accepted_pair_count": result.wires.size(), "wire_rejected_pair_count": result.wire_candidates.size() - result.wires.size(), "wire_rejection_reasons": rejected, "wire_average_span": sum_span / maxf(1, result.wires.size()), "wire_max_span": max_span, "wire_average_sag": sum_sag / maxf(1, result.wires.size()), "parking_ground_detail_count": result.parking_marks.size(), "commercial_surface_accent_count": result.commercial_accents.size(), "road_material_changed": true, "sidewalk_material_changed": true}
	return result

func _measure_obstacles(town: Dictionary, baseline: Dictionary) -> void:
	for site: Dictionary in town.buildings:
		var wrapper := Targeted.UrbanView.instantiate_building(site)
		var box: AABB = wrapper.transform * Geometry.bounds(wrapper).merge(Geometry.bounds(wrapper, true))
		_buildings[site.id] = box
		_obstacles.append({"kind": "building", "bounds": box})
		wrapper.free()
	var tree_id := "VEG_001_tree_broadleaf_a"
	var tree: Node3D = Targeted.Catalog.asset(tree_id).scene.instantiate()
	var crown := Geometry.bounds(tree)
	var trunk := Geometry.bounds(tree, true)
	tree.free()
	for item: Dictionary in baseline.instances:
		if item.asset != tree_id:
			continue
		var transform := Transform3D(Basis(Vector3.UP, item.yaw).scaled(Vector3.ONE * item.scale), item.position)
		_obstacles.append({"kind": "tree_trunk", "bounds": transform * trunk})
		# Conservative full canopy bounds avoid severe crown crossings without moving trees.
		_obstacles.append({"kind": "tree_canopy", "bounds": transform * crown})

func _wire_pair(link: Dictionary, a: Dictionary, b: Dictionary) -> Dictionary:
	var span: float = a.position.distance_to(b.position)
	var result := {"from": a.id, "to": b.id, "span": span, "sag": clampf(0.40 + (span - 25.0) * 0.035, 0.25, 0.85), "lines": [], "rejection_reason": ""}
	if span > HARD_MAX:
		result.rejection_reason = "span_hard_max"
		return result
	if span < 22.0:
		result.rejection_reason = "span_too_short"
		return result
	if a.asset != Targeted.POLE or b.asset != Targeted.POLE or a.placement.anchor != b.placement.anchor or a.placement.road_side != b.placement.road_side:
		result.rejection_reason = "road_context"
		return result
	result.road = a.placement.anchor
	if link.markers != ["WireMarker_01", "WireMarker_02", "WireMarker_03"]:
		result.rejection_reason = "marker_metadata"
		return result
	var wrapper: Node3D = Targeted.Catalog.asset(Targeted.POLE).scene.instantiate()
	for marker_name: String in link.markers:
		var marker := wrapper.get_node_or_null("Anchors/" + marker_name) as Node3D
		if marker == null:
			result.rejection_reason = "missing_marker"
			break
		var local: Vector3 = wrapper.get_node("Anchors").transform * marker.position
		var start: Vector3 = Transform3D(Basis(Vector3.UP, a.yaw).scaled(Vector3.ONE * a.scale), a.position) * local
		var end: Vector3 = Transform3D(Basis(Vector3.UP, b.yaw).scaled(Vector3.ONE * b.scale), b.position) * local
		if start.distance_to(end) > HARD_MAX:
			result.rejection_reason = "span_hard_max"
			break
		var points := PackedVector3Array()
		for index: int in SEGMENTS + 1:
			var t := float(index) / SEGMENTS
			points.append(start.lerp(end, t) - Vector3.UP * (4.0 * result.sag * t * (1.0 - t)))
		result.lines.append({"marker": marker_name, "points": points})
		for index: int in range(1, points.size()):
			if minf(points[index - 1].y, points[index].y) - WIRE_RADIUS < SAFE_HEIGHT:
				result.rejection_reason = "safe_height"
				break
			for obstacle: Dictionary in _obstacles:
				var box: AABB = obstacle.bounds
				if box.grow(WIRE_RADIUS + 0.05).intersects_segment(points[index - 1], points[index]) != null:
					result.rejection_reason = obstacle.kind
					break
			if not result.rejection_reason.is_empty():
				break
		if not result.rejection_reason.is_empty():
			break
	wrapper.free()
	return result

func _ground_clear(rect: Rect2, baseline: Dictionary) -> String:
	for zone: Dictionary in baseline.clear_zones:
		if zone.kind in ["arrival", "poi", "route"] and rect.intersects(zone.bounds):
			return zone.kind
	for item: Dictionary in baseline.instances:
		if rect.grow(0.15).intersects(item.bounds):
			return "existing_prop"
	for box: AABB in _buildings.values():
		var building_rect := Rect2(Geometry.xz(box.position), Vector2(box.size.x, box.size.z))
		if rect.intersects(building_rect):
			return "building"
	return ""

func _parking_details(baseline: Dictionary, result: Dictionary) -> void:
	for sign: Dictionary in baseline.instances:
		if sign.asset != Targeted.PARKING:
			continue
		var slots: Array = baseline.parking_contexts.filter(func(slot: Dictionary) -> bool: return slot.id == sign.placement.anchor)
		if slots.is_empty() or slots[0].land_use.begins_with("RESIDENTIAL"):
			continue
		var slot: Dictionary = slots[0]
		var facing: Vector2 = sign.placement.facing
		var tangent := Vector2(-facing.y, facing.x)
		var placed := false
		for depth: float in [2.2, 3.4, 4.6, 6.0]:
			for lateral: float in [0.0, 1.8, -1.8, 3.6, -3.6]:
				var point := Geometry.xz(sign.position) - facing * depth + tangent * lateral
				var polygon := _oriented_rect(point, facing, Vector2(1.05, 1.5))
				var bounds := Geometry.polygon_bounds(polygon)
				var reason := _ground_clear(bounds, baseline)
				for x: int in range(floori(bounds.position.x / 3.0), ceili(bounds.end.x / 3.0) + 1):
					for z: int in range(floori(bounds.position.y / 11.0), ceili(bounds.end.y / 11.0) + 1):
						if bounds.intersects(Rect2(x * 3.0, z * 11.0, 0.12, 5.0).grow(0.12)):
							reason = "existing_parking_stripe"
				if not Geometry.contains(slot.polygon, bounds):
					reason = "parking_boundary"
				if not reason.is_empty():
					result.ground_rejections.append({"kind": "parking", "anchor": slot.id, "reason": reason})
					continue
				result.parking_marks.append({"kind": "P", "anchor": slot.id, "sign": sign.id, "point": point, "facing": facing, "bounds": bounds, "polygon": polygon, "height": -0.048})
				placed = true
				break
			if placed:
				break

func _frontage_details(town: Dictionary, baseline: Dictionary, result: Dictionary) -> void:
	for site: Dictionary in town.buildings:
		if site.land_use_type not in ["COMMERCIAL_CORE", "MIXED_TRANSITION"] or site.asset.substr(0, 7) not in ["BLD_001", "BLD_005", "BLD_015", "BLD_016", "BLD_017", "BLD_018"]:
			continue
		if _rng.randf() > 0.6:
			continue
		var box: AABB = _buildings[site.id]
		var rect := Rect2(Geometry.xz(box.position), Vector2(box.size.x, box.size.z))
		var facing := (Geometry.xz(site.road_point) - rect.get_center()).normalized()
		facing = Vector2(signf(facing.x), 0) if absf(facing.x) > absf(facing.y) else Vector2(0, signf(facing.y))
		var depth: float = rect.size.x if absf(facing.x) > 0.5 else rect.size.y
		var tangent := Vector2(-facing.y, facing.x)
		var width := _rng.randf_range(1.35, 1.85)
		var length := _rng.randf_range(0.85, 1.15)
		# Project the existing entrance onto the measured facade; do not move its marker.
		var doorway := rect.get_center() + tangent * (Geometry.xz(site.entry) - rect.get_center()).dot(tangent)
		var point := doorway + facing * (depth * 0.5 + length * 0.5 + 0.27)
		var polygon := _oriented_rect(point, facing, Vector2(width, length))
		var bounds := Geometry.polygon_bounds(polygon)
		var reason := _ground_clear(bounds, baseline)
		var on_paving := false
		for road: Dictionary in town.roads:
			if bounds.intersects(road.bounds):
				reason = "road_surface"
			var walk: Rect2 = road.bounds.grow(1.6 if road.kind == "alley" else 2.2)
			if walk.encloses(bounds):
				on_paving = true
		if not on_paving:
			reason = "outside_frontage_paving"
		if not reason.is_empty():
			result.ground_rejections.append({"kind": "commercial", "anchor": site.id, "reason": reason})
			continue
		result.commercial_accents.append({"anchor": site.id, "point": point, "facing": facing, "bounds": bounds, "polygon": polygon, "height": 0.086, "tone": _rng.randf_range(0.0, 1.0)})

func _oriented_rect(point: Vector2, facing: Vector2, size: Vector2) -> PackedVector2Array:
	var side := Vector2(-facing.y, facing.x) * size.x * 0.5
	var depth := facing * size.y * 0.5
	return PackedVector2Array([point - side - depth, point + side - depth, point + side + depth, point - side + depth])
