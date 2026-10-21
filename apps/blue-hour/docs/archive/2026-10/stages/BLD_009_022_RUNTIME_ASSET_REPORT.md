# BLD_009–BLD_022 Runtime Asset 接入报告

## 交付内容

新增 14 个正式 GLB（source/runtime 副本）、14 个 Wrapper Scene、14 个 Definition，并注册到 `data/world_asset_catalog.gd`。BLD_001–BLD_008 保持既有资源与外观。

## 新增文件清单
- `assets/world/buildings/**/BLD_009_residence_c.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_009_residence_c.tscn`；`data/world_assets/BLD_009_residence_c.tres`
- `assets/world/buildings/**/BLD_010_residence_d.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_010_residence_d.tscn`；`data/world_assets/BLD_010_residence_d.tres`
- `assets/world/buildings/**/BLD_011_residence_e.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_011_residence_e.tscn`；`data/world_assets/BLD_011_residence_e.tres`
- `assets/world/buildings/**/BLD_012_two_story_house_a.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_012_two_story_house_a.tscn`；`data/world_assets/BLD_012_two_story_house_a.tres`
- `assets/world/buildings/**/BLD_013_small_apartment_a.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_013_small_apartment_a.tscn`；`data/world_assets/BLD_013_small_apartment_a.tres`
- `assets/world/buildings/**/BLD_014_small_apartment_b.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_014_small_apartment_b.tscn`；`data/world_assets/BLD_014_small_apartment_b.tres`
- `assets/world/buildings/**/BLD_015_convenience_store_a.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_015_convenience_store_a.tscn`；`data/world_assets/BLD_015_convenience_store_a.tres`
- `assets/world/buildings/**/BLD_016_small_shop_a.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_016_small_shop_a.tscn`；`data/world_assets/BLD_016_small_shop_a.tres`
- `assets/world/buildings/**/BLD_017_small_shop_b.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_017_small_shop_b.tscn`；`data/world_assets/BLD_017_small_shop_b.tres`
- `assets/world/buildings/**/BLD_018_cafe_a.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_018_cafe_a.tscn`；`data/world_assets/BLD_018_cafe_a.tres`
- `assets/world/buildings/**/BLD_019_laundromat_a.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_019_laundromat_a.tscn`；`data/world_assets/BLD_019_laundromat_a.tres`
- `assets/world/buildings/**/BLD_020_hardware_store_a.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_020_hardware_store_a.tscn`；`data/world_assets/BLD_020_hardware_store_a.tres`
- `assets/world/buildings/**/BLD_021_small_office_a.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_021_small_office_a.tscn`；`data/world_assets/BLD_021_small_office_a.tres`
- `assets/world/buildings/**/BLD_022_abandoned_house_a.glb` 与 `_source.glb`；`scenes/world/buildings/**/BLD_022_abandoned_house_a.tscn`；`data/world_assets/BLD_022_abandoned_house_a.tres`

## Registry / Pool

单一可信来源：`data/world_asset_catalog.gd`。Catalog 现包含 BLD_001–BLD_022 以及既有车辆、道具资源；可通过 `WorldAssetCatalog.asset(id)` 查询。Definition 字段扩展了 `building_id`、`display_name`、`subtype`、`searchable`、`loot_tags`、`mission_tags`、`spawn_weight`、`footprint`、`bounding_size`。

## Wrapper 状态

14 个新增 Wrapper 均包含 Visual/ModelRoot、1 个 BoxShape3D 简化碰撞、FrontMarker、EntranceMarker、SearchMarker、CenterMarker、RoadAnchor 与 Loot Primary。BLD_010 在 ModelRoot 绕 Y 旋转 180°，统一主立面方向。Bounds 使用 Definition 的 width/depth/height 基准。

## QA Scene

`scenes/debug/building_runtime_test.tscn` 一次实例化 BLD_001–BLD_022，按 5 列网格排列；`tests/building_runtime_test.gd` 检查 22 个 Definition、Scene 可加载及四类 Marker。

## 最终 Windows / Godot 验收结果

- Godot Import: PASS（Godot 4.7.2 headless editor import，退出码 0）
- BLD_001-022 Load: PASS（`tests/building_runtime_test.gd`，22 definitions，退出码 0）
- Building QA Scene: PASS（`scenes/debug/building_runtime_test.tscn` headless 启动，退出码 0）
- Building Registry: PASS（`WorldAssetCatalog.asset("BLD_001")` … `asset("BLD_022")` 全部返回 Definition）
- Collision: PASS（22 个 Wrapper 均为 BoxShape3D；无 Concave/Trimesh 碰撞）
- BLD_010 Orientation: PASS（ModelRoot 180° 修正，Marker 结构存在）
- Missing Resource: 0
- Invalid UID: 0
- Runtime Error: 0

另运行项目现有 `./apps/blue-hour/run.ps1 -Mode smoke`，退出码 0。

本轮未实现 Random Map、Seed、District/Block Generator，也未修改 Expedition 主流程、Mission 系统或 GLB 几何。
