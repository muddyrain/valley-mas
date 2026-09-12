extends RefCounted
const Plots = preload("res://maps/generation/plot_generator.gd")
const Vehicles = preload("res://maps/generation/vehicle_spawner.gd")
const Enemies = preload("res://maps/generation/enemy_spawner.gd")

static func prepare(map: Resource) -> void:
	map.buildings = Plots.resolve(map.plots)
	map.vehicles = Vehicles.resolve(map.parking_placements).filter(func(site: Dictionary): return site.get("lootable", false))
	map.initial_enemies = Enemies.resolve(map.buildings, map.spawn_points)

