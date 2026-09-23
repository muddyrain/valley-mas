class_name WeaponRarityRegistry
extends RefCounted
## Resolves legacy rarity ordinals and stable rarity IDs to profile Resources.

const COMMON_ID := "COMMON"
const UNCOMMON_ID := "UNCOMMON"
const RARE_ID := "RARE"
const EPIC_ID := "EPIC"
const LEGENDARY_ID := "LEGENDARY"
const RESOURCE_IDS := [COMMON_ID, UNCOMMON_ID, RARE_ID, EPIC_ID, LEGENDARY_ID]
const EXPECTED_SLOTS := [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1]]
const HEX_DIGITS := "0123456789abcdef"
const RESOURCES := [
	preload("res://data/weapons/rarity/common.tres"),
	preload("res://data/weapons/rarity/uncommon.tres"),
	preload("res://data/weapons/rarity/rare.tres"),
	preload("res://data/weapons/rarity/epic.tres"),
	preload("res://data/weapons/rarity/legendary.tres"),
]

static func definitions() -> Array[Resource]:
	var result: Array[Resource] = []
	for profile: Resource in RESOURCES:
		result.append(profile)
	return result

static func by_id(id: String) -> WeaponRarityProfileData:
	var stable_id := EPIC_ID if id == "SPECIAL" else id
	for resource: Resource in RESOURCES:
		var profile := resource as WeaponRarityProfileData
		if profile.id == stable_id:
			return profile
	return null

static func by_tier(tier: int) -> WeaponRarityProfileData:
	for resource: Resource in RESOURCES:
		var profile := resource as WeaponRarityProfileData
		if profile.tier == tier:
			return profile
	return null

static func validate() -> Array[String]:
	return validate_resources(definitions())

static func validate_resources(resources: Array[Resource]) -> Array[String]:
	var errors: Array[String] = []
	var seen_ids: Array[String] = []
	var seen_tiers: Array[int] = []
	for resource: Resource in resources:
		if not resource is WeaponRarityProfileData:
			errors.append("Invalid weapon rarity profile resource")
			continue
		var profile: WeaponRarityProfileData = resource as WeaponRarityProfileData
		if profile.id.is_empty() or profile.id in seen_ids:
			errors.append("Empty or duplicate weapon rarity ID: " + profile.id)
		seen_ids.append(profile.id)
		if profile.tier < 0 or profile.tier > 4 or profile.tier in seen_tiers:
			errors.append("Invalid or duplicate weapon rarity tier: " + profile.id)
		seen_tiers.append(profile.tier)
		var expected_index: int = RESOURCE_IDS.find(profile.id)
		if expected_index < 0 or profile.tier != expected_index:
			errors.append("Weapon rarity ID and tier do not match: " + profile.id)
		if profile.display_name.is_empty() or not _valid_color_key(profile.color_key):
			errors.append("Weapon rarity profile needs a name and valid color: " + profile.id)
		if not is_finite(profile.drop_weight) or profile.drop_weight <= 0.0:
			errors.append("Invalid weapon rarity drop weight: " + profile.id)
		if expected_index >= 0 and (profile.modifier_slots != EXPECTED_SLOTS[expected_index][0] or profile.special_effect_slots != EXPECTED_SLOTS[expected_index][1]):
			errors.append("Weapon rarity slot contract mismatch: " + profile.id)
		var allowed_seen: Array[String] = []
		for allowed_id: String in profile.allowed_modifier_rarity:
			if allowed_id not in RESOURCE_IDS or allowed_id in allowed_seen:
				errors.append("Invalid allowed modifier rarity: " + profile.id + ": " + allowed_id)
			allowed_seen.append(allowed_id)
	if seen_ids.size() != RESOURCE_IDS.size() or seen_tiers.size() != RESOURCE_IDS.size():
		errors.append("Weapon rarity registry must define all five unique tiers")
	for expected_tier: int in range(RESOURCE_IDS.size()):
		if by_id_in(resources, RESOURCE_IDS[expected_tier]) == null or expected_tier not in seen_tiers:
			errors.append("Missing weapon rarity profile: " + RESOURCE_IDS[expected_tier])
	return errors

static func _valid_color_key(value: String) -> bool:
	if value.length() != 7 or not value.begins_with("#"):
		return false
	for index: int in range(1, value.length()):
		if not HEX_DIGITS.contains(value.substr(index, 1).to_lower()):
			return false
	return true

static func by_id_in(resources: Array[Resource], id: String) -> WeaponRarityProfileData:
	for resource: Resource in resources:
		if resource is WeaponRarityProfileData and (resource as WeaponRarityProfileData).id == id:
			return resource as WeaponRarityProfileData
	return null
