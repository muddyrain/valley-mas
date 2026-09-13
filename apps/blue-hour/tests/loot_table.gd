extends SceneTree

const Resolver = preload("res://core/loot_resolver.gd")

func _init() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var table := {"id": "residential", "entries": [
		{"loot_id": "food", "weight": 1.0, "min_amount": 2, "max_amount": 4},
		{"loot_id": "scrap", "weight": 1.0, "min_amount": 1, "max_amount": 3}
	]}
	var rolled: Array[Dictionary] = Resolver.roll_dict(table, rng)
	assert(rolled.size() == 2)
	for entry: Dictionary in rolled:
		assert(int(entry.amount) >= (2 if entry.id == "food" else 1))
		assert(int(entry.amount) <= (4 if entry.id == "food" else 3))
	quit()
