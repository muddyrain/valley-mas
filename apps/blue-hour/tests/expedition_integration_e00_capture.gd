extends SceneTree

const OUT := "res://test-output/expedition-integration-e00"

func _initialize() -> void:
	call_deferred("run")

func _frame(count: int = 1) -> void:
	for _index: int in count:
		await process_frame

func _capture(label: String) -> void:
	await _frame(2)
	var image := get_root().get_viewport().get_texture().get_image()
	image.save_png(ProjectSettings.globalize_path(OUT.path_join(label + ".png")))

func _overlay(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.position = Vector2(28, 28)
	label.add_theme_font_size_override("font_size", 22)
	label.add_theme_color_override("font_color", Color("#f4e4bc"))
	root.add_child(label)
	return label

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	var app: Node = load("res://core/main.gd").new()
	app.fresh_test_run = true
	app.save_path = "user://test-runs/expedition-integration-e00-capture.json"
	root.add_child(app)
	await _frame(4)
	app.start_mission()
	await _frame(10)
	var mission: Node3D = app.mission
	if not is_instance_valid(mission) or not mission.town_runtime_ready:
		push_error("E00 capture could not enter formal Medium Town Expedition")
		quit(1)
		return
	var label := _overlay("E00 EXPEDITION  |  Seed %d  |  Medium Town V1" % mission.runtime_data.seed)
	await _capture("01_expedition_first_frame")
	label.text = "ARRIVAL  |  survivors=%d  |  point=%s" % [mission.survivors.size(), str(mission.runtime_data.arrival_point)]
	await _capture("02_arrival_spawn")
	label.text = "CAMERA  |  target=squad_center  |  center=%s" % str(mission.squad_center())
	mission.center_squad()
	await _capture("03_camera_centered_on_squad")
	mission.camera_controller.following = false
	mission.camera_center = Vector3(mission.runtime_data.town_bounds.get_center().x, 0, mission.runtime_data.town_bounds.get_center().y)
	mission.camera.size = 260.0
	mission.camera_controller.apply()
	label.text = "TOWN OVERVIEW  |  runtime_root=%s" % mission.runtime_data.runtime_root.name
	await _capture("04_town_overview_from_expedition_camera")
	label.text = "MISSION POI DEBUG  |  id=%s  type=%s  point=%s" % [mission.runtime_data.mission_poi_id, mission.runtime_data.mission_poi_type, str(mission.runtime_data.mission_poi)]
	mission.camera_center = mission.runtime_data.mission_poi
	mission.camera.size = 34.0
	mission.camera_controller.apply()
	await _capture("05_mission_poi_debug_inspection")
	label.text = "SCENETREE  |  RuntimeRoot=%s  provider=MEDIUM_TOWN_V1  |  DebugScene=false" % mission.runtime_data.runtime_root.name
	await _capture("06_scene_tree_runtime_root")
	FileAccess.open(OUT.path_join("capture-manifest.json"), FileAccess.WRITE).store_string(JSON.stringify({"seed": mission.runtime_data.seed, "root": mission.runtime_data.runtime_root.name, "provider": "MEDIUM_TOWN_V1", "captures": 6, "visual_qa": "PENDING HUMAN REVIEW"}, "\t"))
	app.queue_free()
	await _frame(2)
	quit(0)
