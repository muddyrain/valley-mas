extends RefCounted
## MAIN_STREET composition stage of TownGenerator. All parcels derive from its road-bounded blocks.

const Assets = preload("res://data/world_asset_catalog.gd")
const Graph = preload("res://maps/town/town_road_graph.gd")
const LandUse = preload("res://maps/town/town_land_use.gd")

static func skeleton(rng: RandomNumberGenerator) -> Dictionary:
	return preload("res://maps/town/town_main_street.gd").generate(rng)

static func populate(layout: Dictionary, mission_type: String, seed_value: int) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var town := {"ok": true, "phase": "Blueprint Alignment", "profile": layout.id, "seed": seed_value, "mission_type": mission_type, "bounds": layout.bounds, "roads": layout.roads, "blocks": layout.blocks, "parcels": [], "buildings": [], "building_ids": {}, "gaps": {"residential": [], "commercial": []}, "town_generate_time_ms": 0.0}
	town.town_metrics = Graph.build(town.roads)
	LandUse.assign(town)
	for block: Dictionary in town.blocks:
		for row: Dictionary in block.rows:
			_row(town, block, _edge(block, row.side), row.category, row.count, row.gap, rng, row.get("trim_end", 0.0), row.get("trim_start", 0.0))
			if not town.ok:
				return town
		_internal_spaces(block)
	town.composition = preload("res://maps/town/town_main_street.gd").metrics(town)
	LandUse.finish(town, layout.arrivals, rng)
	return town

static func _row(town: Dictionary, block: Dictionary, edge: Dictionary, category: String, count: int, gap: float, rng: RandomNumberGenerator, trim_end: float = 0.0, trim_start: float = 0.0) -> void:
	if edge.is_empty():
		town.ok = false
		town.error = "Missing actual frontage in " + block.id
		return
	var start: Vector2 = edge.start + edge.tangent * (2.0 + trim_start)
	var available: float = edge.length - 4.0 - trim_end - trim_start
	var definitions: Array[Resource] = []
	var total_width := 0.0
	var previous: String = town.buildings.back().asset if not town.buildings.is_empty() else ""
	for index: int in count:
		var candidates: Array[Resource] = []
		var width_limit := (available - total_width - gap * (count - 1)) / float(count - index)
		for definition: Resource in Assets.get_buildings_by_category(category):
			var limit := 1 if definition.poi_type in ["supermarket", "pharmacy", "gas_station"] else 4
			var depth_limit := 9.5 if category == "commercial" else 17.0
			if block.land_use_type == "RESIDENTIAL_B":
				depth_limit = 13.5
			if int(town.building_ids.get(definition.id, 0)) >= limit or definition.id == previous:
				continue
			if definition.footprint.x <= width_limit and definition.footprint.y <= depth_limit:
				candidates.append(definition)
		if candidates.is_empty():
			town.ok = false
			town.error = "No fitting %s candidate in %s (width %.2f)" % [category, block.id, width_limit]
			return
		if block.land_use_type == "COMMERCIAL_CORE":
			var deeper: Array[Resource] = candidates.filter(func(item: Resource) -> bool: return item.footprint.y >= 5.1)
			if not deeper.is_empty():
				candidates = deeper
		var selected: Resource = candidates[rng.randi_range(0, candidates.size() - 1)]
		definitions.append(selected)
		total_width += selected.footprint.x
		town.building_ids[selected.id] = int(town.building_ids.get(selected.id, 0)) + 1
		previous = selected.id
	var cursor := (available - total_width - gap * (count - 1)) * 0.5
	for index: int in definitions.size():
		var definition: Resource = definitions[index]
		var setback := 2.4 if category == "commercial" else 3.2
		var facing: Vector2 = edge.outward
		var yaw := atan2(-facing.x, -facing.y)
		var basis := Basis(Vector3.UP, yaw)
		var front_on_edge: Vector2 = start + edge.tangent * (cursor + definition.footprint.x * 0.5)
		var center: Vector2 = front_on_edge - facing * (setback + definition.footprint.y * 0.5)
		var position := Vector3(center.x, 0, center.y)
		var world_size: Vector2 = definition.footprint if absf(facing.y) > 0.5 else Vector2(definition.footprint.y, definition.footprint.x)
		var bounds := Rect2(center - world_size * 0.5, world_size)
		var parcel_bounds := bounds.grow(gap * 0.5)
		parcel_bounds = parcel_bounds.expand(front_on_edge - edge.tangent * (definition.footprint.x + gap) * 0.5)
		parcel_bounds = parcel_bounds.expand(front_on_edge + edge.tangent * (definition.footprint.x + gap) * 0.5)
		# At a block end, the exterior half-gap belongs to the public street, not this lot.
		parcel_bounds = parcel_bounds.intersection(block.bounds)
		var lot_outline := PackedVector2Array([parcel_bounds.position, Vector2(parcel_bounds.end.x, parcel_bounds.position.y), parcel_bounds.end, Vector2(parcel_bounds.position.x, parcel_bounds.end.y)])
		if not Geometry2D.clip_polygons(lot_outline, block.polygon).is_empty():
			town.ok = false
			town.error = "Parcel exceeds actual polygon in " + block.id
			return
		var id := "%s_P%02d" % [block.id, town.parcels.size()]
		var road_point: Vector2 = front_on_edge + facing * edge.road_half_width
		var building := {"id": id, "block_id": block.id, "block_type": block.type, "block_shape": block.shape, "slot_type": category.capitalize() + "Slot", "asset": definition.id, "position": position, "yaw": yaw, "size": definition.bounding_size, "footprint": definition.footprint, "bounds": bounds, "category": category, "front_direction": Vector3(facing.x, 0, facing.y), "searchable": definition.searchable, "poi": false, "entry": position + basis * definition.entrance_offset, "road_anchor": position + basis * definition.road_offset, "road_point": Vector3(road_point.x, 0, road_point.y)}
		building.land_use_type = block.land_use_type
		town.buildings.append(building)
		town.parcels.append({"parcel_id": id, "block_id": block.id, "frontage_edge": edge.side, "frontage_length": parcel_bounds.size.x if absf(facing.y) > 0.5 else parcel_bounds.size.y, "depth": parcel_bounds.size.y if absf(facing.y) > 0.5 else parcel_bounds.size.x, "setback": setback, "building_slot_type": building.slot_type, "bounds": parcel_bounds, "building_bounds": bounds, "road_point": building.road_point})
		if index > 0 and town.gaps.has(category):
			town.gaps[category].append(gap)
		cursor += definition.footprint.x + gap

static func _internal_spaces(block: Dictionary) -> void:
	# Land-use surfaces retain the exact boundary, including rear recesses and terminal caps.
	block.spaces.append({"kind": block.space_use, "polygon": block.polygon, "bounds": block.bounds})

static func _edge(block: Dictionary, side: String) -> Dictionary:
	for edge: Dictionary in block.street_edges:
		if edge.side == side:
			return edge
	return {}
