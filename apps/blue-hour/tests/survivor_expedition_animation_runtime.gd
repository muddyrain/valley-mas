extends SceneTree
## Exercises Xia's animation presentation through the formal Mission and weapon flow.

const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const HUD = preload("res://ui/mission_hud.gd")
const Registry = preload("res://data/weapon_registry.gd")
const Provider = preload("res://maps/expedition/expedition_map_provider.gd")
const OUTPUT: String = "res://test-output/survivor-animation/expedition-runtime"

var checks: int = 0
var failures: Array[String] = []
var states: Array[Dictionary] = []
var mission: Node3D
var hud: Control
var member: Node3D
var shots: int = 0
var camera_size: float = 0.0
var left_hand_attachment: BoneAttachment3D
var extended_timeline: bool = false
var capture_enabled: bool = false
var captured: Dictionary = {}

func _initialize() -> void:
	extended_timeline = "capture" in OS.get_cmdline_user_args()
	capture_enabled = extended_timeline and DisplayServer.get_name() != "headless"
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	root.size = Vector2i(1600, 900)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	var catalog := Catalog.new()
	catalog.survivors = [load("res://data/survivors/xia_zhiyao.tres")]
	var loadout: Array[String] = [Registry.K9]
	var locked_party: Array[String] = []
	mission = Mission.new()
	root.add_child(mission)
	mission.setup(catalog, Ledger.new(), loadout, 4101, null, locked_party, {
		"map_provider": Provider.MEDIUM_TOWN_V1,
		"map_seed": 4101,
		"seed": 4101,
		"mission_type": "food_supply",
		"use_random_map": false,
	})
	if extended_timeline:
		hud = HUD.new()
		root.add_child(hud)
		hud.setup(mission)
	mission.input_enabled = false
	mission.director_enabled = false
	mission.invincible = true
	for frame: int in 180:
		if mission.survivor_commands_enabled:
			break
		await process_frame
	check(mission.town_runtime_ready and mission.survivor_commands_enabled, "Formal Expedition is ready")
	if not mission.survivor_commands_enabled or mission.survivors.is_empty():
		_finish()
		return
	mission.set_physics_process(false)
	member = mission.survivors[0]
	left_hand_attachment = BoneAttachment3D.new()
	left_hand_attachment.bone_name = &"LeftHand"
	member.animation_controller.target.add_child(left_hand_attachment)
	check(member.data.survivor_id == "SUR_001", "Only Xia is the Phase 2 candidate")
	check(member.animation_controller.player.has_animation_library(&"Survivor"), "Runtime uses the eleven-clip Survivor library")
	check(member.animation_controller.player.has_animation_library(&"Public"), "Shared Public library remains available")
	camera_size = mission.camera.size
	check(camera_size > 0.0, "Formal Expedition camera is active")
	member.combat.fired.connect(func(_pellets: Array) -> void: shots += 1)
	member.equip(null)
	await _frames(_length(25, 420), "Idle")
	check(member.animation_controller.active_state == &"IDLE", "Unarmed stop selects survivor_idle")
	var destination: Vector3 = mission.city.navigation.nearest(member.position + Vector3(0.0, 0.0, -8.0))
	check(mission.command_move(destination), "Formal navigation accepts Run command")
	await _frames(_length(90, 120), "Run")
	check(states.any(func(row: Dictionary) -> bool: return row.state == "RUN"), "Movement selects survivor_run")
	mission.command_stop()
	await _frames(_length(40, 60), "Stop")
	check(member.animation_controller.active_state == &"IDLE", "Stopping returns to survivor_idle")
	member.equip(catalog.by_id(catalog.weapons, Registry.K9))
	await _frames(_length(20, 300), "Rifle Idle")
	check(member.weapon_visual.model != null, "Formal K9 has a visible SMG model")
	check(member.weapon_visual.get_support_grip() != null and member.weapon_visual.get_muzzle_point() != null, "Formal K9 exposes grip and muzzle markers")
	check(member.animation_controller.active_state == &"RIFLE_IDLE", "Equipped stop selects rifle_idle")
	check(_settled_grip("Rifle Idle") < 0.02, "Rifle Idle support palm contacts K9 foregrip")
	var armed_destination: Vector3 = mission.city.navigation.nearest(member.position + Vector3(0.0, 0.0, -7.0))
	check(mission.command_move(armed_destination), "Formal navigation accepts Rifle Run command")
	await _frames(_length(80, 100), "Rifle Run")
	check(states.any(func(row: Dictionary) -> bool: return row.state == "RIFLE_RUN"), "Armed movement selects rifle_run")
	check(_settled_grip("Rifle Run") < 0.02, "Rifle Run support palm stays on K9 foregrip")
	mission.command_stop()
	await _frames(_length(35, 60), "Rifle Stop")
	var enemy_point: Vector3 = mission.city.navigation.nearest(member.position + Vector3(0.0, 0.0, -3.0))
	var enemy: Node3D = mission.spawn_enemy(catalog.enemies[0].id, enemy_point)
	check(enemy != null, "Existing enemy spawns for automatic fire")
	if enemy != null:
		enemy.hp = 10000.0
		var moving_target: Vector3 = mission.city.navigation.nearest(member.position + Vector3(5.0, 0.0, 0.0))
		check(mission.command_move(moving_target), "Formal move command remains available during combat")
		await _frames(65, "Moving Shoot")
		check(states.any(func(row: Dictionary) -> bool: return row.phase == "Moving Shoot" and row.state == "RIFLE_RUN" and row.shot_active), "Automatic rifle_shoot overlays Rifle Run")
		check(_settled_grip("Moving Shoot") < 0.02, "Moving fire preserves support palm contact")
		mission.command_stop()
		await _frames(_length(35, 60), "Shoot Stop")
		await _frames(_length(90, 240), "Automatic Shoot")
		check(shots > 0 and member.ammo < member.weapon.magazine_size, "Existing automatic combat fires and consumes ammo")
		check(member.animation_controller.combat_bridge.shoot_requests > 0, "Fired events trigger rifle_shoot overlay")
		mission.debug_clear_enemies()
		await _frames(_length(35, 60), "Shoot Recovery")
		check(not bool(member.animation_controller.tree.get("parameters/Shot/active")), "Shoot overlay fades after combat")
	var hp_before: float = member.hp
	member.take_damage(5.0)
	await _frames(3, "Hit")
	check(member.hp < hp_before and member.animation_controller.get("_hit_left") > 0.0, "Real damage triggers short hit_reaction")
	await _frames(_length(35, 60), "Hit Recovery")
	check(member.animation_controller.get("_hit_left") <= 0.0 and not bool(member.animation_controller.tree.get("parameters/Hit/active")) and member.animation_controller.active_state == &"RIFLE_IDLE", "Hit recovers to armed idle")
	member.equip(catalog.by_id(catalog.weapons, Registry.KNIFE))
	await _frames(_length(20, 120), "Knife Idle")
	check(member.animation_controller.active_state == &"KNIFE_IDLE", "Formal knife selects knife_idle")
	var knife_point: Vector3 = mission.city.navigation.nearest(member.position + Vector3(0.0, 0.0, -1.0))
	var knife_enemy: Node3D = mission.spawn_enemy(catalog.enemies[0].id, knife_point)
	if knife_enemy != null:
		knife_enemy.hp = 10000.0
		var before_knife: int = shots
		await _frames(_length(80, 120), "Knife Attack")
		check(shots > before_knife and states.any(func(row: Dictionary) -> bool: return row.state == "ATTACK"), "Existing melee attack triggers knife_attack")
		mission.debug_clear_enemies()
	var hips: int = member.animation_controller.target.find_bone("Hips")
	var live_hips: Transform3D = member.animation_controller.target.get_bone_global_pose(hips)
	member.take_damage(10000.0)
	check(member.dead and member.animation_controller.active_state == &"DEATH", "Lethal damage starts death animation")
	check(is_zero_approx(member.rig.rotation.z), "Xia does not receive the legacy instant corpse tilt")
	mission.active = false
	var death_length: float = member.animation_controller.library.get_animation(&"death").length
	for frame: int in ceili((death_length + 0.4) * 30.0):
		member.animation_controller._process(1.0 / 30.0)
		await process_frame
	check(member.animation_controller.active_state == &"DEATH", "Death remains terminal after the clip")
	check(member.animation_controller.playback.get_current_play_position() >= death_length - 0.05, "Full death clip reaches its final pose")
	check(not live_hips.is_equal_approx(member.animation_controller.target.get_bone_global_pose(hips)), "Death clip changes the final body pose")
	check(is_equal_approx(mission.camera.size, camera_size), "Runtime animation leaves the formal camera unchanged")
	if capture_enabled:
		await _capture("expedition_death.png")
	_finish()

