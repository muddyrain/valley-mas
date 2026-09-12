extends Node3D
const Visuals = preload("res://vfx/visuals.gd")
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
var path := PackedVector3Array()
var rig: Node3D
var hp_bar: MeshInstance3D
var focus_ring: MeshInstance3D

func setup(spec: Resource, offset: float, clock: RefCounted) -> void:
	data = spec
	rig = get_node("VisualRig")
	hp_bar = Visuals.box(self, Vector3(0.65, 0.05, 0.08), get_node("HealthAnchor").position, Color("#ef7a73"), true)
	focus_ring = Visuals.ring(self, Vector3(0, 0.09, 0), data.collision_radius + 0.15, Color("#ff665e"))
	var area: Area3D = get_node("HitArea")
	area.set_meta("enemy", self)
	var collision: CollisionShape3D = area.get_node("CollisionShape3D")
	collision.shape.radius = data.collision_radius
	reset_for_spawn(offset, clock)

func reset_for_spawn(offset: float, clock: RefCounted) -> void:
	max_hp = data.max_hp * clock.hp_multiplier()
	attack_damage = data.attack_damage * clock.damage_multiplier()
	hp = max_hp
	hp_bar.scale.x = 1.0
	active = true
	visible = true
	path.clear()
	target = null
	attack_target = null
	attack_left = 0.0
	windup_left = 0.0
	think_left = offset
	rig.rotation = Vector3.ZERO
	focus_ring.visible = false
	get_node("HitArea").collision_layer = 2

func refresh_stats(clock: RefCounted) -> void:
	if not active:
		return
	var next_max_hp: float = data.max_hp * clock.hp_multiplier()
	if not is_equal_approx(max_hp, next_max_hp):
		# Phase/threat changes preserve injury instead of refilling or compounding base HP.
		hp = next_max_hp * clampf(hp / max_hp, 0.0, 1.0)
		max_hp = next_max_hp
		hp_bar.scale.x = maxf(0.01, hp / max_hp)
	attack_damage = data.attack_damage * clock.damage_multiplier()

func tick(delta: float, mission: Node3D) -> void:
	if not active:
		return
	attack_left = maxf(0, attack_left - delta)
	if target != null and (not is_instance_valid(target) or target.dead or position.distance_to(target.position) > data.lose_target_range):
		target = null
		path.clear()
		_cancel_windup()
	if attack_target != null:
		windup_left = maxf(0, windup_left - delta)
		if windup_left <= 0.000001:
			_resolve_attack(mission)
		return
	think_left -= delta
	if think_left <= 0:
		think_left = 0.55
		if target == null:
			var candidate: Node3D = mission.nearest_survivor(position)
			if candidate != null and position.distance_to(candidate.position) <= data.detection_range:
				target = candidate
		if target != null:
			path = mission.city.path(position, target.position)
		else:
			path.clear()
	if target == null or target.dead:
		return
	var distance := position.distance_to(target.position)
	if distance <= data.attack_range and mission.city.line_clear(position, target.position):
		var facing: Vector3 = position.direction_to(target.position)
		rig.rotation.y = atan2(-facing.x, -facing.z)
		if attack_left <= 0.000001:
			attack_left = data.attack_cooldown
			windup_left = data.attack_windup
			attack_target = target
			if windup_left <= 0:
				_resolve_attack(mission)
	elif not path.is_empty():
		var budget: float = delta * data.move_speed
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

func take_damage(amount: float) -> void:
	if not active:
		return
	hp = maxf(0, hp - amount)
	hp_bar.scale.x = maxf(0.01, hp / max_hp)
	if hp <= 0:
		active = false
		visible = false
		collision_disable()

func collision_disable() -> void:
	_cancel_windup()
	for child in get_children():
		if child is Area3D:
			child.collision_layer = 0

func _cancel_windup() -> void:
	attack_target = null
	windup_left = 0.0

func _resolve_attack(mission: Node3D) -> void:
	# A committed swing cannot switch victims or hit through newly interposed cover.
	if is_instance_valid(attack_target) and not attack_target.dead:
		if position.distance_to(attack_target.position) <= data.attack_range and mission.city.line_clear(position, attack_target.position):
			attack_target.take_damage(attack_damage, mission.invincible)
			mission.effects_hit(position, attack_target.position, Color("#f4756e"))
	_cancel_windup()
