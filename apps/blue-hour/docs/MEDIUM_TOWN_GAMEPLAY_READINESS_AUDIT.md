# Blue Hour Medium Town Gameplay Readiness Audit

审计日期：2026-09-21  
范围：当前 `MEDIUM_TOWN_V1` / Expedition 运行时代码、数据与已有测试产物。  
本轮只读审计，没有修改地图、导航、Search、Enemy、HUD、Mission、Camp 或 Survivor。

## 结论

## **PARTIAL READY**

Medium Town 已经具备可渲染城镇、真实碰撞栅格导航、Arrival/Extraction 几何、建筑 Search Registry 和 Loot Profile 接口，足以继续进行 **E02/E03 Gameplay Adapter** 工作。

它目前还不能被判定为正式 Expedition Gameplay READY，原因是几个硬阻塞仍写在运行时契约中：

- `town_runtime_adapter.gd` 将 `vehicle_search_points` 和 `enemy_spawn_zones` 明确设为 `NOT_AVAILABLE_YET`。
- `missions/mission.gd` 对 Medium Town 设置 `director_enabled = false`，不执行 Encounter 初始人口接入。
- Medium Town 的 Search Registry 当前注册 **55 个建筑、0 个可搜索车辆**；41–47 个环境车辆被明确视为装饰车辆。
- 可玩门槛时后台 Search 导航解析仍存在 `49` 个 unresolved target 的历史性能记录，虽然 E02 全量搜索测试可以在等待解析后通过。
- Town Navigation 使用 AStarGrid2D，不是 NavigationMesh；性能和路线质量有实际证据，但 100 感染者压力不是当前正式测试结论。

因此评级为：

> **PARTIAL READY — 需要完成 E02 / E03 / Gameplay Adapter 后，才能进入正式 Mission Gameplay Closure。**

## 1. 当前数据与运行时链路

当前正式入口链路是：

`Today Action → core/main.gd::_mission_config() → Mission.setup() → MapProvider.MEDIUM_TOWN_V1 → TownGenerator → TownRuntimeAdapter → TownNavigation / SearchRegistry → HUD`

关键事实：

- `main.gd` 当前选择 `map_provider = MEDIUM_TOWN_V1`，不是旧 RandomMap。
- `town_runtime_adapter.gd::build_runtime()` 生成 Town、放置环境、构建碰撞导航，然后异步启动 `_build_navigation()`。
- `mission.gd` 在 Town ready 前拒绝移动命令；Navigation ready 后才允许 Survivor command。
- `town_runtime_adapter.gd` 复制 Town 的只读几何快照到 `runtime_data`，不把 Town Buildings 写回旧 `MapData.buildings`。
- `town_search_registry.gd` 在 Expedition 侧创建 Search proxy 和 `city.sites`，不修改冻结的 Town building instance。

已有证据：

- E00 Runtime Bridge：58 checks / 0 failures。
- E01 Navigation：240 checks / 0 failures。
- E01.5 Local Follow：1892 checks / 0 failures。
- E01.5 Minimap：1441 checks / 0 failures。
- E02 Search：1206 checks / 0 failures；E02 Native：14 checks / 0 failures。

这些是接口和专项能力证据，不等同于完整正式玩法闭环。

## 2. 地图结构审计

### 尺寸与道路

`PROFILE_A_MAIN_STREET` 的 Town bounds 为约 `310 × 260` 世界单位（`Rect2(-155, -130, 310, 260)`）；部分运行种子使用旋转后的 `260 × 310` 包围盒。主街和分支道路由 Town Urban Fabric 生成，E01 报告显示每个种子 13 条道路、单一连通 AStarGrid region。

### Arrival 到区域

E01 seed 4101 的实际路线时间（Survivor 速度基准约 4.5 m/s）如下：

