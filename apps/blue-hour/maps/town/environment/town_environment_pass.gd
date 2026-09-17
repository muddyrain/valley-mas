extends RefCounted
## An additive, deterministic consumer of frozen world geometry.

const Catalog = preload("res://data/world_asset_catalog.gd")
const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const Rules = preload("res://maps/town/environment/town_environment_rules.gd")
const UrbanView = preload("res://maps/town/town_urban_view.gd")
const LandUse = preload("res://maps/town/town_land_use.gd")

var _rng := RandomNumberGenerator.new()
var _boxes: Dictionary = {}
var _result: Dictionary = {}

func generate(town: Dictionary) -> Dictionary:
	_rng.seed = int(town.seed) ^ 0x454E564D
	_result = {"seed": town.seed, "environment_seed": _rng.seed, "instances": [], "slots": [], "clear_zones": [], "rejections": {}, "parking_legal": 0, "parking_occupied": 0, "statistics": {}, "by_land_use": {}}
	for asset_id: String in Rules.COUNTS:
		_result.statistics[Rules.COUNTS[asset_id]] = 0
		if not _boxes.has(asset_id):
			var instance: Node3D = Catalog.asset(asset_id).scene.instantiate()
			_boxes[asset_id] = Geometry.bounds(instance).merge(Geometry.bounds(instance, true))
			instance.free()
	_protect(town)
	_slots(town)
	# Reserve legal parking before small props and vegetation can consume it.
	for slot: Dictionary in _result.slots:
		if slot.type == "PARKING":
			_parking(slot)
		elif slot.type == "RESIDENTIAL_YARD" and not slot.get("private_yard", false):
			for attempt: int in _density_count(LandUse.area(slot.polygon) / 700.0):
				for retry: int in 12:
					if _place(Rules.SEDAN if _rng.randf() < 0.6 else Rules.SUV, _yard_edge(slot.bounds), PI * 0.5 * _rng.randi_range(0, 3), slot):
						break
	for slot: Dictionary in _result.slots:
		if slot.type in ["STREET_EDGE", "SIDEWALK_EDGE", "COMMERCIAL_FRONTAGE", "INDUSTRIAL_EDGE"]:
			_street(slot)
		elif slot.type in ["SERVICE_YARD", "LOADING_YARD", "COMMERCIAL_SIDE"]:
			_service(slot)
		elif slot.type != "PARKING":
			_green(slot)
	_result.parking_occupancy = float(_result.parking_occupied) / maxf(1, _result.parking_legal)
	return _result

func _clear(kind: String, rect: Rect2, owner: String = "") -> void:
	_result.clear_zones.append({"kind": kind, "bounds": rect, "owner": owner})

