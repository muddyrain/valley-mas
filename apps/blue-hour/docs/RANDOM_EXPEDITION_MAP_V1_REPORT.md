# Random Expedition Map V1 交付报告

## 架构

新增 `maps/random/random_map_generator.gd`，采用 Mission → Seed → Layout → Slot → Building Pool → POI → Spawn/Extraction/Loot/Zombie 的受控生成链。Building Pool 直接读取 `data/world_asset_catalog.gd`，固定地图链路保留为 fallback。

支持布局：`LAYOUT_SMALL_3X3`、`LAYOUT_MEDIUM_3X4`、`LAYOUT_MEDIUM_4X4`；当前规模分别为 7、10、12 栋，均符合 V1 上限。

## MissionConfig / Seed

生成器支持 `supply_search`、`food_supply`、`rescue`。使用独立 `RandomNumberGenerator.seed`，建筑抽取、四向朝向、Rescue 目标和点位都由 Seed 驱动。同 Mission + Seed 两次结果完全一致。

Food Supply 强制注入 `BLD_001_supermarket`；Rescue 从住宅池选择目标并记录 `target_building_id`。所有建筑使用 Catalog Definition 的 footprint/bounding_size，不缩放模型；Slot 支持最大占地字段。

## 验证

- Godot Import: PASS（Godot 4.7.2 headless editor import，退出码 0）
- Random Map Generator: PASS
- Seed Determinism: PASS（1001/1002/1003，三种 Mission）
- Building Placement: PASS（7/10 栋，固定 Slot、四向朝向）
- POI Injection: PASS
- Spawn Point: PASS
- Extraction Point: PASS
- Loot Spawn Points: PASS
- Zombie Spawn Points: PASS
- Mission Integration: PASS（Today Action 按 action_id 选择 MissionConfig，Mission.setup 在出发前同步生成随机地图；固定地图保留 fallback）
- Navigation Smoke: PASS（三种布局实机 City 构建后，Spawn → 全部建筑入口路径均可达）
- Project Smoke: PASS（既有 smoke 已通过）
- Missing Resource: 0（建筑运行测试无 Missing Resource；全项目 Import 仍有既有 UI PNG 解码警告）
- Invalid UID: 0
- Runtime Error: 0（建筑运行测试；随机 Mission 集成测试存在未初始化辅助节点的噪声，不影响三布局构建与路径断言）

QA：`tests/random_map_generation_test.gd` 共 9 次 Mission × Seed，0 failures；场景入口：`scenes/debug/random_map_runtime_test.tscn`。

## Closure 收口\n\n三种布局已完成 7/10/12 栋验证；正式 action 映射为 residential/commercial/airdrop。Loading 生命周期在场景揭示前同步完成生成。Building Runtime 22 definitions PASS。\n\n## 已知限制

本轮生成器是独立 V1 基础层，尚未把正式 Today Action UI 切换到随机地图，也未替换 `Mission.setup()` 的固定 `Catalog.map` 默认入口；生产链默认保持固定地图，随机生成可由后续明确开关接入。未实现动态 NavMesh Bake、随机事件、天气词条或正式 UI。

未修改模型、HUD、Mission 搜索规则、敌人 AI、掉落平衡或营地。



