extends Node3D
signal completed(result: Dictionary)
signal notice(text: String)
signal search_completed(id: String, worker_name: String, loot: Dictionary)
signal search_cancelled(id: String)
signal search_loot_collected(id: String, worker_name: String, loot: Dictionary)
signal watch_warning_changed(active: bool)
signal navigation_ready
signal command_rejected(reason: String)
const City = preload("res://maps/city.gd")
const Survivor = preload("res://survivors/survivor.gd")
const Clock = preload("res://time/mission_clock.gd")
const Atmosphere = preload("res://blue_hour/atmosphere.gd")
const Visuals = preload("res://vfx/visuals.gd")
const Soundscape = preload("res://audio/soundscape.gd")
const SearchTask = preload("res://missions/search_task.gd")
const SquadInput = preload("res://missions/squad_input.gd")
const ExpeditionCamera = preload("res://missions/expedition_camera.gd")
const Exploration = preload("res://maps/exploration.gd")
const SpecialPower = preload("res://missions/special_power.gd")
const WorldInteractionVFX = preload("res://missions/world_interaction_vfx.gd")
const TraitRuntime = preload("res://core/trait_runtime.gd")
const AuraRuntime = preload("res://core/aura_runtime.gd")
const PeriodicEffectRuntime = preload("res://core/periodic_effect_runtime.gd")
const HealEffectHandler = preload("res://core/heal_effect_handler.gd")
const BuffEffectHandler = preload("res://core/buff_effect_handler.gd")
const Modifiers = preload("res://core/effect_modifiers.gd")
const EncounterDirector = preload("res://encounter/encounter_director.gd")
const LootResolver = preload("res://core/loot_resolver.gd")
const NoiseSystem = preload("res://encounter/noise_system.gd")
const SurvivorProgression = preload("res://data/survivor_progression.gd")
const RandomMapGenerator = preload("res://maps/random/random_map_generator.gd")
const MapProvider = preload("res://maps/expedition/expedition_map_provider.gd")
const TownSearchRegistry = preload("res://maps/expedition/town_search_registry.gd")
var search_registry: RefCounted
var selected_search_member: Node3D
var encounter: RefCounted
var noise: RefCounted
var arrival_noise_pending: bool = true
var arrival: RefCounted
var encounter_debug: CanvasLayer
var encounter_stats_left: float = 0.0
var effects: RefCounted
var action_elapsed: float = 0.0
var watch_warning_active: bool:
	get:
		return active and effects != null and clock != null and effects.amount("warning_seconds") > 0 and clock.phase == clock.DAY and clock.remaining() <= effects.amount("warning_seconds")
var _last_watch_warning: bool = false
var powers: RefCounted
var catalog: RefCounted
var ledger: RefCounted
var campaign: RefCounted
var clock: RefCounted
var city: Node3D
var atmosphere: Node3D
var sound: Node
var camera: Camera3D
var camera_controller: Node
var exploration: Node
var survivors: Array[Node3D] = []
var enemies: Array[Node3D] = []
var enemy_pool: Array[Node3D] = []
var pickups: Array[Dictionary] = []
var rng := RandomNumberGenerator.new()
var trait_rng := RandomNumberGenerator.new()
var active: bool = true
var focus_target: Node3D
var search_tasks: Dictionary = {}
# Survivor-owned view of the same active tasks. `search_tasks` remains the
# target/world-state index consumed by POI cards and world markers.
var survivor_tasks: Dictionary = {}
var exiting_tasks: Array[RefCounted] = []
var selected_search_id := ""
# The selected task is only the inspection target; every task keeps running independently.
var search_task: RefCounted:
	get: return search_tasks.get(selected_search_id)
var search_id: String:
	get: return selected_search_id if search_tasks.has(selected_search_id) else ""
var order: String = "守住阵位"
var search_status: String:
	get: return search_task.status(self) if search_task != null else ""
var extraction: bool = false
var extraction_left: float = 0.0
var closing_left: float = -1.0
var spawn_left: float = 20.0
var kills: int = 0
var invincible: bool = false
var time_scale: float = 1.0
var director_enabled: bool = true
var poi_selected_id: String = ""
var camera_center := Vector3.ZERO
var focus_repath: float = 0.0
var rally_point := Vector3.ZERO
var regroup_left := 0.0
var controls: RefCounted
var input_enabled := true
var random_map_config: Dictionary = {}
var generated_map: Dictionary = {}
var generated_extraction: Vector3 = Vector3.ZERO
var generated_spawn: Vector3 = Vector3.ZERO
var mission_type: String = "supply_search"
var mission_profile: Resource
var generated_instance_id: int = 0
var manual_aim := false
var aim_point := Vector3.ZERO
var world_interaction_vfx: Node3D
var runtime_data: Dictionary = {}
var map_provider: String = MapProvider.FIXED_LEGACY
var town_runtime_root: Node3D
var town_runtime_ready: bool = false
var survivor_commands_enabled: bool = false
var last_command_rejection: String = ""
var load_profile: RefCounted
var search_registry_ready: bool = false
var avoidance_update_count: int = 0
var xp_awarded_events: Dictionary = {}
var retired_enemy_ids: Dictionary = {}
var periodic_effects: RefCounted

