extends Node3D
const Visuals = preload("res://vfx/visuals.gd")
var data: Resource
var hp: float
var active: bool = true
var attack_left: float = 0.0
var think_left: float = 0.0
var alarm_left: float = 0.0
var target: Node3D
var path := PackedVector3Array()
var rig: Node3D
var hp_bar: MeshInstance3D
var focus_ring: MeshInstance3D

func setup(spec: Resource, offset: float) -> void:
	data = spec
	hp = data.max_hp
	think_left = offset
	alarm_left = data.alarm_interval
	rig = Visuals.body(self, data.color, true)
	rig.scale = Vector3.ONE * data.scale_factor
	if data.id == "hound":
		rig.scale = Vector3(0.7, 0.4, 1.3)
	if data.special:
		Visuals.ring(rig, Vector3(0, 1.9, 0), 0.65, Color("#ff5964"))
		Visuals.label(self, data.display_name, Vector3(0, 3.1, 0), Color("#ff7883"), 25)
	hp_bar = Visuals.box(self, Vector3(0.9, 0.07, 0.1), Vector3(0, 2.5, 0), Color("#ef7a73"), true)
	focus_ring = Visuals.ring(self, Vector3(0, 0.09, 0), 0.8, Color("#ff665e"))
	focus_ring.visible = false
	Visuals.hit_area(self, "enemy", self)

func tick(delta: float, mission: Node3D) -> void:
	if not active:
		return
	attack_left = maxf(0, attack_left - delta)
	think_left -= delta
	if think_left <= 0:
		think_left = 0.55
		target = mission.nearest_survivor(position)
		if target != null and (mission.clock.phase == mission.clock.NIGHT or position.distance_to(target.position) <= data.perception):
			path = mission.city.path(position, target.position)
		else:
			target = null
			path.clear()
	if target == null or target.dead:
		return
	if data.special:
		alarm_left -= delta
		if alarm_left <= 0:
			alarm_left = data.alarm_interval
			mission.raise_alarm(self)
	var distance := position.distance_to(target.position)
	if distance <= data.attack_range and mission.city.line_clear(position, target.position):
		if attack_left <= 0:
			attack_left = data.attack_interval
			target.take_damage(data.damage * mission.clock.damage_multiplier(), mission.invincible)
			mission.effects_hit(position, target.position, Color("#f4756e"))
	elif not path.is_empty():
		var budget: float = delta * data.speed * mission.clock.speed_multiplier()
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
	hp_bar.scale.x = maxf(0.01, hp / data.max_hp)
	rig.scale *= 0.94
	create_tween().tween_property(rig, "scale", Vector3(0.7, 0.4, 1.3) if data.id == "hound" else Vector3.ONE * data.scale_factor, 0.12)
	if hp <= 0:
		active = false
		visible = false
		collision_disable()

func collision_disable() -> void:
	for child in get_children():
		if child is Area3D:
			child.collision_layer = 0
