extends SceneTree
## Full contract for authored entrances, deterministic frontage selection, and Town placement.

const Assets = preload("res://data/world_asset_catalog.gd")
const Facing = preload("res://maps/town/building_entrance_facing.gd")
const Generator = preload("res://maps/town/town_generator.gd")
const View = preload("res://maps/town/town_urban_view.gd")
const OUTPUT := "res://test-output/building-entrance-facing/"
const SEEDS: Array[int] = [4101, 4102, 4103, 4104, 7301, 7302, 7303, 7304, 9917, 12031]

var checks: int = 0
var failures: Array[String] = []
var rows: Array[Dictionary] = []
var covered: Dictionary = {}
var rotation_coverage: Dictionary = {}

func _initialize() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	_audit_definitions()
	_audit_cardinal_transforms()
	_audit_corner_frontages()
	for seed_value: int in SEEDS:
		_audit_seed(seed_value)
	_check(covered.size() >= 20, "Ten formal seeds cover at least 20 of 22 building definitions")
	for quarter: int in 4:
		_check(rotation_coverage.has(quarter), "Generated towns cover %d-degree placement" % (quarter * 90))
	_check(_generator_has_no_instance_patch(), "Generator has no building-ID, seed, or position facing patch")
	var report := {
		"checks": checks,
		"failures": failures,
		"seed_count": SEEDS.size(),
		"seeds": SEEDS,
		"generated_asset_count": covered.size(),
		"rotation_quarters": rotation_coverage.keys(),
		"rows": rows,
	}
	FileAccess.open(OUTPUT + "automatic_geometry_report.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("BUILDING ENTRANCE FACING: %d checks, %d failures, %d instances, %d assets" % [checks, failures.size(), rows.size(), covered.size()])
	for failure: String in failures:
		printerr(failure)
	quit(0 if failures.is_empty() else 1)

func _audit_definitions() -> void:
	var definitions: Array[Resource] = Assets.get_buildings_by_category("")
	_check(definitions.size() == 22, "Audit covers exactly BLD_001 through BLD_022")
	for index: int in definitions.size():
		var definition: Resource = definitions[index]
		_check(definition.building_id == "BLD_%03d" % (index + 1), "Catalog order contains BLD_%03d" % (index + 1))
		_check(definition.primary_entrance_local_anchor.is_finite(), definition.building_id + " primary entrance anchor is explicit")
		_check(definition.primary_entrance_local_forward.is_finite() and definition.primary_entrance_local_forward.length() > 0.99, definition.building_id + " primary entrance forward is explicit")
		_check(definition.search_interaction_local_anchor.is_finite(), definition.building_id + " search interaction anchor is explicit")
		_check(definition.primary_entrance_local_anchor.distance_to(definition.search_interaction_local_anchor) > 0.25, definition.building_id + " separates the physical door from the legal stand point")
		var wrapper: Node3D = definition.scene.instantiate()
		var entrance: Marker3D = wrapper.get_node("Anchors/EntranceMarker")
		var search: Marker3D = wrapper.get_node("Anchors/SearchMarker")
		_check(entrance.position.distance_to(definition.primary_entrance_local_anchor) < 0.001, definition.building_id + " EntranceMarker matches metadata")
		_check(search.position.distance_to(definition.search_interaction_local_anchor) < 0.001, definition.building_id + " SearchMarker matches metadata")
		var outside: Vector3 = definition.search_interaction_local_anchor - definition.primary_entrance_local_anchor
		_check(outside.normalized().dot(definition.primary_entrance_local_forward.normalized()) > 0.999, definition.building_id + " search point lies outside the primary door")
		wrapper.free()

func _audit_cardinal_transforms() -> void:
	var assigned: Array[Vector3] = [Vector3.FORWARD, Vector3.RIGHT, Vector3.BACK, Vector3.LEFT]
	for definition: Resource in Assets.get_buildings_by_category(""):
		for quarter: int in 4:
			var yaw := Facing.placement_yaw(definition.primary_entrance_local_forward, assigned[quarter])
			var forward := Facing.world_forward(yaw, definition.primary_entrance_local_forward)
			_check(forward.dot(assigned[quarter]) > 0.9999, "%s synthetic %d-degree transform faces assigned frontage" % [definition.building_id, quarter * 90])
			var origin := Vector3(7.0, 0.0, -11.0)
			var door := Facing.world_anchor(origin, yaw, definition.primary_entrance_local_anchor)
			var stand := Facing.world_anchor(origin, yaw, definition.search_interaction_local_anchor)
			_check((stand - door).normalized().dot(forward) > 0.999, "%s synthetic %d-degree search point transforms once" % [definition.building_id, quarter * 90])

func _audit_corner_frontages() -> void:
	var lower := {"side": "south", "road_id": "secondary", "road_kind": "secondary", "length": 50.0}
	var higher := {"side": "east", "road_id": "main", "road_kind": "main", "length": 20.0}
	var block := {"id": "CORNER", "street_edges": [lower, higher]}
	_check(Facing.select_frontage(block, {"side": "south"}, 4101, 0).road_id == "secondary", "Explicit assigned primary frontage wins")
	_check(Facing.select_frontage(block, {}, 4101, 0).road_id == "main", "Road class wins without an assigned frontage")
	var short := {"side": "north", "road_id": "short", "road_kind": "main", "length": 15.0}
	var long := {"side": "west", "road_id": "long", "road_kind": "main", "length": 30.0}
	block.street_edges = [short, long]
	_check(Facing.select_frontage(block, {}, 4101, 0).road_id == "long", "Longer frontage wins within one road class")
	var equal_a := {"side": "north", "road_id": "equal_a", "road_kind": "main", "length": 30.0}
	var equal_b := {"side": "west", "road_id": "equal_b", "road_kind": "main", "length": 30.0}
	block.street_edges = [equal_a, equal_b]
	var selected: Dictionary = Facing.select_frontage(block, {}, 7301, 2)
	for repeat: int in 10:
		_check(Facing.select_frontage(block, {}, 7301, 2) == selected, "Equal corner frontage tie-break is deterministic")

func _audit_seed(seed_value: int) -> void:
	var town: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	var duplicate: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	_check(town.ok, "Formal Medium Town generated for seed %d" % seed_value)
	_check(var_to_str(town) == var_to_str(duplicate), "Formal Medium Town is deterministic for seed %d" % seed_value)
	if not town.ok:
		return
	for site: Dictionary in town.buildings:
		_audit_site(town, site, seed_value)

func _audit_site(town: Dictionary, site: Dictionary, seed_value: int) -> void:
	var definition: Resource = Assets.asset(site.asset)
	var parcel: Dictionary = _find(town.parcels, "parcel_id", site.id)
	var block: Dictionary = _find(town.blocks, "id", site.block_id)
	var edge: Dictionary = _find(block.get("street_edges", []), "side", parcel.get("frontage_edge", ""))
	var identity := "%d/%s/%s" % [seed_value, site.id, definition.building_id]
	_check(not parcel.is_empty() and not block.is_empty() and not edge.is_empty(), "Assigned parcel/frontage exists: " + identity)
	if parcel.is_empty() or block.is_empty() or edge.is_empty():
		return
	var assigned := Vector3(edge.outward.x, 0.0, edge.outward.y).normalized()
	var forward: Vector3 = site.primary_entrance_forward.normalized()
	_check(site.assigned_street_id == edge.road_id and site.selected_frontage == edge.side, "Assigned street metadata matches parcel frontage: " + identity)
	_check(forward.dot(assigned) > 0.9999, "Primary entrance faces assigned frontage: " + identity)
	var road: Dictionary = _find(town.roads, "id", site.assigned_street_id)
	_check(not road.is_empty(), "Assigned road exists: " + identity)
	if not road.is_empty():
		var door_flat := Vector2(site.primary_entrance.x, site.primary_entrance.z)
		var sample_flat := door_flat + Vector2(forward.x, forward.z) * 0.75
		_check(_segment_distance(sample_flat, road.start, road.end) < _segment_distance(door_flat, road.start, road.end), "Forward sample moves closer to assigned street: " + identity)
	var search_flat := Vector2(site.search_interaction.x, site.search_interaction.z)
	_check(not site.bounds.has_point(search_flat), "Search point is outside its building footprint: " + identity)
	for other: Dictionary in town.buildings:
		if other.id != site.id:
			_check(not other.bounds.has_point(search_flat), "Search point avoids other building footprints: %s vs %s" % [identity, other.id])
	for candidate_road: Dictionary in town.roads:
		_check(not candidate_road.bounds.has_point(search_flat), "Search point avoids road center surface: %s vs %s" % [identity, candidate_road.id])
	var wrapper: Node3D = View.instantiate_building(site)
	var entrance: Marker3D = wrapper.get_node("Anchors/EntranceMarker")
	var search: Marker3D = wrapper.get_node("Anchors/SearchMarker")
	_check((wrapper.transform * entrance.position).distance_to(site.primary_entrance) < 0.001, "Runtime wrapper physical entrance matches generated data: " + identity)
	_check((wrapper.transform * search.position).distance_to(site.search_interaction) < 0.001, "Runtime wrapper search point matches generated data: " + identity)
	_check(wrapper.position.distance_to(site.position) < 0.001, "Building center placement remains unchanged: " + identity)
	wrapper.free()
	covered[site.asset] = true
	rotation_coverage[_yaw_quarter(site.yaw)] = true
	rows.append({"seed": seed_value, "instance": site.id, "asset": definition.building_id,
		"category": site.category, "street": site.assigned_street_id, "frontage": site.selected_frontage,
		"yaw_degrees": snappedf(rad_to_deg(site.yaw), 0.1), "facing_dot": forward.dot(assigned), "status": "PASS"})

func _find(items: Array, key: String, value: Variant) -> Dictionary:
	for item: Dictionary in items:
		if item.get(key) == value:
			return item
	return {}

func _segment_distance(point: Vector2, start: Vector2, end: Vector2) -> float:
	return point.distance_to(Geometry2D.get_closest_point_to_segment(point, start, end))

func _yaw_quarter(yaw: float) -> int:
	var quarter := roundi(rad_to_deg(yaw) / 90.0)
	return (quarter % 4 + 4) % 4

func _generator_has_no_instance_patch() -> bool:
	var sources := FileAccess.get_file_as_string("res://maps/town/town_urban_fabric.gd") + FileAccess.get_file_as_string("res://maps/town/town_urban_view.gd")
	return sources.find("building_id ==") < 0 and sources.find("seed_value ==") < 0 and sources.find("position ==") < 0

func _check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
