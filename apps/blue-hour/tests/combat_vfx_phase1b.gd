extends SceneTree
## Phase 1B effect acceptance: one generic VFX path across the four requested weapons.

const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Registry = preload("res://data/weapon_registry.gd")

var mission: Node3D
var checks := 0
var failures: Array[String] = []
var native_capture := false
var output_dir := "res://test-output/combat_vfx_phase1b"
var film_frame := 0

func _initialize() -> void:
	native_capture = DisplayServer.get_name() != "headless"
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	DirAccess.make_dir_recursive_absolute(output_dir)
	DirAccess.make_dir_recursive_absolute(output_dir.path_join("film"))
	var catalog := Catalog.new()
	catalog.survivors = [load("res://data/survivors/xia_zhiyao.tres"), load("res://data/survivors/su_wanxing.tres")]
	mission = Mission.new()
	root.add_child(mission)
	var loadout: Array[String] = [Registry.P9, Registry.A21]
	mission.setup(catalog, Ledger.new(), loadout, 4811)
	mission.input_enabled = false
	mission.director_enabled = false
	mission.invincible = true
	mission.camera.size = 10.0
	mission.debug_clear_enemies()
	await _frames(12)

	var shooter: Node3D = mission.survivors[0]
	shooter.position = mission.city.nearest_open(Vector3(0, 0, 0))
	_prepare_capture_stage(shooter)
	for weapon_case: Dictionary in [
		{"id": Registry.P9, "shot": "screenshot_01_pistol_fire.png"},
		{"id": Registry.A21, "shot": "screenshot_02_rifle_fire.png"},
		{"id": Registry.S12, "shot": "screenshot_04_shotgun_hit.png"},
		{"id": Registry.K9, "shot": ""},
	]:
		await _exercise_weapon(shooter, catalog.by_id(catalog.weapons, weapon_case.id), str(weapon_case.shot))

	await _exercise_hit_feedback(shooter, catalog.by_id(catalog.weapons, Registry.P9))
	await _capture("screenshot_03_hit_feedback.png")
	await _film(shooter, catalog.by_id(catalog.weapons, Registry.A21))
	var report := {"checks": checks, "failures": failures, "native": native_capture, "film_frames": film_frame, "weapons": [Registry.P9, Registry.K9, Registry.S12, Registry.A21]}
	FileAccess.open(output_dir.path_join("acceptance.json"), FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("COMBAT VFX PHASE 1B: %d checks, %d failures" % [checks, failures.size()])
	mission.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func _exercise_weapon(shooter: Node3D, definition: Resource, screenshot: String) -> void:
	mission.debug_clear_enemies()
	_prepare_capture_stage(shooter)
	var weapon := definition.duplicate()
	weapon.accuracy = 1.0
	shooter.equip(weapon)
	await _frames(3)
	check(shooter.weapon_visual.muzzle_flash != null, "Muzzle flash exists for " + str(definition.id))
	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", shooter.position + Vector3(0, 0, -4.5))
	check(enemy != null, "Enemy target spawned for " + str(definition.id))
	if enemy == null:
		return
	_show_capture_target(enemy)
	_focus_capture_camera(shooter, enemy)
	enemy.hp = 10000.0
	var pulse_before: int = shooter.weapon_visual.muzzle_flash.pulses
	var hit_before: float = enemy.hp
	shooter.cooldown = 0.0
	check(shooter.combat.try_attack(shooter, mission, enemy.position, enemy), "Attack accepted for " + str(definition.id))
	check(shooter.weapon_visual.muzzle_flash.pulses == pulse_before + 1, "Fired event triggers one muzzle flash for " + str(definition.id))
	check(enemy.hp < hit_before, "HitEvent damages target for " + str(definition.id))
	check(enemy.hit_feedback != null and enemy.hit_feedback.active(), "Hit feedback activates for " + str(definition.id))
	if screenshot.is_empty():
		await _frames(8)
	else:
		await _frames(1)
		await _capture(screenshot)
	await _frames(10)

func _exercise_hit_feedback(shooter: Node3D, definition: Resource) -> void:
	mission.debug_clear_enemies()
	_prepare_capture_stage(shooter)
	var weapon := definition.duplicate()
	weapon.accuracy = 1.0
	shooter.equip(weapon)
	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", shooter.position + Vector3(0, 0, -4.0))
	if enemy == null:
		return
	_show_capture_target(enemy)
	_focus_capture_camera(shooter, enemy)
	enemy.hp = 10000.0
	shooter.cooldown = 0.0
	shooter.combat.try_attack(shooter, mission, enemy.position, enemy)
	await _frames(1)
	check(enemy.hit_feedback.active(), "Dedicated hit feedback capture is active")

func _film(shooter: Node3D, definition: Resource) -> void:
	mission.debug_clear_enemies()
	_resume_runtime_stage(shooter)
	var weapon := definition.duplicate()
	weapon.accuracy = 1.0
	shooter.equip(weapon)
	var targets: Array[Node3D] = []
	for offset: Vector3 in [Vector3(-2.0, 0, -5.0), Vector3(0, 0, -6.0), Vector3(2.0, 0, -5.0)]:
		var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", shooter.position + offset)
		if enemy != null:
			_show_capture_target(enemy)
			_focus_capture_camera(shooter, enemy)
			enemy.hp = 100000.0
			enemy.think_left = 9999.0
			enemy.state_left = 9999.0
			enemy.attack_left = 9999.0
			enemy.target = null
			enemy.attack_target = null
			targets.append(enemy)
	if targets.is_empty():
		return
	mission.center_squad()
	# Capture a 12-second presentation reel at 15 fps while the real tick drives attacks.
	for frame in 180:
		await _frames(4)
		if native_capture:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(output_dir.path_join("film/frame_%04d.png" % film_frame))
		film_frame += 1

func _capture(name: String) -> void:
	if not native_capture:
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output_dir.path_join(name))

func _prepare_capture_stage(shooter: Node3D) -> void:
	# Freeze the world while preserving the immediate attack frame; otherwise the
	# mission camera follows the squad away from the just-created VFX.
	for index: int in mission.survivors.size():
		var member: Node3D = mission.survivors[index]
		member.stop()
		member.position = shooter.position + Vector3(float(index) * 1.8, 0, 0)
	mission.center_squad()
	mission.camera_controller.following = false
	mission.camera_controller.apply()
	mission.set_process(false)
	mission.set_physics_process(false)

func _resume_runtime_stage(shooter: Node3D) -> void:
	for index: int in mission.survivors.size():
		var member: Node3D = mission.survivors[index]
		member.stop()
		member.position = shooter.position + Vector3(float(index) * 1.8, 0, 0)
	mission.set_process(true)
	mission.set_physics_process(true)
	mission.center_squad()

func _show_capture_target(enemy: Node3D) -> void:
	# Exploration visibility is intentionally bypassed for deterministic effect evidence.
	enemy.visible = true
	var hit_area := enemy.get_node_or_null("HitArea") as CollisionObject3D
	if hit_area != null:
		hit_area.collision_layer = 2

func _focus_capture_camera(shooter: Node3D, enemy: Node3D) -> void:
	var focus := (shooter.position + enemy.position) * 0.5 + Vector3.UP * 0.65
	mission.camera.size = 8.0
	mission.camera.position = focus + Vector3(8.0, 10.0, -12.0)
	mission.camera.look_at(focus, Vector3.UP)

func _frames(count: int) -> void:
	for _index in count:
		await process_frame
