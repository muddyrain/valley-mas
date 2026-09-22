extends "res://tests/expedition_minimap.gd"
## Native evidence for the equal-footing survivor marker states.

const OUTPUT_DIRECTORY: String = "res://test-output/minimap-survivor-marker-acceptance"

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIRECTORY))
	var app: Node = await create_app(4101)
	var mission: Node3D = app.mission
	var map: Control = app.hud.minimap
	_check_formal_map_surface()
	map._process(0.0)
	await _capture(map, "01-static.png")
	var moving: Node3D = mission.survivors[0]
	moving.set("current_speed", 1.5)
	moving.set("actual_velocity", Vector3.RIGHT)
	map._process(0.0)
	_check_survivor_state(map, true, false)
	await _capture(map, "02-moving.png")
	moving.set("current_speed", 0.0)
	moving.set("actual_velocity", Vector3.ZERO)
	moving.set("searching", true)
	map._process(0.0)
	_check_survivor_state(map, false, true)
	await _capture(map, "03-searching.png")
	app.queue_free()
	await process_frame
	var report: FileAccess = FileAccess.open(ProjectSettings.globalize_path(OUTPUT_DIRECTORY.path_join("report.json")), FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("MINIMAP SURVIVOR MARKER ACCEPTANCE: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func _check_formal_map_surface() -> void:
	var source := FileAccess.get_file_as_string("res://ui/expedition/minimap.gd")
	check(source.find("Medium Town V1") < 0, "MiniMap has no visible town version label")
	check(source.find("display_name") < 0, "MiniMap has no visible map name label")
	check(source.find("_label_rect") < 0, "MiniMap has no debug label layout state")
	check(source.find("draw_string") < 0, "MiniMap has no text drawing path")

func _check_survivor_state(map: Control, moving: bool, searching: bool) -> void:
	var survivors: Array = map.town_markers.filter(func(marker: Dictionary) -> bool: return marker.kind == "survivor")
	check(survivors.size() == 3, "All three survivors remain visible")
	for marker: Dictionary in survivors:
		check(marker.texture == null, "Survivor marker has no avatar texture")
		check(not marker.has("selected"), "Survivor marker has no selection state")
		if marker.id == survivors[0].id:
			check(bool(marker.moving) == moving and bool(marker.searching) == searching, "Survivor behavior state is reflected")

func _capture(map: Control, filename: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await process_frame
	await RenderingServer.frame_post_draw
	var image: Image = root.get_texture().get_image()
	check(image.save_png(ProjectSettings.globalize_path(OUTPUT_DIRECTORY.path_join(filename))) == OK, "Saved " + filename)
