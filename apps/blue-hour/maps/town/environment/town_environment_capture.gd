extends RefCounted

const OUTPUT := "res://test-output/medium-town-environment-m00"
const Generator = preload("res://maps/town/town_generator.gd")
const EnvironmentPass = preload("res://maps/town/environment/town_environment_pass.gd")
const ExpeditionCamera = preload("res://missions/expedition_camera.gd")

static func run(host: Node3D, inspect: bool, street_life: bool = false) -> void:
	# Isolated output is intentional: this mode can never overwrite Blueprint evidence.
	var output := "res://test-output/medium-town-environment-m01" if street_life else OUTPUT
	host.output_dir = output
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output))
	host.town = Generator.generate("food_supply", host.seed_value, "PROFILE_A_MAIN_STREET")
	var town: Dictionary = host.town
	if not town.ok:
		push_error(town.error)
		host.get_tree().quit(1)
		return
	preload("res://maps/town/town_urban_view.gd").build(host, town)
	var start := Time.get_ticks_msec()
	var pass_instance: RefCounted = preload("res://maps/town/environment/town_street_life_pass.gd").new() if street_life else EnvironmentPass.new()
	var result: Dictionary = pass_instance.generate(town)
	var elapsed := Time.get_ticks_msec() - start
	var layer := preload("res://maps/town/environment/town_environment_view.gd").build(host, result)
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
	var report := {"seed": town.seed, "visual_qa": "PENDING HUMAN REVIEW", "debug_overlay": false, "captures": [], "statistics": result.statistics, "by_land_use": result.by_land_use, "parking_legal": result.parking_legal, "parking_occupied": result.parking_occupied, "parking_occupancy": result.parking_occupancy, "environment_generate_ms": elapsed, "runtime_instances": layer.get_child_count(), "runtime_targets": [], "rejections": result.rejections, "before_overview": "../medium-town-blueprint/PROFILE_A_MAIN_STREET_4101_overview.png"}
	if street_life:
		report.phase = "M01"
		report.groups = result.groups
		report.openings = result.openings
		report.base_instances = result.base_instances
		report.before_overview = "PROFILE_A_MAIN_STREET_%d_before_m01.png" % town.seed
	camera.size = 348
	camera.position = Vector3(0, 480, 130)
	camera.look_at(Vector3.ZERO)
	if DisplayServer.get_name() != "headless":
		if street_life:
			for index: int in range(result.base_instances, layer.get_child_count()):
				layer.get_child(index).hide()
			await host._urban_capture("before_m01", report)
			for index: int in range(result.base_instances, layer.get_child_count()):
				layer.get_child(index).show()
		await host._urban_capture("overview", report)
	for shot: Array in [["commercial_core", "COMMERCIAL_CORE"], ["residential", "RESIDENTIAL_B"], ["park", "OPEN_SPACE"], ["industrial_service", "INDUSTRIAL_SERVICE"]]:
		var blocks: Array = town.blocks.filter(func(block: Dictionary) -> bool: return block.land_use_type == shot[1])
		var block: Dictionary = blocks[0]
		var industrial_target: Dictionary = {}
		if shot[0] == "industrial_service":
			industrial_target = _industrial_target(town, result)
			if not industrial_target.is_empty():
				block = industrial_target.block
		var sites: Array = town.buildings.filter(func(site: Dictionary) -> bool: return site.block_id == block.id)
		var focus := Vector3(block.center.x, 0, block.center.y)
		if not sites.is_empty():
			var site: Dictionary = sites[sites.size() / 2]
			focus = site.position.lerp(site.road_point, 0.5)
		if shot[0] == "commercial_core":
			var nearest := INF
			var lamp_focus := focus
			for item: Dictionary in result.instances:
				if item.block_id == block.id and item.asset == preload("res://maps/town/environment/town_environment_rules.gd").LAMP:
					var distance: float = item.position.distance_to(focus)
					if distance < nearest:
						nearest = distance
						lamp_focus = item.position
			focus = lamp_focus.lerp(focus, 0.2)
		elif shot[0] == "industrial_service":
			if not industrial_target.is_empty():
				focus = industrial_target.focus
		if street_life:
			var preferred: String = {"commercial_core": "PRP_009_vending_machine", "residential": "BAR_002_residential_low_fence", "park": "PRP_003_park_bench", "industrial_service": "PRP_004_pallet"}[shot[0]]
			for item: Dictionary in result.instances:
				if item.asset == preferred and item.land_use == shot[1]:
					focus = item.position
					block = town.blocks.filter(func(candidate: Dictionary) -> bool: return candidate.id == item.block_id)[0]
					break
		camera.size = ExpeditionCamera.DEFAULT_SIZE
		camera.position = focus + ExpeditionCamera.OFFSET
		camera.look_at(focus)
		report.runtime_targets.append({"shot": shot[0], "block": block.id, "focus": var_to_str(focus), "camera_size": camera.size, "offset": var_to_str(ExpeditionCamera.OFFSET)})
		if DisplayServer.get_name() != "headless":
			await host._urban_capture(shot[0], report)
	if street_life and DisplayServer.get_name() != "headless":
		# An opposing inspection angle reveals vending fronts hidden behind buildings
		# in the fixed Expedition camera. The placement and source geometry stay unchanged.
		for item: Dictionary in result.instances:
			if item.asset != "PRP_009_vending_machine":
				continue
			var facing := Basis(Vector3.UP, item.yaw) * Vector3.FORWARD
			camera.size = 16.0
			camera.position = item.position + facing * 30 + Vector3.UP * 30 + facing.cross(Vector3.UP) * 12
			camera.look_at(item.position)
			await host._urban_capture("commercial_detail", report)
			break
		if not result.openings.is_empty():
			var opening: Dictionary = result.openings[0]
			var center: Vector2 = opening.bounds.get_center()
			var focus := Vector3(center.x, 0, center.y)
			camera.size = ExpeditionCamera.DEFAULT_SIZE
			camera.position = focus + ExpeditionCamera.OFFSET
			camera.look_at(focus)
			await host._urban_capture("residential_entry", report)
		var before := Image.load_from_file(output.path_join("PROFILE_A_MAIN_STREET_%d_before_m01.png" % town.seed))
		var after := Image.load_from_file(output.path_join("PROFILE_A_MAIN_STREET_%d_overview.png" % town.seed))
		var changed_samples := 0
		for x: int in range(0, after.get_width(), 4):
			for y: int in range(0, after.get_height(), 4):
				var delta := after.get_pixel(x, y) - before.get_pixel(x, y)
				if absf(delta.r) + absf(delta.g) + absf(delta.b) > 0.05:
					changed_samples += 1
		report.new_asset_pixel_samples = changed_samples
		if changed_samples < 100:
			host._capture_failed = true
			push_error("M01 added assets are not visible in the rendered Town")
	var overlay := preload("res://maps/town/environment/town_environment_overlay.gd").new()
	overlay.result = result
	overlay.camera = camera
	host.add_child(overlay)
	overlay.hide()
	var controls := HBoxContainer.new()
	controls.position = Vector2(24, 12)
	host.add_child(controls)
	controls.hide()
	report.overlay_toggle_checks = {}
	for setting: String in ["slots", "categories", "clear_zones"]:
		var toggle := CheckButton.new()
		toggle.text = setting.capitalize()
		toggle.toggled.connect(func(enabled: bool) -> void: overlay.set(setting, enabled))
		controls.add_child(toggle)
		toggle.button_pressed = true
		var enabled: bool = overlay.get(setting)
		toggle.button_pressed = false
		report.overlay_toggle_checks[setting] = enabled and not overlay.get(setting)
		toggle.button_pressed = true
	FileAccess.open(output.path_join("capture-report.json"), FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("ENVIRONMENT CAPTURE: " + JSON.stringify(report))
	if inspect:
		camera.size = 348
		camera.position = Vector3(0, 480, 130)
		camera.look_at(Vector3.ZERO)
		overlay.show()
		controls.show()
		return
	host.get_tree().quit(1 if host._capture_failed else 0)

static func _industrial_target(town: Dictionary, result: Dictionary) -> Dictionary:
	var best: Dictionary = {}
	var span := INF
	for block: Dictionary in town.blocks:
		if block.land_use_type != "INDUSTRIAL_SERVICE":
			continue
		var fences: Array = result.instances.filter(func(item: Dictionary) -> bool: return item.block_id == block.id and item.asset.begins_with("BAR_"))
		var vans: Array = result.instances.filter(func(item: Dictionary) -> bool: return item.block_id == block.id and item.asset == preload("res://maps/town/environment/town_environment_rules.gd").VAN)
		for site: Dictionary in town.buildings:
			if site.block_id != block.id:
				continue
			for fence: Dictionary in fences:
				for van: Dictionary in vans:
					var perimeter: float = site.position.distance_to(fence.position) + fence.position.distance_to(van.position) + van.position.distance_to(site.position)
					if perimeter < span:
						span = perimeter
						best = {"block": block, "focus": (site.position + fence.position + van.position) / 3.0}
	return best
