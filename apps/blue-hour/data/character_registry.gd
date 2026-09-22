extends Node3D
# Character Registry - 统一角色数据来源
class_name CharacterRegistry

static var _catalog: RefCounted = null

static func _ensure_catalog() -> void:
	if _catalog == null:
		_catalog = load("res://data/catalog.gd").new()

static func get_definition(character_id: String) -> Resource:
	_ensure_catalog()
	return _catalog.by_id(_catalog.survivors, character_id)

static func get_trait(trait_id: String) -> Resource:
	_ensure_catalog()
	return _catalog.by_id(_catalog.traits, trait_id)

static func get_profile(survivor_key: String) -> Resource:
	_ensure_catalog()
	var profile: Resource = _catalog.by_id(_catalog.profiles, survivor_key)
	if profile != null:
		return profile
	var definition: Resource = get_definition(survivor_key)
	if definition == null:
		return null
	return _catalog.by_id(_catalog.profiles, definition.survivor_id)

static func all_survivors() -> Array[Resource]:
	_ensure_catalog()
	return _catalog.survivors

static func all_traits() -> Array[Resource]:
	_ensure_catalog()
	return _catalog.traits

static func all_profiles() -> Array[Resource]:
	_ensure_catalog()
	return _catalog.profiles