func _protect(town: Dictionary) -> void:
	for road: Dictionary in town.roads:
		_clear("road", road.bounds, road.id)
		var inner: Rect2 = road.bounds.grow(0.65)
		var outer: Rect2 = road.bounds.grow(2.2)
		for walk: Rect2 in [Rect2(outer.position.x, outer.position.y, outer.size.x, 1.55), Rect2(outer.position.x, inner.end.y, outer.size.x, 1.55), Rect2(outer.position.x, inner.position.y, 1.55, inner.size.y), Rect2(inner.end.x, inner.position.y, 1.55, inner.size.y)]:
			_clear("walk_corridor", walk, road.id)
	for site: Dictionary in town.buildings:
		var wrapper := UrbanView.instantiate_building(site)
		var box: AABB = wrapper.transform * Geometry.bounds(wrapper).merge(Geometry.bounds(wrapper, true))
		_clear("building", Rect2(Vector2(box.position.x, box.position.z), Vector2(box.size.x, box.size.z)).merge(site.bounds).grow(0.55), site.id)
		for marker: Node3D in wrapper.find_children("*", "Marker3D", true, false):
			if "Entrance" in marker.name or "Search" in marker.name or "Front" in marker.name or "RoadAnchor" == marker.name:
				var transform := marker.transform
				var ancestor: Node = marker.get_parent()
				while ancestor != wrapper:
					transform = ancestor.transform * transform
					ancestor = ancestor.get_parent()
				var point := Geometry.xz(wrapper.transform * transform.origin)
				_clear("building_anchor", Rect2(point - Vector2.ONE * 2.0, Vector2.ONE * 4.0), site.id)
		wrapper.free()
		var entry := Geometry.xz(site.entry)
		_clear("entrance", Rect2(entry - Vector2.ONE * 2.0, Vector2.ONE * 4.0), site.id)
		_clear("entry_corridor", Rect2(entry, Vector2.ZERO).expand(Geometry.xz(site.road_point)).grow(1.0), site.id)
	var bus: Node3D = preload("res://scenes/world/vehicles/veh_blue_hour.tscn").instantiate()
	_clear("arrival", Geometry.footprint(Geometry.bounds(bus), Geometry.xz(town.arrival.position), town.arrival.yaw).grow(4.0))
	bus.free()
	_clear("poi", Rect2(Geometry.xz(town.poi.entry) - Vector2.ONE * 4, Vector2.ONE * 8), town.poi.id)
	for route: Dictionary in town.exploration_routes:
		for index: int in range(1, route.points.size()):
			_clear("route", Rect2(route.points[index - 1], Vector2.ZERO).expand(route.points[index]).grow(0.85), route.id)
	for block: Dictionary in town.blocks:
		if block.land_use_type != "OPEN_SPACE":
			continue
		var bounds: Rect2 = block.bounds
		var center := bounds.get_center()
		_clear("park_path", Rect2(bounds.position.x, center.y - 1.4, bounds.size.x, 2.8), block.id)
		_clear("park_path", Rect2(center.x - 1.4, bounds.position.y, 2.8, bounds.size.y), block.id)
		_clear("park_center", Rect2(center - Vector2(6, 6), Vector2(12, 12)), block.id)

func _slot(type: String, points: PackedVector2Array, block: Dictionary, extra: Dictionary = {}) -> void:
	if points.size() < 3 or LandUse.area(points) < 0.1:
		return
	var slot := {"id": "E%04d" % _result.slots.size(), "type": type, "polygon": points, "bounds": Geometry.polygon_bounds(points), "land_use": block.land_use_type, "block_id": block.id}
	slot.merge(extra)
	_result.slots.append(slot)

func _slots(town: Dictionary) -> void:
	var blocks: Dictionary = {}
	var surfaces: Dictionary = {}
	for block: Dictionary in town.blocks:
		blocks[block.id] = block
		for space: Dictionary in block.spaces:
			if block.land_use_type == "OPEN_SPACE":
				_slot(Rules.ground_slot(space.kind, block.land_use_type), space.polygon, block, {"park_paths": true})
			else:
				_surface(surfaces, block.id, space.kind, space.polygon)
		for edge: Dictionary in block.street_edges:
			var a: Vector2 = edge.start - edge.outward * 0.32
			var b: Vector2 = a + edge.tangent * edge.length
			var strip := Rect2(a, Vector2.ZERO).expand(b).grow(1.3)
			var type := "COMMERCIAL_FRONTAGE" if block.land_use_type == "COMMERCIAL_CORE" else "INDUSTRIAL_EDGE" if block.land_use_type == "INDUSTRIAL_SERVICE" else "SIDEWALK_EDGE" if block.land_use_type.begins_with("RESIDENTIAL") else "STREET_EDGE"
			_slot(type, Geometry.polygon(strip), block, {"start": a, "tangent": edge.tangent, "outward": edge.outward, "length": edge.length})
	for space: Dictionary in town.ground_spaces:
		_surface(surfaces, space.owner_block, space.kind, space.polygon)
	for key: String in surfaces:
		var surface: Dictionary = surfaces[key]
		var block: Dictionary = blocks[surface.owner]
		for polygon: PackedVector2Array in _merge_surfaces(surface.polygons):
			var type := Rules.ground_slot(surface.kind, block.land_use_type)
			var envelope: Rect2 = town.developed_envelope
			if surface.kind == "green_buffer" and not envelope.grow(-10).encloses(Geometry.polygon_bounds(polygon)):
				type = "TOWN_EDGE"
			_slot(type, polygon, block)
	# Parcel attribution controls side bins and occasional private driveway vehicles.
	for parcel: Dictionary in town.parcels:
		var block: Dictionary = blocks[parcel.block_id]
		if not block.land_use_type.begins_with("RESIDENTIAL"):
			continue
		_slot("RESIDENTIAL_YARD", Geometry.polygon(parcel.bounds), block, {"parcel_id": parcel.parcel_id, "private_yard": true})

