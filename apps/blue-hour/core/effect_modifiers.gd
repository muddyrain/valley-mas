extends RefCounted
## Callers ask for a stat, never an item name.

const MIN_SEARCH_SECONDS := 0.2
const PASSIVE_KEYS: Array[String] = ["ranged_damage", "ranged_attack_speed", "incoming_damage", "weapon_copy_chance", "search_time", "resource_yield", "move_speed", "day_extension", "warning_seconds", "return_speed"]
const POWER_KEYS: Array[String] = ["damage", "focus_damage", "move_speed", "search_time", "heal_fraction", "freeze_day_clock"]

var sources: Dictionary = {}
var _products: Dictionary = {}
var _sums: Dictionary = {}

static func valid(values: Dictionary, category: String) -> bool:
	if values.is_empty():
		return false
	for key: Variant in values:
		if key not in (PASSIVE_KEYS if category == "passive" else POWER_KEYS):
			return false
		var value: Variant = values[key]
		if not (value is float or value is int) or not is_finite(float(value)) or value <= 0:
			return false
		if key in ["weapon_copy_chance", "heal_fraction", "search_time", "incoming_damage"] and value > 1:
			return false
		if key in ["damage", "ranged_damage", "ranged_attack_speed", "focus_damage", "resource_yield", "return_speed"] and value < 1:
			return false
		if key == "freeze_day_clock" and value != 1:
			return false
	return true

func set_source(key: String, values: Dictionary) -> void:
	sources[key] = values.duplicate()
	_rebuild()

func remove_source(key: String) -> void:
	sources.erase(key)
	_rebuild()

func multiplier(stat: String) -> float:
	return float(_products.get(stat, 1.0))

func amount(stat: String) -> float:
	return float(_sums.get(stat, 0.0))

func outgoing_damage(base: float, melee: bool, focused: bool = false) -> float:
	return maxf(0.0, base * multiplier("damage") * (1.0 if melee else multiplier("ranged_damage")) * (multiplier("focus_damage") if focused else 1.0))

func attack_interval(base: float, melee: bool) -> float:
	return base if melee else base / multiplier("ranged_attack_speed")

func incoming_damage(base: float) -> float:
	return maxf(0.0, base * multiplier("incoming_damage"))

func search_seconds(base: float, trait_speed: float = 1.0) -> float:
	return maxf(MIN_SEARCH_SECONDS, base / maxf(0.001, trait_speed) * multiplier("search_time"))

func _rebuild() -> void:
	_products.clear()
	_sums.clear()
	for values: Dictionary in sources.values():
		for stat: String in values:
			_products[stat] = multiplier(stat) * float(values[stat])
			_sums[stat] = amount(stat) + float(values[stat])
