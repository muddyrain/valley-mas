# 历史未完成项待核验

来源：治理前 PLAN.md。归档于 2026-10-20，未重新运行游戏验证；旧记录可能已被后续实现替代。保留全部未勾选项，先复现再确定当前任务，不能按这里的旧分阶段限制自动阻塞新任务。

原计划第 9 行 · 2026-09-21：Map Phase 1.1.5 — MiniMap Geometry Full Snapshot

- [ ] Human Runtime QA：PENDING。原生 MiniMap capture 在既有世界点击命令断言处停止；完整 Windows build 仍受既有 Camp UI `member_buttons` / 左侧能力栏回归阻断，未生成本轮独立 EXE。详见 [Phase 1.1.5 报告](stages/MAP_PHASE_1_1_5_MINIMAP_GEOMETRY_REPORT.md)。

原计划第 24 行 · 2026-09-21：Map Phase 1.2 — MiniMap Renderer Visual Reconstruction

- [ ] 完整 Windows build 和旧移动 capture 仍受工作区既有 Camp UI / weapon / 世界点击并行回归阻断；不归因于本轮 renderer。

原计划第 32 行 · 2026-09-21：Survivor Progression Foundation V1

- [ ] 本轮未制作 UI、升级动画、招募、受伤、Aura、疲劳、士气、关系或实际 Gameplay XP 发放点。

原计划第 33 行 · 2026-09-21：Survivor Progression Foundation V1

- [ ] Search / Command 全链路回归仍受工作区既有 `weapon_combat_controller.gd` 解析错误阻断；不属于本轮 Progression 改动。

原计划第 40 行 · 2026-09-21：Survivor XP Gameplay Integration V1

- [ ] SPECIAL_EVENT 只保留 API，未接入具体剧情事件；未制作 UI 或新的 Trait / Progression 系统。

原计划第 48 行 · 2026-09-21：SUR_003～SUR_012 Trait Runtime Phase A

- [ ] Windows build 已执行；Search、HUD、Command、Active Card、Settings、Camp Menu 六组前置门禁通过，随后被既有 `camp_ui_runtime.gd:114` 的 `member_buttons` 访问和旧左侧能力栏断言阻断，未进入导出。完整旧 Effect/生产流程仍有既有断言与导航超时；本轮专项与受影响回归已通过。

原计划第 55 行 · 2026-09-21：Survivor Team Aura Runtime V1

- [ ] Phase A 全量回归仍受工作区既有 Progression Save/Load 与 SUR_012 Lv5 断言阻断；未实现 SUR_004 / SUR_008 的周期 Trait。

原计划第 76 行 · 2026-09-21：Expedition Runtime Performance P02

- [ ] Expedition Runtime Performance P02: TECHNICALLY COMPLETE；Human Runtime QA: PENDING；E03 Enemy: NOT STARTED。

原计划第 84 行 · 2026-09-20：Expedition Building Entrance Facing System

- [ ] `run.ps1 -Mode build` 已执行，五组前置专项通过后，被并行 Camp `shelter_view.gd:19` Nil `id` 阻断，未进入 Windows export。Human Runtime QA: PENDING。

原计划第 85 行 · 2026-09-20：Expedition Building Entrance Facing System

- [ ] Building Entrance Facing System: TECHNICALLY COMPLETE；10 Seed Entrance Facing: PASS；E03 Enemy: NOT STARTED。

原计划第 108 行 · 2026-09-20：Remaining 10 Survivors Unified Runtime Batch Integration

- [ ] Windows build 已执行；本批专项通过，但完整门禁被既有 `camp_ui_runtime.gd:114` 的 `member_buttons` 访问和旧左侧能力栏断言阻断，未进入导出。该失败不属于本批 Survivor 集成。

原计划第 109 行 · 2026-09-20：Remaining 10 Survivors Unified Runtime Batch Integration

- [ ] SUR_004/006/008/011 Trait Runtime、LOD、Combat Jog / Armed Locomotion 尚未开始。

原计划第 119 行 · 2026-09-20：Expedition Load Performance P01

- [ ] Windows build 已执行，前置专项通过后仍被既有 Camp `member_buttons` / 左侧能力栏回归阻断；未生成 P01 新 EXE。Human Runtime QA: PENDING。

原计划第 120 行 · 2026-09-20：Expedition Load Performance P01

- [ ] Expedition Load Performance P01: TECHNICALLY COMPLETE。E03 Enemy: NOT STARTED；不自动推进后续阶段。

原计划第 128 行 · 2026-09-19：Expedition Runtime Loading Transition / Random Town Minimap Ready Gate

- [ ] Loading Transition / Random Town Minimap: TECHNICALLY COMPLETE；Human Runtime QA: PENDING。实际 Windows build 被既有 Camp `member_buttons` / 左侧能力栏回归阻断，未生成本轮新 EXE。

原计划第 129 行 · 2026-09-19：Expedition Runtime Loading Transition / Random Town Minimap Ready Gate

