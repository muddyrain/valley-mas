extends RefCounted
## Resource references are the only runtime path registry. Source GLBs belong to wrappers.

const ALL: Array[Resource] = [
	preload("res://data/world_assets/building_supermarket.tres"),
	preload("res://data/world_assets/building_house_small_a.tres"),
	preload("res://data/world_assets/building_house_small_b.tres"),
	preload("res://data/world_assets/building_pharmacy.tres"),
	preload("res://data/world_assets/building_restaurant_small.tres"),
	preload("res://data/world_assets/building_warehouse_small.tres"),
	preload("res://data/world_assets/building_gas_station.tres"),
	preload("res://data/world_assets/building_auto_repair_shop.tres"),
	preload("res://data/world_assets/vehicle_sedan_a.tres"),
	preload("res://data/world_assets/vehicle_suv.tres"),
	preload("res://data/world_assets/vehicle_van.tres"),
	preload("res://data/world_assets/prop_street_lamp.tres"),
	preload("res://data/world_assets/prop_trash_bin.tres"),
	preload("res://data/world_assets/barrier_chainlink.tres"),
	preload("res://data/world_assets/vegetation_tree_broadleaf_a.tres"),
	preload("res://data/world_assets/vegetation_bush_a.tres")
]

static func asset(id: String) -> Resource:
	for definition: Resource in ALL:
		if definition.id == id:
			return definition
	push_error("Unknown world asset: " + id)
	return null
