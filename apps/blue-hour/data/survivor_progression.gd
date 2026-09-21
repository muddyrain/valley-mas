class_name SurvivorProgression
extends RefCounted
## Persistent survivor growth state. Current XP is progress within the current level.

enum EventType {
	SEARCH_COMPLETE,
	KILL_ENEMY,
	MISSION_COMPLETE,
	EXTRACTION_SUCCESS,
	SPECIAL_EVENT,
}

const MAX_LEVEL: int = 5
const XP_REQUIREMENTS: Array[int] = [2, 3, 5, 8]
const XP_EVENT_VALUES: Dictionary = {
	EventType.SEARCH_COMPLETE: 1,
	EventType.KILL_ENEMY: 1,
	EventType.MISSION_COMPLETE: 5,
	EventType.EXTRACTION_SUCCESS: 3,
	EventType.SPECIAL_EVENT: 1,
}

var survivor_id: String = ""
var current_level: int = 1
var current_xp: int = 0
var total_xp: int = 0
var xp_to_next_level: int = XP_REQUIREMENTS[0]

func _init(id: String = "", level: int = 1, xp: int = 0, lifetime_xp: int = 0) -> void:
	survivor_id = id
	current_level = clampi(level, 1, MAX_LEVEL)
	current_xp = maxi(0, xp)
	total_xp = maxi(0, lifetime_xp)
	_normalize()

static func from_state(id: String, state: Dictionary) -> SurvivorProgression:
	var level: int = int(state.get("current_level", state.get("level", 1)))
	var xp: int = int(state.get("current_xp", state.get("xp", 0)))
	var lifetime_xp: int = int(state.get("total_xp", _minimum_total_xp(level)))
	return SurvivorProgression.new(id, level, xp, lifetime_xp)

static func xp_required_for_level(level: int) -> int:
	return XP_REQUIREMENTS[level - 1] if level >= 1 and level <= XP_REQUIREMENTS.size() else 0

static func total_xp_for_level(level: int) -> int:
	var result: int = 0
	for index: int in range(clampi(level, 1, MAX_LEVEL) - 1):
		result += XP_REQUIREMENTS[index]
	return result

static func _minimum_total_xp(level: int) -> int:
	return total_xp_for_level(level)

func add_xp(amount: int) -> int:
	var gained: int = maxi(0, amount)
	if gained == 0:
		return 0
	total_xp += gained
	if current_level < MAX_LEVEL:
		current_xp += gained
	_normalize()
	return gained

func record_event(event_type: EventType, amount: int = 0) -> int:
	return add_xp(amount if amount > 0 else default_event_xp(event_type))

static func default_event_xp(event_type: EventType) -> int:
	return int(XP_EVENT_VALUES.get(event_type, 0))

func get_level() -> int:
	return current_level

func get_trait_level() -> int:
	return current_level

func can_level_up() -> bool:
	return current_level < MAX_LEVEL and current_xp >= xp_required_for_level(current_level)

func apply_level_up() -> bool:
	if not can_level_up():
		return false
	current_xp -= xp_required_for_level(current_level)
	current_level += 1
	_normalize()
	return true

func to_dict() -> Dictionary:
	return {
		"survivor_id": survivor_id,
		"current_level": current_level,
		"current_xp": current_xp,
		"total_xp": total_xp,
		"xp_to_next_level": xp_to_next_level,
	}

func is_valid() -> bool:
	return not survivor_id.is_empty() and current_level >= 1 and current_level <= MAX_LEVEL and current_xp >= 0 and total_xp >= 0 and xp_to_next_level >= 0 and (current_level == MAX_LEVEL or current_xp < xp_required_for_level(current_level))

func _normalize() -> void:
	xp_to_next_level = xp_required_for_level(current_level) - current_xp if current_level < MAX_LEVEL else 0
