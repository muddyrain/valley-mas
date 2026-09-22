extends SceneTree
## V2 visual evidence harness for the formal Medium Town Expedition combat loop.

const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Registry = preload("res://data/weapon_registry.gd")
const Provider = preload("res://maps/expedition/expedition_map_provider.gd")

const OUTPUT_DIR := "res://test-output/expedition_combat_capture"
const FPS: int = 15
const FRAME_DT: float = 1.0 / float(FPS)
const TOTAL_FRAMES: int = 375
const ENEMY_ID := "ENM_001_infected_basic_a"

var output_dir: String = OUTPUT_DIR
var mission: Node3D
var shooter: Node3D
var enemies: Array[Node3D] = []
var frame_index: int = 0
var screenshot_index: int = 0
var failures: Array[String] = []
var captures: Array[String] = []
var fire_attempts: int = 0
var accepted_fires: int = 0
var hit_events: int = 0
var camera_size_override: float = 17.0
var camera_focus_target: Node3D

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	_prepare_output()
	var catalog := Catalog.new()
	catalog.survivors = [load("res://data/survivors/xia_zhiyao.tres")]
	mission = Mission.new()
	root.add_child(mission)
	var map_config: Dictionary = {
		"map_provider": Provider.MEDIUM_TOWN_V1,
		"map_seed": 4101,
		"seed": 4101,
		"mission_type": "food_supply",
		"use_random_map": false,
	}
	var loadout: Array[String] = [Registry.P9]
	var locked_party: Array[String] = []
	mission.setup(catalog, Ledger.new(), loadout, 4101, null, locked_party, map_config)
	mission.input_enabled = false
	mission.director_enabled = false
	mission.invincible = true
	await _wait_for_navigation()
	if not mission.town_runtime_ready:
		failures.append("formal Medium Town runtime was not created")
		_finish()
		return
	shooter = mission.survivors[0]
	shooter.combat.fired.connect(func(_pellets: Array) -> void: accepted_fires += 1)
	shooter.combat.hit_resolved.connect(func(_event: RefCounted) -> void: hit_events += 1)
	_configure_review_environment()
	if mission.exploration != null and mission.exploration.fog_mesh != null:
		mission.exploration.fog_mesh.visible = false
	_add_review_light()
	await _movement_stage()
	_stage_enemies()
	if enemies.size() < 10:
		failures.append("fewer than ten formal enemies were staged")
	mission.command_stop()
	mission.camera_controller.following = false
	_apply_capture_camera()
	await _combat_stage()
	while frame_index < TOTAL_FRAMES:
		await _review_wait(FRAME_DT)
	_write_review_manifest()
	print("EXPEDITION COMBAT CAPTURE V2: %d frames, %d screenshots, %d failures" % [frame_index, screenshot_index, failures.size()])
	_finish()

func _prepare_output() -> void:
	var absolute_dir := ProjectSettings.globalize_path(output_dir)
	DirAccess.make_dir_recursive_absolute(absolute_dir)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_dir.path_join("frames")))
	var directory := DirAccess.open(absolute_dir)
	if directory == null:
		return
	for file_name: String in directory.get_files():
		DirAccess.remove_absolute(absolute_dir.path_join(file_name))
	var frames_dir := ProjectSettings.globalize_path(output_dir.path_join("frames"))
	var frames := DirAccess.open(frames_dir)
	if frames == null:
		return
	for file_name: String in frames.get_files():
		DirAccess.remove_absolute(frames_dir.path_join(file_name))

func _wait_for_navigation() -> void:
	for _frame in 180:
		if mission.survivor_commands_enabled:
			return
		await process_frame
	if not mission.survivor_commands_enabled:
		failures.append("formal navigation did not become ready")

func _movement_stage() -> void:
	# Use the production command and camera follow for the first five seconds.
	var destination: Vector3 = mission.runtime_data.mission_poi
	if mission.city.has_method("nearest_open"):
		destination = mission.city.nearest_open(destination)
	if not mission.command_move(destination):
		failures.append("formal command_move rejected the capture destination")
	while frame_index < 5 * FPS:
		await _review_wait(FRAME_DT)
	mission.command_stop()
	if shooter == null or not mission.runtime_data.town_bounds.has_point(Vector2(shooter.position.x, shooter.position.z)):
		failures.append("survivor left the formal town movement area")

