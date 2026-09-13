extends SceneTree
## Same formal Mission route for preserved B and the V2.2/C candidate.
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const HUD = preload("res://ui/mission_hud.gd")
const OUTPUT := "res://test-output/locomotion-v2_2/"
var mission: Node3D
var actor: Node3D
var profile: StringName = &"natural"
var label: String = "c"
var samples: Array[Dictionary] = []
var failures: Array[String] = []
var screenshot_counts: Dictionary[String, int] = {}
var checks: int = 0

func _initialize() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument == "--cadence=b":
			profile = &"polish"
			label = "b"
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	root.size = Vector2i(1600, 900)
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
	actor.position = mission.city.nearest_open(Vector3(0, 0, 24))
	actor.animation_controller.set_jog_cadence(profile)
	mission.center_squad()
	var hud := HUD.new()
	root.add_child(hud)
	hud.setup(mission)
	await record("idle", 60)
	mission.command_move(Vector3(0, 0, -40))
	for frame in 600:
		await record("straight", 1)
		if actor.position.z <= 0:
			break
	check(actor.position.z <= 0, "Continuous straight run reaches the real intersection")
	mission.command_move(Vector3(48, 0, 0))
	await record("turn-90", 300)
	mission.command_move(actor.position + Vector3(4, 0, 4))
	await record("s-left", 36)
	mission.command_move(actor.position + Vector3(4, 0, -4))
	await record("s-right", 36)
	mission.command_move(Vector3(48, 0, actor.position.z))
	await record("side-link", 60)
	mission.command_move(Vector3(-40, 0, 0))
	await record("turn-180", 90)
	# Brake on open asphalt rather than over the bright crosswalk under the feet.
	await record("straight-final", 150)
	mission.command_stop()
	await record("stop", 42)
	await record("idle-final", 90)
	var layer: SkeletonModifier3D = actor.animation_controller.locomotion_layer
	check(layer.start_count == 1, "The full moving route has exactly one start")
	check(layer.stop_count == 1, "Only the explicit final stop triggers a brake")
	check(layer.state == &"Idle" and actor.current_speed == 0, "Final Idle has zero gameplay speed")
	check(actor.weapon == null and actor.data.id == "xia_zhiyao", "Unarmed Xia Zhiyao")
	check(is_equal_approx(actor.data.move_speed, 4.2), "Original gameplay speed")
	check(is_equal_approx(mission.camera.size, 25), "Formal camera size")
	var previous: Dictionary = {}
	var max_turn: Dictionary = {}
	for sample in samples:
		check(absf(sample.lean) <= 8, "Lean stays under eight degrees")
		if not previous.is_empty() and sample.state == "Jog" and previous.state == "Jog":
			check(fposmod(sample.phase - previous.phase, 1.0) < .08, "No turn resets the phase")
		if not previous.is_empty() and sample.speed > 4.1 and previous.speed > 4.1:
			var old := Vector3(previous.velocity[0], 0, previous.velocity[2])
			var direction := Vector3(sample.velocity[0], 0, sample.velocity[2])
			max_turn[sample.segment] = maxf(float(max_turn.get(sample.segment, 0)), rad_to_deg(old.angle_to(direction)))
		previous = sample
	check(float(max_turn.get("turn-90", 0)) > 70, "Recorded navigation contains the 90 degree corner")
	check(float(max_turn.get("s-left", 0)) > 30 and float(max_turn.get("s-right", 0)) > 30, "Recorded navigation contains both S turns")
	check(float(max_turn.get("turn-180", 0)) > 150, "Recorded navigation contains the reversal")
	var report := {"profile": String(profile), "native": DisplayServer.get_name() != "headless", "fps": 60,
		"camera_size": mission.camera.size, "scale": actor.animation_controller.visual_scale,
		"checks": checks, "failures": failures, "max_direction_changes": max_turn, "samples": samples}
	FileAccess.open(OUTPUT + "jog-cadence-" + label + ".json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("V2.2 COMPARISON FILM ", label, ": ", samples.size(), " frames; checks=", checks, "; turns=", max_turn, "; failures=", failures)
	hud.free()
	mission.free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func record(segment: String, frames: int) -> void:
	for frame in frames:
		if DisplayServer.get_name() == "headless":
			mission.set_physics_process(false)
			mission._physics_process(1.0 / 60.0)
		await process_frame
		var controller: Node3D = actor.animation_controller
		var layer: SkeletonModifier3D = controller.locomotion_layer
		var position: Vector3 = actor.position
		var velocity: Vector3 = actor.actual_velocity
		var skeleton: Skeleton3D = controller.target
		var feet: Array[Array] = []
		var joints: Dictionary = {}
		for joint_name: String in ["LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "RightUpperLeg", "RightLowerLeg", "RightFoot"]:
			var joint: Vector3 = skeleton.global_transform * skeleton.get_bone_global_pose(skeleton.find_bone(joint_name)).origin
			var screen: Vector2 = mission.camera.unproject_position(joint)
			joints[joint_name] = {"world": [joint.x, joint.y, joint.z], "screen": [screen.x, screen.y]}
		for name: String in ["LeftFoot", "RightFoot"]:
			var foot: Vector3 = skeleton.global_transform * skeleton.get_bone_global_pose(skeleton.find_bone(name)).origin
			feet.append([foot.x, foot.y, foot.z])
		samples.append({"frame": samples.size(), "segment": segment, "position": [position.x, position.y, position.z],
			"velocity": [velocity.x, velocity.y, velocity.z], "speed": actor.current_speed,
			"state": String(layer.state), "phase": layer.locomotion_phase, "rate": controller.playback_rate,
			"lean": layer.lean_degrees, "yaw": actor.rig.rotation.y, "feet": feet, "joints": joints})
		var key: String = String(layer.state) if layer.state in [&"JogStart", &"JogStop"] else segment
		var count: int = screenshot_counts.get(key, 0)
		screenshot_counts[key] = count + 1
		if DisplayServer.get_name() != "headless" and ((key in ["JogStart", "JogStop"] and count % 3 == 0) or (key in ["turn-90", "s-left", "s-right", "turn-180", "straight-final", "idle-final"] and count in [3, 9, 15, 90])):
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(OUTPUT + label + "-" + key + "-%03d.png" % count)

func check(value: bool, message: String) -> void:
	checks += 1
	if not value and not failures.has(message):
		failures.append(message)
		push_error(message)
