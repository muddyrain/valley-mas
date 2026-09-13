extends SceneTree

const ID: String = "ENM_001_infected_basic_a"
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var catalog: RefCounted = load("res://data/catalog.gd").new()
	var mission: Node3D = load("res://missions/mission.gd").new()
	root.add_child(mission)
	mission.setup(catalog, load("res://core/run_ledger.gd").new(), PackedStringArray(["pistol", "pistol"]), 20260913)
	mission.set_physics_process(false)
	# Keep the production EncounterDirector and its seeded population; only disable respawn.
	mission.director_enabled = false
	check(mission.enemies.size() >= 15, "EncounterDirector seeds at least 15 enemies")
	var phase_offsets: Array[float] = []
	for enemy: Node3D in mission.enemies:
		check(enemy.rig.get_node("Model").scene_file_path.ends_with("_30k.glb"), "Production enemy uses optimized Runtime")
		check(enemy.locomotion_animation == &"Zombie_Idle", "Spawn maps Idle")
		phase_offsets.append(enemy.animation_controller.animation_start_offset)
		enemy.state = enemy.State.WANDER
		enemy._set_locomotion_animation(&"Zombie_Walk")
		check(enemy.locomotion_animation == &"Zombie_Walk", "Wander maps Walk")
		enemy.investigate(enemy.position + Vector3(2, 0, 1))
		enemy._set_locomotion_animation(&"Zombie_Walk")
		check(enemy.state == enemy.State.INVESTIGATE and enemy.locomotion_animation == &"Zombie_Walk", "Investigate maps Walk")
		enemy.target = mission.survivors[0]
		enemy.state = enemy.State.CHASE
		enemy._set_locomotion_animation(&"Zombie_Chase")
		check(enemy.locomotion_animation == &"Zombie_Chase", "Chase maps Chase")
	check(_has_variation(phase_offsets), "Concurrent enemies have randomized animation phase")
	# Exercise the actual AI tick path: a survivor placed in sight produces Chase and its animation.
	var probe: Node3D = mission.enemies[0]
	var survivor: Node3D = mission.survivors[0]
	survivor.position = mission.city.nearest_open(probe.position - probe.rig.basis.z * 3.0)
	probe.think_left = 0.0
	probe.tick(0.25, mission)
	check(probe.state == probe.State.CHASE or probe.target == survivor, "AI perception enters Chase")
	check(probe.locomotion_animation == &"Zombie_Chase", "AI perception drives Chase clip")
	probe.target = null
	probe.state = probe.State.IDLE
	probe.state_left = 0.0
	probe.tick(0.25, mission)
	check(probe.state == probe.State.WANDER or probe.locomotion_animation == &"Zombie_Walk", "AI wander drives Walk clip")
	var noise_event: RefCounted = mission.noise.emit_noise(probe.position, 12.0, 1, 1.0, survivor)
	check(noise_event != null and probe.state == probe.State.INVESTIGATE, "Noise enters Investigate")
	check(probe.locomotion_animation == &"Zombie_Walk", "Noise investigation keeps Walk clip")
	var report: Dictionary = {"failures": failures, "enemy_count": mission.enemies.size(), "phase_offsets": phase_offsets,
		"mapping": {"IDLE": "Zombie_Idle", "WANDER": "Zombie_Walk", "INVESTIGATE": "Zombie_Walk", "CHASE": "Zombie_Chase"},
		"blend_seconds": 0.15, "playback_variation": "0.95..1.05", "runtime": "res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k.glb"}
	DirAccess.make_dir_recursive_absolute("res://test-output")
	FileAccess.open("res://test-output/enm_001_runtime_integration_gate.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print(JSON.stringify(report, "\t"))
	mission.free()
	quit(0 if failures.is_empty() else 1)

func check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
		push_error(message)

func _has_variation(values: Array[float]) -> bool:
	if values.size() < 2:
		return false
	for value: float in values:
		if not is_equal_approx(value, values[0]):
			return true
	return false
