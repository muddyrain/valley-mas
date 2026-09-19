extends "res://maps/town/town_runtime_visual_test.gd"
## Native M03 evidence host; M02 capture and placement entry points remain unchanged.

const Targeted = preload("res://maps/town/environment/town_targeted_props.gd")
const Pass = preload("res://maps/town/environment/town_roadside_visual_pass.gd")
const View = preload("res://maps/town/environment/town_roadside_view.gd")
const PolishView = preload("res://maps/town/environment/town_polish_view.gd")
const ExpeditionCamera = preload("res://missions/expedition_camera.gd")
var visual_layer: Node3D

func _ready() -> void:
	_parse_arguments()
	output_dir = "res://test-output/medium-town-environment-m03"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_dir))
	town = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	var m02 := Targeted.new().generate(town)
	var m03 := Pass.new().generate(town, m02)
	Targeted.UrbanView.build(self, town)
	var baseline_layer := PolishView.build(self, m02)
	visual_layer = View.build(self, town, m03)
	assert(baseline_layer.get_child_count() >= m02.instances.size())
	_build_camera()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.far = 1000.0
	for child: Node in get_children():
		if child is DirectionalLight3D:
			child.shadow_enabled = true
			child.light_energy = 0.56
			child.light_color = Color("#fff1d9")
			child.rotation_degrees = Vector3(-48, -32, 0)
			child.directional_shadow_max_distance = 600.0
		elif child is WorldEnvironment:
			child.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
			child.environment.ambient_light_energy = 0.48
			child.environment.ambient_light_color = Color("#b6c4d6")
	var report := {"seed": seed_value, "phase": "M03", "visual_qa": "PENDING HUMAN REVIEW", "captures": [], "statistics": m03.statistics, "targets": [], "changed_pixel_samples": {}}
	camera.size = 348.0
	camera.position = Vector3(0, 480, 130)
	camera.look_at(Vector3.ZERO)
	await _pair("overview", report)
	var longest := {"span": 0.0, "focus": Vector3.ZERO}
	var poles: Array = m02.instances.filter(func(item: Dictionary) -> bool: return item.asset == Targeted.POLE)
	for road: Dictionary in town.roads:
		var row: Array = poles.filter(func(item: Dictionary) -> bool: return item.placement.anchor == road.id)
		row.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.placement.distance_along < b.placement.distance_along)
		for index: int in range(1, row.size()):
			var span: float = row[index].position.distance_to(row[index - 1].position)
			if span > longest.span:
				longest = {"span": span, "focus": (row[index].position + row[index - 1].position) * 0.5, "from": row[index - 1].id, "to": row[index].id}
	report.long_gap = {"span": longest.span, "focus": var_to_str(longest.focus), "from": longest.get("from", ""), "to": longest.get("to", "")}
	var focus := Vector3.ZERO
	if not m03.wires.is_empty():
		focus = m03.wires[0].lines[1].points[6]
	var shots: Array[Dictionary] = [
		{"label": "utility_wire_street_detail", "focus": focus, "size": 65.0},
		{"label": "utility_wire_side_view", "focus": focus, "size": 35.0, "offset": Vector3(45, 5, 0)},
		{"label": "commercial_core", "focus": Vector3(47.7, 0, -36.6), "size": 30.0},
		{"label": "parking_area", "focus": Vector3(-17.25, 0, -63.01), "size": 30.0},
		{"label": "residential_street", "focus": Vector3(16.1, 0, -106.2), "size": 30.0},
		{"label": "sidewalk_road_material_detail", "focus": Vector3(6, 0, -82), "size": 18.0},
		{"label": "long_pole_gap_inspection", "focus": longest.focus, "size": longest.span + 25, "offset": Vector3(0, 180, 35)}
	]
	if not m03.commercial_accents.is_empty():
		var accent: Dictionary = m03.commercial_accents[0]
		shots.append({"label": "commercial_frontage_detail", "focus": Vector3(accent.point.x, 0, accent.point.y), "size": 12.0, "offset": Vector3(accent.facing.x * 28, 30, accent.facing.y * 28)})
	if not m03.parking_marks.is_empty():
		var mark: Dictionary = m03.parking_marks[0]
		shots.append({"label": "parking_symbol_detail", "focus": Vector3(mark.point.x, 0, mark.point.y), "size": 10.0, "offset": Vector3(mark.facing.x * 25, 30, mark.facing.y * 25)})
	for shot: Dictionary in shots:
		camera.size = shot.size
		var offset: Vector3 = shot.get("offset", ExpeditionCamera.OFFSET)
		camera.position = shot.focus + offset
		camera.look_at(shot.focus)
		report.targets.append({"label": shot.label, "focus": var_to_str(shot.focus), "camera_size": camera.size, "offset": var_to_str(offset)})
		if shot.label in ["commercial_core", "parking_area", "residential_street"]:
			await _pair(shot.label, report)
		else:
			await _urban_capture(shot.label, report)
	FileAccess.open(output_dir.path_join("capture-report.json"), FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("M03 CAPTURE: ", report.captures.size(), " images; failed=", _capture_failed)
	get_tree().quit(1 if _capture_failed else 0)

func _pair(label: String, report: Dictionary) -> void:
	View.set_enabled(visual_layer, false)
	await _urban_capture(label + "_before", report)
	View.set_enabled(visual_layer, true)
	await _urban_capture(label + "_after", report)
	var prefix := "PROFILE_A_MAIN_STREET_%d_" % seed_value
	var first := Image.load_from_file(output_dir.path_join(prefix + label + "_before.png"))
	var second := Image.load_from_file(output_dir.path_join(prefix + label + "_after.png"))
	first.convert(Image.FORMAT_RGB8)
	second.convert(Image.FORMAT_RGB8)
	var changed := 0
	for x: int in range(0, first.get_width(), 4):
		for y: int in range(0, first.get_height(), 4):
			var delta := first.get_pixel(x, y) - second.get_pixel(x, y)
			if absf(delta.r) + absf(delta.g) + absf(delta.b) > 0.05:
				changed += 1
	report.changed_pixel_samples[label] = changed
	if changed < 10:
		_capture_failed = true
		push_error("M03 additions not visible: " + label)
	var sheet := Image.create(first.get_width() * 2, first.get_height(), false, Image.FORMAT_RGB8)
	sheet.blit_rect(first, Rect2i(Vector2i.ZERO, first.get_size()), Vector2i.ZERO)
	sheet.blit_rect(second, Rect2i(Vector2i.ZERO, second.get_size()), Vector2i(first.get_width(), 0))
	sheet.save_png(output_dir.path_join(label + "_comparison.png"))
