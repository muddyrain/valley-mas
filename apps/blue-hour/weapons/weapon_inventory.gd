class_name WeaponInventory
extends RefCounted
## Uses Campaign storage; no parallel inventory or stale rollback reference.

const Instance = preload("res://weapons/weapon_instance.gd")
var _campaign: WeakRef

func _init(campaign: RefCounted) -> void:
	_campaign = weakref(campaign)

func add_weapon(value: WeaponInstance) -> bool:
	var game: RefCounted = _campaign.get_ref()
	if value == null or has_weapon(value.instance_id) or not game.gear.valid(value.to_dict()):
		return false
	game.data.inventory.append(value.to_dict())
	return true

func remove_weapon(instance_id: String) -> bool:
	var game: RefCounted = _campaign.get_ref()
	if not has_weapon(instance_id) or instance_id in game.data.equipment.values():
		return false
	game.data.inventory.erase(game.item(instance_id))
	return true

func has_weapon(instance_id: String) -> bool:
	return not _campaign.get_ref().item(instance_id).is_empty()

func get_weapon(instance_id: String) -> WeaponInstance:
	var item: Dictionary = _campaign.get_ref().item(instance_id)
	return Instance.from_dict(item) if not item.is_empty() else null

func get_all_weapons(available_only: bool = false) -> Array[WeaponInstance]:
	var game: RefCounted = _campaign.get_ref()
	var result: Array[WeaponInstance] = []
	for item: Dictionary in game.data.inventory:
		if not available_only or item.uid not in game.data.equipment.values():
			result.append(Instance.from_dict(item))
	return result
