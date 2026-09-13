class_name LootResolver
extends RefCounted

static func roll(table: Resource, rng: RandomNumberGenerator) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if table == null:
		return result
	var total: float = 0.0
	for entry: Resource in table.entries:
		if entry.weight > 0 and entry.max_amount >= entry.min_amount:
			total += entry.weight
	if total <= 0:
		return result
	var pick: float = rng.randf() * total
	for entry: Resource in table.entries:
		if entry.weight <= 0 or entry.max_amount < entry.min_amount:
			continue
		pick -= entry.weight
		if pick <= 0:
			var amount: int = rng.randi_range(entry.min_amount, entry.max_amount)
			if amount > 0:
				result.append({"id": entry.loot_id, "amount": amount})
			return result
	return result

static func roll_dict(table: Dictionary, rng: RandomNumberGenerator) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for entry: Dictionary in table.get("entries", []):
		var weight: float = float(entry.get("weight", 0.0))
		var minimum: int = int(entry.get("min_amount", 0))
		var maximum: int = int(entry.get("max_amount", -1))
		if weight <= 0 or maximum < minimum:
			continue
		var amount: int = rng.randi_range(minimum, maximum)
		if amount > 0:
			result.append({"id": str(entry.loot_id), "amount": amount})
	return result