- [ ] E03 Enemy: NOT STARTED；不推进战斗、HUD 重设计、Blue Hour 或撤离系统。

原计划第 137 行 · 2026-09-19：Expedition Integration E02 — Search / Loot Runtime

- [ ] Human Runtime QA: PENDING；E02 TECHNICALLY COMPLETE。完整 Windows build 已执行，仍被既有 Camp member_buttons / 能力栏回归阻断，未产出本轮独立 EXE。

原计划第 138 行 · 2026-09-19：Expedition Integration E02 — Search / Loot Runtime

- [ ] E03 Enemy / E04 Full HUD-Minimap / E05 Blue Hour-Extraction: NOT STARTED。等待人工验收，不继续后续阶段。

原计划第 148 行 · 2026-09-19：Camp HUD M07 Loadout Panel

- [ ] 等待本轮视觉验收；停止于 M07，不进入 M08。

原计划第 156 行 · 2026-09-19：E01.5 Fix — Local Follow Minimap + Equal Survivors

- [ ] Human Runtime QA: PENDING。E01.5 Fix TECHNICALLY COMPLETE；Windows build 已执行，仍被既有 Camp UI `member_buttons` / 左侧能力区断言阻断，未更新 EXE。

原计划第 157 行 · 2026-09-19：E01.5 Fix — Local Follow Minimap + Equal Survivors

- [ ] E02 Search: NOT STARTED；Full/Tactical Map、Enemy、Fog 重构及其他 HUD 美术重构未开始。

原计划第 164 行 · 2026-09-19：Expedition Integration E01.5 — Medium Town Minimap Runtime Bridge

- [ ] Human Runtime QA: PENDING；E01.5 TECHNICALLY COMPLETE，不替代人工运行时验收。

原计划第 165 行 · 2026-09-19：Expedition Integration E01.5 — Medium Town Minimap Runtime Bridge

- [ ] Windows build 已执行，Import 与 Expedition HUD 258 项等前置检查通过，仍被既有 Camp UI `member_buttons` / 左侧能力区断言阻断；本轮未更新独立 EXE。

原计划第 166 行 · 2026-09-19：Expedition Integration E01.5 — Medium Town Minimap Runtime Bridge

- [ ] E02 Search / E03 Enemy / E04 Full HUD-Minimap / E05 Blue Hour-Extraction: NOT STARTED。正式 Minimap Fog: DEFERRED_TO_E04。

原计划第 174 行 · 2026-09-19：Expedition Integration E01 — Navigation & Survivor Movement

- [ ] Human Runtime QA: PENDING。完整 Windows build 仍在既有 Camp UI 验证失败，未产生本轮独立 EXE。

原计划第 175 行 · 2026-09-19：Expedition Integration E01 — Navigation & Survivor Movement

- [ ] E02 Search / E03 Enemy / E04 HUD-Minimap / E05 Blue Hour-Extraction: NOT STARTED；等待人工验收及后续授权。

原计划第 182 行 · 2026-09-19：Expedition Search Gameplay V2

- [ ] 完整 build 仍被既有 Camp UI 测试阻断；退出时旧 ObjectDB 泄漏警告仍保留。数值、缺口、全部文件与失败回归见 [Search Gameplay V2 报告](stages/EXPEDITION_SEARCH_GAMEPLAY.md)。

原计划第 191 行 · 2026-09-18：Expedition Survivor Command V1

- [ ] 完整 build 仍因旧 Camp 测试的 `member_buttons`/能力栏断言失败；未改 Camp 或宣称完整构建通过。规则、修改范围与证据见 [验收报告](stages/EXPEDITION_SURVIVOR_COMMAND.md)。

原计划第 196 行 · 2026-09-17：Expedition 正式搜索状态卡

- [ ] 本次完整 build 在 HUD 阶段因 GLES3 `texture_set_size_override` 空纹理错误中止，尚未进入旧 Camp 测试；搜索卡专项与独立 EXE 启动也报告相同错误。单独 release 导出成功，独立 Expedition 启动退出码 0，另有已有的 2 个 ObjectDB 实例泄漏警告。未将启动成功表述为无错误验收，记录见 `test-output/search-spacing-*.log`。

原计划第 207 行 · 2026-09-17：Expedition 正式搜索状态卡

- [ ] 完整 `run.ps1 -Mode build` 未通过：旧 `camp_ui_runtime.gd` 访问当前 `camp_hud_root.gd` 已无的 `member_buttons`，且断言旧能力栏存在。保留原测试失败记录，未以定向导出冒充全套通过。

原计划第 208 行 · 2026-09-17：Expedition 正式搜索状态卡

- [ ] 额外回归：`interior_search.gd` 13/13 通过；`search_dispatch.gd` 50/56、`parallel_commands.gd` 2/3，后者在早期失败后结束，未执行余下断言。旧测试含移动应保留搜索等与本轮开始时已有实现相反的要求；本轮未改搜索玩法或这些历史测试。证据在 `test-output/search-active-*.log`。

原计划第 215 行 · 2026-09-18：夏知遥标准 Locomotion Retarget

