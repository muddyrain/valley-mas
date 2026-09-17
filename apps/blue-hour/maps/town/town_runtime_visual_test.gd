extends Node3D
## Native capture and planning inspection for seed-driven Medium Town profiles.
const Generator = preload("res://maps/town/town_generator.gd")
const Profiles = preload("res://maps/town/town_skeleton.gd")
const Assets = preload("res://data/world_asset_catalog.gd")
const RoadVisuals = preload("res://maps/generation/road_generator.gd")

var town: Dictionary = {}
var camera: Camera3D
var output_dir: String = "res://test-output/medium-town-phase-a"
@export_enum("PROFILE_A_MAIN_STREET", "PROFILE_B_OFFSET_GRID", "PROFILE_C_LOOP") var profile: String = Profiles.IDS[0]
@export var seed_value: int = 4101
var _capture_failed: bool = false
var _inspect: bool = false

func _ready() -> void:
	_parse_arguments()
	if OS.get_cmdline_user_args().has("--town-environment-polish"):
		await preload("res://maps/town/environment/town_polish_capture.gd").run(self, _inspect)
		return
	if OS.get_cmdline_user_args().has("--town-street-life"):
		await preload("res://maps/town/environment/town_environment_capture.gd").run(self, _inspect, true)
		return
	if OS.get_cmdline_user_args().has("--town-environment"):
		await preload("res://maps/town/environment/town_environment_capture.gd").run(self, _inspect)
		return
	if profile == Profiles.IDS[0]:
		await _run_urban()
		return
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_dir))
	var generate_started := Time.get_ticks_usec()
	town = Generator.generate("food_supply", seed_value, profile)
	var generate_ms := float(Time.get_ticks_usec() - generate_started) / 1000.0
	var build_started := Time.get_ticks_usec()
	_build_town()
	var build_ms := float(Time.get_ticks_usec() - build_started) / 1000.0
	_build_camera()
	await get_tree().process_frame
	await get_tree().process_frame
	camera.position = Vector3(0, 280, 12)
	camera.look_at(Vector3(0, 0, 0), Vector3.UP)
	camera.fov = 50.0
	await _settle()
	_capture("%s_%d_overview.png" % [profile, seed_value])
	camera.position = Vector3(-42, 25, -52)
	camera.look_at(Vector3(0, 3, 0), Vector3.UP)
	camera.fov = 58.0
	await _settle()
	_capture("%s_%d_runtime.png" % [profile, seed_value])
	print("TOWN_CAPTURE profile=%s seed=%d buildings=%d blocks=%d bounds=%s generate_ms=%.2f build_ms=%.2f" % [profile, seed_value, town.buildings.size(), town.blocks.size(), str(town.bounds), generate_ms, build_ms])
	get_tree().quit(0)

func _build_town() -> void:
	var ground := MeshInstance3D.new()
	ground.name = "TownGround"
	var ground_mesh := BoxMesh.new(); ground_mesh.size = Vector3(300, 0.3, 350); ground.mesh = ground_mesh
	ground.position.y = -0.2; ground.material_override = _material(Color("#67785f")); add_child(ground)
	for road: Dictionary in town.roads:
		var start: Vector2 = road.start; var end: Vector2 = road.end; var midpoint := (start + end) * 0.5
		var length := start.distance_to(end); var road_view := RoadVisuals.slab(self, Vector3(road.width, 0.08, length), Vector3(midpoint.x, 0.0, midpoint.y), Color("#3f4b58"))
		road_view.rotation.y = -atan2(end.x - start.x, end.y - start.y)
	for block: Dictionary in town.blocks:
		var block_view := RoadVisuals.slab(self, Vector3(block.size.x, 0.04, block.size.y), Vector3(block.center.x, -0.01, block.center.y), _block_color(block.type))
		block_view.name = "Block_" + block.id
	for building: Dictionary in town.buildings:
		var definition: Resource = Assets.asset(building.asset)
		if definition == null or definition.scene == null: continue
		var instance: Node3D = definition.scene.instantiate()
		instance.name = building.id + "_" + building.asset
		instance.position = building.position
		instance.rotation.y = building.get("yaw", 0.0)
		add_child(instance)
		if building.poi:
			_add_marker(building.position + Vector3.UP * 8.0, Color("#e4b65b"), "MissionPOI")
	_add_marker(town.arrival.position + Vector3.UP * 5.0, Color("#68b8d6"), "BusArrival")
	_add_boundary()

func _build_camera() -> void:
	camera = Camera3D.new(); camera.name = "TownCamera"; camera.projection = Camera3D.PROJECTION_PERSPECTIVE; add_child(camera); camera.current = true
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-52, -28, 0); sun.light_energy = 1.2; add_child(sun)
	var world := WorldEnvironment.new(); var environment := Environment.new(); environment.background_mode = Environment.BG_COLOR; environment.background_color = Color("#aeb8bc"); environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; environment.ambient_light_color = Color("#b8c5c7"); environment.ambient_light_energy = 0.65; world.environment = environment; add_child(world)