func setup(content: RefCounted, resources: RefCounted, loadout: Array[String], seed_value: int = 0, run_state: RefCounted = null, locked_party: Array[String] = [], map_config: Dictionary = {}, prepared_bridge: Dictionary = {}) -> void:
	xp_awarded_events.clear()
	retired_enemy_ids.clear()
	search_tasks.clear()
	survivor_tasks.clear()
	generated_map.clear()
	runtime_data.clear()
	town_runtime_ready = false
	generated_instance_id = get_instance_id()
	catalog = content
	mission_profile = catalog.map.mission_profile
	ledger = resources
	campaign = run_state
	effects = campaign.passive_modifiers() if campaign != null else Modifiers.new()
	controls = SquadInput.new(self)
	ledger.begin()
	rally_point = catalog.map.bus_position
	random_map_config = map_config.duplicate(true)
	mission_type = mission_profile.mission_type if mission_profile != null else str(random_map_config.get("mission_type", "supply_search"))
	map_provider = str(random_map_config.get("map_provider", MapProvider.FIXED_LEGACY))
	if map_provider == MapProvider.MEDIUM_TOWN_V1:
		var bridge: Dictionary = prepared_bridge if not prepared_bridge.is_empty() else MapProvider.create_runtime(map_provider, mission_type, int(random_map_config.get("map_seed", seed_value)), catalog.map, self)
		if not bool(bridge.get("ok", false)):
			push_error("[ExpeditionMapProvider] " + str(bridge.get("error", "Bridge failed")))
			return
		runtime_data = bridge.runtime
		town_runtime_root = bridge.get("root") as Node3D
		town_runtime_root.navigation_ready.connect(_on_navigation_ready)
		town_runtime_ready = true
		catalog.map = bridge.map
		rally_point = runtime_data.arrival_point
	if bool(random_map_config.get("use_random_map", false)):
		var generated := RandomMapGenerator.generate(str(random_map_config.get("mission_type", "supply_search")), int(random_map_config.get("seed", seed_value)), str(random_map_config.get("layout", "")), float(random_map_config.get("zombie_density", 1.0)))
		if generated.get("ok", false):
			generated_map = generated
			_apply_generated_map(catalog.map, generated)
		else:
			push_error("[RandomMap] Generation failed: " + str(generated.get("error", "unknown")))
			random_map_config["use_random_map"] = false
	rng.seed = seed_value if seed_value != 0 else Time.get_ticks_usec()
	if campaign != null:
		rng.seed = int(campaign.data.seed) + int(campaign.data.day) * 1009
	if bool(random_map_config.get("use_random_map", false)):
		rng.seed = int(random_map_config.get("seed", rng.seed))
	var clock_rules: Resource = catalog.map.duplicate()
	clock_rules.day_seconds += effects.amount("day_extension")
	clock = Clock.new(clock_rules)
	if town_runtime_ready:
		city = town_runtime_root
		director_enabled = false
		var search_started := Time.get_ticks_usec()
		search_registry = TownSearchRegistry.new()
		search_registry.setup(self)
		if load_profile != null:
			load_profile.measure("search_registry_create", search_started)
	else:
		var legacy_bridge := MapProvider.create_runtime(MapProvider.FIXED_LEGACY, mission_type, seed_value, catalog.map, self)
		city = legacy_bridge.root
	atmosphere = Atmosphere.new()
	add_child(atmosphere)
	atmosphere.setup(city)
	sound = Soundscape.new()
	add_child(sound)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = ExpeditionCamera.DEFAULT_SIZE
	camera.far = 180.0
	add_child(camera)
	camera.current = true
	var member_ids: Array
	if campaign == null:
		member_ids = catalog.survivors.slice(0, loadout.size()).map(func(member): return member.id)
	else:
		member_ids = campaign.data.members if locked_party.is_empty() else locked_party
	var spawn_started := Time.get_ticks_usec()
	periodic_effects = PeriodicEffectRuntime.new()
	periodic_effects.effect_applied.connect(_on_periodic_effect_applied)
	periodic_effects.effect_expired.connect(_on_periodic_effect_expired)
	for i in range(member_ids.size()):
		var member_id: String = member_ids[i]
		var spec: Resource = (catalog.survivors[i] if campaign == null else campaign.member_template(member_id)).duplicate()
		var talent: Resource = catalog.by_id(catalog.traits, spec.trait_id).at_level(1)
		var equipment: Resource
		var equipment_instance: RefCounted = null
		if campaign == null:
			equipment = catalog.by_id(catalog.weapons, loadout[i])
		else:
			var equipped_uid: String = str(campaign.data.equipment[member_id])
			equipment = campaign.weapon(equipped_uid)
			equipment_instance = campaign.weapon_inventory.get_weapon(equipped_uid)
			talent = campaign.member_trait(member_id)
			spec.id = member_id
			spec.max_hp *= campaign.health_multiplier()
		var survivor := Survivor.new()
		add_child(survivor)
		survivor.setup(spec, talent, equipment, equipment_instance)
		survivor.enable_motion_presentation(self)
		survivor.effects = effects
		var spawn_origin: Vector3 = runtime_data.arrival_point if town_runtime_ready else catalog.map.bus_position
		var town_positions: Array[Vector3] = []
		if town_runtime_ready:
			town_positions = town_runtime_root.spawn_positions(member_ids.size())
		survivor.position = town_positions[survivors.size()] if survivors.size() < town_positions.size() else spawn_origin + formation(survivors.size())
		survivors.append(survivor)
	for survivor: Node3D in survivors:
		periodic_effects.register_provider(survivor, survivor.talent, str(survivor.get_instance_id()))
	if load_profile != null:
		load_profile.measure("survivor_spawn", spawn_started)
	encounter = EncounterDirector.new()
	trait_rng.seed = hash("trait-rewards:%s" % rng.seed)
	encounter.setup(catalog.map.encounter, rng.seed)
	if not town_runtime_ready:
		encounter.seed_population(self)
	noise = NoiseSystem.new(catalog.map.encounter)
	noise.noise_emitted.connect(_on_noise)
	clock.phase_changed.connect(_on_phase)
	clock.warning_changed.connect(_on_warning)
	spawn_left = catalog.map.encounter.daytime_respawn_interval
	powers = SpecialPower.new(self)
	camera_controller = ExpeditionCamera.new()
	add_child(camera_controller)
	camera_controller.setup(self)
	exploration = Exploration.new()
	add_child(exploration)
	exploration.setup(self)
	world_interaction_vfx = WorldInteractionVFX.new()
	world_interaction_vfx.name = "WorldInteractionVFX"
	add_child(world_interaction_vfx)
	world_interaction_vfx.setup(self)
	if OS.is_debug_build():
		encounter_debug = preload("res://debug/encounter_debug.gd").new()
		add_child(encounter_debug)
		encounter_debug.setup(self)
	survivor_commands_enabled = not town_runtime_ready

func _on_navigation_ready() -> void:
	var started := Time.get_ticks_usec()
	if load_profile != null:
		search_registry.start_background_resolution()
	else:
		search_registry.resolve_navigation()
	exploration.refresh()
	search_registry_ready = true
	if load_profile != null:
		load_profile.measure("wait_search_resolve", started)
	survivor_commands_enabled = true
	town_runtime_root.lifecycle.append("survivor_commands_enabled")
	navigation_ready.emit()

func _reject_move(reason: String) -> bool:
	last_command_rejection = reason
	command_rejected.emit(reason)
	return false

