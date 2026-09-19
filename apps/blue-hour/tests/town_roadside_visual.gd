extends SceneTree

const Pass = preload("res://maps/town/environment/town_roadside_visual_pass.gd")
const Targeted = preload("res://maps/town/environment/town_targeted_props.gd")
const Generator = preload("res://maps/town/town_generator.gd")
const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const View = preload("res://maps/town/environment/town_roadside_view.gd")
const OUTPUT := "res://test-output/medium-town-environment-m03"
var checks := 0
var failures: Array[String] = []

func _initialize() -> void:
	_run.call_deferred()

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
		var frozen_town := var_to_str(town)
		var baseline := Targeted.new().generate(town)
		var frozen_base := var_to_str(baseline)
		var pass_instance := Pass.new()
		var result := pass_instance.generate(town, baseline)
		_check(var_to_str(town) == frozen_town, "Frozen town unchanged")
		_check(var_to_str(baseline) == frozen_base, "No M02 data or instance mutation")
		_check(var_to_str(result) == var_to_str(pass_instance.generate(town, baseline)), "M03 deterministic and reusable")
		_check(frozen_base == var_to_str(Targeted.new().generate(town)), "M02 baseline reproducible")
		if seed_value == 4101:
			_check(frozen_town == FileAccess.get_file_as_string("res://test-output/medium-town-blueprint/generated-town.txt"), "Frozen Blueprint snapshot")
			_check(frozen_base == FileAccess.get_file_as_string("res://test-output/medium-town-environment-m02/environment.txt"), "Frozen M02 snapshot")
			_check(var_to_str(Targeted.Baseline.new().generate(town)) == FileAccess.get_file_as_string("res://test-output/medium-town-environment-m01-1/environment.txt"), "Frozen M01.1 snapshot")
			FileAccess.open(OUTPUT.path_join("visual-data.txt"), FileAccess.WRITE).store_string(var_to_str(result))
		var ids: Dictionary = {}
		for pair: Dictionary in result.wires:
			_check(not ids.has(pair.id), "Unique wire pair")
			ids[pair.id] = true
			_check(baseline.future_wire_links.any(func(link: Dictionary) -> bool: return link.from == pair.from and link.to == pair.to), "Wire from M02 metadata only")
			_check(pair.span <= 42.0 and pair.span >= 22.0, "Wire span within hard limit")
			var a: Dictionary = baseline.instances.filter(func(item: Dictionary) -> bool: return item.id == pair.from)[0]
			var b: Dictionary = baseline.instances.filter(func(item: Dictionary) -> bool: return item.id == pair.to)[0]
			_check(a.placement.anchor == b.placement.anchor and a.placement.road_side == b.placement.road_side, "Same semantic road and side")
			_check(pair.lines.size() == 3, "Three parallel wires per pair")
			for line: Dictionary in pair.lines:
				for endpoint: Dictionary in [{"item": a, "point": line.points[0]}, {"item": b, "point": line.points[-1]}]:
					var wrapper: Node3D = Targeted.Catalog.asset(endpoint.item.asset).scene.instantiate()
					var marker: Node3D = wrapper.get_node("Anchors/" + line.marker)
					var transform := Transform3D(Basis(Vector3.UP, endpoint.item.yaw).scaled(Vector3.ONE * endpoint.item.scale), endpoint.item.position)
					var expected: Vector3 = transform * (wrapper.get_node("Anchors").transform * marker.position)
					_check(expected.distance_to(endpoint.point) < 0.001, "Endpoint matches actual WireMarker")
					wrapper.free()
				_check(line.points.size() == 13, "Twelve segments")
				_check(line.points[6].y < (line.points[0].y + line.points[-1].y) * 0.5 - 0.25, "Actual gentle sag")
				for point: Vector3 in line.points:
					_check(point.y >= 6.0, "Safe ground clearance")
				for site: Dictionary in town.buildings:
					var wrapper := Targeted.UrbanView.instantiate_building(site)
					var box: AABB = wrapper.transform * Geometry.bounds(wrapper).merge(Geometry.bounds(wrapper, true))
					for index: int in range(1, line.points.size()):
						_check(box.grow(0.014).intersects_segment(line.points[index - 1], line.points[index]) == null, "No building roof/wall penetration")
					wrapper.free()
		var parking_ids: Dictionary = {}
		for mark: Dictionary in result.parking_marks:
			_check(not parking_ids.has(mark.anchor), "At most one P per parking surface")
			parking_ids[mark.anchor] = true
			var slot: Dictionary = baseline.parking_contexts.filter(func(item: Dictionary) -> bool: return item.id == mark.anchor)[0]
			_check(not slot.land_use.begins_with("RESIDENTIAL"), "No marks on private residential pad")
			_check(Geometry.contains(slot.polygon, mark.bounds), "Whole parking mark on real parking surface")
			for item: Dictionary in baseline.instances:
				_check(not mark.bounds.intersects(item.bounds), "Parking paint visible outside prop/vehicle footprints")
		for accent: Dictionary in result.commercial_accents:
			var site: Dictionary = town.buildings.filter(func(item: Dictionary) -> bool: return item.id == accent.anchor)[0]
			_check(site.land_use_type in ["COMMERCIAL_CORE", "MIXED_TRANSITION"], "Commercial frontage only")
			_check(accent.bounds.size.x <= 2.0 and accent.bounds.size.y <= 2.0, "Small entrance surface accent")
			_check(town.roads.any(func(road: Dictionary) -> bool: return road.bounds.grow(1.6 if road.kind == "alley" else 2.2).encloses(accent.bounds)), "Entire accent on sidewalk")
			for road: Dictionary in town.roads:
				_check(not accent.bounds.intersects(road.bounds), "Accent outside road")
		for detail: Dictionary in result.parking_marks + result.commercial_accents:
			for zone: Dictionary in baseline.clear_zones:
				if zone.kind in ["arrival", "poi", "route"]:
					_check(not detail.bounds.intersects(zone.bounds), "Detail avoids " + zone.kind)
		orientations[town.orientation_quarters] = true
		cases.append(result.statistics)
		print("M03 ", seed_value, " ", result.statistics)
		if seed_value == 4101:
			_test_render_contract(town, baseline, result)
			_test_rejections(town, baseline)
	_check(orientations.size() == 4, "Four town orientations")
	FileAccess.open(OUTPUT.path_join("validation.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "cases": cases, "visual_qa": "PENDING HUMAN REVIEW"}, "\t"))
	print("M03 VALIDATION: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func _test_render_contract(town: Dictionary, baseline: Dictionary, result: Dictionary) -> void:
	var city := Node3D.new()
	Targeted.UrbanView.build(city, town)
	var road: MeshInstance3D = city.get_node("RoadNetwork")
	var walk: MeshInstance3D = city.get_node("SidewalkNetwork")
	var original_road := road.material_override
	var original_walk := walk.material_override
	var mesh := road.mesh
	var original_color: Color = original_road.get_shader_parameter("base_color")
	var layer := View.build(city, town, result)
	_check(road.mesh == mesh, "Road geometry unchanged")
	_check(road.material_override != original_road and walk.material_override != original_walk, "M03 surface materials applied")
	_check(layer.find_children("*", "CollisionObject3D", true, false).is_empty(), "Visual layer has no physics bodies")
	_check(layer.find_children("*", "CollisionShape3D", true, false).is_empty(), "Visual layer has no collision shapes")
	_check(layer.get_node("Wires").get_child_count() == result.wires.size(), "One combined mesh per metadata pair")
	var curb: MeshInstance3D = layer.get_node("SurfacePolish/RoadEdgeReadability")
	var faces := curb.mesh.get_faces()
	for index: int in range(0, faces.size(), 3):
		var center := Geometry.xz((faces[index] + faces[index + 1] + faces[index + 2]) / 3.0)
		_check(not town.roads.any(func(item: Dictionary) -> bool: return item.bounds.has_point(center)), "Curb never covers road surface")
		_check(town.roads.any(func(item: Dictionary) -> bool: return item.bounds.grow(0.181).has_point(center)), "Curb limited to 18cm edge")
	_check(original_road.get_shader_parameter("base_color") == original_color, "Shared baseline material immutable")
	for wire: Node in layer.get_node("Wires").get_children():
		_check(wire is MeshInstance3D and wire.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF, "One lightweight unshadowed mesh per pair")
		_check(wire.mesh.get_faces().size() / 3 == 432, "Bounded wire triangles")
	View.set_enabled(layer, false)
	_check(road.material_override == original_road and walk.material_override == original_walk, "M02 original materials restored")
	View.set_enabled(layer, true)
	_check(var_to_str(baseline) == FileAccess.get_file_as_string("res://test-output/medium-town-environment-m02/environment.txt"), "Render does not mutate M02")
	city.free()

func _test_rejections(town: Dictionary, baseline: Dictionary) -> void:
	var duplicate: Dictionary = baseline.duplicate(true)
	duplicate.future_wire_links.append(duplicate.future_wire_links[0].duplicate(true))
	var result := Pass.new().generate(town, duplicate)
	_check(result.statistics.wire_rejection_reasons.get("duplicate_pair", 0) == 1, "Duplicate metadata safely rejected")
	var too_long: Dictionary = baseline.duplicate(true)
	var first: Dictionary = too_long.future_wire_links[0]
	var target: Dictionary = too_long.instances.filter(func(item: Dictionary) -> bool: return item.id == first.to)[0]
	var source: Dictionary = too_long.instances.filter(func(item: Dictionary) -> bool: return item.id == first.from)[0]
	target.position = source.position + Vector3(148, 0, 0)
	too_long.future_wire_links = [first]
	result = Pass.new().generate(town, too_long)
	_check(result.wires.is_empty() and result.statistics.wire_rejection_reasons.get("span_hard_max", 0) == 1, "148m span rejected")
	var runner := Pass.new()
	var normal := runner.generate(town, baseline)
	var pair: Dictionary = normal.wires[0]
	var link: Dictionary = baseline.future_wire_links[0]
	var a: Dictionary = baseline.instances.filter(func(item: Dictionary) -> bool: return item.id == link.from)[0]
	var b: Dictionary = baseline.instances.filter(func(item: Dictionary) -> bool: return item.id == link.to)[0]
	for kind: String in ["building", "tree_trunk", "tree_canopy"]:
		runner._obstacles = [{"kind": kind, "bounds": AABB(pair.lines[0].points[6] - Vector3.ONE, Vector3.ONE * 2)}]
		_check(runner._wire_pair(link, a, b).rejection_reason == kind, "Reject injected " + kind + " crossing")
