# 蓝时归航实施计划

## 2026-09-21：Map Phase 1.1.5 — MiniMap Geometry Full Snapshot

- [x] `mission.runtime_data.minimap_geometry` 扩展为版本化快照：道路提供 centerline、polygon、width、type；建筑默认提供 polygon、位置、尺寸、朝向、类型、入口与地块信息；不再依赖已发现状态。
- [x] Arrival 快照加入蓝时号停靠区、对应道路、出口走廊和停车区域；MiniMap 动态 Marker 继续沿真实世界坐标投影，拥挤/越界时只偏移图标并保留 tether 空间参照。
- [x] TownWorldLayer 按真实道路 polygon 绘制主路/支路，叠加停车、Arrival 分区和静态建筑轮廓；保留旧 `road_bounds` / `bounds` 回退路径。
- [x] `tests/expedition_minimap.gd`：4101–4105 共 2,131 项通过；`tests/runtime_loading_gate.gd` 121 项通过。局部跟随专项 1 项既有队伍中心断言失败，未发现本轮几何快照或渲染命令错误。
- [ ] Human Runtime QA：PENDING。原生 MiniMap capture 在既有世界点击命令断言处停止；完整 Windows build 仍受既有 Camp UI `member_buttons` / 左侧能力栏回归阻断，未生成本轮独立 EXE。详见 [Phase 1.1.5 报告](MAP_PHASE_1_1_5_MINIMAP_GEOMETRY_REPORT.md)。

## 2026-09-21：MiniMap Survivor Marker V2 — No Selection

- [x] Survivor marker 移除头像纹理和小地图选中状态，改为 `draw_circle` / `draw_arc` 的中心点 + 外圈；所有存活成员保持相同尺寸和信息等级。
- [x] 移动状态使用轻微呼吸外圈，搜索状态使用旋转弧线；不改世界角色选择、移动、搜索或 Expedition 输入系统。
- [x] 更新 Minimap Bridge、Local Follow、HUD Phase 2 测试契约，并新增静止 / 移动 / 搜索三状态截图专项 `tests/minimap_survivor_marker_acceptance.gd`。
- [x] Headless 16 checks / 0 failures，原生 19 checks / 0 failures，三张状态截图已生成；Windows build 仍受既有 Camp UI 门禁阻断，不推进 Full/Tactical Map、Fog 或其他 HUD 重构。

## 2026-09-21：Map Phase 1.2 — MiniMap Renderer Visual Reconstruction

- [x] 保持 `mission.runtime_data.minimap_geometry` 和 LOCAL_FOLLOW 坐标合同不变，仅重建 `MiniMap` renderer 的静态绘制层。
- [x] 修正静态层被父节点底色遮盖的问题；按 Terrain、Road、Building、Arrival/Special、Dynamic Marker 分层绘制并缓存。
- [x] 主路 / 支路 / connector、住宅 / 商业 / 工业 / 特殊建筑、Arrival 停靠区 / 入口 / 停车区使用独立视觉层级；已发现车辆使用车辆 marker。
- [x] 4101–4105 原生对比图已生成；MiniMap bridge 2,131 项、Local Follow 2,180 项、Loading Gate 121 项通过。详见 [Phase 1.2 报告](map/M02_Minimap_Renderer_Visual_Reconstruction.md)。
- [ ] 完整 Windows build 和旧移动 capture 仍受工作区既有 Camp UI / weapon / 世界点击并行回归阻断；不归因于本轮 renderer。

## 2026-09-21：Survivor Progression Foundation V1

- [x] 新增 `SurvivorProgression`，统一管理 XP、Level、Trait Level 和 Level 5 上限；XP 阈值为 `2 / 3 / 5 / 8`。
- [x] 建立 `SEARCH_COMPLETE`、`KILL_ENEMY`、`MISSION_COMPLETE`、`EXTRACTION_SUCCESS`、`SPECIAL_EVENT` 五类 XP Event，以及 Campaign 统一 Runtime API。
- [x] 存档升级为 v5；旧 v1～v4 可读取并补齐 Progression 字段；不保存最终 Trait 数值。现有食物训练改为通过 Progression API 提升等级。
- [x] Progression 20、Trait Foundation 44、Trait Gameplay 111、New Run 40、Weapon 428、Save Catalog 9 项通过；Godot Headless Import 重跑通过。详细边界与证据见 [Progression 报告](SURVIVOR_PROGRESSION_FOUNDATION_REPORT.md)。
- [ ] 本轮未制作 UI、升级动画、招募、受伤、Aura、疲劳、士气、关系或实际 Gameplay XP 发放点。
- [ ] Search / Command 全链路回归仍受工作区既有 `weapon_combat_controller.gd` 解析错误阻断；不属于本轮 Progression 改动。

## 2026-09-21：Survivor XP Gameplay Integration V1

- [x] Search 成功、最终击杀、Mission Complete、Extraction Success 已接入既有 `record_xp_event()`；数值集中在 `XP_EVENT_VALUES`，分别为 `1 / 1 / 5 / 3`。
- [x] Search / Enemy retirement 使用 Mission 级事件键；对象池复用时重置敌人键；重复 `stage_result()` 不重复发放 Mission / Extraction XP。
- [x] `tests/survivor_progression.gd` 29 项、`tests/survivor_xp_gameplay.gd` 6 项通过。详细边界见 [XP Gameplay 报告](SURVIVOR_XP_GAMEPLAY_INTEGRATION_REPORT.md)。
- [ ] SPECIAL_EVENT 只保留 API，未接入具体剧情事件；未制作 UI 或新的 Trait / Progression 系统。

## 2026-09-21：SUR_003～SUR_012 Trait Runtime Phase A

- [x] 统一 `TraitRuntime` 已接入六个直接 Modifier：SUR_003 近距离感染者伤害、SUR_005 机械交互耗时、SUR_007 远距离感染者伤害、SUR_009 最大生命、SUR_010 Rare+ 权重、SUR_012 团队 Power 冷却。
- [x] Damage 使用世界 XZ 距离和感染者目标标签；Interaction 使用正式目标分类；Max HP 从 Runtime 副本派生并在等级变化时保持生命比例；Loot Quality 修改原单次抽取权重，不增加随机次数；Power 冷却只读取正式 Effect Resource。
- [x] Phase A 专项 76 项、SUR_001/002 155 项、Town 13 项、12 人批次 337 项、公共 Locomotion 495 项、Xia/Su Gameplay 各 29 项、Camp 31 项均 0 失败。SUR_010 固定种子各 100,000 样本，Baseline/Lv1/Lv5 Rare+ 实测 20.065% / 21.328% / 22.548%；正式搜索装备奖励入口传递执行者 Trait。
- [x] SUR_004 / 006 / 008 / 011 保持 `data_only`；未建立 Aura、周期治疗或周期暴击系统。实现与验证详见 [Phase A 报告](TRAIT_RUNTIME_PHASE_A_REPORT.md)。
- [ ] Windows build 已执行；Search、HUD、Command、Active Card、Settings、Camp Menu 六组前置门禁通过，随后被既有 `camp_ui_runtime.gd:114` 的 `member_buttons` 访问和旧左侧能力栏断言阻断，未进入导出。完整旧 Effect/生产流程仍有既有断言与导航超时；本轮专项与受影响回归已通过。

## 2026-09-21：Survivor Team Aura Runtime V1

- [x] 建立通用 `AuraRuntime`，按 TraitData 的 `effect_type` / `radius_m` 查询 Provider；同类型取最大值，Provider 自身、死亡和撤离成员排除。
- [x] SUR_006 / SUR_011 激活 6m、Lv1～Lv5 8/10/12/14/16% 数据；分别接入现有移动速度和感染者受伤 Hook，不修改 Max HP、XP、Level、动画或模型。
- [x] Aura 专项 21 项、Trait Foundation 44 项、12 人批次 337 项、Godot Headless Import 通过。详细实现与边界见 [Aura 报告](SURVIVOR_TEAM_AURA_RUNTIME_REPORT.md)。
- [ ] Phase A 全量回归仍受工作区既有 Progression Save/Load 与 SUR_012 Lv5 断言阻断；未实现 SUR_004 / SUR_008 的周期 Trait。

## 2026-09-21：Survivor Periodic Effect Runtime Foundation V1

- [x] 新增隔离的 `PeriodicEffectRuntime`：数据驱动 interval / duration / radius / target filter / level value，支持多个 Provider、暂停恢复、死亡检测和 Provider 注销。
- [x] 建立 `SELF`、`ALLY`、`NEAREST_ALLY`、`LOWEST_HP_ALLY`、`ALL_TEAM` 目标选择合同；Apply / Refresh / Expire 通过事件信号输出，未实现具体治疗或暴击效果。
- [x] 周期 Runtime 专项 13 项与 Godot Headless Import 通过；详见 [Periodic Effect 报告](SURVIVOR_PERIODIC_EFFECT_RUNTIME_REPORT.md)。SUR_004 / SUR_008 仍保持 data-only。

## 2026-09-21：SUR_004 陆清禾「应急处理」V1

- [x] 仅通过 TraitData 启用 SUR_004：10 秒间隔、6m、`LOWEST_HP_ALLY`，仅在目标低于 50% 最大生命时触发；最低受伤成员优先，提供者可在自身为最低目标时接受治疗；Lv1～Lv5 为 5/6/7/8/10% 最大生命治疗。
- [x] 新增独立 `HealEffectHandler`；Periodic Runtime 继续只负责调度和发出事件，Handler 负责满血/死亡排除与 Max HP 上限。
- [x] SUR_004 专项 20 项、Periodic 13 项、Aura 21 项、Trait Foundation 44 项与 SUR_008 专项 24 项通过；Godot Import 受当前工作区既有 Minimap 解析错误影响，未宣称全仓通过。
- [x] SUR_008「鼓舞士气」已接入通用 Periodic Effect → Buff Effect Handler → Crit Modifier：20s 间隔、6m ALL_TEAM、6s 持续、Lv1～Lv5 为 5/7/9/11/13%，支持 Apply/Refresh/Expire 与周期状态 Save/Load；专项测试与相关回归通过。

## 2026-09-21：Expedition Runtime Performance P02

- [x] 完成原生 1600x900 A/B/C/D 基线、E-I 模块隔离与命令级路径计数；确认 PRIMARY 为连续移动命令中的同步重复寻路与 formation 候选爆炸，SECONDARY 为 Command Ribbon、Minimap Dynamic 与 World Marker 的无上限刷新。
- [x] 三人命令固定为每人一次路径查询并复用 prepared route；导航栅格 0.5m 调整为通过全量入口验证的 0.75m，路径简化、命令线与 20Hz 动态 UI 定向优化。D 场景 max 791.735ms -> 45.883ms，100ms+ 帧 13 -> 0，路径计算 4753.671ms -> 402.748ms。
- [x] A2/B2/C2/D2、额外 4102/4103 Seed、入口 2,230、E01 240、Minimap 1,441、E02 Search 1,222、命令 36、Loading Gate 121 项通过；性能图、三段 MP4 与原始数据见 [P02 报告](EXPEDITION_RUNTIME_PERFORMANCE_P02_REPORT.md)。
- [x] 完整 build 在通过 P02 相关门禁后被既有 Camp `member_buttons` / 左侧能力栏旧断言阻断；同一 Windows preset 直接导出成功，`BlueHourHomeward.exe` 的 Headless 与原生 120 帧启动均通过。
- [ ] Expedition Runtime Performance P02: TECHNICALLY COMPLETE；Human Runtime QA: PENDING；E03 Enemy: NOT STARTED。

## 2026-09-20：Expedition Building Entrance Facing System

- [x] BLD_001～022 逐 prefab 明确 `primary_entrance_local_anchor`、`primary_entrance_local_forward` 与 `search_interaction_local_anchor`；wrapper 统一真实主立面坐标并移除生成阶段的建筑编号旋转分支。
- [x] Town placement 由 assigned frontage 数据计算 yaw；corner lot 使用 assigned frontage → road class → frontage length → deterministic seed tie-break。Town 的 0/90/180/270° 整体朝向同步变换门、forward、搜索点与 frontage metadata。
- [x] E02 Search Registry 分离真实门与合法站位，保留 P01 `UNRESOLVED`、点击优先解析和后台解析流程；旧 `entry` 继续兼容搜索站位。
- [x] 22 definitions 四方向与 10 个正式 seed 共 42,192 项几何检查、550 个实例、0 失败；10-seed 正式 Runtime 导航 2,230 项、0 失败；Town Urban Fabric 142,874 项、0 失败。九张 QA 截图与完整结果见[交付报告](BUILDING_ENTRANCE_FACING_REPORT.md)。
- [ ] `run.ps1 -Mode build` 已执行，五组前置专项通过后，被并行 Camp `shelter_view.gd:19` Nil `id` 阻断，未进入 Windows export。Human Runtime QA: PENDING。
- [ ] Building Entrance Facing System: TECHNICALLY COMPLETE；10 Seed Entrance Facing: PASS；E03 Enemy: NOT STARTED。

## Survivor 当前冻结 Production Baseline（2026-09-19）

清理清单与验证结果见[生产收尾报告](SURVIVOR_PRODUCTION_FINALIZATION_REPORT.md)。

Xia / Su 165cm 正式 Runtime、23 骨 `BH_Humanoid_Rig_v1`、canonical T-Pose Bind、Shared Skin Contract、Public Idle / Walking / Running、Expedition Walkable Ground Contract 均已通过验收并冻结。Expedition 基础速度为 **2.8m/s**。不生成 V2/V3 或角色专属 Locomotion。

未来 12 人统一流程：**Static GLB → 165cm Runtime Envelope → canonical T-Pose Alignment → BH_Humanoid_Rig_v1 → Skin QA → Public Locomotion → Gameplay**。角色资料身高不缩放 Runtime Rig；LOD0 目标约 100k tris。统一 Bone Length / Axis / Rest / Foot Ground / Socket，外观差异由 Mesh 和 Skin 承担。未来角色直接共享公共三动作，不制作独立 Idle / Walking / Running，不运行角色专属 Retarget。

正式入口：`assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb`、`assets/characters/su_wanxing/runtime/su_wanxing.glb`。公共库：`assets/animations/public_locomotion/public_locomotion.tres`，引用同目录 `public_idle.tres`、`public_walking.tres`、`public_running.tres`。冻结哈希记录在 `tests/fixtures/survivor_production_baseline.json`。

当前 Skin / T-Pose / Canonical 转换与生产 QA 工具保留。`export_locomotion_retarget.gd` 仍被公共转换的 `canonical_locomotion/prepare.py` 调用，属于保留工具链，不是旧角色 Runtime。两份旧 source GLB 因先前工具策略阻止删除而列为待清理，已排除导出且无正式引用；本轮不绕过策略重试。

旧 Mission Jog、Start/Stop 资源及旧局部摆臂层已退出生产并清理，对应历史章节只保留开发记录，不再描述当前 Runtime。三人长途返回/让行停滞、旧 Camp HUD 断言作为独立已知问题保留，不计本轮失败；不开展 Combat/Armed、Turn/Start/Stop 或其余角色制作。

## 2026-09-20：Remaining 10 Survivors Unified Runtime Batch Integration

- [x] SUR_003～SUR_012 十份约 100k tris 静态 A-Pose GLB 已统一为 1.65m canonical T-Pose，绑定冻结的 23 骨 `BH_Humanoid_Rig_v1`；所有模型 1 Skin、0 无权重顶点、最多 4 骨影响，无角色专属骨架、Retarget、IK 或高度补偿。
- [x] 十名角色直接共享唯一 `public_locomotion.tres` 及 `public_idle` / `public_walking` / `public_running`；结构与循环专项 337 项、公共动作生产回归 495 项，均 0 失败。
- [x] SurvivorDefinition 与 Trait 数据扩展至 SUR_001～SUR_012；后续 Phase A 已接入 SUR_003/005/007/009/010/012，SUR_004/006/008/011 仍为 `data_only`。推荐武器仍是数据标签，不提供隐藏加成或限制。
- [x] 每名新增角色完成 Camp 与 Expedition 候选验收：2.8m/s、Idle/Walk/Run、转向、搜索/取消、Selection Ring、`RightHand` 武器挂点与自动攻击；共 290 项检查、0 失败。静态与动态接地、Skin 和视觉总览均通过。
- [x] 正式模型与 Definition 采用稳定角色路径；无角色专属 Locomotion、临时候选或 `test-output` 生产引用。完整资源表、测量与已知边界见[批次接入报告](REMAINING_10_SURVIVOR_RUNTIME_INTEGRATION_REPORT.md)。
- [ ] Windows build 已执行；本批专项通过，但完整门禁被既有 `camp_ui_runtime.gd:114` 的 `member_buttons` 访问和旧左侧能力栏断言阻断，未进入导出。该失败不属于本批 Survivor 集成。
- [ ] SUR_004/006/008/011 Trait Runtime、LOD、Combat Jog / Armed Locomotion 尚未开始。


## 2026-09-20：Expedition Load Performance P01

- [x] 全 Town Search Navigation Resolve 已退出开场硬 Ready Gate；Registry 先建立 `UNRESOLVED` 条目，Expedition 展开后分帧进入 `RESOLVED_REACHABLE` / `RESOLVED_UNREACHABLE`，玩家点击未解析目标时优先解析该目标。
- [x] 删除 `final_ready_wait` 黑盒，补齐 Overlay、Town、Environment、Navigation、Search Registry、Minimap、Survivor、HUD、逐项等待、Iris Open 与测试侧点击至移动命令接受墙钟。
- [x] 原生五 Seed 测试侧真实时间为 2.688 / 2.343 / 2.544 / 2.381 / 2.462 秒，平均 2.484 秒，最慢 2.688 秒；五局首次展开均显示当前 Seed 的 Minimap World Layer 并立即接受移动命令。
- [x] Environment 数据、Roadside 数据、环境实例和 Roadside 实例拆段并让出渲染帧；生成结果语义未改。当前最大单阶段仍是 Environment Data，五局为 0.614～0.799 秒。
- [x] Ready Gate 121、E00 58、E01 240、E01.5 Minimap 1,441、E02 Search 1,222、原生五 Seed 100、完整录像 19、未解析目标原生点击 4 项全部通过；截图、阶段明细和两段视频见 [P01 报告](EXPEDITION_LOAD_PERFORMANCE_P01_REPORT.md)。
- [ ] Windows build 已执行，前置专项通过后仍被既有 Camp `member_buttons` / 左侧能力栏回归阻断；未生成 P01 新 EXE。Human Runtime QA: PENDING。
- [ ] Expedition Load Performance P01: TECHNICALLY COMPLETE。E03 Enemy: NOT STARTED；不自动推进后续阶段。

## 2026-09-19：Expedition Runtime Loading Transition / Random Town Minimap Ready Gate

- [x] 正式确认出发立即显示可复用 Iris Overlay；遮罩和“加载中…”真实绘制后分阶段初始化，八项 Ready Gate 全部满足才展开。关闭 0.25 秒、展开 0.55 秒。
- [x] 修复局部裁剪下小地图 World Layer 缺失，按当前 Seed / Town Signature 构建本局道路和建筑缓存；保留 Local Follow、Squad Center、Equal Survivors。
- [x] 连续五次正式随机出发 90 项、Gate 121 项、录像 18 项通过；E00 58 / E01 240 / Minimap Bridge 1,441 / Local Follow 1,892 / E02 Search 1,206 项回归通过。截图、视频与实际耗时见 [交付报告](EXPEDITION_RUNTIME_LOADING_REPORT.md)。
- [x] 未改 Town 生成与摆放规则；保留工作区并行贴地 metadata 改动。修复回归暴露的队员互相让行死锁。环境生成仍可短暂停顿，最长单阶段约 1.02 秒，已披露。
- [ ] Loading Transition / Random Town Minimap: TECHNICALLY COMPLETE；Human Runtime QA: PENDING。实际 Windows build 被既有 Camp `member_buttons` / 左侧能力栏回归阻断，未生成本轮新 EXE。
- [ ] E03 Enemy: NOT STARTED；不推进战斗、HUD 重设计、Blue Hour 或撤离系统。