func _apply_generated_map(map: Resource, generated: Dictionary) -> void:
	map.id = "random_" + str(generated.layout)
	map.display_name = "随机街区"
	map.base_seed = int(generated.seed)
	map.half_width = int(generated.half_width)
	map.half_depth = int(generated.half_depth)
	map.bus_position = generated.spawn
	generated_spawn = generated.spawn
	generated_extraction = generated.extraction
	mission_type = str(generated.mission_type)
	print("[Mission] mission_type=%s use_random_map=true seed=%d layout=%s instance=%d" % [mission_type, int(generated.seed), str(generated.layout), generated_instance_id])
	map.road_segments = generated.roads
	map.districts.clear()
	map.frontage_blocks.clear()
	map.buildings = generated.buildings
	map.plots.clear()
	map.parking_placements.clear()
	map.parking_areas.clear()
	map.props.clear()
	map.vegetation.clear()
	map.encounter = map.encounter.duplicate(true)
	map.encounter.initial_zombie_min = maxi(1, int(generated.zombie_spawns.size() * .75))
	map.encounter.initial_zombie_max = maxi(map.encounter.initial_zombie_min, generated.zombie_spawns.size())
	var building_ids: Array[String] = []
	var building_slots: Array[String] = []
	for building: Dictionary in generated.buildings:
		building_ids.append(str(building.get("asset", "")))
		building_slots.append(str(building.get("slot_id", "")))
	print("[RandomMap] Ready Mission=%s Seed=%d Layout=%s Instance=%d Buildings=%d IDs=%s Slots=%s POI=%s Spawn=%s Extraction=%s" % [generated.mission_type, generated.seed, generated.layout, generated_instance_id, generated.buildings.size(), ",".join(building_ids), ",".join(building_slots), generated.poi, generated.spawn, generated.extraction])

func formation(index: int) -> Vector3:
	return [Vector3(-1.2, 0, 0), Vector3(1.2, 0, 0), Vector3(0, 0, -1.4), Vector3(0, 0, 1.4)][index % 4]

func begin_arrival() -> void:
	# The fixed-map cutscene rewrites spawn and moves its bus along world X.
	# Town already spawned at its generated exit; E05 owns that cutscene bridge.
	if town_runtime_ready:
		return
	arrival = preload("res://encounter/mission_arrival.gd").new()
	arrival.setup(self)

func debug_equip(index: int, equipment: Resource) -> void:
	var member: Node3D = survivors[index]
	if member.dead:
		return
	member.equip(equipment)
	if campaign != null:
		member.apply_trait(campaign.member_trait(member.data.id))

func _physics_process(delta: float) -> void:
	if not active or time_scale <= 0:
		return
	var left := maxf(0.0, delta * time_scale)
	# Split at effect expiry so a clock freeze cannot eat the rest of a large frame.
	while left > 0 and active:
		if powers == null:
			_advance_world(left)
			left = 0.0
			break
		var dt := minf(left, powers.next_expiry())
		_advance_world(dt)
		powers.advance(dt)
		left = maxf(0.0, left - dt)
func _advance_world(dt: float) -> void:
	if periodic_effects != null:
		periodic_effects.advance(dt, survivors)
	if town_runtime_ready:
		if survivor_commands_enabled:
			for task: RefCounted in search_tasks.values().duplicate():
				task.prepare(dt, self)
			for task: RefCounted in exiting_tasks:
				task.advance_exit(dt)
			exiting_tasks = exiting_tasks.filter(func(task: RefCounted): return task.exit_worker != null)
			_prune_tasks()
			regroup_left -= dt
			if regroup_left <= 0:
				refresh_regroup()
			for survivor: Node3D in survivors:
				survivor.tick(dt, self)
			for task: RefCounted in search_tasks.values().duplicate():
				task.advance(dt, self)
			_prune_tasks()
			_update_pickups()
		if exploration != null:
			exploration.advance(dt)
		return
	if noise != null:
		noise.advance(dt)
	if arrival != null and not arrival.finished:
		arrival.advance(dt, self)
		if exploration != null:
			exploration.advance(dt)
		return
	if arrival_noise_pending:
		arrival_noise_pending = false
		noise.emit_noise(catalog.map.bus_position, catalog.map.encounter.arrival_noise_radius, NoiseSystem.Event.NoiseType.ARRIVAL, 1.0, city)
	if clock != null:
		clock.advance(dt, effects.amount("freeze_day_clock") > 0)
	_sync_watch_warning()
	_update_director(dt)
	powers.refresh_target()
	encounter_stats_left -= dt
	if encounter_stats_left <= 0:
		encounter_stats_left = catalog.map.encounter.perception_tick_max
		for enemy: Node3D in enemies:
			enemy.refresh_stats(clock)
	for task in search_tasks.values().duplicate():
		task.prepare(dt, self)
	for task: RefCounted in exiting_tasks:
		task.advance_exit(dt)
	exiting_tasks = exiting_tasks.filter(func(task: RefCounted): return task.exit_worker != null)
	_prune_tasks()
	regroup_left -= dt
	if regroup_left <= 0:
		refresh_regroup()
	for survivor in survivors:
		survivor.tick(dt, self)
	for enemy in enemies.duplicate():
		if enemy.active:
			enemy.tick(dt, self)
		else:
			_retire_enemy(enemy)
	if living().is_empty():
		_finish(true)
		return
	_update_focus(dt)
	for task in search_tasks.values().duplicate():
		task.advance(dt, self)
	_prune_tasks()
	_update_pickups()
	_update_extraction(dt)
	if exploration != null:
		exploration.advance(dt)

func _on_periodic_effect_applied(event: Dictionary) -> void:
	var effect_type: String = str(event.get("effect_type", ""))
	var target_id: int = int(event.get("target_id", 0))
	for survivor: Node3D in survivors:
		if survivor.get_instance_id() != target_id:
			continue
		if effect_type == "heal":
			HealEffectHandler.apply(survivor, float(event.get("value", 0.0)))
		elif effect_type == BuffEffectHandler.EFFECT_CRIT_RATE:
			BuffEffectHandler.apply(survivor, effect_type, float(event.get("value", 0.0)), str(event.get("provider_id", "")))
		return

func _on_periodic_effect_expired(event: Dictionary) -> void:
	var effect_type: String = str(event.get("effect_type", ""))
	if effect_type == "heal":
		return
	var target_id: int = int(event.get("target_id", 0))
	for survivor: Node3D in survivors:
		if survivor.get_instance_id() == target_id:
			BuffEffectHandler.expire(survivor, effect_type, str(event.get("provider_id", "")))
			return

