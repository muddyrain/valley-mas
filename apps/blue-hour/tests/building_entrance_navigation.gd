extends SceneTree
## Ten-seed validation against the formal Medium Town runtime and collision-derived navigation.

const Adapter = preload("res://maps/expedition/town_runtime_adapter.gd")
const SEEDS: Array[int] = [4101, 4102, 4103, 4104, 7301, 7302, 7303, 7304, 9917, 12031]
const OUTPUT := "res://test-output/building-entrance-facing/"

var checks: int = 0
var failures: Array[String] = []
var records: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	for seed_value: int in SEEDS:
		await _verify_seed(seed_value)
	FileAccess.open(OUTPUT + "navigation_report.json", FileAccess.WRITE).store_string(JSON.stringify({
		"checks": checks, "failures": failures, "seed_count": SEEDS.size(), "seeds": records}, "\t"))
	print("BUILDING ENTRANCE NAVIGATION: %d checks, %d failures" % [checks, failures.size()])
	for failure: String in failures:
		printerr(failure)
	quit(0 if failures.is_empty() else 1)

func _verify_seed(seed_value: int) -> void:
	var city: Node3D = Adapter.new()
	root.add_child(city)
	var ok: bool = city.build_runtime("food_supply", seed_value, load("res://data/maps/east_quay.tres"))
	_check(ok, "Seed %d formal runtime builds" % seed_value)
	if not ok:
		city.queue_free()
		await process_frame
		return
	while not bool(city.runtime_data.get("navigation_available", false)):
		await process_frame
	var origins: Array[Vector3] = city.spawn_positions(1)
	_check(origins.size() == 1, "Seed %d has an Arrival navigation origin" % seed_value)
	var reachable: int = 0
	for item: Dictionary in city.runtime_data.building_search_points:
		var authored: Vector3 = item.position
		var resolved: Vector3 = city.navigation.nearest(authored, 2.0)
		var identity := "%d/%s" % [seed_value, item.id]
		_check(resolved.is_finite(), "Search point resolves within 2m: " + identity)
		if not resolved.is_finite() or origins.is_empty():
			continue
		_check(resolved.distance_to(authored) <= 2.001, "Resolved stand point remains near authored search point: " + identity)
		_check(item.primary_entrance.distance_to(authored) <= 2.001, "Authored search point remains near visual entrance: " + identity)
		var route: PackedVector3Array = city.path(origins[0], resolved)
		_check(not route.is_empty(), "Arrival can reach search interaction: " + identity)
		if not route.is_empty():
			reachable += 1
	_check(reachable == city.runtime_data.building_search_points.size(), "Seed %d all %d searchable buildings are reachable" % [seed_value, city.runtime_data.building_search_points.size()])
	records.append({"seed": seed_value, "searchable": city.runtime_data.building_search_points.size(), "reachable": reachable,
		"navigation_signature": city.navigation.metrics.signature})
	city.queue_free()
	await process_frame

func _check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