- [ ] 等待夏知遥 V1 视觉验收；Idle 建议直接使用，Walking / Running 建议小修确认。不接入苏晚星、Gameplay 或持武器动作。

原计划第 242 行 · 2026-09-17：Standard Survivor Walking 原样验收

- [ ] 动作接地与循环未通过：鞋底最低仍离地约 24～27mm；按约 1.45m/s 恒速估算后候选支撑残余滑动约 18～41mm，循环 Mesh 最大首尾差 131.44mm。

原计划第 256 行 · 2026-09-17：Standard Survivor Idle_4 原样验收

- [ ] 接地不通过：双侧 Heel / Forefoot 持续悬空、轻度前掌上翘并伴随滑动。建议小修后复验，本轮未修正或接入正式角色。

原计划第 257 行 · 2026-09-17：Standard Survivor Idle_4 原样验收

- [ ] Toe_End 轴差异仍保留；此片段脚趾局部旋转恒定，未发现其引起动态翻转。停止并等待用户指令，详见 [原样验收报告](stages/STANDARD_SURVIVOR_IDLE_REVIEW.md)。

原计划第 264 行 · 2026-09-17：Standard Survivor Template 165cm 静态基线

- [ ] 已知源资产差异：左右 Toe_End 轴最大镜像角差约 28.8°，且有蒙皮权重；本轮只记录，不修正，不作动作可用性验收。

原计划第 265 行 · 2026-09-17：Standard Survivor Template 165cm 静态基线

- [ ] 等待下一步指令。路径、量测和修改清单见 [静态基线报告](stages/STANDARD_SURVIVOR_TEMPLATE_BASELINE.md)。

原计划第 291 行 · 2026-09-18：Camp HUD M04 Hover + M05-A 详情骨架

- [ ] 本轮人工视觉验收；停止于 M05-A，不自动接入 M05 正式美术。

原计划第 299 行 · 2026-09-19：Camp HUD M06 Camp Action Rail

- [ ] 本轮人工视觉验收；停止于 M06，不自动进入 M07。

原计划第 366 行 · 2026-09-13：继续归航加载过渡（已实现，待视觉验收）

- [ ] 用户实际运行时确认加载时长、文案与罗盘视觉；全量 build 仍受既有 CAMP UI 检查 1 项历史失败影响。

原计划第 371 行 · 2026-09-13：Expedition 常驻感染者与遭遇循环

- [ ] B：集中 Encounter 配置，安全且分群的初始感染者。

原计划第 372 行 · 2026-09-13：Expedition 常驻感染者与遭遇循环

- [ ] C：Idle / Wander 与对象池状态重置。

原计划第 373 行 · 2026-09-13：Expedition 常驻感染者与遭遇循环

- [ ] D：距离、朝向、遮挡与失去目标记忆。

原计划第 374 行 · 2026-09-13：Expedition 常驻感染者与遭遇循环

- [ ] E：NoiseEvent、抵达噪音与 Investigate。

原计划第 375 行 · 2026-09-13：Expedition 常驻感染者与遭遇循环

- [ ] F：既有自动武器、枪声连锁与搜索遇险恢复。

原计划第 376 行 · 2026-09-13：Expedition 常驻感染者与遭遇循环

- [ ] G：视野外、低频、人口下限补充。

原计划第 377 行 · 2026-09-13：Expedition 常驻感染者与遭遇循环

- [ ] H：蓝时前 30 秒预警及渐进感知。

原计划第 378 行 · 2026-09-13：Expedition 常驻感染者与遭遇循环

- [ ] I：正式蓝时多方向尸潮、兴趣点与持续压力。

原计划第 379 行 · 2026-09-13：Expedition 常驻感染者与遭遇循环

- [ ] J：F3 调试、感知 / 寻路错峰及 20 / 40 / 60 性能测量。

原计划第 380 行 · 2026-09-13：Expedition 常驻感染者与遭遇循环

- [ ] K：自动运行完整任务、原生截图、回归与 Windows 独立构建。

原计划第 392 行 · 2026-09-12：CAMP Visual Polish Pass 02

- [ ] 用户审核实际游戏截图；完成本轮后停止，不自动进入 HUD / 完整 Environment Dressing / 城市 / 夜间营地。

原计划第 414 行 · 2026-09-12：Expedition 城市密度、建筑搜索与探索

- [ ] 用户视觉验收；本阶段完成后停止，不开启真实室内、LOS、新模型或第二张地图。

原计划第 425 行 · 2026-09-12：Camp / 今日行动 UI 第二轮

- [ ] 用户确认视觉；技能升级/扩槽的正式费用与交易入口保持后续范围。

原计划第 520 行 · 2026-09-12：第一版正式外出街区（已交付，待人工验收）

- [ ] 用户视觉和玩法验收；树冠/顶棚遮挡、美术精修及后续seed开放仅列建议，不继续实现。

原计划第 549 行 · 0.1.1 切片检查点

- [ ] 人工试玩确认 5～10 分钟内的贪取感、操作手感与声画体验；继续数值调优。

