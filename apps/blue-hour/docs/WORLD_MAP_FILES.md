# 正式街区文件清单

路径均相对 `apps/blue-hour/`，包含Godot生成的资源sidecar；运行截图、日志、导出物及本清单生成临时文件在忽略目录，不纳入源码变更。未执行git提交。

## 本任务新增

```text
art/WORLD_ASSET_AUDIT.md
art/audit_world_sources.py
art/build_world_wrappers.py
art/world_asset_audit.json
assets/world/barriers/barrier_chainlink_source_model.glb
assets/world/barriers/barrier_chainlink_source_model.glb.import
assets/world/buildings/commercial/building_pharmacy_model.glb
assets/world/buildings/commercial/building_pharmacy_model.glb.import
assets/world/buildings/commercial/building_restaurant_small_model.glb
assets/world/buildings/commercial/building_restaurant_small_model.glb.import
assets/world/buildings/commercial/building_supermarket_model.glb
assets/world/buildings/commercial/building_supermarket_model.glb.import
assets/world/buildings/industrial/building_warehouse_small_model.glb
assets/world/buildings/industrial/building_warehouse_small_model.glb.import
assets/world/buildings/residential/building_house_small_a_model.glb
assets/world/buildings/residential/building_house_small_a_model.glb.import
assets/world/buildings/residential/building_house_small_b_model.glb
assets/world/buildings/residential/building_house_small_b_model.glb.import
assets/world/buildings/service/building_auto_repair_shop_model.glb
assets/world/buildings/service/building_auto_repair_shop_model.glb.import
assets/world/buildings/service/building_gas_station_model.glb
assets/world/buildings/service/building_gas_station_model.glb.import
assets/world/materials/chain_link.gdshader
assets/world/materials/chain_link.gdshader.uid
assets/world/materials/chain_link.tres
assets/world/materials/street_lamp_lens.tres
assets/world/props/street/prop_street_lamp_model.glb
assets/world/props/street/prop_street_lamp_model.glb.import
assets/world/props/street/prop_trash_bin_model.glb
assets/world/props/street/prop_trash_bin_model.glb.import
assets/world/vegetation/vegetation_bush_a_model.glb
assets/world/vegetation/vegetation_bush_a_model.glb.import
assets/world/vegetation/vegetation_tree_broadleaf_a_model.glb
assets/world/vegetation/vegetation_tree_broadleaf_a_model.glb.import
assets/world/vehicles/vehicle_sedan_a_model.glb
assets/world/vehicles/vehicle_sedan_a_model.glb.import
assets/world/vehicles/vehicle_suv_model.glb
assets/world/vehicles/vehicle_suv_model.glb.import
assets/world/vehicles/vehicle_van_model.glb
assets/world/vehicles/vehicle_van_model.glb.import
data/world_asset_catalog.gd
data/world_asset_catalog.gd.uid
data/world_asset_data.gd
data/world_asset_data.gd.uid
data/world_assets/barrier_chainlink.tres
data/world_assets/building_auto_repair_shop.tres
data/world_assets/building_gas_station.tres
data/world_assets/building_house_small_a.tres
data/world_assets/building_house_small_b.tres
data/world_assets/building_pharmacy.tres
data/world_assets/building_restaurant_small.tres
data/world_assets/building_supermarket.tres
data/world_assets/building_warehouse_small.tres
data/world_assets/prop_street_lamp.tres
data/world_assets/prop_trash_bin.tres
data/world_assets/vegetation_bush_a.tres
data/world_assets/vegetation_tree_broadleaf_a.tres
data/world_assets/vehicle_sedan_a.tres
data/world_assets/vehicle_suv.tres
data/world_assets/vehicle_van.tres
docs/WORLD_MAP_FILES.md
docs/WORLD_MAP_REPORT.md
maps/generation/block_generator.gd
maps/generation/block_generator.gd.uid
maps/generation/building_placer.gd
maps/generation/building_placer.gd.uid
maps/generation/enemy_spawner.gd
maps/generation/enemy_spawner.gd.uid
maps/generation/loot_spawner.gd
maps/generation/loot_spawner.gd.uid
maps/generation/map_generator.gd
maps/generation/map_generator.gd.uid
maps/generation/map_layout.gd
maps/generation/map_layout.gd.uid
maps/generation/navigation_builder.gd
maps/generation/navigation_builder.gd.uid
maps/generation/plot_generator.gd
maps/generation/plot_generator.gd.uid
maps/generation/prop_spawner.gd
maps/generation/prop_spawner.gd.uid
maps/generation/road_generator.gd
maps/generation/road_generator.gd.uid
maps/generation/vegetation_spawner.gd
maps/generation/vegetation_spawner.gd.uid
maps/generation/vehicle_spawner.gd
maps/generation/vehicle_spawner.gd.uid
maps/world/street_lamp.gd
maps/world/street_lamp.gd.uid
maps/world/world_asset.gd
maps/world/world_asset.gd.uid
scenes/world/barriers/barrier_chainlink.tscn
scenes/world/barriers/barrier_chainlink_damaged.tscn
scenes/world/buildings/commercial/building_pharmacy.tscn
scenes/world/buildings/commercial/building_restaurant_small.tscn
scenes/world/buildings/commercial/building_supermarket.tscn
scenes/world/buildings/industrial/building_warehouse_small.tscn
scenes/world/buildings/residential/building_house_small_a.tscn
scenes/world/buildings/residential/building_house_small_b.tscn
scenes/world/buildings/service/building_auto_repair_shop.tscn
scenes/world/buildings/service/building_gas_station.tscn
scenes/world/props/street/prop_street_lamp.tscn
scenes/world/props/street/prop_trash_bin.tscn
scenes/world/vegetation/vegetation_bush_a.tscn
scenes/world/vegetation/vegetation_tree_broadleaf_a.tscn
scenes/world/vehicles/vehicle_sedan_a.tscn
scenes/world/vehicles/vehicle_suv.tscn
scenes/world/vehicles/vehicle_van.tscn
tests/world_assets.gd
tests/world_assets.gd.uid
tests/world_map.gd
tests/world_map.gd.uid
tests/world_map_runtime.gd
tests/world_map_runtime.gd.uid
tests/world_map_views.gd
tests/world_map_views.gd.uid
tests/world_source_views.gd
tests/world_source_views.gd.uid
```

