class_name HealEffectHandler
extends RefCounted
## Applies a bounded percentage heal without coupling the effect to a survivor identity.

static func apply(target: Node3D, heal_percent: float) -> Dictionary:
	if target == null or not is_instance_valid(target):
		return {"applied": false, "amount": 0.0, "reason": "invalid_target"}
	var dead: Variant = target.get("dead")
	if dead is bool and dead:
		return {"applied": false, "amount": 0.0, "reason": "dead"}
	var hp_value: Variant = target.get("hp")
	var data: Variant = target.get("data")
	if hp_value == null or data == null:
		return {"applied": false, "amount": 0.0, "reason": "missing_health"}
	var maximum: float = maxf(0.0, float(data.get("max_hp")))
	var current: float = clampf(float(hp_value), 0.0, maximum)
	if maximum <= 0.0 or current >= maximum - 0.000001 or heal_percent <= 0.0:
		return {"applied": false, "amount": 0.0, "reason": "full_health"}
	var amount: float = minf(maximum - current, maximum * maxf(0.0, heal_percent))
	if amount <= 0.000001:
		return {"applied": false, "amount": 0.0, "reason": "no_effect"}
	target.set("hp", current + amount)
	return {"applied": true, "amount": amount, "target_id": str(target.get_instance_id())}
