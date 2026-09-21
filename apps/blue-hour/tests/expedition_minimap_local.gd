extends "res://tests/expedition_minimap.gd"
## Local-follow presentation contracts; production Mission and frozen Bridge fixture.

const LOCAL_OUT: String = "res://test-output/expedition-integration-e01-5-fix"

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(LOCAL_OUT))
	var probe: Control = Minimap.new()
	check(probe.get("minimap_mode") == "LOCAL_FOLLOW", "Default minimap mode is LOCAL_FOLLOW")
	probe.free()
	if not failures.is_empty():
		finish()
		return
	for seed_value: int in [4101, 4102, 4103, 4104]:
		await verify_local_seed(seed_value)
	finish()

func verify_local_seed(seed_value: int) -> void:
	var app: Node = await create_app(seed_value)
	var mission: Node3D = app.mission
	var map: Control = app.hud.minimap
	map._process(0.0)
	verify_map(mission, map, seed_value)
	verify_follow(mission, map)
	verify_equal_markers(mission, map)
	var center: Vector3 = map.follow_center
	var scale_before: float = map.map_scale
	var before: Array = map.town_markers.duplicate(true)
	for member: Node3D in mission.survivors:
		app.hud.inspect_member(member)
		map._process(0.0)
		check(map.follow_center == center, "Selecting any survivor cannot change the center")
		check(map.map_scale == scale_before, "Selection cannot change zoom")
		for i: int in before.size():
			check(map.town_markers[i].point == before[i].point and map.town_markers[i].texture == before[i].texture and map.town_markers[i].diameter == before[i].diameter, "Selection only changes highlight, never marker position, texture or size")
		verify_equal_markers(mission, map)
	mission.camera_center += Vector3(50, 0, 30)
	mission.camera_controller.apply()
	map._process(0.0)
	check(map.follow_center == center, "Camera pan cannot change follow center")
	verify_edge_marker(map, "poi")
	var fixed_world: Vector3 = mission.runtime_data.arrival_point
	var original_projection: Vector2 = map.world_to_minimap(fixed_world)
	var cached_commands: Array = map.static_layer.commands.duplicate(true)
	var builds: int = map.static_build_count
	check(mission.command_move(mission.runtime_data.mission_poi), "Production movement accepted")
	for tick: int in 120:
		mission._physics_process(1.0 / 30.0)
		map._process(1.0 / 30.0)
	verify_follow(mission, map)
	verify_equal_markers(mission, map)
	var displacement: Vector3 = map.follow_center - center
	check(displacement.length() > 1.0, "Squad moves through actual navigation")
	check(map.world_to_minimap(fixed_world).is_equal_approx(original_projection - Vector2(displacement.x, displacement.z) * scale_before), "Ground scrolls by actual squad displacement")
	check(map.static_layer.commands == cached_commands and map.static_build_count == builds, "Movement translates cached world without rebuilding")
	check(map.map_scale == scale_before, "Movement cannot zoom out to fit Town")
	verify_roster_changes(mission, map)
	verify_discovery(mission, map)
	var start_usec: int = Time.get_ticks_usec()
	for tick: int in 200:
		map._process(1.0 / 60.0)
	var mean_usec: float = (Time.get_ticks_usec() - start_usec) / 200.0
	records.append({"seed": seed_value, "mode": map.minimap_mode, "extent": map.local_world_extent, "scale": map.map_scale, "build_count": map.static_build_count, "geometry_count": map.static_layer.commands.size(), "build_ms": map.static_build_ms, "update_mean_usec": mean_usec})
	app.queue_free()
	await process_frame

func verify_follow(mission: Node3D, map: Control) -> void:
	check(map.minimap_mode == "LOCAL_FOLLOW" and map.center_source == "squad_center", "Only squad center drives local follow")
	check(map.follow_center.is_equal_approx(mission.squad_center()), "Center is the average of living expedition roster")
	check(map.world_to_minimap(map.follow_center).is_equal_approx(map.minimap_content_rect.get_center()), "Squad is centered in local window")
	check(is_equal_approx(map.minimap_content_rect.size.x / map.map_scale, 70.0) and is_equal_approx(map.minimap_content_rect.size.y / map.map_scale, 70.0), "Visible world stays 70 by 70 meters")
	check(map.world_clip.clip_contents, "World draw is clipped to local map")
	var sample: Vector3 = mission.runtime_data.mission_poi
	var transformed: Vector2 = map.world_clip.position + map.static_layer.position + Vector2(sample.x, sample.z) * map.static_layer.scale
	check(transformed.is_equal_approx(map.world_to_minimap(sample)), "Cached geometry transform and marker projection agree")

