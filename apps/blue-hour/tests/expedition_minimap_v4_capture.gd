extends "res://tests/expedition_minimap.gd"
## Native V4 exploration visibility capture for manual visual review.

const CAPTURE_DIRECTORY: String = "res://test-output/expedition-minimap-v4"

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(CAPTURE_DIRECTORY))
	var app: Node = await create_app(4101)
	var mission: Node3D = app.mission
	var map: Control = app.hud.minimap
	var threat: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", mission.squad_center() + Vector3(8.0, 0.0, 4.0))
	threat.set_physics_process(false)
	mission.exploration.refresh()
	map._process(0.0)
	map.cluster_expanded = true
	await _render_frame()
	_save_capture("exploration_start")
	var initial_explored: int = mission.exploration.exploration_state.explored_cells.size()
	check(initial_explored > 0 and initial_explored < 5000, "Initial field of view reveals a bounded part of the map")
	check(map.town_markers.size() < mission.city.sites.size() + mission.living().size() + 2,
		"Unknown locations are absent from the minimap marker set")
	check(map.survivor_clusters.size() > 0, "Nearby survivors are represented by a squad cluster")
	check(mission.exploration.is_visible(threat.position), "Visible enemy can contribute a danger region")
	check(mission.command_move(mission.runtime_data.mission_poi), "Movement command starts the exploration capture")
	for frame_index: int in 150:
		mission._physics_process(1.0 / 30.0)
		mission.camera_controller.update(1.0 / 30.0)
		map._process(1.0 / 30.0)
		await _render_frame()
	var revealed_after_move: int = mission.exploration.exploration_state.explored_cells.size()
	check(revealed_after_move >= initial_explored, "Exploration memory grows as the squad moves")
	_save_capture("exploration_moved")
	var image: Image = root.get_texture().get_image()
	var minimap_rect: Rect2 = map.get_global_transform_with_canvas() * Rect2(Vector2.ZERO, map.size)
	image.get_region(Rect2i(minimap_rect)).save_png(ProjectSettings.globalize_path(CAPTURE_DIRECTORY.path_join("minimap_v4_1600x900_crop.png")))
	FileAccess.open(ProjectSettings.globalize_path(CAPTURE_DIRECTORY.path_join("capture-report.json")), FileAccess.WRITE).store_string(JSON.stringify({
		"checks": checks,
		"failures": failures,
		"initial_explored_cells": initial_explored,
		"explored_cells_after_movement": revealed_after_move,
		"map_markers": map.town_markers.size(),
		"squad_clusters": map.survivor_clusters.size(),
		"captures": ["exploration_start.png", "exploration_moved.png", "minimap_v4_1600x900_crop.png"]
	}, "\t"))
	app.queue_free()
	await process_frame
	print("MINIMAP V4 NATIVE CAPTURE: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func _save_capture(name: String) -> void:
	var image: Image = root.get_texture().get_image()
	image.save_png(ProjectSettings.globalize_path(CAPTURE_DIRECTORY.path_join(name + ".png")))

func _render_frame() -> void:
	await process_frame
	await RenderingServer.frame_post_draw