func _surface(surfaces: Dictionary, owner: String, kind: String, polygon: PackedVector2Array) -> void:
	var key := owner + ":" + kind
	if not surfaces.has(key):
		surfaces[key] = {"owner": owner, "kind": kind, "polygons": []}
	surfaces[key].polygons.append(polygon)

func _merge_surfaces(polygons: Array) -> Array:
	var remaining := polygons.duplicate()
	var changed := true
	while changed:
		changed = false
		for a: int in remaining.size():
			for b: int in range(a + 1, remaining.size()):
				var merged := Geometry2D.merge_polygons(remaining[a], remaining[b])
				# Multiple contours can include a hole. Retain source pieces in that case.
				if merged.size() == 1:
					remaining[a] = merged[0]
					remaining.remove_at(b)
					changed = true
					break
			if changed:
				break
	return remaining

func _reason(rect: Rect2, slot: Dictionary, occupied: Array = []) -> String:
	if not Geometry.contains(slot.polygon, rect):
		return "slot_boundary"
	for zone: Dictionary in _result.clear_zones:
		if rect.intersects(zone.bounds):
			return zone.kind
	for item: Dictionary in _result.instances:
		if rect.grow(0.35).intersects(item.bounds):
			return "environment_overlap"
	for other: Rect2 in occupied:
		if rect.grow(0.35).intersects(other):
			return "parking_overlap"
	return ""

func _place(asset: String, point: Vector2, yaw: float, slot: Dictionary, size_scale: float = 1.0) -> bool:
	var rect := Geometry.footprint(_boxes[asset], point, yaw, size_scale)
	var reason := _reason(rect, slot)
	if not reason.is_empty():
		_result.rejections[reason] = int(_result.rejections.get(reason, 0)) + 1
		return false
	_result.instances.append({"id": "Environment_%04d" % _result.instances.size(), "asset": asset, "position": Vector3(point.x, 0.09 if asset == Rules.LAMP else 0.0, point.y), "yaw": yaw, "scale": size_scale, "bounds": rect, "slot_id": slot.id, "slot_type": slot.type, "land_use": slot.land_use, "block_id": slot.block_id})
	var category := _count_category(asset)
	_result.statistics[category] += 1
	if not _result.by_land_use.has(slot.land_use):
		_result.by_land_use[slot.land_use] = {}
	var counts: Dictionary = _result.by_land_use[slot.land_use]
	counts[category] = int(counts.get(category, 0)) + 1
	return true

func _count_category(asset: String) -> String:
	return Rules.COUNTS[asset]

func _point(rect: Rect2) -> Vector2:
	return Vector2(_rng.randf_range(rect.position.x, rect.end.x), _rng.randf_range(rect.position.y, rect.end.y))

func _yard_edge(rect: Rect2) -> Vector2:
	var inset := rect.grow(-3.5)
	if inset.size.x <= 0 or inset.size.y <= 0:
		return rect.get_center()
	var point := _point(inset)
	match _rng.randi_range(0, 3):
		0: point.x = inset.position.x
		1: point.x = inset.end.x
		2: point.y = inset.position.y
		3: point.y = inset.end.y
	return point

func _parking(slot: Dictionary) -> void:
	var legal: Array[Dictionary] = []
	var occupied: Array[Rect2] = []
	var rect: Rect2 = slot.bounds
	# These coordinates are the existing painted 3 x 5 m bays, with an 11 m row pitch.
	for x: int in range(floori(rect.position.x / 3), ceili(rect.end.x / 3)):
		for z: int in range(floori(rect.position.y / 11), ceili(rect.end.y / 11)):
			var point := Vector2(x * 3 + 1.5, z * 11 + 2.5)
			var bay := Rect2(point - Vector2(1.4, 2.5), Vector2(2.8, 5))
			if not _reason(bay, slot, occupied).is_empty():
				continue
			legal.append({"point": point, "rank": _rng.randf()})
			occupied.append(bay)
	_result.parking_legal += legal.size()
	legal.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.rank < b.rank)
	var count := roundi(legal.size() * _rng.randf_range(0.3, 0.5))
	for index: int in count:
		var asset: String = [Rules.SEDAN, Rules.SUV, Rules.VAN][_rng.randi_range(0, 2)]
		if _place(asset, legal[index].point, PI if _rng.randf() < 0.5 else 0.0, slot):
			_result.parking_occupied += 1

