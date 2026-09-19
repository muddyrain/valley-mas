# Medium Town V1 Environment M02 — Targeted Street Props Placement

日期：2026-09-18。用户已确认四个 Batch 01 资产人工 `Asset QA = PASS`，并授权独立 M02 Town Placement。

```text
Medium Town V1 Environment M02
Targeted Street Props Placement: TECHNICALLY COMPLETE
Visual QA: PASS (HUMAN CONFIRMED 2026-09-19)
Town Structure: FROZEN
```

M02 的技术验证与截图验收均已完成；用户于 2026-09-19 确认 `HUMAN VISUAL QA: PASS`。全项目 Windows build 仍被既有 Camp UI 测试阻断，未交付本轮新 EXE。

## 实现与冻结边界

[Placement Pass](../maps/town/environment/town_targeted_props.gd) 重新生成冻结 M01.1 基线后只追加 `M02_###` 实例。独立随机流为 `town.seed ^ 0x4D303250`。同 Seed 可复现，不消费原 Town / M00 / M01 / M01.1 随机流。

每个实例保存 placement reason、zone、anchor 和空 rejection reason；失败候选另存拒绝原因。输出含基线数量、新增计数、候选记录、停车上下文和未来可连线元数据。接入只增加 [main 调试分支](../core/main.gd)、[独立场景](../scenes/debug/town_targeted_props.tscn) 与 [截图宿主](../maps/town/environment/town_targeted_capture.gd)，未接正式 Expedition。

既有 Town Structure、Seed / Grammar、Road Graph、Land Use、Block / Parcel / Frontage、Building Pool / Placement、Arrival、Mission POI、Exploration Routes 及 M00 / M01 / M01.1 生成器与证据均未改动。536 个受保护文件包含既有 Town 代码、World 资产 / Wrapper / Definition 及历史证据，SHA256 全部不变，见 [冻结清单](../test-output/medium-town-environment-m02/frozen-baseline.json) / [复核](../test-output/medium-town-environment-m02/frozen-verification.json)。

只使用 `PRP_Utility_Pole_A`、`PRP_Parking_Sign_A`、`PRP_Storefront_AFrame_Sign_A`、`PRP_Bicycle_A`；未修改源 GLB、Wrapper、材质、碰撞、Catalog 或用途标签。无新模型、Blender / Meshy 生产、电线、Loot / Search、Fog / Zombie / Blue Hour 或 M03。

## 放置规则与实际取舍

- 电线杆沿真实道路分段取点，按合法容量选择道路同一侧；候选站距 25–32m，全局杆间距至少 22m。道路外沿偏移 3.5 / 4.2 / 5m，使用已登记的允许 land use，避开路灯、建筑、入口、步行带和停车空间。拒绝点保留空段，不跨障碍硬补杆。
- 停车牌只关联真实非住宅停车面，放在多边形边界外约 0.75m，FrontMarker / RoadAnchor 朝道路侧。整个停车面（含空位和转向通道）均保护，未作为普通道路装饰使用。
- A 字牌从咖啡店、餐厅、便利店、小店等候选中按概率选择，每店最多一个，先尝试正前方 1.05m。当前商铺立面接近步行带边界，正前方常无合法空间，因此允许前角凹位：沿店铺侧墙外 1.05m、退至立面线后 0.5m，保持朝街道。该偏移是本轮明确的局部取舍，未缩小入口与步行净空；需人工确认前角位置是否自然。
- 自行车优先建筑侧墙外 1.4m，沿墙切向摆放，允许反向及 ±15° 扰动；每住宅 / 商业街区低频放置，公园候选仅选距街区边缘 8m 内、入口灯 5m 内的位置。保留资产脚撑与站立姿态。
- 几何检查合并真实 Mesh AABB 与启用 Collision，要求完整 footprint 落在合法 slot 内；保护所有既有 clear zones、住宅围栏开口、车道 / 停车垫和停车面。自行车在连续步行带外额外留 0.6m，电线杆距车道 / 停车垫至少 1.5m，实例间保留 0.35m 防重叠余量。

## Seed 4101 统计

| 项目 | 结果 |
|---|---:|
| M01.1 原实例（全部不变） | 605 |
| Total M02 New Instances | 31 |
| Utility Pole | 14 |
| Parking Sign | 3 |
| A-Frame | 3 |
| Bicycle | 11 |
| 最终实例总数 | 636 |
| Parking Signs With Valid Parking Context | 3 / 3 |
| A-Frames With Valid Commercial Frontage | 3 / 3 |
| Bicycle Residential / Commercial / Park Edge | 7 / 3 / 1 |
| Utility Pole Rejected Candidates | 88 |
| 未来可连线关系（仅元数据） | 4 |

A 字牌少于建议的 4–8 个，采用合法位置优先，不为凑数占用通道。

**Utility Pole Average Spacing：52.22m**，口径为同道路同侧所有相邻已放置电线杆；五段间距为 27.31、148.25、27.68、27.93、29.92m。148.25m 空段源于中间候选被净空约束拒绝，不能把全路段描述为连续 22–35m 节奏。仅四段满足 22–35m 的未来连线平均为 **28.21m**；这些关系引用既有 WireMarker_01 / 02 / 03，不生成任何电线。街道空段与规律性留给人工截图验收。

