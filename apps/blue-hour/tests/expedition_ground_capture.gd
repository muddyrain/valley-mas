extends "res://tests/survivor_production_gameplay.gd"
## Real Expedition paths and native skin samples on the unchanged seed 4101.
var surface_records: Array[Dictionary] = []
var worst_actor_error: float = 0.0
var worst_marker_error: float = 0.0

func _arguments() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--character="):
			character_id = arg.trim_prefix("--character=")
		if arg == "--capture":
			capture_enabled = true
	view_name = "close"
	output_directory = "res://test-output/ground-contract/" + character_id
	DirAccess.make_dir_recursive_absolute(output_directory + "/frames")

func _frame(label: String) -> void:
	var before: int = samples.size()
	await super._frame(label)
	if samples.size() > before:
		var sample: Dictionary = samples[-1]
		var ground_y: float = mission.city.get_walkable_ground_height(Vector2(member.global_position.x, member.global_position.z))
		sample["ground_y"] = ground_y
		worst_actor_error = maxf(worst_actor_error, absf(member.global_position.y - ground_y))
		sample["rig_local_y"] = member.rig.position.y
		var vfx: Node3D = mission.world_interaction_vfx
		vfx.set_selected_member(member)
		vfx._process(0)
		var marker_y: float = vfx.selection_ring.global_position.y
		worst_marker_error = maxf(worst_marker_error, absf(marker_y - ground_y - .012))
		sample["selection_y"] = marker_y

func _uniform(point: Vector3, height: float) -> bool:
	if not mission.city.navigation.point_clear(point):
		return false
	for offset: Vector3 in [Vector3.ZERO, Vector3(.35, 0, .35), Vector3(-.35, 0, .35), Vector3(.35, 0, -.35), Vector3(-.35, 0, -.35)]:
		var p := point + offset
		if absf(mission.city.get_walkable_ground_height(Vector2(p.x, p.z)) - height) > .0001:
			return false
	return true

func _route(kind: String) -> PackedVector3Array:
	var origin: Vector3 = member.position
	var matches: Array[Node] = mission.city.find_children("*", "MeshInstance3D", true, false)
	for node: Node in matches:
		var view := node as MeshInstance3D
		if not view.get_meta(&"walkable_ground", false):
			continue
		var label: String = str(view.name)
		if kind == "road" and label != "RoadNetwork":
			continue
		if kind == "sidewalk" and label != "SidewalkNetwork":
			continue
		if kind == "open" and label not in ["parking", "green_buffer", "loading_yard", "small_park", "community_green", "backyard"]:
			continue
		var faces: PackedVector3Array = view.mesh.get_faces()
		for i: int in range(0, faces.size(), 3):
			var center: Vector3 = view.global_transform * ((faces[i] + faces[i + 1] + faces[i + 2]) / 3.0)
			var start: Vector3 = mission.city.navigation.nearest(center, 2.0)
			if not start.is_finite() or not _uniform(start, center.y):
				continue
			for direction: Vector3 in [Vector3.FORWARD, Vector3.BACK, Vector3.LEFT, Vector3.RIGHT]:
				var end: Vector3 = start + direction * (4.0 if kind == "sidewalk" else 8.0)
				var valid: bool = mission.city.navigation.segment_clear(start, end)
				for step: int in 33:
					valid = valid and _uniform(start.lerp(end, float(step) / 32), center.y)
				if valid and not mission.city.path(origin, start).is_empty():
					return [start, end]
	return []

func _surface_case(kind: String) -> void:
	var route := _route(kind)
	check(route.size() == 2, kind + " has a reachable unobstructed ground route")
	if route.size() != 2:
		return
	# Independent cases start at queried legal positions. Recorded runs use real
	# commands and acceleration; no teleport occurs inside their sampled phases.
	member.stop()
	member.position = route[0]
	await _seconds(.5, kind + " settle")
	await _seconds(3, kind + " Idle")
	await _screenshot(kind + "-idle")
	mission.world_interaction_vfx.play_move_feedback(route[1])
	var click: Node3D = mission.world_interaction_vfx.move_pool[(mission.world_interaction_vfx.move_cursor + 5) % 6]
	check(absf(click.global_position.y - route[1].y - .012) < .0001, kind + " click marker projects to ground")
	await _move(route[1], kind + " Run")
	await _seconds(1, kind + " Stop Idle")
	await _screenshot(kind + "-arrival")

