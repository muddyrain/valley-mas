extends "res://tests/expedition_hud_2.gd"
## Real world input, SearchTask and HUD; isolated campaign, no player save.
const OUTPUT: String = "res://test-output/survivor-command/"

func run() -> void:
	create_timer(90).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.size = Vector2i(1920, 1080)
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var catalog := Catalog.new()
	var campaign := Campaign.new(catalog)
	campaign.new_run(20260912, "combat", ["xia_zhiyao", "su_wanxing"])
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = []
	mission.setup(catalog, Ledger.new(), loadout, 20260912, campaign)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var layer := CanvasLayer.new()
	root.add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	var id: String = "arrival_house"
	var site: Dictionary = mission.city.sites[id]
	var worker: Node3D = mission.survivors[0]
	var guard: Node3D = mission.survivors[1]
	worker.position = site.spec.entry
	guard.position = mission.city.nearest_open(site.spec.entry + Vector3(4, 0, 4))
	mission.camera_controller.following = false
	mission.camera_center = site.spec.entry
	mission.camera_controller.apply()
	mission.command_search(id)
	var task: RefCounted = mission.search_tasks[id]
	task.prepare(0, mission)
	task.prepare(.4, mission)
	task.advance(1, mission)
	hud.refresh()
	await frames(5)
	hud.inspect_member(guard, false)
	check(task.worker == worker and worker.searching, "A is genuinely searching indoors")
	var target: Vector2 = ground_target()
	check(target != Vector2.ZERO, "Fixture finds exposed ground inside the playable viewport")
	await hover(target)
	await click_at(target)
	check(mission.search_tasks.get(id) == task and worker.searching, "Ground click must preserve A's active SearchTask")
	check(not guard.path.is_empty(), "The same ground click moves idle B")
	var progress_before: float = site.progress
	await step(.2)
	check(site.progress > progress_before, "A keeps making search progress after the ground click")
	check(hud.poi_context.cards.has(id) and hud.poi_context.cards[id].visible, "Searching card stays visible while B moves")
	if failures.is_empty():
		await verify_feedback(worker, guard)
		await verify_commands(worker, guard, id, target)
	await finish_command_test(layer)

func verify_feedback(worker: Node3D, guard: Node3D) -> void:
	var vfx: Node3D = mission.world_interaction_vfx
	check(vfx.command_lines.has(guard.get_instance_id()) and not vfx.command_lines.has(worker.get_instance_id()), "Only the accepted moving survivor gets a command line")
	check(vfx.move_pool.any(func(marker: MeshInstance3D) -> bool: return marker.visible), "Existing ground click VFX still plays")
	check(vfx.selection_ring.visible and vfx.selected_member == guard, "Existing selected survivor ring remains visible")
	if not vfx.command_lines.has(guard.get_instance_id()):
		return
	var view: MeshInstance3D = vfx.command_lines[guard.get_instance_id()].view
	check(view.mesh.get_surface_count() == 1, "Command line has native mesh geometry")
	var initial_alpha: float = view.material_override.albedo_color.a
	var start_position: Vector3 = guard.position
	vfx.set_process(false)
	for frame: int in range(36):
		mission._physics_process(1.0 / 30.0)
		vfx._process(1.0 / 30.0)
		hud.refresh()
		if frame == 2 and is_instance_valid(view):
			var vertices: PackedVector3Array = view.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
			var line_start: Vector3 = vfx.to_global((vertices[0] + vertices[1]) * .5)
			check(line_start.distance_to(guard.global_position + Vector3.UP * .045) < .001, "Line follows the moving survivor's feet")
		if frame == 12 and is_instance_valid(view):
			check(view.material_override.albedo_color.a < initial_alpha, "Command line fades instead of persisting as a path")
		if DisplayServer.get_name() != "headless":
			await RenderingServer.frame_post_draw
			var pixels: Image = root.get_texture().get_image()
			pixels.save_png(OUTPUT + "motion-%03d.png" % frame)
			if frame in [0, 12, 30]:
				pixels.save_png(OUTPUT + "feedback-%02d.png" % frame)
		else:
			await process_frame
	check(guard.position.distance_to(start_position) > .1, "B physically moves while A searches")
	check(vfx.command_lines.is_empty(), "Command lines release their nodes after 0.8 seconds")
	vfx.set_process(true)