| Placement Rejection Reason | 候选数 |
|---|---:|
| building | 63 |
| walk_corridor | 40 |
| pole_spacing | 15 |
| surface_boundary | 15 |
| environment_overlap | 10 |
| road_side_preference | 4 |
| driveway_or_pad | 3 |
| parking_surface | 3 |

候选数包含同站不同侧 / 偏移尝试，并非被拒绝的独立资产数。`road_side_preference` 表示合法候选因保持同一路段单侧规律而放弃。完整实例与候选见 [environment.txt](../test-output/medium-town-environment-m02/environment.txt)。

## 多 Seed 与自动验证

| Seed | 电线杆 | 停车牌 | A 字牌 | 自行车 | 新增 | 最终总数 |
|---|---:|---:|---:|---:|---:|---:|
| 4101 | 14 | 3 | 3 | 11 | 31 | 636 |
| 4102 | 12 | 0 | 3 | 10 | 25 | 677 |
| 4103 | 10 | 0 | 2 | 9 | 21 | 683 |
| 4104 | 12 | 0 | 2 | 10 | 24 | 698 |
| 4105 | 13 | 0 | 4 | 9 | 26 | 653 |
| 4106 | 13 | 2 | 3 | 10 | 28 | 646 |
| 4110 | 17 | 2 | 4 | 12 | 35 | 674 |
| 4201 | 14 | 2 | 4 | 10 | 30 | 680 |

[专项测试](../tests/town_targeted_props.gd)：8 Seed、4 朝向，共 **304,563 checks / 0 failures**。覆盖确定性重复运行、Town 及 M01.1 基线不变、真实 footprint、Catalog / Definition / environment_tags、实例唯一 ID、slot 完整包含、环境重叠、道路 / 步行 / 入口 / 车道 / 停车面 / Arrival / Mission POI / Exploration Route / 公园路径净空、杆间距与同侧道路关系、停车牌上下文与朝向、每店最多一个 A 字牌、自行车上下文、未来连线元数据。

证据：[validation.json](../test-output/medium-town-environment-m02/validation.json)、[validation.log](../test-output/medium-town-environment-m02/validation.log)。

Godot 4.7.2 Compatibility 原生 1600×900 截图成功，Runtime Error = 0；[runtime.log](../test-output/medium-town-environment-m02/runtime.log)、[capture-report.json](../test-output/medium-town-environment-m02/capture-report.json)。前后对比共用 Town 与机位，只切换 M01.1 / M02 环境层；无 Debug Overlay，保持既有光照。细节使用 Expedition 相机偏移 (34,42,43)，另加明确命名的 A 字牌正面检查视角。独立截图入口的 Runtime 通过不代表正式 Expedition 集成已验收。

Windows `run.ps1 -Mode build` 已实际执行。Import、Expedition HUD 258 项、Survivor Command 45 项、Search Active Card 157 项、Settings 14 项通过；随后在 `tests/camp_ui_runtime.gd:114` 的 `member_buttons` 缺失及 “Camp exposes active abilities on its left edge” 断言失败退出。未改无关 Camp UI、未绕过门禁、未导出或验证本轮独立 EXE，见 [build.log](../test-output/medium-town-environment-m02/build.log)。

复现命令（在 apps/blue-hour 工程目录，以本机 Godot 可执行文件替换 godot）：

```powershell
godot --headless --path . --script res://tests/town_targeted_props.gd
godot --path . -- --town-environment-m02
```

## 人工截图验收

输出根目录：`test-output/medium-town-environment-m02/`。对比图左侧为 M01.1，右侧为 M02。

| 视角 | 截图 |
|---|---|
| Overview | [Before](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_overview_before.png) · [After](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_overview_after.png) · [Comparison](../test-output/medium-town-environment-m02/overview_comparison.png) |
| Residential Street | [Before](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_residential_street_before.png) · [After](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_residential_street_after.png) · [Comparison](../test-output/medium-town-environment-m02/residential_street_comparison.png) |
| Commercial Street | [Before](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_commercial_street_before.png) · [After](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_commercial_street_after.png) · [Comparison](../test-output/medium-town-environment-m02/commercial_street_comparison.png) |
| Parking Area | [PNG](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_parking_area.png) |
| Park Edge | [PNG](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_park_edge.png) |
| Utility Pole Street Rhythm | [PNG](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_utility_pole_rhythm.png) |
| Bicycle Placement Detail | [PNG](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_bicycle_detail.png) |
| A-Frame Placement Detail | [固定游戏视角](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_aframe_detail.png) · [补充正面检查](../test-output/medium-town-environment-m02/PROFILE_A_MAIN_STREET_4101_aframe_front_inspection.png) |

共 12 张原生截图、3 张前后对比图。图片、日志和导出物依仓库规则保存在本地忽略目录，不提交 Git。

人工重点已由用户确认通过：电线杆纵向尺度 / 密度 / 空段、停车牌与停车区关系、A 字牌前角位置、自行车依附关系及整体留白均接受。M02 已冻结并进入 M03；M03 另有独立报告和人工状态。
