extends "res://maps/town/environment/town_environment_pass.gd"
## Whitelisted reuse adds local compositions to the frozen M00 environment.

const Reuse = preload("res://maps/town/environment/town_reuse_rules.gd")

func generate(town: Dictionary) -> Dictionary:
	super.generate(town)
	_result.phase = "M01"
	_result.base_instances = _result.instances.size()
	_result.groups = []
	_result.openings = []
	_rng.seed = int(town.seed) ^ 0x4D303152
	for asset: String in Reuse.COUNTS:
		_result.statistics[Reuse.COUNTS[asset]] = 0
		if not _boxes.has(asset):
			var instance: Node3D = Catalog.asset(asset).scene.instantiate()
			_boxes[asset] = Geometry.bounds(instance).merge(Geometry.bounds(instance, true))
			instance.free()
	_commercial_nodes(town)
	for slot: Dictionary in _result.slots:
		if Reuse.permits(Reuse.LOW_FENCE, slot):
			_boundary(slot)
		if Reuse.permits(Reuse.PALLET, slot):
			for attempt: int in maxi(1, mini(5, ceili(LandUse.area(slot.polygon) / 160.0))):
				_cargo(slot)
		if Reuse.permits(Reuse.BENCH, slot):
			_benches(slot)
		if Reuse.permits(Reuse.SIGN, slot):
			_scattered_edge(Reuse.SIGN, slot, 1)
		if Reuse.permits(Reuse.CONCRETE, slot) and _rng.randf() < 0.5:
			_scattered_edge(Reuse.CONCRETE, slot, 1)
		if Reuse.permits(Reuse.BARRICADE, slot) and _rng.randf() < 0.22:
			_scattered_edge(Reuse.BARRICADE, slot, 1)
		if Reuse.permits(Reuse.DAMAGED, slot) and _rng.randf() < 0.25:
			_scattered_edge(Reuse.DAMAGED, slot, 1)
	return _result

func _count_category(asset: String) -> String:
	return Reuse.COUNTS[asset] if Reuse.COUNTS.has(asset) else super._count_category(asset)

func _place(asset: String, point: Vector2, yaw: float, slot: Dictionary, size_scale: float = 1.0) -> bool:
	if Reuse.COUNTS.has(asset) and not Reuse.permits(asset, slot):
		return false
	return super._place(asset, point, yaw, slot, size_scale)

func _edge(slot: Dictionary, index: int, inset: float) -> Dictionary:
	var points: PackedVector2Array = slot.polygon
	var a := points[index % points.size()]
	var b := points[(index + 1) % points.size()]
	var tangent := (b - a).normalized()
	var inward := Vector2(-tangent.y, tangent.x)
	if not Geometry2D.is_point_in_polygon(a.lerp(b, 0.5) + inward * 0.1, points):
		inward = -inward
	return {"point": a.lerp(b, _rng.randf_range(0.25, 0.75)) + inward * inset, "tangent": tangent, "inward": inward, "length": a.distance_to(b), "yaw": atan2(-tangent.y, tangent.x)}

func _scattered_edge(asset: String, slot: Dictionary, count: int) -> void:
	# Painted parking surfaces retain all their empty bays as well as parked vehicles.
	if slot.type == "PARKING":
		return
	for attempt: int in count:
		for retry: int in 16:
			var edge := _edge(slot, _rng.randi_range(0, slot.polygon.size() - 1), 1.0)
			var yaw: float = edge.yaw
			if asset in [Reuse.VENDING, Reuse.SIGN]:
				yaw = atan2(-edge.inward.x, -edge.inward.y)
			if _place(asset, edge.point, yaw, slot):
				break