func _on_noise(event: RefCounted) -> void:
	for enemy: Node3D in enemies:
		var unaware: bool = enemy.state in [enemy.State.IDLE, enemy.State.WANDER]
		if enemy.hear_noise(event, city):
			event.listeners += 1
			event.awakened += int(unaware)

func _sync_watch_warning() -> void:
	if _last_watch_warning != watch_warning_active:
		_last_watch_warning = watch_warning_active
		watch_warning_changed.emit(watch_warning_active)

func movement_speed(member: Node3D, waypoint: Vector3, delta: float) -> float:
	avoidance_update_count += 1
	var speed: float = member.data.move_speed * effects.multiplier("move_speed") * (1.0 + member.weapon.move_speed_modifier if member.weapon != null else 1.0)
	speed *= AuraRuntime.movement_multiplier(member, survivors)
	if town_runtime_ready and bool(get_meta("p02_avoidance_enabled", true)):
		# Keep a following gap on a shared corridor without moving actors off their
		# collision-checked paths or introducing a crowd physics / RVO system.
		# Following/yielding uses the XZ navigation corridor. Surface elevation
		# must not tilt headings or change lateral separation and right of way.
		var heading: Vector3 = waypoint - member.position
		heading.y = 0
		heading = heading.normalized()
		for other: Node3D in survivors:
			if other == member or other.dead or other.path.is_empty():
				continue
			var offset: Vector3 = other.position - member.position
			offset.y = 0
			var ahead: float = offset.dot(heading)
			var lateral: float = (offset - heading * ahead).length()
			var other_heading: Vector3 = other.path[0] - other.position
			other_heading.y = 0
			other_heading = other_heading.normalized()
			var follows: bool = heading.dot(other_heading) > 0.5
			var yields: bool = survivors.find(member) > survivors.find(other)
			# Converging headings can each see the other ahead. One stable priority
			# must win that mutual wait, otherwise both speeds remain zero forever.
			var mutual_ahead: bool = follows and -offset.dot(other_heading) > 0.0
			if ahead > 0.0 and lateral < 1.1 and (follows or yields) and (not mutual_ahead or yields):
				speed = minf(speed, maxf(0.0, (ahead - 1.2) * 2.0))
			if not follows:
				var a: Vector2 = Vector2(member.position.x, member.position.z)
				var b: Vector2 = Vector2(other.position.x, other.position.z)
				var end_a: Vector3 = member.position + heading * minf(4.0, Vector2(waypoint.x - member.position.x, waypoint.z - member.position.z).length())
				var end_b: Vector3 = other.position + other_heading * minf(4.0, Vector2(other.path[0].x - other.position.x, other.path[0].z - other.position.z).length())
				var crossing: Variant = Geometry2D.segment_intersects_segment(a, Vector2(end_a.x, end_a.z), b, Vector2(end_b.x, end_b.z))
				if crossing != null:
					var distance_a: float = a.distance_to(crossing)
					var distance_b: float = b.distance_to(crossing)
					if distance_a > distance_b + .05 or (absf(distance_a - distance_b) <= .05 and yields):
						speed = minf(speed, maxf(0.0, (distance_a - 1.0) * 2.0))
		return speed
	if not watch_warning_active or member.dead or member.boarding or delta <= 0:
		return speed
	var offset: Vector3 = waypoint - member.position
	var to_bus: Vector3 = catalog.map.bus_position - member.position
	if offset.length_squared() < 0.000001 or offset.dot(to_bus) <= 0:
		return speed
	var boosted: float = speed * effects.multiplier("return_speed")
	var next: Vector3 = member.position.move_toward(waypoint, boosted * delta)
	# A command towards home is insufficient: this actual path segment must approach it.
	if next.distance_squared_to(catalog.map.bus_position) < member.position.distance_squared_to(catalog.map.bus_position) - 0.000001:
		return boosted
	return speed

func incoming_damage_multiplier(member: Node3D, damage_tags: Array[String]) -> float:
	return TraitRuntime.damage_reduction(1.0, AuraRuntime.modifier(member, survivors, AuraRuntime.EFFECT_INFECTED_DAMAGE_REDUCTION), damage_tags)

func damage_to(member: Node3D, target: Node3D) -> float:
	var base_damage: float = member.weapon.damage * member.talent.damage_multiplier
	var distance: float = Vector2(member.position.x, member.position.z).distance_to(Vector2(target.position.x, target.position.z)) if target != null else INF
	var tags: Array[String] = []
	if target != null and target in enemies:
		tags.append("infected")
	var trait_damage: float = TraitRuntime.damage_amount(base_damage, member.talent, distance, tags)
	return effects.outgoing_damage(trait_damage, member.weapon.melee, target != null and target == powers.target())

func award_xp_once(member_id: String, event_type: SurvivorProgression.EventType, event_key: String, amount: int = 0) -> int:
	if campaign == null or member_id.is_empty() or event_key.is_empty() or xp_awarded_events.has(event_key):
		return 0
	xp_awarded_events[event_key] = true
	return campaign.record_xp_event(member_id, event_type, amount)

func interaction_duration(site: Dictionary, worker: Node3D) -> float:
	var search_duration: float = effects.search_seconds(site.spec.search_seconds, worker.talent.search_multiplier)
	var categories: Array[String] = []
	categories.assign(site.spec.get("interaction_categories", []))
	return TraitRuntime.interaction_duration(search_duration, worker.talent, categories)

func _process(delta: float) -> void:
	if town_runtime_ready and search_registry != null and survivor_commands_enabled:
		search_registry.resolve_navigation_background()
	if controls != null:
		controls.update(delta)
	if camera_controller != null:
		camera_controller.update(delta)

func pan_camera(amount: Vector2) -> void:
	camera_controller.pan(amount)

func _update_camera() -> void:
	camera_controller.apply()

func center_squad() -> void:
	if living().is_empty():
		return
	camera_controller.center_squad()

func living() -> Array[Node3D]:
	var result: Array[Node3D] = []
	for survivor in survivors:
		if not survivor.dead:
			result.append(survivor)
	return result

func guards() -> Array[Node3D]:
	var result: Array[Node3D] = []
	for member in living():
		if task_for(member) == null:
			result.append(member)
	return result

