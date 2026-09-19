extends "res://tests/expedition_minimap.gd"
## Rendered production Mission/HUD, driven by the real click and movement paths.

var mission: Node3D
var map: Control
var overlay: Label
var frame_index: int = 0
var samples: Array[Dictionary] = []
var captures: Dictionary = {}

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT.path_join("frames")))
	var app: Node = await create_app(4101)
	mission = app.mission
	map = app.hud.minimap
	overlay = Label.new()
	overlay.position = Vector2(330, 110)
	overlay.add_theme_font_size_override("font_size", 18)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(overlay)
	await render_frame()
	verify_map(mission, map, 4101)
	await shot("01_minimap_town_ready")
	await shot("02_minimap_roads_buildings", true)
	await shot("03_minimap_arrival_markers")
	var local_scale: float = map.map_scale
	var builds: int = map.static_build_count
	var target: Vector3 = mission.runtime_data.mission_poi
	mission.camera_controller.following = false
	mission.camera_center = target
	mission.camera_controller.apply()
	await render_frame()
	var click: InputEventMouseButton = InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = mission.camera.unproject_position(target)
	click.pressed = true
	Input.parse_input_event(click)
	await process_frame
	click.pressed = false
	Input.parse_input_event(click)
	await process_frame
	check(mission.survivors.all(func(member: Node3D) -> bool: return not member.path.is_empty()), "Native world click orders all three survivors")
	if not failures.is_empty():
		quit(1)
		return
	mission.controls.following = false
	mission.center_squad()
	var initial: Vector3 = mission.survivors[0].position
	var remaining: float = mission.survivors[0].remaining_distance()
	var mid_captured: bool = false
	var safe: bool = true
	var markers_valid: bool = true
	var stable: bool = true
	while frame_index < 6000:
		mission._physics_process(1.0 / 30.0)
		mission.camera_controller.update(1.0 / 30.0)
		await render_frame()
		var picture: Image = root.get_texture().get_image()
		picture.save_jpg(ProjectSettings.globalize_path(OUT.path_join("frames/frame_%05d.jpg" % frame_index)), .9)
		for member: Node3D in mission.survivors:
			safe = safe and mission.city.navigation.point_clear(member.position)
		for marker: Dictionary in map.town_markers:
			markers_valid = markers_valid and marker.anchor.is_equal_approx(map.world_to_minimap(marker.world))
			markers_valid = markers_valid and map.marker_rect.encloses(Rect2(marker.point - Vector2.ONE * marker.diameter * .5, Vector2.ONE * marker.diameter))
		stable = stable and map.static_build_count == builds and map.map_scale == local_scale and map.follow_center.is_equal_approx(mission.squad_center())
		if frame_index % 15 == 0:
			var actors: Array[Dictionary] = []
			for marker: Dictionary in map.town_markers:
				actors.append({"id": str(marker.id), "world": var_to_str(marker.world), "anchor": var_to_str(marker.anchor), "point": var_to_str(marker.point)})
			samples.append({"frame": frame_index, "markers": actors})
		if not mid_captured and mission.survivors[0].remaining_distance() < remaining * .5:
			await shot("04_minimap_mid_movement")
			mid_captured = true
		frame_index += 1
		if mission.survivors.all(func(member: Node3D) -> bool: return member.path.is_empty()):
			break
	check(frame_index < 6000 and mission.squad_center().distance_to(target) < 4.0, "Native squad reaches POI using production navigation")
	check(mission.survivors[0].position.distance_to(initial) > 30.0, "Real survivor traverses Town")
	check(safe, "Movement stays outside frozen static blockers")
	check(stable, "Local window follows squad with fixed scale and no geometry rebuild")
	check(markers_valid, "Every captured frame has accurate in-bounds anchors and icons")
	verify_markers(mission, map)
	await shot("05_minimap_at_mission_poi")
	app.queue_free()
	await process_frame
	for seed_value: int in [4102, 4103, 4104]:
		app = await create_app(seed_value)
		mission = app.mission
		map = app.hud.minimap
		await render_frame()
		verify_map(mission, map, seed_value)
		await shot("%02d_seed_%d_minimap" % [seed_value - 4096, seed_value])
		app.queue_free()
		await process_frame
	var legacy: Node = await create_app(4101, "FIXED_LEGACY")
	mission = legacy.mission
	map = legacy.hud.minimap
	overlay.text = "E01.5 QA | FIXED_LEGACY regression"
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(ProjectSettings.globalize_path(OUT.path_join("09_legacy_minimap.png")))
	check(not map.static_layer.visible, "Native legacy frame uses original renderer")
	legacy.queue_free()
	await process_frame
	FileAccess.open(OUT.path_join("capture-manifest.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "frames": frame_index, "fps": 30, "seconds": frame_index / 30.0, "captures": captures, "samples": samples, "human_runtime_qa": "PENDING"}, "\t"))
	print("E01.5 NATIVE: %d checks, %d failures, %d frames" % [checks, failures.size(), frame_index])
	quit(0 if failures.is_empty() else 1)

func render_frame() -> void:
	overlay.text = "E01.5 QA | MEDIUM_TOWN_V1 | seed %d\nbounds %s | scale %.3f | markers %d\nArrival > Mission POI | remaining %.1f m" % [mission.runtime_data.seed, str(map.town_bounds), map.map_scale, map.town_markers.size(), mission.survivors[0].remaining_distance()]
	await process_frame
	await RenderingServer.frame_post_draw

func shot(label: String, crop: bool = false) -> void:
	await render_frame()
	var picture: Image = root.get_texture().get_image()
	if crop:
		var rect: Rect2 = map.get_global_transform_with_canvas() * Rect2(Vector2.ZERO, map.size)
		picture = picture.get_region(Rect2i(rect))
	picture.save_png(ProjectSettings.globalize_path(OUT.path_join(label + ".png")))
	captures[label] = {"frame": frame_index, "seed": mission.runtime_data.seed, "squad": var_to_str(mission.squad_center()), "static_build_count": map.static_build_count}
