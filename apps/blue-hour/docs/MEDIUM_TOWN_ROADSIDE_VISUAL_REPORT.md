# Medium Town V1 Environment M03 — Roadside Infrastructure & Visual Completion

日期：2026-09-19。M02 已由用户确认 `HUMAN VISUAL QA: PASS`，本轮在所有 Town、M00、M01、M01.1、M02 数据和实例冻结的前提下执行。

```text
Medium Town V1 Environment M03
Roadside Infrastructure & Visual Completion: TECHNICALLY COMPLETE
Visual QA: PENDING HUMAN REVIEW
Town Structure: FROZEN
```

## 边界与实现

M03 由 [town_roadside_visual_pass.gd](../maps/town/environment/town_roadside_visual_pass.gd) 读取 M02 的 `future_wire_links`，由 [town_roadside_view.gd](../maps/town/environment/town_roadside_view.gd) 建立独立可切换的展示层。连线仅查找元数据端点，不重新搜索邻接关系、不移动 M02 实例、不写回 M02 字典，也不加载正式 Expedition 场景。入口为 `--town-environment-m03`，场景和截图宿主为 [town_roadside_visual.tscn](../scenes/debug/town_roadside_visual.tscn) / [town_roadside_capture.gd](../maps/town/environment/town_roadside_capture.gd)。

622 个冻结文件 SHA256 不变，覆盖既有 Town / 环境代码、World 资产、Batch 01 Wrapper / Collision / Marker、Catalog 及 M00～M02 历史证据。见 [冻结清单](../test-output/medium-town-environment-m03/frozen-baseline.json) / [复核结果](../test-output/medium-town-environment-m03/frozen-verification.json)。M02 报告仅同步用户的人工通过状态，原运行日志、截图和序列化证据未改写。

### Utility Pole Dynamic Wires

仅消费 M02 已记录的合法同道路、同侧 Pole Pair。Seed 4101 接受 4 / 4 组，跨度 27.31–29.92m，平均 28.21m，平均悬垂 0.512m；每组 3 根并行线，每根 12 段、6 个径向侧面，三根合并成一个 432 三角面的 Mesh，共 4 Mesh / 1,728 tris，共用一个材质。线体深灰蓝、直径约 2.8cm、无 PhysicsBody / CollisionShape / Searchable / Interaction，且关闭阴影。M02 已知 148.25m 空段没有任何线跨越。

自动检查还验证了 WireMarker_01 / 02 / 03 的真实端点、至少 6m 的安全高度、建筑包围盒避让、唯一 Pair、22–42m 跨度限制和超长 span rejection。生成器保守拒绝树干碰撞盒或完整树冠 AABB 的交叉，测试另注入建筑、树干、树冠和 148m 超长候选，确认拒绝分支生效。Seed 4101 的 4 组关系没有发生拒绝；所有其他 Seed 也仅接受 M02 元数据中的合法 Pair。

### Road / Sidewalk Surface Visual Polish

保持 RoadNetwork / SidewalkNetwork 原 Mesh 和范围。独立 [roadside_surface.gdshader](../maps/town/environment/roadside_surface.gdshader) 沿用既有世界坐标铺装方式，道路采用约 22m 大尺度灰蓝色差，人行道采用暖灰米灰并保留 1.2m tile pattern。路缘用既有 union mesh 方法计算「道路外扩 18cm 并集减原道路并集」，只落在人行道内沿，不覆盖路口和原车行面，关闭阴影。通过 `set_enabled` 切换 M03 时恢复 M02 原材质引用，不修改缓存的共享材质或物理层。

### Parking / Commercial Ground Detail

Seed 4101 在真实非住宅停车面生成 2 个 P 地面标识，每个停车面最多一个，完整位于合法停车多边形内，避开原车位线、车辆 footprint、Arrival、Mission POI 和探索路线。P 是 4 个薄条组成的程序几何字形，朝道路观察侧可读，非新模型；未生成缺少明确停车入口语义的方向箭头。

商业核心在 4 处真实商业 frontage 入口生成小铺装 accent；每处约 1.35–1.85m × 0.85–1.15m，完整位于人行铺装内、避开建筑、道路和保护区，色调及尺寸有轻微变化。独立随机流为 `town.seed ^ 0x4D303356`；本次八个 Seed 产生 4–7 处，未全图铺满。

## Seed 4101 统计

| 指标 | 结果 |
|---|---:|
| M02 Base Instance Count | 636 |
| Wire Candidate Pair Count | 4 |
| Wire Accepted Pair Count | 4 |
| Wire Rejected Pair Count | 0 |
| Wire Average Span | 28.209m |
| Wire Max Span | 29.922m |
| Wire Average Sag | 0.512m |
| Parking Ground Detail Count | 2 |
| Commercial Surface Accent Count | 4 |
| Road Material Changed | yes |
| Sidewalk Material Changed | yes |

