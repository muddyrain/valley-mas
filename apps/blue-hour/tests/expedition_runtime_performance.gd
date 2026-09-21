extends SceneTree
## Native P02 harness for the formal Medium Town Expedition runtime.

const App = preload("res://core/main.gd")
const OUT: String = "res://test-output/expedition-runtime-performance-p02"
const WARMUP_SECONDS: float = 3.0
const CAPTURE_SECONDS: float = 10.0
const COMMAND_INTERVAL_SECONDS: float = 0.20

var phase: String = "before"
var seed_value: int = 4101
var scenario_filter: String = ""
var record_only: bool = false
var app: Node
var mission: Node3D
var scenarios: Array[Dictionary] = []
var results: Array[Dictionary] = []

class SeededApp extends App:
	var fixture_seed: int = 4101

	func _mission_config(action_id: String) -> Dictionary:
		var config: Dictionary = super._mission_config(action_id)
		config.map_seed = fixture_seed
		config.seed = fixture_seed
		return config

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	_parse_arguments()
	if DisplayServer.get_name() == "headless":
		printerr("P02 requires native rendering; headless measurements are invalid")
		quit(2)
		return
	root.unfocusable = true
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = 0
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	app = await _create_app()
	mission = app.mission
	mission.director_enabled = false
	mission.arrival_noise_pending = false
	mission.invincible = true
	mission.debug_clear_enemies()
	await _wait_for_background_resolution()
	_configure_scenarios()
	for scenario: Dictionary in scenarios:
		var result: Dictionary = await _capture_scenario(scenario)
		results.append(result)
		if not record_only:
			_write_profile(result)
	if not record_only:
		_write_summary()
	print("P02 PERFORMANCE %s seed=%d: %d scenarios" % [phase, seed_value, results.size()])
	app.queue_free()
	await process_frame
	quit()

func _parse_arguments() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--phase="):
			phase = argument.trim_prefix("--phase=")
		elif argument.begins_with("--seed="):
			seed_value = int(argument.trim_prefix("--seed="))
		elif argument.begins_with("--scenario="):
			scenario_filter = argument.trim_prefix("--scenario=")
		elif argument == "--record-only":
			record_only = true

func _create_app() -> Node:
	var instance: Node = SeededApp.new()
	instance.fixture_seed = seed_value
	instance.fresh_test_run = true
	instance.save_path = "user://test-runs/expedition-performance-%s-%d-%d.json" % [phase, seed_value, OS.get_process_id()]
	root.add_child(instance)
	await process_frame
	instance.campaign.new_run(seed_value, "combat", ["xia_zhiyao", "su_wanxing", "lin_jianyue"])
	instance.random_mission_counter = 0
	instance.start_mission()
	var deadline: int = Time.get_ticks_msec() + 30000
	while Time.get_ticks_msec() < deadline:
		if is_instance_valid(instance.mission) and is_instance_valid(instance.hud) and instance.mission.survivor_commands_enabled and instance.hud.minimap.world_layer_ready():
			break
		await RenderingServer.frame_post_draw
	if not is_instance_valid(instance.mission) or not instance.mission.survivor_commands_enabled:
		printerr("P02 mission did not become ready")
		quit(3)
	return instance

func _wait_for_background_resolution() -> void:
	var deadline: int = Time.get_ticks_msec() + 15000
	while mission.search_registry != null and not mission.search_registry.background_complete() and Time.get_ticks_msec() < deadline:
		await RenderingServer.frame_post_draw

func _configure_scenarios() -> void:
	var suffix: String = "2" if phase == "after" else ""
	scenarios = [
		{"id": "A%s_IDLE_3" % suffix, "mode": "idle", "disable": ""},
		{"id": "B%s_MOVE_1" % suffix, "mode": "move_one", "disable": ""},
		{"id": "C%s_MOVE_3" % suffix, "mode": "move_three", "disable": ""},
		{"id": "D%s_COMMAND_SPAM_3" % suffix, "mode": "command_spam", "disable": ""},
	]
	if phase == "before" and seed_value == 4101:
		scenarios.append_array([
			{"id": "E_NO_MINIMAP", "mode": "move_three", "disable": "PERF_DISABLE_MINIMAP_DYNAMIC"},
			{"id": "F_NO_VISION", "mode": "move_three", "disable": "PERF_DISABLE_VISION_DYNAMIC"},
			{"id": "G_NO_AVOIDANCE", "mode": "move_three", "disable": "PERF_DISABLE_NAV_AVOIDANCE"},
			{"id": "H_NO_COMMAND_VISUALS", "mode": "move_three", "disable": "PERF_DISABLE_COMMAND_VISUALS"},
			{"id": "I_NO_WORLD_LABELS", "mode": "move_three", "disable": "PERF_DISABLE_WORLD_LABELS"},
		])
	if seed_value != 4101:
		var seed_label: String = "B" if seed_value == 4102 else "C"
		scenarios = [{"id": "SEED_%s_MOVE_3" % seed_label, "mode": "move_three", "disable": ""}]
	if not scenario_filter.is_empty():
		scenarios = scenarios.filter(func(scenario: Dictionary) -> bool: return str(scenario.id) == scenario_filter)

