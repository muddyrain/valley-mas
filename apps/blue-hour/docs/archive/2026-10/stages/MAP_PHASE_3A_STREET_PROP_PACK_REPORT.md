# 蓝时归航 Expedition Map Phase 3A

## 交付范围

本阶段新增 18 个低模街道、住宅和轻末日道具，并在 Medium Town V1 的固定 Seed 结果上追加只读 `UrbanDressingLayer`。Dressing 只输出装饰 placement records 和无碰撞实例，不注册搜索点，不改变道路、街区、建筑、POI、导航或 Arrival 数据。

本机未安装 Blender 4.x，因此本次交付使用 `art/blender/generate_street_prop_pack.py` 的无依赖程序化 GLB 后端完成真实 `.glb` 导出。资产 manifest 明确标记 `procedural_glb_fallback_no_blender`；Blender `.blend` 源文件需在具备 Blender 的工作站重新生成，不能把本次 fallback 误称为 Blender 源文件。

## 资产清单

输出目录：`assets/world/props/street_prop_pack_v1/`

| 资产 | Tris | 尺寸（米，X/Y/Z） |
| --- | ---: | --- |
| PRP_STREET_001_trash_bin | 96 | 0.68 / 0.93 / 0.68 |
| PRP_STREET_002_mailbox | 72 | 0.55 / 0.695 / 0.58 |
| PRP_STREET_003_street_lamp_b | 120 | 1.45 / 5.50 / 0.48 |
| PRP_STREET_004_traffic_cone | 108 | 0.44 / 0.64 / 0.44 |
| PRP_STREET_005_road_barrier | 36 | 2.10 / 0.81 / 0.35 |
| PRP_STREET_006_bus_stop_sign | 120 | 0.58 / 2.625 / 0.36 |
| PRP_STREET_007_bench | 48 | 1.75 / 0.99 / 0.73 |
| PRP_STREET_008_vending_machine | 36 | 0.98 / 1.75 / 0.78 |
| PRP_HOUSE_001_bicycle | 560 | 1.57 / 0.65 / 0.81 |
| PRP_HOUSE_002_flower_pot_set | 384 | 1.433 / 0.755 / 0.653 |
| PRP_HOUSE_003_laundry_rack | 48 | 1.70 / 1.45 / 0.55 |
| PRP_HOUSE_004_patio_table_set | 120 | 1.92 / 0.785 / 0.84 |
| PRP_HOUSE_005_wood_fence_segment | 60 | 2.95 / 1.55 / 0.14 |
| PRP_HOUSE_006_package_box_set | 24 | 1.105 / 0.48 / 0.50 |
| PRP_RUIN_001_garbage_bag_pile | 360 | 1.13 / 0.56 / 0.776 |
| PRP_RUIN_002_fallen_bicycle | 560 | 1.57 / 0.65 / 0.81 |
| PRP_RUIN_003_broken_sign | 120 | 0.85 / 1.51 / 0.20 |
| PRP_RUIN_004_tire_stack | 768 | 0.92 / 0.96 / 0.92 |

全部资产使用米制、地面中心 pivot、纯材质色块和可重复摆放的低模几何；导入资源和目录定义见同目录 `manifest.json` 及 `data/world_assets/PRP_*.tres`。

## Godot 接入

- `maps/town/environment/town_urban_dressing_layer.gd`：Seed XOR 固定常量，按 Residential / Commercial / Industrial / Arrival 分类，单 Seed 上限 96 个，拒绝道路、建筑和已有环境实例重叠。
- `maps/town/environment/town_urban_dressing_view.gd`：统一实例化装饰，不创建 StaticBody3D，不进入 Search Registry。
- `maps/expedition/town_runtime_adapter.gd`：在 M02 环境和 M03 道路视觉之后生成并实例化 M03A，运行时快照增加 `m03a_statistics` 和 `urban_dressing_instance_count`。
- Arrival 半径 20m 内强制放置 2 个路灯、垃圾桶、长椅和花盆组；入口仍由原有道路与 BusArrival 控制。

## 验收

`tests/town_phase_3a_street_prop_pack.gd`：5 个 Seed、3878 项检查、0 failures。覆盖 18 个 GLB 存在/导入/实例化、Seed 确定性、区域存在性、Arrival 规则、道路/建筑清除和总量上限。

`tests/expedition_integration_e00.gd`：58 checks / 0 failures，证明既有 Medium Town provider 和 Expedition runtime bridge 仍能加载。

原生截图位于 `test-output/town-phase-3a-capture/`，共 25 张：5 个 Seed 各包含 overview、residential、commercial、industrial、arrival；manifest 记录在 `capture-manifest.json`。

现有 `tests/expedition_visual.gd` 仍有 24 项旧 HUD/纹理门禁失败，涉及本阶段之前的 Camp HUD 和建筑纹理设置，未归因于 Phase 3A。
