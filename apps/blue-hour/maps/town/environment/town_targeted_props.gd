extends RefCounted
## Additive semantic placements over a fully reproducible M01.1 baseline.

const Baseline = preload("res://maps/town/environment/town_environment_polish.gd")
const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const Catalog = preload("res://data/world_asset_catalog.gd")
const UrbanView = preload("res://maps/town/town_urban_view.gd")
const POLE := "PRP_Utility_Pole_A"
const PARKING := "PRP_Parking_Sign_A"
const AFRAME := "PRP_Storefront_AFrame_Sign_A"
const BICYCLE := "PRP_Bicycle_A"
const ASSETS: Array[String] = [POLE, PARKING, AFRAME, BICYCLE]
var _rng := RandomNumberGenerator.new()
var _result: Dictionary
var _town: Dictionary
var _boxes: Dictionary = {}
var _building_boxes: Dictionary = {}

func generate(town: Dictionary) -> Dictionary:
	_town = town
	_result = Baseline.new().generate(town)
	_result.phase = "M02"
	_result.baseline_count = _result.instances.size()
	_result.placement_seed = int(town.seed) ^ 0x4D303250
	_result.new_counts = {POLE: 0, PARKING: 0, AFRAME: 0, BICYCLE: 0}
	_result.placement_candidates = []
	_result.placement_rejections = {}
	_result.future_wire_links = []
	_result.parking_contexts = []
	_rng.seed = _result.placement_seed
	_building_boxes.clear()
	for asset: String in ASSETS:
		var wrapper: Node3D = Catalog.asset(asset).scene.instantiate()
		_boxes[asset] = Geometry.bounds(wrapper).merge(Geometry.bounds(wrapper, true))
		wrapper.free()
	for site: Dictionary in town.buildings:
		var wrapper := UrbanView.instantiate_building(site)
		var box: AABB = wrapper.transform * Geometry.bounds(wrapper).merge(Geometry.bounds(wrapper, true))
		_building_boxes[site.id] = Rect2(Vector2(box.position.x, box.position.z), Vector2(box.size.x, box.size.z))
		wrapper.free()
	for slot: Dictionary in _result.slots:
		if slot.type == "PARKING":
			_result.parking_contexts.append(slot)
	_poles()
	_parking_signs()
	_shop_signs()
	_bicycles()
	_link_poles()
	return _result

func _slot_at(rect: Rect2, block_id: String) -> Dictionary:
	for slot: Dictionary in _result.slots:
		if slot.block_id == block_id and Geometry.contains(slot.polygon, rect):
			return slot
	return {}

func rejection(asset: String, rect: Rect2, block_id: String) -> String:
	var inside := false
	for slot: Dictionary in _result.slots:
		if slot.block_id == block_id and Geometry.contains(slot.polygon, rect):
			inside = true
			break
	if not inside:
		return "surface_boundary"
	for zone: Dictionary in _result.clear_zones:
		var guard: Rect2 = zone.bounds.grow(0.6) if asset == BICYCLE and zone.kind == "walk_corridor" else zone.bounds
		if rect.intersects(guard):
			return zone.kind
	for surface: Dictionary in _result.driveways:
		for area: Rect2 in [surface.pad, surface.connector]:
			if area.has_area() and rect.intersects(area.grow(1.5 if asset == POLE else 0.15)):
				return "driveway_or_pad"
	# The whole painted lot is reserved, including empty bays and manoeuvring aisles.
	for slot: Dictionary in _result.parking_contexts:
		if not Geometry2D.intersect_polygons(Geometry.polygon(rect), slot.polygon).is_empty():
			return "parking_surface"
	for opening: Dictionary in _result.openings:
		if rect.intersects(opening.bounds):
			return "residential_opening"
	for item: Dictionary in _result.instances:
		if rect.grow(0.35).intersects(item.bounds):
			return "environment_overlap"
		if asset == POLE and item.asset == POLE and rect.get_center().distance_to(item.bounds.get_center()) < 22.0:
			return "pole_spacing"
	return ""

func _try(asset: String, point: Vector2, yaw: float, block: Dictionary, context: Dictionary) -> bool:
	var rect := Geometry.footprint(_boxes[asset], point, yaw)
	var reason := rejection(asset, rect, block.id)
	var record := {"asset": asset, "position": Vector3(point.x, 0, point.y), "yaw": yaw, "zone": context.zone, "anchor": context.anchor, "placement_reason": context.reason, "rejection_reason": reason, "accepted": reason.is_empty()}
	_result.placement_candidates.append(record)
	if not reason.is_empty():
		_result.placement_rejections[reason] = int(_result.placement_rejections.get(reason, 0)) + 1
		return false
	var slot := _slot_at(rect, block.id)
	var item := {"id": "M02_%03d" % (_result.instances.size() - _result.baseline_count), "asset": asset, "position": record.position, "yaw": yaw, "scale": 1.0, "bounds": rect, "slot_id": slot.id, "slot_type": slot.type, "land_use": block.land_use_type, "block_id": block.id, "placement": context, "rejection_reason": ""}
	record.instance_id = item.id
	_result.instances.append(item)
	_result.new_counts[asset] += 1
	_result.statistics[asset] = _result.new_counts[asset]
	if not _result.by_land_use.has(block.land_use_type):
		_result.by_land_use[block.land_use_type] = {}
	var land_counts: Dictionary = _result.by_land_use[block.land_use_type]
	land_counts[asset] = int(land_counts.get(asset, 0)) + 1
	return true

