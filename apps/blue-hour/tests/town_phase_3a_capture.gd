extends SceneTree
## Native Phase 3A evidence: five seeded overviews plus four focused zones.

const Generator = preload("res://maps/town/town_generator.gd")
const UrbanView = preload("res://maps/town/town_urban_view.gd")
const Dressing = preload("res://maps/town/environment/town_urban_dressing_layer.gd")
const DressingView = preload("res://maps/town/environment/town_urban_dressing_view.gd")
const OUTPUT := "res://test-output/town-phase-3a-capture"
const SEEDS: Array[int] = [4101, 4102, 4103, 4104, 4105]

var camera: Camera3D
var host: Node3D
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
	FileAccess.open(OUTPUT.path_join("capture-manifest.json"), FileAccess.WRITE).store_string(JSON.stringify({"phase": "3B", "seeds": SEEDS, "captures": captures, "native": DisplayServer.get_name() != "headless"}, "\t"))
	print("PHASE_3B CAPTURE: %d images" % captures.size())
	quit()

func _capture_seed(seed_value: int) -> void:
	var town: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	var layer := Node3D.new()
	layer.name = "CaptureTown_%d" % seed_value
	host.add_child(layer)
	UrbanView.build(layer, town)
	var dressing: Dictionary = Dressing.new().generate(town)
	DressingView.build(layer, town, dressing)
	await _settle()
	camera.size = 348.0
	camera.position = Vector3(0, 480, 130)
	camera.look_at(Vector3.ZERO)
	await _capture("seed_%d_overview" % seed_value)
	var focus_by_zone := {"residential": "RESIDENTIAL", "commercial": "COMMERCIAL", "industrial": "INDUSTRIAL", "road": "ROAD", "arrival": "ARRIVAL"}
	var preferred_assets := {
		"residential": ["PRP_CITY_002_ac_unit"],
		"commercial": ["PRP_CITY_001_shop_sign", "PRP_CITY_007_awning", "PRP_CITY_006_bus_shelter"],
		"industrial": ["PRP_CITY_008_cardboard_stack", "PRP_CITY_010_broken_billboard"],
		"road": ["PRP_CITY_003_power_pole", "PRP_CITY_005_traffic_light", "PRP_CITY_009_fire_hydrant"],
		"arrival": []
	}
	for label: String in focus_by_zone:
		var zone: String = focus_by_zone[label]
		var items: Array = dressing.instances.filter(func(item: Dictionary) -> bool: return item.zone == zone)
		if items.is_empty():
			continue
		var target_item: Dictionary = items[0]
		for asset_id: String in preferred_assets[label]:
			for item: Dictionary in items:
				if item.asset == asset_id:
					target_item = item
					break
			if target_item.asset == asset_id:
				break
		var focus: Vector3 = target_item.position
		camera.size = 14.0 if target_item.asset.begins_with("PRP_CITY_") else (22.0 if zone != "ARRIVAL" else 28.0)
		var view_direction := Vector2(1, 1).normalized()
		var site_id: String = target_item.get("mount_site", target_item.get("anchor", ""))
		for site: Dictionary in town.buildings:
			if site.id != site_id:
				continue
			var road_side := Vector2(site.road_point.x, site.road_point.z) - Vector2(site.position.x, site.position.z)
			var block_side := Vector2(site.entry.x, site.entry.z) - Vector2(site.road_point.x, site.road_point.z)
			view_direction = road_side.normalized() if not target_item.get("mount_site", "").is_empty() else block_side.normalized()
			break
		if view_direction.is_zero_approx():
			view_direction = Vector2(1, 1).normalized()
		var view_distance := 12.0 if target_item.asset.begins_with("PRP_CITY_") else 20.0
		camera.position = focus + Vector3(view_direction.x * view_distance, maxf(view_distance * 0.65, 9.0), view_direction.y * view_distance)
		camera.look_at(focus)
		await _capture("seed_%d_%s" % [seed_value, label])
	layer.queue_free()
	await process_frame

func _build_camera() -> void:
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.far = 1000.0
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
	var image := host.get_viewport().get_texture().get_image()
	if image.save_png(ProjectSettings.globalize_path(path)) == OK:
		captures.append(path)

func _settle() -> void:
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
