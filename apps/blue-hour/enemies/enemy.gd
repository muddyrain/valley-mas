extends Node3D
enum State { IDLE, WANDER, INVESTIGATE, CHASE, ATTACK, DEAD }
const HealthBar = preload("res://ui/expedition/enemy_health_bar.gd")
const Visuals = preload("res://vfx/visuals.gd")
const AnimationController = preload("res://enemies/infected_animation_controller.gd")
const HitFeedback = preload("res://vfx/enemy_hit_feedback.gd")
const DamageResolverData = preload("res://weapons/combat/damage_resolver.gd")
var config: Resource = preload("res://data/expedition_encounter.tres")
var state: State = State.IDLE
var home_position := Vector3.ZERO
var interest_position := Vector3.ZERO
var state_left: float = 0.0
var path_left: float = 0.0
var path_destination := Vector3.INF
var rng := RandomNumberGenerator.new()
var path_queries: int = 0
var perception_queries: int = 0
var sight_queries: int = 0
var last_seen_position := Vector3.ZERO
var memory_left: float = 0.0
var target_visible: bool = false
var far_away: bool = false
var visual_multiplier: float = 1.0
var speed_multiplier: float = 1.0
var hearing_scale: float = 1.0
var heard_noise: String = ""
var heard_serial: int = 0
var heard_events: int = 0
var interest_refresh_left: float = 0.0
var investigating_arrived: bool = false
var data: Resource
var hp: float
var max_hp: float
var attack_damage: float
var active: bool = true
var attack_left: float = 0.0
var windup_left: float = 0.0
var think_left: float = 0.0
var target: Node3D
var attack_target: Node3D
var death_source: Node = null
var path := PackedVector3Array()
var rig: Node3D
var animation_player: AnimationPlayer
var animation_controller: InfectedAnimationController
var locomotion_animation: StringName = &""
var hp_bar: Node3D
var focus_ring: MeshInstance3D
var hit_feedback: EnemyHitFeedback

func state_name() -> String:
	return "INVESTIGATE_NOISE" if state == State.INVESTIGATE else State.keys()[state]

func setup(spec: Resource, offset: float, clock: RefCounted) -> void:
	data = spec
	rig = get_node("VisualRig")
	animation_player = _find_animation_player(rig)
	animation_controller = AnimationController.new()
	animation_controller.name = "InfectedAnimationController"
	add_child(animation_controller)
	hp_bar = HealthBar.new()
	hp_bar.position = get_node("HealthAnchor").position
	add_child(hp_bar)
	focus_ring = Visuals.ring(self, Vector3(0, 0.09, 0), data.collision_radius + 0.15, Color("#ff665e"))
	hit_feedback = HitFeedback.new()
	hit_feedback.setup(self, rig)
	var area: Area3D = get_node("HitArea")
	area.set_meta("enemy", self)
	var collision: CollisionShape3D = area.get_node("CollisionShape3D")
	collision.shape.radius = data.collision_radius
	reset_for_spawn(offset, clock)

func reset_for_spawn(offset: float, clock: RefCounted) -> void:
	max_hp = data.max_hp * clock.hp_multiplier()
	attack_damage = data.attack_damage * clock.damage_multiplier()
	hp = max_hp
	hp_bar.set_ratio(1.0)
	active = true
	visible = true
	path.clear()
	target = null
	attack_target = null
	death_source = null
	attack_left = 0.0
	windup_left = 0.0
	think_left = offset
	state = State.IDLE
	state_left = rng.randf_range(config.wander_idle_min, config.wander_idle_max)
	path_left = 0.0
	path_destination = Vector3.INF
	path_queries = 0
	perception_queries = 0
	sight_queries = 0
	memory_left = 0.0
	target_visible = false
	far_away = false
	heard_noise = ""
	heard_serial = 0
	heard_events = 0
	interest_refresh_left = 0.0
	investigating_arrived = false
	rig.rotation = Vector3.ZERO
	_set_locomotion_animation(&"Zombie_Idle")
	focus_ring.visible = false
	if hit_feedback != null:
		hit_feedback.clear()
	get_node("HitArea").collision_layer = 2

func refresh_stats(clock: RefCounted) -> void:
	if not active:
		return
	var next_max_hp: float = data.max_hp * clock.hp_multiplier()
	if not is_equal_approx(max_hp, next_max_hp):
		# Phase/threat changes preserve injury instead of refilling or compounding base HP.
		hp = next_max_hp * clampf(hp / max_hp, 0.0, 1.0)
		max_hp = next_max_hp
		hp_bar.set_ratio(hp / max_hp)
	attack_damage = data.attack_damage * clock.damage_multiplier()
	visual_multiplier = clock.perception_multiplier()
	hearing_scale = clock.perception_multiplier(true)
	speed_multiplier = clock.movement_multiplier()

