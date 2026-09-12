extends RefCounted
const Assets = preload("res://data/world_asset_catalog.gd")

static func build(city: Node3D, placements: Array[Dictionary]) -> void:
	var lamp_count: int = 0
	for placement: Dictionary in placements:
		var wrapper: Node3D = Assets.asset(placement.asset).scene.instantiate()
		city.add_child(wrapper)
		wrapper.position = placement.position
		wrapper.rotation.y = placement.yaw
		if wrapper.has_method("register_lighting"):
			wrapper.register_lighting(city, lamp_count < 4)
			lamp_count += 1