func _capture_scenario(scenario: Dictionary) -> Dictionary:
	_reset_runtime()
	_apply_qa_switch(str(scenario.disable))
	var command_state: Dictionary = {"next": 0.0, "index": 0}
	_start_motion(str(scenario.mode), command_state)
	await _run_window(WARMUP_SECONDS, str(scenario.mode), command_state, false)
	command_state["samples"] = []
	var counters_before: Dictionary = _counters()
	var navigation_before: Dictionary = mission.city.navigation.performance()
	var sample: Dictionary = await _run_window(CAPTURE_SECONDS, str(scenario.mode), command_state, true)
	var counters_after: Dictionary = _counters()
	var navigation_after: Dictionary = mission.city.navigation.performance()
	var result: Dictionary = {
		"scenario": scenario.id,
		"phase": phase,
		"seed": seed_value,
		"warmup_seconds": WARMUP_SECONDS,
		"capture_seconds": CAPTURE_SECONDS,
		"renderer": RenderingServer.get_video_adapter_name(),
		"display_server": DisplayServer.get_name(),
		"viewport": str(root.size),
		"godot": Engine.get_version_info().string,
		"disabled_module": scenario.disable,
		"frames": sample.frame_times.size(),
		"fps_avg": 1000.0 / _mean(sample.frame_times),
		"fps_min": 1000.0 / _maximum(sample.frame_times),
		"frame_time_avg_ms": _mean(sample.frame_times),
		"frame_time_p95_ms": _percentile(sample.frame_times, .95),
		"frame_time_max_ms": _maximum(sample.frame_times),
		"frames_over_33ms": sample.frame_times.filter(func(value: float) -> bool: return value > 33.0).size(),
		"frames_over_100ms": sample.frame_times.filter(func(value: float) -> bool: return value > 100.0).size(),
		"process_time_avg_ms": _mean(sample.process_times),
		"physics_time_avg_ms": _mean(sample.physics_times),
		"navigation_time_avg_ms": _mean(sample.navigation_times),
		"rendering_time_ms": "UNAVAILABLE_GODOT_API",
		"draw_calls_avg": _mean(sample.draw_calls),
		"render_objects_avg": _mean(sample.render_objects),
		"primitive_count_avg": _mean(sample.primitives),
		"object_count_avg": _mean(sample.object_counts),
		"survivor_count": mission.survivors.size(),
		"active_navigation_agents_avg": _mean(sample.active_agents),
		"active_navigation_agents_max": _maximum(sample.active_agents),
		"path_queries": int(navigation_after.query_count) - int(navigation_before.query_count),
		"path_queries_per_sec": (int(navigation_after.query_count) - int(navigation_before.query_count)) / CAPTURE_SECONDS,
		"path_query_compute_ms": float(navigation_after.total_query_ms) - float(navigation_before.total_query_ms),
		"path_astar_ms": float(navigation_after.astar_total_ms) - float(navigation_before.astar_total_ms),
		"path_simplify_ms": float(navigation_after.simplify_total_ms) - float(navigation_before.simplify_total_ms),
		"command_path_samples": command_state.get("samples", []),
		"counters": _counter_delta(counters_before, counters_after),
	}
	result.counters["minimap_updates_per_sec"] = float(result.counters.minimap_marker_update_count) / CAPTURE_SECONDS
	result.counters["vision_updates_per_sec"] = float(result.counters.vision_dynamic_update_count) / CAPTURE_SECONDS
	result.counters["command_visual_updates_per_sec"] = float(result.counters.command_visual_update_count) / CAPTURE_SECONDS
	print("P02 ", JSON.stringify(result))
	return result