func configure_encounter(settings: Resource, seed_value: int) -> void:
	config = settings
	rng.seed = seed_value
	if animation_controller != null:
		animation_controller.configure(animation_player, rng)
	home_position = position
	interest_position = position
	state_left = rng.randf_range(config.wander_idle_min, config.wander_idle_max)
	rig.rotation.y = rng.randf_range(-PI, PI)

func tick(delta: float, mission: Node3D) -> void:
	if hit_feedback != null:
		hit_feedback.advance(delta)
	if not active:
		return
	attack_left = maxf(0, attack_left - delta)
	path_left = maxf(0, path_left - delta)
	state_left = maxf(0, state_left - delta)
	interest_refresh_left = maxf(0, interest_refresh_left - delta)
	memory_left = maxf(0, memory_left - delta)
	if target != null and (not is_instance_valid(target) or target.dead or target.inside_building or target.boarding):
		target = null
		_enter_idle()
		_cancel_windup()
	if attack_target != null:
		windup_left = maxf(0, windup_left - delta)
		if windup_left <= 0.000001:
			_resolve_attack(mission)
		return
	think_left -= delta
	if think_left <= 0:
		_observe(mission)
		think_left = config.far_tick * rng.randf_range(0.85, 1.15) if far_away else rng.randf_range(config.perception_tick_min, config.perception_tick_max)
	if target != null and memory_left <= 0:
		target = null
		investigate(last_seen_position)
	if target != null:
		state = State.CHASE
		_set_locomotion_animation(&"Zombie_Chase")
		if target_visible and position.distance_to(target.position) <= data.attack_range and mission.city.line_clear(position, target.position):
			state = State.ATTACK
			var facing: Vector3 = position.direction_to(target.position)
			rig.rotation.y = atan2(-facing.x, -facing.z)
			if attack_left <= 0.000001:
				attack_left = data.attack_cooldown
				windup_left = data.attack_windup
				attack_target = target
				if windup_left <= 0:
					_resolve_attack(mission)
			return
		_update_path(mission, last_seen_position)
	elif state == State.IDLE and state_left <= 0:
		_start_wander(mission)
	elif state == State.WANDER and path.is_empty():
		_enter_idle()
	elif state == State.INVESTIGATE:
		if not investigating_arrived:
			_update_path(mission, mission.city.nearest_open(interest_position))
			if path.is_empty() or position.distance_to(path_destination) < 0.6:
				investigating_arrived = true
				state_left = config.investigate_wait
				path.clear()
		elif state_left <= 0:
			home_position = position
			_enter_idle()
	var speed: float = data.move_speed * speed_multiplier * (config.wander_speed_multiplier if state == State.WANDER else 1.0)
	if state == State.WANDER or state == State.INVESTIGATE:
		_set_locomotion_animation(&"Zombie_Walk")
	elif state == State.IDLE:
		_set_locomotion_animation(&"Zombie_Idle")
	if state == State.INVESTIGATE:
		speed *= config.investigate_speed_multiplier
	_move_path(delta * speed, delta)

func investigate(point: Vector3) -> void:
	if not active or target != null:
		return
	state = State.INVESTIGATE
	interest_position = point
	investigating_arrived = false
	path.clear()
	path_left = 0
	path_destination = Vector3.INF
	think_left = minf(think_left, config.perception_tick_max)

func hear_noise(event: RefCounted, city: Node3D) -> bool:
	if not active or target != null or state == State.ATTACK or interest_refresh_left > 0:
		return false
	var radius: float = event.radius * event.intensity * config.hearing_multiplier * hearing_scale
	var distance: float = position.distance_to(event.world_position)
	if distance > radius:
		return false
	if not city.line_clear(position, event.world_position):
		radius *= config.noise_obstacle_multiplier
	if distance > radius:
		return false
	heard_noise = event.type_name()
	heard_serial = event.serial
	heard_events += 1
	interest_refresh_left = config.interest_refresh_seconds
	investigate(event.world_position)
	return true

func can_see(member: Node3D, mission: Node3D) -> bool:
	if member.dead or member.inside_building or member.boarding:
		return false
	var offset: Vector3 = member.position - position
	offset.y = 0
	if offset.length_squared() > pow(config.visual_range_day * visual_multiplier, 2):
		return false
	var forward: Vector3 = -rig.basis.z
	if offset.length() > data.attack_range and forward.dot(offset.normalized()) < cos(deg_to_rad(config.visual_fov * 0.5)):
		return false
	sight_queries += 1
	# This grid is projected from the real static colliders and also blocks bullets.
	return mission.city.line_clear(position, member.position)

