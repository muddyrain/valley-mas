extends SceneTree
## Formal Mission locomotion with a real long gun; target/fire scenarios share the same route.
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const HUD = preload("res://ui/mission_hud.gd")
const Registry = preload("res://data/weapon_registry.gd")
const OUTPUT := "res://test-output/phase-2e/"
var mission: Node3D
var actor: Node3D
var profile: StringName = &"natural"
var mode: String = "ready"
var label: String = "combat-ready-jog-v2"
var final_poses: Dictionary = {}
var shots: int = 0
var one_shots: int = 0
var enemy: Node3D
var flashes: int = 0
var max_grip: float = 0.0
var grip_frame: float = 0.0
var muzzle_dot_frame: float = 1.0
var hand_height_frame: float = 0.0
var muzzle_axis_frame := Vector3.ZERO
var moving_aim_frames: int = 0
var initial_enemy_hp: float = 0.0
var damage_dealt: float = 0.0
var expected_damage_per_shot: float = 0.0
var detail_capture: bool = false
var character: String = "xia_zhiyao"
var samples: Array[Dictionary] = []
var failures: Array[String] = []
var screenshot_counts: Dictionary[String, int] = {}
var checks: int = 0

func _initialize() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--mode="):
			mode = argument.trim_prefix("--mode=")
			label = "combat-" + mode + "-jog-v2"
		if argument == "--character=su":
			character = "su_wanxing"
		if argument == "--detail":
			detail_capture = true
	if character == "su_wanxing":
		label += "-su"
	if detail_capture:
		label += "-detail"
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	root.size = Vector2i(1600, 900)
	var catalog := Catalog.new()
	catalog.survivors = [load("res://data/survivors/" + character + ".tres")]
	var equipment: Array[String] = [Registry.A21]
	mission = Mission.new()
	root.add_child(mission)
	mission.setup(catalog, Ledger.new(), equipment, 7312)
	mission.input_enabled = false
	mission.director_enabled = false
	mission.invincible = true
	mission.debug_clear_enemies()
	actor = mission.survivors[0]
	actor.position = mission.city.nearest_open(Vector3(0, 0, 24))
	actor.animation_controller.set_jog_cadence(profile)
	actor.animation_controller.target.skeleton_updated.connect(func() -> void:
		var skeleton: Skeleton3D = actor.animation_controller.target
		for bone in skeleton.get_bone_count():
			final_poses[skeleton.get_bone_name(bone)] = skeleton.global_transform * skeleton.get_bone_global_pose(bone)
		var palm: Vector3 = (final_poses.LeftHand as Transform3D) * Vector3(0, .045, 0)
		grip_frame = palm.distance_to(actor.weapon_visual.get_marker_transform(actor.weapon_visual.get_support_grip(), skeleton).origin)
		hand_height_frame = skeleton.get_bone_global_pose(skeleton.find_bone("RightHand")).origin.y
		var muzzle: Transform3D = actor.weapon_visual.get_marker_transform(actor.weapon_visual.get_muzzle_point(), skeleton)
		muzzle_axis_frame = skeleton.global_basis.inverse() * (-muzzle.basis.z.normalized())
		muzzle_dot_frame = (-muzzle.basis.z.normalized()).dot(actor.animation_controller.combat_bridge.aim_direction))
	actor.combat.fired.connect(func(_pellets: Array) -> void: shots += 1)
	mission.center_squad()
	if detail_capture:
		mission.camera.size = 7
	var hud := HUD.new()
	root.add_child(hud)
	hud.setup(mission)
	for frame in 24:
		if DisplayServer.get_name() == "headless":
			mission.set_physics_process(false)
			mission._physics_process(1.0 / 60.0)
		await process_frame
	await record("idle", 60)
	mission.command_move(Vector3(0, 0, -40))
	for frame in 600:
		await record("straight", 1)
		if actor.position.z <= (.10 if character == "su_wanxing" else 0.0):
			break
	check(actor.position.z <= (.10 if character == "su_wanxing" else 0.0), "Continuous straight run reaches the real intersection")
	if mode != "ready":
		# A controlled moving target uses the real enemy mover, raycast, HP and hit area.
		# Only this fixture's path/speed and durability are set; survivor gameplay is unchanged.
		enemy = mission.spawn_enemy(mission.catalog.enemies[0].id, Vector3(actor.position.x + 8, 0, 0))
		enemy.data = enemy.data.duplicate()
		enemy.data.move_speed = actor.data.move_speed * (1.0 + actor.weapon.move_speed_modifier)
		enemy.data.max_hp = 10000
		enemy.hp = 10000
		enemy.max_hp = 10000
		initial_enemy_hp = enemy.hp
		expected_damage_per_shot = mission.damage_to(actor, enemy)
		enemy.target = actor
		enemy.think_left = 60
		# The isolated Phase 2E build retains the pre-encounter gameplay; current
		# workspace AI may also maintain target memory and a separate path throttle.
		if enemy.get("memory_left") != null:
			enemy.memory_left = 60
			enemy.path_left = 60
			enemy.last_seen_position = Vector3(48, 0, 0)
			enemy.path_destination = enemy.last_seen_position
		enemy.path = mission.city.path(enemy.position, Vector3(48, 0, 0))
		actor.cooldown = 100.0 if mode == "aim" else 0.0
	mission.command_move(Vector3(48, 0, 0))
	await record("turn-90", 360)
	if enemy != null:
		damage_dealt = initial_enemy_hp - enemy.hp
		mission.debug_clear_enemies()
		enemy = null
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
	check(actor.weapon != null and actor.data.id == character, "Requested long-gun character")
	check(is_equal_approx(actor.data.move_speed, 4.0 if character == "su_wanxing" else 4.2), "Original gameplay speed")
	check(is_equal_approx(mission.camera.size, 7 if detail_capture else 25), "Explicit camera size; detail captures are auxiliary only")
	var previous: Dictionary = {}
	var max_turn: Dictionary = {}
	for sample in samples:
		check(absf(sample.lean) <= 8, "Lean stays under eight degrees")
		if not previous.is_empty() and sample.state == "Jog" and previous.state == "Jog":
			check(fposmod(sample.phase - previous.phase, 1.0) < .08, "No turn resets the phase")
		if not previous.is_empty() and sample.speed > actor.data.move_speed * .90 and previous.speed > actor.data.move_speed * .90:
			var old := Vector3(previous.velocity[0], 0, previous.velocity[2])
			var direction := Vector3(sample.velocity[0], 0, sample.velocity[2])
			max_turn[sample.segment] = maxf(float(max_turn.get(sample.segment, 0)), rad_to_deg(old.angle_to(direction)))
		previous = sample
	check(float(max_turn.get("turn-90", 0)) > 70, "Recorded navigation contains the 90 degree corner")
	check(float(max_turn.get("s-left", 0)) > 30 and float(max_turn.get("s-right", 0)) > 30, "Recorded navigation contains both S turns")
	check(float(max_turn.get("turn-180", 0)) > 150, "Recorded navigation contains the reversal")
	if mode == "shoot":
		check(shots == 10 and one_shots == shots and flashes == shots, "Ten real attacks = ten Shoot requests = ten flashes")
		check(actor.ammo == actor.weapon.magazine_size - shots, "Each real attack consumes exactly one round")
		check(damage_dealt > 0 and damage_dealt <= expected_damage_per_shot * shots + .001, "Gameplay alone resolves real enemy damage")
	else:
		check(shots == 0, "Ready/Aim-only recordings never attack")
	if mode != "ready":
		check(moving_aim_frames >= 300, "Continuous target tracking while moving for at least five seconds")
	check(max_grip < .008, "Support grip stays below 8mm throughout the route")
	var report := {"mode": mode, "shots": shots, "one_shots": one_shots, "flashes": flashes, "damage_dealt": damage_dealt, "moving_aim_frames": moving_aim_frames, "max_grip_error_m": max_grip, "character": character, "profile": String(profile), "native": DisplayServer.get_name() != "headless", "fps": 60,
		"camera_size": mission.camera.size, "scale": actor.animation_controller.visual_scale,
		"checks": checks, "failures": failures, "max_direction_changes": max_turn, "samples": samples}
	FileAccess.open(OUTPUT + label + ".json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("PHASE 2E COMBAT FILM ", label, ": ", samples.size(), " frames; checks=", checks, "; turns=", max_turn, "; failures=", failures)
	hud.free()
	mission.free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func record(segment: String, frames: int) -> void:
	for frame in frames:
		if mode == "shoot" and shots >= 10:
			actor.cooldown = 100.0
		if DisplayServer.get_name() == "headless":
			mission.set_physics_process(false)
			mission._physics_process(1.0 / 60.0)
		await process_frame
		if final_poses.is_empty():
			await process_frame
		var controller: Node3D = actor.animation_controller
		var layer: SkeletonModifier3D = controller.locomotion_layer
		var position: Vector3 = actor.position
		var velocity: Vector3 = actor.actual_velocity
		var skeleton: Skeleton3D = controller.target
		var feet: Array[Array] = []
		var joints: Dictionary = {}
		for joint_name: String in ["LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "RightUpperLeg", "RightLowerLeg", "RightFoot", "LeftUpperArm", "LeftLowerArm", "LeftHand", "RightUpperArm", "RightLowerArm", "RightHand"]:
			var joint: Vector3 = (final_poses[joint_name] as Transform3D).origin
			var screen: Vector2 = mission.camera.unproject_position(joint)
			joints[joint_name] = {"world": [joint.x, joint.y, joint.z], "screen": [screen.x, screen.y]}
		for name: String in ["LeftFoot", "RightFoot"]:
			var foot: Vector3 = (final_poses[name] as Transform3D).origin
			feet.append([foot.x, foot.y, foot.z])
		samples.append({"frame": samples.size(), "segment": segment, "position": [position.x, position.y, position.z],
			"velocity": [velocity.x, velocity.y, velocity.z], "speed": actor.current_speed,
			"state": String(layer.state), "phase": layer.locomotion_phase, "rate": controller.playback_rate,
			"lean": layer.lean_degrees, "yaw": actor.rig.rotation.y, "feet": feet, "joints": joints})
		max_grip = maxf(max_grip, grip_frame)
		samples[-1]["grip_error_m"] = grip_frame
		var bridge: Node = controller.combat_bridge
		one_shots = bridge.shoot_requests
		if bridge.aiming and actor.current_speed > actor.data.move_speed * .90:
			moving_aim_frames += 1
		if segment == "turn-90" and frame >= 30 and mode == "aim":
			check(muzzle_dot_frame > .99, "Stable aimed muzzle after the initial corner")
		samples[-1]["upper_state"] = bridge.visual_state
		samples[-1]["secondary_weight"] = bridge.constraint.secondary.state_weight
		samples[-1]["weapon_hand_y"] = hand_height_frame
		samples[-1]["muzzle_axis"] = [muzzle_axis_frame.x, muzzle_axis_frame.y, muzzle_axis_frame.z]
		samples[-1]["shots"] = shots
		flashes = actor.weapon_visual.muzzle_flash.pulses
		var key: String = String(layer.state) if layer.state in [&"JogStart", &"JogStop"] else segment
		var count: int = screenshot_counts.get(key, 0)
		screenshot_counts[key] = count + 1
		if DisplayServer.get_name() != "headless" and ((key in ["JogStart", "JogStop"] and count % 3 == 0) or (key == "turn-90" and count >= 90 and count < 150 and count % 6 == 0) or (key in ["turn-90", "s-left", "s-right", "turn-180", "straight-final", "idle-final"] and count in [3, 9, 15, 90])):
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(OUTPUT + label + "-" + key + "-%03d.png" % count)

func check(value: bool, message: String) -> void:
	checks += 1
	if not value and not failures.has(message):
		failures.append(message)
		push_error(message)
