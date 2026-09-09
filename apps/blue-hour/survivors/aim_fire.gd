extends RefCounted
# Hitscan in the ground plane, using the same range, cover and weapon stats as auto fire.
const Visuals = preload("res://vfx/visuals.gd")

static func fire(member: Node3D, mission: Node3D, point: Vector3) -> void:
	var weapon: Resource = member.weapon
	var direction := member.position.direction_to(point)
	var reach: float = weapon.attack_range
	for distance in range(1, ceili(reach * 4) + 1):
		var sample := member.position + direction * minf(reach, distance / 4.0)
		if not mission.city.line_clear(member.position, sample):
			reach = maxf(0.0, (distance - 1) / 4.0)
			break
	var candidates: Array[Node3D] = []
	for enemy in mission.enemies:
		if not enemy.active or not mission._can_hit(member, enemy):
			continue
		var offset: Vector3 = enemy.position - member.position
		var along := offset.dot(direction)
		if along < 0 or along > reach:
			continue
		var width: float = 0.55 + (along * tan(deg_to_rad(weapon.cone_degrees)) if weapon.target_count > 1 else 0.0)
		if (offset - direction * along).length() <= width:
			candidates.append(enemy)
	candidates.sort_custom(func(a, b): return member.position.distance_squared_to(a.position) < member.position.distance_squared_to(b.position))
	var endpoint: Vector3 = member.position + direction * reach
	for i in range(mini(weapon.target_count, candidates.size())):
		var enemy := candidates[i]
		enemy.take_damage(weapon.damage * member.talent.damage_multiplier)
		if i == 0 and weapon.target_count == 1:
			endpoint = enemy.position
	Visuals.tracer(mission, member.position + Vector3.UP, endpoint + Vector3.UP, weapon.color)
	mission.sound.play_cue("shot", weapon.sound_pitch)
