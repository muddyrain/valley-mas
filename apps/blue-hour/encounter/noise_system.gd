extends RefCounted
signal noise_emitted(event: RefCounted)
const Event = preload("res://encounter/noise_event.gd")
var config: Resource
var events: Array[RefCounted] = []
var elapsed: float = 0.0
var total_emitted: int = 0
var counts: Dictionary = {}
var last_loud_position := Vector3.ZERO
var last_loud_time: float = -INF

func _init(settings: Resource) -> void:
	config = settings

func emit_noise(point: Vector3, radius: float, type: int, intensity: float = 1.0, source: Node = null) -> RefCounted:
	if radius <= 0 or intensity <= 0 or not point.is_finite() or not is_finite(radius) or not is_finite(intensity):
		return null
	var event := Event.new()
	event.world_position = point
	event.radius = radius
	event.intensity = intensity
	event.noise_type = type
	event.source = weakref(source) if source != null else null
	event.emitted_at = elapsed
	total_emitted += 1
	event.serial = total_emitted
	events.append(event)
	if events.size() > config.noise_event_limit:
		events.pop_front()
	counts[event.type_name()] = int(counts.get(event.type_name(), 0)) + 1
	if radius >= config.pistol_noise_radius:
		last_loud_position = point
		last_loud_time = elapsed
	noise_emitted.emit(event)
	return event

func advance(delta: float) -> void:
	elapsed += maxf(0, delta)
	while not events.is_empty() and elapsed - events[0].emitted_at > config.noise_lifetime:
		events.pop_front()

func emit_weapon(point: Vector3, weapon: Resource, source: Node) -> RefCounted:
	var type: int = Event.NoiseType.RIFLE
	var radius: float = config.rifle_noise_radius
	if weapon.melee:
		type = Event.NoiseType.MELEE
		radius = config.melee_noise_radius
	elif weapon.pellet_count > 1:
		type = Event.NoiseType.SHOTGUN
		radius = config.shotgun_noise_radius
	elif weapon.weapon_type == weapon.WeaponType.SIDEARM:
		type = Event.NoiseType.PISTOL
		radius = config.pistol_noise_radius
	return emit_noise(point, radius, type, 1.0, source)
