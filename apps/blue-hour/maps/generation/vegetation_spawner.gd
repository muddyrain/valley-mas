extends RefCounted
const Assets = preload("res://data/world_asset_catalog.gd")

static func build(city: Node3D, placements: Array[Dictionary], seed_value: int) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	for placement: Dictionary in placements:
		var wrapper: Node3D = Assets.asset(placement.asset).scene.instantiate()
		city.add_child(wrapper)
		wrapper.position = placement.position
		wrapper.rotation.y = rng.randf_range(0, TAU)
		wrapper.scale = Vector3.ONE * rng.randf_range(.9, 1.1)

