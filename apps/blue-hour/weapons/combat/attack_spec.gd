class_name AttackSpec
extends RefCounted
## Snapshot of one attack. It is independent from the shared WeaponDefinition.

var source: Node
var weapon: Resource
var weapon_instance: RefCounted
var weapon_id: String = ""
var weapon_uid: String = ""
var direction := Vector3.ZERO
var origin := Vector3.ZERO
var damage: float = 0.0
var pellet_count: int = 1
var range: float = 0.0
var penetration: int = 0
var penetration_damage_multiplier: float = 1.0
var knockback: int = 0
var damage_type: String = "physical"
var status_effects: Array = []

static func from_attack(source_node: Node, definition: Resource, direction_value: Vector3, origin_value: Vector3, damage_value: float, uid: String = "", instance: RefCounted = null) -> AttackSpec:
	var spec := AttackSpec.new()
	spec.source = source_node
	spec.weapon = definition
	spec.weapon_instance = instance
	spec.weapon_id = str(definition.id) if definition != null else ""
	spec.weapon_uid = uid if not uid.is_empty() else str(instance.instance_id) if instance != null else ""
	spec.direction = direction_value
	spec.origin = origin_value
	spec.damage = damage_value
	spec.pellet_count = int(definition.pellet_count) if definition != null else 1
	spec.range = float(definition.range) if definition != null else 0.0
	spec.penetration = int(definition.penetration) if definition != null else 0
	spec.penetration_damage_multiplier = float(definition.penetration_damage_multiplier) if definition != null else 1.0
	spec.knockback = int(definition.knockback) if definition != null else 0
	return spec