func _commercial_nodes(town: Dictionary) -> void:
	var occupied_blocks: Dictionary = {}
	for site: Dictionary in town.buildings:
		if site.land_use_type not in Reuse.COMMERCIAL or occupied_blocks.has(site.block_id):
			continue
		var exclusion := Rect2()
		for zone: Dictionary in _result.clear_zones:
			if zone.kind == "building" and zone.owner == site.id:
				exclusion = zone.bounds
		var edge := exclusion.grow(0.9)
		var candidates: Array[Vector2] = [Vector2(edge.end.x, edge.get_center().y), Vector2(edge.position.x, edge.get_center().y), Vector2(edge.get_center().x, edge.end.y), Vector2(edge.get_center().x, edge.position.y)]
		for point: Vector2 in candidates:
			var facing := (point - edge.get_center()).normalized()
			var yaw := atan2(-facing.x, -facing.y)
			var placed := false
			for slot: Dictionary in _result.slots:
				if slot.block_id != site.block_id or slot.type == "PARKING" or not Reuse.permits(Reuse.VENDING, slot):
					continue
				if not _place(Reuse.VENDING, point, yaw, slot):
					continue
				occupied_blocks[site.block_id] = true
				placed = true
				if _rng.randf() < 0.3:
					_place(Reuse.PLANTER, point + Vector2(-facing.y, facing.x) * 1.6, yaw, slot)
				break
			if placed:
				break

func _benches(slot: Dictionary) -> void:
	var count := mini(6, maxi(2, ceili(LandUse.area(slot.polygon) / 230.0)))
	var center: Vector2 = slot.bounds.get_center()
	for attempt: int in count:
		for retry: int in 24:
			var side := -1.0 if _rng.randf() < 0.5 else 1.0
			var point := center + Vector2(_rng.randf_range(-slot.bounds.size.x * 0.4, slot.bounds.size.x * 0.4), side * 2.5)
			if _place(Reuse.BENCH, point, 0.0 if side > 0 else PI, slot):
				break

func _cargo(slot: Dictionary) -> void:
	var pallet_count := _rng.randi_range(1, 3)
	var parts: Array[Dictionary] = []
	for index: int in pallet_count:
		parts.append({"asset": Reuse.PALLET, "offset": Vector2(index * 1.65, 0)})
	parts.append({"asset": Reuse.METAL, "offset": Vector2(0, 1.5)})
	if _rng.randf() < Catalog.asset(Reuse.WOOD).spawn_weight:
		parts.append({"asset": Reuse.WOOD, "offset": Vector2(1.65, 1.5)})
	for retry: int in 20:
		var edge := _edge(slot, _rng.randi_range(0, slot.polygon.size() - 1), 2.5)
		if _group(parts, edge.point, edge.yaw, slot, "cargo"):
			return

func _group(parts: Array[Dictionary], center: Vector2, yaw: float, slot: Dictionary, kind: String) -> bool:
	var footprints: Array = []
	var points: Array[Vector2] = []
	for part: Dictionary in parts:
		var point := center + Vector2(part.offset.x, part.offset.y).rotated(-yaw)
		var rect := Geometry.footprint(_boxes[part.asset], point, yaw)
		if not _reason(rect, slot, footprints).is_empty():
			return false
		footprints.append(rect)
		points.append(point)
	var members: Array[String] = []
	for index: int in parts.size():
		if not _place(parts[index].asset, points[index], yaw, slot):
			push_error("Validated composition failed to place")
			return false
		members.append(_result.instances.back().id)
	_result.groups.append({"kind": kind, "members": members, "slot_id": slot.id})
	return true

func _boundary(slot: Dictionary) -> void:
	if slot.get("private_yard", false) and _rng.randf() > 0.55:
		return
	var width: float = _boxes[Reuse.LOW_FENCE].size.x
	for retry: int in 16:
		var edge := _edge(slot, _rng.randi_range(0, slot.polygon.size() - 1), 1.0)
		if edge.length < width * 2 + 2.02:
			continue
		# A centimeter outside each reserved edge prevents float rounding from closing the gap.
		var parts: Array[Dictionary] = [{"asset": Reuse.LOW_FENCE, "offset": Vector2(-(width + 2.02) * 0.5, 0)}, {"asset": Reuse.LOW_FENCE, "offset": Vector2((width + 2.02) * 0.5, 0)}]
		var gap := Geometry.footprint(AABB(Vector3(-1, 0, -0.9), Vector3(2, 1, 1.8)), edge.point, edge.yaw)
		var blocked := not Geometry.contains(slot.polygon, gap)
		for item: Dictionary in _result.instances:
			blocked = blocked or gap.intersects(item.bounds)
		if blocked or not _group(parts, edge.point, edge.yaw, slot, "open_entry"):
			continue
		_clear("residential_opening", gap, slot.id)
		_result.openings.append({"bounds": gap, "width": 2.0, "slot_id": slot.id, "members": _result.groups.back().members})
		return
	_scattered_edge(Reuse.LOW_FENCE, slot, 1)
