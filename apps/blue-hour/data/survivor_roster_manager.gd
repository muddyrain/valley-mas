class_name SurvivorRosterManager
extends RefCounted
## Ownership-only layer for discovery, recruitment and party eligibility.

const LOCKED: String = "LOCKED"
const DISCOVERED: String = "DISCOVERED"
const RECRUITED: String = "RECRUITED"
const VALID_STATES: Array[String] = [LOCKED, DISCOVERED, RECRUITED]

var catalog: RefCounted
var states: Dictionary = {}

func _init(content: RefCounted, saved_states: Dictionary = {}) -> void:
	catalog = content
	_reset_defaults()
	if not saved_states.is_empty():
		restore_state(saved_states)

func _reset_defaults() -> void:
	states.clear()
	for definition: Resource in catalog.survivors:
		states[definition.survivor_id] = RECRUITED if definition.survivor_id in ["SUR_001", "SUR_002"] else LOCKED

func get_all_survivors() -> Array[Resource]:
	return catalog.survivors.duplicate()

func get_recruited_survivors() -> Array[Resource]:
	return _survivors_with_state(RECRUITED)

func get_discovered_survivors() -> Array[Resource]:
	return _survivors_with_state(DISCOVERED)

func get_available_party_survivors() -> Array[Resource]:
	return get_recruited_survivors()

func discover_survivor(id: String) -> bool:
	var key := _canonical_id(id)
	if key.is_empty() or states.get(key, LOCKED) != LOCKED:
		return false
	states[key] = DISCOVERED
	return true

func recruit_survivor(id: String) -> bool:
	var key := _canonical_id(id)
	if key.is_empty() or states.get(key, LOCKED) != DISCOVERED:
		return false
	states[key] = RECRUITED
	return true

func is_recruited(id: String) -> bool:
	var key := _canonical_id(id)
	return not key.is_empty() and states.get(key, LOCKED) == RECRUITED

func get_state(id: String) -> String:
	var key := _canonical_id(id)
	return str(states.get(key, LOCKED)) if not key.is_empty() else LOCKED

func sync_members(member_ids: Array) -> void:
	for member_id: Variant in member_ids:
		var key := _canonical_id(str(member_id))
		if not key.is_empty():
			states[key] = RECRUITED

func to_state() -> Dictionary:
	return states.duplicate(true)

func restore_state(saved_states: Dictionary) -> bool:
	if not _valid_state_dictionary(saved_states):
		return false
	for key: String in saved_states:
		states[key] = str(saved_states[key])
	return true

func validation_errors() -> Array[String]:
	var errors: Array[String] = []
	if not _valid_state_dictionary(states):
		errors.append("Invalid Survivor roster state")
	return errors

func _survivors_with_state(expected: String) -> Array[Resource]:
	var result: Array[Resource] = []
	for definition: Resource in catalog.survivors:
		if states.get(definition.survivor_id, LOCKED) == expected:
			result.append(definition)
	return result

func _canonical_id(id: String) -> String:
	for definition: Resource in catalog.survivors:
		if definition.survivor_id == id or definition.id == id:
			return definition.survivor_id
	return ""

func _valid_state_dictionary(value: Dictionary) -> bool:
	for key: String in value:
		if key not in states and not _known_survivor_id(key):
			return false
		if str(value[key]) not in VALID_STATES:
			return false
	return true

func _known_survivor_id(id: String) -> bool:
	for definition: Resource in catalog.survivors:
		if definition.survivor_id == id:
			return true
	return false
