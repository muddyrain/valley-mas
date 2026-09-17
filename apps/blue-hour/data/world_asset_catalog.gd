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
	preload("res://data/world_assets/BLD_009_residence_c.tres"),
	preload("res://data/world_assets/BLD_010_residence_d.tres"),
	preload("res://data/world_assets/BLD_011_residence_e.tres"),
	preload("res://data/world_assets/BLD_012_two_story_house_a.tres"),
	preload("res://data/world_assets/BLD_013_small_apartment_a.tres"),
	preload("res://data/world_assets/BLD_014_small_apartment_b.tres"),
	preload("res://data/world_assets/BLD_015_convenience_store_a.tres"),
	preload("res://data/world_assets/BLD_016_small_shop_a.tres"),
	preload("res://data/world_assets/BLD_017_small_shop_b.tres"),
	preload("res://data/world_assets/BLD_018_cafe_a.tres"),
	preload("res://data/world_assets/BLD_019_laundromat_a.tres"),
	preload("res://data/world_assets/BLD_020_hardware_store_a.tres"),
	preload("res://data/world_assets/BLD_021_small_office_a.tres"),
	preload("res://data/world_assets/BLD_022_abandoned_house_a.tres"),
	preload("res://data/world_assets/vehicle_sedan_a.tres"),
	preload("res://data/world_assets/vehicle_suv.tres"),
	preload("res://data/world_assets/vehicle_van.tres"),
	preload("res://data/world_assets/prop_street_lamp.tres"),
	preload("res://data/world_assets/prop_trash_bin.tres"),
	preload("res://data/world_assets/barrier_chainlink.tres"),
	preload("res://data/world_assets/vegetation_tree_broadleaf_a.tres"),
	preload("res://data/world_assets/vegetation_bush_a.tres"),
	preload("res://data/world_assets/park_bench.tres"),
	preload("res://data/world_assets/pallet.tres"),
	preload("res://data/world_assets/wood_crate.tres"),
	preload("res://data/world_assets/metal_crate.tres"),
	preload("res://data/world_assets/direction_sign.tres"),
	preload("res://data/world_assets/vending_machine.tres"),
	preload("res://data/world_assets/planter.tres"),
	preload("res://data/world_assets/residential_low_fence.tres"),
	preload("res://data/world_assets/concrete_barrier.tres"),
	preload("res://data/world_assets/metal_barricade.tres"),
	preload("res://data/world_assets/industrial_chainlink_damaged.tres")
]

static func asset(id: String) -> Resource:
	var query := id
	if id.length() == 7 and id.begins_with("BLD_"):
		for candidate: Resource in ALL:
			if String(candidate.id).begins_with(id + "_"):
				query = candidate.id
				break
	for definition: Resource in ALL:
		if definition.id == query:
			return definition
	push_error("Unknown world asset: " + id)
	return null

static func get_buildings_by_category(category: String) -> Array[Resource]:
	var result: Array[Resource] = []
	for definition: Resource in ALL:
		if definition.id.begins_with("BLD_") and (category.is_empty() or definition.category == category):
			result.append(definition)
	return result
