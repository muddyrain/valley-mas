extends "res://tests/expedition_minimap_local.gd"
## Native selection clicks and production navigation; no actor teleports.

var app: Node
var mission: Node3D
var map: Control
var overlay: Label
var frame_index: int = 0
var samples: Array[Dictionary] = []
var captures: Dictionary = {}
var stage: String = "Arrival"
var initial_scale: float
var initial_builds: int
var motion_valid: bool = true
var previous_center: Vector3
var previous_origin: Vector2

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(LOCAL_OUT.path_join("frames")))
	app = await create_app(4101)
	mission = app.mission
	map = app.hud.minimap
	overlay = Label.new()
	overlay.position = Vector2(330, 110)
	overlay.add_theme_font_size_override("font_size", 18)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(overlay)
	await render_frame()
	verify_map(mission, map, 4101)
	verify_follow(mission, map)
	verify_equal_markers(mission, map)
	initial_scale = map.map_scale
	initial_builds = map.static_build_count
	previous_center = map.follow_center
	previous_origin = map.map_origin
	var arrival: Vector3 = mission.squad_center()
	await shot("01_local_minimap_arrival")
	await shot("02_all_survivors_visible", true)
	await hold_frames(24)
	await shot("03_static_survivors")
	await select_survivor(1)
	await shot("04_world_selection_does_not_affect_minimap")
	await hold_frames(24)
	await select_survivor(2)
	await shot("08_world_selection_does_not_affect_minimap_c")
	await hold_frames(24)
	verify_edge_marker(map, "poi")
	await shot("06_poi_offscreen_edge_marker")
	var target: Vector3 = mission.runtime_data.mission_poi
	stage = "Arrival > Mission POI"
	await click_move(target)
	var initial_distance: float = mission.survivors[0].remaining_distance()
	var mid: bool = false
	var entered: bool = false
	for tick: int in 6000:
		await advance_frame(true)
		entered = entered or not marker_for(map, "poi").edge
		if not mid and mission.survivors[0].remaining_distance() < initial_distance * .5:
			await shot("05_local_follow_mid_move")
			mid = true
		if mission.survivors.all(func(member: Node3D) -> bool: return member.path.is_empty()):
			break
	check(mission.squad_center().distance_to(target) < 4.0, "All real survivors reach POI")
	check(entered and not marker_for(map, "poi").edge, "POI enters local window and uses real projection")
	verify_edge_marker(map, "arrival")
	verify_equal_markers(mission, map)
	await shot("07_arrived_at_poi")
	await hold_frames(30)
	# Walking away verifies the reverse edge transition instead of faking coordinates.
	stage = "Walk away from POI"
	await click_move(arrival)
	var exited: bool = false
	for tick: int in 3000:
		await advance_frame(true)
		if marker_for(map, "poi").edge:
			exited = true
			break
	check(exited, "POI leaves the local window during actual return movement")
	await shot("09_poi_leaves_local_window")
	await hold_frames(24)
	check(motion_valid, "Every frame retains equal visible survivors, fixed zoom, matching scroll, and frozen static cache")
	check(map.static_build_count == initial_builds, "Native movement never rebuilds static geometry")
	FileAccess.open(LOCAL_OUT.path_join("capture-manifest.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "frames": frame_index, "fps": 30, "seconds": frame_index / 30.0, "captures": captures, "samples": samples, "human_runtime_qa": "PENDING"}, "\t"))
	app.queue_free()
	await process_frame
	print("E01.5 LOCAL NATIVE: %d checks, %d failures, %d frames" % [checks, failures.size(), frame_index])
	quit(0 if failures.is_empty() else 1)

func select_survivor(index: int) -> void:
	var center: Vector3 = map.follow_center
	var points: Array[Vector2] = []
	for item: Dictionary in map.town_markers:
		points.append(item.point)
	var button: Button = app.hud.squad_cards[index].select_button
	var transform: Transform2D = button.get_global_transform_with_canvas()
	await click_at(transform * (button.size * .5))
	await render_frame()
	check(app.hud.selected_member == mission.survivors[index], "Real portrait click selects survivor %d" % index)
	check(map.follow_center == center, "Selection camera locate does not move minimap center")
	for i: int in points.size():
		check(map.town_markers[i].point == points[i], "Selection leaves all map icons in place")
	verify_equal_markers(mission, map)

func click_at(point: Vector2) -> void:
	var event: InputEventMouseButton = InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.position = point
	event.pressed = true
	Input.parse_input_event(event)
	await process_frame
	event.pressed = false
	Input.parse_input_event(event)
	await process_frame

func click_move(target: Vector3) -> void:
	mission.camera_controller.following = false
	mission.camera_center = target
	mission.camera_controller.apply()
	await render_frame()
	await click_at(mission.camera.unproject_position(target))
	check(mission.survivors.all(func(member: Node3D) -> bool: return not member.path.is_empty()), "World click issues production move orders")
	mission.controls.following = false
	mission.center_squad()

func render_frame() -> void:
	overlay.text = "E01.5 FIX QA | LOCAL FOLLOW | 70 x 70 m | seed 4101\nEqual survivors | selected: %s | %s\nSquad center %s | scale %.3f | cache builds %d" % [app.hud.selected_member.data.display_name, stage, str(map.follow_center), map.map_scale, map.static_build_count]
	await process_frame
	await RenderingServer.frame_post_draw

func hold_frames(count: int) -> void:
	for tick: int in count:
		await advance_frame(false)

func advance_frame(move: bool) -> void:
	if move:
		mission._physics_process(1.0 / 30.0)
		mission.camera_controller.update(1.0 / 30.0)
	await render_frame()
	var delta: Vector3 = map.follow_center - previous_center
	motion_valid = motion_valid and map.map_origin.is_equal_approx(previous_origin - Vector2(delta.x, delta.z) * map.map_scale)
	motion_valid = motion_valid and is_equal_approx(map.map_scale, initial_scale) and map.static_build_count == initial_builds
	var count: int = 0
	for marker: Dictionary in map.town_markers:
		motion_valid = motion_valid and marker.anchor.is_equal_approx(map.world_to_minimap(marker.world))
		motion_valid = motion_valid and map.marker_rect.encloses(Rect2(marker.point - Vector2.ONE * marker.diameter * .5, Vector2.ONE * marker.diameter))
		if marker.kind == "survivor":
			count += 1
			motion_valid = motion_valid and marker.diameter == 18.0 and marker.texture == null and not marker.has("selected")
	motion_valid = motion_valid and count == 3
	for member: Node3D in mission.survivors:
		motion_valid = motion_valid and mission.city.navigation.point_clear(member.position)
	previous_center = map.follow_center
	previous_origin = map.map_origin
	if frame_index % 15 == 0:
		var items: Array[Dictionary] = []
		for marker: Dictionary in map.town_markers:
			items.append({"id": str(marker.id), "world": var_to_str(marker.world), "anchor": var_to_str(marker.anchor), "point": var_to_str(marker.point), "edge": marker.edge, "moving": marker.get("moving", false), "searching": marker.get("searching", false), "diameter": marker.diameter})
		samples.append({"frame": frame_index, "stage": stage, "center": var_to_str(map.follow_center), "scale": map.map_scale, "markers": items})
	root.get_texture().get_image().save_jpg(ProjectSettings.globalize_path(LOCAL_OUT.path_join("frames/frame_%05d.jpg" % frame_index)), .9)
	frame_index += 1

func shot(label: String, crop: bool = false) -> void:
	await render_frame()
	var picture: Image = root.get_texture().get_image()
	if crop:
		picture = picture.get_region(Rect2i(map.get_global_transform_with_canvas() * Rect2(Vector2.ZERO, map.size)))
	picture.save_png(ProjectSettings.globalize_path(LOCAL_OUT.path_join(label + ".png")))
	captures[label] = {"frame": frame_index, "squad": var_to_str(mission.squad_center()), "scale": map.map_scale, "selected": app.hud.selected_member.data.id, "static_builds": map.static_build_count}
