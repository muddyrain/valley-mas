extends RefCounted
enum NoiseType { ARRIVAL, FOOTSTEP, MELEE, PISTOL, RIFLE, SHOTGUN, EXPLOSION, SEARCH, SEARCH_COMPLETE }
var world_position := Vector3.ZERO
var radius: float = 0.0
var intensity: float = 1.0
var source: WeakRef
var noise_type: NoiseType = NoiseType.ARRIVAL
var emitted_at: float = 0.0
var serial: int = 0
var listeners: int = 0
var awakened: int = 0

func type_name() -> String:
	return NoiseType.keys()[noise_type]
