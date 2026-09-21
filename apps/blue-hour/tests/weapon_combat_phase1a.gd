extends SceneTree

const AttackSpecData = preload("res://weapons/combat/attack_spec.gd")
const HitEventData = preload("res://weapons/combat/hit_event.gd")
const InstantResolver = preload("res://weapons/combat/instant_hit_resolver.gd")
const DamageResolverData = preload("res://weapons/combat/damage_resolver.gd")
const WeaponDefinitionData = preload("res://data/weapon_data.gd")
const WeaponInstanceData = preload("res://weapons/weapon_instance.gd")

var failures: Array[String] = []
var checks := 0

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _initialize() -> void:
	var source := Node3D.new()
	var first_target := Node3D.new()
	var second_target := Node3D.new()
	var definition := WeaponDefinitionData.new()
	definition.id = "phase1a-test-weapon"
	definition.pellet_count = 2
	definition.range = 20.0
	definition.penetration = 1
	var instance := WeaponInstanceData.from_dict({"uid": "phase1a:test:001", "kind": definition.id})
	var spec := AttackSpecData.from_attack(source, definition, Vector3(0, 0, -1), Vector3(1, 0, 2), 32.0, "", instance)
	check(spec.source == source, "AttackSpec preserves the source character")
	check(spec.weapon == definition and spec.weapon_instance == instance, "AttackSpec preserves definition and weapon instance")
	check(spec.weapon_id == definition.id and spec.weapon_uid == instance.instance_id, "AttackSpec preserves weapon identity")
	check(spec.pellet_count == 2 and spec.penetration == 1 and is_equal_approx(spec.damage, 32.0), "AttackSpec snapshots combat values")

	var first := InstantResolver.make_hit_event(spec, first_target, Vector3(1, 0, -3), Vector3(0, 0, -1), 32.0, 0)
	var second := InstantResolver.make_hit_event(spec, second_target, Vector3(1, 0, -5), Vector3(0, 0, -1), 19.2, 1)
	check(first is HitEventData and second is HitEventData, "Resolver creates HitEvent records")
	check(first.source == source and first.weapon_id == definition.id and first.weapon_uid == instance.instance_id, "HitEvent preserves source and weapon identity")
	check(first.penetration_index == 0 and second.penetration_index == 1, "HitEvent preserves penetration index")
	check(first.direction == Vector3(0, 0, -1) and second.direction == first.direction, "HitEvent preserves knockback direction")
	check(first.target == first_target and second.target == second_target and first != second, "Multiple targets receive independent HitEvents")
	check(is_equal_approx(first.base_damage, 32.0) and is_equal_approx(second.damage, 19.2), "HitEvent separates base and resolved damage")
	check(is_equal_approx(DamageResolverData.resolve(first), first.damage), "DamageResolver preserves current damage behavior")

	source.free()
	first_target.free()
	second_target.free()
	print("WEAPON COMBAT PHASE 1A: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
