extends "res://tests/expedition_minimap.gd"
## Native Phase 3C captures from the production Expedition scene and HUD.

const Dressing = preload("res://maps/town/environment/town_urban_dressing_layer.gd")
const OUTPUT := "res://test-output/town-phase-3c-capture"

var app: Node
var mission: Node3D
var map: Control
var captures: Array[String] = []

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	app = await create_app(4101)
	mission = app.mission
	map = app.hud.minimap
	var town: Dictionary = Generator.generate(mission.mission_type, 4101, "PROFILE_A_MAIN_STREET")
	var dressing: Dictionary = Dressing.new().generate(town)
	await shot("01_official_minimap_ui", null, 0.0)
	await shot("02_full_town_overview", null, 260.0)
	_capture_zone(dressing, "residential", ["PRP_CITY_011_planter_box_pair", "PRP_CITY_013_recycling_bin_pair", "PRP_CITY_031_small_bush_cluster"], 24.0)
	_capture_zone(dressing, "commercial", ["PRP_CITY_016_storefront_menu_stand", "PRP_CITY_017_beverage_crate_stack", "PRP_CITY_019_sidewalk_banner_stand"], 22.0)
	_capture_zone(dressing, "road", ["PRP_CITY_021_street_bollard_set", "PRP_CITY_024_bicycle_parking_rack", "PRP_CITY_030_roadside_grass_patch"], 22.0)
	_capture_zone(dressing, "aftermath", ["PRP_CITY_026_fallen_market_sign", "PRP_CITY_027_cloth_tarp_bundle", "PRP_CITY_028_scattered_box_debris"], 20.0)
	await _capture_density_pair(dressing)
	await _capture_moving_survivor()
	FileAccess.open(OUTPUT.path_join("capture-manifest.json"), FileAccess.WRITE).store_string(JSON.stringify({"phase": "3C", "seed": 4101, "native": DisplayServer.get_name() != "headless", "runtime": "production Expedition scene / Town runtime provider", "captures": captures}, "\t"))
	app.queue_free()
	await process_frame
	print("PHASE_3C NATIVE RUNTIME CAPTURE: %d images" % captures.size())
	quit(0 if captures.size() >= 8 else 1)

func _capture_zone(dressing: Dictionary, label: String, preferred_assets: Array[String], size: float) -> void:
	var candidates: Array = dressing.instances.filter(func(item: Dictionary) -> bool:
		return item.asset in preferred_assets
	)
	if candidates.is_empty():
		candidates = dressing.instances.filter(func(item: Dictionary) -> bool:
			return item.zone == ("INDUSTRIAL" if label == "aftermath" else label.to_upper())
		)
	if candidates.is_empty():
		return
	var item: Dictionary = candidates[0]
	for asset_id: String in preferred_assets:
		for candidate: Dictionary in candidates:
			if candidate.asset == asset_id:
				item = candidate
				break
		if item.asset == asset_id:
			break
	await shot("03_" + label + "_street_group", Vector3(item.position.x, item.position.y, item.position.z), size)

func _capture_density_pair(dressing: Dictionary) -> void:
	var best_sparse: Dictionary = {}
	var best_dense: Dictionary = {}
	var sparse_count := 999
	var dense_count := -1
	for candidate: Dictionary in dressing.instances:
		var count := 0
		for other: Dictionary in dressing.instances:
			if Vector2(candidate.position.x, candidate.position.z).distance_to(Vector2(other.position.x, other.position.z)) <= 12.0:
				count += 1
		if count < sparse_count:
			sparse_count = count
			best_sparse = candidate
		if count > dense_count:
			dense_count = count
			best_dense = candidate
	if not best_sparse.is_empty():
		await shot("07_sparse_block", best_sparse.position, 32.0)
	if not best_dense.is_empty():
		await shot("08_dense_block", best_dense.position, 28.0)

func _capture_moving_survivor() -> void:
	mission.camera_controller.following = true
	var target: Vector3 = mission.runtime_data.mission_poi
	if not mission.command_move(target):
		push_error("Production movement command rejected the Mission POI")
		return
	var initial: Vector3 = mission.survivors[0].position
	for _frame: int in 180:
		mission._physics_process(1.0 / 30.0)
		mission.camera_controller.update(1.0 / 30.0)
		await process_frame
		await RenderingServer.frame_post_draw
	var displacement: float = mission.survivors[0].position.distance_to(initial)
	if displacement <= 0.2:
		push_error("The production survivor did not move before the runtime capture")
		return
	print("PHASE_3C runtime survivor displacement=%.2fm" % displacement)
	await shot("09_survivor_moving_in_live_expedition", null, 0.0)

func shot(label: String, focus: Variant = null, size: float = 0.0) -> void:
	mission.camera_controller.following = false if size > 0.0 or focus != null else mission.camera_controller.following
	if focus != null:
		mission.camera_center = focus
	if size > 0.0:
		mission.camera.size = size
	if size > 0.0 or focus != null:
		mission.camera_controller.apply()
	await process_frame
	await RenderingServer.frame_post_draw
	var path := OUTPUT.path_join(label + ".png")
	root.get_viewport().get_texture().get_image().save_png(ProjectSettings.globalize_path(path))
	captures.append(path)