| 区域/目标 | 单程实际走路时间 | 150 秒白昼下判断 |
| --- | ---: | --- |
| Residential landmark | 78.33 s | 偏长；到达后搜索和返航窗口很紧 |
| Commercial landmark | 60.23 s | 可用但需要尽快行动 |
| Park/open space | 44.50 s | 可作为中途区域 |
| Mission POI | 71.92 s | 可达，但不适合“搜索后再战斗再完整返航”的宽裕节奏 |

对应返回时间：Residential 77.98 s、Commercial 59.87 s、Park 59.87 s、POI 44.80 s。上述数据来自 E01 实际 AStar route walk，不是欧氏距离估算。

结论：Town 的空间尺度可以承载移动演示，但对 150 秒白昼而言，远端 Residential/POI 已经接近或超过“到达 + 搜索 + 战斗 + 返回”的合理预算。它不能证明所有目标都具备稳定的搜索和撤离余量。

## 3. 建筑 Gameplay 数据

World Asset 定义已经具备以下语义字段：`category`、`poi_type`、`loot_profile`、`loot_tags`、`searchable`、本地入口与 `search_interaction_local_anchor`。Town 生成时将 `primary_entrance`、`search_interaction`、`category`、`searchable` 和 Land Use 写入每个 building dictionary。

| 建筑/目标类型 | 数据定义存在 | Search Registry 当前状态 | Loot/交互判断 |
| --- | --- | --- | --- |
| residential | 有 | 可注册为建筑目标 | 由 asset `loot_profile` 驱动 |
| commercial / shop | 有 | 可注册为建筑目标 | category / `loot_profile` |
| industrial / warehouse | 有 | 可注册为建筑目标 | industrial 与 tools/material profile |
| pharmacy | 有 asset 定义 | 是否出现在某 seed 取决于生成结果 | medical/basic profile，当前资源仍受现有资源体系限制 |
| restaurant | 有 asset 定义 | 是否出现在某 seed 取决于生成结果 | commercial profile |
| gas station / service | 有 asset 定义 | 是否出现在某 seed 取决于生成结果 | fuel/vehicle profile |
| vehicle | sedan / SUV / van 定义存在 | 当前 Medium Town 运行时全部装饰化，0 可搜索 | `town_search_registry.gd` 要求 `lootable` meta + `EntranceAnchor`，当前条件未满足 |

审计结论：建筑语义字段基本具备；车辆的资源定义存在，但 Medium Town Gameplay 接入尚未成立。

## 4. Search 系统审计

### 当前实际数量

E02 report（seed 4101–4104）显示每个 Town：

- `building_count`: 55
- `reachable`: 55（在等待完整 resolve 后）
- `vehicle_count`: 0
- `decorative_vehicle_count`: 41–47
- `navigation_resolve_ms`: 约 0.133–0.165 ms（已完成批次的解析计算）

Search Registry 的正式步骤为：

`Town runtime_data building_search_points → Registry._register() → Loot.apply() → Navigation resolve → SearchTask`

Registry 会验证：

- asset `searchable`
- Loot Profile 存在
- Search interaction point 可清障
- Arrival exit 到 interaction point 有 path
- interaction point 与入口距离不超过 2.1 m

E02 在完整等待解析后报告 55/55 建筑可达，搜索流程、完成、取消、Loot、并行和地面点击保护均通过专项测试。但性能 P01 的可玩门槛记录显示 `search_unresolved_at_playable = 49`，说明“页面进入可玩”与“全部搜索点完成解析”之间仍有异步状态差异。

### Search Ready

**NO（正式完整口径）**。

建筑搜索链路已具备，车辆搜索没有接入；并且正式入口尚未证明所有 Search target 在玩家可操作时已经解析完毕。

## 5. Mission Diversity 支撑能力

