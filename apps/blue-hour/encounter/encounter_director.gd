extends RefCounted
## Population placement uses the same collision-derived navigation as combat.
const ENEMY_ID: String = "ENM_001_infected_basic_a"
var config: Resource
var rng := RandomNumberGenerator.new()
var initial_spawned: int = 0
var daytime_spawned: int = 0
var blue_hour_spawned: int = 0
var spawn_history: Array[Dictionary] = []
var edge_cursor: int = 0

func setup(settings: Resource, seed_value: int) -> void:
	config = settings
	rng.seed = seed_value ^ 0x454e43
	edge_cursor = rng.randi_range(0, 3)

func advance(delta: float, mission: Node3D) -> void:
	mission.spawn_left -= delta
	if mission.spawn_left > 0:
		return
	mission.spawn_left = mission.clock.spawn_interval()
	var alive: int = 0
	for enemy: Node3D in mission.enemies:
		alive += int(enemy.active)
	var count: int = mini(config.daytime_respawn_batch, config.daytime_min_population - alive)
	var horde: bool = mission.clock.phase != mission.clock.DAY
	if horde:
		count = config.blue_hour_spawn_batch
	count = mini(count, config.population_limit - alive)
	var group_anchor := Vector3.INF
	for i: int in range(maxi(0, count)):
		if not horde or i % 2 == 0:
			group_anchor = Vector3.INF
		var enemy: Node3D = spawn_at_edge(mission, group_anchor)
		if enemy != null:
			group_anchor = enemy.position
			if horde:
				blue_hour_spawned += 1
				enemy.set_meta("encounter_origin", "horde")
				var anchor: Vector3 = mission.squad_center()
				if mission.noise.elapsed - mission.noise.last_loud_time <= config.noise_memory_seconds:
					anchor = mission.noise.last_loud_position
				elif rng.randf() < 0.25:
					anchor = mission.catalog.map.bus_position
				enemy.investigate(mission.city.nearest_open(anchor + _offset(3, config.horde_interest_radius)))
			else:
				daytime_spawned += 1

func hidden_spawn(mission: Node3D, point: Vector3) -> bool:
	if mission.exploration != null and mission.exploration.is_visible(point):
		return false
	var rect: Rect2 = mission.get_viewport().get_visible_rect().grow(config.offscreen_margin)
	# Test the actor's whole height and a screen margin, not just its feet.
	for offset: Vector3 in [Vector3(-0.5, 0, -0.5), Vector3(0.5, 0, 0.5), Vector3(-0.5, 2, -0.5), Vector3(0.5, 2, 0.5)]:
		var sample := point + offset
		if not mission.camera.is_position_behind(sample) and rect.has_point(mission.camera.unproject_position(sample)):
			return false
	return true

func spawn_at_edge(mission: Node3D, group_anchor: Vector3 = Vector3.INF) -> Node3D:
	var width: float = mission.catalog.map.half_width - config.edge_inset
	var depth: float = mission.catalog.map.half_depth - config.edge_inset
	for attempt: int in range(config.spawn_attempts):
		var side: int = (edge_cursor + attempt) % 4
		var candidate := Vector3.ZERO
		match side:
			0: candidate = Vector3(-width, 0, rng.randf_range(-depth, depth))
			1: candidate = Vector3(width, 0, rng.randf_range(-depth, depth))
			2: candidate = Vector3(rng.randf_range(-width, width), 0, -depth)
			3: candidate = Vector3(rng.randf_range(-width, width), 0, depth)
		if group_anchor.is_finite() and attempt < 16:
			candidate = group_anchor + _offset(config.spawn_spacing, 3.0)
			side = posmod(edge_cursor - 1, 4)
		var point: Vector3 = mission.city.nearest_open(candidate)
		if point.distance_to(candidate) > 2 or not hidden_spawn(mission, point) or not valid_spawn(mission, point):
			continue
		var enemy: Node3D = mission.spawn_enemy(ENEMY_ID, point)
		if enemy != null:
			edge_cursor = (side + 1) % 4
			spawn_history.append({"position": point, "category": "edge", "side": side, "time": mission.action_elapsed})
			if spawn_history.size() > 128:
				spawn_history.pop_front()
		return enemy
	return null

func seed_population(mission: Node3D) -> void:
	var total := rng.randi_range(config.initial_zombie_min, config.initial_zombie_max)
	var bus: Vector3 = mission.catalog.map.bus_position
	for i: int in range(mini(config.arrival_population, total)):
		for attempt: int in range(config.spawn_attempts):
			var candidate := bus + _offset(config.arrival_spawn_min, config.arrival_spawn_max)
			if _spawn(mission, candidate, "arrival") != null:
				break
	# Streets supply small groups; only a subset of entrances gets a group.
	var groups: int = 0
	while initial_spawned < total and groups < config.spawn_attempts:
		groups += 1
		var anchor: Vector3
		var category: String
		if groups % 3 == 0 and not mission.city.sites.is_empty():
			var keys: Array = mission.city.sites.keys()
			anchor = mission.city.sites[keys[rng.randi_range(0, keys.size() - 1)]].spec.entry
			category = "building"
		else:
			var roads: Array = mission.catalog.map.road_segments
			var road: Dictionary = roads[rng.randi_range(0, roads.size() - 1)]
			var start := Vector3(road.start.x, 0, road.start.y)
			var end := Vector3(road.end.x, 0, road.end.y)
			anchor = start.lerp(end, rng.randf())
			category = "street" if groups % 3 == 1 else "remote"
		if anchor.distance_to(bus) < config.arrival_noise_radius + config.wander_radius:
			continue
		var count: int = mini(total - initial_spawned, rng.randi_range(2, 5) if category == "street" else rng.randi_range(1, 3))
		for i: int in range(count):
			for attempt: int in range(12):
				var candidate: Vector3 = anchor + _offset(0.5, 4.0)
				if candidate.distance_to(bus) <= config.arrival_noise_radius:
					continue
				if _spawn(mission, candidate, category) != null:
					break

func _offset(minimum: float, maximum: float) -> Vector3:
	var angle := rng.randf_range(-PI, PI)
	return Vector3(cos(angle), 0, sin(angle)) * rng.randf_range(minimum, maximum)

func valid_spawn(mission: Node3D, point: Vector3) -> bool:
	var cell: Vector2i = mission.city.cell_at(point)
	if not mission.city.grid.is_in_boundsv(cell) or mission.city.grid.is_point_solid(cell):
		return false
	if point.distance_to(mission.catalog.map.bus_position) < config.spawn_safe_radius:
		return false
	for member: Node3D in mission.survivors:
		if not member.dead and member.position.distance_to(point) < config.spawn_safe_radius:
			return false
	for enemy: Node3D in mission.enemies:
		if enemy.active and enemy.position.distance_to(point) < config.spawn_spacing:
			return false
	var route: PackedVector3Array = mission.city.path(point, mission.catalog.map.bus_position)
	return not route.is_empty()

func _spawn(mission: Node3D, candidate: Vector3, category: String) -> Node3D:
	var point: Vector3 = mission.city.nearest_open(candidate)
	if point.distance_to(candidate) > 2.0 or not valid_spawn(mission, point):
		return null
	var enemy: Node3D = mission.spawn_enemy(ENEMY_ID, point)
	if enemy != null:
		initial_spawned += 1
		enemy.set_meta("encounter_origin", category)
		spawn_history.append({"position": point, "category": category})
	return enemy