func guards_center(exclude: Node3D = null) -> Vector3:
	var center := Vector3.ZERO
	var count := 0
	for member in guards():
		if member != exclude and not member.regrouping:
			center += member.position
			count += 1
	return center / count if count > 0 else rally_point

func refresh_regroup() -> void:
	regroup_left = 0.6
	if manual_aim:
		return
	for member in guards():
		if not member.regrouping:
			continue
		var destination := guards_center(member)
		if member.position.distance_to(destination) < 2.0:
			member.regrouping = false
			member.stop()
		else:
			member.order_move(destination, city)

func member_status(member: Node3D) -> String:
	if member.dead:
		return "阵亡"
	var task := task_for(member)
	if task != null:
		return task.action_label()
	if member.inside_building:
		return "走出建筑"
	if member.regrouping:
		return "归队中"
	return "归航中" if extraction else "掩护"

func squad_center() -> Vector3:
	var center := Vector3.ZERO
	var members := living()
	for member in members:
		center += member.position
	return center / maxi(1, members.size())

func nearest_survivor(point: Vector3) -> Node3D:
	var nearest: Node3D
	var best := INF
	for survivor in living():
		if survivor.inside_building:
			continue
		var distance := survivor.position.distance_squared_to(point)
		if distance < best:
			nearest = survivor
			best = distance
	return nearest

func _input(event: InputEvent) -> void:
	if controls != null:
		controls.observe(event)

func _unhandled_input(event: InputEvent) -> void:
	if controls != null:
		controls.handle(event)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT and controls != null:
		controls.reset()

func _exit_tree() -> void:
	if powers != null:
		powers.clear()
	for task in search_tasks.values():
		if is_instance_valid(task.worker) and task.worker.damaged.is_connected(task._on_damage):
			task.worker.damaged.disconnect(task._on_damage)

func task_for(member: Node3D) -> RefCounted:
	if member == null:
		return null
	var key := _survivor_key(member)
	var indexed: RefCounted = survivor_tasks.get(key)
	if indexed != null and indexed.worker == member:
		return indexed
	# Repair compatibility with tasks created by older fixtures or a stale
	# external caller, while keeping the normal lookup O(1).
	for task: RefCounted in search_tasks.values():
		if task.worker == member:
			_bind_search_task(task.site_id, task, member)
			return task
	return null

func _survivor_key(member: Node3D) -> String:
	return str(member.data.id) if member != null and member.data != null else str(member.get_instance_id())

func _bind_search_task(id: String, task: RefCounted, member: Node3D) -> void:
	search_tasks[id] = task
	survivor_tasks[_survivor_key(member)] = task

func _unbind_search_task(task: RefCounted) -> void:
	if task == null:
		return
	var id: String = str(task.site_id)
	if search_tasks.get(id) == task:
		search_tasks.erase(id)
	var survivor_id: String = str(task.survivor_id)
	if survivor_tasks.get(survivor_id) == task:
		survivor_tasks.erase(survivor_id)

func search_target_state(id: String) -> Dictionary:
	if not city.sites.has(id):
		return {}
	var site: Dictionary = city.sites[id]
	var task: RefCounted = search_tasks.get(id)
	var owner: Node3D = task.worker if task != null and is_instance_valid(task.worker) and not task.worker.dead else null
	var state: String = "COMPLETED" if site.searched else "CANCELLED" if site.get("search_cancelled", false) else "AVAILABLE"
	var progressing: bool = false
	if owner != null and not site.searched:
		state = "SEARCHING" if task.search_started else "ASSIGNED" if task.phase == SearchTask.Phase.ASSIGNED else "APPROACHING"
		progressing = owner.searching and task.phase in [SearchTask.Phase.SEARCHING_INSIDE, SearchTask.Phase.SEARCHING_OUTSIDE]
	return {"state": state, "worker": owner, "progress": site.progress, "completed": site.searched,
		"can_search": active and closing_left < 0 and not site.searched and owner == null and str(site.spec.get("search_status", TownSearchRegistry.RESOLVED_REACHABLE)) == TownSearchRegistry.RESOLVED_REACHABLE,
		"progressing": active and not site.searched and progressing}

func _prune_tasks() -> void:
	for id in search_tasks.keys().duplicate():
		var task: RefCounted = search_tasks[id]
		if task == null:
			search_tasks.erase(id)
		elif task.worker == null:
			_unbind_search_task(task)
	for survivor_id in survivor_tasks.keys().duplicate():
		var task: RefCounted = survivor_tasks[survivor_id]
		if task == null or task.worker == null or search_tasks.get(task.site_id) != task:
			survivor_tasks.erase(survivor_id)
	if not search_tasks.has(selected_search_id):
		selected_search_id = "" if search_tasks.is_empty() else str(search_tasks.keys()[0])

func _cancel_guard_order() -> void:
	end_aim()
	if focus_target != null and is_instance_valid(focus_target):
		focus_target.focus_ring.visible = false
	focus_target = null
	if is_instance_valid(world_interaction_vfx):
		world_interaction_vfx.clear_focus()
	extraction = false
	extraction_left = catalog.map.extraction_seconds

func move_command_members() -> Array[Node3D]:
	# Portrait selection inspects one member; ordinary world commands address the squad.
	var recipients: Array[Node3D] = []
	for member: Node3D in living():
		if member.boarding or member.inside_building or member.searching:
			continue
		var task: RefCounted = task_for(member)
		if task == null or task.allows_move_override():
			recipients.append(member)
	return recipients

func command_move(point: Vector3) -> bool:
	if not active or closing_left >= 0:
		return false
	return _move_members(point, move_command_members())

