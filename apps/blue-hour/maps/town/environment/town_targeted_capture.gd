extends "res://maps/town/town_runtime_visual_test.gd"
## Isolated M02 capture host; frozen earlier capture entry points remain unchanged.

const Targeted = preload("res://maps/town/environment/town_targeted_props.gd")
const PolishView = preload("res://maps/town/environment/town_polish_view.gd")
const ExpeditionCamera = preload("res://missions/expedition_camera.gd")

func _ready() -> void:
	_parse_arguments()
	output_dir = "res://test-output/medium-town-environment-m02"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_dir))
	town = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	var result := Targeted.new().generate(town)
	var baseline := Targeted.Baseline.new().generate(town)
	Targeted.UrbanView.build(self, town)
	var before := PolishView.build(self, baseline)
	var after := PolishView.build(self, result)
	before.hide()
	_build_camera()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.far = 1000
	for child: Node in get_children():
		if child is DirectionalLight3D:
			child.shadow_enabled = true
			child.light_energy = 0.56
			child.light_color = Color("fff1d9")
			child.rotation_degrees = Vector3(-48, -32, 0)
			child.directional_shadow_max_distance = 600
		elif child is WorldEnvironment:
			child.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
			child.environment.ambient_light_energy = 0.48
			child.environment.ambient_light_color = Color("b6c4d6")
	var report := {"seed": seed_value, "phase": "M02", "visual_qa": "PENDING HUMAN REVIEW", "captures": [], "new_counts": result.new_counts, "targets": [], "changed_pixel_samples": {}}
	camera.size = 348
	camera.position = Vector3(0, 480, 130)
	camera.look_at(Vector3.ZERO)
	await _pair(before, after, "overview", report)
	var additions: Array = result.instances.slice(result.baseline_count)
	var shots: Array[Dictionary] = []
	for specification: Array in [["residential_street", Targeted.BICYCLE, "RESIDENTIAL"], ["commercial_street", Targeted.AFRAME, ""], ["parking_area", Targeted.PARKING, ""], ["park_edge", Targeted.BICYCLE, "PARK_EDGE"], ["utility_pole_rhythm", Targeted.POLE, ""], ["bicycle_detail", Targeted.BICYCLE, "RESIDENTIAL"], ["aframe_detail", Targeted.AFRAME, ""]]:
		var matches: Array = additions.filter(func(item: Dictionary) -> bool: return item.asset == specification[1] and (specification[2] == "" or item.placement.zone == specification[2]))
		if matches.is_empty():
			push_error("No placement for requested capture: " + specification[0])
			_capture_failed = true
			continue
		var target: Dictionary = matches[0]
		var focus: Vector3 = target.position
		var size := 25.0
		if specification[0] == "utility_pole_rhythm":
			size = 65.0
			if not result.future_wire_links.is_empty():
				var link: Dictionary = result.future_wire_links[0]
				var poles: Array = additions.filter(func(item: Dictionary) -> bool: return item.id in [link.from, link.to])
				focus = (poles[0].position + poles[1].position) * 0.5
		elif specification[0].ends_with("detail"):
			size = 12.0
		shots.append({"label": specification[0], "focus": focus, "size": size, "target": target})
	for shot: Dictionary in shots:
		camera.size = shot.size
		camera.position = shot.focus + ExpeditionCamera.OFFSET
		camera.look_at(shot.focus)
		report.targets.append({"label": shot.label, "focus": var_to_str(shot.focus), "camera_size": camera.size, "offset": var_to_str(ExpeditionCamera.OFFSET), "instance": shot.target.id})
		if shot.label in ["residential_street", "commercial_street"]:
			await _pair(before, after, shot.label, report)
		else:
			await _urban_capture(shot.label, report)
		if shot.label == "aframe_detail":
			var target: Dictionary = shot.target
			var facing := Vector3(-sin(target.yaw), 0, -cos(target.yaw))
			camera.position = target.position + facing * 18 + Vector3(0, 12, 0) + facing.cross(Vector3.UP) * 6
			camera.look_at(target.position)
			await _urban_capture("aframe_front_inspection", report)
	FileAccess.open(output_dir.path_join("capture-report.json"), FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("M02 CAPTURE: ", report.captures.size(), " images; failed=", _capture_failed)
	if _inspect:
		camera.size = 348
		camera.position = Vector3(0, 480, 130)
		camera.look_at(Vector3.ZERO)
		return
	get_tree().quit(1 if _capture_failed else 0)

func _pair(before: Node3D, after: Node3D, label: String, report: Dictionary) -> void:
	before.show()
	after.hide()
	await _urban_capture(label + "_before", report)
	before.hide()
	after.show()
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
		push_error("M02 additions not visible: " + label)
	var sheet := Image.create(first.get_width() * 2, first.get_height(), false, Image.FORMAT_RGB8)
	sheet.blit_rect(first, Rect2i(Vector2i.ZERO, first.get_size()), Vector2i.ZERO)
	sheet.blit_rect(second, Rect2i(Vector2i.ZERO, second.get_size()), Vector2i(first.get_width(), 0))
	if sheet.save_png(output_dir.path_join(label + "_comparison.png")) != OK:
		_capture_failed = true
