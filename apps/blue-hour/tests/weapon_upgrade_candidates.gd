extends SceneTree

const WeaponRegistry = preload("res://data/weapon_registry.gd")
const UpgradeRegistry = preload("res://data/weapon_upgrade_registry.gd")
const UpgradeData = preload("res://data/weapon_upgrade_data.gd")
const CandidateGenerator = preload("res://weapons/upgrade_candidate_generator.gd")
const UpgradeApplier = preload("res://weapons/weapon_upgrade_applier.gd")
const Instance = preload("res://weapons/weapon_instance.gd")
const RarityRegistry = preload("res://data/weapon_rarity_registry.gd")
const ModifierRegistry = preload("res://data/weapon_modifier_registry.gd")
const Catalog = preload("res://data/catalog.gd")
const Equipment = preload("res://core/equipment.gd")

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
	var upgrades: Array[UpgradeData] = UpgradeRegistry.definitions()
	var weapon_definition: Resource = _weapon(WeaponRegistry.P9)
	var weapon := Instance.from_dict({"uid": "candidate-p9", "kind": WeaponRegistry.P9, "rarity": 2, "modifiers": []})
	var rarity := RarityRegistry.by_tier(2)
	var base_damage: float = weapon_definition.damage
	var base_attack_rate: float = weapon_definition.attack_rate
	var base_magazine: int = weapon_definition.magazine_size
	check(UpgradeRegistry.validate().is_empty(), "Upgrade Resources validate")
	check(upgrades.size() == 3, "Three P9 Level 2 offer Resources are registered")
	var precision: UpgradeData = UpgradeRegistry.by_id("P9_PRECISION_L2")
	check(precision.stat_changes.size() == 2 and is_equal_approx(float(precision.stat_changes[0].value), 1.15) and is_equal_approx(float(precision.stat_changes[1].value), 1.2), "Precision example preserves its declared preview values")
	check(is_equal_approx(float(UpgradeRegistry.by_id("P9_FIRE_RATE_L2").stat_changes[0].value), 1.25), "Fire-rate example preserves its declared preview value")
	check(is_equal_approx(float(UpgradeRegistry.by_id("P9_MAGAZINE_L2").stat_changes[0].value), 1.4), "Magazine example preserves its declared preview value")
	for upgrade: UpgradeData in upgrades:
		check(upgrade.validation_errors().is_empty(), "Valid upgrade contract: " + upgrade.id)
		check(upgrade.level == 2 and upgrade.upgrade_level == 2 and upgrade.options == upgrade.modifier_additions, "Frozen contract aliases resolve: " + upgrade.id)
	var rng := RandomNumberGenerator.new()
	rng.seed = 4081
	var offers := CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, upgrades, rng)
	check(offers.size() == 3, "Generator returns three available offers")
	var offer_ids: Array[String] = []
	for offer: UpgradeData in offers:
		offer_ids.append(offer.id)
	check(offer_ids.has("P9_PRECISION_L2") and offer_ids.has("P9_FIRE_RATE_L2") and offer_ids.has("P9_MAGAZINE_L2"), "P9 examples are eligible")
	check(offer_ids.size() == 3, "Offers are sampled without replacement")
	var repeat_rng := RandomNumberGenerator.new()
	repeat_rng.seed = 4081
	var repeat_offers := CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, upgrades, repeat_rng)
	check(_ids(offers) == _ids(repeat_offers), "Candidate order is deterministic for a fixed seed")
	var one_rng := RandomNumberGenerator.new()
	one_rng.seed = 4081
	check(CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, upgrades, one_rng, 1).size() == 1, "Candidate count can be bounded")
	var wrong_weapon_rng := RandomNumberGenerator.new()
	wrong_weapon_rng.seed = 9
	check(CandidateGenerator.generate(weapon, _weapon(WeaponRegistry.A21), rarity, 1, upgrades, wrong_weapon_rng).is_empty(), "Instance and definition identity must match")
	var no_level_three_rng := RandomNumberGenerator.new()
	no_level_three_rng.seed = 9
	check(CandidateGenerator.generate(weapon, weapon_definition, rarity, 2, upgrades, no_level_three_rng).is_empty(), "No Level 3 offer is invented")
	var max_level_rng := RandomNumberGenerator.new()
	max_level_rng.seed = 9
	check(CandidateGenerator.generate(weapon, weapon_definition, rarity, 3, upgrades, max_level_rng).is_empty(), "Level cap rejects further offers")
	var generic := _make_upgrade("GENERIC_RANGED_L2", "*", UpgradeData.UpgradeType.GENERAL)
	generic.modifier_additions = ["RANGE_UP"]
	generic.requirements = [
		{"kind": "HAS_TAG", "tag": "ranged"},
		{"kind": "RARITY_AT_LEAST", "tier": 1},
		{"kind": "UPGRADE_LEVEL_EQUALS", "level": 1},
	]
	var generic_rng := RandomNumberGenerator.new()
	generic_rng.seed = 3
	var generic_offers := CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, [generic], generic_rng)
	check(generic_offers.size() == 1 and generic_offers[0].id == generic.id, "Generic offer supports typed tag, rarity, and level requirements")
	var high_weight := _make_upgrade("HIGH_WEIGHT", "*", UpgradeData.UpgradeType.GENERAL)
	high_weight.weight = 1000000.0
	var low_weight := _make_upgrade("LOW_WEIGHT", "*", UpgradeData.UpgradeType.GENERAL)
	low_weight.weight = 0.000001
	var weighted_rng := RandomNumberGenerator.new()
	weighted_rng.seed = 3
	var weighted_offers := CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, [low_weight, high_weight], weighted_rng, 1)
	check(weighted_offers.size() == 1 and weighted_offers[0].id == high_weight.id, "Upgrade weight controls weighted sampling")
	var weighted_modifier := _make_upgrade("WEIGHTED_MODIFIER", "*", UpgradeData.UpgradeType.GENERAL)
	weighted_modifier.modifier_additions = ["DAMAGE_UP"]
	var stat_only := _make_upgrade("STAT_ONLY", "*", UpgradeData.UpgradeType.GENERAL)
	var damage_modifier := ModifierRegistry.by_id("DAMAGE_UP")
	var original_modifier_weight: float = damage_modifier.rarity_weight
	damage_modifier.rarity_weight = 1000000.0
	var modifier_weight_rng := RandomNumberGenerator.new()
	modifier_weight_rng.seed = 4
	var modifier_weight_offers := CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, [stat_only, weighted_modifier], modifier_weight_rng, 1)
	damage_modifier.rarity_weight = original_modifier_weight
	check(modifier_weight_offers.size() == 1 and modifier_weight_offers[0].id == weighted_modifier.id, "Modifier rarity weight scales an offer's effective weight")
	var route_offer := _make_upgrade("P9_ROUTE_L3", WeaponRegistry.P9, UpgradeData.UpgradeType.ROUTE)
	route_offer.level = 3
	var route_rng := RandomNumberGenerator.new()
	route_rng.seed = 6
	var route_offers := CandidateGenerator.generate(weapon, weapon_definition, rarity, 2, [route_offer], route_rng)
	check(route_offers.size() == 1 and route_offers[0].level == 3, "Route offers can target Level 3")
	var wrong_rarity := generic.duplicate() as UpgradeData
	wrong_rarity.id = "GENERIC_EPIC_ONLY"
	wrong_rarity.requirements = [{"kind": "RARITY_AT_LEAST", "tier": 4}]
	var rarity_rng := RandomNumberGenerator.new()
	rarity_rng.seed = 3
	check(CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, [wrong_rarity], rarity_rng).is_empty(), "Rarity requirement filters unavailable offers")
	var missing_modifier := generic.duplicate() as UpgradeData
	missing_modifier.id = "REQUIRES_DAMAGE_MODIFIER"
	missing_modifier.requirements = [{"kind": "HAS_MODIFIER", "modifier_id": "DAMAGE_UP"}]
	var missing_modifier_rng := RandomNumberGenerator.new()
	missing_modifier_rng.seed = 3
	check(CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, [missing_modifier], missing_modifier_rng).is_empty(), "HAS_MODIFIER requirement checks the current instance")
	weapon.modifiers.append("DAMAGE_UP")
	var has_modifier_rng := RandomNumberGenerator.new()
	has_modifier_rng.seed = 3
	check(CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, [missing_modifier], has_modifier_rng).size() == 1, "HAS_MODIFIER requirement admits matching instances")
	var duplicate_modifier := generic.duplicate() as UpgradeData
	duplicate_modifier.id = "DUPLICATE_DAMAGE_MODIFIER"
	duplicate_modifier.modifier_additions = ["DAMAGE_UP"]
	var duplicate_modifier_rng := RandomNumberGenerator.new()
	duplicate_modifier_rng.seed = 3
	check(CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, [duplicate_modifier], duplicate_modifier_rng).is_empty(), "Existing modifier max stack filters duplicate offers")
	var conflicted := generic.duplicate() as UpgradeData
	conflicted.id = "CONFLICTED_ROUTE"
	conflicted.conflict_group = &"precision_route"
	var conflict_rng := RandomNumberGenerator.new()
	conflict_rng.seed = 3
	check(CandidateGenerator.generate(weapon, weapon_definition, rarity, 1, [conflicted], conflict_rng, 3, [&"precision_route"]).is_empty(), "Existing upgrade conflict groups are respected")
	var unsupported := generic.duplicate() as UpgradeData
	unsupported.id = "UNKNOWN_REQUIREMENT"
	unsupported.requirements = [{"kind": "UNKNOWN"}]
	check(not unsupported.validation_errors().is_empty(), "Unknown requirement kinds are rejected")
	var untyped_requirement := generic.duplicate() as UpgradeData
	untyped_requirement.id = "UNTYPED_REQUIREMENT"
	untyped_requirement.requirements = [{"kind": "HAS_TAG", "tag": 17}]
	check(not untyped_requirement.validation_errors().is_empty(), "Requirement payload types are validated")
	var invalid_stat := generic.duplicate() as UpgradeData
	invalid_stat.id = "UNKNOWN_STAT"
	invalid_stat.stat_changes = [{"stat": "unknown_stat", "operation": "ADD", "value": 1.0}]
	check(not invalid_stat.validation_errors().is_empty(), "Unknown stat schemas are rejected")
	var duplicate_resources := UpgradeRegistry.definitions()
	duplicate_resources.append(duplicate_resources[0])
	check(not UpgradeRegistry.validate_resources(duplicate_resources).is_empty(), "Duplicate UpgradeData IDs are rejected")
	check(ModifierRegistry.validate().is_empty(), "Modifier data remains valid")
	check(weapon_definition.damage == base_damage and weapon_definition.attack_rate == base_attack_rate and weapon_definition.magazine_size == base_magazine, "Generation never mutates WeaponDefinition")
	check(weapon.to_dict().keys().size() == 5 and not weapon.to_dict().has("level") and not weapon.to_dict().has("upgrade_history"), "WeaponInstance save schema remains unchanged")
	var equipment := Equipment.new(Catalog.new())
	var apply_weapon := Instance.from_dict({"uid": "apply-p9", "kind": WeaponRegistry.P9, "rarity": 2, "modifiers": []})
	var original_state := apply_weapon.to_dict(true)
	var apply_result := UpgradeApplier.apply(apply_weapon, precision, "run-17", 90210)
	check(apply_result.ok, "Valid candidate applies successfully")
	check(not UpgradeApplier.apply(apply_weapon, precision, "", 90210).ok, "Apply requires a run ID for traceable history")
	var upgraded: Instance = apply_result.weapon
	check(upgraded != apply_weapon and apply_weapon.level == 1 and apply_weapon.upgrade_history.is_empty(), "Apply returns a copy and leaves source instance untouched")
	check(upgraded.level == 2 and upgraded.instance_schema == 1, "Applied upgrade advances the instance level and schema")
	check(upgraded.upgrade_history.size() == 1, "Applied upgrade records one history entry")
	var history: Dictionary = upgraded.upgrade_history[0]
	check(history.upgrade_id == precision.id and history.level_before == 1 and history.level_after == 2, "History identifies upgrade and level transition")
	check(history.run_id == "run-17" and history.seed == 90210, "History stores run and deterministic seed")
	check(history.result.modifier_additions.is_empty() and history.result.stat_changes == precision.stat_changes, "History stores an immutable result snapshot")
	var upgraded_definition: Resource = equipment.resource(upgraded.to_dict(true))
	check(is_equal_approx(upgraded_definition.damage, base_damage * 1.15), "Derived weapon applies upgrade damage stat change")
	check(is_equal_approx(upgraded_definition.accuracy, minf(1.0, float(weapon_definition.accuracy) * 1.2)), "Derived weapon applies and clamps upgrade accuracy")
	check(is_equal_approx(weapon_definition.damage, base_damage), "Applying and deriving an upgrade never mutates the shared WeaponDefinition")
	var restored := Instance.from_dict(upgraded.to_dict(true))
	check(restored.level == upgraded.level and restored.upgrade_history == upgraded.upgrade_history and restored.seed == upgraded.seed, "Explicit extended serialization restores upgrade state")
	check(restored.pending_upgrade.is_empty() and restored.instance_schema == 1, "Extended serialization restores empty pending state and schema")
	check(apply_weapon.to_dict(true) == original_state, "Source instance remains byte-for-byte equivalent at the data level")
	var wrong_weapon_upgrade := _make_upgrade("P9_ONLY", WeaponRegistry.P9, UpgradeData.UpgradeType.WEAPON_SPECIFIC)
	var wrong_weapon := Instance.from_dict({"uid": "candidate-a21", "kind": WeaponRegistry.A21, "rarity": 2})
	check(not UpgradeApplier.apply(wrong_weapon, wrong_weapon_upgrade, "run-17", 1).ok, "Weapon-specific upgrade rejects a different weapon")
	var wrong_level := _make_upgrade("P9_LEVEL_THREE", WeaponRegistry.P9, UpgradeData.UpgradeType.WEAPON_SPECIFIC)
	wrong_level.level = 3
	check(not UpgradeApplier.apply(apply_weapon, wrong_level, "run-17", 1).ok, "Apply rejects a skipped upgrade level")
	var stale_requirement := _make_upgrade("STALE_TAG_REQUIREMENT", WeaponRegistry.P9, UpgradeData.UpgradeType.WEAPON_SPECIFIC)
	stale_requirement.requirements = [{"kind": "HAS_TAG", "tag": "missing_tag"}]
	check(not UpgradeApplier.apply(apply_weapon, stale_requirement, "run-17", 1).ok, "Apply revalidates candidate requirements before commit")
	var stacked := Instance.from_dict({"uid": "stacked-p9", "kind": WeaponRegistry.P9, "rarity": 2, "modifiers": ["DAMAGE_UP"]})
	var stack_offer := _make_upgrade("STACK_DAMAGE", WeaponRegistry.P9, UpgradeData.UpgradeType.WEAPON_SPECIFIC)
	stack_offer.modifier_additions = ["DAMAGE_UP"]
	var stack_before := stacked.to_dict(true)
	check(not UpgradeApplier.apply(stacked, stack_offer, "run-17", 1).ok, "Apply enforces modifier max stack")
	check(stacked.to_dict(true) == stack_before, "Rejected max-stack apply does not partially mutate the instance")
	var route_two := _make_upgrade("ROUTE_TWO", WeaponRegistry.P9, UpgradeData.UpgradeType.WEAPON_SPECIFIC)
	route_two.conflict_group = &"steady_route"
	var route_two_result := UpgradeApplier.apply(apply_weapon, route_two, "run-17", 1)
	var route_three := _make_upgrade("ROUTE_THREE", WeaponRegistry.P9, UpgradeData.UpgradeType.WEAPON_SPECIFIC)
	route_three.level = 3
	route_three.conflict_group = &"steady_route"
	check(route_two_result.ok and not UpgradeApplier.apply(route_two_result.weapon, route_three, "run-17", 2).ok, "Apply enforces active upgrade conflict groups")
	print("WEAPON UPGRADE CANDIDATES: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func _weapon(id: String) -> Resource:
	for definition: Resource in WeaponRegistry.definitions():
		if definition.id == id:
			return definition
	return null

func _ids(upgrades: Array[UpgradeData]) -> Array[String]:
	var result: Array[String] = []
	for upgrade: UpgradeData in upgrades:
		result.append(upgrade.id)
	return result

func _make_upgrade(id: String, weapon_id: String, upgrade_type: UpgradeData.UpgradeType) -> UpgradeData:
	var upgrade := UpgradeData.new()
	upgrade.id = id
	upgrade.weapon_id = weapon_id
	upgrade.level = 2
	upgrade.name = id
	upgrade.description = "Test upgrade."
	upgrade.upgrade_type = upgrade_type
	upgrade.stat_changes = [{"stat": "damage", "operation": "MULTIPLY", "value": 1.1}]
	return upgrade