func _run_window(seconds: float, mode: String, command_state: Dictionary, collect: bool) -> Dictionary:
	var samples: Dictionary = {"frame_times": [], "process_times": [], "physics_times": [], "navigation_times": [], "draw_calls": [], "render_objects": [], "primitives": [], "object_counts": [], "active_agents": []}
	var started: int = Time.get_ticks_usec()
	var previous: int = started
	while (Time.get_ticks_usec() - started) / 1000000.0 < seconds:
		var elapsed: float = (Time.get_ticks_usec() - started) / 1000000.0
		if mode == "command_spam" and elapsed >= float(command_state.next):
			_command_spam(command_state)
			command_state.next = elapsed + COMMAND_INTERVAL_SECONDS
		await RenderingServer.frame_post_draw
		var now: int = Time.get_ticks_usec()
		if collect:
			samples.frame_times.append((now - previous) / 1000.0)
			samples.process_times.append(float(Performance.get_monitor(Performance.TIME_PROCESS)) * 1000.0)
			samples.physics_times.append(float(Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)) * 1000.0)
			samples.navigation_times.append(float(Performance.get_monitor(Performance.TIME_NAVIGATION_PROCESS)) * 1000.0)
			samples.draw_calls.append(float(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)))
			samples.render_objects.append(float(Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME)))
			samples.primitives.append(float(Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)))
			samples.object_counts.append(float(Performance.get_monitor(Performance.OBJECT_COUNT)))
			samples.active_agents.append(float(mission.survivors.filter(func(member: Node3D) -> bool: return not member.path.is_empty()).size()))
		previous = now
	return samples

func _reset_runtime() -> void:
	_apply_qa_switch("")
	mission.command_stop()
	var positions: Array[Vector3] = mission.city.spawn_positions(mission.survivors.size())
	for index: int in mission.survivors.size():
		var member: Node3D = mission.survivors[index]
		member.stop()
		member.position = positions[index]
		member.rig.position = Vector3.ZERO
	mission.rally_point = mission.runtime_data.arrival_point
	mission.camera_center = mission.squad_center()
	mission.camera_controller.apply()
	for line: Dictionary in mission.world_interaction_vfx.command_lines.values():
		if is_instance_valid(line.view):
			line.view.queue_free()
	mission.world_interaction_vfx.command_lines.clear()

func _apply_qa_switch(flag: String) -> void:
	var minimap: Control = app.hud.minimap
	var labels: Node3D = app.hud.world_markers
	minimap.set_process(flag != "PERF_DISABLE_MINIMAP_DYNAMIC")
	minimap.visible = flag != "PERF_DISABLE_MINIMAP_DYNAMIC"
	labels.set_process(flag != "PERF_DISABLE_WORLD_LABELS")
	labels.visible = flag != "PERF_DISABLE_WORLD_LABELS"
	mission.exploration.set_meta("p02_dynamic_enabled", flag != "PERF_DISABLE_VISION_DYNAMIC")
	mission.set_meta("p02_avoidance_enabled", flag != "PERF_DISABLE_NAV_AVOIDANCE")
	mission.world_interaction_vfx.set_meta("p02_dynamic_enabled", flag != "PERF_DISABLE_COMMAND_VISUALS")
	mission.world_interaction_vfx.set_process(flag != "PERF_DISABLE_COMMAND_VISUALS")
	mission.world_interaction_vfx.visible = flag != "PERF_DISABLE_COMMAND_VISUALS"
	for member: Node3D in mission.survivors:
		member.name_label.visible = flag != "PERF_DISABLE_WORLD_LABELS"
		member.hp_bar.visible = flag != "PERF_DISABLE_WORLD_LABELS"

func _start_motion(mode: String, command_state: Dictionary) -> void:
	if mode == "idle":
		return
	if mode == "command_spam":
		_command_spam(command_state)
		return
	var target: Vector3 = _farthest_target()
	if mode == "move_one":
		var one_member: Array[Node3D] = [mission.survivors[0]]
		mission._move_members(target, one_member)
	else:
		mission.command_move(target)

