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
                result[key] = {"id": key, "batch": batch, "category": category, "usage": usage,
                               "budget": 12000 if suffix == "EvacBus_01" else BUDGETS[category],
                               "used_in": ["Art Showcase", USAGE.get(key, "资产库待复用")],
                               "placeholder": category == "characters", "procedural": True,
                               "source": "Blender Generated — BLUE HOUR original procedural geometry"}
    return result
