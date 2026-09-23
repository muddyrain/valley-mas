class_name WeaponUpgradeRegistry
extends RefCounted
## Central lookup and validation for inert weapon upgrade offers.

const UpgradeData = preload("res://data/weapon_upgrade_data.gd")
const RESOURCES = [
	preload("res://data/weapons/upgrades/p9_precision_upgrade.tres"),
	preload("res://data/weapons/upgrades/p9_fire_rate_upgrade.tres"),
	preload("res://data/weapons/upgrades/p9_magazine_upgrade.tres"),
]

static func definitions() -> Array[UpgradeData]:
	var result: Array[UpgradeData] = []
	for resource: Resource in RESOURCES:
		result.append(resource as UpgradeData)
	return result

static func by_id(id: String) -> UpgradeData:
	for resource: Resource in RESOURCES:
		var upgrade: UpgradeData = resource as UpgradeData
		if upgrade.id == id:
			return upgrade
	return null

static func validate() -> Array[String]:
	return validate_resources(definitions())

static func validate_resources(resources: Array[UpgradeData]) -> Array[String]:
	var errors: Array[String] = []
	var seen_ids: Array[String] = []
	for upgrade: UpgradeData in resources:
		if upgrade == null:
			errors.append("Null weapon upgrade resource")
			continue
		if upgrade.id.is_empty() or upgrade.id in seen_ids:
			errors.append("Empty or duplicate weapon upgrade ID: " + upgrade.id)
		seen_ids.append(upgrade.id)
		errors.append_array(upgrade.validation_errors())
	return errors
