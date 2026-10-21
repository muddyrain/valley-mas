# Expedition Building Entrance Facing System 全量修复报告

日期：2026-09-20。范围：Medium Town V1 `BLD_001`～`BLD_022`，正式 Town 生成、Expedition Runtime Bridge 与 E02 Search Interaction。E03 未开始。

## 结果

入口朝街已由按建筑编号补旋转，改为统一的数据驱动链路：每个 Building Definition 声明真实门锚点、本地门外方向和门外搜索站位；生成器根据 parcel 的 assigned frontage 计算 yaw，并把同一 transform 应用于门和搜索点。Corner lot 依次使用 assigned frontage、道路等级、frontage 长度和 seed 决定性 tie-break。

所有 wrapper 已把选定的真实主立面归一化到本地 `Vector3(0, 0, -1)`。这是逐 prefab 审计后的 wrapper 坐标契约，不是 generator 对模型默认 forward 的猜测。BLD_009、011～022 的既有 source correction 从实例化时的编号分支移入各自 wrapper；其旋转和平移与原运行时变换等价。`town_urban_view.gd` 不再包含 BLD 编号特判。

`primary_entrance` 是真实门中心，`search_interaction` 是门外 1.5m 的合法站位，旧 `entry` 继续别名到搜索站位以兼容 E02。Search Registry 保留 P01 的 `UNRESOLVED → priority/background resolve`，导航从 `search_interaction_point` 解析，不从建筑中心或视觉门内解析。

## BLD_001～022 审计

| Building | 类型 | Primary Entrance Local Forward | Entrance / Search Marker | Metadata | Auto Facing QA |
| --- | --- | --- | --- | --- | --- |
| BLD_001 | commercial | `(0, 0, -1)` | 已有，语义拆分 | 已补齐 | PASS |
| BLD_002 | residential | `(0, 0, -1)` | 已有，语义拆分 | 已补齐 | PASS |
| BLD_003 | residential | `(0, 0, -1)` | 已有，语义拆分 | 已补齐 | PASS |
| BLD_004 | commercial | `(0, 0, -1)` | 已有，语义拆分 | 已补齐 | PASS |
| BLD_005 | commercial | `(0, 0, -1)` | 已有，语义拆分 | 已补齐 | PASS |
| BLD_006 | industrial | `(0, 0, -1)` | 已有，语义拆分 | 已补齐 | PASS |
| BLD_007 | special | `(0, 0, -1)` | 已有，主入口明确 | 已补齐 | PASS |
| BLD_008 | industrial | `(0, 0, -1)` | 已有，人员入口明确 | 已补齐 | PASS |
| BLD_009 | residential | `(0, 0, -1)` | 已有，语义拆分 | 已补齐 | PASS |
| BLD_010 | residential | `(0, 0, -1)` | 已有，语义拆分 | 已补齐 | PASS |
| BLD_011 | residential | `(0, 0, -1)` | 已有，语义拆分 | 已补齐 | PASS |
| BLD_012 | residential | `(0, 0, -1)` | 已有，主入口明确 | 已补齐 | PASS |
| BLD_013 | residential | `(0, 0, -1)` | 已有，主入口明确 | 已补齐 | PASS |
| BLD_014 | residential | `(0, 0, -1)` | 已有，主入口明确 | 已补齐 | PASS |
| BLD_015 | commercial | `(0, 0, -1)` | 已有，顾客入口明确 | 已补齐 | PASS |
| BLD_016 | commercial | `(0, 0, -1)` | 已有，顾客入口明确 | 已补齐 | PASS |
| BLD_017 | commercial | `(0, 0, -1)` | 已有，顾客入口明确 | 已补齐 | PASS |
| BLD_018 | commercial | `(0, 0, -1)` | 已有，顾客入口明确 | 已补齐 | PASS |
| BLD_019 | commercial | `(0, 0, -1)` | 已有，顾客入口明确 | 已补齐 | PASS |
| BLD_020 | commercial | `(0, 0, -1)` | 已有，顾客入口明确 | 已补齐 | PASS |
| BLD_021 | special | `(0, 0, -1)` | 已有，主入口明确 | 已补齐 | PASS |
| BLD_022 | residential | `(0, 0, -1)` | 已有，主入口明确 | 已补齐 | PASS |

每项 metadata 均包含 `primary_entrance_local_anchor`、`primary_entrance_local_forward`、`search_interaction_local_anchor`。实际数值保存在对应 `.tres`，wrapper 的 `EntranceMarker` 与 `SearchMarker` 分别和前两类位置数据一致。

## 自动验证

- Definition / transform / geometry：22 definitions × 4 cardinal transforms，加 10 个正式 seed、550 个实例，共 **42,192 checks / 0 failures**。验证 assigned street/frontage、门朝向、向前取样到道路距离下降、搜索点不在建筑/其他建筑/道路中心、wrapper 与数据一致、同 seed 重建一致。
- 正式 Runtime navigation：seeds `4101, 4102, 4103, 4104, 7301, 7302, 7303, 7304, 9917, 12031`，**2,230 checks / 0 failures**。所有 searchable building 的站位均在 authored point 2m 内解析，且从 Arrival 有路径。
- Town Urban Fabric：**142,874 checks / 0 failures**；建筑 mesh bounds、Road Graph、Parcel containment 与无建筑/道路相交仍通过。
- Building Runtime：22 definitions，PASS。
- 生成器与 view 源码扫描：无 `building_id ==`、`seed_value ==` 或 `position ==` 实例修补。
- E00/E01/E01.5/E02 的 App 级回归被工作区并行 Camp 改动阻断：`ui/shelter_view.gd:19` 对 Nil 读取 `id`，发生在 Expedition 创建前。本轮未修改该并行区域。

## QA 证据

`test-output/building-entrance-facing/` 包含：

- `overview_seed_01.png`、`overview_seed_02.png`、`overview_seed_03.png`
- `residential_cases.png`、`commercial_cases.png`、`industrial_cases.png`
- `corner_lot_cases.png`、`rotation_0_90_180_270.png`
- `entrance_debug_overlay.png`
- `automatic_geometry_report.json`、`navigation_report.json`、`windows-build.log`

覆盖层仅存在于 QA 脚本：绿色点/线表示门和门外 forward，黄色点表示 Search Interaction，蓝线连接 assigned frontage；标签显示 Building ID、Street、Frontage、Yaw 与 PASS。

## Build 与冻结边界

已实际执行 `run.ps1 -Mode build`。Import、Search Gameplay 72、HUD Phase2 258、Survivor Command 45、Search Active Card 157、Settings 14 均通过；随后 `camp_menu_overlay_runtime.gd` 被既有 `shelter_view.gd:19` Nil `id` 阻断，build exit 1，未进入 Windows export。本轮没有修改 Town Grammar、Road Graph、Land Use 分区、Parcel topology、M00～M03 语义、E01 movement、E01.5 minimap 或 E02 loot/reward；没有新增模型。

```text
Building Entrance Facing System: TECHNICALLY COMPLETE
10 Seed Entrance Facing: PASS
Human Runtime QA: PENDING
E03 Enemy: NOT STARTED
```
