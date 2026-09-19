extends "res://tests/expedition_navigation.gd"
## Native formal-Expedition frames; movement uses the production command/runtime.

var mission: Node3D
var overlay: Label
var frame_index: int = 0
var captures: Dictionary = {}
var closest: Dictionary = {"building": INF, "vehicle": INF, "fence": INF}

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT.path_join("frames")))
	var app: Node = await create_app(4101)
	mission = app.mission
	mission.set_physics_process(false)
	mission.set_process(false)
	await process_frame
	await physics_frame
	check(mission.survivor_commands_enabled, "Native navigation ready")
	overlay = Label.new()
	overlay.position = Vector2(340, 105)
	overlay.add_theme_font_size_override("font_size", 18)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(overlay)
	await render_frame()
	await shot("01_real_survivor_spawn")
	await shot("02_navigation_ready")
	var target: Vector3 = mission.runtime_data.mission_poi
	# Pan to the target using the existing camera, click its screen projection,
	# then use the normal center-squad command. No actor position is assigned.
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
	check(mission.survivors.all(func(member: Node3D) -> bool: return not member.path.is_empty()), "Native world raycast issues three move orders")
	if not failures.is_empty():
		quit(1)
		return
	mission.controls.following = false
	mission.center_squad()
	check(absf(mission.rally_point.y - .08) < .001, "Click VFX target uses Town ground height")
	await render_frame()
	await shot("03_click_move_start")
	var total: float = 0.0
	var collision_free: bool = true
	while frame_index < 6000:
		mission._physics_process(1.0 / 30.0)
		mission.camera_controller.update(1.0 / 30.0)
		await render_frame()
		var picture: Image = root.get_texture().get_image()
		picture.save_jpg(ProjectSettings.globalize_path(OUT.path_join("frames/frame_%05d.jpg" % frame_index)), .85)
		for member: Node3D in mission.survivors:
			collision_free = collision_free and mission.city.navigation.point_clear(member.position)
		if frame_index % 10 == 0:
			capture_obstacles(picture)
		frame_index += 1
		total += 1.0 / 30.0
		if mission.survivors.all(func(member: Node3D) -> bool: return member.path.is_empty()):
			break
	check(frame_index < 6000, "Native squad reaches POI without teleport")
	check(collision_free, "Native movement never penetrates static obstacle or bounds")
	check(mission.squad_center().distance_to(target) < 4.0, "Native squad arrives within POI approach range")
	check(mission.camera_controller.following, "Production camera follows during movement")
	await shot("07_arrival_to_poi_arrived")
	await shot("08_three_survivor_formation")
	for key: String in closest:
		check(closest[key] < 15.0, "Native route shows proximity to " + key)
	FileAccess.open(OUT.path_join("capture-manifest.json"), FileAccess.WRITE).store_string(JSON.stringify({"seed": 4101, "provider": mission.map_provider, "runtime": "survivors/survivor.gd", "models": ["xia_zhiyao", "su_wanxing", "lin"], "frames": frame_index, "fps": 30, "seconds": total, "captures": captures, "closest_obstacles": closest, "checks": checks, "failures": failures, "human_runtime_qa": "PENDING"}, "\t"))
	app.queue_free()
	await process_frame
	print("E01 NATIVE: %d checks, %d failures, %d frames" % [checks, failures.size(), frame_index])
	quit(0 if failures.is_empty() else 1)

func render_frame() -> void:
	if overlay != null:
		overlay.text = "E01 QA | NAV READY | MEDIUM_TOWN_V1 | seed 4101\nReal Survivor x3 | target: Mission POI | remaining %.1f m" % mission.survivors[0].remaining_distance()
	await process_frame
	await RenderingServer.frame_post_draw

func shot(label: String) -> void:
	await render_frame()
	root.get_texture().get_image().save_png(ProjectSettings.globalize_path(OUT.path_join(label + ".png")))
	captures[label] = {"frame": frame_index, "squad": var_to_str(mission.squad_center())}

func capture_obstacles(picture: Image) -> void:
	var labels: Dictionary = {"building": "04_mid_path_around_building", "vehicle": "05_vehicle_avoidance", "fence": "06_fence_avoidance"}
	var center: Vector2 = Vector2(mission.survivors[0].position.x, mission.survivors[0].position.z)
	for obstacle: Dictionary in mission.city.navigation.obstacles:
		var key: String = obstacle.category
		if not closest.has(key):
			continue
		var polygon: PackedVector2Array = obstacle.polygon
		var distance: float = INF
		for i: int in polygon.size():
			distance = minf(distance, center.distance_to(Geometry2D.get_closest_point_to_segment(center, polygon[i], polygon[(i + 1) % polygon.size()])))
		if distance < closest[key]:
			closest[key] = distance
			picture.save_png(ProjectSettings.globalize_path(OUT.path_join(labels[key] + ".png")))
			captures[labels[key]] = {"frame": frame_index, "source": obstacle.source, "asset_id": obstacle.asset_id, "clearance": distance, "squad": var_to_str(mission.squad_center())}
