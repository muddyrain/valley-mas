extends SceneTree
## Seeded acceptance for the formal MiniMap source and Medium Town street structure.

const Generator = preload("res://maps/town/town_generator.gd")
const EnvironmentPass = preload("res://maps/town/environment/town_targeted_props.gd")
const RoadsidePass = preload("res://maps/town/environment/town_roadside_visual_pass.gd")
const SEEDS: Array[int] = [4101, 4102, 4103, 4104, 4105]
const OUTPUT := "res://test-output/town-phase-1-2"

var checks := 0
var failures: Array[String] = []
var records: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	for seed_value: int in SEEDS:
		_audit_seed(seed_value)
	var source := FileAccess.get_file_as_string("res://ui/expedition/minimap.gd")
	_check(source.find("Medium Town V1") < 0, "Formal MiniMap source has no visible version label")
	_check(source.find("display_name") < 0, "Formal MiniMap source has no visible map name")
	FileAccess.open(OUTPUT.path_join("acceptance-report.json"), FileAccess.WRITE).store_string(JSON.stringify({
		"checks": checks, "failures": failures, "seed_count": records.size(), "seeds": records,
		"requirements": ["roads", "blocks", "land_use", "frontage", "arrival", "parking", "decoration"]
	}, "\t"))
	print("TOWN PHASE 1.2 ACCEPTANCE: %d checks, %d failures" % [checks, failures.size()])
	for failure: String in failures:
		printerr(failure)
	quit(0 if failures.is_empty() else 1)

func _audit_seed(seed_value: int) -> void:
	var town: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	_check(bool(town.get("ok", false)), "Seed %d generates a town" % seed_value)
	if not bool(town.get("ok", false)):
		return
	var duplicate: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	_check(var_to_str(town) == var_to_str(duplicate), "Seed %d is deterministic" % seed_value)
	var roads: Array = town.roads
	var blocks: Array = town.blocks
	var buildings: Array = town.buildings
	var uses: Dictionary = town.blueprint.land_use_distribution
	_check(roads.size() >= 12, "Seed %d has a connected street network" % seed_value)
	_check(int(town.composition.t_junction_count) + int(town.composition.cross_junction_count) >= 4, "Seed %d has street junctions" % seed_value)
	_check(blocks.size() >= 12, "Seed %d has generated blocks" % seed_value)
	_check(buildings.size() >= 45, "Seed %d has dense building placement" % seed_value)
	for use: String in ["RESIDENTIAL_A", "RESIDENTIAL_B", "COMMERCIAL_CORE", "INDUSTRIAL_SERVICE"]:
		_check(int(uses.get(use, 0)) > 0, "Seed %d contains %s" % [seed_value, use])
	_audit_frontage(town, seed_value)
	var environment: Dictionary = EnvironmentPass.new().generate(town)
	var roadside: Dictionary = RoadsidePass.new().generate(town, environment)
	var arrival: Dictionary = town.arrival
	var arrival_point := Vector2(arrival.position.x, arrival.position.z)
	var road_hits := 0
	for road: Dictionary in roads:
		if Geometry2D.get_closest_point_to_segment(arrival_point, road.start, road.end).distance_to(arrival_point) < 0.01:
			road_hits += 1
	var nearby_buildings := 0
	for site: Dictionary in buildings:
		if _rect_distance(arrival_point, site.bounds) <= 34.0:
			nearby_buildings += 1
	var nearby_parking := 0
	for slot: Dictionary in environment.slots:
		if slot.type == "PARKING" and slot.bounds.get_center().distance_to(arrival_point) <= 70.0:
			nearby_parking += 1
	var nearby_decor := 0
	for item: Dictionary in environment.instances:
		if Vector2(item.position.x, item.position.z).distance_to(arrival_point) <= 45.0:
			nearby_decor += 1
	for item: Dictionary in roadside.get("parking_marks", []):
		if Vector2(item.point.x, item.point.y).distance_to(arrival_point) <= 45.0:
			nearby_decor += 1
	_check(road_hits >= 2, "Seed %d Arrival is at a road junction" % seed_value)
	_check(nearby_buildings >= 1, "Seed %d Arrival has a nearby building" % seed_value)
	_check(nearby_parking >= 1, "Seed %d Arrival has nearby parking" % seed_value)
	_check(nearby_decor >= 1, "Seed %d Arrival has nearby environmental decoration" % seed_value)
	records.append({"seed": seed_value, "arrival": arrival.id, "roads": roads.size(), "blocks": blocks.size(),
		"buildings": buildings.size(), "land_use": uses, "junction_roads": road_hits,
		"nearby_buildings": nearby_buildings, "nearby_parking": nearby_parking, "nearby_decoration": nearby_decor,
		"orientation_quarters": town.orientation_quarters, "environment_instances": environment.instances.size(),
		"roadside_parking_marks": roadside.get("parking_marks", []).size()})

func _audit_frontage(town: Dictionary, seed_value: int) -> void:
	for site: Dictionary in town.buildings:
		var assigned := Vector2(site.front_direction.x, site.front_direction.z).normalized()
		var forward := Vector2(site.primary_entrance_forward.x, site.primary_entrance_forward.z).normalized()
		_check(forward.dot(assigned) > 0.999, "Seed %d entrance faces its assigned road" % seed_value)
		var road_found := false
		for road: Dictionary in town.roads:
			if road.id == site.assigned_street_id:
				road_found = true
				_check(_segment_distance(Vector2(site.road_point.x, site.road_point.z), road.start, road.end) < 0.01,
					"Seed %d building frontage reaches its road" % seed_value)
				break
		_check(road_found, "Seed %d building frontage references a road" % seed_value)

func _rect_distance(point: Vector2, rect: Rect2) -> float:
	return point.distance_to(point.clamp(rect.position, rect.end))

func _segment_distance(point: Vector2, start: Vector2, end: Vector2) -> float:
	return point.distance_to(Geometry2D.get_closest_point_to_segment(point, start, end))

func _check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
