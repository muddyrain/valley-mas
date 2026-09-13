extends RefCounted
const Plots = preload("res://maps/generation/plot_generator.gd")
const Vehicles = preload("res://maps/generation/vehicle_spawner.gd")

static func prepare(map: Resource) -> void:
	if not map.frontage_blocks.is_empty():
		map.plots = Plots.frontage(map.frontage_blocks) + map.plots
	map.buildings = Plots.resolve(map.plots)
	# Reuse authored streetscape only where new lots leave clearance for it.
	map.vegetation = map.vegetation.filter(func(prop: Dictionary): return _outside_lots(prop.position, map.buildings, 2.1))
	map.props = map.props.filter(func(prop: Dictionary): return _outside_lots(prop.position, map.buildings, .6))
	map.vehicles = Vehicles.resolve(map.parking_placements).filter(func(site: Dictionary): return site.get("lootable", false))

static func _outside_lots(point: Vector3, sites: Array[Dictionary], clearance: float) -> bool:
	for site: Dictionary in sites:
		var local: Vector3 = Basis(Vector3.UP, site.yaw).inverse() * (point - site.position)
		if absf(local.x) < site.size.x * .5 + clearance and absf(local.z) < site.size.z * .5 + clearance:
			return false
		if point.distance_to(site.entry) < 2.2:
			return false
	return true

