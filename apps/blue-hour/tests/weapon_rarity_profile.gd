extends SceneTree

const Registry = preload("res://data/weapon_rarity_registry.gd")
const ProfileData = preload("res://data/weapon_rarity_profile_data.gd")

var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func run() -> void:
	var profiles: Array[Resource] = Registry.definitions()
	var ids: Array[String] = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]
	var slots := [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1]]
	var colors: Array[String] = ["#97afbc", "#87ba98", "#78b8e2", "#ad7fd1", "#e8b36a"]
	check(Registry.validate().is_empty(), "Rarity profiles validate")
	check(profiles.size() == ids.size(), "All five rarity Resources are registered")
	for tier: int in range(mini(profiles.size(), ids.size())):
		var profile: ProfileData = profiles[tier] as ProfileData
		check(profile.id == ids[tier] and profile.tier == tier, "Rarity identity remains stable: " + ids[tier])
		check(profile.display_name.length() > 0 and profile.color_key == colors[tier], "Rarity label and color are data-driven: " + ids[tier])
		check(profile.modifier_slots == slots[tier][0] and profile.special_effect_slots == slots[tier][1], "Rarity slot contract: " + ids[tier])
		check(profile.drop_weight == 1.0, "Current drop weight remains unchanged: " + ids[tier])
		check(Registry.by_id(profile.id) == profile and Registry.by_tier(tier) == profile, "ID and tier lookup: " + ids[tier])
	check(Registry.by_id("SPECIAL") == Registry.by_id("EPIC"), "Legacy SPECIAL ID aliases EPIC")
	check(Registry.by_tier(3).id == "EPIC", "Legacy ordinal 3 resolves to EPIC")
	var duplicate: Resource = (Registry.by_id("COMMON") as Resource).duplicate()
	var duplicate_profiles := Registry.definitions()
	duplicate_profiles.append(duplicate)
	check(not Registry.validate_resources(duplicate_profiles).is_empty(), "Duplicate IDs and tiers are rejected")
	var invalid_color: ProfileData = (Registry.by_id("RARE") as ProfileData).duplicate()
	invalid_color.color_key = "invalid"
	var malformed_profiles := Registry.definitions()
	malformed_profiles[2] = invalid_color
	check(not Registry.validate_resources(malformed_profiles).is_empty(), "Malformed colors are rejected")
	var invalid_slots: ProfileData = (Registry.by_id("LEGENDARY") as ProfileData).duplicate()
	invalid_slots.modifier_slots -= 1
	var slot_profiles := Registry.definitions()
	slot_profiles[4] = invalid_slots
	check(not Registry.validate_resources(slot_profiles).is_empty(), "Contract slot changes are rejected")
	print("WEAPON RARITY PROFILES: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
