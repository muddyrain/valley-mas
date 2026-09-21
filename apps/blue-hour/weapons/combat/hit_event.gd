class_name HitEvent
extends RefCounted
## Immutable-by-convention record of one resolved weapon hit.

enum HitKind { DIRECT, PROJECTILE, EXPLOSION, BOUNCE }

var source: Node
var weapon_id: String = ""
var weapon_uid: String = ""
var target: Node
var hit_position := Vector3.ZERO
var direction := Vector3.ZERO
var base_damage: float = 0.0
var damage: float = 0.0
var damage_type: String = "physical"
var critical: bool = false
var penetration_index: int = 0
var knockback: int = 0
var status_effects: Array = []
var hit_kind: HitKind = HitKind.DIRECT

static func create(values: Dictionary) -> HitEvent:
	var event := HitEvent.new()
	event.source = values.get("source") as Node
	event.weapon_id = str(values.get("weapon_id", ""))
	event.weapon_uid = str(values.get("weapon_uid", ""))
	event.target = values.get("target") as Node
	event.hit_position = values.get("hit_position", Vector3.ZERO) as Vector3
	event.direction = values.get("direction", Vector3.ZERO) as Vector3
	event.base_damage = float(values.get("base_damage", 0.0))
	event.damage = float(values.get("damage", event.base_damage))
	event.damage_type = str(values.get("damage_type", "physical"))
	event.critical = bool(values.get("critical", false))
	event.penetration_index = int(values.get("penetration_index", 0))
	event.knockback = int(values.get("knockback", 0))
	event.status_effects = (values.get("status_effects", []) as Array).duplicate(true)
	event.hit_kind = int(values.get("hit_kind", HitKind.DIRECT)) as HitKind
	return event