func _add_boundary() -> void:
	var bounds: Rect2 = town.bounds
	for point in [Vector2(bounds.position.x, bounds.position.y), Vector2(bounds.end.x, bounds.position.y), Vector2(bounds.end.x, bounds.end.y), Vector2(bounds.position.x, bounds.end.y)]:
		_add_marker(Vector3(point.x, 0.2, point.y), Color("#718b6c"), "Boundary")

func _add_marker(position: Vector3, color: Color, marker_name: String) -> void:
	var marker := MeshInstance3D.new(); marker.name = marker_name; var mesh := CylinderMesh.new(); mesh.top_radius = 1.8 if marker_name == "MissionPOI" else 1.3; mesh.bottom_radius = mesh.top_radius; mesh.height = 0.12; marker.mesh = mesh; marker.position = position; marker.material_override = _material(color); add_child(marker)

func _block_color(kind: String) -> Color:
	if kind.begins_with("COMMERCIAL"): return Color("#9d927d")
	if kind == "INDUSTRIAL_BLOCK_A": return Color("#818b8a")
	if kind in ["GAS_SERVICE_BLOCK", "PARKING_SERVICE_BLOCK"]: return Color("#858f87")
	return Color("#899875")

func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new(); material.albedo_color = color; material.roughness = 0.9; return material

func _capture(file_name: String) -> void:
	var image := get_viewport().get_texture().get_image(); image.save_png(output_dir.path_join(file_name))

func _settle() -> void:
	await get_tree().process_frame
	await get_tree().process_frame

func _parse_arguments() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--town-profile="): profile = argument.trim_prefix("--town-profile=")
		elif argument.begins_with("--town-seed="): seed_value = int(argument.trim_prefix("--town-seed="))
		elif argument.begins_with("--town-output="): output_dir = argument.trim_prefix("--town-output=")
		elif argument == "--town-inspect": _inspect = true