func _stage_enemies() -> void:
	var offsets: Array[Vector3] = [
		Vector3(-5.2, 0, -5.5), Vector3(-2.8, 0, -6.7), Vector3(0, 0, -7.2),
		Vector3(2.8, 0, -6.7), Vector3(5.2, 0, -5.5), Vector3(-5.8, 0, -2.6),
		Vector3(-3.0, 0, -3.1), Vector3(3.0, 0, -3.1), Vector3(5.8, 0, -2.6),
		Vector3(-4.6, 0, 1.0), Vector3(0, 0, 1.5), Vector3(4.6, 0, 1.0),
	]
	for offset: Vector3 in offsets:
		var point: Vector3 = mission.city.nearest_open(shooter.position + offset)
		if enemies.any(func(existing: Node3D) -> bool: return existing.position.distance_to(point) < 1.0):
			continue
		var enemy: Node3D = mission.spawn_enemy(ENEMY_ID, point)
		if enemy == null:
			failures.append("formal enemy spawn failed")
			continue
		_stabilize_capture_enemy(enemy)
		enemies.append(enemy)
	# Exploration normally owns visibility. The harness keeps the evidence group within
	# the real sight radius and reapplies the production collision layer after each tick.
	mission.exploration.refresh()
	_stabilize_capture_enemies()

func _stabilize_capture_enemy(enemy: Node3D) -> void:
	enemy.hp = 100000.0
	enemy.max_hp = 100000.0
	enemy.active = true
	enemy.visible = true
	enemy.think_left = 9999.0
	enemy.state_left = 9999.0
	enemy.attack_left = 9999.0
	enemy.windup_left = 0.0
	enemy.target = null
	enemy.attack_target = null
	enemy.path.clear()
	enemy.state = enemy.State.IDLE
	enemy.home_position = enemy.position
	var hit_area := enemy.get_node_or_null("HitArea") as CollisionObject3D
	if hit_area != null:
		hit_area.collision_layer = 2

func _stabilize_capture_enemies() -> void:
	for enemy: Node3D in enemies:
		if is_instance_valid(enemy) and enemy.active:
			enemy.visible = true
			var hit_area := enemy.get_node_or_null("HitArea") as CollisionObject3D
			if hit_area != null:
				hit_area.collision_layer = 2

func _combat_stage() -> void:
	# 5-10s: P9 automatic fire through the production controller.
	camera_size_override = 10.0
	camera_focus_target = enemies[enemies.size() / 2]
	shooter.equip(_weapon(Registry.P9))
	while frame_index < 10 * FPS:
		if frame_index % 8 == 0:
			_stabilize_capture_enemies()
			_fire_at_index(frame_index / 8)
		if frame_index == 5 * FPS:
			_fire_at_index(frame_index / 8 + 1)
			await _capture("01_expedition_scale.png")
		if frame_index == 7 * FPS:
			await _capture("02_real_combat_view.png")
		await _review_wait(FRAME_DT)

	# 10-15s: A21 automatic burst keeps the tracer line readable.
	camera_focus_target = enemies[enemies.size() / 2]
	shooter.equip(_weapon(Registry.A21))
	while frame_index < 15 * FPS:
		if frame_index % 5 == 0:
			_stabilize_capture_enemies()
			_fire_at_index(frame_index / 5 + 1)
		if frame_index == 12 * FPS:
			await _capture("03_weapon_vfx_view.png")
		await _review_wait(FRAME_DT)

	# 15-20s: S12 fires through the same combat controller into the central group.
	camera_focus_target = enemies[enemies.size() / 2]
	shooter.equip(_weapon(Registry.S12))
	while frame_index < 20 * FPS:
		if frame_index % 12 == 0:
			_stabilize_capture_enemies()
			_fire_at_index(frame_index / 12 + 2)
		await _review_wait(FRAME_DT)

	# 20-25s: Multi-target directed fire makes enemy density and independent feedback visible.
	camera_size_override = 17.0
	camera_focus_target = null
	shooter.equip(_weapon(Registry.P9))
	mission.manual_aim = true
	mission.aim_point = enemies[enemies.size() / 2].position
	while frame_index < TOTAL_FRAMES:
		if frame_index % 12 == 0:
			var target: Node3D = enemies[(frame_index / 12) % enemies.size()]
			mission.aim_point = target.position
			_fire_at_index(frame_index / 12 + 3)
			_apply_capture_camera()
		if frame_index == 20 * FPS:
			await _capture("04_multi_enemy_view.png")
		_stabilize_capture_enemies()
		await _review_wait(FRAME_DT)
	mission.end_aim()