func _command_spam(state: Dictionary) -> void:
	var targets: Array[Vector3] = _targets()
	if targets.is_empty():
		return
	var before: Dictionary = mission.city.navigation.performance()
	var started: int = Time.get_ticks_usec()
	var accepted: bool = mission.command_move(targets[int(state.index) % targets.size()])
	var elapsed_ms: float = (Time.get_ticks_usec() - started) / 1000.0
	var after: Dictionary = mission.city.navigation.performance()
	if state.has("samples"):
		state.samples.append({
			"accepted": accepted,
			"elapsed_ms": elapsed_ms,
			"path_queries": int(after.query_count) - int(before.query_count),
			"path_query_ms": float(after.total_query_ms) - float(before.total_query_ms),
		})
	state.index = int(state.index) + 1

func _targets() -> Array[Vector3]:
	var result: Array[Vector3] = []
	var candidates: Array = mission.city.navigation_targets.values()
	candidates.append(mission.runtime_data.mission_poi)
	candidates.append(mission.runtime_data.arrival_exit)
	for point: Variant in candidates:
		if point is Vector3 and mission.city.navigation.point_clear(point):
			result.append(point)
	return result

func _farthest_target() -> Vector3:
	var center: Vector3 = mission.squad_center()
	var result: Vector3 = mission.runtime_data.mission_poi
	var distance: float = -1.0
	for point: Vector3 in _targets():
		var candidate: float = center.distance_squared_to(point)
		if candidate > distance:
			distance = candidate
			result = point
	return result

func _counters() -> Dictionary:
	var nav_target_sets: int = 0
	var nav_requests: int = 0
	var nav_changes: int = 0
	var nav_reuses: int = 0
	for member: Node3D in mission.survivors:
		nav_target_sets += member.nav_target_set_count
		nav_requests += member.nav_path_request_count
		nav_changes += member.nav_path_changed_count
		nav_reuses += member.nav_path_reuse_count
	return {
		"nav_target_set_count": nav_target_sets,
		"nav_path_request_count": nav_requests,
		"nav_path_changed_count": nav_changes,
		"nav_path_reuse_count": nav_reuses,
		"avoidance_update_count": mission.avoidance_update_count,
		"minimap_static_rebuild_count": app.hud.minimap.static_build_count,
		"minimap_marker_update_count": app.hud.minimap.marker_update_count,
		"minimap_full_refresh_count": app.hud.minimap.full_refresh_count,
		"vision_full_rebuild_count": mission.exploration.full_rebuild_count,
		"vision_dynamic_update_count": mission.exploration.dynamic_update_count,
		"command_visual_update_count": mission.world_interaction_vfx.command_visual_update_count,
		"world_label_update_count": app.hud.world_markers.update_count,
	}

func _counter_delta(before: Dictionary, after: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for key: String in after:
		result[key] = int(after[key]) - int(before.get(key, 0))
	return result

func _write_profile(result: Dictionary) -> void:
	var suffix: String = "_after" if seed_value != 4101 and phase == "after" else ""
	var filename: String = "profile_%s%s.txt" % [str(result.scenario), suffix]
	FileAccess.open(OUT.path_join(filename), FileAccess.WRITE).store_string(JSON.stringify(result, "\t"))

func _write_summary() -> void:
	var filename: String = "baseline_comparison.md" if phase == "before" and seed_value == 4101 else "%s_comparison_seed_%d.md" % [phase, seed_value]
	var lines: Array[String] = ["# Expedition Runtime Performance P02", "", "Phase: `%s`" % phase, "Seed: `%d`" % seed_value, "", "| Scenario | FPS avg | FPS min | Frame avg ms | p95 ms | max ms | Path q/s |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
	for result: Dictionary in results:
		lines.append("| %s | %.2f | %.2f | %.3f | %.3f | %.3f | %.2f |" % [result.scenario, result.fps_avg, result.fps_min, result.frame_time_avg_ms, result.frame_time_p95_ms, result.frame_time_max_ms, result.path_queries_per_sec])
	FileAccess.open(OUT.path_join(filename), FileAccess.WRITE).store_string("\n".join(lines) + "\n")

func _mean(values: Array) -> float:
	if values.is_empty():
		return 0.0
	var total: float = 0.0
	for value: Variant in values:
		total += float(value)
	return total / values.size()

func _maximum(values: Array) -> float:
	var result: float = 0.0
	for value: Variant in values:
		result = maxf(result, float(value))
	return result

func _percentile(values: Array, ratio: float) -> float:
	if values.is_empty():
		return 0.0
	var sorted: Array = values.duplicate()
	sorted.sort()
	return float(sorted[mini(sorted.size() - 1, floori((sorted.size() - 1) * ratio))])