func _street(slot: Dictionary) -> void:
	var spacing := 14.0 if slot.land_use == "COMMERCIAL_CORE" else 23.0 if slot.land_use.begins_with("RESIDENTIAL") else 30.0
	var distance := 4.0 + _rng.randf_range(0, 3)
	while distance < slot.length - 3:
		var point: Vector2 = slot.start + slot.tangent * distance
		# The arm runs along the street so the entire asset clears the reserved walk.
		_place(Rules.LAMP, point, atan2(-slot.tangent.x, -slot.tangent.y), slot)
		distance += spacing + _rng.randf_range(-3, 3)

func _service(slot: Dictionary) -> void:
	var area := LandUse.area(slot.polygon)
	if slot.type in ["LOADING_YARD", "SERVICE_YARD"]:
		for attempt: int in _density_count(area / 420.0):
			for retry: int in 6:
				if _place(Rules.VAN if _rng.randf() < 0.7 else Rules.SUV, _point(slot.bounds), PI * 0.5 * _rng.randi_range(0, 3), slot):
					break
		if area > 100:
			var points: PackedVector2Array = slot.polygon
			for edge_index: int in points.size():
				var a := points[edge_index]
				var b := points[(edge_index + 1) % points.size()]
				if a.distance_to(b) < 12 or _rng.randf() > 0.45:
					continue
				var tangent := (b - a).normalized()
				var normal := Vector2(-tangent.y, tangent.x)
				if not Geometry2D.is_point_in_polygon(a.lerp(b, 0.5) + normal, points):
					normal = -normal
				for index: int in 3:
					_place(Rules.FENCE, a + tangent * (3 + index * 4.5) + normal * 1.0, atan2(-tangent.y, tangent.x), slot)
	for attempt: int in _density_count(area / 260.0):
		for retry: int in 5:
			if _place(Rules.BIN, _point(slot.bounds), PI * 0.5 * _rng.randi_range(0, 3), slot):
				break
	if slot.type == "COMMERCIAL_SIDE":
		for attempt: int in _density_count(area / 350.0):
			_place(Rules.BUSH, _point(slot.bounds), _rng.randf_range(0, TAU), slot)

func _density_count(expected: float) -> int:
	return floori(expected) + (1 if _rng.randf() < fmod(expected, 1.0) else 0)

func _green(slot: Dictionary) -> void:
	if slot.get("private_yard", false):
		if _rng.randf() < 0.22:
			for retry: int in 6:
				if _place(Rules.SEDAN if _rng.randf() < 0.6 else Rules.SUV, _point(slot.bounds), PI * 0.5 * _rng.randi_range(0, 3), slot):
					break
		if _rng.randf() < 0.4:
			for retry: int in 5:
				if _place(Rules.BIN, _point(slot.bounds), 0, slot):
					break
		return
	var policy := Rules.vegetation(slot.land_use, slot.type)
	var expected: float = LandUse.area(slot.polygon) / policy.cluster_area
	var clusters := floori(expected) + (1 if _rng.randf() < fmod(expected, 1.0) else 0)
	for cluster: int in clusters:
		var center := _point(slot.bounds)
		for index: int in int(policy.trees) + int(policy.bushes):
			var asset: String = Rules.TREE if index < policy.trees else Rules.BUSH
			for retry: int in 4:
				var point := center + Vector2(_rng.randf_range(-6, 6), _rng.randf_range(-6, 6))
				var size_scale := _rng.randf_range(0.85, 1.12) if asset == Rules.TREE else _rng.randf_range(0.8, 1.15)
				if _place(asset, point, _rng.randf_range(0, TAU), slot, size_scale):
					break
	if slot.get("park_paths", false):
		var center: Vector2 = slot.bounds.get_center()
		for side: float in [-1.0, 1.0]:
			var point := center + Vector2(side * slot.bounds.size.x * 0.32, 2.3)
			_place(Rules.LAMP, point, PI / 2, slot)
			_place(Rules.BIN, point + Vector2(1.5, 0), 0, slot)