func _length(regular: int, filmed: int) -> int:
	return filmed if extended_timeline else regular

func _frames(count: int, label: String) -> void:
	for frame: int in count:
		mission._physics_process(1.0 / 60.0)
		await process_frame
		var controller: Node3D = member.animation_controller
		var grip_error: float = -1.0
		var muzzle_dot: float = -2.0
		if member.weapon_visual.model != null and member.weapon_visual.get_support_grip() != null:
			grip_error = (left_hand_attachment.global_transform * Vector3(0.0, 0.045, 0.0)).distance_to(member.weapon_visual.get_support_grip().global_position)
			if controller.combat_bridge.aiming and member.weapon_visual.get_muzzle_point() != null:
				var muzzle: Node3D = member.weapon_visual.get_muzzle_point()
				muzzle_dot = (-muzzle.global_basis.z.normalized()).dot(controller.combat_bridge.aim_direction)
		states.append({
			"phase": label,
			"state": str(controller.active_state),
			"speed": Vector2(member.actual_velocity.x, member.actual_velocity.z).length(),
			"rate": controller.playback_rate,
			"shot_active": bool(controller.tree.get("parameters/Shot/active")),
			"hit_active": bool(controller.tree.get("parameters/Hit/active")),
			"grip_error": grip_error,
			"muzzle_dot": muzzle_dot,
		})
		if capture_enabled and not captured.has(label):
			var frame_to_capture: int = {
				"Idle": 180,
				"Run": 60,
				"Rifle Idle": 180,
				"Rifle Run": 60,
				"Moving Shoot": 45,
				"Automatic Shoot": 90,
				"Hit": 1,
				"Knife Idle": 60,
			}.get(label, -1)
			if frame == frame_to_capture or label == "Knife Attack" and frame >= 10 and controller.active_state == &"ATTACK":
				var file_name: String = {
					"Idle": "expedition_idle.png",
					"Run": "expedition_run.png",
					"Rifle Idle": "expedition_rifle_idle.png",
					"Rifle Run": "expedition_rifle_run.png",
					"Moving Shoot": "expedition_moving_shoot.png",
					"Automatic Shoot": "expedition_shoot.png",
					"Hit": "expedition_hit.png",
					"Knife Idle": "expedition_knife_idle.png",
					"Knife Attack": "expedition_knife_attack.png",
				}.get(label, "")
				if not file_name.is_empty():
					await _capture(file_name)
					captured[label] = true