func _run_urban() -> void:
	output_dir = "res://test-output/medium-town-blueprint" if output_dir == "res://test-output/medium-town-phase-a" else output_dir
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_dir))
	var start := Time.get_ticks_usec()
	town = Generator.generate("food_supply", seed_value, profile)
	var generate_ms := (Time.get_ticks_usec() - start) / 1000.0
	if not town.ok:
		push_error(town.error)
		get_tree().quit(1)
		return
	start = Time.get_ticks_usec()
	preload("res://maps/town/town_urban_view.gd").build(self, town)
	var build_ms := (Time.get_ticks_usec() - start) / 1000.0
	_build_camera()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.far = 1000.0
	var sun: DirectionalLight3D = get_children().filter(func(node: Node) -> bool: return node is DirectionalLight3D)[0]
	sun.shadow_enabled = true
	sun.light_energy = 0.56
	sun.light_color = Color("#fff1d9")
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.directional_shadow_max_distance = 600.0
	var world: WorldEnvironment = get_children().filter(func(node: Node) -> bool: return node is WorldEnvironment)[0]
	world.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	world.environment.ambient_light_energy = 0.48
	world.environment.ambient_light_color = Color("#b6c4d6")
	var report := {"profile": profile, "seed": seed_value, "town_bounds": str(town.bounds), "blocks": town.blocks.size(), "parcels": town.parcels.size(), "buildings": town.buildings.size(), "generate_ms": generate_ms, "build_ms": build_ms, "visual_qa": "PENDING HUMAN REVIEW", "captures": []}
	report.blueprint = town.blueprint
	report.actual_developed_envelope = str(town.developed_envelope)
	report.orientation_quarters = town.orientation_quarters
	report.arrival_candidates = town.arrival_candidates
	report.exploration_routes = town.exploration_routes
	report.exploration_route_count = town.exploration_routes.size()
	report.arrival = {"id": town.arrival.id, "position": str(town.arrival.position), "connected": town.arrival.connected}
	report.poi = {"id": town.poi.id, "asset": town.poi.asset, "position": str(town.poi.position), "road_distance": town.road_distance_to_poi, "reachable": town.poi.reachable}
	report.debug_overlay = false
	FileAccess.open(output_dir.path_join("generated-town.txt"), FileAccess.WRITE).store_string(var_to_str(town))
	var expedition_camera := preload("res://missions/expedition_camera.gd")
	camera.size = 348.0
	camera.position = Vector3(0, 480, 130)
	camera.look_at(Vector3.ZERO)
	if DisplayServer.get_name() != "headless":
		await _urban_capture("overview", report)
	var overlay := preload("res://maps/town/town_planning_overlay.gd").new()
	overlay.town = town
	overlay.camera = camera
	add_child(overlay)
	var planning_controls := _planning_controls(overlay, report)
	if DisplayServer.get_name() != "headless":
		await _urban_capture("planning", report)
	overlay.hide()
	var commercial: Dictionary = town.blocks.filter(func(block: Dictionary) -> bool: return block.land_use_type == "COMMERCIAL_CORE")[0]
	var residential: Dictionary = town.blocks.filter(func(block: Dictionary) -> bool: return block.land_use_type == "RESIDENTIAL_B")[0]
	var service: Dictionary = town.blocks.filter(func(block: Dictionary) -> bool: return block.land_use_type == "MIXED_TRANSITION")[0]
	report.runtime_targets = []
	for shot: Array in [["commercial_core", commercial], ["residential", residential], ["mixed_industrial", service]]:
		var sites: Array = town.buildings.filter(func(site: Dictionary) -> bool: return site.block_id == shot[1].id)
		var middle: Dictionary = sites[sites.size() / 2]
		var focus: Vector3 = middle.position.lerp(middle.road_point, 0.5)
		if shot[0] == "mixed_industrial":
			var nearest := INF
			for mixed_site: Dictionary in sites:
				for edge_site: Dictionary in town.buildings:
					if edge_site.land_use_type != "INDUSTRIAL_SERVICE":
						continue
					var distance: float = mixed_site.position.distance_to(edge_site.position)
					if distance < nearest:
						nearest = distance
						focus = mixed_site.position.lerp(edge_site.position, 0.5)
		camera.size = expedition_camera.DEFAULT_SIZE
		camera.position = focus + expedition_camera.OFFSET
		camera.look_at(focus)
		report.runtime_targets.append({"shot": shot[0], "block_id": shot[1].id, "focus": str(focus)})
		if DisplayServer.get_name() != "headless":
			await _urban_capture(shot[0], report)
	report.runtime_camera = {"projection": "orthogonal", "size": expedition_camera.DEFAULT_SIZE, "offset": str(expedition_camera.OFFSET), "fov": "not applicable to orthogonal projection"}
	FileAccess.open(output_dir.path_join("capture-report.json"), FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("URBAN CAPTURE: " + JSON.stringify(report))
	if _inspect:
		camera.size = 348.0
		camera.position = Vector3(0, 480, 130)
		camera.look_at(Vector3.ZERO)
		overlay.show()
		planning_controls.show()
		return
	get_tree().quit(1 if _capture_failed else 0)

func _planning_controls(overlay: Node2D, report: Dictionary) -> HBoxContainer:
	var controls := HBoxContainer.new()
	controls.position = Vector2(24, 12)
	controls.hide()
	add_child(controls)
	report.overlay_toggle_checks = {}
	for setting: String in ["zones", "routes", "arrivals", "poi"]:
		var toggle := CheckButton.new()
		toggle.text = setting.capitalize()
		toggle.button_pressed = true
		toggle.toggled.connect(func(enabled: bool) -> void: overlay.set(setting, enabled))
		controls.add_child(toggle)
		toggle.button_pressed = false
		var disabled: bool = overlay.get(setting) == false
		toggle.button_pressed = true
		var enabled: bool = overlay.get(setting) == true
		report.overlay_toggle_checks[setting] = disabled and enabled
		if not disabled or not enabled:
			_capture_failed = true
			push_error("Planning toggle failed: " + setting)
	return controls

func _urban_capture(label: String, report: Dictionary) -> void:
	for frame: int in 12:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var pixels := get_viewport().get_texture().get_image()
	var path := output_dir.path_join("%s_%d_%s.png" % [profile, seed_value, label])
	if pixels == null or pixels.save_png(path) != OK:
		_capture_failed = true
		push_error("Capture failed: " + path)
		return
	var colors: Dictionary = {}
	for x: int in range(0, pixels.get_width(), 32):
		for y: int in range(0, pixels.get_height(), 32):
			colors[pixels.get_pixel(x, y).to_html()] = true
	if colors.size() < 24:
		_capture_failed = true
		push_error("Capture has insufficient rendered content: " + path)
	if label == "overview":
		var image_scale := Vector2(pixels.get_size()) / get_viewport().get_visible_rect().size
		report.overview_locators = {"arrival_pixel": str(camera.unproject_position(town.arrival.position) * image_scale), "poi_pixel": str(camera.unproject_position(town.poi.position) * image_scale)}
		var viewport_rect := get_viewport().get_visible_rect().grow(-8)
		var bounds: Rect2 = town.bounds
		for corner: Vector2 in [bounds.position, bounds.end, Vector2(bounds.position.x, bounds.end.y), Vector2(bounds.end.x, bounds.position.y)]:
			if not viewport_rect.has_point(camera.unproject_position(Vector3(corner.x, 0, corner.y))):
				_capture_failed = true
				push_error("Town corner is outside overview")
	report.captures.append(ProjectSettings.globalize_path(path))
	if not report.has("capture_overlays"):
		report.capture_overlays = {}
	report.capture_overlays[label] = label == "planning"

