class_name WeaponCombatController
extends RefCounted
## Both autonomous target selection and directed commands enter try_attack().
signal fired(pellets: Array)
signal hit_resolved(event: RefCounted)
signal reload_started
signal reload_finished

const AttackSpecData = preload("res://weapons/combat/attack_spec.gd")
const InstantResolver = preload("res://weapons/combat/instant_hit_resolver.gd")
const KNOCKBACK_DISTANCE := [0.0, 0.25, 0.55, 1.0]
var weapon: Resource
var weapon_instance: RefCounted
var weapon_uid: String = ""
var current_ammo: int = 0
var cooldown: float = 0.0
var reload_left: float = 0.0
var rng := RandomNumberGenerator.new()
var last_pellets: Array[Dictionary] = []

func equip(definition: Resource, instance: RefCounted = null, uid: String = "") -> void:
	weapon = definition
	weapon_instance = instance
	weapon_uid = uid if not uid.is_empty() else str(instance.instance_id) if instance != null else ""
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
	var spec := AttackSpecData.from_attack(member, weapon, direction.normalized(), member.position, mission.damage_to(member, target), weapon_uid, weapon_instance)
	var resolved: Dictionary = InstantResolver.resolve(member, mission, spec, target, rng)
	last_pellets = resolved.pellets
	# Resolve every pellet before moving enemies, so recoil cannot distort the same shot.
	var pushed: Array[Node3D] = []
	for impact: Dictionary in resolved.impacts:
		var enemy: Node3D = impact.enemy
		enemy.apply_hit(impact.event)
		hit_resolved.emit(impact.event)
		if enemy not in pushed and weapon.knockback > 0:
			pushed.append(enemy)
	for enemy: Node3D in pushed:
		if enemy.active:
			var destination: Vector3 = enemy.position + member.position.direction_to(enemy.position) * KNOCKBACK_DISTANCE[weapon.knockback] * (1.0 - enemy.data.knockback_resistance)
			if mission.city.line_clear(enemy.position, destination):
				enemy.position = destination
				enemy.path.clear()
				enemy.think_left = 0.0
	mission.sound.play_cue("melee" if weapon.melee else "shot", weapon.sound_pitch)
	mission.noise.emit_weapon(member.position, weapon, member)
	fired.emit(last_pellets)
	if not weapon.melee and current_ammo == 0:
		_start_reload()
	return true

func _start_reload() -> void:
	reload_left = weapon.reload_time
	reload_started.emit()
