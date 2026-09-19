extends "res://tests/expedition_search.gd"
## Native production input and rendered frames; no actor teleport or fake progress.
var app: Node
var mission: Node3D
var frame_index: int = 0
var clip: String = ""
var screenshots: Array[String] = []
var samples: Array[Dictionary] = []

func render_tick(advance: bool = true) -> void:
	if advance:
		tick(mission)
	mission.camera_controller.update(1.0 / 30.0)
	await process_frame
	await RenderingServer.frame_post_draw
	if not clip.is_empty():
		root.get_texture().get_image().save_jpg(ProjectSettings.globalize_path(output_directory.path_join(clip + "/frame_%05d.jpg" % frame_index)), .9)
		if frame_index % 30 == 0:
			samples.append({"clip": clip, "frame": frame_index, "tasks": mission.search_tasks.keys(), "squad": var_to_str(mission.squad_center()), "food": mission.ledger.food, "scrap": mission.ledger.scrap})
		frame_index += 1

func shot(name: String) -> void:
	await render_tick(false)
	root.get_texture().get_image().save_png(ProjectSettings.globalize_path(output_directory.path_join(name + ".png")))
	screenshots.append(name)

func click(point: Vector2) -> void:
	var event := InputEventMouseMotion.new()
	event.position = point
	Input.parse_input_event(event)
	await process_frame
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.position = point
	press.pressed = true
	Input.parse_input_event(press)
	await process_frame
	press.pressed = false
	Input.parse_input_event(press)
	await process_frame
	mission.controls.following = false

func click_building(id: String) -> void:
	var body: Node3D = mission.city.sites[id].body
	var collisions: Array[Node] = body.find_children("*", "CollisionShape3D", true, false)
	for shape: Node in collisions:
		if shape.get_parent() is StaticBody3D:
			var center: Vector3 = shape.global_transform * shape.shape.get_debug_mesh().get_aabb().get_center()
			await click(mission.camera.unproject_position(center))
			return
	check(false, "Real building has clickable collision")

func frame_search(id: String) -> void:
	mission.camera_controller.following = false
	mission.camera_center = mission.city.sites[id].spec.entry
	mission.camera_controller.apply()
	await render_tick(false)

func start_clip(name: String) -> void:
	clip = name
	frame_index = 0
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_directory.path_join(clip)))

func run() -> void:
	output_directory = "res://test-output/expedition-integration-e02"
	app = await create_app(4101)
	mission = app.mission
	mission.search_completed.connect(func(_id: String, _worker: String, _loot: Dictionary): completion_events += 1)
	mission.search_loot_collected.connect(func(_id: String, _worker: String, _loot: Dictionary): collection_events += 1)
	var id: String = nearest_site(mission)
	discover(mission, id)
	app.hud.inspect_member(mission.survivors[1], false)
	await frame_search(id)
	await shot("01_searchable_building_detected")
	start_clip("building_frames")
	await click_building(id)
	check(mission.search_tasks.has(id), "Native click on real building starts task")
	if not mission.search_tasks.has(id):
		finish_capture()
		return
	check(mission.search_tasks[id].worker == mission.survivors[1], "Native search honors selected portrait")
	await shot("02_survivor_move_to_building")
	var active_captured: bool = false
	var ground_captured: bool = false
	for frame: int in 9000:
		await render_tick()
		var state: Dictionary = mission.search_target_state(id)
		if state.progressing and not active_captured:
			await shot("03_building_search_active")
			active_captured = true
		if state.progressing and state.progress > .25 and not ground_captured:
			var point: Vector3 = mission.city.navigation.nearest(mission.city.sites[id].spec.entry + Vector3(5, 0, 5))
			await click(mission.camera.unproject_position(point))
			check(mission.search_tasks.has(id) and mission.search_tasks[id].search_started, "Native ordinary ground click preserves search")
			await shot("04_ground_click_during_search")
			ground_captured = true
		if state.completed:
			await shot("05_building_search_complete")
			break
	for frame: int in 45:
		await render_tick()
	await shot("10_search_reward_result")
	check(active_captured and ground_captured and mission.city.sites[id].searched, "Full native building lifecycle completes")
	check(completion_events == 1 and collection_events == 1, "Native reward collected once")
	records.append({"clip": clip, "frames": frame_index, "fps": 30})
	clip = ""
	var next: String = nearest_site(mission, id)
	discover(mission, next)
	app.hud.inspect_member(mission.survivors[0], false)
	await frame_search(next)
	start_clip("cancel_frames")
	await click_building(next)
	check(mission.search_tasks.has(next), "Second native target receives search")
	var cancelled: bool = false
	var reassigned: bool = false
	for frame: int in 9000:
		await render_tick()
		var state: Dictionary = mission.search_target_state(next)
		if state.progressing and state.progress > .2 and not cancelled:
			app.hud.poi_context.refresh()
			var card: Control = app.hud.poi_context.cards[next]
			check(card.visible, "Real cancel card is visible")
			await click(card.action.get_global_rect().get_center())
			cancelled = not mission.search_tasks.has(next)
			check(cancelled and not card.visible, "Native cancel click releases task and closes card")
			await shot("06_search_cancelled")
			for wait_frame: int in 15:
				await render_tick()
			check(completion_events == 1 and collection_events == 1, "Native cancelled search has no reward")
			app.hud.inspect_member(mission.survivors[2], false)
			await click_building(next)
			reassigned = mission.search_tasks.has(next) and mission.search_tasks[next].worker == mission.survivors[2]
			check(reassigned, "Different selected survivor resumes after cancellation")
		if state.completed:
			break
	for frame: int in 30:
		await render_tick()
	check(cancelled and reassigned and mission.city.sites[next].searched, "Native cancel and reassign flow completes")
	check(completion_events == 2 and collection_events == 2, "No duplicated native rewards")
	records.append({"clip": clip, "frames": frame_index, "fps": 30})
	check(safe_motion and continuous_motion, "Native movement has no blocker penetration or teleport")
	finish_capture()

func finish_capture() -> void:
	FileAccess.open(output_directory.path_join("capture-manifest.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "clips": records, "screenshots": screenshots, "samples": samples, "vehicle_searchables": mission.search_registry.vehicle_searchables.size(), "vehicle_evidence": "N/A: decoration-only runtime instances", "human_runtime_qa": "PENDING"}, "\t"))
	print("E02 NATIVE: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
