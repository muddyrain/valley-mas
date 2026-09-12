extends SceneTree
## Native, real-time formal Mission benchmark. No fixed FPS or manual world ticks.
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const HUD = preload("res://ui/mission_hud.gd")
var mission: Node3D
var measuring: bool = false
var phase: String = ""
var frame_times: Array[float] = []
var samples: Array = []
var render_samples: Array = []
var last_frame: int = 0
var report: Array = []
var label: String = "after"

class Sampler extends Node:
	var owner_test: SceneTree
	func _physics_process(delta: float) -> void:
		owner_test.sample_motion(delta)
	func _process(_delta: float) -> void:
		owner_test.sample_render()

func sample_render() -> void:
	if not measuring:
		return
	var member: Node3D = mission.survivors[0]
	var p: Vector3 = member.rig.global_position
	render_samples.append({"phase": phase, "x": p.x, "z": p.z, "yaw": member.rig.rotation.y,
		"physics_frame": Engine.get_physics_frames(), "fraction": Engine.get_physics_interpolation_fraction()})

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--label="):
			label = arg.trim_prefix("--label=")
	call_deferred("run")

func _process(_delta: float) -> bool:
	var now := Time.get_ticks_usec()
	if measuring and last_frame > 0:
		frame_times.append((now - last_frame) / 1000.0)
	last_frame = now
	return false

func sample_motion(delta: float) -> void:
	if not measuring:
		return
	var members: Array = []
	for member in mission.survivors:
		var p: Vector3 = member.position
		members.append({"id": member.data.id, "x": p.x, "y": p.y, "z": p.z,
			"yaw": member.rig.rotation.y, "state": member.animation_controller.current_state,
			"rate": member.animation_controller.playback_rate, "path": member.path.size()})
	samples.append({"phase": phase, "dt": delta, "members": members,
		"physics_ms": Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000,
		"engine_fps": Engine.get_frames_per_second()})

func measure(name: String, seconds: float) -> void:
	phase = name
	measuring = true
	await create_timer(seconds).timeout
	measuring = false

func capture(name: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://test-output/locomotion-polish/" + label + "-" + name + ".png")
	# PNG encoding is evidence capture, not a gameplay frame-time spike.
	last_frame = 0

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output/locomotion-polish")
	for ids: Array in [["xia_zhiyao"], ["su_wanxing"], ["xia_zhiyao", "su_wanxing"]]:
		var catalog := Catalog.new()
		catalog.survivors = []
		var weapons: Array[String] = []
		for id: String in ids:
			catalog.survivors.append(load("res://data/survivors/" + id + ".tres"))
			weapons.append(catalog.by_id(catalog.weapons, "pistol").id)
		mission = Mission.new()
		root.add_child(mission)
		mission.setup(catalog, Ledger.new(), weapons, 7312)
		mission.input_enabled = false
		mission.director_enabled = false
		mission.invincible = true
		mission.debug_clear_enemies()
		var hud := HUD.new()
		root.add_child(hud)
		hud.setup(mission)
		var sampler := Sampler.new()
		sampler.owner_test = self
		sampler.process_physics_priority = 100
		sampler.process_priority = 1000
		root.add_child(sampler)
		for i in mission.survivors.size():
			mission.survivors[i].position = mission.city.nearest_open(Vector3(0, 0, 20) + mission.formation(i))
		mission.center_squad()
		await create_timer(2).timeout
		frame_times = []
		samples = []
		render_samples = []
		mission.command_move(Vector3(0, 0, -22))
		await measure("long_straight", 3)
		phase = "held_repath"
		measuring = true
		for repeat in 38:
			mission.command_move(Vector3(0, 0, -22))
			await create_timer(.08).timeout
		measuring = false
		await capture("%d-straight" % ids.size() + ids[0])
		mission.command_move(mission.squad_center() + Vector3(14, 0, -2))
		await measure("small_then_right_turn", 1.5)
		mission.command_move(mission.squad_center() + Vector3(0, 0, 16))
		await measure("right_angle", 1.5)
		for sign_value: float in [1, -1, 1, -1]:
			mission.command_move(mission.squad_center() + Vector3(0, 0, sign_value * 12))
			await measure("reversals", .4)
		mission.command_stop()
		await measure("command_stop", .6)
		mission.command_move(mission.squad_center() + Vector3(0, 0, -1))
		await measure("short_arrival", 2)
		mission.effects.set_source("locomotion_benchmark", {"move_speed": .30})
		mission.command_move(Vector3(0, 0, -30))
		await measure("walk", 2)
		await capture("%d-walk" % ids.size() + ids[0])
		mission.effects.remove_source("locomotion_benchmark")
		var sorted := frame_times.duplicate()
		sorted.sort()
		var total_ms: float = frame_times.reduce(func(a: float, b: float) -> float: return a + b, 0.0)
		var spikes: int = frame_times.filter(func(v: float) -> bool: return v > 33.334).size()
		report.append({"characters": ids, "camera_size": mission.camera.size, "frames": frame_times.size(),
			"fps": frame_times.size() * 1000.0 / total_ms, "mean_ms": total_ms / frame_times.size(),
			"p95_ms": sorted[int(sorted.size() * .95)], "p99_ms": sorted[int(sorted.size() * .99)],
			"max_ms": sorted[-1], "spikes_over_33ms": spikes, "physics_fps": samples.size() * 1000.0 / total_ms,
			"configured_physics_fps": Engine.physics_ticks_per_second, "samples": samples, "render_samples": render_samples})
		print("NATIVE LOCOMOTION ", label, " ", ids, " fps=", report[-1].fps, " p95_ms=", report[-1].p95_ms)
		sampler.free()
		hud.free()
		mission.free()
		await process_frame
	FileAccess.open("res://test-output/locomotion-polish/" + label + ".json", FileAccess.WRITE).store_string(JSON.stringify({
		"renderer": RenderingServer.get_video_adapter_name(), "resolution": str(root.size),
		"real_time_native_mission": true, "combat_excluded": true, "runs": report}, "\t"))
	quit()
