extends RefCounted
const Assets = preload("res://data/world_asset_catalog.gd")
const Road = preload("res://maps/generation/road_generator.gd")

static func build(city: Node3D, placements: Array[Dictionary], seed_value: int) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	for placement: Dictionary in placements:
		var wrapper: Node3D = Assets.asset(placement.asset).scene.instantiate()
		city.add_child(wrapper)
		wrapper.position = placement.position
		wrapper.rotation.y = rng.randf_range(0, TAU)
		wrapper.scale = Vector3.ONE * rng.randf_range(.9, 1.1)
		# Tie the existing planting to the ground with quiet, layered soil rings.
		if "tree" in placement.asset:
			var well := MeshInstance3D.new()
			var disk := CylinderMesh.new()
			disk.top_radius = 1.1
			disk.bottom_radius = 1.1
			disk.height = .018
			disk.radial_segments = 32
			well.mesh = disk
			well.material_override = Road.Surfaces.get_material(Color("#667765"), "ground")
			well.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			city.add_child(well)
			well.position = placement.position + Vector3(0, .009, 0)
