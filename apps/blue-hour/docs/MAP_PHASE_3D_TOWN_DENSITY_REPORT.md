# Expedition Map Phase 3D：街区密度与街道布局

## Task Summary

沿用既有 Seed、Town street skeleton、建筑 Catalog、街道装饰和 BLUE HOUR ART_BIBLE V1。本阶段没有新增建筑模型；通过压缩 frontage 间距、增加住宅街块房屋数量和延伸一段住宅 frontage，让房屋从稀疏的单排点位变成连续街面，同时保留道路和小巷。

MiniMap 绘制逻辑未改。生产 Expedition 截图和 MiniMap 裁切截图用于确认没有 `Medium Town V1` 地图名，并保留地形、建筑、POI 和玩家位置。

## Changed Files

- 修改：`maps/town/town_main_street.gd`、`maps/town/town_land_use.gd`、`maps/town/town_urban_fabric.gd`、`tests/town_urban_fabric.gd`、`tests/town_generation_test.gd`、`run.ps1`、`docs/PLAN.md`。
- 新增：`tests/town_phase_3d_density.gd`、`tests/town_phase_3d_capture.gd`、`docs/MAP_PHASE_3D_TOWN_DENSITY_REPORT.md`。
- 生成的验收截图和 manifest 位于 Git 忽略目录 `test-output/town-phase-3d-capture/`。
- 无删除，无新增模型资源。

## Implementation Details

- 住宅 frontage gap：住宅 A `2.8m → 1.4m`，住宅 B `4.2m → 2.1m`，减少 50%。商业 `1.8–2.0m → 1.1m`，减少约 39–45%。工业 `8m → 4m`，减少 50%。
- 两个 residential frontage block 由 2 栋调整为 3 栋；混合街块的住宅 frontage 由 2 栋调整为 3 栋。住宅 A12 frontage 起点向前延长 12m，使三栋布局适配现有小房屋尺寸。
- Town 城市布局未因选 Seed 固定；普通住宅资源复用上限从 4 提至 5，避免新增住宅点位时随机候选耗尽。
- `_row()` 的宽度预算原本在每次迭代中重复预扣整排全部 gap。现在按当前剩余建筑数量扣除间隔，避免在逐栋选型时误报 frontage 容量不足。
- 住宅 gap 调整保留角色移动空间；原有道路宽度、道路连通图、街区多边形、入口朝向合同和装饰实例上限不变。

## Validation

- Godot 4.7.2 Windows Headless：Phase 3D 五 Seed `445 checks / 0 failures`；Seed 每图 57 栋（住宅 33、商业 19、工业 4），确定性、住宅街块栋数、道路连通和入口朝向通过。
- Town Urban Fabric 30 Seed：`152,972 checks / 0 failures`。覆盖道路净空、建筑/地块互不重叠、可达路线与紧凑 frontage 间距。
- Building Entrance Facing 10 Seed：`45,422 checks / 0 failures`。
- Phase 3C 街道 Props 五 Seed：`684 checks / 0 failures`。
- Town generation profiles：旧测试的 30–50 建筑上限及 1–3 dead-end 上限不适用于升级后的 Main Street。已改为 Main Street 30–60 建筑、连通且保留至少 2 个住宅支路终点；其他 Profile 保留原门槛。
- Phase 1.2 Town / MiniMap：Town 相关 `927 checks`，其中 1 项失败。失败的旧源码断言要求 MiniMap 源码不能包含 `display_name`；当前并行工作区把它用于幸存者发现提示。本阶段没有修改 MiniMap，该失败不是本次 Town 生成改动造成的。
- 原生 Godot 4.7.2 Compatibility 渲染 1600×900：Phase 3D 捕获 `8 images`，包含五个 Seed 俯视图、生产 Expedition 全 Town 图、Arrival 街景近景与 MiniMap 裁切图。MiniMap 截图内没有 `Medium Town V1` 地图名。
- Windows Release build / standalone export：`run.ps1 build` 已启动并完成导入及前 5 项相关前置检查；随后被 `tests/camp_ui_runtime.gd` 中既有 `camp_hud_root.gd` 缺少 `member_buttons` 和左侧能力栏断言阻断。未产出/验证本轮独立程序。

截图路径：

- Town Seed 4101：`test-output/town-phase-3d-capture/town_seed_4101_overview.png`
- Town Seed 4102–4105：同目录 `town_seed_<seed>_overview.png`
- Expedition 全 Town：`test-output/town-phase-3d-capture/expedition_town_overview.png`
- Arrival 街景：`test-output/town-phase-3d-capture/expedition_arrival_street.png`
- MiniMap：`test-output/town-phase-3d-capture/minimap_formal.png`

## Known Issues

- Town 俯视图显示连续性已有改善，但全 Seed 美术审查仍需人工确认；部分住宅后院、社区绿地和大型工业场地仍保留开放面积，以维持导航空间和街区功能分区。
- 完整 Release build 与独立程序启动仍未通过；阻断来自本工作区已有 Camp UI 变更，不属于 Phase 3D 的地图范围。
- GitNexus CLI 可用且索引最新；本次相关 GDScript 方法 impact 返回 `UNKNOWN / Target not found`。静态调用图确认 Town 生成数据被 runtime adapter、Camp 和专项测试消费；此次未修改接口，定向回归覆盖生成结果。

## Environment

- Windows Godot Editor / Runtime：Godot 4.7.2，已用于 Headless 回归及原生 1600×900 Compatibility 渲染捕获。
- Windows Blender：5.2.1 可用，本阶段不需要 Blender 或模型生成。
- Windows Node：本机 Node.js 可运行 GitNexus CLI。
- Windows Git：用于检查当前工作区和变更范围；未提交。
- macOS Godot / Blender：本次没有 macOS 环境，也未执行 macOS 验证。
