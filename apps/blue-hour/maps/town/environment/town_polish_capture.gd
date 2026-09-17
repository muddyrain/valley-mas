extends RefCounted

const OUTPUT := "res://test-output/medium-town-environment-m01-1"
const Generator = preload("res://maps/town/town_generator.gd")
const Polish = preload("res://maps/town/environment/town_environment_polish.gd")
const Baseline = preload("res://maps/town/environment/town_street_life_pass.gd")
const View = preload("res://maps/town/environment/town_environment_view.gd")
const PolishView = preload("res://maps/town/environment/town_polish_view.gd")
const UrbanView = preload("res://maps/town/town_urban_view.gd")
const Camera = preload("res://missions/expedition_camera.gd")
const Catalog = preload("res://data/world_asset_catalog.gd")

static func run(host: Node3D, inspect: bool) -> void:
	host.output_dir = OUTPUT
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	host.town = Generator.generate("food_supply", host.seed_value, "PROFILE_A_MAIN_STREET")
	var result := Polish.new().generate(host.town)
	var baseline := Baseline.new().generate(host.town)
	UrbanView.build(host, host.town)
	var before := View.build(host, baseline)
	var after := PolishView.build(host, result)
	before.hide()
	host._build_camera()
	var camera: Camera3D = host.camera
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.far = 1000
	for child: Node in host.get_children():
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
	var report := {"seed": host.seed_value, "phase": "M01.1", "visual_qa": "PENDING HUMAN REVIEW", "captures": [], "statistics": result.statistics, "instances": result.instances.size(), "bush_removed": result.bush_removed, "driveways": result.driveways, "park_nodes": result.park_nodes, "groups": result.groups, "preservation": result.preservation, "material_overrides": PolishView.COLORS, "runtime_targets": []}
	camera.size = 348
	camera.position = Vector3(0, 480, 130)
	camera.look_at(Vector3.ZERO)
	await _pair(host, before, after, "overview", report)
	var cargo: Array = result.groups.filter(func(group: Dictionary) -> bool: return group.kind == "cargo")
	cargo.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return not str(a.get("nearby_van", "")).is_empty() and str(b.get("nearby_van", "")).is_empty())
	var driveway: Dictionary = result.driveways.filter(func(surface: Dictionary) -> bool: return surface.kind == "driveway")[0]
	var car: Dictionary = result.instances.filter(func(item: Dictionary) -> bool: return item.id == driveway.vehicle_id)[0]
	var rest: Array = result.park_nodes.filter(func(node: Dictionary) -> bool: return node.kind == "rest")
	var vending: Dictionary = result.instances.filter(func(item: Dictionary) -> bool: return item.asset == "PRP_009_vending_machine")[0]
	for shot: Dictionary in [{"name": "industrial_cargo", "focus": cargo[0].center}, {"name": "residential_driveway", "focus": car.position}, {"name": "park", "focus": rest[0].focus}, {"name": "commercial_core", "focus": vending.position}]:
		camera.size = Camera.DEFAULT_SIZE
		camera.position = shot.focus + Camera.OFFSET
		camera.look_at(shot.focus)
		report.runtime_targets.append({"name": shot.name, "focus": var_to_str(shot.focus), "size": camera.size, "offset": var_to_str(Camera.OFFSET)})
		await _pair(host, before, after, shot.name, report)
	# Same geometry and light on a neutral test surface isolate material changes.
	var samples := Node3D.new()
	host.add_child(samples)
	var origin := Vector3(550, 0, 550)
	UrbanView._slab(samples, "MaterialGround", Rect2(Vector2(540, 540), Vector2(20, 20)), -0.01, Color("929996"), "pavement")
	var ids: Array[String] = ["PRP_003_park_bench", "PRP_004_pallet", "PRP_005_wood_crate", "PRP_006_metal_crate"]
	for index: int in ids.size():
		var wrapper: Node3D = Catalog.asset(ids[index]).scene.instantiate()
		samples.add_child(wrapper)
		wrapper.position = origin + Vector3(index * 2.6 - 3.9, 0, 0)
	camera.size = 13
	camera.position = origin + Vector3(5, 10, 14)
	camera.look_at(origin)
	await host._urban_capture("materials_before", report)
	for child: Node3D in samples.get_children():
		if child.get("asset_id") != null:
			PolishView.style(child)
	await host._urban_capture("materials_after", report)
	for label: String in ["overview", "industrial_cargo", "residential_driveway", "park", "commercial_core", "materials"]:
		var prefix := "PROFILE_A_MAIN_STREET_%d_" % host.seed_value
		var first := Image.load_from_file(OUTPUT.path_join(prefix + label + "_before.png"))
		var second := Image.load_from_file(OUTPUT.path_join(prefix + label + "_after.png"))
		first.convert(Image.FORMAT_RGB8)
		second.convert(Image.FORMAT_RGB8)
		var changed := 0
		for x: int in range(0, first.get_width(), 4):
			for y: int in range(0, first.get_height(), 4):
				var delta := first.get_pixel(x, y) - second.get_pixel(x, y)
				if absf(delta.r) + absf(delta.g) + absf(delta.b) > 0.05:
					changed += 1
		if not report.has("changed_pixel_samples"):
			report.changed_pixel_samples = {}
		report.changed_pixel_samples[label] = changed
		if changed < 10:
			host._capture_failed = true
			push_error("Polish difference not visible: " + label)
		var sheet := Image.create(first.get_width() * 2, first.get_height(), false, Image.FORMAT_RGB8)
		sheet.blit_rect(first, Rect2i(Vector2i.ZERO, first.get_size()), Vector2i.ZERO)
		sheet.blit_rect(second, Rect2i(Vector2i.ZERO, second.get_size()), Vector2i(first.get_width(), 0))
		sheet.save_png(OUTPUT.path_join(label + "_comparison.png"))
	FileAccess.open(OUTPUT.path_join("capture-report.json"), FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("POLISH CAPTURE: %d images, failed=%s" % [report.captures.size(), host._capture_failed])
	if inspect:
		camera.size = 348
		camera.position = Vector3(0, 480, 130)
		camera.look_at(Vector3.ZERO)
		return
	host.get_tree().quit(1 if host._capture_failed else 0)

static func _pair(host: Node3D, before: Node3D, after: Node3D, label: String, report: Dictionary) -> void:
	before.show()
	after.hide()
	await host._urban_capture(label + "_before", report)
	before.hide()
	after.show()
	await host._urban_capture(label + "_after", report)