func run() -> void:
	_arguments()
	app = SeededApp.new()
	app.fixture_seed = 4101
	app.fresh_test_run = true
	app.save_path = "user://test-runs/ground-contract-%s-%d.json" % [character_id, OS.get_process_id()]
	root.add_child(app)
	await process_frame
	app.campaign.new_run(4101, "", [character_id])
	app.random_mission_counter = 0
	app.start_mission()
	mission = app.mission
	mission.set_physics_process(false)
	mission.set_process(false)
	mission.director_enabled = false
	mission.invincible = true
	mission.debug_clear_enemies()
	member = mission.survivors[0]
	member.equip(null)
	app.hud.hide()
	member.animation_controller.target.skeleton_updated.connect(_snapshot.bind(member.animation_controller.target))
	_sole_markers()
	await process_frame
	await physics_frame
	check(absf(member.position.y - mission.city.get_walkable_ground_height(Vector2(member.position.x, member.position.z))) < .0001, "Spawn projects before first movement")
	for node: Node in mission.city.find_children("*", "MeshInstance3D", true, false):
		var view := node as MeshInstance3D
		if not view.get_meta(&"walkable_ground", false):
			continue
		var vertices: Array = []
		for vertex: Vector3 in view.mesh.get_faces():
			var world: Vector3 = view.global_transform * vertex
			vertices.append([world.x, world.y, world.z])
		surface_records.append({"name": str(view.name), "vertices": vertices})
	await _seconds(1, "Spawn Idle")
	for kind: String in ["road", "open", "sidewalk"]:
		await _surface_case(kind)
	var point: Vector3 = member.position
	for direction: Vector3 in [Vector3(3, 0, -3), Vector3(3, 0, 3)]:
		var target: Vector3 = mission.city.nearest_open(point + direction)
		await _move(target, "45 90 turn")
		point = member.position
	for offset: Vector3 in [Vector3(3, 0, 0), Vector3(0, 0, -3), Vector3(-3, 0, 0)]:
		mission.command_move(mission.city.nearest_open(point + offset))
		await _seconds(.4, "Repeated click")
	mission.command_stop()
	await _seconds(1, "Run Stop Idle")
	check(member.animation_controller.current_state == &"Idle", "Stop returns to shared Idle")
	await _search()
	await _seconds(1, "POI arrival Idle")
	await _screenshot("poi-arrival")
	for id: String in mission.search_registry.building_searchables:
		var site: Dictionary = mission.city.sites[id]
		if site.spec.search_status == "RESOLVED_REACHABLE":
			check(absf(site.spec.entry.y - mission.city.get_walkable_ground_height(Vector2(site.spec.entry.x, site.spec.entry.z))) < .0001, "Search entry ground " + id)
	check(worst_actor_error < .0001, "Actor follows surface on every recorded frame")
	check(worst_marker_error < .0001, "Selection ring follows same ground contract")
	check(samples.all(func(s: Dictionary) -> bool: return absf(s.rig_local_y) < .00001), "No VisualRoot Y compensation")
	var report := {"character": character_id, "checks": checks, "failures": failures, "fps": 30, "frames": frame_index,
		"phase_times": phases, "samples": samples, "actor_ground_error_m": worst_actor_error, "marker_error_m": worst_marker_error}
	FileAccess.open(output_directory + "/runtime.json", FileAccess.WRITE).store_string(JSON.stringify(report))
	FileAccess.open(output_directory + "/surfaces.json", FileAccess.WRITE).store_string(JSON.stringify(surface_records))
	print("EXPEDITION GROUND ", character_id, ": ", checks, " checks; ", failures, "; ", frame_index, " frames")
	app.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
