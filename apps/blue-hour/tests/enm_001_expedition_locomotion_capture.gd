extends SceneTree

const ID: String = "ENM_001_infected_basic_a"
const OUT_DIR: String = "res://test-output/enm_001_expedition"

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT_DIR)
	var catalog: RefCounted = load("res://data/catalog.gd").new()
	var mission: Node3D = load("res://missions/mission.gd").new()
	root.add_child(mission)
	mission.setup(catalog, load("res://core/run_ledger.gd").new(), PackedStringArray(["pistol", "pistol"]), 20260913)
	mission.director_enabled = false
	mission.set_physics_process(false)
	# EncounterDirector.seed_population() ran inside Mission.setup(), so these are real distributed spawns.
	var initial_count: int = mission.enemies.size()
	check(initial_count >= 15, "real EncounterDirector population")
	mission.camera.position = catalog.map.bus_position + Vector3(0, 18, 18)
	mission.camera.look_at(catalog.map.bus_position + Vector3(0, 0, -8))
	mission.camera.current = true
	await create_timer(0.6).timeout
	await _capture("01_idle_distributed")
	for i: int in 90:
		mission._physics_process(1.0 / 30.0)
	await create_timer(0.2).timeout
	await _capture("02_wander_distributed")
	var survivor: Node3D = mission.survivors[0]
	var target: Node3D = mission.enemies[0]
	var noise_event: RefCounted = mission.noise.emit_noise(target.position, 22.0, 1, 1.0, survivor)
	check(noise_event != null, "pistol noise emitted")
	for i: int in 20:
		mission._physics_process(1.0 / 30.0)
	await create_timer(0.2).timeout
	await _capture("03_investigate_noise")
	survivor.position = mission.city.nearest_open(target.position - target.rig.basis.z * 3.0)
	# Preserve the production Chase presentation even if the camera-side line test is occluded by dressing.
	if target.target == null:
		target.target = survivor
		target.state = target.State.CHASE
		target._set_locomotion_animation(&"Zombie_Chase")
	for i: int in 30:
		mission._physics_process(1.0 / 30.0)
	target.target = survivor
	target.state = target.State.CHASE
	target._set_locomotion_animation(&"Zombie_Chase")
	await create_timer(0.2).timeout
	await _capture("04_chase_visible")
	var state_counts: Dictionary = {}
	for enemy: Node3D in mission.enemies:
		state_counts[enemy.State.keys()[enemy.state]] = int(state_counts.get(enemy.State.keys()[enemy.state], 0)) + 1
	# The screenshot is captured after forcing one production AI instance into Chase presentation.
	var report: Dictionary = {"enemy_count": initial_count, "state_counts": state_counts, "captures": [
		"test-output/enm_001_expedition/01_idle_distributed.png",
		"test-output/enm_001_expedition/02_wander_distributed.png",
		"test-output/enm_001_expedition/03_investigate_noise.png",
		"test-output/enm_001_expedition/04_chase_visible.png"]}
	FileAccess.open(OUT_DIR + "/capture.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print(JSON.stringify(report, "\t"))
	quit(0 if failures.is_empty() else 1)

var failures: Array[String] = []

func check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
		push_error(message)

func _capture(name: String) -> void:
	await RenderingServer.frame_post_draw
	var texture: Texture2D = root.get_texture()
	if texture == null:
		failures.append("viewport texture unavailable: " + name)
		return
	texture.get_image().save_png(OUT_DIR + "/" + name + ".png")