func _poles() -> void:
	for road: Dictionary in _town.roads:
		var tangent: Vector2 = (road.end - road.start).normalized()
		var normal := Vector2(-tangent.y, tangent.x)
		var stations: Array[float] = []
		var distance := _rng.randf_range(8.0, 12.0)
		while distance < road.start.distance_to(road.end) - 5:
			stations.append(distance)
			distance += _rng.randf_range(25, 32)
		# Select a consistent road side by legal capacity, not arbitrary block iteration order.
		var best: Array[Dictionary] = []
		var evaluated: Array[Dictionary] = []
		for side: float in [-1.0, 1.0]:
			var candidates: Array[Dictionary] = []
			for station: float in stations:
				var chosen: Dictionary = {}
				for inset: float in [3.5, 4.2, 5.0]:
					var point: Vector2 = road.start + tangent * station + normal * side * (road.width * 0.5 + inset)
					for slot: Dictionary in _result.slots:
						if slot.land_use not in Catalog.asset(POLE).environment_tags or not Geometry2D.is_point_in_polygon(point, slot.polygon):
							continue
						var yaw := atan2(-tangent.x, -tangent.y)
						var reason := rejection(POLE, Geometry.footprint(_boxes[POLE], point, yaw), slot.block_id)
						if reason.is_empty():
							chosen = {"point": point, "yaw": yaw, "block": _block(slot.block_id), "context": {"zone": slot.land_use, "anchor": road.id, "reason": "sidewalk_outer_edge", "road_side": str(side), "distance_along": station}}
						else:
							_result.placement_candidates.append({"asset": POLE, "position": Vector3(point.x, 0, point.y), "yaw": yaw, "zone": slot.land_use, "anchor": road.id, "placement_reason": "sidewalk_outer_edge", "rejection_reason": reason, "accepted": false})
							_result.placement_rejections[reason] = int(_result.placement_rejections.get(reason, 0)) + 1
						break
					if not chosen.is_empty():
						break
				if not chosen.is_empty():
					candidates.append(chosen)
					evaluated.append(chosen)
			if candidates.size() > best.size():
				best = candidates
		for candidate: Dictionary in evaluated:
			if candidate in best:
				continue
			_result.placement_candidates.append({"asset": POLE, "position": Vector3(candidate.point.x, 0, candidate.point.y), "yaw": candidate.yaw, "zone": candidate.context.zone, "anchor": road.id, "placement_reason": "sidewalk_outer_edge", "rejection_reason": "road_side_preference", "accepted": false})
			_result.placement_rejections.road_side_preference = int(_result.placement_rejections.get("road_side_preference", 0)) + 1
		for candidate: Dictionary in best:
			_try(POLE, candidate.point, candidate.yaw, candidate.block, candidate.context)

func _block(id: String) -> Dictionary:
	return _town.blocks.filter(func(block: Dictionary) -> bool: return block.id == id)[0]

func _road_facing(point: Vector2) -> Vector2:
	var distance := INF
	var facing := Vector2.DOWN
	for road: Dictionary in _town.roads:
		var nearest := point.clamp(road.bounds.position, road.bounds.end)
		if point.distance_to(nearest) < distance:
			distance = point.distance_to(nearest)
			facing = (nearest - point).normalized()
	return facing

func _parking_signs() -> void:
	for parking: Dictionary in _result.parking_contexts:
		var block := _block(parking.block_id)
		if block.land_use_type.begins_with("RESIDENTIAL"):
			continue
		var points: PackedVector2Array = parking.polygon
		var placed := false
		for index: int in points.size():
			var a := points[index]
			var b := points[(index + 1) % points.size()]
			var outward := Vector2(-(b - a).y, (b - a).x).normalized()
			if Geometry2D.is_point_in_polygon(a.lerp(b, 0.5) + outward * 0.1, points):
				outward = -outward
			for ratio: float in [0.15, 0.85, 0.35, 0.65]:
				var point := a.lerp(b, ratio) + outward * 0.75
				var facing := _road_facing(point)
				var context := {"zone": "PARKING", "anchor": parking.id, "reason": "parking_row_edge", "parking_polygon": points, "facing": facing}
				if _try(PARKING, point, atan2(-facing.x, -facing.y), block, context):
					placed = true
					break
			if placed:
				break