| Mission | 判断 | 证据 |
| --- | --- | --- |
| Residential Supply Search | **B. 有接口但未完成** | residential 建筑、Food profile 和 Search 可用；Mission 对 Town 的 POI bias 没有改变 Town 生成选择 |
| Commercial Material Run | **B. 有接口但未完成** | commercial/industrial asset 与 Scrap profile 存在；正式 Town Loot/目标选择未按行动偏好闭合 |
| Airdrop Recovery | **C. 当前没有完整支持** | special/high-value 目标、独立交互点和独立高价值 Loot 没有在 Medium Town 正式入口形成；现有 Mission type 不等于 Rescue 玩法 |

当前 Town 的 `mission_poi` 可以生成和标记，但它是一个通用 Town POI 几何，不足以证明 Airdrop Recovery 的特殊交互、完成条件或奖励链。

## 6. Enemy Gameplay 审计

### Enemy Spawn Ready

**NO**。

原因不是缺少 Encounter 配置，而是正式 Town 接入链断开：

- `runtime_data.enemy_spawn_zones = NOT_AVAILABLE_YET`。
- `mission.gd` 在 `town_runtime_ready` 时设置 `director_enabled = false`。
- `mission.gd` 仅在非 Town runtime 分支执行 `encounter.seed_population(self)`。
- Town Navigation 有可走地面和障碍分类，但没有为 Encounter Director 提供正式 Spawn Area / Anchor / Threat Zone。

所以无法证明：住宅低密度、商业中密度、空投高密度的敌人差异，也无法证明 Blue Hour/Night 的 Town 生成压力。

## 7. 车辆 Gameplay 审计

| 车辆 | 资源定义 | Medium Town 可搜索 | Loot/Interaction |
| --- | --- | --- | --- |
| sedan | 有 | 否 | 未注册 |
| SUV | 有 | 否 | 未注册 |
| van | 有 | 否 | 未注册 |

当前环境中的车辆是 decoration-only：Search Registry 统计其数量并明确拒绝 `NOT_SEARCHABLE`。`vehicle_search_points` 仍为 `NOT_AVAILABLE_YET`。

结论：车辆 Gameplay **NOT READY**。

## 8. Extraction / Blue Hour 审计

### Extraction Ready

**PARTIAL / NO（正式闭环口径）**。

已存在：

- Arrival point 与 VehicleExitPoint。
- Town extraction position 与 ReturnZone marker。
- Survivor 到达、回到巴士和撤离 UI 的既有 Mission 链路。
- E01 导航可以从 Arrival/目标点生成路线。

尚未证明：

- 所有 Search/Enemy/Vehicle 目标在 150 秒白昼内有稳定返回窗口。
- Town Runtime 的敌人压力与 Blue Hour/Night 进入后的撤离风险。
- 目标完成条件、Loot 携带、撤离结算在 Medium Town 正式入口中的完整闭合。

## 9. 性能审计

### 已有数据

| 指标 | 观测值 |
| --- | ---: |
| Town bounds | 310×260 或旋转后的 260×310 |
| roads | 13 |
| Town building instances | 约 55 |
| Search building targets | 55 |
| Search vehicle targets | 0 |
| decorative environment vehicles | 41–47 |
| Navigation backend | AStarGrid2D |
| grid cell count | 323,541 |
| navigation obstacles | 685–753 |
| navigation build | 约 82–99 ms（E01） |
| route query average | 约 22.38–26.34 ms |
| longest route query | 约 45.44–48.74 ms |
| full click→playable | 约 2.25–2.65 s（P01） |
| environment data generation | 约 614–798 ms（P01 samples） |
| Search navigation resolve | 约 1.31–1.39 s compute；后台 elapsed 约 2.72–2.95 s |
| P01 frame update mean | 约 33–42 µs（E01.5 minimap update evidence） |

Navigation 数据规模以 323k 栅格单元计，不能把它等同于轻量小地图。当前证据没有完整的 50/100 感染者 Town 压力测试；P02 结果只覆盖已配置的 Survivor command / world update 场景，且正式 Town Director 被关闭。因此：

- 10 Survivors：**未证明**；当前专项通常为 3 人。
- 50 Infected：**未证明**；Town runtime 不生成正式 Encounter population。
- 100 Infected：**未证明**；没有有效压力结论。