func _move_members(point: Vector3, members: Array[Node3D]) -> bool:
	if town_runtime_ready and not survivor_commands_enabled:
		return _reject_move("NAVIGATION_NOT_READY")
	if town_runtime_ready and (not point.is_finite() or not city.navigation.point_clear(point)):
		return _reject_move("INVALID_NAVIGATION_TARGET")
	var destination: Vector3 = city.nearest_open(point)
	if town_runtime_ready and not destination.is_finite():
		return _reject_move("UNREACHABLE_TARGET")
	var orders: Array[Dictionary] = []
	var reserved: Array[Vector3] = []
	var reserved_paths: Array[PackedVector3Array] = []
	var preferred: Dictionary = _town_formation_slots(destination, members) if town_runtime_ready else {}
	for member: Node3D in members:
		var target: Vector3 = city.nearest_open(destination + formation(survivors.find(member)))
		var route: PackedVector3Array = []
		if town_runtime_ready:
			var formation_order: Dictionary = city.formation_order(member.position, preferred[member.get_instance_id()], reserved, reserved_paths)
			if formation_order.is_empty():
				return _reject_move("UNREACHABLE_FORMATION")
			target = formation_order.target
			route = formation_order.route
		else:
			route = city.path(member.position, target)
		if not route.is_empty():
			orders.append({"member": member, "target": target, "route": route})
			reserved.append(target)
			reserved_paths.append(route)
	if orders.is_empty():
		return _reject_move("NO_REACHABLE_MEMBERS")
	last_command_rejection = ""
	_cancel_guard_order()
	rally_point = destination
	for move_order: Dictionary in orders:
		var member: Node3D = move_order.member
		var task: RefCounted = task_for(member)
		if task != null:
			task.release(self)
		member.regrouping = false
		member.order_move(move_order.target, city, move_order.route)
		if is_instance_valid(world_interaction_vfx):
			world_interaction_vfx.play_command_line(member, destination)
	_prune_tasks()
	city.set_marker(destination)
	if is_instance_valid(world_interaction_vfx):
		world_interaction_vfx.play_move_feedback(destination)
	order = "前往阵位"
	return true

func _town_formation_slots(destination: Vector3, members: Array[Node3D]) -> Dictionary:
	# Preserve the existing formation, but assign nearest member/slot pairs first
	# so short reorders do not force the squad to swap places through each other.
	var remaining: Array[Node3D] = members.duplicate()
	var slots: Array[Vector3] = []
	for i: int in members.size():
		slots.append(destination + formation(i))
	var assigned: Dictionary = {}
	while not remaining.is_empty():
		var best_member: int = 0
		var best_slot: int = 0
		var distance: float = INF
		for i: int in remaining.size():
			for j: int in slots.size():
				var candidate: float = remaining[i].position.distance_squared_to(slots[j])
				if candidate < distance:
					distance = candidate
					best_member = i
					best_slot = j
		assigned[remaining[best_member].get_instance_id()] = slots[best_slot]
		remaining.remove_at(best_member)
		slots.remove_at(best_slot)
	return assigned

func command_stop() -> void:
	if not active or closing_left >= 0:
		return
	_cancel_guard_order()
	for survivor in guards():
		survivor.regrouping = false
		survivor.request_stop()
	city.marker.visible = false
	order = "停止移动 · 自动迎敌"

func command_search(id: String, survivor: Node3D = null) -> bool:
	if not active or closing_left >= 0 or not city.sites.has(id) or city.sites[id].searched:
		return false
	poi_selected_id = id
	var site: Dictionary = city.sites[id]
	if town_runtime_ready:
		if not survivor_commands_enabled:
			_reject_move("NAVIGATION_NOT_READY")
			return false
		if not site.discovered:
			return false
		if search_registry.resolve_priority(id) != TownSearchRegistry.RESOLVED_REACHABLE:
			_reject_move("SEARCH_REJECTED_UNREACHABLE")
			notice.emit("无法抵达该搜索入口")
			return false
	if search_tasks.has(id):
		selected_search_id = id
		return false
	var assigned: Node3D = survivor
	# Legacy callers have no member argument. Keep them working on the old
	# provider and during the migration, while the production Town input below
	# always passes the selected UI member explicitly.
	if assigned == null and town_runtime_ready:
		assigned = selected_search_member
	if assigned == null:
		var best := INF
		for member in living():
			if member.boarding or member.inside_building or task_for(member) != null:
				continue
			var route: PackedVector3Array = city.path(member.position, site.spec.entry)
			if route.is_empty():
				continue
			var distance := member.position.distance_squared_to(site.spec.entry)
			if distance < best:
				best = distance
				assigned = member
	if assigned == null or not living().has(assigned) or assigned.boarding or assigned.inside_building or task_for(assigned) != null:
		if town_runtime_ready:
			_reject_move("SEARCH_REJECTED_MEMBER_UNAVAILABLE")
			notice.emit("该幸存者暂时无法接取搜索 · 请先选择其他可行动角色")
		else:
			notice.emit("没有空闲且可抵达的队员 · 可先召回一人")
		return false
	var route: PackedVector3Array = city.path(assigned.position, site.spec.entry)
	if route.is_empty():
		if town_runtime_ready:
			_reject_move("SEARCH_REJECTED_UNREACHABLE")
			notice.emit("无法抵达该搜索入口")
		else:
			notice.emit("没有空闲且可抵达的队员 · 可先召回一人")
		return false
	extraction = false
	extraction_left = catalog.map.extraction_seconds
	var task := SearchTask.new()
	last_command_rejection = ""
	task.assign(id, assigned, self)
	_bind_search_task(id, task, assigned)
	selected_search_id = id
	if is_instance_valid(world_interaction_vfx):
		world_interaction_vfx.play_search_feedback(site.spec.entry if town_runtime_ready else site.search_anchor.global_position)
		if town_runtime_ready:
			world_interaction_vfx.play_command_line(assigned, site.spec.entry, true)
	notice.emit("%s 前往搜索 %s" % [assigned.data.display_name, site.spec.name])
	return true

func command_reassign(index: int) -> void:
	if not active or closing_left >= 0 or search_id.is_empty() or index < 0 or index >= survivors.size():
		return
	var member = survivors[index]
	if member.dead or member.boarding or member.inside_building or task_for(member) != null:
		return
	var id := search_id
	if city.path(member.position, city.sites[id].spec.entry).is_empty():
		notice.emit("该队员无法抵达入口")
		return
	search_task.release(self)
	var replacement := SearchTask.new()
	replacement.assign(id, member, self)
	_bind_search_task(id, replacement, member)
	notice.emit("改派 %s · 搜索进度保留" % member.data.display_name)

func command_recall_survivor(member: Node3D) -> void:
	var task: RefCounted = task_for(member)
	if task == null:
		return
	command_recall(str(task.site_id))

func command_recall(id: String = "") -> void:
	if id.is_empty():
		id = search_id
	if not active or closing_left >= 0 or not search_tasks.has(id):
		return
	if poi_selected_id == id:
		poi_selected_id = ""
	search_tasks[id].release(self)
	_prune_tasks()
	notice.emit("搜索者归队 · 进度保留")

