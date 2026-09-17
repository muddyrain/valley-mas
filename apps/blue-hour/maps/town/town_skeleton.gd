extends RefCounted
## Seed-driven road profiles. The profile describes rules; no profile stores a fixed town.
const IDS: Array[String] = ["PROFILE_A_MAIN_STREET", "PROFILE_B_OFFSET_GRID", "PROFILE_C_LOOP"]
const BLOCK_TYPES: Array[String] = ["RESIDENTIAL_BLOCK_A", "RESIDENTIAL_BLOCK_B", "COMMERCIAL_STRIP_A", "COMMERCIAL_CORNER_A", "MIXED_BLOCK_A", "INDUSTRIAL_BLOCK_A", "GAS_SERVICE_BLOCK", "PARKING_SERVICE_BLOCK", "ALLEY_BLOCK_A", "SPECIAL_EMPTY_BLOCK"]

static func generate(profile: String, seed_value: int) -> Dictionary:
	if profile not in IDS: return {}
	var rng := RandomNumberGenerator.new(); rng.seed = seed_value
	if profile == IDS[0]:
		return preload("res://maps/town/town_urban_fabric.gd").skeleton(rng)
	var roads: Array[Dictionary] = []
	if profile == IDS[0]: roads = _main_street(rng)
	elif profile == IDS[1]: roads = _offset_grid(rng)
	else: roads = _loop(rng)
	return {"id": profile, "bounds": Rect2(-130.0, -155.0, 260.0, 310.0), "roads": roads, "blocks": _blocks(profile, rng), "arrivals": _arrivals()}

static func _road(start: Vector2, end: Vector2, width: float, kind: String) -> Dictionary:
	return {"start": start, "end": end, "width": width, "kind": kind}
static func _main_street(rng: RandomNumberGenerator) -> Array[Dictionary]:
	var roads: Array[Dictionary] = [_road(Vector2(-118, 0), Vector2(118, rng.randf_range(-20, 20)), 12.0, "main")]
	for index in rng.randi_range(4, 5):
		var x := -82.0 + float(index) * 54.0 + rng.randf_range(-9.0, 9.0); roads.append(_road(Vector2(x, -132), Vector2(x + rng.randf_range(-18, 18), 132), 8.0, "secondary"))
	roads.append(_road(Vector2(-118, -70), Vector2(-48, -70 + rng.randf_range(-8, 8)), 4.0, "alley")); roads.append(_road(Vector2(35, 72), Vector2(116, 72 + rng.randf_range(-8, 8)), 4.0, "alley"))
	return roads
static func _offset_grid(rng: RandomNumberGenerator) -> Array[Dictionary]:
	var roads: Array[Dictionary] = []
	for row in 3:
		var y := -92.0 + float(row) * 84.0 + rng.randf_range(-12, 12); roads.append(_road(Vector2(-122, y), Vector2(122, y + rng.randf_range(-15, 15)), 10.0 if row == 1 else 8.0, "main" if row == 1 else "secondary"))
	for column in 3:
		var x := -72.0 + float(column) * 70.0 + rng.randf_range(-13, 13); roads.append(_road(Vector2(x, -142), Vector2(x + rng.randf_range(-14, 14), 142), 8.0, "secondary"))
	roads.append(_road(Vector2(-100, 118), Vector2(-28, 118 + rng.randf_range(-8, 8)), 4.0, "alley")); roads.append(_road(Vector2(25, -35), Vector2(95, -35 + rng.randf_range(-8, 8)), 4.0, "alley")); return roads
static func _loop(rng: RandomNumberGenerator) -> Array[Dictionary]:
	var skew := rng.randf_range(-16.0, 16.0); var roads: Array[Dictionary] = [_road(Vector2(-102, -112), Vector2(102, -112 + skew), 10.0, "main"), _road(Vector2(102, -112 + skew), Vector2(112, 105), 10.0, "main"), _road(Vector2(112, 105), Vector2(-104, 112 - skew), 10.0, "main"), _road(Vector2(-104, 112 - skew), Vector2(-102, -112), 10.0, "main")]
	for connector in 3:
		var x := -58.0 + float(connector) * 58.0 + rng.randf_range(-8, 8); roads.append(_road(Vector2(x, -108), Vector2(x + rng.randf_range(-16, 16), 108), 8.0, "secondary"))
	roads.append(_road(Vector2(-94, 0), Vector2(96, rng.randf_range(-12, 12)), 7.0, "secondary")); roads.append(_road(Vector2(-8, -108), Vector2(5, 108), 4.0, "alley")); return roads
static func _blocks(profile: String, rng: RandomNumberGenerator) -> Array[Dictionary]:
	var blocks: Array[Dictionary] = []; var shapes: Array[String] = ["RECTANGLE", "L_SHAPE", "CORNER", "LONG_STRIP", "IRREGULAR", "SERVICE_YARD", "DEAD_END_BLOCK"]
	for index in 12:
		var row := index / 4; var column := index % 4; var center := Vector2(-84.0 + float(column) * 56.0, -105.0 + float(row) * 70.0) + Vector2(rng.randf_range(-10, 10), rng.randf_range(-9, 9)); var kind := "RESIDENTIAL_BLOCK_A"
		if index < 3: kind = "COMMERCIAL_STRIP_A"
		elif index == 3 or index == 8: kind = "COMMERCIAL_CORNER_A"
		elif index == 6: kind = "INDUSTRIAL_BLOCK_A"
		elif index == 7: kind = "GAS_SERVICE_BLOCK"
		elif index == 10: kind = "PARKING_SERVICE_BLOCK"
		elif index == 11: kind = "SPECIAL_EMPTY_BLOCK"
		elif index % 3 == 0: kind = "MIXED_BLOCK_A"
		elif index % 2 == 0: kind = "RESIDENTIAL_BLOCK_B"
		var slots: Array[String] = ["ResidentialSlot", "ResidentialSlot", "ResidentialSlot"]
		if kind.begins_with("COMMERCIAL"): slots = ["CommercialSlot", "CommercialSlot", "MixedSlot"]
		elif kind == "INDUSTRIAL_BLOCK_A": slots = ["IndustrialSlot", "IndustrialSlot"]
		elif kind in ["GAS_SERVICE_BLOCK", "PARKING_SERVICE_BLOCK"]: slots = ["ServiceSlot", "CommercialSlot"]
		elif kind == "SPECIAL_EMPTY_BLOCK": slots = ["SpecialSlot"]
		elif kind == "MIXED_BLOCK_A": slots = ["MixedSlot", "ResidentialSlot", "CommercialSlot"]
		if kind.begins_with("RESIDENTIAL") and rng.randf() > 0.45: slots.append("ApartmentSlot")
		blocks.append({"id": "%s%02d" % [profile.substr(9, 1), index + 1], "type": kind, "shape": shapes[rng.randi_range(0, shapes.size() - 1)], "center": center, "size": Vector2(rng.randf_range(38, 50), rng.randf_range(28, 40)), "slot_types": slots, "allow_poi": index in [1, 4, 9]})
	return blocks

static func _arrivals() -> Array[Dictionary]:
	return [{"id": "Arrival_North", "position": Vector3(0, 0, -148), "road_index": 0}, {"id": "Arrival_South", "position": Vector3(0, 0, 148), "road_index": 0}, {"id": "Arrival_West", "position": Vector3(-128, 0, 0), "road_index": 0}, {"id": "Arrival_East", "position": Vector3(128, 0, 0), "road_index": 0}]