## 2026-09-19：Expedition Integration E02 — Search / Loot Runtime

- [x] 基于已验收 E00–E01.5，增加 Expedition Searchable Registry；沿用原 SearchTask、Loot Profile、拾取入账和卡片，Town 建筑点击由玩家所选 Survivor 接取。
- [x] 4101–4104 每 seed 55 个可达建筑；源实例保持只读。环境车辆缺少实例级 lootable 授权，合法可搜索车辆为 0，未强制变成容器。
- [x] 四种子搜索/取消/重派/防重复领取与归队 1,206 项、原生 14 项及 E00 58 / E01 240 / E01.5 Local 1,892 / Bridge 1,441 回归通过；七张截图与完整搜索、取消改派两段视频已输出。
- [x] 本轮 511、E01 633、M03 622 个冻结文件检查通过，E01 移动函数原文未变；未改 Minimap 产品代码。详见 [E02 交付报告](EXPEDITION_SEARCH_RUNTIME_REPORT.md)。
- [ ] Human Runtime QA: PENDING；E02 TECHNICALLY COMPLETE。完整 Windows build 已执行，仍被既有 Camp member_buttons / 能力栏回归阻断，未产出本轮独立 EXE。
- [ ] E03 Enemy / E04 Full HUD-Minimap / E05 Blue Hour-Extraction: NOT STARTED。等待人工验收，不继续后续阶段。

## 2026-09-19：Camp HUD M07 Loadout Panel

- [x] 最后一轮布局收尾：34×34 望远镜、11px 图文间隔、3px 标题/数量间隔；底部中央 116×26 Footer、22×22 点击区、StateButton 交叉淡入。119 项专项通过，四张验收截图已更新；PNG、分页/装备数据逻辑及其他 HUD 未改。

- [x] 用户六张 PNG 原样接入；保留 `(624,776)`、`316×82` 外层区域，两槽统一 64×62，标题和数量动态渲染。
- [x] 默认 0/1、EMPTY / LOCKED；按数组和解锁容量分页，每页两格，无双槽系统上限；复用控件、全局槽位点击信号与 StateButton 0.12 秒覆盖高亮，不接装备管理弹窗。
- [x] 原生专项 114 项通过，五张 1600×900 截图、7 槽与容量缩减边界、连续点击、快速 Hover 和四档分辨率验证完成；46 个受保护文件与六张源 PNG 未变。
- [x] Windows 单独导出、独立 Headless / 原生 Camp 启动通过，无脚本/资源/UID 错误。完整 build 被旧 Camp `member_buttons` / 能力栏回归阻断，详见 [M07 接入报告](CAMP_LOADOUT_REPORT.md)。
- [ ] 等待本轮视觉验收；停止于 M07，不进入 M08。

## 2026-09-19：E01.5 Fix — Local Follow Minimap + Equal Survivors

- [x] 左下角固定约 70×70m、跟随所有存活出征成员平均位置；镜头和选择不改变中心，静态 Runtime 地图缓存通过变换滚动。
- [x] 三名 Survivor 使用相同 18px 图标，仅选择圆环有差异；远处 POI / Arrival / 分散成员使用带方向的边缘标记。全镇 fit 保留为数据投影函数，不新增全图 UI。
- [x] 四种子 Local Follow 1,810 项、Runtime Bridge 1,319 项、原生 386 项检查通过；真实选择两次、移动至 POI 再离开，66.567 秒视频与九张截图见 [修正报告](EXPEDITION_MINIMAP_LOCAL_FOLLOW.md)。
- [x] Town/M03 冻结集、Adapter 与 E01 Navigation 未变；上轮截图/视频保留。本轮未修改并行工作的 Camp 装备面板。
- [ ] Human Runtime QA: PENDING。E01.5 Fix TECHNICALLY COMPLETE；Windows build 已执行，仍被既有 Camp UI `member_buttons` / 左侧能力区断言阻断，未更新 EXE。
- [ ] E02 Search: NOT STARTED；Full/Tactical Map、Enemy、Fog 重构及其他 HUD 美术重构未开始。

## 2026-09-19：Expedition Integration E01.5 — Medium Town Minimap Runtime Bridge

- [x] 左下角 Minimap 接入 Adapter 只读道路、建筑与地面区域；统一等比世界坐标映射，缓存静态层，每帧更新三人、Arrival 与 POI 标记；Legacy 渲染保留。
- [x] 4101–4104 四种子：1,311 项 Headless、1,186 项原生检查通过；八张专项截图、Legacy 图与 51.467 秒真实 Survivor Arrival → POI 运动视频已生成。
- [x] E00 58 项、E01 240 项回归通过；633 个 E01 / 622 个 M03 冻结文件和本轮 105 个附加保护文件哈希不变。详见 [E01.5 报告](EXPEDITION_MINIMAP_RUNTIME_BRIDGE.md)。
- [ ] Human Runtime QA: PENDING；E01.5 TECHNICALLY COMPLETE，不替代人工运行时验收。
- [ ] Windows build 已执行，Import 与 Expedition HUD 258 项等前置检查通过，仍被既有 Camp UI `member_buttons` / 左侧能力区断言阻断；本轮未更新独立 EXE。
- [ ] E02 Search / E03 Enemy / E04 Full HUD-Minimap / E05 Blue Hour-Extraction: NOT STARTED。正式 Minimap Fog: DEFERRED_TO_E04。

## 2026-09-19：Expedition Integration E01 — Navigation & Survivor Movement

- [x] 用户已确认 E00 Human Runtime QA: PASS；正式 Medium Town Provider / Runtime Bridge 保留。
- [x] 沿用 AStarGrid2D，基于运行时碰撞体建立 Town 导航；接入 ready 生命周期、不可达拒绝、三人队形与沿路径跟随间距。
- [x] 正式 roster 的夏知遥、苏晚星、林通过实际点击移动完成 Seed 4101 Arrival → Mission POI；240 项专项与 10 项原生检查通过，八张截图及 51.467 秒原生视频已生成。E01 TECHNICALLY COMPLETE。
- [x] E00 回归 58 项通过；633 个保护文件及 622 个 M03 历史基线哈希不变。四种子路线与封闭围栏检查见 [E01 报告](EXPEDITION_NAVIGATION_REPORT.md)。
- [ ] Human Runtime QA: PENDING。完整 Windows build 仍在既有 Camp UI 验证失败，未产生本轮独立 EXE。
- [ ] E02 Search / E03 Enemy / E04 HUD-Minimap / E05 Blue Hour-Extraction: NOT STARTED；等待人工验收及后续授权。

## 2026-09-19：Expedition Search Gameplay V2

- [x] 复用 SearchTask、集中 4/8/12/18 秒耗时与掉落概率、统一只读生命周期、即时卡片清理、完成/拾取紧凑 Toast。
- [x] 最新专项 Headless 67 项、原生 72 项通过；住宅和车辆正式时长完整流程、并行隔离、Command V1 回归通过。
- [x] Release 单独导出成功；独立 EXE Headless/原生 Expedition 启动，以及内嵌包住宅/车辆完整搜索、奖励与卡片验证通过。
- [ ] 完整 build 仍被既有 Camp UI 测试阻断；退出时旧 ObjectDB 泄漏警告仍保留。数值、缺口、全部文件与失败回归见 [Search Gameplay V2 报告](EXPEDITION_SEARCH_GAMEPLAY.md)。

## 2026-09-18：Expedition Survivor Command V1

- [x] 普通地面移动先过滤合法接收者，仅覆盖未开始搜索的赶路任务；已开始搜索、进门、自卫暂停保持原任务。无接收者时不改变集合点、不播放移动反馈。
- [x] 复用明确取消入口与任务释放流程，取消/完成清理占用和进度 UI；保留集合、撤离、自卫与死亡规则。头像查看仍沿用当前语义，不新建多选命令系统。
- [x] 原生 ImmediateMesh 青蓝细指令线接入既有 VFX 层，0.8 秒渐隐；连续指令每名角色最多一条线，保留选中环与落点反馈。未改模型、骨骼、动画或 PNG。
- [x] 新专项 headless 43 / native 45 项通过；搜索卡 157、HUD 258、搜索派遣 56、室内搜索 13、三人并行 36、设置 14 项通过。旧并行测试仅固定搜索时长前提，正式数值不变。
- [x] Windows 单独导出、独立 EXE Expedition 启动及内嵌包指令/搜索/取消验证通过，无本轮 Runtime Error / Invalid Node / Missing Resource；截图、视频与日志在 `test-output/survivor-command/`。
- [ ] 完整 build 仍因旧 Camp 测试的 `member_buttons`/能力栏断言失败；未改 Camp 或宣称完整构建通过。规则、修改范围与证据见 [验收报告](EXPEDITION_SURVIVOR_COMMAND.md)。

## 2026-09-17：Expedition 正式搜索状态卡

- [x] 按钮间距微调：SearchRow 使用 HBoxContainer 固定 12px 分隔，左侧进度条缩为 86px；卡片 262×96、按钮 96×32 及两态素材不变。157 项专项断言通过，截图在 `test-output/search-cancel-spacing/`。
- [ ] 本次完整 build 在 HUD 阶段因 GLES3 `texture_set_size_override` 空纹理错误中止，尚未进入旧 Camp 测试；搜索卡专项与独立 EXE 启动也报告相同错误。单独 release 导出成功，独立 Expedition 启动退出码 0，另有已有的 2 个 ObjectDB 实例泄漏警告。未将启动成功表述为无错误验收，记录见 `test-output/search-spacing-*.log`。
- [x] 取消按钮恢复正式 96×32，原尺寸居中绘制并保留纹理最小尺寸；仅调整按钮及左侧状态区/90px 进度条留位，卡片整体、定位、PNG 与玩法不变。原生专项 145 项通过，两态截图见 `test-output/search-cancel-layout/`。
- [x] 按钮微调后 Windows release 单独导出成功；独立 EXE 菜单/Expedition 原生启动、内嵌包 96×32 按钮/定位/进度/取消验证通过。完整 build 中 HUD 258、搜索卡 145、设置 14 项通过后，仍因下述旧 Camp 测试失败；日志为 `test-output/search-cancel-build.log`。退出时已有的 2 个 ObjectDB 实例泄漏警告仍保留，未扩展修复范围。
- [x] 接入用户提供的四张 PNG，固定 262×96 卡片，normal / hover 不改变控件尺寸；预览不进入运行时。
- [x] 地点图标、名称、状态、百分比及 Godot 动态进度条绑定真实搜索任务；取消、移动离开、完成、自卫与阵亡隐藏，不恢复旧大型建筑说明框。
- [x] 定位修复：移除整栋建筑四向选址及包围框缓存，保留 SearchUIAnchor 与原投影；默认位于搜索点上方，边缘调整限制为横向 24 / 纵向 12 个 UI 单位，空间不足时隐藏，恢复空间后重新显示。
- [x] 原生专项 137 项通过，覆盖锚点方向/距离、连续镜头平移、缩放、0°/90°/180° 建筑朝向、边缘限位、Hover/取消及三档分辨率。当前截图与坐标记录在 `test-output/search-card-position/`；卡片样式、PNG、City 和 SearchTask 未改。
- [x] 定位修复后重新导出 Windows EXE；独立菜单、Expedition headless/native 及内嵌包锚点/进度/取消专项通过，7 个受保护脚本与 PNG 哈希不变。完整构建重跑仍停在下述 Camp 历史接口问题，日志为 `test-output/search-position-build.log`。
- [x] Expedition HUD 回归 258 项通过；修正原测试对现有头像选择按钮的误计数，以搜索前后按钮数量不变保护只读队员状态。
- [x] 单独 Windows release 导出成功；独立目录 EXE 菜单 native、Expedition headless / native 启动通过；挂载内嵌包验证卡片素材、实时进度、原生渲染与取消通过。交付 `build/BlueHourHomeward.exe`，构建记录已更新。
- [x] 新卡片专项纳入 `run.ps1 -Mode capture/build`，四张原始 PNG SHA-256 与用户压缩包一致，定向编码与 diff 检查通过。
- [ ] 完整 `run.ps1 -Mode build` 未通过：旧 `camp_ui_runtime.gd` 访问当前 `camp_hud_root.gd` 已无的 `member_buttons`，且断言旧能力栏存在。保留原测试失败记录，未以定向导出冒充全套通过。
- [ ] 额外回归：`interior_search.gd` 13/13 通过；`search_dispatch.gd` 50/56、`parallel_commands.gd` 2/3，后者在早期失败后结束，未执行余下断言。旧测试含移动应保留搜索等与本轮开始时已有实现相反的要求；本轮未改搜索玩法或这些历史测试。证据在 `test-output/search-active-*.log`。

## 2026-09-18：夏知遥标准 Locomotion Retarget

- [x] 用户确认 Standard Survivor Rest / Idle / Walking / Running PASS。仅从三份标准 `.tres` 离线 Retarget 到夏知遥原 23 骨，新增角色专属 Idle / Walking / Running，保持 Mesh / Skin / Rest / 比例与周期。
- [x] 可重复映射和蒙皮接地补偿已独立保存；实际腿链比例 0.89655，Running 支撑约 2.30655m/s，在 2.57m/s 下预测残差约 31mm；未修改 Gameplay。接地、姿态及建议见 [验收报告](XIA_ZHIYAO_STANDARD_LOCOMOTION_RETARGET.md)。
- [x] 18,928 项专项、两名正式幸存者 302 项通过；12 段四视角原速视频、独立 Windows 构建与三套启动完成。收尾保护快照 339 个哈希未变，5 个本轮外部改动保留并单独报告。
- [ ] 等待夏知遥 V1 视觉验收；Idle 建议直接使用，Walking / Running 建议小修确认。不接入苏晚星、Gameplay 或持武器动作。

## 2026-09-18：Standard Survivor Running 重构

- [x] 保留源 0.666667 秒 / 180 步频、交替与轻度前倾；重构支撑/低腾空、收腿、落地压缩与摆臂，烘焙唯一 `animations/running.tres`，无 Runtime IK / Root Motion。
- [x] 支撑前掌实测反推推荐 2.57m/s；Hips 起伏 61.74→47.58mm，回收鞋底高点约 0.218 / 0.217m，上臂后摆约 35.1°；完整 Loop 闭合。后跟仍有约 15～17mm 局部形变残差，详见 [重构报告](STANDARD_SURVIVOR_RUNNING_RECONSTRUCTION.md)。
- [x] 402 项专项、正式双角色 303 项、329 文件保护检查通过；四视角 13.333 秒循环视频和独立 Windows 构建/原生启动完成，Idle / Walking 与正式系统不变。
- [x] 用户确认 Running Reconstruction V1 PASS；后续仅授权上节夏知遥 Retarget，不继续 Combat Jog / Armed Run。

## 2026-09-18：Standard Survivor Running 原样验收

- [x] 源 Running 独立原样播放：0.666667 秒、24 FPS、180 步/分钟；四视角各 13.333 秒、60 FPS、20 次循环。无键修改、Retarget、正式角色或 Gameplay 接入。
- [x] 全周期 Blender / Godot 与实际蒙皮检查；源键关节误差最大 0.00772mm、键间 2.889mm。223 项量测工具检查和正式双角色 303 项通过，329 个受保护文件未变；独立 Windows 构建/启动通过。
- [x] 已报告持续接地间隙、候选支撑预测滑步、跑步/腾空形态、摆臂与 Loop 差异。建议较大重构并保留原步态基础，详见 [Running 原样验收报告](STANDARD_SURVIVOR_RUNNING_REVIEW.md)。
- [x] 用户确认原样结论并授权较大重构；制作结果见上节，原样数据保留用于对比。

## 2026-09-17：Standard Survivor Walking 接地与循环修正

- [x] Blender 按 Heel Strike / Foot Flat / Mid Stance / Toe Off / Swing 修正并烘焙，唯一 `animations/walking.tres`；1.0416667 秒、24 FPS 时间轴和原地形式保留，120Hz 子帧键，不使用 Runtime IK。
- [x] 支撑参考 1.425m/s；平脚前掌残余滑动同窗同速左 6.90→4.50mm、右 38.50→4.79mm。平脚端部高度约 1～5mm，后跟形变及局部最大 1.85mm 穿入如实保留在报告。
- [x] Hips / Foot / Knee / ToeBase 首尾位置与旋转闭合；615 项专项、正式双角色 303 项通过，324 个受保护文件不变。四视角各 12.5 秒视频及独立 Windows 构建/启动完成。
- [x] 2026-09-18 用户确认 Walking V1 PASS；保持已通过资源不变，后续仅授权上节 Running 原样验收，未接入正式角色或 gameplay。详见 [Walking 修正报告](STANDARD_SURVIVOR_WALKING_FOOT_CONTACT.md)。

## 2026-09-17：Standard Survivor Walking 原样验收

- [x] 独立场景原样播放源 Walking：1.041667 秒 / 24 FPS，名义 115.2 步/分钟；四视角各 12.5 秒 / 60 FPS，12 次原速循环。
- [x] 全周期 126 点量测、源帧 Godot/Blender 核对、视频与动画键签名检查通过；313 个受保护文件不变，含模板及已通过 Idle V1。
- [ ] 动作接地与循环未通过：鞋底最低仍离地约 24～27mm；按约 1.45m/s 恒速估算后候选支撑残余滑动约 18～41mm，循环 Mesh 最大首尾差 131.44mm。
- [x] 原样问题已形成修正依据；用户后续授权的 Walking V1 制作见上节，原样证据保留。详见 [Walking 原样验收报告](STANDARD_SURVIVOR_WALKING_REVIEW.md)。

## 2026-09-17：Standard Survivor Idle_4 接地专项修正

- [x] Blender 双腿 IK / Foot Lock 烘焙完成，唯一动作 `animations/idle.tres`；14 秒节奏、Hips 水平轨迹和上半身局部轨道保留，不依赖 Runtime IK。
- [x] Heel 距地 1.09～2.95mm、Forefoot 0.995～1.369mm，Foot 水平单轴范围低于 0.009mm；Godot 实际蒙皮 5,107 项与正式双角色 303 项检查通过。
- [x] 四视角各 28 秒视频、独立 Windows 验收程序完成；308 个受保护文件不变，Rest / Skeleton / Toe_End 轴未改。
- [x] 用户已确认 165cm 模板与 Idle V1 通过；后跟原权重约 5mm 局部形变作为已知结果保留。Idle 仍未接入正式角色，本轮后续仅做上节 Walking 原样验收。详见 [接地验收报告](STANDARD_SURVIVOR_IDLE_FOOT_CONTACT.md)。

## 2026-09-17：Standard Survivor Idle_4 原样验收

- [x] 独立工程原样播放源 Idle_4，14 秒 / 24 FPS；输出正面、侧面、3/4、双脚近景视频，各 28 秒 / 30 FPS。
- [x] 完整周期 841 点源/Godot 轨迹核对通过，最大关节位置差 0.0044mm；动画键未改，308 个受保护文件哈希不变。
- [ ] 接地不通过：双侧 Heel / Forefoot 持续悬空、轻度前掌上翘并伴随滑动。建议小修后复验，本轮未修正或接入正式角色。
- [ ] Toe_End 轴差异仍保留；此片段脚趾局部旋转恒定，未发现其引起动态翻转。停止并等待用户指令，详见 [原样验收报告](STANDARD_SURVIVOR_IDLE_REVIEW.md)。

## 2026-09-17：Standard Survivor Template 165cm 静态基线

- [x] 用户提供新版女性模板，接入唯一正式目录；源高度实测 1.6499997m，28 骨，不使用比例或地面补偿。
- [x] Skeleton / Skin / Mesh、Rest Pose、静态鞋底接地、Godot Import / Scene Load / UID 检查通过；正式双角色回归及 301 个受保护文件哈希检查通过。
- [x] 源 FBX 动作不进入最终场景；未制作 Idle / Walk / Run、Retarget 或武器动作。
- [ ] 已知源资产差异：左右 Toe_End 轴最大镜像角差约 28.8°，且有蒙皮权重；本轮只记录，不修正，不作动作可用性验收。
- [ ] 等待下一步指令。路径、量测和修改清单见 [静态基线报告](STANDARD_SURVIVOR_TEMPLATE_BASELINE.md)。

