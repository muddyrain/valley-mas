extends SceneTree
## Production population must exist before the first simulation tick.
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	run.call_deferred()

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	for seed_value: int in [319762786, 20260912, 701]:
		var catalog: RefCounted = load("res://data/catalog.gd").new()
		var mission: Node3D = load("res://missions/mission.gd").new()
		root.add_child(mission)
		var loadout: Array[String] = ["pistol", "smg", "crowbar"]
		mission.setup(catalog, load("res://core/run_ledger.gd").new(), loadout, seed_value)
		mission.set_physics_process(false)
		check(mission.enemies.size() >= 18 and mission.enemies.size() <= 30, "18-30 infected present on load, seed %d (actual %d)" % [seed_value, mission.enemies.size()])
		var nearby: int = 0
		var remote: int = 0
		for enemy: Node3D in mission.enemies:
			check(enemy.data.id == "ENM_001_infected_basic_a", "Reuses the sole production infected")
			check(not mission.city.grid.is_point_solid(mission.city.cell_at(enemy.position)), "Spawn occupies walkable navigation")
			check(enemy.position.y == 0, "Spawn is grounded")
			var route: PackedVector3Array = mission.city.path(enemy.position, catalog.map.bus_position)
			check(not route.is_empty(), "Spawn connects to the squad navigation component")
			for member: Node3D in mission.survivors:
				check(enemy.position.distance_to(member.position) >= 14, "Spawn respects survivor safety radius")
			for other: Node3D in mission.enemies:
				if other != enemy:
					check(enemy.position.distance_to(other.position) >= 1.1, "Spawned bodies do not overlap")
			var distance: float = enemy.position.distance_to(catalog.map.bus_position)
			nearby += int(distance <= catalog.map.encounter.arrival_noise_radius)
			remote += int(distance > 40)
		check(nearby >= 3 and nearby <= 6, "Small local arrival group")
		check(remote > 0, "Remote population exists independently")
		mission.free()
		await process_frame
	print("ENCOUNTER POPULATION: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
