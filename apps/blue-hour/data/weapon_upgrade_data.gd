class_name WeaponUpgradeData
extends Resource
## Inert upgrade offer data; selecting an offer is handled by a later save transaction.

enum UpgradeType {
	WEAPON_SPECIFIC,
	GENERAL,
	ROUTE,
}

const ModifierRegistry = preload("res://data/weapon_modifier_registry.gd")
const WeaponRegistry = preload("res://data/weapon_registry.gd")
const STAT_IDS: Array[String] = [
	"damage", "attack_rate", "magazine_size", "reload_time", "accuracy",
	"range", "penetration", "knockback", "pellet_count",
]

@export var id: String = ""
@export var weapon_id: String = "*"
@export_range(2, 3, 1) var level: int = 2
@export var name: String = ""
@export_multiline var description: String = ""
@export var upgrade_type: UpgradeType = UpgradeType.WEAPON_SPECIFIC
@export var modifier_additions: Array[String] = []
@export var stat_changes: Array[Dictionary] = []
@export var requirements: Array[Dictionary] = []
@export var weight: float = 1.0
@export var conflict_group: StringName = &""

var upgrade_level: int:
	get: return level
	set(value): level = value

var options: Array[String]:
	get: return modifier_additions
	set(value): modifier_additions = value

func validation_errors() -> Array[String]:
	var errors: Array[String] = []
	if id.is_empty() or name.is_empty() or description.is_empty():
		errors.append("Upgrade data needs an ID, name, and description: " + id)
	if weapon_id != "*" and (WeaponRegistry.canonical_id(weapon_id) != weapon_id or not _weapon_id_exists(weapon_id)):
		errors.append("Upgrade data references an unknown or legacy weapon ID: " + id)
	if level < 2 or level > 3:
		errors.append("Upgrade level must be 2 or 3: " + id)
	if upgrade_type not in [UpgradeType.WEAPON_SPECIFIC, UpgradeType.GENERAL, UpgradeType.ROUTE]:
		errors.append("Invalid upgrade type: " + id)
	if upgrade_type == UpgradeType.GENERAL and weapon_id != "*":
		errors.append("General upgrades must use the wildcard weapon ID: " + id)
	if upgrade_type == UpgradeType.WEAPON_SPECIFIC and weapon_id == "*":
		errors.append("Weapon-specific upgrades need a concrete weapon ID: " + id)
	if modifier_additions.is_empty() and stat_changes.is_empty():
		errors.append("Upgrade data must define a modifier or stat change: " + id)
	var seen_modifiers: Array[String] = []
	for modifier_id: String in modifier_additions:
		if not ModifierRegistry.has_id(modifier_id) or modifier_id in seen_modifiers:
			errors.append("Invalid or duplicate upgrade modifier: " + id + ": " + modifier_id)
		seen_modifiers.append(modifier_id)
	for change: Dictionary in stat_changes:
		var stat_id := str(change.get("stat", ""))
		var operation := str(change.get("operation", ""))
		var value: Variant = change.get("value")
		if stat_id not in STAT_IDS or operation not in ["ADD", "MULTIPLY", "SET"]:
			errors.append("Invalid upgrade stat change schema: " + id)
		elif not (value is int or value is float) or not is_finite(float(value)):
			errors.append("Invalid upgrade stat change value: " + id + ": " + stat_id)
	for requirement: Dictionary in requirements:
		if not _valid_requirement(requirement):
			errors.append("Invalid upgrade requirement: " + id)
	if not is_finite(weight) or weight <= 0.0:
		errors.append("Upgrade weight must be finite and positive: " + id)
	return errors

static func _weapon_id_exists(value: String) -> bool:
	for definition: Resource in WeaponRegistry.definitions():
		if definition.id == value:
			return true
	return false

static func _valid_requirement(requirement: Dictionary) -> bool:
	match str(requirement.get("kind", "")):
		"HAS_MODIFIER":
			if requirement.size() != 2 or not requirement.get("modifier_id") is String:
				return false
			return ModifierRegistry.has_id(requirement.modifier_id)
		"HAS_TAG":
			return requirement.size() == 2 and requirement.get("tag") is String and not requirement.tag.is_empty()
		"RARITY_AT_LEAST":
			return requirement.size() == 2 and requirement.get("tier") is int and requirement.tier >= 0 and requirement.tier <= 4
		"UPGRADE_LEVEL_EQUALS":
			return requirement.size() == 2 and requirement.get("level") is int and requirement.level >= 1 and requirement.level <= 3
	return false
