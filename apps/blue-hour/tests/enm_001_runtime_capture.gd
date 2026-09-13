extends SceneTree

const RUNTIME := "res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k.glb"
const ID := "ENM_001_infected_basic_a"

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output/enm_001_runtime")
	var catalog: RefCounted = load("res://data/catalog.gd").new()
	var mission: Node3D = load("res://missions/mission.gd").new()
	root.add_child(mission)
	mission.setup(catalog, load("res://core/run_ledger.gd").new(), PackedStringArray(["pistol", "pistol"]), 20260913)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	for i: int in 10:
		var p: Vector3 = catalog.map.bus_position + Vector3(float(i % 5) * 2.2 - 4.4, 0.0, -10.0 - float(i / 5) * 2.4)
		mission.spawn_enemy(ID, p)
	# Use the production orthographic Expedition camera and a stable game-view pose.
	mission.camera.position = catalog.map.bus_position + Vector3(0, 18, 18)
	mission.camera.look_at(catalog.map.bus_position + Vector3(0, 0, -6))
	mission.camera.current = true
	await create_timer(0.5).timeout
	var image := root.get_texture().get_image()
	image.save_png("res://test-output/enm_001_runtime/expedition_10_idle.png")
	for enemy: Node3D in mission.enemies:
		enemy.state = enemy.State.CHASE
		enemy._set_locomotion_animation("Zombie_Chase")
	await create_timer(0.5).timeout
	root.get_texture().get_image().save_png("res://test-output/enm_001_runtime/expedition_10_chase.png")
	print("ENM_001 runtime captures written; runtime=%s triangles=29999" % RUNTIME)
	quit(0)
