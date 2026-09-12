extends RefCounted
const Roads = preload("res://maps/generation/road_generator.gd")
const Blocks = preload("res://maps/generation/block_generator.gd")
const Buildings = preload("res://maps/generation/building_placer.gd")
const Vehicles = preload("res://maps/generation/vehicle_spawner.gd")
const Props = preload("res://maps/generation/prop_spawner.gd")
const Vegetation = preload("res://maps/generation/vegetation_spawner.gd")

static func build(city: Node3D, map: Resource) -> void:
	Roads.build(city, map)
	Blocks.build(city, map.buildings)
	Buildings.build(city, map.buildings)
	Vehicles.build(city, Vehicles.resolve(map.parking_placements))
	Props.build(city, map.props)
	Vegetation.build(city, map.vegetation, map.base_seed)
