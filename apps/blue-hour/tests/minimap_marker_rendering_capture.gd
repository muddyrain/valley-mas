extends "res://tests/expedition_minimap.gd"
## Native ten-second MiniMap marker stability capture.

const OUTPUT_DIRECTORY: String = "res://test-output/minimap-marker-rendering-v2"

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIRECTORY.path_join("frames")))
	var app: Node = await create_app(4101)
	var mission: Node3D = app.mission
	var map: Control = app.hud.minimap
	for id: String in mission.city.sites:
		mission.city.sites[id].discovered = true
	map._process(0.0)
	await _render_frame()
	var full_image: Image = root.get_texture().get_image()
	full_image.save_png(ProjectSettings.globalize_path(OUTPUT_DIRECTORY.path_join("minimap_projection_v3_static_1600x900.png")))
	var map_rect: Rect2 = map.get_global_transform_with_canvas() * Rect2(Vector2.ZERO, map.size)
	var map_image: Image = full_image.get_region(Rect2i(map_rect))
	map_image.save_png(ProjectSettings.globalize_path(OUTPUT_DIRECTORY.path_join("minimap_projection_v3_static.png")))
	var stable_records: Dictionary = map.marker_pool.duplicate()
	var initial_center: Vector3 = map.follow_center
	check(mission.command_move(mission.runtime_data.mission_poi), "Native movement command starts for marker capture")
	var movement_seen: bool = false
	var frames_saved: int = 0
	for frame_index: int in 300:
		mission._physics_process(1.0 / 30.0)
		mission.camera_controller.update(1.0 / 30.0)
		map._process(1.0 / 30.0)
		await _render_frame()
		var image: Image = root.get_texture().get_image()
		var frame_path: String = OUTPUT_DIRECTORY.path_join("frames/frame_%04d.jpg" % frame_index)
		image.save_jpg(ProjectSettings.globalize_path(frame_path), 0.82)
		frames_saved += 1
		movement_seen = movement_seen or map.follow_center.distance_to(initial_center) > 0.5
		for marker_id: Variant in stable_records:
			check(is_same(map.marker_pool[marker_id], stable_records[marker_id]), "Marker record stays reused while position updates")
		for marker: Dictionary in map.town_markers:
			check(marker.anchor == map.world_to_minimap(marker.world), "Marker anchor follows the shared pixel-snapped projection")
			if marker.kind == "site":
				check(marker.point == marker.anchor, "Building marker remains fixed to its world projection")
			elif marker.kind == "survivor" and not marker.edge:
				check(marker.point == marker.anchor + Vector2(0, -6), "Survivor marker retains its fixed offset")
			elif marker.kind == "vehicle":
				check(marker.point == marker.anchor + Vector2(0, 6), "Vehicle marker retains its fixed offset")
	check(frames_saved == 300 and movement_seen, "Ten-second capture contains live survivor movement")
	var marker_debug: Array[Dictionary] = []
	for marker: Dictionary in map.marker_pool.values():
		marker_debug.append({"id": str(marker.id), "world_position": var_to_str(marker.world),
			"minimap_position": var_to_str(marker.projected_position), "rounded_position": var_to_str(marker.rounded_position),
			"visible": bool(marker.visible)})
	FileAccess.open(ProjectSettings.globalize_path(OUTPUT_DIRECTORY.path_join("minimap_projection_v3_capture_report.json")), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "frames": frames_saved, "fps": 30, "seconds": frames_saved / 30.0, "frame_size": var_to_str(map.size), "content_size": var_to_str(map.minimap_content_rect.size), "content_rect": var_to_str(map.minimap_content_rect), "world_bounds": var_to_str(map.town_bounds), "marker_records": stable_records.size(), "markers": marker_debug}, "\t"))
	app.queue_free()
	await process_frame
	print("MINIMAP PROJECTION V3 NATIVE: %d checks, %d failures, %d frames" % [checks, failures.size(), frames_saved])
	quit(0 if failures.is_empty() else 1)

func _render_frame() -> void:
	await process_frame
	await RenderingServer.frame_post_draw