## 2026-09-17：标准幸存者模板清理

- [x] 移除旧 170cm 标准模板、专属骨架/动作实验、脚底偏移、预览脚本与临时输出。
- [x] 保留夏知遥、苏晚星、正式 Survivor Runtime、公共动画架构、武器和 Expedition 玩法；清单与验证见 [模板清理记录](STANDARD_SURVIVOR_TEMPLATE_CLEANUP_REPORT.md)。
- [x] 用户已提供女性 165cm、新脚踝位置模板；静态接入结果见本页“165cm 静态基线”，动作制作继续暂停。

## 2026-09-18：Camp HUD M04 幸存者头像列表

后续用户授权的交互与详情规则见下面 M05-A 条目；本节保留基础视觉冻结验收历史。

- [x] 最终收尾：普通框 RGB 调制为 0.78，透明度不变，Selected 保持原色；477 项检查通过，69 个受保护文件不变。M04 Freeze。

- [x] 用户三张 PNG 原样接入，118×436 面板，四个 94×94 Slot 与 78×78 头像，位置和步进按本轮规格。
- [x] 默认首项选中，原生点击切换唯一高亮；复用两张正式头像填充四个展示槽，动态标题和 4/4、原生占位圆点。不接 M05 或实际队伍。
- [x] 四分辨率原生检查 413 项通过；59 个受保护文件及其他八个 HUD 截图区未变，Windows 独立导出及原生启动通过，日志无脚本或资源错误。
- [x] 用户确认整体效果，普通框亮度收尾完成；M04 冻结，不再调整，不进入 M05。详见 [M04 接入报告](CAMP_SURVIVOR_ROSTER_REPORT.md)。

## 2026-09-18：Camp HUD M04 Hover + M05-A 详情骨架

- [x] M04 增加普通框 Hover 增亮、头像轻微增亮、中心缩放和 Pressed 反馈；Selected 仍使用原效果，PNG 和几何不变。
- [x] 进入 Camp 选择 ID 为 null、M05 隐藏；点击后显示并复用同一个详情实例，切换四个独立展示角色的数据。
- [x] M05 保留 354×452 原外框，完成 Header / Combat / Attributes / Trait / ActionBar 正式层级；三项操作禁用，不接 Gameplay 或正式美术。
- [x] 407 项详情交互检查与 473 项头像回归通过；66 个受保护文件哈希一致，其他七个 HUD 截图区逐像素一致。
- [x] Windows release 导出和独立程序启动通过；使用隔离存档，未运行历史全量 build 测试链。证据见 [M05-A 报告](CAMP_SURVIVOR_DETAIL_REPORT.md)。
- [ ] 本轮人工视觉验收；停止于 M05-A，不自动接入 M05 正式美术。

## 2026-09-19：Camp HUD M06 Camp Action Rail

- [x] 使用用户提供的七张 M06 PNG 替换旧占位栏；保留 M06 `(28,278)`、`112×330` 根几何。
- [x] 建立 TemporaryBuff、MedicalSupport、LockedAction 三个独立槽，动态渲染 Q/E 与中文标签。
- [x] 修复 Hover 抖动：固定 Button HitArea，取消 Hover 缩放，仅 Glow 与底图/图标提亮；Pressed 只缩放 VisualRoot 至 0.98，视觉节点忽略鼠标，每次状态变化替换 Tween。Q/E 和鼠标仍只发本地展示信号。
- [x] 最新 365 项专项检查通过，包含两按钮快速进出边缘、实际鼠标 Pressed、四种分辨率和三张 1600×900 状态截图；Windows 导出与独立启动通过。证据见 [M06 报告](CAMP_ACTION_RAIL_REPORT.md)。
- [ ] 本轮人工视觉验收；停止于 M06，不自动进入 M07。

## 2026-09-19：通用 UI 状态过渡组件

- [x] 新增 `ui/components/state_button.gd`，提供固定 HitArea、Normal/Hover/Selected/Disabled Cross Fade、Tween 替换和 VisualRoot Pressed 反馈；不绑定具体页面素材。
- [x] 迁移 Camp M06 的 TemporaryBuff / MedicalSupport，以及 Main Menu 的开始游戏、继续、角色图鉴、营地档案、设置、退出六个 Normal/Hover PNG 入口；布局、尺寸、素材和业务回调保持不变。
- [x] M06 专项 365 项零失败；Main Menu 六入口状态探针通过。完整旧 `menu_runtime.gd` 的异步转场时序断言与工作区既有 Expedition 重复成员解析错误单独记录，未扩大修复范围。
- [x] 交付细节见 [通用 UI 状态过渡报告](COMMON_UI_STATE_TRANSITION_REPORT.md)。本轮不自动迁移其他页面。

## 2026-09-17：Camp HUD M03 顶部资源栏

- [x] 最终微调：资源图标 34×34，数值 23 px 并略加粗；资源图文间距增加 3 px，菜单文字右移 3 px。537 项检查通过，60 个受保护文件及其他八个 HUD 截图区不变；M03 Freeze。

- [x] 六张用户 PNG 原样接入；外框仍为 (1120,20)、464×60，三张资源卡 103×56、菜单 116×56，间距 13/13/10 px。
- [x] 八项文字使用独立 Label 和固定展示数据；菜单本轮只展示，不接真实资源或新增交互。
- [x] 四种分辨率 537 项原生检查通过；48 个受保护文件不变，M01、M02、M04～M09 截图区与上一版逐像素一致。
- [x] 常规 EXE 因运行中无法替换；独立路径 Windows 导出与原生启动通过，退出码 0，无脚本或资源错误，未终止用户现有程序。
- [x] 用户确认结构与素材，指定微调已完成；M03 冻结，本轮停止，不进入 M04。详见 [M03 接入报告](CAMP_RESOURCE_BAR_REPORT.md)。

## 2026-09-17：Camp HUD M02 时间状态栏

- [x] 最终收尾：太阳 30×30 并左移，左侧文字左移 4 px；当前节点外径 16 / 中心 8 px，阶段标签 12 px；波次 19 px、右组下移 2 px。519 项检查通过，48 个受保护文件及其他 HUD 截图区保持不变；M02 Freeze。

- [x] 用户原始背景与太阳 PNG 接入，沿用 M00 的 (480,16)、568×76 外框及背景自带的两根分隔线。
- [x] 左侧时段与时间、中间原生四节点时间轴、右侧波次及倒计时，均为独立节点；文字使用固定测试数据，不接真实玩法时钟。
- [x] 519 项原生检查、Windows 导出及独立启动通过；四种分辨率无文字截断或重叠，M01 截图像素与冻结版一致，44 个受保护文件哈希未变。
- [x] 用户确认整体结构与背景，指定的收尾已完成；M02 冻结，本轮停止，不进入 M03。

资源、节点与验证见 [M02 接入报告](CAMP_TIME_STATUS_REPORT.md)。

## 2026-09-16：Camp HUD M01 营地身份区

- [x] 2026-09-17 收尾冻结：用户已确认素材及整体尺寸；卡片上移 4 px，日期移除额外空格加宽，中文标题规整加粗，英文 tracking 微增。412 项原生检查通过，素材、尺寸、M02～M09 和 Camp 文件保持不变。M01 按用户要求冻结，不再主动调整。

- [x] 2026-09-17 几何修正：当前 PNG 不变，卡片改为 NinePatchRect，纸面 238×152、屏幕 (24,108)；Logo 可见宽约 230 px，上移至屏幕顶边且不裁切。412 项检查、Windows 导出和独立启动通过，待截图验收，止于 M01。

- [x] 2026-09-17 V3 卡片：用户用新卡片替代此前间距取舍；原图接入、纸面可见宽约 247 px、保留 Logo 并重新排布六项文字。405 项原生检查、Windows 导出与独立启动通过，待视觉验收。

- [x] 2026-09-17 使用 V2 tight 原件替换两张 PNG，可见宽调整至约 226/246 px，保持字体与其余模块；405 项原生检查、Windows 导出和独立启动通过。

- [x] Typography 修订：楷体标题与留言、手写 DAY、英文 tracking、明确日期空格，局部放大信息卡；405 项检查通过，其他模块和 PNG 哈希保持不变。

- [x] 使用用户 M01 素材包中的两张原始 PNG 替换身份区占位内容；原字节保留，Lossless 导入与透明边缘修复开启。
- [x] M01 外框继续为 (24,16)、228×244；Logo 212×78、信息卡 206×150，六个 Label 独立渲染指定文案。
- [x] 369 项原生检查通过，覆盖四种窗口尺寸、文字边界、透明通道、截图与其余占位模块。
- [x] Windows 导出与独立目录 Camp 原生启动通过；40 个受保护文件哈希未变，包含 M02～M09、HUD 根与 Camp 场景代码。
- [x] 用户确认整体效果并指定三项收尾；收尾已完成，M01 冻结，本阶段停止，不进入 M02。

资源、节点与截图见 [M01 接入报告](CAMP_IDENTITY_REPORT.md)。

## 2026-09-16：Camp HUD M00 基础骨架

- [x] 按本轮最终效果参考图建立 1600×900 `CampHUDRoot`，九个模块独立场景、锚点和占位子区域。
- [x] 只使用灰色半透明框与标签；无正式 PNG、资源数据、角色切换或装备实现。
- [x] 保持 Camp 3D、相机、灯光、导航和 AI；DEPART / ESC 连接既有流程。
- [x] 原生运行 294 项检查通过，五种尺寸无模块重叠或越界；1600×900 截图完成。
- [x] Windows 导出及独立目录 Camp / TodayAction 两次原生启动通过，无脚本或资源错误。
- [x] 用户已验收 M00 布局，2026-09-16 明确授权进入 M01。

尺寸、节点和验证边界见 [Camp HUD M00 报告](CAMP_HUD_SKELETON_REPORT.md)。旧 Camp HUD 检查脚本仍描述已删除的 UI，不作为 M00 验收依据。

## 2026-09-13：继续归航加载过渡（已实现，待视觉验收）

- [x] 主菜单「继续」进入独立加载状态，防止营地切换时出现无反馈的瞬间跳转。
- [x] 新增蓝时归航专属加载视觉：深蓝夜色、罗盘航线、动态状态文案与进度百分比。
- [x] 有效存档才触发加载层；空存档仍保留原提示；加载完成后回到原 `_refresh_screen()` 流程。
- [x] Godot 4.7 导入、独立脚本闭环和临时 Windows 导出启动验证通过。
- [ ] 用户实际运行时确认加载时长、文案与罗盘视觉；全量 build 仍受既有 CAMP UI 检查 1 项历史失败影响。

## 2026-09-13：Expedition 常驻感染者与遭遇循环

- [x] A：核对现有 Enemy、Survivor、Weapon、Mission、SearchTask、Clock 与 AStarGrid 导航；记录既有工作区快照。
- [ ] B：集中 Encounter 配置，安全且分群的初始感染者。
- [ ] C：Idle / Wander 与对象池状态重置。
- [ ] D：距离、朝向、遮挡与失去目标记忆。
- [ ] E：NoiseEvent、抵达噪音与 Investigate。
- [ ] F：既有自动武器、枪声连锁与搜索遇险恢复。
- [ ] G：视野外、低频、人口下限补充。
- [ ] H：蓝时前 30 秒预警及渐进感知。
- [ ] I：正式蓝时多方向尸潮、兴趣点与持续压力。
- [ ] J：F3 调试、感知 / 寻路错峰及 20 / 40 / 60 性能测量。
- [ ] K：自动运行完整任务、原生截图、回归与 Windows 独立构建。

范围：复用唯一普通感染者、现有城市与武器表现；不引入模型、特殊敌人或第二套导航。最终证据写入本阶段报告。

## 2026-09-12：CAMP Visual Polish Pass 02

- [x] 低饱和鼠尾草绿 / 灰米压实地 / 蓝灰铺装色板；中心庭院、横向步道和集合平台有明确边界。
- [x] 主站与蓝时号继续压缩纹理明暗，保留 Logo / 门窗 / 源贴图；白天分阶受光和冷灰阴影、角色 Rim 已更新。
- [x] 默认相机轻微收近，角色初始位置与朝向优化；左棚 / 温室补结构，桌椅箱子复用现有资产并按材质合批。
- [x] 蓝时号 / 硬地 / 标线 / 出车曲线 / 四个集合点整体对齐，导航重烘焙；专项路线与结算回营验证通过。
- [x] 原生 A–E 截图已保存；核心模型与角色 / 出发控制器的原件哈希保持不变。
- [x] Windows 导出、12 次独立启动 / 4 次包内检查、包内 A–E 截图验证通过；2026-09-13 完成交替性能采样，484.3 → 474.2 FPS（-2.1%）。按进程隔离验证目录，保留独立 Pass 02 审图 EXE。
- [ ] 用户审核实际游戏截图；完成本轮后停止，不自动进入 HUD / 完整 Environment Dressing / 城市 / 夜间营地。

范围和最终交付证据见 [CAMP_VISUAL_POLISH_PASS_02_REPORT](design/camp.md)。

## 2026-09-12：CAMP Visual Polish Pass 01

- [x] 保留主站 / 蓝时号原件、角色模型 / 骨骼 / 动画、固定布局与营地主流程；营地实例使用共享 Stylized Shader 的独立参数。
- [x] 白天暖日光与冷灰环境光、轻量 Rim、草土过渡、入口 / 活动区铺装、停车标线及接触阴影已接入。
- [x] 原生 A–D / 角色近景截图 30 项、4K / 同实例清晰度 42 项、UI 114 项、出发 89 项、场景结构 108 项与交互 87 项通过；独立交替性能采样已记录。
- [x] Windows 全量 build、12 次独立启动及 4 次内嵌包检查通过；最终 EXE 与哈希见本轮报告。
- [x] 用户已审阅并提出 Pass 02 修订：进一步收敛 Anime 方向，并整理停车 / 出发区；不表示 Pass 01 已达到最终美术质量。最新范围见本页 Pass 02。

本轮证据与边界见 [CAMP_VISUAL_POLISH_PASS_01_REPORT](design/camp.md)。

## 2026-09-12：Expedition 城市密度、建筑搜索与探索

- [x] 保持160×120m和8种建筑；27实例、19可搜建筑、8装饰建筑、3可搜车；住宅每排5栋、商业连续店面、服务装卸与停车。
- [x] 统一 SearchTask 进入/隐藏/搜索/退出，取消保留进度、完成一次掉落、多成员独立任务；车辆仍在外部遇险自卫。
- [x] 静态 SearchUIAnchor、相机之后逐帧投影、Pixel Snap、固定宽度与显式取消；只展示已发现地点。
- [x] GPU 256×192共享Mask、12Hz、20m/5m柔边、三态探索与敌人信息过滤，蓝时不改视野半径。
- [x] 原生住宅/商业/服务区、探索与回营截图及6段录像已复核；47项专项通过，450帧最大锚点误差0.499756px。
- [x] 全量 Windows build 退出0；正式原生闭环134项、12次独立启动和4次包内检查通过，canonical EXE已更新，最终哈希见 VALIDATION。
- [ ] 用户视觉验收；本阶段完成后停止，不开启真实室内、LOS、新模型或第二张地图。


## 2026-09-12：Camp / 今日行动 UI 第二轮

- [x] 保持冻结场景与设施位置，HUD 分为顶部状态资源、左侧能力、右侧队伍、底部道具槽和右下今日行动。
- [x] 角色详情保留队伍可切换，显示真实属性与武器，固定底部食物训练。
- [x] 技能/道具/槽位/时段说明共用浅纸色与触发源锚点；替换复用既有装备与保存规则。
- [x] TodayAction 近原尺寸纸卡、缩略图、底部说明与双按钮；关闭底层重复 HUD，保持同一 Camp 出发。
- [x] 第二轮 UI 68、今日行动 51/原生 68、技能原生 80 项通过；Windows UI 预览包导出、两次独立 EXE 启动与包内 9 项交互通过。
- [x] 同期远征视觉门禁已在城市探索阶段修复并全量构建通过；此前 UI 预览包的7项失败保留为历史验证记录，当前正式包见本页顶部与 VALIDATION。
- [ ] 用户确认视觉；技能升级/扩槽的正式费用与交易入口保持后续范围。

范围与证据见 [Camp Interaction V1](design/camp.md) 的第二轮记录。没有新增或修改美术资产。

## 2026-09-12：Camp Interaction Scene V1（已完成并验证）

- [x] 保留唯一 Camp 与主视口，管理主页面改为边缘 HUD、角色 Drawer 和原有业务 Overlay。
- [x] 设施根节点统一 CampInteractable；主站、工坊、温室与蓝时号可点击。
- [x] 今日行动在原营地上选地点和出战名单；取消保持世界实例，确认锁定 Campaign 后原地出发。
- [x] 复用 DepartureController，角色同时移动并流水上车，保留资源 HUD 与输入锁。
- [x] 修正部分出战结算，留守成员保留身份和装备，并参与每日口粮；旧存档兼容回归通过。
- [x] 原生交互 87、部分出勤规则 31、Camp 108、清晰度 41 通过；1 / 2 / 4 人约 4.58 / 5.89 / 6.93 秒。最终 Windows build、12 次独立启动与 4 次包内检查通过。

实现边界与验收见 [Camp Interaction V1](design/camp.md)。以下较早的营地 UI 和出发时长是历史阶段记录。

## 2026-09-12：4K 主站清晰度与主视口营地（已完成）

- [x] 在唯一正式路径导入新 4K 主站，核对原件与导入贴图；尺寸、接地、材质与原 3 Box 碰撞复验通过。
- [x] 完成同实例 / 相机 / 灯光的 1920×1080 A/B，定位旧 SubViewport 低分辨率与 1.2 倍放大；正式 Camp 改为主视口 + CanvasLayer 管理控件。
- [x] UI 刷新保留 Camp 和角色，换装同步到已有实例；mipmaps 保留，主站复用各向异性导入脚本；未改全局渲染参数或冻结布局。
- [x] 清晰度原生 39、Camp 107、出发 89、开局原生 202、效果原生 80 通过；最终合并 EXE 包内 Camp 13 项及两种独立启动通过。

尺寸、纹理与全部 20 项结果见 [清晰度报告](design/camp.md)。当前不需要重新导出或重做模型；没有增加面数 / 8K / 新 UV。

## 2026-09-12：正式主站与 Camp Departure V1

- [x] 正式 `CAMP_001_main_station` wrapper 接入冻结 Camp，保留布局、入口轴线、车辆泊位和固定相机；3 个简单 Box 与原导航重烘焙。
- [x] 整备 UI 复用唯一 `camp_main.tscn`；任务确认先存档并锁定任务 / 队伍，同一 Camp 实例完成集结、排队上车、4.5 秒驶离和 0.5 秒淡出，再调用原 Mission 加载。
- [x] 1 / 2 / 4 人真实输入与渲染、留营角色、重复点击、连续移动、物理碰撞与导航超时回退通过；截图保存在现有 test-output。
- [x] Windows 全量构建与独立 EXE 的 12 个启动检查通过；范围、证据和后续动画边界见 [交付报告](design/camp.md)。

本轮不实现返航、独立车轮 / 车门 Mesh 或正式上下车动作；Campaign 继续持有角色、装备与状态数据。

## 2026-09-12：双角色 A-Pose 替换（已实现并验证，待视觉确认）

在独立工作树 valley-mas-humanoid-rig / codex/humanoid-rig 完成新夏知遥、新苏晚星的源文件审计、23 骨标准拟合、新自动权重和局部修正，现已按用户要求合入主地图工作区。正式资源采用 canonical source/runtime 布局，显式切换两份角色配置及营地的两条角色引用。主工作区的地图、巴士、营地出发、武器与 HUD 改动均保留；用户批准后清理其中仍存在的 36 个旧角色文件，未自动提交或推送。

