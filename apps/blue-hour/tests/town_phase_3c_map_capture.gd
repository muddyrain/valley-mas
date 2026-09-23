extends SceneTree
## Focused native Godot views for Phase 3C props and seeded town layouts.

const Generator = preload("res://maps/town/town_generator.gd")
const UrbanView = preload("res://maps/town/town_urban_view.gd")
const Dressing = preload("res://maps/town/environment/town_urban_dressing_layer.gd")
const DressingView = preload("res://maps/town/environment/town_urban_dressing_view.gd")
const OUTPUT := "res://test-output/town-phase-3c-capture"
const SEEDS: Array[int] = [4101, 4102, 4103, 4104, 4105]

var host: Node3D
var camera: Camera3D
var captures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	host = Node3D.new()
	root.add_child(host)
	_build_camera()
	for seed_value: int in SEEDS:
		await _capture_seed(seed_value)
	FileAccess.open(OUTPUT.path_join("map-capture-manifest.json"), FileAccess.WRITE).store_string(JSON.stringify({"phase": "3C", "seeds": SEEDS, "native": DisplayServer.get_name() != "headless", "captures": captures}, "\t"))
	print("PHASE_3C NATIVE MAP CAPTURE: %d images" % captures.size())
	quit(0 if captures.size() >= 7 else 1)

func _capture_seed(seed_value: int) -> void:
	var town: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	var layer := Node3D.new()
	layer.name = "Town_%d" % seed_value
	host.add_child(layer)
	UrbanView.build(layer, town)
	var dressing: Dictionary = Dressing.new().generate(town)
	DressingView.build(layer, town, dressing)
	await _settle()
	if seed_value == 4101:
		camera.size = 280.0
		camera.position = Vector3(0, 420, 145)
		camera.look_at(Vector3.ZERO)
		await _capture("02_seed_4101_town_overview")
		await _capture_focused(dressing, "residential", ["PRP_CITY_011_planter_box_pair", "PRP_CITY_013_recycling_bin_pair", "PRP_CITY_031_small_bush_cluster"], 15.0)
		await _capture_focused(dressing, "commercial", ["PRP_CITY_016_storefront_menu_stand", "PRP_CITY_017_beverage_crate_stack", "PRP_CITY_019_sidewalk_banner_stand"], 14.0)
		await _capture_focused(dressing, "roadside", ["PRP_CITY_021_street_bollard_set", "PRP_CITY_024_bicycle_parking_rack", "PRP_CITY_030_roadside_grass_patch"], 16.0)
		await _capture_focused(dressing, "aftermath", ["PRP_CITY_026_fallen_market_sign", "PRP_CITY_027_cloth_tarp_bundle", "PRP_CITY_028_scattered_box_debris"], 14.0)
		await _capture_density_pair(dressing)
	else:
		camera.size = 280.0
		camera.position = Vector3(0, 420, 145)
		camera.look_at(Vector3.ZERO)
		await _capture("seed_%d_town_overview" % seed_value)
	layer.queue_free()
	await process_frame

func _capture_focused(dressing: Dictionary, label: String, preferred: Array[String], view_size: float) -> void:
	for item: Dictionary in dressing.instances:
		if item.asset not in preferred:
			continue
		camera.size = view_size
		var focus: Vector3 = item.position
		camera.position = focus + Vector3(view_size * 0.42, view_size * 0.56, view_size * 0.48)
		camera.look_at(focus)
		await _capture("03_%s" % label)
		return

func _capture_density_pair(dressing: Dictionary) -> void:
	var sparse: Dictionary = {}
	var dense: Dictionary = {}
	var sparse_count := 999
	var dense_count := -1
	for candidate: Dictionary in dressing.instances:
		var count := 0
		for other: Dictionary in dressing.instances:
			if Vector2(candidate.position.x, candidate.position.z).distance_to(Vector2(other.position.x, other.position.z)) < 14.0:
				count += 1
		if count < sparse_count:
			sparse_count = count
			sparse = candidate
		if count > dense_count:
			dense_count = count
			dense = candidate
	for pair: Dictionary in [{"name": "06_sparse_dressing", "item": sparse}, {"name": "07_dense_dressing", "item": dense}]:
		var item: Dictionary = pair.item
		if item.is_empty():
			continue
		var focus: Vector3 = item.position
		camera.size = 38.0 if pair.name == "06_sparse_dressing" else 30.0
		camera.position = focus + Vector3(15, 20, 16)
		camera.look_at(focus)
		await _capture(pair.name)

func _build_camera() -> void:
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.far = 1200.0
	host.add_child(camera)
	camera.current = true
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.light_energy = 1.1
	host.add_child(sun)
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#aeb8bc")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#b6c4d6")
	environment.ambient_light_energy = 0.7
	world.environment = environment
	host.add_child(world)

func _capture(label: String) -> void:
	await _settle()
	if DisplayServer.get_name() == "headless":
		return
	var path := OUTPUT.path_join(label + ".png")
	if host.get_viewport().get_texture().get_image().save_png(ProjectSettings.globalize_path(path)) == OK:
		captures.append(path)

func _settle() -> void:
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
