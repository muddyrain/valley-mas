extends SceneTree
## Controlled populations through production mission ticks; native frames are separate evidence.
var report: Array[Dictionary] = []

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	root.unfocusable = true
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = 0
	var native: bool = DisplayServer.get_name() != "headless"
	var dense: bool = "dense" in OS.get_cmdline_user_args()
	var catalog: RefCounted = load("res://data/catalog.gd").new()
	var mission: Node3D = load("res://missions/mission.gd").new()
	root.add_child(mission)
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	mission.setup(catalog, load("res://core/run_ledger.gd").new(), loadout, 701)
	mission.set_physics_process(false)
	mission.director_enabled = false
	mission.arrival_noise_pending = false
	mission.invincible = true
	for count: int in [20, 40, 60]:
		mission.debug_clear_enemies()
		mission.clock.set_phase(mission.clock.DAY)
		var config: Resource = catalog.map.encounter
		config.initial_zombie_min = count
		config.initial_zombie_max = count
		mission.encounter.initial_spawned = 0
		mission.encounter.seed_population(mission)
		var occupied: Array[Vector3] = []
		var placement := RandomNumberGenerator.new()
		placement.seed = 701
		for enemy: Node3D in mission.enemies:
			if dense:
				for attempt: int in range(500):
					var candidate: Vector3 = mission.city.nearest_open(catalog.map.bus_position + Vector3(placement.randf_range(-14, 14), 0, placement.randf_range(-14, 8)))
					if candidate.distance_to(catalog.map.bus_position) < 3 or occupied.any(func(point: Vector3): return point.distance_to(candidate) < 1):
						continue
					enemy.position = candidate
					occupied.append(candidate)
					break
			enemy.data = enemy.data.duplicate()
			enemy.data.max_hp = 1000000
			enemy.refresh_stats(mission.clock)
			enemy.investigate(mission.catalog.map.bus_position)
		for frame: int in range(90):
			mission._physics_process(1.0 / 60)
			await process_frame
		var costs: Array[float] = []
		var frame_costs: Array[float] = []
		var previous: int = Time.get_ticks_usec()
		var senses_before: int = 0
		var paths_before: int = 0
		for enemy: Node3D in mission.enemies:
			senses_before += enemy.perception_queries
			paths_before += enemy.path_queries
		for frame: int in range(360):
			var begin: int = Time.get_ticks_usec()
			mission._physics_process(1.0 / 60)
			costs.append(float(Time.get_ticks_usec() - begin) / 1000)
			if native:
				await RenderingServer.frame_post_draw
			else:
				await process_frame
			var now: int = Time.get_ticks_usec()
			frame_costs.append(float(now - previous) / 1000)
			previous = now
		var senses: int = -senses_before
		var paths: int = -paths_before
		var states: Dictionary = {}
		for enemy: Node3D in mission.enemies:
			senses += enemy.perception_queries
			paths += enemy.path_queries
			var state_name: String = enemy.State.keys()[enemy.state]
			states[state_name] = int(states.get(state_name, 0)) + 1
		costs.sort()
		frame_costs.sort()
		report.append({"requested": count, "alive": mission.enemies.size(), "samples": costs.size(), "tick_mean_ms": _mean(costs), "tick_p95_ms": costs[int(costs.size() * .95)], "frame_mean_ms": _mean(frame_costs), "frame_p95_ms": frame_costs[int(frame_costs.size() * .95)], "observed_fps": 1000.0 / _mean(frame_costs) if native else 0, "perception_queries_per_sim_second": senses / 6.0, "path_queries_per_sim_second": paths / 6.0, "states": states})
		print("ENCOUNTER PERFORMANCE: ", report.back())
	var output: String = "res://test-output/encounter-performance-%s%s.json" % ["native" if native else "headless", "-dense" if dense else ""]
	FileAccess.open(output, FileAccess.WRITE).store_string(JSON.stringify({"mode": DisplayServer.get_name(), "viewport": str(root.size), "godot": Engine.get_version_info().string, "renderer": RenderingServer.get_video_adapter_name(), "method": "360 samples/population, 90 warmup; existing 3-member squad/weapons; large enemy HP and squad invulnerability maintain count; director disabled; %s; native frame timing is uncapped, not a before/after comparison" % ("controlled placement near the squad for dense combat" if dense else "mixed near/far AI"), "results": report}, "\t"))
	mission.free()
	await process_frame
	quit()

func _mean(values: Array[float]) -> float:
	var total: float = 0
	for value: float in values:
		total += value
	return total / maxi(1, values.size())