原计划第 612 行 · 阶段 1.1 实施检查点

- [ ] 人工试玩确认搜索期间的掩护、蓝时召回与贪取节奏；本轮不宣称完成阶段 1.1 的体验验收。

原计划第 681 行 · 0.2.0 最小跨日版本实施清单

- [ ] 人工验收物资用途、补粮压力、装备收获和愿意再次出发的体验。

原计划第 700 行 · 0.3.0 实施检查点

- [ ] 人工试玩基础操作与并行取舍；继续调整夜间风险和搜图收益。

原计划第 716 行 · BLUE HOUR ART PIPELINE V1（2026-09-08）

- [ ] 人工验收风格与体验；正式 Anime 人物、绑定/动作、手机性能和专用 LOD 后续独立推进。

原计划第 734 行 · 当时推荐的小版：每日行动选择与目标（现排在开局基础之后）

- [ ] 安全屋每日展示三个行动选项，显示主产出、规模和可读的危险信息；复用当前模型搭建三套小型任务布局，不只换卡片名称或建筑皮肤。

原计划第 735 行 · 当时推荐的小版：每日行动选择与目标（现排在开局基础之后）

- [ ] 第一批建议为超市补给、空投装备、综合搜刮。食物、武器个体、Scrap 已有用途，可直接形成不同需求；医院与仓库的能力/被动奖励待对应系统可用后再加入。

原计划第 736 行 · 当时推荐的小版：每日行动选择与目标（现排在开局基础之后）

- [ ] 每次行动有一个明确的主要目标和可放弃的额外搜寻机会；允许提前撤离、保留已携带物资，不强制清空全图。空投需作为真实可交互目标，不能仅将现有库房改名为“空投”。

原计划第 737 行 · 当时推荐的小版：每日行动选择与目标（现排在开局基础之后）

- [ ] 将主要奖励、额外收益、回程距离与危险位置配合起来；蓝时保留简短预警，真正的大幅危险提升在夜晚。先用既有犬型和鸣响者检查回程应对，不仅提高血量或拉长读条。

原计划第 738 行 · 当时推荐的小版：每日行动选择与目标（现排在开局基础之后）

- [ ] 显示搜索中断、受威胁队员和归航未到齐成员，保持三点并行、指向射击、暂停命令与模型点击入口可读。

原计划第 739 行 · 当时推荐的小版：每日行动选择与目标（现排在开局基础之后）

- [ ] 行动选项与选中任务跟随本日保存；退出重进不刷新任务或奖励，旧五日存档可延续，原有购买/伤亡/结算一次性规则继续成立。

原计划第 779 行 · 2026-09-09 0.4.1 首页还原（素材接入已交付，逐像素目标待补图）

- [ ] 按 [UI_ASSETS](../../../art/UI_ASSETS.md) 补齐原稿手写装饰与同款底图 / 字体后，完成逐像素视觉复核。

原计划第 792 行 · 2026-09-12 第一阶段正式武器

- [ ] Phase 2B 剩余：其余五把模型、其他 profile 攻击/换弹动作与手型；long_gun 公共动作及 LeftGrip 约束已在下方独立阶段实现。

原计划第 803 行 · 2026-09-12 幸存者 Locomotion Polish

- [ ] 用户验收移动手感与残余脚滑；不自动进入 IK、Root Motion、Stride Warping 或动作重制。

原计划第 814 行 · 2026-09-12 武器 Phase 2A 交付

- [ ] Phase 2B 保留其余五把模型、手指握持、其他 profile / 换弹与枪械特效；long_gun 本阶段见下方。

原计划第 826 行 · 2026-09-12 Survivor Combat Animation Foundation

- [ ] 用户验收 long_gun 视觉与手感；不自动开始 sidearm / melee_short / reload / hit / death。

原计划第 837 行 · 2026-09-12 Mission / Combat Locomotion Style Pass

- [ ] 等待用户试玩确认动作风格；本阶段停止，不扩展其他武器、Strafe、Foot IK 或 Root Motion。

原计划第 878 行 · 2026-09-13 ENM_001 Phase 2A-0B-1 Final Locomotion

- [ ] Attack / Hit / Death 与 Combat 接入留待后续阶段。

原计划第 924 行 · 2026-09-13 Phase 2E：Unarmed Arm Swing V2 / Combat Jog V2

- [ ] Windows 稳定玩法快照全量构建与独立包验证。

原计划第 925 行 · 2026-09-13 Phase 2E：Unarmed Arm Swing V2 / Combat Jog V2

- [ ] 用户正式视觉验收；到此停止，不扩展其他动作或修改模型。

原计划第 935 行 · 2026-09-13 Phase 2A-Rebuild：ENM_001 新版 A-Pose 资产接管

- [ ] 用户视觉验收与 MP4 视频导出；本轮未扩展 Attack / Hit / Death。

原计划第 944 行 · 2026-09-13 ENM_001 Phase 2A-0B-1 Runtime Integration Gate

