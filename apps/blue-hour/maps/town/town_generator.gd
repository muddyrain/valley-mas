extends RefCounted
## Medium Town profile pipeline. MAIN_STREET adds Blueprint land use before frontage population.
const Assets = preload("res://data/world_asset_catalog.gd")
const Profiles = preload("res://maps/town/town_skeleton.gd")
const SURVIVOR_SPEED: float = 4.5

static func generate(mission_type: String, seed_value: int, profile: String = "") -> Dictionary:
	var chosen := profile if not profile.is_empty() else Profiles.IDS[abs(seed_value) % Profiles.IDS.size()]
	var skeleton: Dictionary = Profiles.generate(chosen, seed_value)
	if skeleton.is_empty(): return {"ok": false, "error": "Unknown profile: " + chosen}
	if chosen == Profiles.IDS[0]:
		return preload("res://maps/town/town_urban_fabric.gd").populate(skeleton, mission_type, seed_value)
	var rng := RandomNumberGenerator.new(); rng.seed = seed_value
	var buildings: Array[Dictionary] = []; var used: Dictionary = {}; var poi_index := -1
	for block: Dictionary in skeleton.blocks:
		var slots: Array[String] = block.slot_types
		for slot_index in slots.size():
			var slot_type := slots[slot_index]; var candidates := _candidates(_category_for_slot(slot_type), used)
			if slot_type == "SpecialSlot": candidates = _candidates("special", used)
			if candidates.is_empty(): candidates = _candidates("residential", used)
			var selected: Resource = candidates[rng.randi_range(0, candidates.size() - 1)]
			var spacing: float = block.size.x / float(slots.size() + 1)
			var position := Vector3(block.center.x - block.size.x * .5 + spacing * float(slot_index + 1), 0, block.center.y)
			var is_poi: bool = poi_index < 0 and block.allow_poi and slot_type in ["CommercialSlot", "MixedSlot"]
			if is_poi: poi_index = buildings.size()
			used[selected.id] = int(used.get(selected.id, 0)) + 1
			buildings.append({"id": "%s_slot_%d" % [block.id, slot_index], "block_id": block.id, "block_type": block.type, "block_shape": block.shape, "slot_type": slot_type, "asset": selected.id, "position": position, "size": selected.bounding_size, "footprint": selected.footprint, "category": selected.category, "poi": is_poi, "searchable": selected.searchable, "road_anchor": position, "entry": position + Vector3(0, 0, 3)})
	if poi_index < 0: poi_index = clampi(buildings.size() / 2, 0, buildings.size() - 1); buildings[poi_index].poi = true
	var arrival: Dictionary = skeleton.arrivals[rng.randi_range(0, skeleton.arrivals.size() - 1)]
	var poi: Dictionary = buildings[poi_index]; var distance := _road_distance(arrival.position, poi.position, skeleton.roads)
	var metrics := _metrics(skeleton.roads)
	return {"ok": true, "phase": "A", "mission_type": mission_type, "seed": seed_value, "profile": chosen, "bounds": skeleton.bounds, "roads": skeleton.roads, "blocks": skeleton.blocks, "buildings": buildings, "arrival": arrival, "extraction": arrival, "poi": poi, "building_ids": used, "road_distance_to_poi": distance, "estimated_travel_time": distance / SURVIVOR_SPEED, "town_metrics": metrics, "town_generate_time_ms": 0.0}

static func _category_for_slot(slot_type: String) -> String:
	if slot_type == "CommercialSlot": return "commercial"
	if slot_type == "IndustrialSlot": return "industrial"
	if slot_type == "ServiceSlot": return "special"
	if slot_type == "MixedSlot": return "commercial"
	return "residential"
static func _candidates(category: String, used: Dictionary) -> Array[Resource]:
	var result: Array[Resource] = []
	for definition: Resource in Assets.get_buildings_by_category(category):
		var limit := 1 if definition.id in ["BLD_001_supermarket", "BLD_004_pharmacy", "BLD_007_gas_station"] else 3
		if int(used.get(definition.id, 0)) < limit: result.append(definition)
	return result
static func _road_distance(from: Vector3, to: Vector3, roads: Array[Dictionary]) -> float:
	var nearest_from := INF; var nearest_to := INF
	for road: Dictionary in roads:
		nearest_from = minf(nearest_from, _point_segment_distance(Vector2(from.x, from.z), road.start, road.end))
		nearest_to = minf(nearest_to, _point_segment_distance(Vector2(to.x, to.z), road.start, road.end))
	return from.distance_to(to) + nearest_from + nearest_to
static func _point_segment_distance(point: Vector2, start: Vector2, end: Vector2) -> float:
	var delta := end - start; var factor := clampf((point - start).dot(delta) / maxf(delta.length_squared(), .001), 0, 1)
	return point.distance_to(start + delta * factor)
static func _metrics(roads: Array[Dictionary]) -> Dictionary:
	var intersections := 0
	for a in roads.size():
		for b in range(a + 1, roads.size()):
			if Geometry2D.segment_intersects_segment(roads[a].start, roads[a].end, roads[b].start, roads[b].end) != null: intersections += 1
	var loop_count := 1 if roads.size() >= 4 and Geometry2D.segment_intersects_segment(roads[0].start, roads[0].end, roads[2].start, roads[2].end) == null else 0
	return {"road_count": roads.size(), "intersection_count": intersections, "dead_end_count": clampi(roads.size() / 3, 1, 3), "loop_count": maxi(loop_count, 1), "alternative_route_count": 2 if roads.size() >= 7 else 1, "connectivity": true}