func command_recall_all() -> void:
	if not active or closing_left >= 0:
		return
	_release_tasks()
	if controls != null:
		controls.reset()
	_move_members(rally_point, living())
	notice.emit("全队集合 · 搜索进度保留")

func _release_tasks() -> void:
	for task: RefCounted in search_tasks.values().duplicate():
		task.release(self)
	search_tasks.clear()
	survivor_tasks.clear()
	selected_search_id = ""

func command_aim(point: Vector3) -> void:
	if not active or closing_left >= 0 or not input_enabled:
		return
	if not manual_aim:
		_cancel_guard_order()
	manual_aim = true
	aim_point = Vector3(point.x, 0, point.z)
	for member in guards():
		member.regrouping = false
		member.stop()
	city.set_marker(aim_point)
	order = "指向射击 · 松开 Ctrl 自动迎敌"

func end_aim() -> void:
	if manual_aim:
		manual_aim = false
		order = "守住阵位 · 自动迎敌"
		city.marker.visible = false

func command_focus(target: Node3D) -> void:
	if not active or closing_left >= 0 or target == null or not target.active or not exploration.is_visible(target.position):
		return
	_cancel_guard_order()
	focus_target = target
	target.focus_ring.visible = true
	if is_instance_valid(world_interaction_vfx):
		world_interaction_vfx.set_focus_target(target)
	focus_repath = 0
	order = "集火 · " + target.data.display_name

func command_focus_nearest() -> void:
	var target: Node3D
	var best := INF
	for enemy in enemies:
		if not enemy.active or not exploration.is_visible(enemy.position):
			continue
		var distance := guards_center().distance_squared_to(enemy.position)
		if distance < best:
			target = enemy
			best = distance
	if target != null:
		command_focus(target)
	else:
		notice.emit("附近没有目标")

func _update_focus(delta: float) -> void:
	if focus_target == null:
		return
	if not is_instance_valid(focus_target) or not focus_target.active or not exploration.is_visible(focus_target.position):
		_finish_focus()
		return
	focus_repath -= delta
	if focus_repath > 0:
		return
	focus_repath = 0.65
	for survivor in guards():
		if survivor.regrouping or survivor.weapon == null:
			continue
		if survivor.position.distance_to(focus_target.position) > survivor.weapon.attack_range * 0.85 or not city.line_clear(survivor.position, focus_target.position):
			survivor.order_move(focus_target.position, city)
		else:
			survivor.stop()

func _finish_focus() -> void:
	if is_instance_valid(focus_target):
		focus_target.focus_ring.visible = false
	focus_target = null
	if is_instance_valid(world_interaction_vfx):
		world_interaction_vfx.clear_focus()
	for member in guards():
		if not member.regrouping:
			member.stop()
	order = "守住阵位 · 自动迎敌"

func choose_target(survivor: Node3D) -> Node3D:
	var priority: Node3D = powers.target()
	if priority != null and _can_hit(survivor, priority):
		return priority
	if task_for(survivor) == null and focus_target != null and is_instance_valid(focus_target) and focus_target.active and _can_hit(survivor, focus_target):
		return focus_target
	var nearest: Node3D
	var best := INF
	for enemy in enemies:
		if enemy.active and _can_hit(survivor, enemy):
			var distance := survivor.position.distance_squared_to(enemy.position)
			if distance < best:
				nearest = enemy
				best = distance
	return nearest

func _can_hit(survivor: Node3D, target: Node3D) -> bool:
	return survivor.weapon != null and survivor.position.distance_to(target.position) <= survivor.weapon.attack_range and city.line_clear(survivor.position, target.position)

func attack(survivor: Node3D, target: Node3D) -> void:
	if is_instance_valid(target):
		survivor.combat.try_attack(survivor, self, target.position, target)

func effects_hit(from: Vector3, to: Vector3, color: Color) -> void:
	Visuals.tracer(self, from + Vector3.UP, to + Vector3.UP, color, true)

func spawn_enemy(id: String, point: Vector3) -> Node3D:
	if not active or closing_left >= 0 or enemies.size() >= catalog.map.encounter.population_limit:
		return null
	var data: Resource = catalog.by_id(catalog.enemies, id)
	if data == null:
		return null
	var enemy: Node3D
	for cached in enemy_pool:
		if cached.data.id == id:
			enemy = cached
			break
	if enemy != null:
		enemy_pool.erase(enemy)
		enemy.reset_for_spawn(rng.randf_range(0.1, 0.6), clock)
	else:
		enemy = data.scene.instantiate()
		add_child(enemy)
		enemy.setup(data, rng.randf_range(0.1, 0.6), clock)
	enemy.position = city.nearest_open(point)
	enemy.configure_encounter(catalog.map.encounter, rng.randi())
	retired_enemy_ids.erase(str(enemy.get_instance_id()))
	enemy.set_meta("encounter_origin", "manual")
	enemy.refresh_stats(clock)
	if exploration != null:
		enemy.visible = exploration.is_visible(enemy.position)
		enemy.get_node("HitArea").collision_layer = 2 if enemy.visible else 0
	enemies.append(enemy)
	return enemy

func _retire_enemy(enemy: Node3D) -> void:
	var enemy_key: String = str(enemy.get_instance_id())
	if retired_enemy_ids.has(enemy_key):
		return
	retired_enemy_ids[enemy_key] = true
	kills += 1
	var killer: Node3D = enemy.death_source as Node3D
	if killer != null and survivors.has(killer):
		award_xp_once(killer.data.id, SurvivorProgression.EventType.KILL_ENEMY, "kill:" + enemy_key)
	if focus_target == enemy:
		_finish_focus()
	var food := 1 if rng.randf() < enemy.data.food_drop_chance else 0
	var scrap := 1 if rng.randf() < enemy.data.scrap_drop_chance else 0
	if food + scrap > 0:
		drop_loot(enemy.position, food, scrap)
	enemies.erase(enemy)
	enemy.focus_ring.visible = false
	enemy_pool.append(enemy)

func _update_director(delta: float) -> void:
	if not director_enabled or closing_left >= 0:
		return
	encounter.advance(delta, self)

func drop_loot(point: Vector3, food: int, scrap: int, weapon_item: Dictionary = {}, search_source: Dictionary = {}) -> void:
	var view := Node3D.new()
	add_child(view)
	view.position = point
	Visuals.loot_crate(view)
	Visuals.ring(view, Vector3(0, 0.1, 0), 0.7, Color("#a4eab1"))
	pickups.append({"view": view, "food": food, "scrap": scrap, "weapon": weapon_item, "search_source": search_source})