func _fire_at_index(index: int) -> void:
	if enemies.is_empty():
		return
	var target: Node3D = enemies[index % enemies.size()]
	fire_attempts += 1
	shooter.cooldown = 0.0
	shooter.combat.try_attack(shooter, mission, target.position, null)

func _apply_capture_camera() -> void:
	var group_center: Vector3 = shooter.position
	if is_instance_valid(camera_focus_target) and camera_focus_target.active:
		group_center = (shooter.position + camera_focus_target.position) * 0.5
	else:
		var count := 1
		for enemy: Node3D in enemies:
			if is_instance_valid(enemy) and enemy.active:
				group_center += enemy.position
				count += 1
		group_center /= float(count)
	mission.camera_controller.following = false
	mission.camera_center = group_center + Vector3(0, 0, -1.5)
	mission.camera.size = camera_size_override
	mission.camera_controller.apply()

func _review_wait(seconds: float) -> void:
	var frames := maxi(1, roundi(seconds * FPS))
	for _frame in frames:
		mission._physics_process(FRAME_DT)
		_stabilize_capture_enemies()
		_apply_capture_camera()
		await process_frame
		if DisplayServer.get_name() != "headless":
			await RenderingServer.frame_post_draw
			var frame_path := ProjectSettings.globalize_path(output_dir.path_join("frames/frame_%04d.png" % frame_index))
			root.get_texture().get_image().save_png(frame_path)
		frame_index += 1

func _capture(name: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	var path := ProjectSettings.globalize_path(output_dir.path_join(name))
	root.get_texture().get_image().save_png(path)
	screenshot_index += 1
	captures.append(name)

func _weapon(id: String) -> Resource:
	return mission.catalog.by_id(mission.catalog.weapons, id).duplicate()

func _configure_review_environment() -> void:
	var environment: Environment = mission.atmosphere.environment
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("3f5c6a")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("b7c9d8")
	environment.ambient_light_energy = 0.88
	environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR

func _add_review_light() -> void:
	var light := DirectionalLight3D.new()
	light.name = "ExpeditionCombatCaptureLight"
	light.light_energy = 0.25
	light.light_color = Color("fff0d8")
	light.shadow_enabled = true
	light.rotation_degrees = Vector3(-52.0, -28.0, 0.0)
	mission.add_child(light)

func _write_review_manifest() -> void:
	var result := {
		"provider": mission.map_provider,
		"runtime_root": mission.runtime_data.runtime_root.name,
		"seed": mission.runtime_data.seed,
		"capture_mode": "EXPEDITION_COMBAT_CAPTURE_V2",
		"frames": frame_index,
		"fps": FPS,
		"seconds": float(frame_index) / float(FPS),
		"formal_enemies": enemies.size(),
		"fire_attempts": fire_attempts,
		"accepted_fires": accepted_fires,
		"hit_events": hit_events,
		"screenshots": captures,
		"camera_size": mission.camera.size,
		"failures": failures,
	}
	FileAccess.open(ProjectSettings.globalize_path(output_dir.path_join("review.json")), FileAccess.WRITE).store_string(JSON.stringify(result, "\t"))

func _finish() -> void:
	if is_instance_valid(mission):
		mission.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
