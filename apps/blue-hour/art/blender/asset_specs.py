"""Expected manifest. Keep IDs stable; recipes live in generators/."""
GROUPS = {
    "architecture": {
        "roads": "Road_Straight:直路 Road_Corner:转角道路 Road_TJunction:丁字路口 Road_Cross:十字路口 Sidewalk_Straight:直人行道 Sidewalk_Corner:转角人行道 Curb:路缘 Crosswalk:斑马线",
        "modules": "Wall_Concrete:混凝土墙 Wall_Brick:砌块墙 Window_Small:小窗 Window_Large:大窗 Door_Normal:普通门 Door_Shop:商店门 Roller_Shutter:卷帘门 Awning:雨棚 Roof_Flat:平屋顶 Roof_Edge:檐口 Storefront_Frame:店面框架",
        "buildings": "Building_Supermarket_01:超市 Building_Pharmacy_01:药店 Building_Warehouse_01:仓库",
    },
    "props": {
        "props": "StreetLamp_01:单臂路灯 StreetLamp_02:双臂路灯 TrashBin_01:垃圾桶 Bench_01:长椅 Barrier_Concrete:混凝土路障 Barricade_Metal:金属拒马 TrafficCone:交通锥 RoadSign:道路标牌 Pallet:木托盘 WoodCrate:木箱 MetalCrate:金属箱 GarbageBag_Set:垃圾袋组 VendingMachine:售货机 AC_Outdoor:空调外机 Fence:围栏 Fence_Broken:破损围栏",
        "searchable": "Searchable_Crate:可搜索物资箱 Searchable_Dumpster:可搜索垃圾柜 Searchable_VendingMachine:可搜索售货机 Searchable_CarTrunk:可搜索后备厢",
    },
    "vehicles": {"vehicles": "Car_Sedan_01:轿车 Car_Hatchback_01:两厢车 Van_01:面包车 AbandonedCar_01:弃置轿车 EvacBus_01:社区归航巴士"},
    "weapons": {"weapons": "Pistol_01:手枪 SMG_01:冲锋枪 AR_01:突击步枪 Shotgun_01:霰弹枪"},
    "infected": {"characters": "Infected_Basic_Placeholder:基础感染者占位"},
}
# Runtime filenames are independent of stable model/node IDs.
RUNTIME_NAMES = {
    "BH_AC_Outdoor": "environment_air_conditioner_outdoor_model.glb",
    "BH_AR_01": "weapon_assault_rifle_model.glb",
    "BH_AbandonedCar_01": "vehicle_abandoned_sedan_model.glb",
    "BH_Awning": "environment_awning_model.glb",
    "BH_Barricade_Metal": "environment_barricade_metal_model.glb",
    "BH_Barrier_Concrete": "environment_barrier_concrete_model.glb",
    "BH_Bench_01": "environment_bench_model.glb",
    "BH_Building_Pharmacy_01": "environment_building_pharmacy_model.glb",
    "BH_Building_Supermarket_01": "environment_building_supermarket_model.glb",
    "BH_Building_Warehouse_01": "environment_building_warehouse_model.glb",
    "BH_Car_Hatchback_01": "vehicle_car_hatchback_model.glb",
    "BH_Car_Sedan_01": "vehicle_car_sedan_model.glb",
    "BH_Crosswalk": "environment_crosswalk_model.glb",
    "BH_Curb": "environment_curb_model.glb",
    "BH_Door_Normal": "environment_door_standard_model.glb",
    "BH_Door_Shop": "environment_door_shop_model.glb",
    "BH_EvacBus_01": "VEH_BLUE_HOUR.glb",
    "BH_Fence": "environment_fence_model.glb",
    "BH_Fence_Broken": "environment_fence_broken_model.glb",
    "BH_GarbageBag_Set": "environment_garbage_bags_model.glb",
    "BH_Infected_Basic_Placeholder": "character_infected_basic_model.glb",
    "BH_MetalCrate": "environment_metal_crate_model.glb",
    "BH_Pallet": "environment_pallet_model.glb",
    "BH_Pistol_01": "weapon_pistol_model.glb",
    "BH_RoadSign": "environment_road_sign_model.glb",
    "BH_Road_Corner": "environment_road_corner_model.glb",
    "BH_Road_Cross": "environment_road_cross_model.glb",
    "BH_Road_Straight": "environment_road_straight_model.glb",
    "BH_Road_TJunction": "environment_road_tjunction_model.glb",
    "BH_Roller_Shutter": "environment_roller_shutter_model.glb",
    "BH_Roof_Edge": "environment_roof_edge_model.glb",
    "BH_Roof_Flat": "environment_roof_flat_model.glb",
    "BH_SMG_01": "weapon_submachine_gun_model.glb",
    "BH_Searchable_CarTrunk": "environment_searchable_car_trunk_model.glb",
    "BH_Searchable_Crate": "environment_searchable_crate_model.glb",
    "BH_Searchable_Dumpster": "environment_searchable_dumpster_model.glb",
    "BH_Searchable_VendingMachine": "environment_searchable_vending_machine_model.glb",
    "BH_Shotgun_01": "weapon_shotgun_model.glb",
    "BH_Sidewalk_Corner": "environment_sidewalk_corner_model.glb",
    "BH_Sidewalk_Straight": "environment_sidewalk_straight_model.glb",
    "BH_Storefront_Frame": "environment_storefront_frame_model.glb",
    "BH_StreetLamp_01": "environment_street_lamp_single_arm_model.glb",
    "BH_StreetLamp_02": "environment_street_lamp_double_arm_model.glb",
    "BH_TrafficCone": "environment_traffic_cone_model.glb",
    "BH_TrashBin_01": "environment_trash_bin_model.glb",
    "BH_Van_01": "vehicle_van_model.glb",
    "BH_VendingMachine": "environment_vending_machine_model.glb",
    "BH_Wall_Brick": "environment_wall_brick_model.glb",
    "BH_Wall_Concrete": "environment_wall_concrete_model.glb",
    "BH_Window_Large": "environment_window_large_model.glb",
    "BH_Window_Small": "environment_window_small_model.glb",
    "BH_WoodCrate": "environment_wood_crate_model.glb",
}
BUDGETS = {"roads": 1500, "modules": 5000, "buildings": 12000, "props": 1500, "searchable": 3000, "vehicles": 8000, "weapons": 5000, "characters": 3000}
USAGE = {
    "BH_Building_Supermarket_01": "东岸旧街 corner / market",
    "BH_Building_Pharmacy_01": "东岸旧街 pharmacy",
    "BH_Building_Warehouse_01": "东岸旧街 garage / depot",
    "BH_Van_01": "东岸旧街 van_south / van_north",
    "BH_AbandonedCar_01": "东岸旧街 car_west",
    "BH_EvacBus_01": "东岸旧街撤离巴士",
    "BH_StreetLamp_01": "东岸旧街 12 处路灯",
    "BH_Road_Straight": "东岸旧街道路拼装",
    "BH_Road_Cross": "东岸旧街路口拼装",
    "BH_Sidewalk_Straight": "东岸旧街临街步道",
    "BH_Crosswalk": "东岸旧街南侧斑马线",
    "BH_AC_Outdoor": "店铺屋顶装饰",
    "BH_WoodCrate": "仓库装卸口装饰",
    "BH_Pallet": "仓库装卸口装饰",
    "BH_Pistol_01": "幸存者 pistol 装备视觉",
    "BH_SMG_01": "幸存者 smg 装备视觉",
    "BH_Shotgun_01": "幸存者 shotgun 装备视觉",
    "BH_Searchable_Crate": "行动物资掉落视觉",
}


def specs():
    result = {}
    for batch, groups in GROUPS.items():
        for category, entries in groups.items():
            for entry in entries.split():
                suffix, usage = entry.split(":")
                key = "BH_" + suffix
                result[key] = {"id": key, "path": "assets/generated/" + RUNTIME_NAMES[key], "batch": batch, "category": category, "usage": usage,
                               "budget": 12000 if suffix == "EvacBus_01" else BUDGETS[category],
                               "used_in": ["Art Showcase", USAGE.get(key, "资产库待复用")],
                               "placeholder": category == "characters", "procedural": True,
                               "source": "Blender Generated — BLUE HOUR original procedural geometry"}
    # Preserve the stable gameplay ID, but never regenerate its retired bus visual.
    result["BH_EvacBus_01"].update({
        "path": "scenes/world/vehicles/veh_blue_hour.tscn",
        "source_glb": "assets/world/vehicles/VEH_BLUE_HOUR.glb",
        "procedural": False,
        "source": "User supplied Meshy GLB; original bytes and scale preserved",
        "budget": 29712,
        "used_in": ["Camp", "Shelter", "Expedition", "Art Showcase"],
    })
    return result
