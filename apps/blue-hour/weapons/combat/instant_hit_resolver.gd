class_name InstantHitResolver
extends RefCounted
## Resolves the existing geometric instant-hit rules and emits HitEvents.

const BuffEffectHandler = preload("res://core/buff_effect_handler.gd")

static func resolve(member: Node3D, mission: Node3D, spec: AttackSpec, target: Node3D = null, random: RandomNumberGenerator = null) -> Dictionary:
	var pellets: Array[Dictionary] = []
	var impacts: Array[Dictionary] = []
	var origin: Vector3 = spec.origin
	for i in range(spec.pellet_count):
		var ray: Vector3 = spec.direction
		if not spec.weapon.melee:
			var accuracy: float = float(spec.weapon.accuracy)
			var cone: float = float(spec.weapon.spread_angle) * (maxf(0.0, 1.0 - accuracy) / 0.3 if spec.pellet_count > 1 else 1.0 - accuracy)
			var fraction: float = (float(i) + (random.randf() if random != null else randf())) / spec.pellet_count - 0.5
			ray = spec.direction.rotated(Vector3.UP, deg_to_rad(fraction * cone))
		var endpoint: Vector3 = origin + ray * spec.range
		var hits: Array[Dictionary] = []
		if spec.weapon.melee:
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
				if entry <= spec.range and mission.city.line_clear(origin, origin + ray * entry):
					hits.append({"enemy": enemy, "distance": entry})
			hits.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.distance < b.distance)
			hits = hits.slice(0, spec.penetration + 1)
			if not hits.is_empty():
				endpoint = origin + ray * float(hits.back().distance)
			elif not mission.city.line_clear(origin, endpoint):
				var low := 0.0
				var high: float = spec.range
				for _step in range(12):
					var mid := (low + high) * 0.5
					if mission.city.line_clear(origin, origin + ray * mid):
						low = mid
					else:
						high = mid
				endpoint = origin + ray * low
		var pellet_hits: Array[Dictionary] = []
		for hit_index in range(hits.size()):
			var enemy: Node3D = hits[hit_index].enemy
			var damage: float = spec.damage * pow(spec.penetration_damage_multiplier, hit_index)
			var critical: bool = BuffEffectHandler.roll_critical(member, random)
			if critical:
				damage *= BuffEffectHandler.CRITICAL_DAMAGE_MULTIPLIER
			var event := make_hit_event(spec, enemy, origin + ray * float(hits[hit_index].distance), ray, damage, hit_index, critical)
			impacts.append({"enemy": enemy, "event": event})
			pellet_hits.append({"enemy": enemy, "damage": damage, "event": event})
		pellets.append({"direction": ray, "endpoint": endpoint, "hits": pellet_hits})
	return {"pellets": pellets, "impacts": impacts}

static func make_hit_event(spec: AttackSpec, target: Node, hit_position: Vector3, direction: Vector3, damage: float, penetration_index: int = 0, critical: bool = false) -> HitEvent:
	return HitEvent.create({
		"source": spec.source,
		"weapon_id": spec.weapon_id,
		"weapon_uid": spec.weapon_uid,
		"target": target,
		"hit_position": hit_position,
		"direction": direction,
		"base_damage": spec.damage,
		"damage": damage,
		"critical": critical,
		"damage_type": spec.damage_type,
		"penetration_index": penetration_index,
		"knockback": spec.knockback,
	})