func _shop_signs() -> void:
	for site: Dictionary in _town.buildings:
		if site.land_use_type not in ["COMMERCIAL_CORE", "MIXED_TRANSITION"] or not site.asset.substr(0, 7) in ["BLD_001", "BLD_005", "BLD_015", "BLD_016", "BLD_017", "BLD_018"]:
			continue
		if _rng.randf() > 0.65:
			continue
		var box: Rect2 = _building_boxes[site.id]
		var facing := (Geometry.xz(site.road_point) - Geometry.xz(site.position)).normalized()
		facing = Vector2(signf(facing.x), 0) if absf(facing.x) > absf(facing.y) else Vector2(0, signf(facing.y))
		var tangent := Vector2(-facing.y, facing.x)
		var half_depth: float = box.size.x * 0.5 if absf(facing.x) > 0.5 else box.size.y * 0.5
		var half_width: float = box.size.y * 0.5 if absf(facing.x) > 0.5 else box.size.x * 0.5
		var placed := false
		for side: float in [-1.0, 1.0]:
			for ratio: float in [0.6, 0.82, 0.4]:
				var point := box.get_center() + facing * (half_depth + 1.05) + tangent * half_width * ratio * side
				var context := {"zone": "COMMERCIAL_FRONTAGE", "anchor": site.id, "reason": "shop_frontage", "facade_bounds": box, "facing": facing, "wall_distance": 1.05}
				if _try(AFRAME, point, atan2(-facing.x, -facing.y), _block(site.block_id), context):
					placed = true
					break
			if placed:
				break
		if not placed:
			# Facades are only 0.2m behind the sidewalk outer edge. Front corners
			# offer a shop-related recess while retaining the whole walking corridor.
			for side: float in [-1.0, 1.0]:
				var point := box.get_center() + facing * (half_depth - 0.5) + tangent * (half_width + 1.05) * side
				var context := {"zone": "COMMERCIAL_FRONTAGE", "anchor": site.id, "reason": "shop_front_corner_recess", "facade_bounds": box, "facing": facing, "wall_distance": 1.05, "facade_setback": 0.5}
				if _try(AFRAME, point, atan2(-facing.x, -facing.y), _block(site.block_id), context):
					break

func _bicycles() -> void:
	var occupied: Dictionary = {}
	for site: Dictionary in _town.buildings:
		var residential: bool = site.land_use_type.begins_with("RESIDENTIAL")
		if not residential and site.land_use_type not in ["COMMERCIAL_CORE", "MIXED_TRANSITION"]:
			continue
		if occupied.has(site.block_id) or _rng.randf() > 0.45:
			continue
		var box: Rect2 = _building_boxes[site.id]
		var facing := _road_facing(box.get_center())
		var points: Array[Vector2] = [Vector2(box.end.x + 1.4, box.get_center().y), Vector2(box.position.x - 1.4, box.get_center().y), Vector2(box.get_center().x, box.end.y + 1.4), Vector2(box.get_center().x, box.position.y - 1.4)]
		for point: Vector2 in points:
			var normal := (point - box.get_center()).normalized()
			var tangent := Vector2(-normal.y, normal.x) * (-1 if _rng.randf() < 0.5 else 1)
			var yaw := atan2(-tangent.x, -tangent.y) + deg_to_rad(_rng.randf_range(-15, 15))
			var context := {"zone": "RESIDENTIAL" if residential else "COMMERCIAL", "anchor": site.id, "reason": "building_side_wall", "wall_bounds": box, "road_facing": facing}
			if _try(BICYCLE, point, yaw, _block(site.block_id), context):
				occupied[site.block_id] = true
				break
	for block: Dictionary in _town.blocks:
		if block.land_use_type != "OPEN_SPACE" or _rng.randf() > 0.55:
			continue
		var placed := false
		for node: Dictionary in _result.park_nodes:
			if node.block_id != block.id or node.kind != "entrance":
				continue
			for offset: Vector2 in [Vector2(3, 2.3), Vector2(-3, 2.3), Vector2(3, -2.3), Vector2(-3, -2.3)]:
				var point := Geometry.xz(node.focus) + offset
				var edge_distance: float = minf(minf(point.x - block.bounds.position.x, block.bounds.end.x - point.x), minf(point.y - block.bounds.position.y, block.bounds.end.y - point.y))
				if edge_distance > 8:
					continue
				if _try(BICYCLE, point, PI / 2 + deg_to_rad(_rng.randf_range(-15, 15)), block, {"zone": "PARK_EDGE", "anchor": node.members[0], "reason": "park_entrance", "entrance": node.focus}):
					placed = true
					break
			if placed:
				break

func _link_poles() -> void:
	var poles: Array = _result.instances.filter(func(item: Dictionary) -> bool: return item.asset == POLE)
	for index: int in poles.size():
		var a: Dictionary = poles[index]
		var nearest: Dictionary = {}
		var distance := 35.001
		for b: Dictionary in poles.slice(index + 1):
			if a.placement.anchor != b.placement.anchor or a.placement.road_side != b.placement.road_side:
				continue
			var gap: float = a.position.distance_to(b.position)
			if gap < distance:
				distance = gap
				nearest = b
		if not nearest.is_empty():
			_result.future_wire_links.append({"from": a.id, "to": nearest.id, "distance": distance, "markers": ["WireMarker_01", "WireMarker_02", "WireMarker_03"], "rendered": false})