| Seed | M02 base | Wire pairs | P marks | Commercial accents | Avg span | Max span |
|---|---:|---:|---:|---:|---:|---:|
| 4101 | 636 | 4 | 2 | 4 | 28.209m | 29.922m |
| 4102 | 677 | 4 | 0 | 4 | 27.345m | 28.341m |
| 4103 | 683 | 1 | 0 | 5 | 30.433m | 30.433m |
| 4104 | 698 | 3 | 0 | 6 | 28.585m | 29.664m |
| 4105 | 653 | 1 | 0 | 7 | 30.952m | 30.952m |
| 4106 | 646 | 3 | 2 | 5 | 26.247m | 27.533m |
| 4110 | 674 | 5 | 2 | 5 | 26.983m | 28.901m |
| 4201 | 680 | 2 | 2 | 5 | 29.689m | 30.820m |

## 验证与截图

[M03 专项测试](../tests/town_roadside_visual.gd) 共 **55,967 checks / 0 failures**，覆盖 8 Seed / 4 朝向、Determinism、M02 / M01.1 / Town 冻结、WireMarker 端点、wire pair 唯一性、span hard max、悬垂、建筑与地面避让、停车和商业上下文、无物理层、道路 Mesh 不变、共享材质不变、前后材质恢复以及路缘不侵入道路。M02 基线的完整重复生成同时复用未修改的 M00 / M01 / M01.1 链。

证据：[validation.json](../test-output/medium-town-environment-m03/validation.json)、[validation.log](../test-output/medium-town-environment-m03/validation.log)、[runtime.log](../test-output/medium-town-environment-m03/runtime.log)。

截图基线复核：M03 Overview Before 与冻结 M02 Overview After 的 1,440,000 像素中，RGB 任一通道差异超过 3/255 的像素为 0，见 [基线画面对照数据](../test-output/medium-town-environment-m03/capture-baseline-verification.json)。最终图片集合以 [capture-report.json](../test-output/medium-town-environment-m03/capture-report.json) 为准。

原生 Godot 4.7.2 Compatibility 输出 14 张 1600×900 截图和 4 张前后对比图，Runtime Error = 0；对比图左侧 M02、右侧 M03，共用同一份 636 个 M02 实例和同一 Town。通过恢复原材质 / 隐藏 M03 几何生成 Before。光照沿用 M02；额外补充低角度电线侧视、停车字形与商业入口正面细节。长空段机位依据 M02_001 与 M02_002 的真实位置取中点，跨度 148.2505m。正式 Expedition 未接入。

| 视角 | 截图 |
|---|---|
| Overview | [Before](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_overview_before.png) · [After](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_overview_after.png) · [Comparison](../test-output/medium-town-environment-m03/overview_comparison.png) |
| Utility Wire Street Detail | [PNG](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_utility_wire_street_detail.png) |
| Utility Wire Side View | [PNG](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_utility_wire_side_view.png) |
| Commercial Core Before / After | [Before](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_commercial_core_before.png) · [After](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_commercial_core_after.png) · [Comparison](../test-output/medium-town-environment-m03/commercial_core_comparison.png) |
| Parking Area Before / After | [Before](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_parking_area_before.png) · [After](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_parking_area_after.png) · [Comparison](../test-output/medium-town-environment-m03/parking_area_comparison.png) |
| Residential Street Before / After | [Before](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_residential_street_before.png) · [After](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_residential_street_after.png) · [Comparison](../test-output/medium-town-environment-m03/residential_street_comparison.png) |
| Sidewalk / Road Material Detail | [PNG](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_sidewalk_road_material_detail.png) |
| Long Pole Gap Inspection | [PNG](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_long_pole_gap_inspection.png) |
| Parking Symbol Detail | [PNG](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_parking_symbol_detail.png) |
| Commercial Frontage Detail | [PNG](../test-output/medium-town-environment-m03/PROFILE_A_MAIN_STREET_4101_commercial_frontage_detail.png) |

构建限制：本轮实际运行 Windows `run.ps1 -Mode build`，Import、Search Gameplay 72 项、Phase2 258 项、Survivor Command 45 项、Search Active Card 157 项、Settings 14 项通过。最终仍在 Camp UI `member_buttons` 缺失及左侧能力区断言处阻断，未导出或验证本轮新 EXE。Survivor Command / Search Active Card 另有 4 / 2 个 ObjectDB 泄漏警告，属于全项目构建日志，不能合并为 M03 Runtime Error。见 [本轮构建日志](../test-output/medium-town-environment-m03/build.log)。M03 不修改无关 Camp UI，也不绕过构建门禁。

截图、日志与序列化数据保存在本地忽略目录，未提交 Git。PLAN 与 M02 人工状态已同步；未新增模型、修改四个 GLB / Wrapper，未开始 Gameplay、M03.1 或 M04。

当前只等待人工视觉审核：电线粗细、悬垂与树冠关系，道路／人行道层次，P 标识可读性，商业入口 accent 的自然度，以及是否出现过度模板化。不要开始 M03.1 / M04。