- [ ] 完整 UI 驱动 Expedition 自动流程仍有既有 timeout，暂不宣称端到端自动 PASS；Attack / Hit / Death 留待 Phase 2A-0B-2。

原计划第 964 行 · 2026-09-13 CAMP Survivor Ambient Behavior V1

- [ ] 等待视觉审核；不推进 Ambient AI 第二版或新玩法。

原计划第 974 行 · Placement Polish Pass 01B

- [ ] 等待视觉审核，保持核心 Prop 视觉冻结。

原计划第 981 行 · Placement Correction Pass 01A

- [ ] 等待视觉审核。

原计划第 987 行 · Placement Correction Pass 01A

- [ ] 用户完成视觉审核后再决定下一批 Meshy 资产；本轮不自动扩展范围。

原计划第 997 行 · 2026-09-13 CAMP HUD 2.0

- [ ] Windows 完整构建及最终独立包启动验证收尾。

原计划第 998 行 · 2026-09-13 CAMP HUD 2.0

- [ ] 用户审核 CAMP HUD 2.0 实机相似度与文字居中。

原计划第 1007 行 · 2026-09-13 Expedition HUD Phase 2

- [ ] 完整 build 门禁：两个 Camp UI 断言仍失败，未与 Phase 2 专项混为通过。

原计划第 1008 行 · 2026-09-13 Expedition HUD Phase 2

- [ ] 等待用户视觉验收；不自动进入下一阶段。

原计划第 1017 行 · 2026-09-14 Expedition HUD Phase 2.1 Visual Polish

- [ ] 等待用户视觉验收；不自动进入下一阶段。

原计划第 1026 行 · 2026-09-14 CAMP Environment Polish Pass 02

- [ ] 完整 build 门禁仍有两条既有 Camp UI 断言失败，详见报告，未越界修改 HUD。

原计划第 1027 行 · 2026-09-14 CAMP Environment Polish Pass 02

- [ ] 等待用户审核白天营地视觉效果；不自动提交或进入下一轮。

原计划第 1037 行 · 2026-09-14 CAMP Environment Composition Pass 02B

- [ ] 完整 build 仍被两条既有 Camp UI 断言阻断，未修改 HUD；未将专项通过视为全门禁通过。

原计划第 1038 行 · 2026-09-14 CAMP Environment Composition Pass 02B

- [ ] 等待用户视觉审核，停止于 02B，不自动提交或开始下一阶段。

原计划第 1048 行 · 2026-09-14 Expedition HUD Final Match

- [ ] 等待用户视觉验收，不进入下一阶段。

原计划第 1056 行 · 2026-09-15 Expedition HUD Final Fix

- [ ] 完整 build 仍有既有 Camp UI 两项断言；等待用户冻结验收。

原计划第 1073 行 · 2026-09-16：Medium Town V1 Phase A Rev.2（部分实现，待视觉验收）

- [ ] Rev.2 全 Profile 结构验收：旧测试含占位拓扑指标，不能据此宣称连通性、Loop 和路径距离通过；MAIN_STREET 已由下述 A.1 真实几何检查替代。

原计划第 1075 行 · 2026-09-16：Medium Town V1 Phase A Rev.2（部分实现，待视觉验收）

- [ ] 人工视觉验收。

原计划第 1076 行 · 2026-09-16：Medium Town V1 Phase A Rev.2（部分实现，待视觉验收）

- [ ] 完整 Windows build；当前被既有 CAMP UI runtime 检查失败阻断。

原计划第 1084 行 · 2026-09-16：Medium Town Phase A.1 MAIN_STREET 街区组织

- [ ] Windows build：本轮实际执行，因 Expedition HUD 的搜索状态断言失败停止，未更新 EXE。

原计划第 1085 行 · 2026-09-16：Medium Town Phase A.1 MAIN_STREET 街区组织

- [ ] `Visual QA: PENDING HUMAN REVIEW`。此处停止，不扩展 OFFSET_GRID / LOOP、正式 Expedition 或 Phase B。

原计划第 1096 行 · 2026-09-17：Medium Town V1 Phase A.2 MAIN_STREET 构图

- [ ] Windows build 实际执行后仍被既有 Expedition HUD 搜索状态断言阻断，未更新 EXE。

原计划第 1097 行 · 2026-09-17：Medium Town V1 Phase A.2 MAIN_STREET 构图

- [ ] `Visual QA: PENDING HUMAN REVIEW`；停止于 A.2，不扩展其他 Profile 或 Phase B。

原计划第 1109 行 · 2026-09-17：Medium Town V1 Blueprint Alignment

- [ ] Windows build 已实际执行，仍被既有 Expedition HUD 搜索状态断言阻断，未更新 EXE。

原计划第 1110 行 · 2026-09-17：Medium Town V1 Blueprint Alignment

- [ ] `Environment Visual Completion: PENDING`；结构验收不代表 Medium Town V1 或环境视觉已完成。

原计划第 1139 行 · Medium Town V1 — Environment & Street Life Pass

