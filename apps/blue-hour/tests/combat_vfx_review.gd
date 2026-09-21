extends SceneTree
## Fixed-camera visual review for the existing Combat VFX Phase 1B effects.

const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Registry = preload("res://data/weapon_registry.gd")

const REVIEW_DIR := "res://test-output/combat_vfx_review"
const FPS := 15
const FRAME_DT := 1.0 / float(FPS)

var mission: Node3D
var shooter: Node3D
var enemies: Array[Node3D] = []
var frame_index := 0
var screenshot_index := 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute(REVIEW_DIR)
	DirAccess.make_dir_recursive_absolute(REVIEW_DIR.path_join("frames"))
	var catalog := Catalog.new()
	catalog.survivors = [load("res://data/survivors/xia_zhiyao.tres")]
	mission = Mission.new()
	root.add_child(mission)
	var loadout: Array[String] = [Registry.P9]
	mission.setup(catalog, Ledger.new(), loadout, 8192)
	mission.input_enabled = false
	mission.director_enabled = false
	mission.invincible = true
	mission.time_scale = 0.0
	mission.debug_clear_enemies()
	await _frames(12)

	shooter = mission.survivors[0]
	shooter.position = mission.city.nearest_open(Vector3(0, 0, 4.0))
	shooter.stop()
	mission.camera_controller.following = false
	_add_review_light()
	_configure_review_environment()
	# The gameplay exploration mask tints the whole viewport; hide it for neutral VFX inspection.
	if mission.exploration != null and mission.exploration.fog_mesh != null:
		mission.exploration.fog_mesh.visible = false
	await _stage_enemies()
	_set_review_camera(shooter.position + Vector3(0.0, 0.8, -1.7), 4.8)
	mission.set_process(false)
	mission.set_physics_process(false)
	await _capture_sequence()

	var result := {"frames": frame_index, "screenshots": screenshot_index, "failures": failures}
	FileAccess.open(REVIEW_DIR.path_join("review.json"), FileAccess.WRITE).store_string(JSON.stringify(result, "\t"))
	print("COMBAT VFX REVIEW: %d frames, %d screenshots, %d failures" % [frame_index, screenshot_index, failures.size()])
	mission.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func _stage_enemies() -> void:
	for offset: Vector3 in [
		Vector3(-1.15, 0, -2.4),
		Vector3(-0.55, 0, -3.1),
		Vector3(0.0, 0, -3.35),
		Vector3(0.55, 0, -3.1),
		Vector3(1.15, 0, -2.4),
	]:
		var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", shooter.position + offset)
		if enemy == null:
			failures.append("enemy spawn failed")
			continue
		enemy.hp = 100000.0
		enemy.max_hp = 100000.0
		enemy.visible = true
		enemy.think_left = 9999.0
		enemy.state_left = 9999.0
		enemy.attack_left = 9999.0
		enemy.target = null
		enemy.attack_target = null
		var hit_area := enemy.get_node_or_null("HitArea") as CollisionObject3D
		if hit_area != null:
			hit_area.collision_layer = 2
		enemies.append(enemy)

func _capture_sequence() -> void:
	# 0-2.5s: P9 single-shot muzzle and tracer.
	var p9 := _weapon(Registry.P9)
	shooter.equip(p9)
	for _shot in 5:
		_fire_at(enemies[2])
		if _shot == 1:
			await _capture("01_p9_fire.png")
		await _review_wait(0.45)

	# 2.5-6.5s: A21 controlled automatic fire.
	var a21 := _weapon(Registry.A21)
	shooter.equip(a21)
	for _shot in 14:
		# Use a diagonal target so the rifle's repeated tracer path remains readable in the group shot.
		_fire_at(enemies[4])
		if _shot == 6:
			await _capture("02_a21_tracer.png")
		await _review_wait(0.28)

	# 6.5-9.5s: S12 spread across the staged group.
	var s12 := _weapon(Registry.S12)
	s12.accuracy = 0.45
	shooter.equip(s12)
	for _shot in 3:
		_fire_at(enemies[2])
		if _shot == 1:
			await _capture("03_s12_multi_pellet.png")
		await _review_wait(0.85)

	# 9.5-13.5s: multiple targets remain on screen while feedback pulses.
	shooter.equip(_weapon(Registry.P9))
	for cycle in 8:
		_fire_at(enemies[cycle % enemies.size()])
		if cycle == 3:
			await _capture("04_multi_target_hit.png")
		await _review_wait(0.42)

	# Keep a clean contact sheet frame at the requested 10-15 second duration.
	while frame_index < 195:
		await _review_wait(FRAME_DT)

func _weapon(id: String) -> Resource:
	var definition: Resource = mission.catalog.by_id(mission.catalog.weapons, id).duplicate()
	definition.accuracy = 1.0 if id != Registry.S12 else definition.accuracy
	return definition

func _fire_at(target: Node3D) -> void:
	shooter.cooldown = 0.0
	shooter.combat.try_attack(shooter, mission, target.position, target)

func _review_wait(seconds: float) -> void:
	var frames := maxi(1, roundi(seconds * FPS))
	for _frame in frames:
		await process_frame
		_advance_review_effects(FRAME_DT)
		if DisplayServer.get_name() != "headless":
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(REVIEW_DIR.path_join("frames/frame_%04d.png" % frame_index))
		frame_index += 1

func _advance_review_effects(delta: float) -> void:
	if shooter != null and shooter.weapon_visual != null:
		shooter.weapon_visual.advance_flash(delta)
	for enemy: Node3D in enemies:
		if is_instance_valid(enemy) and enemy.hit_feedback != null:
			enemy.hit_feedback.advance(delta)

func _capture(name: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(REVIEW_DIR.path_join(name))
	screenshot_index += 1

func _set_review_camera(focus: Vector3, size: float) -> void:
	mission.camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	mission.camera.size = size
	# View from the target side so the muzzle, tracer and impact line share one readable silhouette.
	mission.camera.position = focus + Vector3(7.0, 7.0, -10.5)
	mission.camera.look_at(focus, Vector3.UP)

func _add_review_light() -> void:
	var light := DirectionalLight3D.new()
	light.name = "CombatVFXReviewLight"
	light.light_energy = 0.9
	light.light_color = Color("fff0d8")
	light.shadow_enabled = true
	light.rotation_degrees = Vector3(-52.0, -28.0, 0.0)
	mission.add_child(light)
	var fill := OmniLight3D.new()
	fill.name = "CombatVFXReviewFill"
	fill.light_color = Color("9fd7ff")
	fill.light_energy = 2.6
	fill.omni_range = 14.0
	fill.position = Vector3(0.0, 4.5, 1.5)
	mission.add_child(fill)

func _configure_review_environment() -> void:
	# Override only the review presentation lighting; game atmosphere and combat remain untouched.
	var environment: Environment = mission.atmosphere.environment
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("3f5c6a")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("b7c9d8")
	environment.ambient_light_energy = 0.88
	environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR

func _frames(count: int) -> void:
	for _index in count:
		await process_frame
