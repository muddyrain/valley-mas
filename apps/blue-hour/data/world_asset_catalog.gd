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
	preload("res://data/world_assets/industrial_chainlink_damaged.tres"),
	preload("res://data/world_assets/PRP_Utility_Pole_A.tres"),
	preload("res://data/world_assets/PRP_Parking_Sign_A.tres"),
	preload("res://data/world_assets/PRP_Storefront_AFrame_Sign_A.tres"),
	preload("res://data/world_assets/PRP_Bicycle_A.tres"),
	preload("res://data/world_assets/PRP_STREET_001_trash_bin.tres"),
	preload("res://data/world_assets/PRP_STREET_002_mailbox.tres"),
	preload("res://data/world_assets/PRP_STREET_003_street_lamp_b.tres"),
	preload("res://data/world_assets/PRP_STREET_004_traffic_cone.tres"),
	preload("res://data/world_assets/PRP_STREET_005_road_barrier.tres"),
	preload("res://data/world_assets/PRP_STREET_006_bus_stop_sign.tres"),
	preload("res://data/world_assets/PRP_STREET_007_bench.tres"),
	preload("res://data/world_assets/PRP_STREET_008_vending_machine.tres"),
	preload("res://data/world_assets/PRP_HOUSE_001_bicycle.tres"),
	preload("res://data/world_assets/PRP_HOUSE_002_flower_pot_set.tres"),
	preload("res://data/world_assets/PRP_HOUSE_003_laundry_rack.tres"),
	preload("res://data/world_assets/PRP_HOUSE_004_patio_table_set.tres"),
	preload("res://data/world_assets/PRP_HOUSE_005_wood_fence_segment.tres"),
	preload("res://data/world_assets/PRP_HOUSE_006_package_box_set.tres"),
	preload("res://data/world_assets/PRP_RUIN_001_garbage_bag_pile.tres"),
	preload("res://data/world_assets/PRP_RUIN_002_fallen_bicycle.tres"),
	preload("res://data/world_assets/PRP_RUIN_003_broken_sign.tres"),
	preload("res://data/world_assets/PRP_RUIN_004_tire_stack.tres"),
	preload("res://data/world_assets/PRP_CITY_001_shop_sign.tres"),
	preload("res://data/world_assets/PRP_CITY_002_ac_unit.tres"),
	preload("res://data/world_assets/PRP_CITY_003_power_pole.tres"),
	preload("res://data/world_assets/PRP_CITY_004_power_wire_set.tres"),
	preload("res://data/world_assets/PRP_CITY_005_traffic_light.tres"),
	preload("res://data/world_assets/PRP_CITY_006_bus_shelter.tres"),
	preload("res://data/world_assets/PRP_CITY_007_awning.tres"),
	preload("res://data/world_assets/PRP_CITY_008_cardboard_stack.tres"),
	preload("res://data/world_assets/PRP_CITY_009_fire_hydrant.tres"),
	preload("res://data/world_assets/PRP_CITY_010_broken_billboard.tres"),
	preload("res://data/world_assets/PRP_CITY_011_planter_box_pair.tres"),
	preload("res://data/world_assets/PRP_CITY_012_neighborhood_notice_board.tres"),
	preload("res://data/world_assets/PRP_CITY_013_recycling_bin_pair.tres"),
	preload("res://data/world_assets/PRP_CITY_014_delivery_lockbox.tres"),
	preload("res://data/world_assets/PRP_CITY_015_garden_tool_cart.tres"),
	preload("res://data/world_assets/PRP_CITY_016_storefront_menu_stand.tres"),
	preload("res://data/world_assets/PRP_CITY_017_beverage_crate_stack.tres"),
	preload("res://data/world_assets/PRP_CITY_018_delivery_handcart.tres"),
	preload("res://data/world_assets/PRP_CITY_019_sidewalk_banner_stand.tres"),
	preload("res://data/world_assets/PRP_CITY_020_storefront_flag_pair.tres"),
	preload("res://data/world_assets/PRP_CITY_021_street_bollard_set.tres"),
	preload("res://data/world_assets/PRP_CITY_022_utility_cabinet.tres"),
	preload("res://data/world_assets/PRP_CITY_023_guardrail_segment.tres"),
	preload("res://data/world_assets/PRP_CITY_024_bicycle_parking_rack.tres"),
	preload("res://data/world_assets/PRP_CITY_025_bus_stop_post.tres"),
	preload("res://data/world_assets/PRP_CITY_026_fallen_market_sign.tres"),
	preload("res://data/world_assets/PRP_CITY_027_cloth_tarp_bundle.tres"),
	preload("res://data/world_assets/PRP_CITY_028_scattered_box_debris.tres"),
	preload("res://data/world_assets/PRP_CITY_029_broken_fence_section.tres"),
	preload("res://data/world_assets/PRP_CITY_030_roadside_grass_patch.tres"),
	preload("res://data/world_assets/PRP_CITY_031_small_bush_cluster.tres"),
	preload("res://data/world_assets/PRP_CITY_032_neglected_planter.tres"),
	preload("res://data/world_assets/PRP_CITY_033_small_vine_patch.tres"),
	preload("res://data/world_assets/PRP_CITY_034_umbrella_stand.tres")
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