Blender 阶段 76 张姿势图通过。主工作区复验 Godot 302 项及 72 张原生图、原网格保留 14 项、已有公共 Idle/Walk/Run 兼容 908 项、真实移动 42 项、稳定性 15 项、实际 Mission 渲染 102 项通过。公共 Inspector 完成 Windows 构建与两种独立启动验证；合入后主工作区隔离快照的全量构建、玩法/地图/武器/HUD 回归与 12 次独立启动通过。游戏位于 build/BlueHourHomeward.exe，现已合并到唯一正式游戏构建。本次没有扩展动画库。

当前完整路径、产物、修改清单及发衣交界的小瑕疵见 [CHARACTER_REPLACEMENT_REPORT](design/characters.md)。自动化和实施已完成，等待用户复看；不自动继续动画阶段。下节保留首阶段历史。

## 2026-09-12：幸存者统一 Rig 基础设施（首阶段历史）

独立工作树 `valley-mas-humanoid-rig` / 分支 `codex/humanoid-rig`；未合并地图任务。已实读夏知遥与苏晚星的 GLB，确认原文件均无 Skeleton、Skin 或 Animation；删除幸存者移动 bob 与攻击整模缩放。建立 Blender 23 骨 `BH_Humanoid_Rig_v1`、可重复脚本、Godot BoneMap，仅为夏知遥生成骨架与蒙皮。

已完成 12 个静态姿势的三视图检查、Godot 原生检查和 Windows 构建。大幅抬臂的宽袖、长发与肩部穿插仍有局限；当前作为 Rig 审阅候选，未替换原游戏模型引用。完整验证、产物与剩余问题见 [HUMANOID_RIG_REPORT](design/characters.md)。等待用户确认 Rig 效果后再确定下一阶段；没有建立公共动作库，也没有完整绑定苏晚星。

用户大致认可并反馈左膝弯曲异常；已修正左右腿测试姿势的反向旋转，骨架和权重未变。补充两张侧视图与腿膝方向回归，Godot 146 项通过，独立检查程序更新为 0.1.0.1 并通过启动验证，等待复看。

用户复看确认整体与膝盖正常，补充袖根/腋下牵拉反馈。已局部平滑袖根权重并重建夏知遥资产，四个抬臂姿势的严重拉伸边数减少；大幅抬臂褶皱仍有局限。Godot 146 项、原网格/贴图保留 7 项及检查程序 0.1.0.2 独立启动通过，38 张 Blender 图已刷新，等待袖根修订复看，仍未进入公共动画阶段。

## 2026-09-12：正式外出地图继续打磨

在同一正式实现继续完成美术统一：相机 22（18–32），环境采用原纹理的分层着色、蓝灰屋顶、统一绿化、庭院/前坪、路缘与排水带，HUD 提高文字对比并统一底板。160×120m、三路口六区域、18 个搜索地点和南缘返航点不变；保持原搜索、战斗、时钟与归航流程。

地图 1921 项与视觉/源材质隔离 89 项通过；正式出勤闭环 134 项、四街区正常步行 22 项、相机操作录像 18 项通过。屋顶同轨迹帧间变化从 2.8122 降至 0.6774，不代表所有材质完全消除闪烁。共享 Windows 构建与 12 项独立启动通过，同一 EXE 内嵌包的 Headless / 原生视觉检查各 89 项通过；唯一输出仍为 `build/BlueHourHomeward.exe`。细叶、屋顶几何和遮挡仍需后续打磨，完整截图、两段录像与边界见 [外出视觉报告](design/expedition.md)。未扩张玩法或新增模型，实施与自动验收完成，等待用户复看风格。

## 2026-09-12：今日行动选择（已交付，数值待试玩）

- [x] 整理用户提供的 10 张 PNG，保留原始字节、素材说明和来源校验清单。
- [x] 营地「整装出发」先进入今日行动，鼠标、键盘和手柄均可选卡、确认与返回；未选择时无法出发。
- [x] 按用户确认，三类地点复用当前城区，分别配置食物、废料、装备点及敌情；没有新建三套地图布局。
- [x] 确认后保存地点再创建行动，保存失败回退；旧档兼容，重试保留选择与装备奖励，次日清空选择。
- [x] 专项流程 41 项、原生画面与输入 58 项检查通过。构建与人工平衡边界见[今日行动记录](design/expedition.md)。
- [x] Windows 构建完成，独立 EXE 的主菜单、营地、行动、今日行动与展厅共 10 项 Headless / 原生启动验证通过。

这项交付完成三选一入口和差异化资源/危险配置；下方较早的“三套小型任务布局”、地图词条及完整 Day Loop 建议仍属于后续范围。

## 2026-09-12：第二阶段外出视觉、Camera与HUD（已交付，等待视觉验收）

保持正式街区Seed20260912与Camp往返流程，按用户要求收近镜头、整理光照/材质、收起常驻POI信息，重构紧凑HUD及1600×900默认窗口。Before、职责边界、实施及验证记录见 [EXPEDITION_VISUAL_REPORT](design/expedition.md)。本阶段不扩充模型、地图结构或战争迷雾。2,332项Headless检查、1,385项原生检查及10组独立EXE启动验证通过；新版位于 `build/BlueHourHomeward.exe`，保留用户当前运行的旧程序。已停止开发，等待视觉验收。

## 2026-09-12：首个正式普通感染者（已交付，待人工手感验收）

- [x] 在现有正式开局、专属路线、营地和外出链路内替换敌人；唯一模型为 `ENM_001_infected_basic_a`，高度 1.65 米，沿用角色资源目录和外部材质规范。
- [x] 原 EnemyData 升级为 EnemyDefinition，所有初始遭遇、时段池和调试生成统一注册这一项；移除四个旧敌人定义和特殊召唤分支。
- [x] 原任务时钟参与运行时 HP、伤害与刷怪倍率；数据模板保持不变，攻击加入前摇、距离复核与完整复用重置。
- [x] 842 项玩法断言、131/1074/187 项地图与资产断言和 52 资产加载通过；正式流程原生 189 项、既有原生操作 53 项通过。
- [x] Windows 单文件已交付；对与本次导出 SHA-256 完全一致的 EXE 独立副本完成主菜单、营地、外出及展厅共 8 项 Headless / 原生启动验证。没有关闭用户已运行的游戏。

当前范围与七项交付说明见 [普通感染者规格与验收](design/enemies.md)。击退和击杀经验只预留定义字段，不扩展既有角色成长系统；绑定动画、其他敌人和长期威胁不在本轮内。下列四类旧敌人描述属于历史切片记录，以本次单一普通感染者范围为准。

当前 EXE 包含同期街区、蓝时号与感染者改动；下方较早记录的整包构建阻塞已由本次产物验证解除。人工战斗手感与长期数值平衡仍待试玩，不把自动化通过当作体验定稿。

## 2026-09-12：正式蓝时号视觉替换（场景与合并构建通过）

使用用户提供的 `VEH_BLUE_HOUR.glb`，统一至 `scenes/world/vehicles/veh_blue_hour.tscn`。保留源比例与 Scale=1、冻结营地布局和既有撤离逻辑。营地、外出、整备与展示共用同一资源；旧 GLB 在零引用和真实运行验证后已删除，历史 Blender 来源保留。营地 102 项、车辆专项 36 项、原生完整外出回营 41 项通过。该任务首次Windows构建遇到并行敌人编辑涉及的搜刮反击断言失败；后续正式街区任务已修正旧测试坐标/时序并完成合并版本整包构建及独立EXE验证，见 [WORLD_MAP_REPORT](design/expedition.md)。尺寸、动画限制和最初验证记录保留于 [BLUE_HOUR_VEHICLE_REPORT](design/camp.md)。

## 2026-09-12：第一版正式外出街区（已交付，待人工验收）

本轮按用户新要求，优先将 16 个核心场景资产接入正式营地出发后的行动地图。只做固定 Seed 的首版街区，保留主菜单、专属路线、营地、行动和返航结算。职责追踪、资产审计、实施检查点和验收见 [WORLD_MAP_REPORT](design/expedition.md)。完成该版后停止扩张，等待用户视觉和玩法验收；下列历史后续建议不自动执行。

- [x] 16项真实模型审计、统一Wrapper/数据目录、固定Seed20260912、8建筑/3环境车辆、规则道路/围栏与原导航接入。
- [x] Headless 2,234项断言及52资产加载通过；正式原生闭环41项、操作回归42项通过。
- [x] Windows内嵌单文件构建、独立菜单/Camp/Expedition和展厅共8项启动验证通过；同期蓝时号与普通感染者保留并组合验证。
- [ ] 用户视觉和玩法验收；树冠/顶棚遮挡、美术精修及后续seed开放仅列建议，不继续实现。

## 2026-09-12：0.5.0 被动道具与特殊技能扩充（已交付）

本轮按用户的明确清单优先扩充现有系统；规格与边界见 [EFFECT_SYSTEM_SPEC](design/items-and-skills.md)。此前通用治疗/区域支援、每日选图等计划仍保留，未因本轮特殊技能扩充而标记完成。

- [x] 检查现有内容、专精、角色/武器、搜索、时钟、结算、保存及图标加载；确认原有单技能读取和 v2 固定槽位校验的限制。
- [x] 沿用 Resource 与稳定 ID，注册 8 被动、6 技能及各自普通/升级数值，原样导入 14 张图标。
- [x] 统一 Modifier 接入自动/指向/近战伤害、远程攻击间隔、最终承伤、搜刮、移动、基础资源和复制结算；最短搜索时间为 0.2 秒。
- [x] 统一多技能每日状态、独立过期、治疗上限、仅阶段时钟冻结、独立威胁选择器及腕表方向预警。
- [x] v3 保存持有/槽位/容量/一次升级状态，兼容 v1/v2 并保留原版本备份；换装及调试事务失败回滚。
- [x] 安全屋多内容管理、调试授予/升级、6 个独立技能按钮、预警状态和最小窗口布局。
- [x] 765 项玩法 Headless（含 329 项新专项）、84 项美术集成、52 个模型加载、七组原生共 1206 项通过。
- [x] Windows 0.5.0.0 单文件构建及 6 项独立启动/内嵌模型验证通过；编码、局部入口和文档链接检查通过。

未启用病床、购物篮、报纸。地图发现、正式升级费用、槽位购买、长期平衡和人工手感评估仍属后续。现有根级 Harness 索引/软链接失败及 Headless 退出时的对象释放警告如实记录于 [VALIDATION](VALIDATION.md)，未修改其他项目或全局技能来掩盖问题。

范围真源为 PROJECT_CONTEXT。已交付第 32 节 Combat Vertical Slice 和第 33 节最小五日循环，规格见 [design/game-design.md](design/game-design.md)。0.3.0 补充用户授权的基础操作对齐与多点搜索，规格见 [ADR-0003](adr/0003-parallel-search-and-direct-controls.md)；完整游戏仍未开发。

## 0.1.1 切片检查点

- [x] 检查仓库规范、现有改动和本机 Godot；创建独立工程及局部上下文链。
- [x] 独立内容数据、昼夜和单次结算规则测试。
- [x] 城市、三人小队、四武器、三普通敌人及一特殊敌人的战斗。
- [x] 建筑/车辆搜索、可拾取 Food/Scrap、全员巴士撤离与结算。
- [x] Day / BLUE HOUR / Night 视听转换、夜间持续威胁、Debug Menu。
- [x] Headless、原生渲染输入验证、局部上下文、文档链接与编码校验。
- [x] Windows 单文件 EXE 构建与导出后独立启动验证；以后每次功能交付都生成可运行文件。
- [x] 用户查看并反馈 0.1.1“功能确实没问题”；仅记录功能认可。
- [ ] 人工试玩确认 5～10 分钟内的贪取感、操作手感与声画体验；继续数值调优。

## 0.1.1 已交付基线

- 独立 Resource 内容表，任务脚本编排领域模块；不新增第三方依赖。
- Godot 内置 AStarGrid2D 在 XZ 平面寻路，3D 城区由同一地图数据生成阻挡与表现；不为这张小地图引入烘焙导航流水线。
- 初始白昼 150 秒、BLUE HOUR 18 秒；搜索消耗时间，夜晚无强制结束。数值只是试玩基线，5～10 分钟贪取体验仍需人工试玩评估。
- 四把武器为手枪、冲锋枪、霰弹枪、近战撬棍；安全屋可在任意队员之间调配，Debug 可以给予所有武器。
- 普通敌人为缓行者、疾行者、犬型；特殊敌人为鸣响者，通过警报召来增援。
- 各时段刷怪池可在地图资源配置；导演最多保留 2 名特殊敌人、总活动敌人最多 85 名。物资点收益与基础搜索耗时直接显示在列表，搜索时间已根据固定路线探测提高，避免天黑前清空全图。
- 安全屋仅显示归航结算、库存和配装。每次再次出勤是独立切片演练，三人恢复；不实现阶段二的食物消耗、角色成长、长期死亡或存档。

## 验证记录

0.1.1 交付为可运行的第一阶段切片。0.2.0 在其上增加下文的最小跨日版本；自动化证据与尚未验证范围记录在 [VALIDATION.md](VALIDATION.md)。根 Harness 的 5 项既有符号链接检查失败没有作为本项目故障掩盖，也未修改其他项目来绕过检查。

## 迭代访谈（2026-09-08）

状态：用户认可 0.1.1 功能，并已确认 Q6～Q10 的完整开发基线；0.2.0 的跨日状态、食物与阵亡、武器个体与购买、保存和界面已实现，Windows EXE 已构建并通过独立启动验证。贪取节奏、好玩程度和长期重复游玩仍需人工确认。玩法术语整理在 [CONTEXT.md](../CONTEXT.md)。

### 0.1.1 访谈时的能力与边界（历史）

| 能力 | 当前实现 | 尚未具备 |
| --- | --- | --- |
| 城区搜寻 | 1 张固定布局的模块化 3D 城区，5 栋建筑、3 辆可搜索车辆；自动派一人、改派/召回、独立掩护命令、遇险自卫、搜索恢复与归队 | 每日地图选择、布局随机生成、独立任务目标 |
| 小队与战斗 | 3 名幸存者，增伤/搜索加速/减伤 3 个特质；手枪、冲锋枪、霰弹枪、撬棍可自由分配；点击移动、自动攻击/换弹、停止、集火 | 经验、等级、特质成长、随机武器词条、被动道具与战术能力 |
| 敌人与时间 | 3 种普通敌人、1 种召援特殊敌人；白昼 150 秒、蓝时 18 秒、夜间临时威胁持续增长 | 跨日城市侵蚀、天气、Boss |
| 物资与撤离 | Food/Scrap 掉落拾取；存活队员到齐后巴士准备、关门、返回；伤亡明示，全灭丢失本次物资，结算只入账一次 | 物资实际消费、跨日伤亡规则 |
| 安全屋 | 库存展示、武器调配、归航结果、再次出勤 | 游戏日推进、每日食物结算、存档；目前重开行动会恢复三名成员，库存只在当前进程保留 |
| 调试与交付 | 时段切换、资源增减、生成/清除敌人、给予武器、无敌、倍速；Windows 独立 EXE 与启动验证 | 人工手感验收、长期运行和性能基准、其他平台 |

### 0.1.1 访谈时对下一步的约束（历史）

- 第一阶段的机制已经贯通，但“5～10 分钟内想再贪一个点”仍未人工验收，不能因检查项通过便认定体验成立。
- 旧版全队共同搜索的路线记录属于历史证据。0.1.1 改为单人搜索后，三组种子中保守路线均在 149.5 秒归航，蓝时返回路线均在 170.7 秒归航，继续深入的两条路线均在 252.3～274.3 秒全灭。这些路线并不等价，不能推断为统一的生死时间线；详见 [VALIDATION.md](VALIDATION.md)。
- 当前食物和废料可积累但不能消费，归航还没有改变下一天的生存或配装能力。该缺口属于第二阶段；不能用扩充角色、地图数量来替代它。
- 当前死亡只影响本次行动。长期死亡、受伤恢复和失败后的重开规则，需要在跨日进程实现前明确。

### 迭代依赖顺序

1. **阶段 1.1：先验收单次行动的风险选择。** 聚焦下一搜索点的收益与耗时、夜间敌情与撤离准备的可读性、小队移动和集火反馈；按近点、远点、回程遭遇检查不同路线。数值调整不能只依靠延长搜索等待。验收要能解释何时值得多搜、何时该走，以及失败来自什么决定。
2. **阶段 2.1：最小跨日循环。** 先确定游戏日推进、食物消耗和不足后果、伤亡延续、物资的一项明确用途，再落地存档与结算。验收“今天带回的东西改变明天的选择”，并覆盖退出重进、结算不重复、资源不足与失败情况。
3. **阶段 2.2：每日地点三选一。** 复用现有城区模块，先做资源收益、危险和目标不同的行动选择，再逐步接入超市、仓库、空投、营救、医院等计划内任务；不要求先制作三张全新美术地图。
4. **阶段 2.3：成长与构筑。** 幸存者升级、特质成长、少量武器词条、基础被动与特殊能力逐项进入，检查它们是否实际改变配装和路线选择。通过第二阶段连续 10～20 个游戏日的验收后，再扩第三阶段 Demo 内容与美术。

### 决策树（0.1.1 历史）