## 本任务修改

```text
README.md
art/ASSET_PIPELINE.md
art/MODEL_CATALOG.md
art/RESOURCE_LAYOUT.md
blue_hour/atmosphere.gd
core/main.gd
data/catalog.gd
data/map_data.gd
data/maps/east_quay.tres
docs/PLAN.md
maps/city.gd
missions/mission.gd
run.ps1
tests/art_integration.gd
tests/controls_runtime.gd
tests/day_loop_flow.gd
tests/mission_flow.gd
tests/parallel_commands.gd
tests/runtime.gd
tests/search_dispatch.gd
ui/mission_hud.gd
```

其中Catalog、MapData、地图Resource、Mission、city、run.ps1、部分测试和美术文档同时合并了其他用户任务，不能将所有行都归因于地图重构。main.gd仅新增已有隔离测试分支的导出Expedition启动参数。

## 本任务删除

```text
maps/city_art.gd
maps/city_art.gd.uid
```

旧地图装配已无运行引用。旧Blender资产在营地/展厅或资产库仍可使用，未擅自删除。

## 同期用户任务保留

蓝时号的VEH_BLUE_HOUR GLB/纹理/Wrapper、manifest注册、generated_assets、camp_main和DoorMotion，以及基础感染者模型/EnemyDefinition/时钟倍率/敌人实现均保留。旧巴士GLB和旧敌人Resource删除属于相应任务，不计作本地图删除。角色贴图sidecar等并发变动也未还原。

## 最终assets/world完整文件树

```text
assets/world/
├── barriers/
│   ├── barrier_chainlink_source_model.glb
│   └── barrier_chainlink_source_model.glb.import
├── buildings/
│   ├── commercial/
│   │   ├── building_pharmacy_model.glb
│   │   ├── building_pharmacy_model.glb.import
│   │   ├── building_restaurant_small_model.glb
│   │   ├── building_restaurant_small_model.glb.import
│   │   ├── building_supermarket_model.glb
│   │   └── building_supermarket_model.glb.import
│   ├── industrial/
│   │   ├── building_warehouse_small_model.glb
│   │   └── building_warehouse_small_model.glb.import
│   ├── residential/
│   │   ├── building_house_small_a_model.glb
│   │   ├── building_house_small_a_model.glb.import
│   │   ├── building_house_small_b_model.glb
│   │   └── building_house_small_b_model.glb.import
│   └── service/
│       ├── building_auto_repair_shop_model.glb
│       ├── building_auto_repair_shop_model.glb.import
│       ├── building_gas_station_model.glb
│       └── building_gas_station_model.glb.import
├── materials/
│   ├── chain_link.gdshader
│   ├── chain_link.gdshader.uid
│   ├── chain_link.tres
│   └── street_lamp_lens.tres
├── props/
│   └── street/
│       ├── prop_street_lamp_model.glb
│       ├── prop_street_lamp_model.glb.import
│       ├── prop_trash_bin_model.glb
│       └── prop_trash_bin_model.glb.import
├── vegetation/
│   ├── vegetation_bush_a_model.glb
│   ├── vegetation_bush_a_model.glb.import
│   ├── vegetation_tree_broadleaf_a_model.glb
│   └── vegetation_tree_broadleaf_a_model.glb.import
└── vehicles/
    ├── VEH_BLUE_HOUR.glb
    ├── VEH_BLUE_HOUR.glb.import
    ├── VEH_BLUE_HOUR_Image_0.jpg
    ├── VEH_BLUE_HOUR_Image_0.jpg.import
    ├── VEH_BLUE_HOUR_Image_1.jpg
    ├── VEH_BLUE_HOUR_Image_1.jpg.import
    ├── VEH_BLUE_HOUR_Image_2.jpg
    ├── VEH_BLUE_HOUR_Image_2.jpg.import
    ├── vehicle_sedan_a_model.glb
    ├── vehicle_sedan_a_model.glb.import
    ├── vehicle_suv_model.glb
    ├── vehicle_suv_model.glb.import
    ├── vehicle_van_model.glb
    └── vehicle_van_model.glb.import
```
