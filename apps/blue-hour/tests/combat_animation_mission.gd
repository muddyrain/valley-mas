extends SceneTree
## Formal Mission gameplay with deterministic ticks, or a native real-time A/B benchmark.
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const HUD = preload("res://ui/mission_hud.gd")
const Registry = preload("res://data/weapon_registry.gd")
var mission: Node3D
var hud: Control
var checks: int = 0
var failures: Array[String] = []
var shots: Dictionary = {}
var snapshots: Dictionary = {}
var metrics: Array[Dictionary] = []
var capture_enabled: bool = false
var measuring: bool = false
var last_frame: int = 0
var frame_times: Array[float] = []

func _initialize() -> void:
	capture_enabled = DisplayServer.get_name() != "headless"
	call_deferred("run")

func _process(_delta: float) -> bool:
	var now := Time.get_ticks_usec()
	if measuring and last_frame > 0:
		frame_times.append((now - last_frame) / 1000.0)
	last_frame = now
	return false

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output/combat-animation")
	var catalog := Catalog.new()
	# Preserve the original Public/Combat graph contract on the unaffected actor;
	# Xia's formal Expedition path has a dedicated Survivor animation test.
	catalog.survivors = [load("res://data/survivors/su_wanxing.tres")]
	var equipment: Array[String] = [Registry.A21]
	mission = Mission.new()
	root.add_child(mission)
	mission.setup(catalog, Ledger.new(), equipment, 7312)
	mission.input_enabled = false
	mission.director_enabled = false
	mission.invincible = true
	mission.debug_clear_enemies()
	hud = HUD.new()
	root.add_child(hud)
	hud.setup(mission)
	for i in mission.survivors.size():
		var member: Node3D = mission.survivors[i]
		member.position = mission.city.nearest_open(Vector3(0, 0, 15) + mission.formation(i))
		shots[member.data.id] = 0
		member.combat.fired.connect(func(_pellets: Array) -> void: shots[member.data.id] += 1)
		var skeleton: Skeleton3D = member.animation_controller.target
		skeleton.skeleton_updated.connect(func() -> void:
			snapshots[member.data.id] = {"left": skeleton.global_transform * skeleton.get_bone_global_pose(skeleton.find_bone("LeftHand")),
				"right": skeleton.global_transform * skeleton.get_bone_global_pose(skeleton.find_bone("RightHand"))})
	mission.center_squad()
	if "benchmark" in OS.get_cmdline_user_args():
		await benchmark()
	else:
		mission.set_physics_process(false)
		mission.set_process(false)
		await verify()
	var report := {"checks": checks, "failures": failures, "metrics": metrics, "shots": shots, "camera_size": mission.camera.size, "native": capture_enabled}
	var name := "benchmark" if "benchmark" in OS.get_cmdline_user_args() else ("mission-native" if capture_enabled else "mission-headless")
	FileAccess.open("res://test-output/combat-animation/" + name + ".json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("COMBAT MISSION ", name, ": ", checks, " checks, ", failures.size(), " failures")
	hud.free()
	mission.free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func advance(frames: int) -> void:
	for frame in frames:
		mission._physics_process(1.0 / 60)
		await process_frame
	await process_frame

func verify() -> void:
	await advance(30)
	for member in mission.survivors:
		check(member.animation_controller.combat_bridge.visual_state == 1, "Idle Ready: " + member.data.id)
		check(shots[member.data.id] == 0, "Ready does not shoot")
	await capture("mission-ready")
	mission.effects.set_source("combat_test_walk", {"move_speed": .30})
	mission.command_move(Vector3(0, 0, -22))
	await advance(70)
	for member in mission.survivors:
		check(member.animation_controller.current_state == &"Walk" and member.animation_controller.combat_bridge.visual_state == 1, "Slow public Walk + Ready")
	await capture("mission-walk-ready")
	mission.effects.remove_source("combat_test_walk")
	await advance(70)
	for member in mission.survivors:
		check(member.animation_controller.current_state == &"Run" and member.animation_controller.combat_bridge.visual_state == 1, "Full-speed public Run + Ready")
	await capture("mission-run-ready")
	mission.command_stop()
	await advance(35)
	# Exact damage/event/ammo correspondence on a real enemy, with random spread disabled
	# only on an isolated derived definition. One attack must never be replayed by animation.
	var lead: Node3D = mission.survivors[0]
	var enemy: Node3D = mission.spawn_enemy(mission.catalog.enemies[0].id, lead.position + Vector3(0, 0, -5))
	enemy.set_process(false)
	for member in mission.survivors:
		var definition: Resource = member.weapon.duplicate()
		definition.accuracy = 1.0
		definition.knockback = WeaponDefinition.Knockback.NONE
		member.equip(definition)
		member.cooldown = 10.0
	enemy.hp = 10000.0
	var hp_before: float = enemy.hp
	var ammo_before: int = lead.ammo
	var expected_damage: float = mission.damage_to(lead, enemy)
	lead.cooldown = 0
	check(lead.combat.try_attack(lead, mission, enemy.position, enemy), "One confirmed gameplay attack")
	check(shots[lead.data.id] == 1 and lead.ammo == ammo_before - 1, "One signal and one ammunition charge")
	check(is_equal_approx(hp_before - enemy.hp, expected_damage), "One damage application")
	lead.cooldown = 10
	await advance(30)
	check(shots[lead.data.id] == 1 and is_equal_approx(hp_before - enemy.hp, expected_damage), "Animation completion never replays damage")
	for member in mission.survivors:
		check(member.animation_controller.combat_bridge.aiming, "Aim survives gameplay cooldown")
	await capture("mission-aim")
	await capture_close("mission-aim-close")
	# Preserve the real targeting/raycast path throughout movement and fire.
	for member in mission.survivors:
		member.cooldown = 0
	mission.effects.set_source("combat_test_walk", {"move_speed": .30})
	mission.command_move(mission.squad_center() + Vector3(1.6, 0, -8))
	await advance(80)
	for member in mission.survivors:
		check(member.animation_controller.current_state == &"Walk", "Public Walk while firing")
		check(shots[member.data.id] >= 4, "Repeated gameplay fire reaches animation: " + member.data.id)
		check(member.ammo == member.weapon.magazine_size - int(shots[member.data.id]), "Burst event count equals ammo consumption")
		check_markers(member)
	await capture("mission-walk-shoot")
	await capture_close("mission-walk-shoot-close")
	mission.effects.remove_source("combat_test_walk")
	await advance(45)
	for member in mission.survivors:
		check(member.animation_controller.current_state == &"Run" and member.animation_controller.combat_bridge.aiming, "Full-speed Mission Jog + Aim/Shoot")
	await capture("mission-run-shoot")
	mission.command_stop()
	for member in mission.survivors:
		member.cooldown = 10
	await advance(40)
	for member in mission.survivors:
		check(member.animation_controller.current_state == &"Idle" and member.animation_controller.combat_bridge.aiming, "Stop keeps aim")
		member.combat.current_ammo = 0
		member.combat.tick(.01)
		check(member.animation_controller.combat_bridge.reloading, "Existing reload signal is bridged")
		member.combat.tick(member.weapon.reload_time)
		check(not member.animation_controller.combat_bridge.reloading, "Existing reload finished is bridged")
	# The real Ctrl aim command must rotate a stationary visual toward an arbitrary point.
	mission.input_enabled = true
	mission.command_aim(lead.position + Vector3(5, 0, 0))
	await advance(70)
	for member in mission.survivors:
		check_markers(member)
		var muzzle: Node3D = member.weapon_visual.get_muzzle_point()
		var direction: Vector3 = member.animation_controller.combat_bridge.aim_direction
		check((-muzzle.global_basis.z.normalized()).dot(direction) > .99, "Stationary target turn aligns muzzle")
	await capture("mission-target-turn")
	mission.time_scale = 0
	var animation_time: float = lead.animation_controller.playback.get_current_play_position()
	var ammo_paused: int = lead.ammo
	await advance(20)
	check(lead.ammo == ammo_paused and is_equal_approx(animation_time, lead.animation_controller.playback.get_current_play_position()), "Pause stops gameplay and animation")
	mission.time_scale = 1
	mission.manual_aim = false
	mission.debug_clear_enemies()
	await advance(30)
	for member in mission.survivors:
		check(member.animation_controller.combat_bridge.visual_state == 1, "Threat gone returns to low Ready")
		member.equip(null)
	await advance(30)
	for member in mission.survivors:
		check(member.animation_controller.combat_bridge.combat_weight == 0 and member.weapon_visual.model == null, "Unequip returns to Exploration")
	await capture("mission-exploration")

func check_markers(member: Node3D) -> void:
	var visual: WeaponVisualController = member.weapon_visual
	var left: Transform3D = snapshots[member.data.id].left
	var error := (left * Vector3(0, .045, 0)).distance_to(visual.get_support_grip().global_position)
	check(error < .008, "Mission LeftGrip contact: " + str(error))
	check(visual.socket.global_position.distance_to((snapshots[member.data.id].right as Transform3D).origin) < .001, "Mission RightHand attachment")
	check(visual.get_muzzle_point().global_transform.is_finite(), "Mission finite MuzzlePoint")
	metrics.append({"character": member.data.id, "left_grip_error_m": error})

func capture(label: String) -> void:
	if capture_enabled:
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/combat-animation/" + label + ".png")

func capture_close(label: String) -> void:
	var size: float = mission.camera.size
	mission.camera.size = 7
	mission.center_squad()
	await capture(label)
	mission.camera.size = size

func benchmark() -> void:
	# Same loaded map, HUD, actors, weapon models and continuous fire in every sample.
	# The baseline disables only the new layer and its constraint, not weapon gameplay.
	mission.input_enabled = true
	mission.command_aim(Vector3(0, 0, -20))
	await create_timer(2).timeout
	for enabled: bool in [false, true, true, false]:
		for member in mission.survivors:
			var controller: Node = member.animation_controller
			controller.combat_bridge.constraint.active = enabled
			var graph: AnimationNodeBlendTree = controller.tree.tree_root
			graph.disconnect_node(&"output", 0)
			graph.disconnect_node(&"CombatLayer", 0)
			if enabled:
				graph.connect_node(&"CombatLayer", 0, &"Rate")
			graph.connect_node(&"output", 0, &"CombatLayer" if enabled else &"Rate")
		await create_timer(1).timeout
		frame_times.clear()
		last_frame = 0
		measuring = true
		await create_timer(4).timeout
		measuring = false
		var sorted := frame_times.duplicate()
		sorted.sort()
		var total_ms: float = frame_times.reduce(func(a: float, b: float) -> float: return a + b, 0.0)
		metrics.append({"combat_layer": enabled, "frames": frame_times.size(), "mean_ms": total_ms / frame_times.size(), "fps": frame_times.size() * 1000 / total_ms,
			"p95_ms": sorted[int(sorted.size() * .95)], "p99_ms": sorted[int(sorted.size() * .99)], "max_ms": sorted[-1],
			"physics_ms": Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000})
		print("COMBAT PERF: ", metrics[-1])
