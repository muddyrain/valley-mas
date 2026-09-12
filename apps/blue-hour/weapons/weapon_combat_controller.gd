class_name WeaponCombatController
extends RefCounted
## Both autonomous target selection and directed commands enter try_attack().
signal fired(pellets: Array)
signal reload_started
signal reload_finished

const Visuals = preload("res://vfx/visuals.gd")
const KNOCKBACK_DISTANCE := [0.0, 0.25, 0.55, 1.0]
var weapon: Resource
var current_ammo: int = 0
var cooldown: float = 0.0
var reload_left: float = 0.0
var rng := RandomNumberGenerator.new()
var last_pellets: Array[Dictionary] = []

func equip(definition: Resource) -> void:
	weapon = definition
	current_ammo = weapon.magazine_size if weapon != null else 0
	cooldown = 0.0
	reload_left = 0.0
	last_pellets.clear()

func tick(delta: float) -> void:
	cooldown = maxf(0.0, cooldown - delta)
	if reload_left > 0.0:
		reload_left = maxf(0.0, reload_left - delta)
		if reload_left <= 0.000001:
			reload_left = 0.0
			current_ammo = weapon.magazine_size
			reload_finished.emit()
	if weapon != null and not weapon.melee and current_ammo == 0 and reload_left == 0.0:
		_start_reload()

func try_attack(member: Node3D, mission: Node3D, point: Vector3, target: Node3D = null) -> bool:
	if weapon == null or member.dead or member.boarding or member.searching or cooldown > 0.000001 or reload_left > 0.0:
		return false
	if target != null and (not is_instance_valid(target) or not target.active or not mission._can_hit(member, target)):
		return false
	var direction: Vector3 = point - member.position
	direction.y = 0.0
	if direction.length_squared() < 0.0001:
		return false
	if weapon.melee and (target == null or direction.length() > weapon.range):
		return false
	if not weapon.melee and current_ammo <= 0:
		_start_reload()
		return false
	cooldown = member.effects.attack_interval(1.0 / weapon.attack_rate, weapon.melee)
	if not weapon.melee:
		current_ammo -= 1
	last_pellets = _resolve(member, mission, direction.normalized(), target)
	fired.emit(last_pellets)
	if not weapon.melee and current_ammo == 0:
		_start_reload()
	return true

func _start_reload() -> void:
	reload_left = weapon.reload_time
	reload_started.emit()

func _resolve(member: Node3D, mission: Node3D, direction: Vector3, target: Node3D) -> Array[Dictionary]:
	var pellets: Array[Dictionary] = []
	var impacts: Array[Dictionary] = []
	var origin: Vector3 = member.position
	for i in range(weapon.pellet_count):
		var ray: Vector3 = direction
		if not weapon.melee:
			var cone: float = weapon.spread_angle * (maxf(0.0, 1.0 - weapon.accuracy) / 0.3 if weapon.pellet_count > 1 else 1.0 - weapon.accuracy)
			# Stratification preserves a real cone without clustering all shotgun pellets.
			var fraction: float = (float(i) + rng.randf()) / weapon.pellet_count - 0.5
			ray = direction.rotated(Vector3.UP, deg_to_rad(fraction * cone))
		var endpoint: Vector3 = origin + ray * weapon.range
		var hits: Array[Dictionary] = []
		if weapon.melee:
			hits.append({"enemy": target, "distance": origin.distance_to(target.position)})
			endpoint = target.position
		else:
			for enemy: Node3D in mission.enemies:
				if not enemy.active:
					continue
				var offset: Vector3 = enemy.position - origin
				offset.y = 0.0
				var along := offset.dot(ray)
				var radius: float = enemy.data.collision_radius
				var across_squared := offset.length_squared() - along * along
				if along < 0 or across_squared > radius * radius:
					continue
				var entry := maxf(0.0, along - sqrt(maxf(0.0, radius * radius - across_squared)))
				if entry <= weapon.range and mission.city.line_clear(origin, origin + ray * entry):
					hits.append({"enemy": enemy, "distance": entry})
			hits.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.distance < b.distance)
			hits = hits.slice(0, weapon.penetration + 1)
			if not hits.is_empty():
				endpoint = origin + ray * float(hits.back().distance)
			elif not mission.city.line_clear(origin, endpoint):
				var low := 0.0
				var high: float = weapon.range
				for step in range(12):
					var mid := (low + high) * 0.5
					if mission.city.line_clear(origin, origin + ray * mid):
						low = mid
					else:
						high = mid
				endpoint = origin + ray * low
		var pellet_hits: Array[Dictionary] = []
		for hit_index in range(hits.size()):
			var enemy: Node3D = hits[hit_index].enemy
			var damage: float = mission.damage_to(member, enemy) * pow(weapon.penetration_damage_multiplier, hit_index)
			impacts.append({"enemy": enemy, "damage": damage, "direction": ray})
			pellet_hits.append({"enemy": enemy, "damage": damage})
		pellets.append({"direction": ray, "endpoint": endpoint, "hits": pellet_hits})
		Visuals.tracer(mission, origin + Vector3.UP, endpoint + Vector3.UP, weapon.color, weapon.melee)
	# Resolve every pellet before moving enemies, so recoil cannot distort the same shot.
	var pushed: Array[Node3D] = []
	for impact: Dictionary in impacts:
		var enemy: Node3D = impact.enemy
		enemy.take_damage(impact.damage)
		if enemy not in pushed and weapon.knockback > 0:
			pushed.append(enemy)
	for enemy: Node3D in pushed:
		if enemy.active:
			var destination: Vector3 = enemy.position + origin.direction_to(enemy.position) * KNOCKBACK_DISTANCE[weapon.knockback] * (1.0 - enemy.data.knockback_resistance)
			if mission.city.line_clear(enemy.position, destination):
				enemy.position = destination
				enemy.path.clear()
				enemy.think_left = 0.0
	mission.sound.play_cue("melee" if weapon.melee else "shot", weapon.sound_pitch)
	return pellets
