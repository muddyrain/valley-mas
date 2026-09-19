extends SceneTree

const Pass = preload("res://maps/town/environment/town_targeted_props.gd")
const Generator = preload("res://maps/town/town_generator.gd")
const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const OUTPUT := "res://test-output/medium-town-environment-m02"
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)
		push_error(message)

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	var cases: Array[Dictionary] = []
	var orientations: Dictionary = {}
	for seed_value: int in [4101, 4102, 4103, 4104, 4105, 4106, 4110, 4201]:
		var town := Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
		var frozen := var_to_str(town)
		var baseline := Pass.Baseline.new().generate(town)
		var runner := Pass.new()
		var result := runner.generate(town)
		_check(var_to_str(town) == frozen, "Town input unchanged")
		_check(var_to_str(result) == var_to_str(runner.generate(town)), "M02 determinism")
		_check(var_to_str(result.instances.slice(0, result.baseline_count)) == var_to_str(baseline.instances), "All M01.1 instances exactly preserved")
		for key: String in ["slots", "clear_zones", "driveways", "park_nodes", "groups", "openings", "preservation"]:
			_check(var_to_str(result[key]) == var_to_str(baseline[key]), "Baseline " + key + " unchanged")
		if seed_value == 4101:
			_check(frozen == FileAccess.get_file_as_string("res://test-output/medium-town-blueprint/generated-town.txt"), "Frozen Town snapshot")
			_check(var_to_str(baseline) == FileAccess.get_file_as_string("res://test-output/medium-town-environment-m01-1/environment.txt"), "Frozen M01.1 snapshot")
			FileAccess.open(OUTPUT.path_join("environment.txt"), FileAccess.WRITE).store_string(var_to_str(result))
		var new_items: Array = result.instances.slice(result.baseline_count)
		var counts: Dictionary = {}
		var bicycle_contexts: Dictionary = {}
		var poles: Array = []
		var road_sides: Dictionary = {}
		var shop_ids: Dictionary = {}
		var ids: Dictionary = {}
		for instance: Dictionary in result.instances:
			_check(not ids.has(instance.id), "Unique instance IDs")
			ids[instance.id] = true
		var pole_rejections := 0
		for candidate: Dictionary in result.placement_candidates:
			_check(candidate.accepted == candidate.rejection_reason.is_empty(), "Candidate acceptance recorded")
			if candidate.asset == Pass.POLE and not candidate.accepted:
				pole_rejections += 1
		for item: Dictionary in new_items:
			var definition: Resource = Pass.Catalog.asset(item.asset)
			_check(item.asset in Pass.ASSETS and not definition.searchable, "Approved decorative Catalog asset")
			_check(item.placement.zone in definition.environment_tags, "Definition environment_tags honored")
			_check(not str(item.placement.anchor).is_empty() and not str(item.placement.reason).is_empty(), "Semantic anchor and reason recorded")
			var wrapper: Node3D = definition.scene.instantiate()
			var bounds := Geometry.footprint(Geometry.bounds(wrapper).merge(Geometry.bounds(wrapper, true)), Geometry.xz(item.position), item.yaw)
			wrapper.free()
			_check(bounds.is_equal_approx(item.bounds), "Actual wrapper render and collision footprint")
			var assigned: Dictionary = result.slots.filter(func(slot: Dictionary) -> bool: return slot.id == item.slot_id)[0]
			_check(Geometry.contains(assigned.polygon, bounds), "Full object inside reported slot")
			for other: Dictionary in result.instances:
				if other.id != item.id:
					_check(not bounds.intersects(other.bounds), "No overlap")
			for zone: Dictionary in result.clear_zones:
				_check(not bounds.intersects(zone.bounds), "Clear " + zone.kind)
				if item.asset == Pass.BICYCLE and zone.kind == "walk_corridor":
					_check(not bounds.intersects(zone.bounds.grow(0.6)), "Bicycle 0.6m walk clearance")
			for road: Dictionary in town.roads:
				_check(not bounds.intersects(road.bounds.grow(2.2)), "Road and sidewalk independently clear")
			for site: Dictionary in town.buildings:
				var entry := Geometry.xz(site.entry)
				_check(entry.distance_to(entry.clamp(bounds.position, bounds.end)) >= 1.2, "Entrance clearance")
			for surface: Dictionary in baseline.driveways:
				for area: Rect2 in [surface.pad, surface.connector]:
					if area.has_area():
						_check(not bounds.intersects(area.grow(1.5 if item.asset == Pass.POLE else 0.0)), "Driveway and pad clearance")
			for parking: Dictionary in result.parking_contexts:
				_check(Geometry2D.intersect_polygons(Geometry.polygon(bounds), parking.polygon).is_empty(), "Parking bays and vehicle aisles clear")
			var point := Geometry.xz(item.position)
			if item.asset == Pass.POLE:
				if road_sides.has(item.placement.anchor):
					_check(road_sides[item.placement.anchor] == item.placement.road_side, "Consistent pole side on each road segment")
				road_sides[item.placement.anchor] = item.placement.road_side
				var road: Dictionary = town.roads.filter(func(value: Dictionary) -> bool: return value.id == item.placement.anchor)[0]
				var edge_gap := point.distance_to(point.clamp(road.bounds.position, road.bounds.end))
				_check(edge_gap >= 3.49 and edge_gap <= 5.01, "Pole follows sidewalk outer edge")
				for pole: Dictionary in poles:
					_check(item.position.distance_to(pole.position) >= 22, "Pole minimum spacing")
				poles.append(item)
			elif item.asset == Pass.PARKING:
				var parking: Dictionary = result.parking_contexts.filter(func(slot: Dictionary) -> bool: return slot.id == item.placement.anchor)[0]
				_check(point.distance_to(point.clamp(parking.bounds.position, parking.bounds.end)) < 1.0, "Parking sign near real parking perimeter")
				_check(not item.land_use.begins_with("RESIDENTIAL"), "No parking sign on residential lawn")
			elif item.asset == Pass.AFRAME:
				_check(not shop_ids.has(item.placement.anchor), "At most one A-frame per shop")
				shop_ids[item.placement.anchor] = true
				var site: Dictionary = town.buildings.filter(func(site: Dictionary) -> bool: return site.id == item.placement.anchor)[0]
				_check(site.land_use_type in ["COMMERCIAL_CORE", "MIXED_TRANSITION"], "A-frame commercial frontage")
				var wall: Rect2 = item.placement.facade_bounds
				var gap := point.distance_to(point.clamp(wall.position, wall.end))
				_check(gap >= 0.6 and gap <= 1.5, "A-frame 0.6-1.5m facade relation")
			elif item.asset == Pass.BICYCLE:
				bicycle_contexts[item.placement.zone] = int(bicycle_contexts.get(item.placement.zone, 0)) + 1
				if item.placement.zone == "PARK_EDGE":
					_check(item.position.distance_to(item.placement.entrance) < 5.0, "Bicycle near park entrance")
				else:
					var wall: Rect2 = item.placement.wall_bounds
					_check(point.distance_to(point.clamp(wall.position, wall.end)) <= 1.5, "Bicycle beside building")
			if item.asset in [Pass.AFRAME, Pass.PARKING]:
				var facing := Vector2(-sin(item.yaw), -cos(item.yaw))
				_check(facing.dot(item.placement.facing) > 0.99, "Sign faces road/frontage")
			counts[item.asset] = int(counts.get(item.asset, 0)) + 1
		var total_spacing := 0.0
		var adjacent_gaps: Array[float] = []
		for road_id: String in road_sides:
			var row: Array = poles.filter(func(item: Dictionary) -> bool: return item.placement.anchor == road_id)
			row.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.placement.distance_along < b.placement.distance_along)
			for index: int in range(1, row.size()):
				adjacent_gaps.append(row[index].position.distance_to(row[index - 1].position))
		for link: Dictionary in result.future_wire_links:
			_check(link.distance >= 22 and link.distance <= 35 and not link.rendered, "Future pole links 22-35m; no wires")
			total_spacing += link.distance
		orientations[town.orientation_quarters] = true
		var average := 0.0
		for gap: float in adjacent_gaps:
			average += gap
		average /= maxf(1, adjacent_gaps.size())
		cases.append({"seed": seed_value, "counts": result.new_counts, "new_instances": new_items.size(), "total_instances": result.instances.size(), "bicycle_contexts": bicycle_contexts, "pole_link_count": result.future_wire_links.size(), "pole_average_link_spacing": total_spacing / maxf(1, result.future_wire_links.size()), "pole_adjacent_gaps": adjacent_gaps, "pole_average_adjacent_spacing": average, "pole_rejected_candidates": pole_rejections, "rejections": result.placement_rejections})
		print("M02 ", seed_value, " ", cases.back())
	_check(orientations.size() == 4, "Four orientations")
	FileAccess.open(OUTPUT.path_join("validation.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "cases": cases, "visual_qa": "PENDING HUMAN REVIEW"}, "\t"))
	print("M02 VALIDATION: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