- [ ] 人工查看截图，判断 Open Space / Green Buffer / Yard / Parking / Street 的视觉表现，以及下一步值得生产或复用的资产。

原计划第 1140 行 · Medium Town V1 — Environment & Street Life Pass

- [ ] 全项目 Windows build：本次被既有 Camp UI 测试阻断，未交付新的独立 exe。

原计划第 1164 行 · 2026-09-17：Environment Asset Reuse Audit

- [ ] 人工审核 [Environment Asset Reuse Audit](stages/ENVIRONMENT_ASSET_REUSE_AUDIT.md) 与 QA 图，决定是否批准后续轻量接入。

原计划第 1176 行 · 2026-09-17：Environment & Street Life M01

- [ ] 人工审核 M01 风格、密度、可见性与缺口；所有新模型候选仍为 PENDING M01 VISUAL QA。

原计划第 1177 行 · 2026-09-17：Environment & Street Life M01

- [ ] Windows build：已实际执行，被既有 Camp UI member_buttons / 左侧能力区测试阻断，未交付更新 EXE；全局 World 资产测试另有四项旧 2048 贴图尺寸断言失败。

原计划第 1188 行 · 2026-09-18：Environment M01.1 Placement & Material Polish

- [ ] Visual QA: PENDING HUMAN REVIEW；独立停车垫、商业售货机遮挡与整体构图仍需人工判断。

原计划第 1189 行 · 2026-09-18：Environment M01.1 Placement & Material Polish

- [ ] Windows build：已执行，仍被既有 Camp UI `member_buttons` / 左侧能力区测试阻断，未交付新 EXE。

原计划第 1200 行 · 2026-09-18：Environment Asset Batch 01 Runtime Integration

- [ ] 全项目Windows build仍被既有Camp UI测试阻断，未交付新EXE；全Catalog回归另有4项既有建筑贴图尺寸断言失败。

原计划第 1211 行 · 2026-09-18：Environment M02 Targeted Street Props Placement

- [ ] Windows build 已执行，仍被既有 Camp UI `member_buttons` 缺失 / 左侧能力区断言阻断；未导出本轮新 EXE。

原计划第 1221 行 · 2026-09-19：Environment M03 Roadside Infrastructure & Visual Completion

- [ ] Visual QA: PENDING HUMAN REVIEW。电线粗细 / 悬垂 / 树冠关系、道路层次、P 标识和商业入口铺装等待人工截图验收。

原计划第 1222 行 · 2026-09-19：Environment M03 Roadside Infrastructure & Visual Completion

- [ ] Windows build 已实际执行，既有 Camp UI 的 `member_buttons` 缺失及左侧能力区断言阻断；未导出本轮新 EXE。

原计划第 1231 行 · 2026-09-18：夏知遥 Locomotion Gameplay Integration

- [ ] Gameplay 视频视觉验收待用户确认；本轮不调整移动速度，不制作 Turn / Start / Stop 或苏晚星动作。

原计划第 1238 行 · 2026-09-19：夏知遥 Gameplay Movement Speed A/B/C

- [ ] 不选择最终速度，等待三档视频视觉验收；路线目标未在测试上限内全部收敛，报告同时提供固定 8m 可比时间换算。

原计划第 1245 行 · 2026-09-19：Survivor 165cm Unified Runtime Baseline Audit

- [ ] 未替换正式角色、未修改动画 / Gameplay / 武器系统；等待下一步绑定授权。

原计划第 1264 行 · 2026-09-19：Mission Selection Runtime Style + Transition

- [ ] 正式 Windows 构建被既有 camp_ui_runtime 旧 member_buttons / HUD 断言阻塞；未更新 EXE。详情见 [页面交付报告](design/MISSION_SELECTION_RUNTIME_REPORT.md)。

原计划第 1271 行 · 2026-09-19：Mission Gameplay Closure Phase 0A

- [ ] Phase 0B — Medium Town Gameplay Integration TODO：导航、搜索点、敌人生成区域、实际压力与正式奖励结算待地图玩法接入。

原计划第 1284 行 · 2026-09-19：Camp M08 Depart Action

- [ ] M08 功能与三态已通过用户验收；本轮尺寸视觉待验收。停在 M08，不进入 M09。

原计划第 1292 行 · 2026-09-19：Camp M09 Utility

- [ ] 等待 M09 视觉验收，不继续其他模块。

原计划第 1302 行 · 2026-09-20：Camp Menu Overlay

- [ ] 等待 Overlay 视觉验收；停止，不继续修改其他 Camp HUD 模块。

原计划第 1312 行 · 2026-09-19：Xia + Su 165cm Production Replacement

- [ ] 最终真实地表审计 FAIL：导航/Spawn Y=0.08，但 RoadNetwork Y=0.025；双角色稳定鞋底距道路约 57–61mm，Walk 所在开放地表约 152–157mm。撤回相对 actor 高度的接地 PASS，三项 Production 验收均 FAIL，需修复地表高度共同契约，禁止角色 Y Offset 掩盖。

原计划第 1313 行 · 2026-09-19：Xia + Su 165cm Production Replacement

