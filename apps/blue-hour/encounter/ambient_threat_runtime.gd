extends Node
## Medium Town adapter for the existing Encounter, Enemy and Noise systems.
## It owns no mission, search or combat state.

const ENEMY_ID: String = "ENM_001_infected_basic_a"
const DAY_ONE_MIN: int = 8
const DAY_ONE_MAX: int = 12
const SPAWN_SAFE_RADIUS: float = 25.0
const SPAWN_SPACING: float = 1.2
const SEARCH_NOISE_INTERVAL: float = 1.0
const SEARCH_COMPLETE_MULTIPLIER: float = 1.5

var mission: Node3D
var rng := RandomNumberGenerator.new()
var runtime_ready: bool = false
var initial_spawned: int = 0
var search_noise_timers: Dictionary = {}
var search_noise_events: int = 0
var search_complete_events: int = 0
var last_search_event: RefCounted
var update_count: int = 0
var update_usec: int = 0

func setup(target: Node3D) -> void:
	mission = target
	rng.seed = int(mission.rng.seed) ^ 0x414d4249
	mission.search_completed.connect(_on_search_completed)
	if mission.town_runtime_ready:
		if mission.survivor_commands_enabled or mission.city.navigation.ready:
			_activate_town()
		else:
			mission.navigation_ready.connect(_activate_town, CONNECT_ONE_SHOT)
	else:
		runtime_ready = true

func _physics_process(delta: float) -> void:
	if not is_instance_valid(mission) or not mission.active:
		return
	var started: int = Time.get_ticks_usec()
	if mission.town_runtime_ready:
		if not runtime_ready:
			return
		mission.noise.advance(delta)
		for enemy: Node3D in mission.enemies.duplicate():
			if enemy.active:
				enemy.refresh_stats(mission.clock)
				enemy.tick(delta, mission)
			else:
				mission._retire_enemy(enemy)
	_advance_search_noise(delta)
	update_count += 1
	update_usec += Time.get_ticks_usec() - started

func _activate_town() -> void:
	if runtime_ready:
		return
	runtime_ready = true
	if mission.enemies.is_empty():
		_seed_day_one_population()

func _seed_day_one_population() -> void:
	var target: int = rng.randi_range(DAY_ONE_MIN, DAY_ONE_MAX)
	var roads: Array = mission.runtime_data.get("road_bounds", [])
	var bounds: Rect2 = mission.runtime_data.get("town_bounds", Rect2())
	for attempt: int in range(target * 120):
		if initial_spawned >= target:
			break
		var flat: Vector2
		if not roads.is_empty() and attempt % 4 != 3:
			var road: Rect2 = roads[rng.randi_range(0, roads.size() - 1)]
			flat = Vector2(rng.randf_range(road.position.x, road.end.x), rng.randf_range(road.position.y, road.end.y))
		else:
			flat = Vector2(rng.randf_range(bounds.position.x, bounds.end.x), rng.randf_range(bounds.position.y, bounds.end.y))
		var point: Vector3 = mission.city.nearest_open(Vector3(flat.x, 0, flat.y))
		if not _valid_spawn(point):
			continue
		var enemy: Node3D = mission.spawn_enemy(ENEMY_ID, point)
		if enemy == null:
			continue
		enemy.set_meta("encounter_origin", "ambient_day_one")
		initial_spawned += 1
	if initial_spawned < DAY_ONE_MIN:
		push_warning("[AmbientThreat] Only %d/%d safe Day 1 infected positions resolved" % [initial_spawned, target])

func _valid_spawn(point: Vector3) -> bool:
	if not point.is_finite() or not mission.city.navigation.point_clear(point):
		return false
	if point.distance_to(mission.runtime_data.arrival_point) < SPAWN_SAFE_RADIUS:
		return false
	for member: Node3D in mission.survivors:
		if not member.dead and point.distance_to(member.position) < SPAWN_SAFE_RADIUS:
			return false
	for enemy: Node3D in mission.enemies:
		if enemy.active and point.distance_to(enemy.position) < SPAWN_SPACING:
			return false
	return not mission.city.path(point, mission.squad_center()).is_empty()

func _advance_search_noise(delta: float) -> void:
	var active_ids: Dictionary = {}
	for id: String in mission.search_tasks:
		var task: RefCounted = mission.search_tasks[id]
		if not bool(task.get("search_started")):
			continue
		active_ids[id] = true
		var left: float = float(search_noise_timers.get(id, SEARCH_NOISE_INTERVAL)) - delta
		if left <= 0.0:
			_emit_search_noise(id, false, task.get("worker") as Node)
			left += SEARCH_NOISE_INTERVAL
		search_noise_timers[id] = left
	for id: String in search_noise_timers.keys():
		if not active_ids.has(id):
			search_noise_timers.erase(id)

func _on_search_completed(id: String, _worker_name: String, _loot: Dictionary) -> void:
	_emit_search_noise(id, true)

func _emit_search_noise(id: String, completed: bool, source: Node = null) -> void:
	if not is_instance_valid(mission) or not mission.city.sites.has(id):
		return
	var site: Dictionary = mission.city.sites[id]
	var radius: float = _search_noise_radius(site)
	var type: int = mission.noise.Event.NoiseType.SEARCH_COMPLETE if completed else mission.noise.Event.NoiseType.SEARCH
	last_search_event = mission.noise.emit_noise(site.spec.entry,
		radius * (SEARCH_COMPLETE_MULTIPLIER if completed else 1.0), type,
		1.15 if completed else 1.0, source)
	if completed:
		search_complete_events += 1
	else:
		search_noise_events += 1

func _search_noise_radius(site: Dictionary) -> float:
	if bool(site.get("vehicle", false)):
		return 8.0
	var spec: Dictionary = site.spec
	var kind: String = str(spec.get("search_kind", ""))
	var poi: String = str(spec.get("poi_type", ""))
	var category: String = str(spec.get("category", ""))
	return 12.0 if kind == "large" or poi == "warehouse" or category in ["industrial", "special"] else 5.0

func performance() -> Dictionary:
	return {"updates": update_count, "total_ms": update_usec / 1000.0,
		"average_ms": update_usec / (1000.0 * maxi(1, update_count)),
		"initial_spawned": initial_spawned, "search_noise_events": search_noise_events,
		"search_complete_events": search_complete_events}