- 已确定：Godot + GDScript；数据驱动；以“白天搜 → 蓝时预警 → 夜晚危险暴涨 → 贪取或撤离 → 全队归航”为方向；每次功能交付提供验证过的 EXE。
- Q1 已确定：用户接受先完成阶段 1.1 的单次行动体验迭代。
- 新线索：用户希望核对原作“一人搜医院、其他人打僵尸”的分工。原作公开记录支持成员任务分派，补充事实见 [PROJECT_CONTEXT 的小队控制说明](../PROJECT_CONTEXT.md#23-小队控制与战斗)。
- Q2 已确定并实现：用户选择 A，“小队移动/集火 + 单人任务派遣”，允许查看或更换执行者。该操作边界记录为 [ADR-0001](adr/0001-squad-command-and-task-dispatch.md)。
- Q3 已确定：自动派最近的可用成员，并允许改派。
- Q4 已确定：本轮最多一个搜索者，三人存活时两人掩护。
- Q5 已确定：搜索者留在可见入口、可以受伤，遇到威胁暂停搜索并自卫。
- 非阻断细节按本轮实现基线收敛：普通移动、停止和集火只影响掩护成员；召回与改派保留进度；完成后自动归队；撤离取消任务并召回所有存活成员；搜索者阵亡时中止任务，不自动投入替代成员。跨日食物、伤亡和存档留在阶段二。

### 阶段 1.1 实施检查点

- [x] 操作边界与 Q3～Q5 已确认。
- [x] 先新增任务派遣回归用例；旧实现实际触发“全队被移动”和“不能改派”失败。
- [x] 单人任务、独立掩护命令、遇险自卫、改派/归队/死亡与撤离。
- [x] 角色状态、改派、召回与目标提示的原生界面验证。
- [x] 规则、行动、派遣、原生输入、路线诊断；文档同步与 Windows EXE 构建、独立启动。
- [ ] 人工试玩确认搜索期间的掩护、蓝时召回与贪取节奏；本轮不宣称完成阶段 1.1 的体验验收。

### 0.1.1 搜索分工（历史）

搜索任务由独立模块持有一个执行者，进度继续属于搜索点。默认派最近的可抵达存活成员；工作期间不攻击，只有执行者自己的搜索特质生效。距离执行者 4 米内出现视线可达的敌人或执行者受击时暂停并自卫，安全持续 1.25 秒后继续；参数在地图 Resource 中配置。

普通移动、停止和集火只指挥掩护成员。同一时间最多一个搜索目标；改派、R 召回和中断均保留进度。旧执行者与完成任务者步行返回当前掩护成员，目标死亡不会误取消归队。搜索者阵亡中止任务，由玩家决定是否再派人。E 撤离取消搜索与归队状态，将全部存活成员送往巴士，仍等待全员到齐。

左侧显示成员职责、搜索者、地点、进度、暂停原因、改派和召回按钮；地图标记搜索者，避免与当前搜索点的文字重叠。修复导航阻挡额外扩出一行、使入口不可达的问题，全部 8 个入口已纳入回归。医院只是原作例子，本轮复用既有建筑验证分工，没有扩医院专属任务、成长或跨日系统。

本轮通过 19 项规则、46 项行动、42 项派遣与 51 项原生输入/截图检查，并执行 3 个种子 × 4 条真实战斗路线。`build/BlueHourHomeward.exe` 已更新为 0.1.1，独立 Headless 与原生启动通过；完整证据、旧记录和局限见 [VALIDATION.md](VALIDATION.md)。

## 功能认可后的迭代访谈（2026-09-08，已收敛）

### 对照原作后的判断（0.1.1 快照）

比较对象为原版《Deadly Days》。其官方 0.50 开发记录说明：任务从综合搜寻转向按当前需求选资源，同时加入食物生存压力；0.80 又将地图目标设为可放弃的额外追求。此处借鉴决策关系，不照搬早期版本的具体数值或惩罚。[官方开发记录](https://store.steampowered.com/news/posts/?appgroupname=Deadly+Days&appids=740080&enddate=1569421769)

原作商店还强调用获得的武器、道具和能力形成组合。这意味着下一步需要给玩家“获得东西后改变打法”的机会，不能仅靠增加每日扣费维持动力。[官方商店](https://store.steampowered.com/app/740080/Deadly_Days/)

| 决策环节 | Blue Hour 当前缺口 | 对迭代的约束 |
| --- | --- | --- |
| 今天为什么出发 | 食物和废料仅累加，未消费 | 先给物资真实用途，再设计需求驱动的地点选择 |
| 为什么冒险多搜 | 现有收益都是已知的两类资源，四把武器开局全部可选 | 少量可获得、可替换的装备奖励比单纯提高掉落数量更值得验证 |
| 为什么珍惜队员 | 下一次行动恢复三人，伤亡不延续 | 先确定跨日成员状态和全灭后果，再与结算、存档一起实现 |
| 明天有什么不同 | 同一地图、同一阵容和武器，没有日推进或成长 | 用少量游戏日验证状态变化；地点差异应改变目标与收益，不能只换建筑名称 |
| 危机时还能做什么 | 已有移动、集火、派遣与召回，没有战术能力 | 如果试玩主要问题是等待，有限次能力可以成为下一版重点；不能只延长搜索时间 |

以上来自当前代码与原作资料的分析，不代表用户已确认“缺乏动力”或“战斗无聊”。用户目前只明确认可功能。

### 下一版方向：归航改变明天（Q6 已确认）

访谈时建议将第二阶段拆成可试玩的小版本，先用连续 3～5 个游戏日检验以下循环。Q10 随后确定为第五日结算后的试玩终点，不改写第 33 节连续 10～20 日的最终验收。以下保留决策顺序。

1. 保留当前小队控制与单人派遣，打通游戏日推进、食物消费、跨日成员状态和退出续玩。缺粮、伤亡、全灭的具体规则在实现前确认。
2. 给 Scrap 一项明确用途，并加入一种可改变配装的正向奖励；优先复用现有四种武器，不同时铺开升级、全部词条、被动和特殊能力。体验重点已确认，具体采用购买、强化还是武器回收，在 Q9 收敛。
3. 资源和奖励能发挥作用后，再接入每日地点三选一。复用城区模块，按补给、装备等需求区分行动目标；武器奖励未成立前不先做空投外壳，成员持续性未成立前不先做营救。
4. 基础循环成立后，逐步加入少量武器词条、被动与战术能力，再扩医院等奖励类型及内容数量。

验收场景：带回的补给会改变明天是否必须找食物，带回的装备会改变配装或冒险把握；在蓝时选择继续搜索时，玩家能说出正在争取什么、可能失去什么。独立单次行动的贪取感仍须同时检验，不能依靠跨日系统掩盖等待和战斗问题。

具体生存与奖励规则已通过 Q7～Q10 收敛，0.2.0 已实现这一步。暂不增加地图数量、角色数量、基地房间或高级美术。

### Q6 后的事实核查（0.1.1 数据）

- [PROJECT_CONTEXT 第 6 节](../PROJECT_CONTEXT.md#6-核心资源设计) 已规定每日每名成员固定消耗食物、缺粮有严重后果；没有规定本作必须每人每天吃 1，或第一次缺粮就直接死人。文档前部的这两个细节属于原作参考，不能自动视为本作规则。
- [PROJECT_CONTEXT 第 24 节](../PROJECT_CONTEXT.md#24-roguelite--meta-progression) 已规定 Run 失败后重新开始；随机武器、自由配装、后续成长的方向也已确定，不再询问是否需要这些系统。Q7～Q9 随后明确了本轮阵亡不恢复、首次缺粮的补救机会与首个装备奖励循环。
- 当前固定三人；既有 0.1.1 路线观察中，保守路线带回 13 食物，蓝时返回路线带回 25 食物。若设每人每日消耗 1，扣除当天后分别剩 10 和 22，可再完整供应三天和七天。若每日重置地图并重复成功走保守路线，每日净增 10；单独加入扣粮不足以形成 3～5 日试玩中的补给压力。这是基于既有证据的条件推算，没有新增试玩。
- 消耗、初始库存、普通点收益和高产补给机会要一并调整。具体数值在实现中作为数据化试玩基线决定，不逐项访谈，也不靠增加货币种类制造复杂度。

### 当前决策树边界

- 已确定：0.1.1 分工功能获用户认可；Q1～Q5 不重新询问。
- Q6 已确定：用户选择 A，优先最小跨日循环与可用奖励；主动战术能力不作为下一版的首要验证目标。
- Q7 已确定：用户接受推荐，阵亡成员在本轮无法恢复，剩余成员继续；全部阵亡时本轮失败并重新开局。新开局仍可使用这些角色，本轮损失不等于永久删除角色内容。见 [ADR-0002](adr/0002-run-scoped-casualties.md)。
- Q8 已确定：用户接受推荐，首次食物不足先承受饥饿惩罚，留一个游戏日补粮；连续缺粮才造成人员损失。
- Q9 已确定：用户接受推荐，外出找到少量有差异的武器，带回自由换装；Scrap 用于购买明码标价的备用武器。该决定落实下一小版的奖励顺序，不同时铺开整个成长系统。
- Q10 已确定：用户接受 [完整规格](design/game-design.md)，包括足粮休整、战斗装备损失、优先供养选择、安全屋保存、当天重试与第五日试玩终点。本轮已进入实施，不再重复询问已接受的规则。

### 0.2.0 最小跨日版本实施清单

- [x] Q6～Q9 已确认，项目上下文、术语与阵亡决策记录已同步。
- [x] 完成 [design/game-design.md](design/game-design.md) 的可审阅范围与验收场景。
- [x] Q10 核对补充规则，收敛完整开发基线。
- [x] 本轮成员/库存/装备状态、每日结算、饥饿与失败规则及自动化验证。
- [x] 武器个体、四个适用范围明确的词条、搜索奖励、备用武器商店和自由配装。
- [x] 安全屋准备、口粮分配、结果/结束界面、保存续玩与 Debug 入口。
- [x] 单人行动与撤离、跨日失败恢复、正常五日路线、原生输入和窗口适配验证。
- [x] 更新专项文档与局部实施范围，重新 build，验证独立 EXE 启动并交付运行文件。
- [ ] 人工验收物资用途、补粮压力、装备收获和愿意再次出发的体验。

## 原作操作再核查（2026-09-08）

用户指出原作可以多地同时搜，并质疑操作差异。已完成 [原作操作核查](reference/deadly-days-reference.md)，对照官方 0.50～0.80 更新、2024 年开发者键位回复、Steam 玩家记录和研究时源码。多点并行有较强证据；当时全图只有一个任务、缺少按住左键跟随与 Ctrl 指向射击、Space 与镜头键位不同均为实际差异，0.3.0 已补齐。

- [x] 核查来源、明确事实与推断，修正 PROJECT_CONTEXT 与 ADR 的原作归因；保留当前实现状态。
- [x] 用户授权基础操作向原作对齐；实施规格见 [ADR-0003](adr/0003-parallel-search-and-direct-controls.md)。
- [x] 实现与验证上述功能，再按项目规则重新构建独立 EXE。

用户已要求开始实施，0.3.0 功能、Windows 构建和最终原生回归已完成。现有五日循环继续承接物资与伤亡后果；室内安全等未核实原作细节保留明确的本作规则。

### 0.3.0 实施检查点

- [x] 新回归先验证旧版的并行任务与直接操作缺口。
- [x] 多任务归属、独立进度、选择/取消/改派与全队召回。
- [x] 持续带队、指向射击、暂停、镜头和输入冲突处理。
- [x] 多任务 HUD、原生输入、小窗口、并行路线与跨日回归。
- [x] 文档与上下文同步、重新构建并验证独立 EXE，交付运行文件。
- [ ] 人工试玩基础操作与并行取舍；继续调整夜间风险和搜图收益。

0.3.0 共通过 270 项 Headless、123 项原生输入/界面检查，Windows 单文件 EXE 及导出后两种独立启动通过。并行路线使用 3 个种子 × 3 种策略，无瞬移、无敌或搜索加速：三点串行 149.5 秒、三点并行 72.3 秒归航；八点并行 171 秒搜完、187.6 秒归航，三组均全员生还。这说明效率已明显改变，但短时入夜风险仍低，不能把通过测试当作贪取节奏已平衡。下一步优先实玩并调危险与收益，不靠延长读条抵消并行操作。证据与边界见 [VALIDATION](VALIDATION.md)。

## BLUE HOUR ART PIPELINE V1（2026-09-08）

本轮是自主美术资产库与视觉集成，不继续 Gameplay Phase 2。视觉真源为 [ART_BIBLE](../art/ART_BIBLE.md)，生产与导入方式见 [ASSET_PIPELINE](../art/ASSET_PIPELINE.md)，实际资产明细见 [MODEL_CATALOG](../art/MODEL_CATALOG.md)。与同时进行的 0.3 操作开发共用工作区，保留其修改；按用户要求在该任务稳定后验证合并版本。

- [x] 定位并实跑 `D:\Blender\blender.exe`，版本 5.2.1 LTS，无下载或安装修改。
- [x] 建立固定色板、米制尺度、统一倒角、模块复用、简化碰撞与源文件规范。
- [x] 完成 52 个原创 `.blend` / GLB：8 道路、11 建筑模块、3 组合建筑、16 城市道具、4 搜索对象、5 车辆、4 枪械、1 基础感染者占位。
- [x] 五批生成与 Godot 导入/实例化全部通过；完整重建 52/52 GLB 哈希一致，总计 58,164 tris / 3,598,536 bytes。
- [x] 现有 5 建筑、3 搜索车辆、12 路灯、道路、掉落箱、巴士与 3 类持枪视觉替换；AR 仅作为资产，不加入 Gameplay。
- [x] 保留搜索数据、入口、地图时段和游戏状态机；模型代理不重复进入现有城市碰撞；巴士仅扩大到真实长度的 Box 占地。
- [x] 建立全资产展示、Day / BLUE HOUR 模式、原生截图与入口/路径/共享材质验证。
- [x] 等另一处操作开发稳定后，最终合并版本通过 270 项玩法、84 项美术集成、52 个模型导入及 145 项原生检查；Windows 构建、独立 EXE 与打包后全资产启动通过（2026-09-09）。
- [ ] 人工验收风格与体验；正式 Anime 人物、绑定/动作、手机性能和专用 LOD 后续独立推进。

## 2026-09-09 试玩后的迭代建议（尚未实施）

用户已实际试玩并反馈“整体功能好一点了”，同时确认另一任务接入的模型显示成功。记录为基础功能改善与模型加载得到人工确认；不扩大解释为操作完全对齐、风格定稿、夜间风险平衡或愿意连续重玩的体验已通过。当前为 0.3.0 + ART PIPELINE V1，仍处于第 32 节可玩切片向第 33 节完整 Day Loop 过渡，五日版本只是第二阶段的一部分。

本轮重新核对当前 `data/catalog.gd`、`core/campaign.gd`、`ui/shelter_screen.gd`、地图配置与验证报告：仍只有东岸旧街一个行动地图，出发前无行动选择；每天重置固定搜索点，只重抽既有奖励与商店。现有 Trait 为三个固定倍率，没有成员经验/等级或成长状态；没有主动能力和被动道具槽。模型库已能支持复用城市模块，但资产数量不代表已实现的任务或武器数量。

### 对照依据

原作 0.50 官方更新把综合搜刮改为按需求选择不同任务：食物对应超市、武器对应空投、成员对应营救；同时加入 Trait 成长和能力机制。0.80 将行动目标设为可放弃的追求，鼓励危险时撤离；1.0 又调整过夜间快速升级的危险。这些是对应版本的官方记录，用于解释设计关系，不视为所有最终数值的真源。[Pixelsplit 官方开发记录](https://store.steampowered.com/news/posts/?appgroupname=Deadly+Days&appids=740080&enddate=1569421769)

原作商店强调根据获得的武器、道具和特殊能力组合打法，并包含程序城市与任务。依此对照，当前的主要缺口是行动选择、危机中的干预和每轮成长组合。[原作商店](https://store.steampowered.com/app/740080/Deadly_Days/)

### 当时推荐的小版：每日行动选择与目标（现排在开局基础之后）

目标是检验“今天缺什么 → 选哪里 → 搜到什么可以走 → 蓝时还值不值得多拿”。这是本次建议，用户尚未要求实施，不把以下待办当成已接受的完整开发规格。

- [ ] 安全屋每日展示三个行动选项，显示主产出、规模和可读的危险信息；复用当前模型搭建三套小型任务布局，不只换卡片名称或建筑皮肤。
- [ ] 第一批建议为超市补给、空投装备、综合搜刮。食物、武器个体、Scrap 已有用途，可直接形成不同需求；医院与仓库的能力/被动奖励待对应系统可用后再加入。
- [ ] 每次行动有一个明确的主要目标和可放弃的额外搜寻机会；允许提前撤离、保留已携带物资，不强制清空全图。空投需作为真实可交互目标，不能仅将现有库房改名为“空投”。
- [ ] 将主要奖励、额外收益、回程距离与危险位置配合起来；蓝时保留简短预警，真正的大幅危险提升在夜晚。先用既有犬型和鸣响者检查回程应对，不仅提高血量或拉长读条。
- [ ] 显示搜索中断、受威胁队员和归航未到齐成员，保持三点并行、指向射击、暂停命令与模型点击入口可读。
- [ ] 行动选项与选中任务跟随本日保存；退出重进不刷新任务或奖励，旧五日存档可延续，原有购买/伤亡/结算一次性规则继续成立。

验收应比较缺粮、缺火力、缺废料三种准备状态是否会改变选图；同一目标分别提前走、蓝时多拿一个、夜间继续深入，记录净收益、伤亡和敌情。此前三个种子串行三点 149.5 秒、并行三点 72.3 秒、八点并行 187.6 秒均全员归来，只说明既有固定路线短时入夜较安全，不能推断所有打法或所有种子均无压力。本次未重跑路线，不把历史报告当作新增实玩。

现有第 32 节写有 5～10 分钟的体验目标，地图总设计写有 5～15 分钟；当前路线普遍短于此。应先验证一次行动中是否有足够的有效决策，再通过布局和遭遇调整节奏，避免仅为满足分钟数延长等待。下一版仍建议保留五日终点，先比较五天里的选图差异。

### 后续顺序与边界

| 顺序 | 建议范围 | 对应 PROJECT_CONTEXT | 先回答的问题 |
| --- | --- | --- | --- |
| 紧接 0.4 | 两类通用战术能力：紧急治疗、区域火力支援；先做明确冷却/使用反馈，暂不铺大量特殊能力 | 第 11、33 节 | 队员被围或归航缺一人时，能否靠一次合理干预改变结果？ |
| 随后 | 少量被动槽、Trait/等级成长；再接医院能力奖励和仓库被动奖励 | 第 7、10、13、33 节 | 获得不同东西后，是否会改变配装、搜索分工与路线？ |
| 第二阶段后半 | 营救真正加入新成员、额外口粮和阵容取舍；逐步达到连续 10～20 日的完整循环 | 第 8、13、33 节 | 扩充队伍的火力收益和供养代价是否都成立？ |
| Demo | 再扩天气、长期侵蚀、少量基地房间、主线节点与一个阶段 Boss | 第 34 节 | 核心循环已成立后，新增内容是否带来新的决策？ |

营救不自动复活本轮阵亡者；人数上限、初始人数和成长公式须在该小步明确，不能把第 8 节长期人数目标倒套到当前三人切片。第 36 节关于手动瞄准的旧宽泛措辞不撤销已确认的 0.3.0 小队 Ctrl 指向命令，现行行为以第 2.3 节和 ADR-0003 为准。

美术沿用已有资产库，后续优先服务目标辨认、受击/射击反馈、昼夜可读性和巴士归航；不以资产数量推动玩法范围。原作室内受伤、出入门和取消细则仍是独立核查项。下次发生功能实现或修复时继续交付新 EXE；本轮只更新分析与计划，不改游戏代码，也不重复构建。

## 2026-09-09 原作开局截图访谈（已收敛，0.4.0 已交付）

用户补充原作 v1.7.0F2 十张截图，并要求先做新游戏、Tab 专精选择、随机两人、进入基地的基础架构。已核查截图、官方机制记录和当前代码，结果见 [开局与基地核查](reference/deadly-days-reference.md)，本轮规格见 [design/game-design.md](design/game-design.md)。此前每日行动选择是尚未实施的建议，现让位于本轮开局基础；后续不丢弃每日选图、通用战术能力与完整 Day Loop。

- [x] Q1：先做完整开局流程和三套真正生效的被动/特殊能力套餐，暂缓跨局专精经验、完整解锁树及第四专精。
- [x] Q2：现有三名角色中随机抽两名，保留各自形象与 Trait，继续自由换装。
- [x] Q3：加入成员详情、食物训练升级与 Trait 成长，只在当前 Run 内保留。
- [x] Q4：本轮只做专精赠送的每日一次特殊能力；下一轮接通用紧急治疗与区域火力支援，随后每日选图。
- [x] 实现主菜单、创建草稿、专精套餐、本轮成员成长、3D 基地准备和旧档兼容。
- [x] Headless、原生交互及完整日循环回归；构建并独立启动新版 Windows EXE。

访谈收敛后已进入实施并运行新版验证；最终结果见 VALIDATION。0.3.0 的历史验证不作为新增功能证据。

0.4.0 构建于 2026-09-09 20:47（+08:00），文件版本 0.4.0.0。436 项玩法 Headless、84 项美术集成、52 个模型导入通过；五组原生渲染/输入共 201 项通过。三套专精均完成固定补给路线的五日流程，仍需人工比较升级、专精和夜间贪取的取舍，不能把自动通过当成体验定稿。后续顺序按 Q4：通用治疗/区域火力支援 → 每日选图与目标 → 更多奖励组合及跨局解锁。

## 2026-09-09 0.4.1 首页还原（素材接入已交付，逐像素目标待补图）

- [x] 使用最后一张 1919×1080 设计稿的左侧 Logo / 六项菜单、底部三个入口与右侧静态海报构图。
- [x] 原始 PNG 入库；图标使用 6 行双状态雪碧图，底部图标使用区域切片；字与按钮保留原生交互。
- [x] 键盘 / 手柄与悬停焦点、弹层返回、等比缩放和背景覆盖；开始、继续、专精选择及存档保护保持有效。
- [x] Windows 0.4.1.0 构建及独立启动；436 项玩法 Headless、84 项美术集成、52 模型导入、725 项原生检查通过。
- [ ] 按 [UI_ASSETS](../art/UI_ASSETS.md) 补齐原稿手写装饰与同款底图 / 字体后，完成逐像素视觉复核。

角色图鉴与营地档案为当前内容只读页，设置仅提供窗口全屏切换；愿望单、社区与制作组资料仍待正式提供，不虚构链接。海报明确不接交互。本轮没有新增 Gameplay，不改变上述后续玩法顺序。最新证据见 [VALIDATION](VALIDATION.md)。

## 2026-09-12 第一阶段正式武器

- [x] 以既有 WeaponData/Equipment/Campaign 为基础，八把独立 WeaponDefinition、WeaponInstance、库存 CRUD、唯一主武器槽、装备/卸下。
- [x] 用户原始八图标、四品质与六词条框架；八武器接商店及掉落池。
- [x] 自动与指向攻击共用控制器，弹匣/自动换弹、七弹丸散射、H7 有限穿透、移动惩罚及击退。
- [x] 基地武器图鉴/详情、个体库存与换装；v4 存档及 v1/v2/v3 兼容。
- [x] 428 项武器专项与 43 项原生 UI 检查通过；既有受影响回归通过。
- [x] Windows 构建与独立 EXE 的基地/菜单/行动/路线/武器页/展厅共 12 项启动验证通过；交付独立程序，详见武器报告。
- [x] Phase 2A：三把正式 3D Weapon Model、右手 WeaponSocket 和三类基础姿态，见 [WEAPON_VISUALS](design/combat.md)。
- [ ] Phase 2B 剩余：其余五把模型、其他 profile 攻击/换弹动作与手型；long_gun 公共动作及 LeftGrip 约束已在下方独立阶段实现。

范围、全部配置与文件清单见 [WEAPON_SYSTEM](design/combat.md)。与地图、角色统一骨骼的并行任务保持独立。

## 2026-09-12 幸存者 Locomotion Polish

- [x] 实际审计正式 Mission 的 Node3D / AStarGrid 路径消费与公共动画链路。
- [x] 修复持续命令回走起始网格点；加入水平加减速、到达收步及最短角快速转向。
- [x] 幸存者模型插值、Mission 动画渲染时钟、Idle/Walk/Run 迟滞和独立步频倍率。
- [x] 两名角色单独及同时的正式地图原生前后对比；真实地图绕障、到达、暂停和指向射击回归。
- [x] 完成当前工作区快照的 Windows 构建及独立 EXE 启动验证；更新 canonical `build/BlueHourHomeward.exe` 与 BUILD-INFO。
- [ ] 用户验收移动手感与残余脚滑；不自动进入 IK、Root Motion、Stride Warping 或动作重制。

具体原因、参数、性能样本和范围见 [LOCOMOTION_POLISH_REPORT](design/combat.md)。本次不修改角色 Mesh、骨骼、权重、动画关键帧、地图内容、HUD、营地逻辑或武器玩法；其他任务的未提交改动保留。


## 2026-09-12 武器 Phase 2A 交付

- [x] 仅短刀/P9/A21正式GLB、编辑源、米制轴与三个Marker。
- [x] 既有WeaponVisualController接模型生命周期、RightHand BoneAttachment和三类轻量姿势。
- [x] 双角色、三动作、装备切换/卸装/空模型、实际Camp与Mission往返验证。
- [x] 武器逻辑428、模型1377、UI112、公共动画908项通过；Windows导出、12项EXE启动、两种内嵌包验证完成。
- [ ] Phase 2B 保留其余五把模型、手指握持、其他 profile / 换弹与枪械特效；long_gun 本阶段见下方。

交付路径、文件清单、验证记录和限制见 [WEAPON_VISUALS](design/combat.md)。

## 2026-09-12 Survivor Combat Animation Foundation

- [x] 审计并复用现有 WeaponDefinition、VisualController、CombatController、Inventory 与 AimFire；只消费现有三类 animation_profile。
- [x] Gameplay 事件 → Animation Bridge → 13 骨 Upper Body Filter，保留原 Locomotion 与渲染时钟。
- [x] 两人共享 long_gun_ready / aim / shoot、及时混合、连续射击、LeftGrip 同帧约束与正式 MuzzlePoint 曳光起点。
- [x] 双角色 2605 项动作链路检查、47 项原生 Mission 检查；原移动 109/42/15 项、公共动画 908 项、武器玩法 428 项回归。
- [x] 26 个角色/Rig/旧动画文件 SHA-256 未变；撤离缩放为零的约束生命周期已修复并回归。
- [x] 同期营地任务统一完成最新整包 Windows build；12 项独立 EXE 启动、两种内嵌包武器/战斗动画检查通过，未并行覆盖同一 EXE。
- [ ] 用户验收 long_gun 视觉与手感；不自动开始 sidearm / melee_short / reload / hit / death。

架构、生成源、原生画面、性能数据和近景手型/枪托边界见 [战斗动画报告](design/combat.md)。

## 2026-09-12 Mission / Combat Locomotion Style Pass

- [x] 新增两人共享的 In-Place `mission_jog`，Mission 按地图上下文选用；Camp Walk 与旧 Run 保留，Gameplay Speed 不变。
- [x] 沿既有 Upper / Lower Body Layer 组合 Combat Jog；强化 Ready / Aim / Shoot 与 MuzzlePoint 短闪光。
- [x] 双角色分层 3443 项及正式 Mission 新专项 225 项通过；真实搜索/召回、连续射击、卸装纳入验证。正式 Camp 双角色原生 Walk 专项 155 项通过。
- [x] 已取得正式 size=25、1600×900 高位镜头画面与连续帧，性能独立采样。
- [x] Windows 构建链分段完成，最终 EXE 于 20:04:42 导出、20:06:54 验证完成；12 组独立启动、内嵌包武器模型及战斗动画 Headless / 原生验证通过。
- [ ] 等待用户试玩确认动作风格；本阶段停止，不扩展其他武器、Strafe、Foot IK 或 Root Motion。

实现、全部验收场景和当前限制见 [Mission 动作报告](design/combat.md)。

## 2026-09-12 Phase 2C 第一阶段：无武器 Mission Jog V2

- [x] 原 Mission Jog V1 原样保留并另存备份；同路线 Before 与已有录像均保留。
- [x] 重新烘焙公共 V2，只接入无武器 Mission；持武器使用 V1，Camp Walk 不变。
- [x] 夏知遥正式 Mission、默认摄像机、正式 HUD 与角色尺寸，完成直线持续跑动、起步接连续 Jog 和基础转向录像。
- [x] 前后 810 个采样点 Gameplay 位置/速度完全一致，261 个边界文件哈希未变，V2 安全契约 219 项通过。
- [x] 本轮 Windows build 与原有回归完成；12 组独立 EXE 启动、内嵌包武器/战斗动画验证及内嵌 V2 的 219 项检查通过。
- [x] 用户确认 V2 方向正确并保留；机器人感继续在 V2.1 修整，不回退 V1。

视频、参数和复现见 [Jog V2 验收记录](design/combat.md)。在视觉验收前停止，不进入 Start、Stop、Turn Lean 深度优化、Combat Jog V2、Aim/Shoot Jog、Sprint、Strafe 或 Foot IK。

## 2026-09-12 Mission Jog V2.1 Polish

- [x] 保留 V2.0 资源、生成源和原视频；仅重新烘焙现有公共 V2 库的四项动作曲线。
- [x] 前倾增强 25%，Compression 行程约 71mm 且最高点不变；加强伸膝/抬跟/离趾与 Knee Drive，胸肩错相，头颈保持小幅延迟。
- [x] 夏知遥无武器、正式 Mission/HUD/默认摄像机，完成 19 秒主视频与同路线 V2 Before，包含连续直跑及 10 秒侧向 Jog。
- [x] 1140 帧位置、速度、动画倍率一致；V2 安全契约 223 项及受影响 Mission/Camp/Combat/公共动画回归通过。
- [x] Windows Release 导出、10 组独立启动及内嵌动画包 223 项检查通过；同期后续 HUD 改动单独记录。
- [x] 用户视觉验收通过；锁定 V2.1 主循环，不再重新 author。

参数与录像见 [V2.1 验收记录](design/combat.md)。主循环已锁定，后续授权范围为下方 Phase 2D。

## 2026-09-12 Locomotion Phase 2D：Start / Stop / Turn Lean / Cadence

- [x] 保留已验收 Jog V2.1 字节，新增独立 0.24s 起步与 0.28s 左/右脚制动资源。
- [x] 接入无武器 Mission 表现层；制动冻结 Jog，相位不因转向重新启动，沿用 0.08 / 0.035 速度 hysteresis。
- [x] 按速度方向、朝向误差与角速度叠加最大 7° Turn Lean，头/胸/胯轻微先后响应。
- [x] 该阶段默认 A；提供仅运行时启用的 B（目标完整周期 0.50s），主循环与 Gameplay Speed 保留。后续默认与曲线选择见下方 V2.2/C。
- [x] 完成夏知遥无武器、正式 Camera/HUD 的约 20.35 秒连续 A/B 视频；含起步、直跑、90°、双向转弯、180°、制动及 Idle，正常视野与连续帧检查已完成。
- [x] 完整 build 前置测试、独立导出、12 组独立启动及包内资源检查完成；专项源码/内嵌包各 26 项通过。规范 EXE 解除占用后已同步验证包，另保留本阶段固定副本。
- [x] 用户确认当前无武器 Locomotion 已完成，选择 B 的较慢节奏方向；高抬腿问题转入 V2.2/C 修整。

## 2026-09-13 ENM_001 Phase 2A-0B-1 Final Locomotion

- [x] 完成感染者 Idle 轻微 polish 与 Chase 上半身差异化；保持 Rig、Skin、Weight 与 Walk 腿部不变。
- [x] 重新导出 Final Game View 预览、Walk/Chase 冻结对比与连续 Compare 视频。
- [x] Godot 4.7.2 AnimationLibrary / Loop Runtime Smoke 通过；Phase 2A-0B-1 完成。
- [ ] Attack / Hit / Death 与 Combat 接入留待后续阶段。

参数、视频和验证边界见 [Phase 2D 验收记录](design/combat.md)。本轮停止于上述视觉验收，不推进 Combat、Ready/Aim/Shoot、Sprint、Strafe、Backpedal、Foot IK、Root Motion 或模型/Rig 修改。

## 2026-09-12 Expedition HUD 2.0 正式 PNG 接入

- [x] 四个实际 ZIP 自动解压与 CRC / PNG / Alpha / 尺寸 / SHA-256 审计；54 张、48 个正式名称，六组差异明确选择 v2。
- [x] Time / Party / Objective / Action / Return / Search 六区替换为用户 PNG；继续读取既有 Controller / gameplay 数据。
- [x] Selection / Move / Search / Interact / Building / Vehicle / Loot / Danger / Bus / Return Zone / Group Target 接入真实状态；缺失 B 包按用户确认的现有 PNG 补位。
- [x] 原作核心 WASD / Ctrl / Space / 鼠标操作保留，技能数字键真实可用，四态与状态计数分离。
- [x] 固定建筑锚点、物理像素取整、防抖与屏幕边界；1920×1080、2560×1440 及两个小窗口原生截图。
- [x] 完整生产流程、搜索派遣 / 并行搜索 / 室内搜索、六技能与暂停设置回归；旧 controls_runtime 的失配在修改前 HUD 上同样复现。
- [x] 当前工作区 Windows 完整构建退出码 0，HUD 专项 314 项通过；12 组独立启动与内嵌资源验证通过，23:48:12 完成交付包。

具体文件、替代资源、测试范围和五组截图见 [HUD 2.0 接入报告](design/expedition.md)。本阶段结束后停止，不进入地图 Toon Shader / Anime Visual Pass 或新增玩法。

## 2026-09-13 Expedition HUD 2.0.1 Visual Polish

- [x] 保留 48 张原 PNG 与既有 HUD 架构；集中设置 Scale、边框强度、Alpha 和动画时间。
- [x] Time / Party / Objective / Action / Return 分别缩至 0.78 / 0.95 / 0.85 / 0.90 / 0.85；头像实际大小保留，任务列表按内容收紧。
- [x] Interaction 224×64 Compact 与 304×206 Search、0.18 秒展开 / 收起；Active 改低亮描边与小菱形。
- [x] 世界 Marker 压光；Move 生命周期 0.63 秒；Search 9 秒慢旋转；Return Zone 仅视觉缩至 0.68，默认 / 归航 Alpha 0.45 / 0.70。
- [x] 原生专项 331 项、既有外出视觉 91 项、六技能原生 80 项通过；194 个受保护文件哈希不变。
- [x] 八组要求截图与同机位 A/B 基线完成，交互对比与九项报告已落盘。
- [x] Windows 完整构建退出码 0；最终 Polish 331 项、12 组独立启动、内嵌包资源检查通过，00:24:30 完成验证。

文件、视觉边界和截图见 [2.0.1 Visual Polish Report](design/expedition.md)。不继续 Anime Visual Pass。

## 2026-09-13 Mission Jog V2.2 / Cadence C

- [x] 保留 V2.1、Cadence A/B 与历史视频；新增独立 V2.2 Swing 曲线及 C，当前无武器 Mission 默认 C。
- [x] 前方脚高由约 0.270m 降到 0.152m，后方 Heel Recovery 高点约 0.220m；大腿前摆峰值由约 84° 降到 52°。
- [x] 身体轨道、Contact / Compression / Push Off 姿态保留；Start 只对齐最后 48ms 的腿部终点，Stop 与 Turn 实现保留。
- [x] C 周期约 0.51s，30 / 60 / 144fps 相位检查通过；不修改 Gameplay Speed、角色模型或移动实现。
- [x] 夏知遥无武器、正式 Mission/HUD/Camera、同路线的 B/C 两段 1600×900 / 60fps / 20.35s 视频已完成，包含 5s 连续侧向 Jog；1220 个位移/速度采样完全相同。
- [x] Windows 完整构建退出码 0，12 组独立启动通过；包内 V2.2 1265 项和旧 Phase 2D 26 项通过，规范 EXE 已更新。
- [x] 用户在 Phase 2E 任务中明确验收 V2.2/C、Start/Stop 与 Turn Lean；腿部从此锁定。

参数、文件和验证结果见 [V2.2 / Cadence C 验收记录](design/combat.md)。后续授权仅为下方 Phase 2E 上半身优化。

## 2026-09-13 Phase 2E：Unarmed Arm Swing V2 / Combat Jog V2

- [x] 整文件哈希锁定 V2.2、Start/Stop；Cadence C、Turn 核心、Gameplay Speed 与模型/Rig 保留。
- [x] 公共六轨手臂覆盖，紧凑上臂、弯肘、前臂滞后与微弱手腕反馈；夏知遥/苏晚星共用。
- [x] long_gun 共用 V2.2/C；Ready/Aim/Shoot 分权重反馈，手臂解算吸收躯干运动，保留正式 Grip、MuzzlePoint 与攻击。
- [x] 新资产/几何专项 267 项、双角色状态专项 10108 项通过；9 段正式 Mission 视频完成，两角色各 10 次真实移动攻击与 OneShot/Flash 一一对应。
- [ ] Windows 稳定玩法快照全量构建与独立包验证。
- [ ] 用户正式视觉验收；到此停止，不扩展其他动作或修改模型。

设计、25 项交付内容、全部视频和共享工作区构建边界见 [Phase 2E 报告](design/combat.md)。同期 AI/营地任务文件保留，冻结构建只叠加本轮动画与起点玩法。

## 2026-09-13 Phase 2A-Rebuild：ENM_001 新版 A-Pose 资产接管

- [x] 以用户提供的 `Meshy_AI_ENM_001_infected_basi_0913093331_texture.glb` 作为唯一正式源，记录 SHA-256、网格规格、A-pose、轴向与比例。
- [x] 旧静态源移入 `assets/characters/infected_basic_a/legacy/`；正式场景路径保持不变但已替换为新 GLB，Godot import 已强制重导。
- [x] 基于新源重建 BH_Humanoid_Rig_v1 / 23 骨架、Skin、权重及 Rig QA 派生物。
- [x] 重新生成 Zombie_Idle / Zombie_Walk / Zombie_Chase，并通过 Godot Skeleton3D、Skin、材质、比例、接地与循环检查。
- [ ] 用户视觉验收与 MP4 视频导出；本轮未扩展 Attack / Hit / Death。

交付报告见 [ENM_001 New A-Pose Asset Rebuild Report](design/enemies.md)。

## 2026-09-13 ENM_001 Phase 2A-0B-1 Runtime Integration Gate

- [x] 保留现有 Zombie AI 状态机，仅统一接入 Idle / Wander / Investigate / Chase 动画映射。
- [x] 新增轻量 `InfectedAnimationController`：0.15s 状态 Blend、按水平速度有限 Playback Scaling、每只敌人 0..0.9s 相位偏移与 ±5% 播放变化。
- [x] 使用生产 Mission / EncounterDirector 种群验证 26 只 ENM_001 的真实感知、噪音 Investigate、Chase 与 Runtime 引用；专项 0 failures。
- [ ] 完整 UI 驱动 Expedition 自动流程仍有既有 timeout，暂不宣称端到端自动 PASS；Attack / Hit / Death 留待 Phase 2A-0B-2。

交付报告见 [ENM_001 Runtime Integration Gate Report](ENM_001_PHASE_2A_0B_1_RUNTIME_INTEGRATION_GATE_REPORT.md)。

## 2026-09-13 HUD 2.0.1 参考图排版修整

- [x] 对照四组参考图，修整归航、资源 / 暂停 / 查看全部、动作栏、标题 / 队伍信息。
- [x] 原 PNG 保留，通过运行时取样修正透明留边；头像、HP、弹药与跟随文字提高可读性。
- [x] 动作 / 归航键位移到框体下方；延续 X / F / 1 / E / R，按用户确认增加 L 定位。
- [x] 四种窗口尺寸、原生专项 361 项、六技能 80 项通过；14 个前后相机检查点一致。HUD 完成时 260 个保护文件哈希不变，后续构建期间的外部动画改动单独记录。
- [x] 四张局部与 17 张完整原生截图、前后对比页已完成。
- [x] Windows 构建前置检查通过；并行新增资产导致的首包缺漏已通过固定快照重新导入 / 导出修复。HUD 复跑 361 项、12 组独立启动及 4 组包内检查通过，01:35:36 完成交付包。

改动与截图见 [参考图排版修整报告](design/ui-art-direction.md)。本轮仅推进上述 HUD 修整，不进入 Anime Visual Pass。


## 2026-09-13 CAMP Survivor Ambient Behavior V1

- [x] 新增 POI 驱动的低频营地生活行为状态机。
- [x] 通过 CampActor 薄接口移动，出发时切换 DEPARTURE_OVERRIDE。
- [ ] 等待视觉审核；不推进 Ambient AI 第二版或新玩法。

证据见 [CAMP Survivor Ambient Behavior V1 报告](CAMP_SURVIVOR_AMBIENT_BEHAVIOR_V1_REPORT.md)。

## 2026-09-13 CAMP Core Props Integration Pass 01

### Placement Polish Pass 01B

- [x] 完成四个正式 Prop 最终摆放清理与 HUD 验收截图修复。
- [x] 使用真实 2 人 Shelter 流程生成 A–F 原生 Godot 截图；四个 Prop 各 1 个实例。
- [ ] 等待视觉审核，保持核心 Prop 视觉冻结。

证据见 [CAMP Core Props Placement Polish 01B](design/camp.md)。

### Placement Correction Pass 01A

- [x] 完成工作台朝向、发电机可见性、货架靠设施、公告板前移与 2 人截图回归。
- [ ] 等待视觉审核。

证据见 [CAMP Core Props Placement Correction Pass 01A](CAMP_CORE_PROPS_PLACEMENT_CORRECTION_PASS_01A.md)。

- [x] 接入 CAMP_PROP_001 工作台、002 货架、003 公告板、004 发电机 Wrapper；停用对应程序化功能性替身。
- [x] 完成尺寸校正、简单碰撞、材质压低、功能区摆放与原生 Godot A–F 截图。
- [ ] 用户完成视觉审核后再决定下一批 Meshy 资产；本轮不自动扩展范围。

证据见 [CAMP Core Props Integration Pass 01 报告](design/camp.md)。

## 2026-09-13 CAMP HUD 2.0

- [x] 三批 44 张源 PNG 完整审计；保留原件，生成不降采样的 runtime 副本与 050 纸框切片。
- [x] 按视觉母版接入品牌、营地信息、时间/资源、动态角色栏与详情、快捷能力、装备槽及今日行动；保留真实 Gameplay 入口。
- [x] 统一 CampTextureButton / NinePatch / 字体 / 状态；原生字形 Alpha 量测 0–1.5 px，满足 1920×1080 的 ≤2 px 标准。
- [x] A–H、1920×1080 / 2560×1440 / 1366×768 原生截图与参考图并排页面完成，HUD 专项 68 项通过。
- [ ] Windows 完整构建及最终独立包启动验证收尾。
- [ ] 用户审核 CAMP HUD 2.0 实机相似度与文字居中。

文件、数据缺口、原生证据与并行工作区变化边界见 [CAMP HUD 2.0 接入报告](design/ui-art-direction.md)。本轮到 HUD 审核停止，不推进营地 AI、动画、环境装饰、夜间营地或新玩法。

## 2026-09-13 Expedition HUD Phase 2

- [x] 41 张 clean PNG 原字节核验，36 张接入、5 张保留；Phase 1 框体与 Gameplay 规则不变。
- [x] Phase 2 原生专项 243 项通过，1080p / 1440p 与返回巴士真实三态截图完成。
- [x] 修复导出包的导入纹理查询；Windows 验收包通过六组独立启动与 81 项包内检查。
- [ ] 完整 build 门禁：两个 Camp UI 断言仍失败，未与 Phase 2 专项混为通过。
- [ ] 等待用户视觉验收；不自动进入下一阶段。

证据见 [Expedition HUD Phase 2 Report](EXPEDITION_HUD_PHASE2_REPORT.md)。

## 2026-09-14 Expedition HUD Phase 2.1 Visual Polish

- [x] 仅调整 Expedition HUD 的图标尺寸、间距、HP 条、列表行高、搜索卡层次、Minimap marker 与 Return Bus 内部排布；未新增或替换 PNG。
- [x] 原生专项 248 项通过，新增血条边界、搜索卡按钮高度与层级检查；1080p / 1440p 及返回巴士三态截图完成。
- [x] Windows Release 重新导出，完整构建状态仍单独保留两个既有 Camp UI 断言失败。
- [ ] 等待用户视觉验收；不自动进入下一阶段。

证据见 [Expedition HUD Phase 2.1 Visual Polish Report](EXPEDITION_HUD_PHASE2_1_REPORT.md)。

## 2026-09-14 CAMP Environment Polish Pass 02

- [x] 草色层次、铺装轻使用痕迹与边缘过渡、外围植被群和树线、统一矮栏、维修棚结构、入口与生活用品已落地。
- [x] 正式相机七张原生截图；截图专项 11 项、Ambient 导航与原生出发 12 项通过；碰撞/相机与受保护系统核对不变。
- [x] 实际尝试 Windows build，并单独导出正式路径 Release EXE；脱离工程目录的营地、今日行动、外出原生启动通过。
- [ ] 完整 build 门禁仍有两条既有 Camp UI 断言失败，详见报告，未越界修改 HUD。
- [ ] 等待用户审核白天营地视觉效果；不自动提交或进入下一轮。

证据、性能限制与独立启动记录见 [CAMP Environment Polish Pass 02 Report](CAMP_ENVIRONMENT_POLISH_PASS_02_REPORT.md)。

## 2026-09-14 CAMP Environment Composition Pass 02B

- [x] 围栏改为蓝灰柱与旧木宽横梁；保持 6 树 / 21 Bush，重组树根植被群；调整生活区不对称铺装、右侧后勤地面与已有用品关系。
- [x] 同正式 Camera / Size、白天、真实两人 Before / After 六图与并排对比完成。
- [x] 导航、90 秒原生 Ambient、12 项原生出发、71 项 Camp HUD 2 专项通过；相机/碰撞及 68 个受保护文件核对不变。
- [x] 实际执行 Windows build；单独 Release 导出并通过营地、今日行动、外出三个独立原生启动。
- [ ] 完整 build 仍被两条既有 Camp UI 断言阻断，未修改 HUD；未将专项通过视为全门禁通过。
- [ ] 等待用户视觉审核，停止于 02B，不自动提交或开始下一阶段。

文件、数量、性能、运行证据及限制见 [CAMP Composition 02B Report](CAMP_ENVIRONMENT_COMPOSITION_PASS_02B_REPORT.md)。

## 2026-09-14 Expedition HUD Final Match

- [x] 按用户 Target 接入原字节 Logo / Minimap Frame；时间区横排、资源与队伍放大、去除行动蓝托盘、归航 E 下置、Compact 三行信息。
- [x] 保留真实狂怒/疾行专精差异；小地图读取现有道路、街区和发现数据，玩法与旧 PNG 不变。
- [x] 原生 Final Match 257 项、包内 137 项、六组独立 EXE 启动通过；Current / Target / Final 及 1080p / 1440p 截图完成。
- [x] Windows 验收包单独导出；完整 build 仍有两个既有 Camp UI 断言失败，未宣称全仓通过。
- [ ] 等待用户视觉验收，不进入下一阶段。

证据见 [Expedition HUD Final Match Report](EXPEDITION_HUD_FINAL_MATCH_REPORT.md)。

## 2026-09-15 Expedition HUD Final Fix

- [x] Logo 缩小、时间卡连续组合、HP 轻量化、编号/Discovery/Action/Return Bus 微调；Minimap 仅稳定检查。
- [x] Final Fix 原生 257 项、EXE 独立启动 6/6、Windows Release 导出通过。
- [ ] 完整 build 仍有既有 Camp UI 两项断言；等待用户冻结验收。

证据见 [Expedition HUD Final Fix Report](EXPEDITION_HUD_FINAL_FIX_REPORT.md)。

- 2026-09-15: Expedition HUD interaction/alignment fix implemented; native phase2 257/257. Baked survivor-card empty circle remains pending separate asset authorization; freeze not approved.

- 2026-09-15 v2: removed persistent marker fallback, blocked world zoom over HUD, stabilized hover, aligned survivor badge; native Expedition HUD 257/257.

- 2026-09-15: Expedition HUD clarity/minimal UI pass implemented; world overlays reduced, action state geometry unified, party badge runtime aligned; native HUD regression 257/257. Manual visual acceptance pending.

- 2026-09-16: Expedition second interaction fix completed; movement releases stale searches, legacy marker hidden, action shader/tween interaction added, top day/time tightened; native HUD 257/257 and export passed.

- 2026-09-16: Final search-state/badge pass completed; SearchCard now derives live task phase, cancel/move clears task and UI, NumberBadgeRoot fixed; native Expedition 261/261.

## 2026-09-16：Medium Town V1 Phase A Rev.2（部分实现，待视觉验收）

- [x] Seed 驱动的 PROFILE_A_MAIN_STREET、PROFILE_B_OFFSET_GRID、PROFILE_C_LOOP 路网与 Block/Building/Arrival/POI 生成链路。
- [ ] Rev.2 全 Profile 结构验收：旧测试含占位拓扑指标，不能据此宣称连通性、Loop 和路径距离通过；MAIN_STREET 已由下述 A.1 真实几何检查替代。
- [x] Rev.2 运行时 Town 场景与 6 张截图已生成；用户判定其街区组织未达到视觉要求，进入 A.1。
- [ ] 人工视觉验收。
- [ ] 完整 Windows build；当前被既有 CAMP UI runtime 检查失败阻断。

## 2026-09-16：Medium Town Phase A.1 MAIN_STREET 街区组织

- [x] 道路围合边界生成 Street Frontage、Parcel、沿街建筑排、街角 L 型、后院与服务院区；复用唯一 Catalog 和既有 Runtime Scene。
- [x] 原范围 260×310m 内生成 12 Block、47 Parcel、47 栋；只在 MAIN_STREET QA 实例内纠正新增建筑批次可见正面与 FrontMarker 的反向问题。
- [x] 30 个 Seed 样本、92,909 项几何与道路断言通过；Godot Import、原生截图与 Project Smoke 通过。
- [x] Seed 4101 的 Overview、商业街、住宅街 3 张 PNG 完成，Runtime 使用正式 Expedition 正交相机参数。
- [ ] Windows build：本轮实际执行，因 Expedition HUD 的搜索状态断言失败停止，未更新 EXE。
- [ ] `Visual QA: PENDING HUMAN REVIEW`。此处停止，不扩展 OFFSET_GRID / LOOP、正式 Expedition 或 Phase B。

本轮实现、截图和构建限制见 [MAIN_STREET Urban Fabric 报告](MEDIUM_TOWN_URBAN_FABRIC_REPORT.md)。

## 2026-09-17：Medium Town V1 Phase A.2 MAIN_STREET 构图

- [x] 以一条主街、四条错位折弯支路和局部连接替代行列骨架；位置与尺寸由 Seed 生成。
- [x] 13 个真实多边形街区、49 个 Parcel / Runtime Building；7 类形状，矩形占 23.1%，保留临街与朝向约束。
- [x] 30 组生成检查共 113,425 项通过；建筑重叠、道路侵入为 0，Import、原生运行和 Smoke 通过。
- [x] Seed 4101 的 Overview、商业街、住宅支路、尽头服务区四张 PNG；Debug Overlay OFF，Runtime 复用正式 Expedition 相机。
- [x] `Medium Town V1 Phase A.2: TECHNICALLY COMPLETE`，范围仅 MAIN_STREET 独立测试场景。
- [ ] Windows build 实际执行后仍被既有 Expedition HUD 搜索状态断言阻断，未更新 EXE。
- [ ] `Visual QA: PENDING HUMAN REVIEW`；停止于 A.2，不扩展其他 Profile 或 Phase B。

实现、拓扑统计、截图和验证见 [MAIN_STREET Composition 报告](MEDIUM_TOWN_MAIN_STREET_COMPOSITION_REPORT.md)。

## 2026-09-17：Medium Town V1 Blueprint Alignment

- [x] 在既有 MAIN_STREET 生成链上增加 Land Use；集中商业核心、两片差异化住宅、混合过渡、边缘服务区与两个开放空间。
- [x] 四个合法 Arrival 候选、远端 POI、三条无回头的实际道路探索路线；Seed 改变布局尺寸、选点及整体方位。
- [x] 首轮 30 组生成及真实模型几何检查通过；区域地表、Planning Overlay 和五视角原生截图已实现。
- [x] 最终 Import、Smoke 与 144,029 项断言通过；五张 1920×1080 PNG、四个 Overlay 开关与原生无错误运行完成。
- [x] `Medium Town V1 Blueprint Alignment: TECHNICALLY COMPLETE`，仅指独立 MAIN_STREET 测试场景。
- [x] 用户已确认当前结构验收通过；`STRUCTURE QA: PASS`，Blueprint Alignment 正式收口。
- [ ] Windows build 已实际执行，仍被既有 Expedition HUD 搜索状态断言阻断，未更新 EXE。
- [ ] `Environment Visual Completion: PENDING`；结构验收不代表 Medium Town V1 或环境视觉已完成。

```text
Medium Town V1 Blueprint Alignment:
STRUCTURE ACCEPTED

Town Skeleton / Land Use / Route Structure:
FROZEN FOR ENVIRONMENT PASS

Environment Visual Completion:
PENDING
```

冻结范围：Seed / Grammar、Road Graph、Land Use Assignment、COMMERCIAL_CORE、RESIDENTIAL_A、RESIDENTIAL_B、MIXED_TRANSITION、INDUSTRIAL_SERVICE、OPEN_SPACE、Arrival Candidates、Mission POI、Multi-route Exploration、Street Frontage、Parcel、Building Facing、Building Pool。后续 Environment / Props / Vehicle / Vegetation Pass 默认不得重构这些系统；如确需修改 Road Graph / Land Use / Parcel 结构，必须单独提出并等待人工确认。

保留 `test-output/medium-town-blueprint/` 内现有五张 PNG、`validation.json`、`generated-town.txt`、`capture-report.json` 及原验证日志，不删除、不覆盖。后续阶段使用独立输出路径。Seed 4101 的 16 Blocks、55 Buildings、4 Arrival Candidates、3 Exploration Routes、331.453 m POI Road Distance 是当前基准证据，不是未来必须锁死的硬数量。

已知问题：当前仍是环境白盒 / 低完成度视觉；大面积 Green Buffer 需要环境填充赋予视觉意义；Props / Vehicles / Vegetation / Street Furniture 尚未正式分布；Formal Expedition 尚未接入；Character Navigation Playtest 尚未完成；Windows build 受既有 Expedition HUD 测试失败影响，与本轮 Town Blueprint 无关。本次只做文档、状态、基线与阶段边界收口，不修复上述问题，不修改地图生成逻辑。

实现、占用率口径、五张截图、构建失败与人工验收边界见 [Blueprint Alignment 报告](MEDIUM_TOWN_BLUEPRINT_ALIGNMENT_REPORT.md)。

## Medium Town V1 — Environment & Street Life Pass

状态：2026-09-17，Environment & Street Life Pass M00 技术交付完成，视觉待人工审核。

- [x] 建立独立、Seed 确定性的环境层，复用现有 Catalog 八项环境资产；支持 14 种语义 Slot。
- [x] 按 Land Use / Ground Use / Road Edge / Parcel 分布，保护建筑入口、步行带、Arrival、POI 与三条探索路线。
- [x] Seed 4101 第一轮填充 595 个实例；五张无 Overlay 原生 PNG、Before / After、实例统计及 Asset Gap Audit 已输出到独立 M00 目录。
- [x] 94 个冻结文件哈希不变；完整 Town 快照一致；八个 Seed / 四种朝向 5,546,594 项检查零失败；Import / Smoke / M00 Native 通过。
- [ ] 人工查看截图，判断 Open Space / Green Buffer / Yard / Parking / Street 的视觉表现，以及下一步值得生产或复用的资产。
- [ ] 全项目 Windows build：本次被既有 Camp UI 测试阻断，未交付新的独立 exe。

本轮未新增模型、Catalog 或修改冻结结构；仍使用同一独立测试场景。几何净空验证不代替角色导航实玩，尚未接入正式 Expedition。五张截图、按 Land Use 统计、库存核对后的缺口与构建失败详情见 [M00 报告](MEDIUM_TOWN_ENVIRONMENT_M00_REPORT.md)。停止等待人工审核，不自动进入 M01、资产生产、Zombie / Loot / Fog / Blue Hour 或正式 Expedition。

```text
Medium Town V1 Blueprint Alignment:
CLOSED

Town Structure:
FROZEN

Environment & Street Life Pass M00:
TECHNICALLY COMPLETE

Visual QA:
PENDING HUMAN REVIEW
```

## 2026-09-17：Environment Asset Reuse Audit

- [x] 审计 18 个现有模型 / 组合候选，测量 Godot 实际几何、尺寸、材质、贴图、碰撞、朝向、wrapper 与 Catalog 状态。
- [x] 输出 54 张 Front / 3/4 / 1.70m Scale Reference 原图及 9 张总览图；Import、独立实例化、取景与像素差检查通过。
- [x] 分类：1 个 REUSE_READY（既有工业 Chainlink）、11 个 REUSE_WITH_MINOR_FIX、1 个 REUSE_WITH_REWORK、5 个 REJECT；另外记录专用停车牌与独立店外展示牌 2 类 MISSING。
- [x] 输出最小 Runtime Integration Plan；P0 四项优先复用，住宅开放入口由已有低栏两段留空实现。
- [ ] 人工审核 [Environment Asset Reuse Audit](ENVIRONMENT_ASSET_REUSE_AUDIT.md) 与 QA 图，决定是否批准后续轻量接入。

`Environment Asset Reuse Audit: COMPLETE`。本轮不新增模型、不注册 Catalog、不修改 M00 Environment Placement Rules 或冻结 Town、不执行 Runtime Integration Batch / M01 / Meshy Production / Props Distribution。审计完成不替代 M00 视觉人工验收。

## 2026-09-17：Environment & Street Life M01

用户已提供 [旧环境资产复用白名单](MEDIUM_TOWN_ENVIRONMENT_REUSE_SELECTION.md) 并要求继续，进入 M01。白名单覆盖旧审计的美术取舍建议，原审计测量保留。

- [x] 补齐 11 项既有资产的 World wrapper / Resource / Catalog；不新增源模型或贴图，不把特殊 / Gameplay 道具放入随机装饰池。
- [x] 实现白名单 Land Use 分布、公园长椅、1～3 托盘货物组、低频木箱、住宅低栏 / 开放入口、道路方向牌与建筑侧售货节点。
- [x] Seed 4101 保留 595 个 M00 实例，新增 124 个；八个种子 / 四种朝向验证通过，冻结 Town 与源资产保持不变。
- [x] 输出 M01 原生 Town 截图、Before/After 和 Asset Gap Final Review，见 [M01 报告](MEDIUM_TOWN_ENVIRONMENT_M01_REPORT.md)。
- [ ] 人工审核 M01 风格、密度、可见性与缺口；所有新模型候选仍为 PENDING M01 VISUAL QA。
- [ ] Windows build：已实际执行，被既有 Camp UI member_buttons / 左侧能力区测试阻断，未交付更新 EXE；全局 World 资产测试另有四项旧 2048 贴图尺寸断言失败。

M01 分布与专项验证完成不等于全项目发布通过，也不替代角色导航实玩或正式 Expedition 集成。本轮停止在人工视觉审核，不自动进入 Meshy Production。

## 2026-09-18：Environment M01.1 Placement & Material Polish

- [x] 新增独立 M01.1 调整阶段：工业装卸组、住宅停车地面、公园休息节点与灌木疏减、Bench / Pallet / Wood Crate 实例材质覆盖、售货机合法侧面微调。
- [x] Seed 4101：719 个 M01 基线实例中 505 个不变、100 个移动或转向、114 株灌木移除，最终 605 个；原始 M00/M01 可完整复现，每项变化有记录。
- [x] 20 个货物节点、23 辆住宅车全部有地面（8 条 Driveway、15 块 Parking Pad）、15 个休息节点；未新增源模型或贴图。
- [x] 8 Seed / 4 朝向、5,828,254 项检查零失败，590 个冻结文件哈希不变；Import 与原生截图通过，最终 Runtime Error = 0。
- [x] 12 张原生截图及 6 张同机位对比图输出到独立 M01.1 目录，未覆盖 Blueprint/M00/M01 证据；详见 [M01.1 报告](MEDIUM_TOWN_ENVIRONMENT_POLISH_REPORT.md)。
- [ ] Visual QA: PENDING HUMAN REVIEW；独立停车垫、商业售货机遮挡与整体构图仍需人工判断。
- [ ] Windows build：已执行，仍被既有 Camp UI `member_buttons` / 左侧能力区测试阻断，未交付新 EXE。

M01.1 专项状态为 TECHNICALLY COMPLETE；全项目构建不通过不隐瞒为发布完成。本轮停止，不进入 M02、新资产生产或正式 Expedition。

## 2026-09-18：Environment Asset Batch 01 Runtime Integration

- [x] 接入用户补发的带贴图 Utility Pole、Parking Sign、Storefront A-Frame Sign、Bicycle；Wrapper Root identity、Scale=1、简单碰撞、GroundAnchor / FrontMarker 与专用 Marker 完整。
- [x] 四件注册现有 World Catalog / Definition，searchable=false、spawn_weight=0；用途标签仅登记，不进入生成器。
- [x] 原生171项与Headless110项零失败，20张原图与四模型Contact Sheet已生成；最终Import通过，本批运行日志无缺失资源、Invalid UID或Runtime Error。
- [x] 62个冻结代码/建筑文件、51个历史证据文件哈希不变，Town与M00/M01/M01.1完整快照一致；报告见 [四模型Runtime接入与QA](ENVIRONMENT_STREET_ASSET_REPORT.md)。
- [x] 2026-09-18 用户确认四件人工 Asset QA: PASS，并授权 M02。自行车实长169.84cm，保留源比例；其他尺寸差异和细部检查见报告。
- [ ] 全项目Windows build仍被既有Camp UI测试阻断，未交付新EXE；全Catalog回归另有4项既有建筑贴图尺寸断言失败。

Batch 01 专项状态 TECHNICALLY COMPLETE，Asset QA: PASS。接入阶段未执行 Town Placement；后续授权的 M02 状态见下节。

## 2026-09-18：Environment M02 Targeted Street Props Placement

- [x] 独立 M02 Pass 在 M01.1 后追加四种已通过人工 QA 的资产，使用独立确定性随机流；候选、拒绝原因、用途、锚点与未来连线关系均可追踪。
- [x] Seed 4101：原 605 个实例不变，新增 31 个（14 电线杆、3 停车牌、3 A 字牌、11 自行车），合计 636 个。合法位置优先，不按目标数量硬刷。
- [x] 8 Seed / 4 朝向、304,563 项专项检查零失败；536 个 Town / 资产 / 历史证据文件哈希不变。保护道路、步行带、入口、车道、停车面、任务点与探索路线。
- [x] Seed 4101 的 12 张原生截图、3 张同机位前后对比图已生成，Runtime Error = 0；统计、间距缺口和证据见 [M02 报告](MEDIUM_TOWN_TARGETED_PROPS_REPORT.md)。
- [x] 2026-09-19 用户确认 M02 Human Visual QA: PASS；电线杆节奏与空段、商铺前角 A 字牌、自行车依附关系及整体留白通过人工截图验收。
- [ ] Windows build 已执行，仍被既有 Camp UI `member_buttons` 缺失 / 左侧能力区断言阻断；未导出本轮新 EXE。

M02 Placement: TECHNICALLY COMPLETE；Human Visual QA: PASS。Town Structure: FROZEN。M00 / M01 / M01.1 保持冻结；M02 实例继续冻结。

## 2026-09-19：Environment M03 Roadside Infrastructure & Visual Completion

- [x] 新增独立 M03 只读视觉层：消费 M02 `future_wire_links` 和既有 WireMarker，生成 3 根并行轻量悬垂线；仅合法 22–42m pair，未跨长空段、未新增 Pole、无碰撞与交互。
- [x] 道路 / 人行道使用独立实例材质：道路增加低频灰蓝差异，Sidewalk 降低纯白感，增加道路外侧 18cm curb strip；道路几何范围不变，共享材质不改写。
- [x] 停车区生成 2 个合法 P 地面标识，商业入口生成 4 个小面积铺装 accent；均为程序几何，无新模型、无建筑碰撞修改。
- [x] 8 Seed / 4 朝向、55,967 项 M03 专项检查零失败；622 个冻结文件哈希不变，Town、M02 数据 / 实例、M01.1 快照保持可复现；14 张原生截图和 4 张对比图，Runtime Error = 0。详见 [M03 报告](MEDIUM_TOWN_ROADSIDE_VISUAL_REPORT.md)。
- [ ] Visual QA: PENDING HUMAN REVIEW。电线粗细 / 悬垂 / 树冠关系、道路层次、P 标识和商业入口铺装等待人工截图验收。
- [ ] Windows build 已实际执行，既有 Camp UI 的 `member_buttons` 缺失及左侧能力区断言阻断；未导出本轮新 EXE。

M03: TECHNICALLY COMPLETE；Town Structure: FROZEN。停止于人工视觉审核，不进入 M03.1 / M04 / 正式 Expedition。

## 2026-09-18：夏知遥 Locomotion Gameplay Integration

- [x] Expedition 无武器模式接入夏知遥正式 Idle / Walking / Running；按实际水平速度选择状态并匹配 1.262257 / 2.306552 m/s 参考倍率。
- [x] 102 项控制器隔离回归通过；装备武器、Camp、苏晚星和原有 Combat Jog 管线保持原所有权。
- [x] 真实 Mission 物理 Harness 记录 Idle、短距、长距、45° / 90° 转向和停止；视频与数据见 [Gameplay 报告](XIA_ZHIYAO_LOCOMOTION_GAMEPLAY.md)。
- [ ] Gameplay 视频视觉验收待用户确认；本轮不调整移动速度，不制作 Turn / Start / Stop 或苏晚星动作。

## 2026-09-19：夏知遥 Gameplay Movement Speed A/B/C

- [x] 在同一 Expedition 路线测试 A=2.6、B=2.8、C=3.0 m/s；未修改正式默认速度、动作、Retarget 或角色资源。
- [x] 三档实际 Run 速度分别为 2.59998 / 2.80003 / 2.99995 m/s，倍率 1.12722 / 1.21394 / 1.30062，cadence 202.90 / 218.51 / 234.11 spm。
- [x] 每档生成正常 Gameplay 与角色近景视频及 JSON 数据，见 [Gameplay 报告](XIA_ZHIYAO_LOCOMOTION_GAMEPLAY.md)。
- [ ] 不选择最终速度，等待三档视频视觉验收；路线目标未在测试上限内全部收敛，报告同时提供固定 8m 可比时间换算。

## 2026-09-19：Survivor 165cm Unified Runtime Baseline Audit

- [x] 只读审计新夏知遥 / 苏晚星 GLB：两者均为约 1.65m 单 Mesh、无 Skeleton、无 Skin、无 Animation。
- [x] 与已通过的 Standard Survivor / `BH_Humanoid_Rig_v1` 基准对比；明确新模型当前不能直接进入 Runtime 或共享 Locomotion。
- [x] 判定 165cm Character Envelope + 统一 Rig + 公共 Locomotion 作为未来 8 人规则技术可行，但必须先完成独立 Rig 绑定、蒙皮和静态契约验收。
- [ ] 未替换正式角色、未修改动画 / Gameplay / 武器系统；等待下一步绑定授权。

## 2026-09-19：Xia + Su 165cm Unified Rig Binding V1

- [x] 两个新 165cm Mesh 在隔离目录分别绑定到冻结的 `BH_Humanoid_Rig_v1` canonical 23-bone skeleton；没有修改正式角色路径或 Rig v1 定义。
- [x] Skin、Rest endpoints、骨长、Scale、地面最低点、静态抬臂 / 屈膝变形和 0 animation clips 检查通过；候选与 QA 见 [Unified Rig Binding 报告](SURVIVOR_165CM_UNIFIED_RIG_BINDING_REPORT.md)。
- [x] 建立与现有运行时一致的 RightHand / LeftHand / weapon MuzzlePoint socket contract；没有增加静态重复挂点、武器动作或 IK。
- [x] 后续已完成 canonical 公共 Locomotion 转换与双角色直驱；发现 A-Pose Mesh / T-Rest Bind 不一致并进行隔离修正，见 [T-Pose Bind 报告](UNIFIED_SURVIVOR_T_POSE_BIND_REPORT.md)。
- [x] T-Pose 网格、冻结 23 骨合同、40 张静态 QA 与 24 段公共动作视频已输出；公共动作与骨架不变，Windows 独立验收程序启动通过。
- [x] 用户后续确认 canonical T-Pose Bind / Shared Skin Contract / 两角色候选 PASS，覆盖本阶段的视觉待验收状态；未生成角色专属动作。
- [x] 后续 Upper Body Skin Polish 已输出 Xia / Su Run upper-side、three-quarter 与 Idle Front 回归；仅重分配袖子权重，骨架、Mesh 和公共动作不变，独立 Windows 验收程序启动通过。
- [x] 用户后续确认[上半身 Weight 精修](SURVIVOR_UPPER_BODY_SKIN_POLISH_REPORT.md)候选 PASS，并授权提升至正式资源；本轮不再改 Skin。


## 2026-09-19：Mission Selection Runtime Style + Transition

- [x] 真实 Camp 后景与 0.46 遮罩、纸板分层、空白纸卡、独立 Briefing 纸面和统一空投显示名。
- [x] 删除页面姓名 Chip，保留 selected_party；打开 0.48s、返回 0.30s、选中切换 0.16s。
- [x] 专项原生流程 23 项通过；1600×900 / 1280×720 截图与原生打开→选择→返回录屏已生成。
- [ ] 正式 Windows 构建被既有 camp_ui_runtime 旧 member_buttons / HUD 断言阻塞；未更新 EXE。详情见 [页面交付报告](design/MISSION_SELECTION_RUNTIME_REPORT.md)。


## 2026-09-19：Mission Gameplay Closure Phase 0A

- [x] 三 Action 复用 TodayActionData，集中声明威胁、奖励、POI 意图；Mission 接受私有 Profile，最终 Loot 倍率与语义武器奖励由 fixture 验证。
- [x] 独立 Profile 消费接口 4117 项、Encounter Clock 7 项、Director 30 项通过；不作为正式地图闭环。
- [ ] Phase 0B — Medium Town Gameplay Integration TODO：导航、搜索点、敌人生成区域、实际压力与正式奖励结算待地图玩法接入。
- [x] 保持 MEDIUM_TOWN_V1 正式入口；未修改 maps/random、Town Adapter、地图布局、Camp、角色动作或 UI。详见 [Phase 0A 报告](MISSION_GAMEPLAY_CLOSURE_PHASE0.md)。

- Phase 0A 最终回归：Search Gameplay 72、Survivor Command 45、Search Card 157 均通过；Windows build 被既有 Camp member_buttons / HUD 断言阻塞，正式 EXE 未更新。


## 2026-09-19：Camp M08 Depart Action

- [x] 原字节接入四张 M08 PNG，替换黑色占位框；尺寸收尾为 300×86 三态按钮、46×46 图标、26/13px 动态“出发 / 前往今日行动”，右侧 16px、底部 30px。
- [x] 复用公共 StateButton 的 0.12s Cross Fade；无缩放、固定 HitArea，新增 `set_depart_enabled`，兼容既有 departure 锁定。
- [x] 保留 Entry 导航连接与 Mission Selection → 巴士 departure → Mission 流程；97 项原生检查零失败，86 个冻结文件哈希一致。
- [x] 四张原生 1600×900 截图已生成；实现与验证见 [M08 报告](CAMP_DEPART_ACTION_REPORT.md)。
- [x] 单独 Windows release 导出及独立 Headless / 原生 Camp 启动通过；完整 build 仍被旧 Camp `member_buttons` / 能力栏断言阻断，未标记全量通过。
- [ ] M08 功能与三态已通过用户验收；本轮尺寸视觉待验收。停在 M08，不进入 M09。


## 2026-09-19：Camp M09 Utility

- [x] 纯 Godot 实现 Esc 键帽与“返回主菜单”，150×30 点击区域、左侧 30px / 底部 20px；无 PNG 或大底板。
- [x] 复用 StateButton 0.12s 渐变，固定 HitArea、无缩放；鼠标与 Esc 沿用同一 show_main_menu 返回入口。
- [x] 原生专项 74 项零失败，三张 1600×900 截图已生成，M01～M08 和导航保持不变。详见 [M09 报告](CAMP_UTILITY_REPORT.md)。
- [ ] 等待 M09 视觉验收，不继续其他模块。


## 2026-09-20：Camp Menu Overlay

- [x] 右上角 M03「菜单」改为在当前 Camp 打开游戏内 Overlay；M09 `[ Esc ] 返回主菜单` 的视觉与常态行为保持不变。
- [x] Overlay 提供继续游戏、共享 Settings、既有 Main Menu 返回与既有 Quit 四个动作；不销毁或重建 Camp。
- [x] 全屏顶层遮罩、Camp 世界锁定与 HUD 禁用阻止输入穿透；Esc 打开时只关闭 Overlay，关闭后恢复原 Camp Esc 行为。
- [x] 原生 1600×900 专项 30 项、M09 87 项、Settings 14 项零失败，四张验收截图已生成。实现与验证见 [Camp Menu Overlay 报告](CAMP_MENU_OVERLAY_REPORT.md)。
- [x] Windows release 独立导出及 Headless / 原生隔离启动通过；完整 build 在本轮 30 项通过后仍被既有旧 `camp_ui_runtime.gd` 阻断，不标记全量通过。
- [ ] 等待 Overlay 视觉验收；停止，不继续修改其他 Camp HUD 模块。


## 2026-09-19：Xia + Su 165cm Production Replacement

- [x] 已验收 165cm / 约 100k tris / T-Pose Skin 候选逐字节提升到原正式 runtime GLB 路径；稳定 Blender 源可重新导出相同哈希。
- [x] 两角色原生 23 骨直接共享 public_idle / public_walking / public_running；无专属 Retarget、Locomotion IK 或新增高度补偿。
- [x] Expedition 数据使用 2.8m/s，实际约 2.79985m/s、Run 倍率 1.23004、221.41 steps/min；Camp 行为速度不变。恢复 Camp 选人到既有 HUD 与 Ground Ring 的同步。
- [x] canonical 合同 495、双角色四条 Gameplay 回归各 27、真实界面流程 28 检查通过；501 生产资源 Missing/UID/旧引用均为 0。Camp、Socket、武器与自动攻击专项通过。
- [x] Windows release 实际导出并独立启动 Menu / Camp / Mission Selection / Expedition / Weapons；嵌入包 14 检查通过。六段视频、Socket 截图和数据见[生产替换报告](SURVIVOR_PRODUCTION_INTEGRATION_REPORT.md)。
- [ ] 最终真实地表审计 FAIL：导航/Spawn Y=0.08，但 RoadNetwork Y=0.025；双角色稳定鞋底距道路约 57–61mm，Walk 所在开放地表约 152–157mm。撤回相对 actor 高度的接地 PASS，三项 Production 验收均 FAIL，需修复地表高度共同契约，禁止角色 Y Offset 掩盖。
- [ ] 清理已删 40 个旧专属文本资源；两份旧 source GLB 删除被自动审批 blocked by policy 拒绝，连同 .import 暂留，无生产引用且不打包。
- [ ] 总 build 测试未全绿：旧 Camp HUD / 新局 / 五日测试存在结构、过渡时机及搜索语义断言失败；直接导出成功不等于总套件通过。具体失败见报告。
- [ ] 等待本轮 Gameplay 视频视觉验收；不推进 Combat Jog / Armed / 其余 Survivor。

- Camp 最终小修：M09 透明键帽、白色描边；M03 菜单由静态 Control 修为 116×56 Button 并接入现有 menu_requested。原生专项 87 项通过，两张验收截图已生成，等待视觉确认。


## 2026-09-19：Expedition Ground Height Contract

- [x] 审计确认 E01 使用 AStarGrid2D，无 NavigationMesh；原 nearest/path/spawn 固定 Y=0.08，Actor 移动只更新 XZ。
- [x] 正式渲染地表登记 + 世界空间三角形索引作为唯一 Ground Query；路径、Spawn、POI、搜索 entry、Actor 与 Ground VFX 共用，未硬编码道路/开放区高度补丁。
- [x] Actor World Y 逐帧贴合实际地表，VisualRoot local Y=0。42 项 GLB/Rig/Skin/公共动画/速度/武器保护文件未变。
- [x] Xia / Su 各 83 项原生测试通过；道路/开放地表/人行道/入口静态鞋底误差约 1.5–4.1mm，Run 稳定支撑约 1.8–6.3mm，消除此前 57–157mm 的整体悬空。
- [x] Ground 单测 10 项、Search 四种子 1206 项通过；Windows 导出和双角色嵌入包地表回归通过。证据、视频和最终构建记录见[Ground Contract 报告](EXPEDITION_GROUND_CONTRACT_REPORT.md)。
- [x] Expedition Ground Height Contract / Xia Production Replacement / Su Production Replacement：本轮地面门禁 PASS，覆盖前轮地面合同 FAIL。
- [ ] E01 三人长途返回/后续路线仍有 9 项失败：原始 Git 导航和修正后在相同 XZ 位置停滞，已证明不是高度投影引入；本轮未重写队伍让行。不能宣称全仓回归全绿。
- [ ] 等待本轮视觉验收；旧资源删除审批阻塞仍按前轮报告保留，不在本轮继续清理或制作动作。


## Survivor Trait Foundation（2026-09-19）

已接入SUR_001/SUR_002：Definition → Trait Runtime → Search/Reward Hook，等级复用roster.level 1～5。资料以[用户数据表](SURVIVOR_DATA_TABLE.md)为准；推荐武器仅标签。Trait44、搜索111、Town13、原生Camp/任务选择/Expedition28、公共动画495项通过。Su各100,000样本命中率7.932%/16.018%。冻结表现与2.8m/s不变。旧effect_system仍有时钟断言/缺失站点错误，未扩展修复，不声明全仓全绿。详见[报告](SURVIVOR_TRAIT_FOUNDATION_REPORT.md)。SUR_003/005/007/009/010/012 已在后续 Phase A 接入；其余四项保持数据预留。

## Survivor Profile Data V1（2026-09-22）

- [x] 新增独立 `SurvivorProfile` Resource 与 12 份 `SUR_001`～`SUR_012` 档案数据；叙事资料与 Trait / Gameplay 分离。
- [x] Catalog 校验 Profile 唯一 ID 与 `SurvivorDefinition.survivor_id` 关联；CharacterRegistry 提供按旧模板 ID 或 `SUR_###` 查询的只读接口。
- [x] 新增 Profile 数据专项 Save/Load 回归测试；未修改 GLB、Rig、Animation、Weapon、Trait、Aura、Periodic 或 HUD。
- [x] Godot headless import and focused Profile verification passed: 91 checks / 0 failures；完整套件在既有 `camp_departure` Camp UI 空节点断言处停止，未归因于 Profile 层。

详见 [Survivor Profile Data V1 报告](SURVIVOR_PROFILE_DATA_REPORT.md)。

## Survivor Recruitment & Roster Foundation V1（2026-09-22）

- [x] 新增 `SurvivorRosterManager` 与 `LOCKED / DISCOVERED / RECRUITED` 状态；默认仅 `SUR_001`、`SUR_002` 已招募，其余 10 人锁定。
- [x] 提供全部、已发现、已招募、可出战查询，以及发现/招募状态转换；支持稳定 `SUR_###` 与现有模板 ID 查询。
- [x] 将 `survivor_states` 作为 v5 存档可选字段接入 Campaign；旧存档自动使用默认状态并同步已有出战成员，不改变 XP、Trait、Progression 或 Mission 数据。
- [x] 招募专项 17 项、Save Catalog Compatibility 9 项、Progression 29 项、Character System 与 Godot Headless Import 通过。

详见 [Survivor Recruitment & Roster Foundation 报告](SURVIVOR_RECRUITMENT_ROSTER_REPORT.md)。

## Survivor Camp Roster Integration V1（2026-09-22）

- [x] Camp M04 通过 `Campaign.roster_manager()` 动态读取 Survivor ownership；不再在 HUD 中固定角色数组。
- [x] 已招募角色显示 Portrait、Name、Level、Trait；DISCOVERED 显示“已发现 · 等待救援”；LOCKED 显示“未知幸存者”并隐藏完整资料。
- [x] 数量显示统一为 `RECRUITED / 12`，支持招募后刷新与 Save/Load 后恢复。
- [x] 专项 Camp roster 集成测试 0 failures；未修改 SurvivorDefinition、Trait/Aura/Periodic、XP/Level、角色资源或动画。

详见 [Survivor Camp Roster Integration 报告](SURVIVOR_CAMP_ROSTER_INTEGRATION_REPORT.md)。
## 2026-09-22：蓝时归航 Expedition Map Phase 1 + Phase 2

- [x] MiniMap 正式化：移除地图名、版本、Seed、Block ID 和 Debug Label 绘制路径；正式地图只保留地图几何、幸存者、POI、蓝时号和已发现地点标记。
- [x] 幸存者标记改为 Godot 绘制的圆环 + 中心点，支持静止、移动呼吸和搜索状态；统一样式，无头像纹理和 selected 状态。
- [x] Medium Town Arrival 改为道路网关 T 形交叉口候选，并为每个候选提供确定性的街边停车支持面；保留 Seed 驱动的 Block / Building / POI 管线。
- [x] 五个固定 Seed 结构验收通过：道路、街区、住宅/商业/工业分区、建筑密度、入口朝向、Arrival 建筑/停车/装饰邻近性。
- [x] 原生 MiniMap 五 Seed 对比截图与幸存者三状态截图已生成，见 [Phase 1 + 2 report](MAP_PHASE_1_2_FORMAL_REPORT.md)。
- [x] `run.ps1` 已接入结构验收与原生五 Seed capture。
- [ ] 完整 Windows build 仍需单独通过既有 Camp UI 门禁后才能宣称全量构建完成；本轮未修改 Camp、战斗、角色控制或摄像机系统。