- [ ] 清理已删 40 个旧专属文本资源；两份旧 source GLB 删除被自动审批 blocked by policy 拒绝，连同 .import 暂留，无生产引用且不打包。

原计划第 1314 行 · 2026-09-19：Xia + Su 165cm Production Replacement

- [ ] 总 build 测试未全绿：旧 Camp HUD / 新局 / 五日测试存在结构、过渡时机及搜索语义断言失败；直接导出成功不等于总套件通过。具体失败见报告。

原计划第 1315 行 · 2026-09-19：Xia + Su 165cm Production Replacement

- [ ] 等待本轮 Gameplay 视频视觉验收；不推进 Combat Jog / Armed / 其余 Survivor。

原计划第 1328 行 · 2026-09-19：Expedition Ground Height Contract

- [ ] E01 三人长途返回/后续路线仍有 9 项失败：原始 Git 导航和修正后在相同 XZ 位置停滞，已证明不是高度投影引入；本轮未重写队伍让行。不能宣称全仓回归全绿。

原计划第 1329 行 · 2026-09-19：Expedition Ground Height Contract

- [ ] 等待本轮视觉验收；旧资源删除审批阻塞仍按前轮报告保留，不在本轮继续清理或制作动作。

原计划第 1369 行 · 2026-09-23：Camp Survivor Framework 显示链修正

- [ ] `[Windows]` 重新构建 `build/BlueHourHomeward.exe` 并验证独立程序启动。本次工作环境无已连接 Windows 设备，不能将 macOS 验证算作 Windows 构建通过。

原计划第 1377 行 · 2026-09-23：Survivor 头像归属迁移

- [ ] `[Windows]` Windows environment required：正式构建并验证独立程序启动；当前无可访问的 Windows 设备，按用户此前选择先交付 macOS 结果。

原计划第 1385 行 · 2026-09-23：Camp Survivor Panel 展示版

- [ ] `[Windows]` 待可访问 Windows 设备后执行正式 build 与独立程序启动验收。

原计划第 1394 行 · 2026-09-23：Camp Survivor Detail 打开与关闭动画

- [ ] `[Windows]` 待可访问 Windows 设备后执行正式 build 与独立程序启动验收。

原计划第 1402 行 · 2026-09-23：Camp Survivor Panel V2.1 派遣整备

- [ ] Main/Campaign 原生专项受当前工作区 `maps/exploration.gd` 解析错误阻断；隔离 Detail/Roster capture 已生成，不能代替完整 Camp 流程验收。详见 [V2.1 交付报告](reports/Camp_Survivor_Panel_V2_1_Report.md)。

原计划第 1403 行 · 2026-09-23：Camp Survivor Panel V2.1 派遣整备

- [ ] Windows 完整 build 与独立程序启动需在修复现有地图脚本解析错误和 Camp 旧 HUD runtime 门禁后执行。

原计划第 1410 行 · 2026-09-23：Survivor Definition 数据化 V1

- [ ] 完整 Windows build 受工作区现有 `tests/camp_ui_runtime.gd` 的 `member_buttons` 旧引用及左侧能力栏断言阻断；`new_run_flow` 的搜索点/成长持久化断言也在当前地图运行失败。独立 EXE 未生成或验证。详见 [Survivor Definition 数据化 V1 报告](reports/2026-09-23_survivor_definition_data_v1_report.md)。

原计划第 1420 行 · 2026-09-22：蓝时归航 Expedition Map Phase 1 + Phase 2

- [ ] 完整 Windows build 仍需单独通过既有 Camp UI 门禁后才能宣称全量构建完成；本轮未修改 Camp、战斗、角色控制或摄像机系统。

原计划第 1428 行 · 2026-09-22：Expedition Map Phase 3A Street Prop Pack

- [ ] 本机没有 Blender 4.x，本次 GLB 由无依赖程序化 fallback 生成；`.blend` 源文件和 Blender 侧复导出需在安装 Blender 的工作站完成。完整视觉套件仍受既有 Expedition Visual 24 项旧 HUD/纹理门禁影响。

原计划第 1438 行 · 2026-09-23：Expedition Map Phase 3B Blender City Props

- [ ] Human Visual QA：待确认立面挂件与工业街面道具在全部 Seed 下的可读性；本轮截图为原生 Godot 地图捕获，不标记人工美术验收完成。

原计划第 1448 行 · 2026-09-23：Expedition Map Phase 3C Anime Stylized Urban Dressing

- [ ] 人工美术视觉 QA 仍待确认；本轮截图不能替代人工对全部 Seed 的审美验收。完整 Windows Release build 与独立程序启动尚未执行。

原计划第 1458 行 · 2026-09-23：Expedition Map Phase 3D 街区密度与街道布局

- [ ] Release build 被工作区既有 Camp UI 门禁阻断：`camp_hud_root.gd` 缺少 `member_buttons` 且左侧能力栏断言失败；本阶段未改 Camp UI，独立程序启动未执行。全 Seed 人工美术验收仍待确认。旧 Phase 1.2 MiniMap 源码断言仍把幸存者名字提示 `display_name` 误判为地图名，本阶段未改 MiniMap。

