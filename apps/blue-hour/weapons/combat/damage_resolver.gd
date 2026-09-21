class_name DamageResolver
extends RefCounted
## Phase 1A compatibility boundary. Future damage rules can resolve here without changing targets.

static func resolve(event: RefCounted) -> float:
	if event == null:
		return 0.0
	return float(event.damage)