## 10. 当前已满足

- Medium Town 真实生成与确定性 seed 传递。
- 真实建筑与环境实例、Arrival、Extraction 几何。
- 13 条道路和 Town bounds，AStarGrid2D 碰撞导航。
- Navigation readiness gate；未 ready 时移动命令拒绝，ready 后才接收。
- 多种静态障碍类别进入 Navigation：building、vehicle、fence、prop。
- Town minimap geometry 与 POI marker 数据。
- 55 个建筑 Search target 的注册、Reachability resolve、Loot profile 解析。
- SearchTask 的建筑搜索、完成、取消、并行和地面点击回归证据。
- Camp → Expedition 的原生加载截图和部分录屏证据。

## 11. 已有接口但未完成

- 车辆 Search：资源、Loot Profile 和 Registry 接口存在，但 Town 没有 lootable vehicle 实例或 interaction points。
- Mission POI preference：数据字段/POI marker 存在，但没有驱动 Town 选择或独立目标条件。
- Threat / Enemy profiles：Encounter Config 和 Mission Profile 接口存在，但 Town runtime 未提供 spawn zones，Director 被关闭。
- Search asynchronous resolution：后台预算和 priority resolve 存在，但玩家可操作门槛与全部目标 ready 之间仍有 49 unresolved 的性能记录。
- Extraction：几何和基础回程存在，但完整 Town Search + Enemy + Blue Hour + settlement 链未证明。

## 12. 当前阻塞 Mission Gameplay

1. **Enemy adapter**：为 Town 提供 spawn area/anchor/threat zone，并让 Encounter Director 在 Town runtime 消费它。
2. **Vehicle gameplay adapter**：把 sedan/SUV/van 的 lootable contract、EntranceAnchor、Search target 和奖励接入 Town environment。
3. **Mission objective adapter**：把 Residential / Commercial / Airdrop 的目标、POI preference、reward tendency 传到最终 Town runtime；不能只依赖通用 `mission_poi`。
4. **Search readiness gate**：决定正式可玩时必须全部目标解析，或明确只开放已解析目标并在 HUD 中反映状态。
5. **End-to-end settlement**：在 Town runtime 中实测 Search → Loot → Enemy → Blue Hour → Return → Settlement，而不是分别通过接口专项。
6. **Capacity/performance proof**：至少完成 10 Survivor、50/100 Infected 的同一 Town seed 原生压力测试。

## 13. 证据截图与录屏

当前可用的最新证据（均为已有产物，未在本审计中修改）：

1. [Medium Town 可玩截图，1600×900](../test-output/expedition-load-performance-p01/seed_01_playable.png)
2. [Arrival/Minimap Town ready 截图](../test-output/expedition-integration-e01-5/01_minimap_town_ready.png)
3. [Arrival markers 截图](../test-output/expedition-integration-e01-5/03_minimap_arrival_markers.png)
4. [Searchable building 截图](../test-output/expedition-integration-e02/01_searchable_building_detected.png)
5. [Search active 截图](../test-output/expedition-integration-e02/03_building_search_active.png)
6. [Search completed / reward 截图](../test-output/expedition-integration-e02/10_search_reward_result.png)
7. [Search full flow 录屏](../test-output/expedition-integration-e02/building_search_full_flow.mp4)

这些截图展示的是当前能力证据，不表示车辆、敌人或完整 Mission Diversity 已经可用。

## 14. Final Assessment

### **PARTIAL READY**

可以进入：

- E02 / E03 Gameplay Adapter
- Town Enemy Spawn Adapter
- Vehicle Search Adapter
- Mission Objective / POI Consumer Adapter

不能进入：

- 正式三种 Mission 的完整可玩闭环验收
- 50/100 感染者压力承载承诺
- “Medium Town 已满足正式 Expedition Gameplay 基础需求”的 READY 结论

本审计没有修改代码，也没有为通过审计临时补功能。
