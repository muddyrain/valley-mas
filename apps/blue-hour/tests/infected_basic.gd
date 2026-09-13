extends SceneTree
## Exercises the production mission and enemy scene; no separate gameplay scene.

const ID: String = "ENM_001_infected_basic_a"
const MODEL: String = "res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k.glb"
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func near(value: float, expected: float, message: String) -> void:
	check(absf(value - expected) < 0.0001, "%s: %.6f / %.6f" % [message, value, expected])

func run() -> void:
	create_timer(60).timeout.connect(func(): printerr("INFECTED TEST TIMEOUT"); quit(2))
	var catalog: RefCounted = load("res://data/catalog.gd").new()
	check(catalog.enemies.size() == 1, "Only one common infected is registered")
	var definition: Resource = catalog.by_id(catalog.enemies, ID)
	check(definition != null, "Formal infected definition is registered")
	if definition == null:
		finish()
		return
	var expected: Dictionary = {"max_hp": 30.0, "move_speed": 2.0, "attack_damage": 8.0,
		"attack_range": 0.9, "attack_cooldown": 1.2, "attack_windup": 0.35,
		"collision_radius": 0.32,
		"knockback_resistance": 0.1, "xp_reward": 1}
	for field: String in expected:
		near(float(definition.get(field)), float(expected[field]), "Base " + field)
	check(definition.display_name == "普通感染者" and definition.enemy_type == "COMMON", "Common infected identity")
	var mission: Node3D = load("res://missions/mission.gd").new()
	root.add_child(mission)
	var loadout: Array[String] = ["pistol"]
	mission.setup(catalog, load("res://core/run_ledger.gd").new(), loadout, 20260912)
	mission.set_physics_process(false)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var phase_hp: Array[float] = [30.0, 31.5, 34.5]
	var phase_damage: Array[float] = [8.0, 8.8, 10.0]
	var phase_spawn: Array[float] = [1.0, 2.5, 2.5]
	for phase: int in range(3):
		mission.clock.set_phase(phase)
		var actor: Node3D = mission.spawn_enemy(ID, Vector3(0, 0, 10))
		near(actor.max_hp, phase_hp[phase], "Phase max HP")
		near(actor.attack_damage, phase_damage[phase], "Phase damage")
		near(mission.clock.spawn_multiplier(), phase_spawn[phase], "Phase spawn density")
		mission.debug_clear_enemies()
	mission.clock.advance(catalog.map.night_threat_seconds * 4)
	var enemy: Node3D = mission.spawn_enemy(ID, Vector3(0, 0, 10))
	check(mission.clock.enemy_threat_level() == 5, "Original Night clock supplies Threat Level 5")
	near(enemy.max_hp, 45.54, "Level 5 Night HP")
	near(enemy.attack_damage, 12.0, "Level 5 Night damage")
	enemy.take_damage(enemy.max_hp * 0.5)
	mission.clock.set_phase(mission.clock.DAY)
	near(enemy.hp, 15.0, "Phase changes preserve wounded health ratio")
	near(enemy.max_hp, 30.0, "Existing enemy refreshes max HP")
	check(enemy.scene_file_path == definition.scene.resource_path, "Spawn instantiates the definition's production scene")
	var model: Node3D = enemy.rig.get_node("Model")
	check(model.scene_file_path == MODEL, "Only the supplied GLB is rendered")
	var skeleton: Skeleton3D = find_node_of_type(model, "Skeleton3D") as Skeleton3D
	var player: AnimationPlayer = find_node_of_type(model, "AnimationPlayer") as AnimationPlayer
	check(skeleton != null and skeleton.get_bone_count() == 23, "Production enemy uses the 23-bone runtime rig")
	check(player != null and player.has_animation(&"Zombie_Idle") and player.has_animation(&"Zombie_Walk") and player.has_animation(&"Zombie_Chase"), "Production enemy embeds all locomotion clips")
	var bounds: AABB
	var first: bool = true
	for mesh: MeshInstance3D in model.find_children("*", "MeshInstance3D", true, false):
		var box: AABB = (enemy.global_transform.affine_inverse() * mesh.global_transform) * mesh.get_aabb()
		bounds = box if first else bounds.merge(box)
		first = false
	check(not first, "Formal model contains actual render geometry")
	near(bounds.size.y, 1.65, "Instantiated model height is 1.65 metres")
	near(bounds.position.y, 0.0, "Feet rest on the ground")
	near(enemy.get_node("HitArea/CollisionShape3D").shape.radius, 0.32, "Picking collision uses definition radius")
	var member: Node3D = mission.survivors[0]
	member.position = Vector3(0, 0, 10)
	member.stop()
	member.hp = member.data.max_hp
	enemy.reset_for_spawn(0, mission.clock)
	enemy.position = member.position + Vector3(0, 0, -15)
	enemy.rig.rotation.y = PI
	enemy.tick(0, mission)
	check(enemy.target == null, "No acquisition beyond detection range")
	enemy.position = member.position + Vector3(0, 0, -11)
	enemy.think_left = 0
	enemy.tick(0, mission)
	check(enemy.target == member and not enemy.path.is_empty(), "Existing navigation acquires a survivor in range")
	var start: Vector3 = enemy.position
	enemy.tick(0.25, mission)
	near(start.distance_to(enemy.position), 0.5, "Movement consumes definition speed at two metres per second")
	enemy.position = member.position + Vector3(0, 0, -17)
	enemy.think_left = 0
	enemy.tick(0, mission)
	check(enemy.target == member, "Chase persists between detection and lose ranges")
	enemy.position = member.position + Vector3(0, 0, -19)
	enemy.tick(mission.catalog.map.encounter.target_memory_seconds + .01, mission)
	check(enemy.target == null, "Lost visual contact expires into investigation")
	mission.clock.set_phase(mission.clock.NIGHT)
	enemy.position = member.position + Vector3(0, 0, -21)
	enemy.think_left = 0
	enemy.tick(0, mission)
	check(enemy.target == null, "Night still respects its enhanced finite visual range")
	mission.clock.set_phase(mission.clock.DAY)
	enemy.position = member.position + Vector3(0, 0, -0.8)
	enemy.think_left = 0
	var hp: float = member.hp
	enemy.tick(0, mission)
	enemy.tick(0.34, mission)
	near(member.hp, hp, "Attack windup does not damage early")
	enemy.tick(0.01, mission)
	near(hp - member.hp, 8.0 * member.talent.incoming_damage_multiplier, "Attack hits after 0.35 seconds")
	hp = member.hp
	enemy.tick(0.84, mission)
	near(member.hp, hp, "Attack cooldown blocks repeated damage")
	enemy.tick(0.01, mission)
	enemy.tick(0.34, mission)
	near(member.hp, hp, "Next attack still requires its full windup")
	enemy.tick(0.01, mission)
	check(member.hp < hp, "Next hit follows the configured attack cycle")
	enemy.reset_for_spawn(0, mission.clock)
	enemy.tick(0, mission)
	member.position += Vector3(0, 0, 2)
	hp = member.hp
	enemy.tick(0.35, mission)
	near(member.hp, hp, "Moving out of range during windup avoids the hit")
	enemy.position = Vector3(0, 0, 0)
	member.position = Vector3(0, 0, 0.8)
	enemy.reset_for_spawn(0, mission.clock)
	enemy.tick(0, mission)
	var cell: Vector2i = mission.city.cell_at((member.position + enemy.position) * 0.5)
	mission.city.grid.set_point_solid(cell, true)
	hp = member.hp
	enemy.tick(0.35, mission)
	near(member.hp, hp, "Cover appearing during windup prevents damage")
	mission.city.grid.set_point_solid(cell, false)
	for pooled: Node3D in mission.enemy_pool:
		pooled.free()
	mission.enemy_pool.clear()
	enemy.reset_for_spawn(0, mission.clock)
	enemy.tick(0, mission)
	check(enemy.attack_target != null, "Pool fixture dies during a committed windup")
	enemy.take_damage(999)
	mission._retire_enemy(enemy)
	mission.clock.set_phase(mission.clock.NIGHT)
	mission.clock.advance(catalog.map.night_threat_seconds * 2)
	var recycled: Node3D = mission.spawn_enemy(ID, Vector3(0, 0, 12))
	check(recycled == enemy, "Existing object pool reuses the enemy scene")
	near(recycled.hp, 40.02, "Recycled enemy gets current Threat Level 3 Night HP")
	near(recycled.attack_damage, 11.0, "Recycled enemy gets current damage")
	check(recycled.windup_left == 0 and recycled.attack_target == null and recycled.attack_left == 0, "Pool resets pending attack and cooldown")
	check(recycled.get_node("HitArea").collision_layer == 2, "Pool restores enemy picking")
	for field: String in expected:
		near(float(definition.get(field)), float(expected[field]), "Shared base remains unchanged: " + field)
	mission.free()
	await process_frame
	finish()

func finish() -> void:
	print("INFECTED BASIC: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func find_node_of_type(node: Node, type_name: String) -> Node:
	if node.is_class(type_name):
		return node
	for child: Node in node.get_children():
		var found: Node = find_node_of_type(child, type_name)
		if found != null:
			return found
	return null