func _capture(file_name: String) -> void:
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	if image == null:
		check(false, "Native viewport image exists for " + file_name)
		return
	check(image.save_png(OUTPUT + "/" + file_name) == OK, "Native screenshot saved: " + file_name)

func _settled_grip(phase: String) -> float:
	var samples: Array[float] = []
	for row: Dictionary in states:
		if row.phase == phase and row.grip_error >= 0.0:
			samples.append(row.grip_error)
	var worst: float = 0.0
	for index: int in range(maxi(0, samples.size() - 10), samples.size()):
		worst = maxf(worst, samples[index])
	return worst if samples.size() >= 10 else INF

func _finish() -> void:
	if capture_enabled:
		for file_name: String in ["expedition_idle.png", "expedition_run.png", "expedition_rifle_idle.png", "expedition_rifle_run.png", "expedition_moving_shoot.png", "expedition_shoot.png", "expedition_hit.png", "expedition_death.png", "expedition_knife_idle.png", "expedition_knife_attack.png"]:
			check(FileAccess.file_exists(OUTPUT + "/" + file_name), "Native screenshot exists: " + file_name)
	FileAccess.open(OUTPUT + "/runtime.json", FileAccess.WRITE).store_string(JSON.stringify({
		"checks": checks,
		"failures": failures,
		"shots": shots,
		"camera_size": camera_size,
		"states": states,
	}, "\t"))
	print("SURVIVOR EXPEDITION ANIMATION: %d checks; failures=%s" % [checks, failures])
	quit(0 if failures.is_empty() else 1)