func verify_commands(worker: Node3D, guard: Node3D, id: String, target: Vector2) -> void:
	var task: RefCounted = mission.search_tasks[id]
	var site: Dictionary = mission.city.sites[id]
	var vfx: Node3D = mission.world_interaction_vfx
	var destination: Vector3 = mission.rally_point
	for index: int in range(24):
		mission.command_move(destination + Vector3(index % 2, 0, 0))
	check(mission.search_tasks.get(id) == task and worker.searching, "Repeated move orders never replace a searching worker")
	check(vfx.command_lines.size() == 1, "Rapid commands reuse the recipient's line without accumulating nodes")
	var press := InputEventMouseButton.new()
	press.device = 42
	press.position = target
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	root.push_input(press, true)
	await frames(2)
	mission.controls.pointer = target + Vector2(60, 0)
	mission.controls.update(.1)
	press.pressed = false
	root.push_input(press, true)
	await frames(2)
	check(not mission.controls.following and mission.search_tasks.get(id) == task, "Held steering and release preserve the active search")
	var before: float = site.progress
	var card: Control = hud.poi_context.cards[id]
	await click(card.action)
	check(not mission.search_tasks.has(id) and not worker.searching and not card.visible, "Explicit cancel removes the assignment and progress UI immediately")
	check(task.worker == null and not worker.damaged.is_connected(task._on_damage), "Explicit cancel releases worker ownership and damage subscription")
	await command_capture("cancelled")
	await step(.4)
	check(not worker.inside_building and worker.visible and site.progress == before, "Canceled worker exits and saved progress stops advancing")
	check(mission.move_command_members().has(worker), "Canceled worker accepts new movement")
	mission.command_move(destination)
	check(not worker.path.is_empty() and vfx.command_lines.size() == 2, "Both available survivors get paths and command lines")
	guard.position = mission.city.sites.van_south.spec.entry + Vector3(4, 0, 0)
	worker.position = site.spec.entry + Vector3(0, 0, 4)
	mission.command_search(id)
	var approach: RefCounted = mission.search_tasks[id]
	check(approach.allows_move_override(), "SEARCH_APPROACH permits ordinary move override")
	mission.command_move(destination)
	check(not mission.search_tasks.has(id) and approach.worker == null, "Move cancels only a search that has not started")
	worker.position = site.spec.entry
	mission.command_search(id)
	task = mission.search_tasks[id]
	task.prepare(0, mission)
	check(task.phase == task.Phase.ENTERING, "Entering fixture owns the doorway")
	mission.command_move(destination)
	check(mission.search_tasks.get(id) == task, "Entering animation cannot be interrupted by ordinary move")
	task.prepare(.4, mission)
	guard.position = mission.city.sites.van_south.spec.entry
	mission.command_search("van_south")
	var outside: RefCounted = mission.search_tasks.van_south
	outside.prepare(0, mission)
	await frames(2)
	check(guard.searching and worker.searching, "Indoor and outdoor searches run concurrently")
	var cursor: int = vfx.move_cursor
	var rally: Vector3 = mission.rally_point
	check(not mission.command_move(destination + Vector3(2, 0, 0)), "All-searching squad rejects ordinary movement")
	check(vfx.move_cursor == cursor and vfx.command_lines.is_empty() and mission.rally_point == rally, "Rejected move has no click or line VFX and does not alter rally")
	guard.take_damage(1)
	check(outside.phase == outside.Phase.DEFEND, "Outdoor search enters its existing defense state")
	check(not mission.command_move(destination) and mission.search_tasks.get("van_south") == outside, "Paused search in defense remains protected from ordinary movement")
	outside.prepare(10, mission)
	check(guard.searching, "Defense resumes the same search when safe")
	var outside_before: float = mission.city.sites.van_south.progress
	site.progress = .999
	await step(.2)
	check(site.searched and not mission.search_tasks.has(id) and not hud.poi_context.cards[id].visible, "Completion releases building ownership and hides cancel UI")
	await command_capture("completed")
	check(mission.city.sites.van_south.progress > outside_before, "Completing one building preserves another worker's task")
	await step(.4)
	check(mission.move_command_members().has(worker), "Completed worker becomes movable after exit")
	mission.command_recall("van_south")
	await frames(2)
	check(mission.search_tasks.is_empty() and not guard.searching, "Explicit outdoor cancel cleans the last assignment")
	mission.command_move(destination)
	guard.take_damage(10000)
	await frames(2)
	check(not vfx.command_lines.has(guard.get_instance_id()), "Recipient death clears its transient line safely")
	check(not mission.move_command_members().has(guard), "Dead survivors cannot receive ordinary move")
	worker.boarding = true
	check(mission.move_command_members().is_empty(), "Boarding survivors cannot receive ordinary move")
	worker.boarding = false
	# Explicit recall/extract keep their existing scope and may move exiting workers.
	worker.position = mission.city.sites.corner.spec.entry
	mission.command_search("corner")
	var recalled: RefCounted = mission.search_tasks.corner
	recalled.prepare(0, mission)
	recalled.prepare(.4, mission)
	mission.command_recall_all()
	check(mission.search_tasks.is_empty() and not worker.path.is_empty(), "Explicit rally still releases search and routes an exiting worker")
	await step(.4)
	worker.position = mission.city.sites.corner.spec.entry
	mission.command_search("corner")
	var extracting: RefCounted = mission.search_tasks.corner
	extracting.prepare(0, mission)
	extracting.prepare(.4, mission)
	mission.command_extract()
	check(mission.search_tasks.is_empty() and mission.extraction and not worker.path.is_empty(), "Explicit extraction still releases search and routes everyone to the bus")

func ground_target() -> Vector2:
	for y: int in [680, 750, 600, 520]:
		for x: int in [1120, 1000, 880, 1200, 720]:
			var point := Vector2(x, y)
			var origin: Vector3 = mission.camera.project_ray_origin(point)
			var query := PhysicsRayQueryParameters3D.create(origin, origin + mission.camera.project_ray_normal(point) * 200, 3)
			query.collide_with_areas = true
			var hit: Dictionary = mission.get_world_3d().direct_space_state.intersect_ray(query)
			if not hit.is_empty() and not hit.collider.has_meta("site_id") and not hit.collider.has_meta("bus") and not hit.collider.has_meta("enemy"):
				return point
	return Vector2.ZERO

func command_capture(label: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png(OUTPUT + label + ".png") == OK, "Captured " + label)

func finish_command_test(layer: CanvasLayer) -> void:
	FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	layer.free()
	mission.free()
	await frames(2)
	print("SURVIVOR COMMAND: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