func _observe(mission: Node3D) -> void:
	perception_queries += 1
	var nearest_distance: float = INF
	var best_distance: float = INF
	var candidate: Node3D
	for member: Node3D in mission.survivors:
		if member.dead or member.inside_building or member.boarding:
			continue
		var distance: float = position.distance_squared_to(member.position)
		nearest_distance = minf(nearest_distance, distance)
		if distance < best_distance and can_see(member, mission):
			candidate = member
			best_distance = distance
	far_away = nearest_distance > config.far_distance * config.far_distance
	target_visible = candidate != null
	if candidate != null:
		if target != candidate:
			path_left = 0
		target = candidate
		last_seen_position = candidate.position
		memory_left = config.target_memory_seconds

func _enter_idle() -> void:
	state = State.IDLE
	_set_locomotion_animation(&"Zombie_Idle")
	path.clear()
	state_left = rng.randf_range(config.wander_idle_min, config.wander_idle_max)

func _start_wander(mission: Node3D) -> void:
	var angle := rng.randf_range(-PI, PI)
	var destination: Vector3 = home_position + Vector3(cos(angle), 0, sin(angle)) * rng.randf_range(1.5, config.wander_radius)
	destination = mission.city.nearest_open(destination)
	path_left = 0
	_update_path(mission, destination)
	state = State.WANDER
	_set_locomotion_animation(&"Zombie_Walk")
	if path.is_empty():
		_enter_idle()

func _update_path(mission: Node3D, destination: Vector3) -> void:
	if path_left > 0:
		return
	if not path.is_empty() and path_destination.distance_to(destination) < config.path_target_distance:
		return
	path_left = (config.far_path_interval if far_away else config.path_update_interval) * rng.randf_range(0.85, 1.15)
	path_destination = destination
	path = mission.city.path(position, destination)
	path_queries += 1

func _move_path(budget: float, delta: float) -> void:
	var start_position: Vector3 = position
	while not path.is_empty() and budget > 0:
		var length := position.distance_to(path[0])
		if length <= budget:
			position = path[0]
			path.remove_at(0)
			budget -= length
		else:
			var direction := position.direction_to(path[0])
			position += direction * budget
			rig.rotation.y = atan2(-direction.x, -direction.z)
			budget = 0
	if animation_controller != null:
		var moved: float = position.distance_to(start_position)
		animation_controller.update_motion_speed(moved / maxf(0.001, delta), data.move_speed * speed_multiplier)

func apply_hit(event: RefCounted) -> void:
	if event == null:
		return
	take_damage(DamageResolverData.resolve(event), event.source)

func apply_hit_feedback(_event: RefCounted) -> void:
	if hit_feedback != null:
		hit_feedback.trigger()

func take_damage(amount: float, source: Node = null) -> void:
	if not active:
		return
	hp = maxf(0, hp - amount)
	hp_bar.set_ratio(hp / max_hp)
	if hp <= 0:
		death_source = source
		active = false
		state = State.DEAD
		target = null
		path.clear()
		visible = false
		collision_disable()

func collision_disable() -> void:
	_cancel_windup()
	for child in get_children():
		if child is Area3D:
			child.collision_layer = 0

func _find_animation_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child in node.get_children():
		var found: AnimationPlayer = _find_animation_player(child)
		if found != null:
			return found
	return null

func _set_locomotion_animation(animation_name: StringName) -> void:
	if animation_player == null or locomotion_animation == animation_name:
		return
	locomotion_animation = animation_name
	if animation_controller != null:
		animation_controller.set_locomotion(animation_name)
	elif animation_player.has_animation(animation_name):
		animation_player.play(animation_name, 0.15)

func _cancel_windup() -> void:
	attack_target = null
	windup_left = 0.0

func _resolve_attack(mission: Node3D) -> void:
	# A committed swing cannot switch victims or hit through newly interposed cover.
	if is_instance_valid(attack_target) and not attack_target.dead and not attack_target.inside_building:
		if position.distance_to(attack_target.position) <= data.attack_range and mission.city.line_clear(position, attack_target.position):
			var damage_tags: Array[String] = ["infected"]
			attack_target.take_damage(attack_damage, mission.invincible, damage_tags)
			mission.effects_hit(position, attack_target.position, Color("#f4756e"))
	_cancel_windup()
