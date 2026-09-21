extends "res://tests/expedition_search_capture.gd"
## Native click proves an unresolved target is prioritized without blocking the reveal.

func run() -> void:
	output_directory = "res://test-output/expedition-load-performance-p01"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_directory.path_join("search_unresolved_priority_frames")))
	app = await create_app(4101)
	mission = app.mission
	mission.search_completed.connect(func(_id: String, _worker: String, _loot: Dictionary): completion_events += 1)
	mission.search_loot_collected.connect(func(_id: String, _worker: String, _loot: Dictionary): collection_events += 1)
	var id: String = nearest_site(mission)
	discover(mission, id)
	app.hud.inspect_member(mission.survivors[1], false)
	mission.city.sites[id].spec.search_status = Registry.UNRESOLVED
	mission.search_registry.start_background_resolution()
	await frame_search(id)
	start_clip("search_unresolved_priority_frames")
	for frame: int in 20:
		await render_tick(false)
	await click_building(id)
	check(mission.city.sites[id].spec.search_status == Registry.RESOLVED_REACHABLE, "Native click resolves the selected target first")
	check(mission.search_tasks.has(id), "Resolved reachable target starts the existing SearchTask")
	var active_captured: bool = false
	for frame: int in 240:
		# Compress only the post-click walk so the evidence clip stays reviewable.
		for simulation_step: int in 8:
			tick(mission)
		await render_tick(false)
		if mission.search_target_state(id).progressing:
			active_captured = true
			if frame > 75:
				break
	check(active_captured, "Priority-resolved survivor reaches the entrance and starts searching")
	records.append({"target": id, "status": mission.city.sites[id].spec.search_status, "priority_resolve_count": mission.search_registry.metrics.get("priority_resolve_count", 0), "frames": frame_index, "fps": 30})
	FileAccess.open(output_directory.path_join("search_unresolved_priority_manifest.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "records": records, "human_runtime_qa": "PENDING"}, "\t"))
	print("SEARCH UNRESOLVED PRIORITY: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
