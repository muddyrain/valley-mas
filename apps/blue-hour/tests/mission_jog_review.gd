extends SceneTree
## Native formal Mission capture. Fixed FPS is only for video timing, not a benchmark.
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const HUD = preload("res://ui/mission_hud.gd")
const OUTPUT := "res://test-output/locomotion-v2/"
var output_path: String = OUTPUT
var polish_route: bool = false
var mission: Node3D
var actor: Node3D
var label: String = "jog-v2"
var segment: String = "idle"
var samples: Array[Dictionary] = []
var failures: Array[String] = []

func _initialize() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--label="):
			label = argument.trim_prefix("--label=")
		elif argument == "--polish":
			polish_route = true
			output_path = "res://test-output/locomotion-v2_1/"
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute(output_path)
	root.size = Vector2i(1600, 900)
	# Reproduce Before without changing disk assets or the production selector.
	if label in ["jog-v1", "jog-v2-before"]:
		var review_library := load("res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2.tres") as AnimationLibrary
		var before_path := "res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v1.tres" if label == "jog-v1" else "res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2_0.tres"
		var before_library := load(before_path) as AnimationLibrary
		review_library.remove_animation(&"mission_jog")
		review_library.add_animation(&"mission_jog", before_library.get_animation(&"mission_jog"))
	var catalog := Catalog.new()
	catalog.survivors = [load("res://data/survivors/xia_zhiyao.tres")]
	var equipment: Array[String] = [""]
	mission = Mission.new()
	root.add_child(mission)
	mission.setup(catalog, Ledger.new(), equipment, 7312)
	mission.input_enabled = false
	mission.director_enabled = false
	mission.debug_clear_enemies()
	actor = mission.survivors[0]
	actor.position = mission.city.nearest_open(Vector3(0, 0, 32 if polish_route else 20))
	mission.center_squad()
	var hud := HUD.new()
	root.add_child(hud)
	hud.setup(mission)
	await record_segment("idle", 60)
	if polish_route:
		mission.command_move(Vector3(0, 0, -32))
		await record_segment("straight", 480)
		mission.command_move(Vector3(48, 0, 0))
		await record_segment("side", 600)
	else:
		mission.command_move(Vector3(0, 0, -22))
		await record_segment("straight", 420)
		mission.command_move(mission.squad_center() + Vector3(14, 0, -2))
		await record_segment("turn", 150)
		mission.command_move(mission.squad_center() + Vector3(0, 0, 16))
		await record_segment("return", 180)
	check(actor.weapon == null, "Review actor is unarmed")
	check(is_equal_approx(actor.data.move_speed, 4.2), "Gameplay base speed remains 4.2 m/s")
	check(is_equal_approx(mission.camera.size, 25.0), "Formal camera retains default size 25")
	var running_frames: int = 0
	var side_frames: int = 0
	for sample in samples:
		if sample.segment == "straight" and sample.speed > 4.1 and sample.state == "mission_jog":
			running_frames += 1
		if sample.segment == "side" and sample.speed > 4.1 and sample.state == "mission_jog":
			side_frames += 1
	check(running_frames >= 300, "At least five seconds of continuous full-speed Jog")
	if polish_route:
		check(side_frames >= 480, "At least eight seconds of full-speed side Jog")
	var report := {"label": label, "native": DisplayServer.get_name() != "headless",
		"fps": 60, "resolution": str(root.size), "camera_size": mission.camera.size,
		"visual_scale": actor.animation_controller.visual_scale, "failures": failures, "samples": samples}
	FileAccess.open(output_path + label + ".json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("MISSION JOG REVIEW ", label, ": ", running_frames, " straight / ", side_frames, " side full-speed frames; failures=", failures)
	hud.free()
	mission.free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func record_segment(name: String, frames: int) -> void:
	segment = name
	for frame in frames:
		await process_frame
		var position: Vector3 = actor.position
		var skeleton: Skeleton3D = actor.animation_controller.target
		var hips_y := skeleton.get_bone_global_pose(skeleton.find_bone("Hips")).origin.y
		samples.append({"segment": segment, "frame": samples.size(), "position": [position.x, position.y, position.z],
			"speed": actor.current_speed, "state": String(actor.animation_controller.current_state),
			"rate": actor.animation_controller.playback_rate, "yaw": actor.rig.rotation.y, "hips_y": hips_y})
		if DisplayServer.get_name() != "headless" and name in ["straight", "side"] and frame in [100, 106, 112, 118, 124, 130]:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(output_path + label + "-" + name + "-%03d.png" % frame)

func check(value: bool, message: String) -> void:
	if not value:
		failures.append(message)
		push_error(message)