func verify_equal_markers(mission: Node3D, map: Control) -> void:
	var markers: Array = map.town_markers.filter(func(item: Dictionary) -> bool: return item.kind == "survivor")
	check(markers.size() == mission.living().size(), "Every alive expedition survivor has an icon")
	for marker: Dictionary in markers:
		check(marker.diameter == 18.0 and marker.texture == null, "Every survivor uses the same lightweight marker")
		check(not marker.has("selected"), "Survivor markers have no selection state")
		check(marker.has("moving") and marker.has("searching"), "Survivor markers expose behavior state")
		check(map.marker_rect.encloses(Rect2(marker.point - Vector2.ONE * 12, Vector2.ONE * 24)), "Survivor marker stays inside local map")
		for other: Dictionary in markers:
			if marker.id != other.id:
				check(marker.point.distance_to(other.point) >= 24.0, "Equal icons do not hide one another")

func marker_for(map: Control, id: Variant) -> Dictionary:
	for marker: Dictionary in map.town_markers:
		if str(marker.id) == str(id):
			return marker
	return {}

func verify_edge_marker(map: Control, id: String) -> void:
	var marker: Dictionary = marker_for(map, id)
	check(marker.edge, id + " is outside the local window")
	var inset: Rect2 = map.marker_rect.grow(-marker.diameter * .5 - 3.0)
	var point: Vector2 = marker.clamped_anchor
	var distance: float = minf(minf(absf(point.x - inset.position.x), absf(point.x - inset.end.x)), minf(absf(point.y - inset.position.y), absf(point.y - inset.end.y)))
	check(distance < .01, id + " is clamped onto the inset edge")
	var direction: Vector2 = (marker.anchor - map.minimap_content_rect.get_center()).normalized()
	check((point - map.minimap_content_rect.get_center()).normalized().is_equal_approx(direction), id + " preserves true bearing")

func verify_roster_changes(mission: Node3D, map: Control) -> void:
	var member: Node3D = mission.survivors[2]
	var position_before: Vector3 = member.position
	# Isolated edge/death/roster fixtures; native movement evidence never teleports actors.
	member.position += Vector3(180, 0, 60)
	map._process(0.0)
	verify_follow(mission, map)
	verify_equal_markers(mission, map)
	check(marker_for(map, member.get_instance_id()).edge, "Separated survivor stays visible at edge without zoom")
	member.dead = true
	map._process(0.0)
	verify_follow(mission, map)
	check(marker_for(map, member.get_instance_id()).is_empty(), "Dead survivor leaves map and center")
	member.dead = false
	mission.survivors.erase(member)
	map._process(0.0)
	verify_follow(mission, map)
	check(marker_for(map, member.get_instance_id()).is_empty(), "Departed survivor leaves map and center")
	mission.survivors.append(member)
	member.position = position_before
	map._process(0.0)

func verify_discovery(mission: Node3D, map: Control) -> void:
	var sites: Dictionary = mission.city.sites
	var previous_selection: String = mission.poi_selected_id
	# Town has no E02 sites. These minimal existing-shape fixtures test the reveal boundary.
	var entry: Vector3 = map.follow_center + Vector3(15, 0, 10)
	for id: String in ["qa_known", "qa_hidden", "qa_target", "qa_search"]:
		sites[id] = {"discovered": id != "qa_hidden", "spec": {"entry": entry}, "vehicle": false}
	mission.poi_selected_id = "qa_target"
	mission.search_tasks["qa_search"] = null
	map._process(0.0)
	check(marker_for(map, "site:qa_hidden").is_empty(), "Undiscovered location contents remain hidden")
	check(marker_for(map, "site:qa_known").texture == map.marker_poi, "Known location keeps icon")
	check(marker_for(map, "site:qa_target").texture == map.marker_target, "Existing selected location keeps target icon")
	check(marker_for(map, "site:qa_search").texture == map.marker_search, "Existing search target keeps icon")
	for id: String in ["qa_known", "qa_hidden", "qa_target", "qa_search"]:
		sites.erase(id)
	mission.search_tasks.erase("qa_search")
	mission.poi_selected_id = previous_selection
	map._process(0.0)

func finish() -> void:
	FileAccess.open(LOCAL_OUT.path_join("local-report.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "seeds": records, "human_runtime_qa": "PENDING"}, "\t"))
	print("E01.5 LOCAL FOLLOW: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
