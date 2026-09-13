extends SceneTree
## Production runtime gate for optimized ENM_001 at 20/40/60 concurrent instances.

const RUNTIME_PATH: String = "res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k.glb"
const ID: String = "ENM_001_infected_basic_a"
var failures: Array[String] = []
var results: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var catalog: RefCounted = load("res://data/catalog.gd").new()
	for count: int in [20, 40, 60]:
		var mission: Node3D = load("res://missions/mission.gd").new()
		root.add_child(mission)
		mission.setup(catalog, load("res://core/run_ledger.gd").new(), PackedStringArray(["pistol", "pistol"]), 20260913 + count)
		mission.set_physics_process(false)
		mission.director_enabled = false
		mission.debug_clear_enemies()
		var origin: Vector3 = Vector3(-18.0, 0.0, -18.0)
		for i: int in count:
			var point := origin + Vector3(float(i % 10) * 4.0, 0.0, float(i / 10) * 4.0)
			var enemy: Node3D = mission.spawn_enemy(ID, point)
			check(enemy.rig.get_node("Model").scene_file_path == RUNTIME_PATH, "%d: runtime path" % count)
			var skeleton: Skeleton3D = find_node_of_type(enemy.rig.get_node("Model"), "Skeleton3D") as Skeleton3D
			var player: AnimationPlayer = find_node_of_type(enemy.rig.get_node("Model"), "AnimationPlayer") as AnimationPlayer
			check(skeleton != null and skeleton.get_bone_count() == 23, "%d: 23 bones" % count)
			check(player != null and player.has_animation(&"Zombie_Idle") and player.has_animation(&"Zombie_Walk") and player.has_animation(&"Zombie_Chase"), "%d: locomotion clips" % count)
		var first_mesh: MeshInstance3D = find_node_of_type(mission.enemies[0].rig.get_node("Model"), "MeshInstance3D") as MeshInstance3D
		var triangles: int = _triangle_count(first_mesh.mesh)
		var samples: Array[float] = []
		for frame: int in 60:
			var started: int = Time.get_ticks_usec()
			mission._physics_process(1.0 / 60.0)
			samples.append(float(Time.get_ticks_usec() - started) / 1000.0)
		samples.sort()
		results.append({"count": count, "triangles": triangles, "avg_ms": _average(samples), "p95_ms": samples[int(samples.size() * 0.95)]})
		mission.free()
	await process_frame
	var report: Dictionary = {"runtime_path": RUNTIME_PATH, "results": results, "failures": failures}
	FileAccess.open("res://test-output/enm_001_runtime_finalization.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print(JSON.stringify(report, "\t"))
	quit(0 if failures.is_empty() else 1)

func check(value: bool, message: String) -> void:
	if not value:
		failures.append(message)
		push_error(message)

func find_node_of_type(node: Node, type_name: String) -> Node:
	if node.is_class(type_name):
		return node
	for child: Node in node.get_children():
		var found: Node = find_node_of_type(child, type_name)
		if found != null:
			return found
	return null

func _triangle_count(mesh: Mesh) -> int:
	if mesh == null or mesh.get_surface_count() == 0:
		return 0
	var indices: PackedInt32Array = mesh.surface_get_arrays(0)[Mesh.ARRAY_INDEX]
	return indices.size() / 3 if not indices.is_empty() else int(mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX].size() / 3)

func _average(values: Array[float]) -> float:
	var total: float = 0.0
	for value: float in values:
		total += value
	return total / maxf(1.0, float(values.size()))
