extends "res://tests/survivor_command.gd"
## Phase-independent geometry contract; the original command assertions still run.
var phase_results: Array[Dictionary] = []

func verify_follow_phases(guard: Node3D) -> void:
	var vfx: Node3D = mission.world_interaction_vfx
	vfx.set_process(false)
	var origin: Vector3 = guard.position
	var destination: Vector3 = mission.city.nearest_open(origin + Vector3(12, 0, 0))
	for fps: int in [30, 60]:
		for phase: float in [0.0, .01, .025, .04, .049999]:
			guard.position = origin
			mission.command_move(destination)
			vfx._command_line_update_elapsed = phase
			var line: Dictionary = vfx.command_lines[guard.get_instance_id()]
			var view: MeshInstance3D = line.view
			var mesh_id: int = view.mesh.get_instance_id()
			var redraws: int = vfx.command_visual_update_count
			var recipients: int = vfx.command_lines.size()
			var alpha: float = view.material_override.albedo_color.a
			var maximum_gap: float = 0.0
			for frame: int in range(fps / 2):
				mission._physics_process(1.0 / fps)
				vfx._process(1.0 / fps)
				var vertices: PackedVector3Array = view.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
				var head: Vector3 = vfx.to_global((vertices[0] + vertices[1]) * .5)
				var gap: float = head.distance_to(guard.global_position + Vector3.UP * .045)
				maximum_gap = maxf(maximum_gap, gap)
				check(gap < .001, "Every frame follows feet at %d Hz / phase %.6f" % [fps, phase])
				check(view.mesh.get_instance_id() == mesh_id, "Following reuses its mesh resource")
			check(vfx.command_visual_update_count - redraws <= recipients * 11, "Long geometry retains its 20 Hz budget")
			check(view.material_override.albedo_color.a < alpha, "Line fades while following")
			check(guard.position.distance_to(origin) > 1.0, "Phase case includes real Survivor movement")
			phase_results.append({"fps": fps, "phase": phase, "maximum_gap": maximum_gap, "body_redraws": vfx.command_visual_update_count - redraws, "recipients": recipients})
			vfx._process(.31)
			check(not vfx.command_lines.has(guard.get_instance_id()), "Expiry releases dictionary ownership")
			await process_frame
			check(not is_instance_valid(view), "Expiry frees the line and its child geometry")
	# A render-only offset must follow the visible model, without changing gameplay.
	guard.position = origin
	mission.command_move(destination)
	var line: Dictionary = vfx.command_lines[guard.get_instance_id()]
	guard.rig.position.x = -.03
	vfx._process(.001)
	var vertices: PackedVector3Array = line.view.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
	var head: Vector3 = vfx.to_global((vertices[0] + vertices[1]) * .5)
	check(head.distance_to(guard.rig.global_position + Vector3.UP * .045) < .001, "Line follows rendered VisualRoot interpolation")
	guard.rig.position.x = 0
	var retained: MeshInstance3D = line.view
	mission.command_move(destination + Vector3(.2, 0, 0))
	check(vfx.command_lines[guard.get_instance_id()].view == retained, "Repeated orders reuse the existing line node")
	check(vfx.command_lines[guard.get_instance_id()].elapsed == 0.0, "Repeated orders restart feedback lifetime")
	vfx.position = Vector3(3, .2, -4)
	vfx.rotation.y = .45
	vfx._process(.001)
	vertices = line.view.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
	head = vfx.to_global((vertices[0] + vertices[1]) * .5)
	check(head.distance_to(guard.global_position + Vector3.UP * .045) < .001, "Head remains correct in transformed VFX local space")
	vfx.transform = Transform3D.IDENTITY
	vfx.play_command_line(guard, guard.position)
	vfx._process(.001)
	check(not line.view.visible, "Arrival hides degenerate geometry")
	vfx.play_command_line(guard, destination)
	vfx._process(.001)
	check(line.view.visible and line.view.mesh.get_surface_count() == 1, "A new order restores geometry after arrival")
	guard.boarding = true
	vfx._process(.001)
	check(not vfx.command_lines.has(guard.get_instance_id()), "Boarding releases its line")
	guard.boarding = false
	vfx.play_command_line(guard, destination)
	guard.inside_building = true
	vfx._process(.001)
	check(not vfx.command_lines.has(guard.get_instance_id()), "Building entry releases its line")
	guard.inside_building = false
	var temporary: Node3D = guard.get_script().new()
	root.add_child(temporary)
	vfx.play_command_line(temporary, destination)
	var temporary_id: int = temporary.get_instance_id()
	temporary.free()
	vfx._process(.001)
	check(not vfx.command_lines.has(temporary_id), "Freed recipients release their weak-reference line")
	vfx._process(.81)
	await process_frame
	vfx.set_process(true)

func finish_command_test(layer: CanvasLayer) -> void:
	var original: Node3D = mission
	original.set_process(false)
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
	var guard: Node3D = mission.survivors[1]
	guard.position = mission.city.nearest_open(mission.city.sites.arrival_house.spec.entry + Vector3(4, 0, 4))
	await verify_follow_phases(guard)
	mission.free()
	mission = original
	FileAccess.open(OUTPUT + "follow-phases.json", FileAccess.WRITE).store_string(JSON.stringify(phase_results, "\t"))
	await super.finish_command_test(layer)
