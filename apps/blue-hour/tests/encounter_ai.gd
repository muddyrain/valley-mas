extends SceneTree
var failures: Array[String] = []
var checks: int = 0
var mission: Node3D

func _initialize() -> void:
	run.call_deferred()

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	var catalog: RefCounted = load("res://data/catalog.gd").new()
	mission = load("res://missions/mission.gd").new()
	root.add_child(mission)
	var loadout: Array[String] = ["pistol"]
	mission.setup(catalog, load("res://core/run_ledger.gd").new(), loadout, 701)
	mission.set_physics_process(false)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(0, 0, -35))
	var start: Vector3 = enemy.position
	var moved: bool = false
	var stopped_after_moving: bool = false
	var previous: Vector3 = start
	for frame: int in range(600):
		enemy.tick(1.0 / 30.0, mission)
		moved = moved or enemy.position.distance_to(start) > 0.5
		stopped_after_moving = stopped_after_moving or (moved and previous.is_equal_approx(enemy.position))
		previous = enemy.position
		check(not mission.city.grid.is_point_solid(mission.city.cell_at(enemy.position)), "Wander stays on navigation")
	check(moved, "Unaware infected wanders without acquiring a survivor")
	check(stopped_after_moving, "Wandering alternates movement and idle pauses")
	check(enemy.target == null, "Distant squad is not revealed by population spawn")
	var member: Node3D = mission.survivors[0]
	member.position = Vector3(0, 0, 10)
	member.stop()
	enemy.reset_for_spawn(0, mission.clock)
	enemy.position = Vector3(0, 0, 0)
	enemy.rig.rotation.y = 0
	enemy.tick(0, mission)
	check(enemy.target == null, "A survivor behind the visual cone is not acquired")
	enemy.rig.rotation.y = PI
	mission.city.grid.set_point_solid(Vector2i(0, 5), true)
	enemy.think_left = 0
	enemy.tick(0, mission)
	check(enemy.target == null, "Wall blocks visual acquisition")
	mission.city.grid.set_point_solid(Vector2i(0, 5), false)
	enemy.think_left = 0
	enemy.tick(0, mission)
	check(enemy.target == member, "Unobstructed survivor inside cone is acquired")
	mission.city.grid.set_point_solid(Vector2i(0, 5), true)
	member.position = Vector3(5, 0, 12)
	# Solid strip prevents every alternative ray, while the actor remembers the old point.
	for x: int in range(-2, 9):
		mission.city.grid.set_point_solid(Vector2i(x, 5), true)
	enemy.think_left = 0
	enemy.tick(0.1, mission)
	check(enemy.path.is_empty() or enemy.path[-1].distance_to(member.position) > 2, "Hidden target coordinates do not update pursuit")
	member.position = Vector3(0, 0, 50)
	for frame: int in range(150):
		enemy.tick(1.0 / 30.0, mission)
	check(enemy.target == null, "Lost visual target expires after a bounded memory")
	for x: int in range(-2, 9):
		mission.city.grid.set_point_solid(Vector2i(x, 5), false)
	enemy.take_damage(999)
	var death_position: Vector3 = enemy.position
	enemy.tick(10, mission)
	check(not enemy.active and enemy.position == death_position, "Dead infected cannot move")
	mission.free()
	await process_frame
	print("ENCOUNTER AI: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