原计划第 1467 行 · 2026-09-23：Weapon Contract Freeze Phase 1

- [ ] 后续实施需按冻结顺序单独立项：subtype 数据、Modifier/Upgrade Resource、实例扩展与 v5→v6 迁移；每步先补兼容和回归验收。

原计划第 1476 行 · 2026-09-23：Weapon ModifierData Resource 化 Phase W2-1

- [ ] `run.ps1 build` 前置的 `survivor_command` 仍有 “Line follows the moving survivor's feet” 失败；完整预构建测试流水线未通过，本轮未改该无关问题。

原计划第 1477 行 · 2026-09-23：Weapon ModifierData Resource 化 Phase W2-1

- [ ] Rarity Profile、UpgradeData、升级选择和随机升级抽取仍待后续阶段实现。

原计划第 1495 行 · 2026-09-23：Survivor Animation Integration Phase 1

- [ ] 原生 1600×900 运行时截图与 10 秒预览视频已生成，但 Idle / Rifle Idle 肩臂姿态不自然，Retarget 视觉验收未通过；AnimationTree 编辑器截图缺失。需先修正重定向再完成验收。本轮运行环境另有既存 `data/weapon_modifier_registry.gd` 缺失导致主入口脚本解析失败，不影响独立动画专项。

原计划第 1504 行 · 2026-09-23：Survivor Animation Retarget Pose Correction

- [ ] 视觉 QA 未通过：Idle 肩臂显著下垂得到改善；Rifle Idle 呈前收屈肘的持枪准备姿态，但未带枪网格，接触关系未验；Rifle Run 仍有不自然的抬臂。三态截图与预览视频已生成，需继续校准并人工确认。

原计划第 1513 行 · 2026-09-23：Survivor Animation Pose Calibration Phase 1.6

- [ ] 视觉 QA 未通过：Rifle Idle 双手/枪托接触仍不准确且枪体遮脸；Rifle Run 左手未稳定托枪，手臂与枪体仍不一致。视频作为校准证据，不作为通过验收。

原计划第 1521 行 · 2026-09-24：Survivor Animation SMG Pose Phase 1.7

- [ ] Windows build、独立 EXE 启动及 Windows 画面验收未执行：当前 macOS 没有可用的 Windows 远程连接。

原计划第 1529 行 · 2026-09-24：Survivor Animation SMG Grip Phase 1.8

- [ ] 真实 Expedition 原生视觉验收、Windows build 和独立 EXE 启动待执行；当前无可保证不抢焦点的 Godot GUI 截图路径，也无可用 Windows 远程连接。Debug Preview 精修在此收口，不安排 Phase 1.9。

原计划第 1547 行 · 2026-09-24：Survivor Animation Phase 2 Final Visual QA

- [ ] 视觉验收结论 **B：暂不通过**。普通 Run 双臂持续高抬，Death 末帧腿部与身体姿势明显扭曲；仅定点校准这两项并复核后，才能宣布 V1 完成、批量接入其余幸存者或推进 ENM_001。

原计划第 1556 行 · 2026-09-24：Survivor Animation Phase 2.1 Run / Death 定点修复

- [ ] Windows build、独立 EXE 启动与 Windows 原生画面验收仍需 Windows 环境；未完成跨平台发布验收。

原计划第 1566 行 · 2026-09-24：Survivor Animation Phase 3 批量复用

- [ ] 全量 `run.ps1 -Mode test` 在非动画的 `camp_departure.gd` Headless UI 输入目标检查失败；不将全仓测试写成通过，详见 [Phase 3 报告](reports/2026-09-24_survivor_animation_phase_3_batch_reuse_report.md)。

原计划第 1573 行 · 2026-09-23：Weapon RarityProfile Resource 化 Phase W2-2

- [ ] `allowed_modifier_rarity` 已入 Profile 并校验稳定 rarity ID；当前 `WeaponModifierData` 没有 rarity 分类，故本阶段不据此过滤候选，待后续契约具备该分类后再接入。

原计划第 1574 行 · 2026-09-23：Weapon RarityProfile Resource 化 Phase W2-2

- [ ] 未实现 UpgradeData、升级 UI、Legendary 掉落或新特效；没有修改武器数值、WeaponDefinition、WeaponInstance 或战斗/VFX 链路。

原计划第 1584 行 · 2026-09-23：Weapon UpgradeData + Candidate Phase W2-3

- [ ] 全项目 Godot import 受现有 MiniMap `_draw_survivor_marker` 参数不匹配阻断；Expedition capture 同时记录 enemy transform 非有限值和 camera 方向警告，虽 harness failure 列表为 0，不能视为干净的视觉通过。

原计划第 1594 行 · 2026-09-23：Expedition MiniMap V4 Exploration & Information Layer

- [ ] 全 Seed 人工美术验收及地图事件危险数据源仍待后续；本阶段不实现发现奖励或独立资源点。