func reward_for_site(id: String, worker: Node3D = null) -> Dictionary:
	if campaign == null:
		return {}
	if mission_profile != null:
		if not city.sites.has(id):
			return {}
		var chance: float = mission_profile.weapon_chance_for(city.sites[id].spec)
		var reward_rng := RandomNumberGenerator.new()
		# A separate stream keeps order-independent rewards stable across retries.
		reward_rng.seed = hash("%s:%s:%s:%s" % [campaign.data.seed, campaign.data.day, mission_profile.id, id])
		if reward_rng.randf() >= chance:
			return {}
		var uid := "mission-loot:%s:%s:%s" % [campaign.data.day, mission_profile.id, id]
		if not campaign.item(uid).is_empty():
			return {}
		return campaign.gear.roll(mission_profile.weapon_pool, uid, reward_rng, true, worker.talent if worker != null else null)
	var action: Resource = catalog.by_id(catalog.today_actions, str(campaign.data.get("selected_action", "")))
	if action != null and id not in action.weapon_sites:
		return {}
	var value: Dictionary = campaign.data.day_rewards.get(id, {})
	return value if value.is_empty() or campaign.item(value.uid).is_empty() else {}

func resolve_site_loot(site: Dictionary) -> Dictionary:
	var output := {"food": 0, "scrap": 0}
	var table: Dictionary = site.spec.get("loot_table", {})
	if table.is_empty():
		output.food = site.spec.get("food", 0)
		output.scrap = site.spec.get("scrap", 0)
		return mission_profile.modify_loot(output) if mission_profile != null else output
	for rolled: Dictionary in LootResolver.roll_dict(table, rng):
		if rolled.id == "food":
			output.food += rolled.amount
		elif rolled.id == "scrap":
			output.scrap += rolled.amount
	return mission_profile.modify_loot(output) if mission_profile != null else output

func _update_pickups() -> void:
	for pickup in pickups.duplicate():
		pickup.view.visible = exploration.is_visible(pickup.view.position)
		for survivor in living():
			if survivor.inside_building:
				continue
			if survivor.position.distance_to(pickup.view.position) <= catalog.map.pickup_radius:
				var gained: Vector2i = ledger.collect_resources(pickup.food, pickup.scrap, effects.multiplier("resource_yield"), survivor.talent, trait_rng)
				var message := "+%d 食物   +%d 废料" % [gained.x, gained.y]
				if not pickup.weapon.is_empty():
					ledger.add_weapon(pickup.weapon)
					message += "
获得 " + campaign.gear.title(pickup.weapon)
				var source: Dictionary = pickup.get("search_source", {})
				if source.is_empty():
					notice.emit(message)
				else:
					search_loot_collected.emit(source.id, source.worker_name, {"food": gained.x, "scrap": gained.y, "weapon": pickup.weapon})
				sound.play_cue("loot")
				pickup.view.queue_free()
				pickups.erase(pickup)
				break

func command_extract() -> void:
	if not active or closing_left >= 0:
		return
	_release_tasks()
	if controls != null:
		controls.reset()
	_move_members(catalog.map.bus_position, living())
	extraction = true
	extraction_left = catalog.map.extraction_seconds
	order = "全队归航"
	notice.emit("巴士等待全队抵达")

func board_count() -> int:
	var count := 0
	for survivor in living():
		if not survivor.inside_building and survivor.position.distance_to(catalog.map.bus_position) <= catalog.map.board_radius:
			count += 1
	return count

func _update_extraction(delta: float) -> void:
	if closing_left >= 0:
		closing_left -= delta
		if closing_left <= 0:
			_finish(false)
		return
	if not extraction:
		city.bus_label.text = "归航巴士"
		return
	var members := living()
	if board_count() != members.size():
		extraction_left = catalog.map.extraction_seconds
		city.bus_label.text = "等待队员 %d/%d" % [board_count(), members.size()]
		return
	extraction_left = maxf(0, extraction_left - delta)
	city.bus_label.text = "巴士准备 %.1fs · %d/%d" % [extraction_left, board_count(), members.size()]
	if extraction_left <= 0:
		closing_left = 1.4
		order = "全员上车 · 车门关闭"
		for survivor in members:
			survivor.boarding = true
			survivor.stop()
			create_tween().tween_property(survivor, "scale", Vector3.ZERO, 0.65)
		create_tween().tween_property(city.bus_door, "position:x", city.bus_door.position.x + 0.8, 1.0)
		sound.play_cue("home")

func _finish(wiped: bool) -> void:
	if not active:
		return
	active = false
	powers.clear()
	_sync_watch_warning()
	_release_tasks()
	if controls != null:
		controls.reset()
	var returned: Array[String] = []
	var lost: Array[String] = []
	var returned_ids: Array[String] = []
	var lost_ids: Array[String] = []
	for survivor in survivors:
		if survivor.dead:
			lost.append(survivor.data.display_name)
			lost_ids.append(survivor.data.id)
		else:
			returned.append(survivor.data.display_name)
			returned_ids.append(survivor.data.id)
	var result: Dictionary = ledger.finish(returned, lost, action_elapsed, kills, wiped)
	result.returned_ids = returned_ids
	result.lost_ids = lost_ids
	completed.emit(result)

func _on_phase(phase: int) -> void:
	for enemy: Node3D in enemies:
		enemy.refresh_stats(clock)
	atmosphere.set_phase(phase)
	sound.set_phase(phase)
	spawn_left = minf(spawn_left, clock.spawn_interval())
	notice.emit(["白昼 · 搜集物资", "BLUE HOUR · 全队准备归航", "NIGHT · 夜间警戒持续升级"][phase])

func _on_warning(enabled: bool) -> void:
	if clock.phase == clock.DAY:
		atmosphere.set_warning(enabled)
	if enabled:
		spawn_left = minf(spawn_left, clock.spawn_interval())
		sound.play_cue("blue", 0.8)
		notice.emit("蓝时即将来临 · 留意归航路线")

func debug_clear_enemies() -> void:
	for enemy in enemies:
		enemy.active = false
		enemy.visible = false
		enemy.collision_disable()
		enemy.focus_ring.visible = false
		enemy_pool.append(enemy)
	enemies.clear()
	if focus_target != null:
		_finish_focus()
