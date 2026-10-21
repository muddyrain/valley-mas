# 蓝时归航项目审计与下一阶段开发规划

- 审计日期：2026-10-20，Asia/Shanghai。
- 审计对象：`apps/blue-hour` 当前源码、工作区修改、现有测试和本轮 Windows 运行结果。
- 基准 HEAD：`865edec300e01d64d015924b3e6f391567ba46be`，分支 `master`。
- 文档性质：审计结果及待确认路线图，不代表已批准或已实施下一阶段开发。
- 首要目标：稳定、完整、可以反复游玩的五日试玩版本。

## 1. 当前项目阶段及执行摘要

项目处于**五日试玩的集成稳定阶段**，尚未达到完整试玩的交付标准。当前已经具备正式 Town、搜索、自动战斗、昼夜、巴士撤离、跨日状态、成长和保存组件；主要问题在于这些组件通过正式玩家入口组合之后，仍存在界面接线、结束流程和验证门禁缺口。

本轮证据支持以下结论：

- 正式 Town 完成一次搜索、自然昼夜、真实撤离、结算、保存和下一天。
- 跨日、口粮、伤亡、成员身份、武器实例和保存恢复已有底层实现及当前测试。
- 暂停、倍速、动画循环和指令线的本轮专项通过。
- 单人搜索、1/1 撤离、最后一人死亡，在受控 Town 验证中通过。

当前阻碍交付的问题：

1. 营地资源与日期使用静态示例值，关键整备入口未完整接回。
2. Run 结束后没有结束界面，不能正常重新开局。
3. 现有五日流程测试失败，正式五日成功路线没有本轮完整证据。
4. Windows 完整构建失败，未产生对应当前源码的新 EXE。
5. 武器升级只有底层候选、应用和扩展序列化，尚无正式玩家闭环。

下一阶段应集中修复上述断点，暂缓增加地图、角色、设施和长期系统。没有采用完成百分比评价项目。

## 2. 工作区状态、审计范围和验证环境

### 2.1 工作区状态与保护

| 项目 | 审计时事实 |
| --- | --- |
| 分支 | `master`，跟踪 `origin/master` |
| HEAD | `865edec300e01d64d015924b3e6f391567ba46be` |
| 本地跟踪关系 | 领先 4、落后 3；未联网 fetch，不代表远端当前状态 |
| 原有工作区 | 10 个已修改文件、8 个未跟踪文件 |
| 保全结果 | 原有受保护文件哈希差异为 0，审计前后 Git 状态一致 |
| 本轮动作 | 未暂存、提交、推送、切分支、重置或清理未知文件 |

原有修改涉及动画资源与控制器、指令线、构建脚本、动画测试及 `docs/PLAN.md`。原有未跟踪文件包括四份 2026-10-19 报告及两个新增专项的脚本和 UID，均保留。

完整记录：[审计前 Git 状态](../../test-output/audit-20261020/git-before.txt)、[审计后 Git 状态](../../test-output/audit-20261020/git-after.txt)、[受保护文件起始哈希](../../test-output/audit-20261020/protected-before.json)。

审计运行脚本、JSON、日志和截图写入已忽略的 `test-output/audit-20261020/`。本报告是随后按用户要求新增的文档，不属于前述原有 18 项状态。未改写已有计划或游戏代码。

### 2.2 规则与源码范围

已读取根 `CLAUDE.md`、项目技能索引、Blue Hour `AGENTS.md`、`PROJECT_CONTEXT.md`、`README.md`、`docs/PLAN.md`、`docs/VALIDATION.md` 及相关游戏定位、跨日、开局、效果、武器设计和近期 R1/R2 资料。历史报告仅作为定位线索，结论以本轮源码和验证为准。

重点追踪 `core/main.gd`、`campaign.gd`、`save_store.gd`、`run_ledger.gd`、`missions/mission.gd`、`maps/`、`survivors/`、`weapons/`、`data/`、`ui/`、`encounter/` 和相关 `tests/`。未逐帧审查所有动作资源，也未逐行审查全部历史测试和美术文件。

当前没有可调用的 GitNexus 工具，使用原生 Git、源码检索和调用链追踪。当前技能目录没有可用的 Superpowers 入口，未声称执行该流程。使用 Godot 规则进行语义核对、delivery-reporting 区分验证与计划；报告保存阶段使用 encoding-guard。

### 2.3 Environment

| 环境项 | 本轮记录 |
| --- | --- |
| 平台 | `[Windows] Windows environment required` |
| 系统 | Windows 11 专业版，10.0.26200，64 位 |
| CPU / GPU | i5-12400F / NVIDIA GeForce RTX 3060 |
| 显卡驱动 | 32.0.15.9186，Godot 输出 NVIDIA 591.86 |
| Godot Editor / Console | `4.7.2.stable.official.ed1daf0bf`；使用 Console 执行导入、脚本及原生窗口 |
| 引擎路径 | `C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe` |
| 渲染与导出模板 | OpenGL Compatibility；存在 `4.7.2.stable` Windows 模板 |
| 原生取证 | 1600×900，屏幕外原生窗口、合成鼠标和按键输入，不替代用户人工验收 |
| Node / pnpm / Git | 26.4.0 / 11.21.0 / 2.39.1.windows.1 |
| Node 版本边界 | 超出仓库声明的 Node 范围；`context:recent` 提示 warning，但执行成功；Godot 工程独立于 pnpm |
| Blender | 未使用；PATH 未找到，不据此断言机器完全未安装 |
| macOS | 未访问，Godot Editor、Blender、Node、Git 均未核验；没有跨平台验收结论 |

[环境 JSON](../../test-output/audit-20261020/environment.json)。所有 Run 测试存档使用 `user://test-runs/`；未打开玩家 `user://homeward/run.json` 的正文。探索系统另有 `user://exploration` 缓存，其隔离边界不能与 Run 存档等同。

### 2.4 Validation 方法与结果

先读取现有测试和 `run.ps1`，再执行资源导入、专项验证、原生流程及完整构建。每个专项的 `*.result.json` 保存真实命令、起止时间、退出码、超时和错误扫描结果；同时保留 stdout、stderr 和 Godot 日志。

从仓库根目录执行的命令形式如下，具体逐条命令以结果 JSON 为准：

```powershell
# [Windows]
$auditGodot = 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe'
& $auditGod --headless --path apps/blue-hour --editor --import --quit
& $auditGod --headless --path apps/blue-hour --script tests/rules.gd
& $auditGod --headless --path apps/blue-hour --script tests/mission_dayloop.gd
& $auditGod --headless --path apps/blue-hour --script tests/time_contract.gd
./apps/blue-hour/run.ps1 -Mode build -GodotPath $auditGod
```

批量编排入口为 [run-audit.ps1](../../test-output/audit-20261020/run-audit.ps1)。它保留失败，不删除断言，也不将引擎返回零但含脚本错误的执行标记为通过。

| 验证类别 | 本轮结果 |
| --- | --- |
| 资源导入 | PASS，exit 0，无匹配的 SCRIPT ERROR / ERROR |
| 34 个现有专项脚本 | 27 PASS、7 FAIL，不含完整 build 中重复执行的前置门禁 |
| 受控 Town 单人边界 | 12 checks / 0 failures |
| 正式原生流程探针 | 完成取证；发现营地信息失真和结束空页，不是产品 PASS |
| 自然计时搜索探针 | 完成一次搜索、自然昼夜、归航和下一天；击杀为 0 |
| 武器数据探针 | 完成取证；确认扩展存档可恢复，库存入库丢升级字段 |
| Windows 完整 build | FAIL，约 213.107 秒，exit 1，未进入导出 |
| 旧 EXE 独立目录主菜单启动 | Headless / Native 均 PASS，只证明旧包启动 |

[完整汇总](../../test-output/audit-20261020/summary.json)、[导入结果](../../test-output/audit-20261020/import-headless.result.json)、[构建结果](../../test-output/audit-20261020/build.result.json)。本轮启动的测试进程均已退出；独立启动验证使用的临时 EXE 副本已移除，原 EXE 保留。

## 3. 系统完成状态矩阵

“当前验证通过”只覆盖证据列的范围，不等于所有内容和边界都完成。代码路径相对 `apps/blue-hour`；测试名对应本轮同名日志和结果文件。

| 系统 | 状态 | 代码入口 | 本轮证据 | 缺口、风险及建议下一步 |
| --- | --- | --- | --- | --- |
| 主菜单、新游戏、专精选择 | 当前验证通过 | [core/main.gd](../../core/main.gd)、[ui/title_screen.gd](../../ui/title_screen.gd)、[ui/new_game_screen.gd](../../ui/new_game_screen.gd) | 正式原生输入创建 Run；`new_run` 40/0 | 全部键盘、手柄路径未复验；补正式导航回归 |
| 开局队伍抽取 | 部分实现 | [data/new_run.tres](../../data/new_run.tres)、`Campaign.new_run()` | 实际池只有夏知遥、苏晚星，起始人数为 2 | 当前主要随机顺序，没有队伍组合变化；先明确试玩角色池 |
| 营地资源、日期和状态 | 已复现缺陷 | [ui/camp_hud/camp_hud_root.gd](../../ui/camp_hud/camp_hud_root.gd)、[resource_bar.tscn](../../ui/camp_hud/resource_bar.tscn)、[camp_identity.tscn](../../ui/camp_hud/camp_identity.tscn) | 食物 6→4→2→0，HUD 始终 10；日期始终 DAY 01 | 破坏资源决策；优先接入 Campaign 真值 |
| 营地换装、购买、训练 | 部分实现 | `main.gd` 的交易方法、[survivor_roster_adapter.gd](../../ui/camp_hud/survivor_roster_adapter.gd) | 后端事务存在；正式详情装备禁用、升级锁定 | 新 HUD 未接回旧能力；逐项恢复正式入口和保存失败回滚 |
| 今日行动三选一 | 部分实现 | [ui/today_action_screen.gd](../../ui/today_action_screen.gd)、[data/today_action_data.gd](../../data/today_action_data.gd) | 正式选择与出发成功；`mission_profiles` 4117/0 | 旧 `today_action` 访问 `departure` 后报错并超时；迁移行为验收 |
| 地图生成和加载 | 当前验证通过 | [maps/expedition/expedition_map_provider.gd](../../maps/expedition/expedition_map_provider.gd)、`maps/town/` | 五个固定种子运行时集成及原生加载门禁通过 | 正式入口为 MEDIUM_TOWN_V1，样本 57 个搜索注册点；补更多种子与可达性验收 |
| 小队移动和并行指挥 | 当前验证通过 | `mission.gd:716`、[missions/squad_input.gd](../../missions/squad_input.gd) | 并行指令 36/0、命令归属 14/0、指令线 Headless 552/0；build Native 554/0 | 极端拥堵和长路线未全测；保持现有小队指挥语义 |
| 搜索、取消与死亡边界 | 待复核 | [missions/search_task.gd](../../missions/search_task.gd)、`mission.gd:803` | 原生搜索成功、单人边界通过；`search_dispatch` 56 项 2 失败 | 搜索速度和伤亡后撤离需区分旧夹具与真实问题 |
| 自动战斗、弹药与命中 | 待复核 | [weapons/weapon_combat_controller.gd](../../weapons/weapon_combat_controller.gd) | `encounter_combat` 10/0 | 效果专项失败；复核弹丸、目标倍率及指向射击 |
| 敌人 AI、噪声和导演 | 当前验证通过 | [enemies/enemy.gd](../../enemies/enemy.gd)、[encounter/encounter_director.gd](../../encounter/encounter_director.gd)、[ambient_threat_runtime.gd](../../encounter/ambient_threat_runtime.gd) | AI 609/0、导演 30/0、战斗 10/0 | 正式目录当前只有一种感染者定义；后期机制变化有限 |
| DAY / BLUE HOUR / NIGHT | 当前验证通过 | [time/mission_clock.gd](../../time/mission_clock.gd)、`mission.gd:327` | 时间契约 173/0、子步 606/0；自然蓝时和夜晚 | 勘查开局含白昼加成，本次边界为 170s / 188s；危险强度仍待平衡 |
| 巴士撤离、上车、关门 | 当前验证通过 | `mission.gd:1139` | Town/City 归航 26/0；原生真实撤离；受控 1/1 通过 | 旧伤亡撤离仍有失败断言；保留复核 |
| 唯一结算、资源、口粮和跨日 | 当前验证通过 | [core/run_ledger.gd](../../core/run_ledger.gd)、[core/campaign.gd](../../core/campaign.gd) | 跨日规则 43/0；原生日期、缺粮、失败结算 | 本轮未发现重复入账；还需五日成功及 UI 事务验证 |
| 五日终点和重新开局 | 已复现缺陷 | `main.gd:266` 的 `show_shelter()` | 正常操作至第 5 日缺粮失败后空页；won 夹具同样空页 | ended 状态未创建页面；恢复结束页和重开入口 |
| 幸存者身份与名单 | 当前验证通过 | `campaign.gd:26`、[data/survivor_roster_manager.gd](../../data/survivor_roster_manager.gd) | 营地名单集成通过，原生跨日成员一致 | 招募 API 不等于外出营救完成；正常获取链待接入 |
| Trait、Aura、周期效果 | 待复核 | [core/trait_runtime.gd](../../core/trait_runtime.gd)、[core/aura_runtime.gd](../../core/aura_runtime.gd) | Trait Gameplay 111/0、Aura 21/0、周期 13/0、治疗 20/0、士气 24/0 | Phase A 76 项 8 失败并有脚本错误；部分夹具直接修改旧等级字段 |
| XP 和等级成长 | 当前验证通过 | [data/survivor_progression.gd](../../data/survivor_progression.gd)、Campaign XP API | 成长 29/0、Gameplay XP 6/0，原生跨日等级变化 | 空手立即归航也获完成与归航 XP，成长快；校准五日节奏 |
| 武器实例、品质和词条 | 待复核 | [core/equipment.gd](../../core/equipment.gd)、`weapons/` | 武器 474 项 1 失败，失败为要求 K9 无模型的旧断言 | 底层较完整，正式换装入口缺失；先恢复 UI 再验自由分配 |
| 武器升级 | 部分实现 | [weapon_upgrade_applier.gd](../../weapons/weapon_upgrade_applier.gd)、[weapon_inventory.gd](../../weapons/weapon_inventory.gd) | 候选与应用 55/0；扩展存档恢复 Lv2 | 仅三种 P9 Lv2 候选，无正式 UI；add_weapon 丢升级状态 |
| 被动与特殊能力 | 部分实现 | [core/effect_modifiers.gd](../../core/effect_modifiers.gd)、[missions/special_power.gd](../../missions/special_power.gd) | 8 被动、6 技能与起始能力存在；效果专项 324 项 19 失败 | 正常获取、付费升级、扩槽及营地管理未闭合 |
| 基地设施成长 | 仅有设计或历史记录 | [ui/shelter_view.gd](../../ui/shelter_view.gd)、[data/shelter_layout.tres](../../data/shelter_layout.tres)、设计文档 | 有基地场景，未取得正式建设交易证据 | 场景设施不能算玩法完成；五日稳定前暂不扩建 |
| 存档、备份、迁移、退出恢复 | 当前验证通过 | [core/save_store.gd](../../core/save_store.gd)、`campaign.gd:583` | 损坏备份、写失败、旧档迁移规则通过；兼容专项 9/0 | 当前 schema v5；新 HUD 交易接回后须补原生失败回滚 |
| 小地图和探索迷雾 | 当前验证通过 | [ui/expedition/minimap.gd](../../ui/expedition/minimap.gd)、[maps/exploration.gd](../../maps/exploration.gd)、[exploration_state.gd](../../maps/exploration_state.gd) | 五种子 2337/0；原生可见探索结果 | 全窗口尺寸、长期记忆与探索缓存隔离未完整复验 |
| 模型、动画和 UI 表现 | 部分实现 | [survivor_expedition_animation_controller.gd](../../survivors/survivor_expedition_animation_controller.gd)、`ui/` | 动画契约 1873/0；两名开局角色原生运行 | 其余角色、全部武器姿态和连续动画视觉质量未全验 |
| 性能 | 已实现但未验证 | [maps/expedition/town_navigation.gd](../../maps/expedition/town_navigation.gd)、[missions/world_interaction_vfx.gd](../../missions/world_interaction_vfx.gd) | 可见寻路复用、刷新节流等实现 | 本轮无独立压力基准；并发测试耗时不能当性能结果 |
| Windows 当前构建 | 已复现缺陷 | [run.ps1](../../run.ps1) | 完整 build 213.107s、exit 1，未导出 | 需要处理 Camp UI 及后续独立门禁债；没有新包 |
| 长期解锁、侵蚀、主线和平台扩展 | 暂缓开发 | [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md)、游戏设计文档 | 无本轮完整实现及验收证据 | 保留路线，五日稳定后分别立项 |

## 4. 核心游戏闭环评估

### 4.1 自然搜索归航

正式流程：标题菜单 → 新游戏 → 勘查专精 → 安全屋 → 住宅区 → Town → 搜索 → 自然蓝时 → 自然夜晚 → E 归航 → 准备与关门 → 结算 → 保存 → 第 2 天。

搜索产出并最终带回 3 食物、1 废料。自然进入蓝时的时刻为 170 秒，夜晚为 188 秒；归航结果行动时间约 205.417 秒。没有开启无敌、注入奖励、瞬移、强制切时段或调用内部结束方法。该路线击杀为 0，只证明搜索、昼夜和撤离，不作为完整战斗体验或平衡证明。

证据：[搜索记录](../../test-output/audit-20261020/search-probe.json)、[原生 stdout](../../test-output/audit-20261020/test-output_audit-20261020_search_probe-native.stdout.log)、[搜索截图](../../test-output/audit-20261020/search-searched.png)、[蓝时截图](../../test-output/audit-20261020/search-blue-hour.png)、[夜间截图](../../test-output/audit-20261020/search-night.png)。

此探针通过合成输入选择目的地、点击建筑和按 E；路线选择读取了世界数据。没有人工试玩手感结论。

### 4.2 连续空手归航和失败终点

通过正式输入完成五次出勤和结算，资源及日期如下：

| 已结算次数 | 日期 | 食物 | Run 状态 |
| --- | --- | --- | --- |
| 0 | Day 1 | 6 | shelter |
| 1 | Day 2 | 4 | shelter |
| 2 | Day 3 | 2 | shelter |
| 3 | Day 4 | 0 | shelter |
| 4 | Day 5 | 0 | shelter，首次缺粮宽限后继续 |
| 5 | Day 5 | 0 | lost，连续缺粮导致失败 |

该路线没有完成搜索，不是五日生存成功验收。营地显示一直停留在食物 10、废料 60、DAY 01。第 5 次结算后 `app.state == ended`、`screen_exists == false`，实际画面为空。

正常失败与后续 won/lost 受控夹具分别记录，不能将夹具当作自然通关。[正式流程 JSON](../../test-output/audit-20261020/formal-probe.json)、[初始营地截图](../../test-output/audit-20261020/03-camp.png)、[第 5 日实际结束截图](../../test-output/audit-20261020/day-5-after-settlement.png)。

### 4.3 单人边界

受控 Town 夹具关闭敌人、将目标设为已发现、直接下达生产搜索与撤离命令，沿正式路径推进，没有用瞬移或强制结束代替归航。12 项断言通过，覆盖单人搜索、真实行走及上车、1/1 返回、结果不重复、跨日一次，以及注入最后一人死亡后的零资源失败结算。

[单人记录](../../test-output/audit-20261020/solo-probe.json)、[单人验证脚本](../../test-output/audit-20261020/solo_probe.gd)。这是边界正确性证据，不是单人难度平衡结论。

**闭环判断：单日循环和跨日基础接通；包含战斗、成长及成功终点的正式五日完整试玩仍未验证通过。**

## 5. 已复现缺陷、技术债和待验证事项

### 5.1 Known Issues

| 编号 | 问题及证据 | 根因或当前判断 | 优先级 |
| --- | --- | --- | --- |
| F01 | 营地资源和日期失真；正式流程 JSON 及截图可复核 | 场景保留静态文本，根 HUD 未绑定对应 Campaign 真值 | P1 |
| F02 | 第 5 日失败空页；won 夹具同样没有控件 | show_shelter 设置 ended 后未创建结束页 | P1 |
| F03 | 正式成员详情装备按钮禁用、升级锁定 | 新 HUD 尚未接回旧 Main 事务和界面能力 | P1 |
| F04 | Ctrl 指向命中集火技能目标遗漏额外伤害 | AimFire.fire 不传目标，攻击规格在命中解析前按空目标计算；效果专项支持此差异 | P2 |
| F05 | 升级武器经 add_weapon 入库退回 Lv1 | 默认 to_dict 不包含升级字段；直接扩展数据保存和恢复则保留 Lv2 | P2，开放升级前必须修复 |
| F06 | Windows build 在 Camp UI 失败 | 测试访问 member_buttons，且要求旧 PowerSlots 结构；有旧契约失配，也有真实功能未接回 | P0 发布阻断 |
| F07 | 两组五日流程断言失败并超时 | 旧路线、成长预期与当前实现不一致；尚未逐条完成根因归类 | P1 验收缺口 |

F04 调用链：[AimFire.fire](../../survivors/aim_fire.gd) → [WeaponCombatController.try_attack](../../weapons/weapon_combat_controller.gd) → `Mission.damage_to(member, target)`；命中前 target 为空，无法应用依赖目标的 focus 倍率。不能据此把全部效果失败归为同一根因。

F05 结果：[data-probe.json](../../test-output/audit-20261020/data-probe.json)。扩展数据的 Lv2 P9 伤害 20.7，直接保存并恢复仍为 Lv2、20.7；库存 add_weapon 接口得到 Lv1。因此缺口在库存接线，不能表述为整个 SaveStore 不支持升级数据。

### 5.2 七组现有失败测试

| 专项 | 本轮结果 | 复核方向 |
| --- | --- | --- |
| search_dispatch | 56 checks / 2 failures | 搜索 Trait 速度断言、原搜索者伤亡撤离结果 |
| weapon_system | 474 checks / 1 failure | 旧断言要求 K9 model_path 为空，但当前 K9 已有模型；属于测试契约漂移 |
| effect_system | 324 checks / 19 failures，并有脚本错误 | 区分弹丸、目标倍率、移动倍率、旧地点夹具和时钟冻结边界 |
| trait_phase_a | 76 checks / 8 failures，并有脚本错误 | 夹具直接改旧 level 字段，造成当前成长状态不一致；后续空状态访问是连带错误 |
| today_action | exit 2，超时 | 访问新 HUD 不存在的 departure 属性；没有完成原预期流程 |
| day_loop_flow | exit 2，超时 | 搜索路线及装备奖励断言失败；当前未证明五日成功 |
| new_run_flow | exit 2，超时 | corner / van_south 路线和固定等级预期失败；不能忽略已接入的 Gameplay XP |

日志位于本轮证据目录下对应的 `<专项>-headless.stdout.log`、`stderr.log` 和 `result.json`。[汇总](../../test-output/audit-20261020/summary.json)。失败没有被删除、跳过或通过改断言伪装为全绿。

### 5.3 技术债和文档差异

- 正式入口使用 MEDIUM_TOWN_V1；README 的固定旧城区、27 栋建筑和 22 点描述不能代表本轮 Town。
- 当前 Campaign schema 为 v5；README 的 v4 及局部旧版状态描述需要标明历史范围。
- 旧 UI 节点和旧字段仍被测试直接依赖，导致新组件接入后回归无法完整执行。
- `main.gd` 保留旧交易接口，但当前营地采用新的只读展示组件，消费者未完整接回。
- 招募、武器升级、额外被动与技能的数据/API 不能计作正常游戏获取链完成。

建议下一阶段同步当前唯一计划入口及验证文档；历史报告保留原时点结论。本轮没有静默改写这些文件。

### 5.4 Windows 产物与验收边界

本轮完整 build 约 213.107 秒后 exit 1。搜索、外出 HUD、角色指令、指令线、搜索卡、设置和营地菜单等前置门禁执行后，在 `tests/camp_ui_runtime.gd` 停止，未进入导出。

[构建 stdout](../../test-output/audit-20261020/build.stdout.log)、[构建 stderr](../../test-output/audit-20261020/build.stderr.log)、[构建结果](../../test-output/audit-20261020/build.result.json)。

现存 [BlueHourHomeward.exe](../../build/BlueHourHomeward.exe) 是旧包：

- 构建时间：2026-09-24 21:09:02，+08:00。
- 大小：1,730,183,136 字节。
- SHA-256：`E194539E347E5B2757B4C61107E2EBBAD98352DC44AE43FE7A40D0E26951B627`。
- [BUILD-INFO.json](../../build/BUILD-INFO.json) 记录 `fullBuildPassed: false`。

本轮将该文件复制到无源码及独立 PCK 的目录，以 `--test-save=audit-old-package-menu.json --test-menu --quit-after 120` 分别运行 Headless 和 Native，退出码均为 0，无匹配的脚本错误。[Headless 结果](../../test-output/audit-20261020/standalone-old/headless.result.json)、[Native 结果](../../test-output/audit-20261020/standalone-old/native.result.json)。

这只能证明该旧包主菜单能独立启动。没有对应当前源码的新包，也没有当前源码的 Windows 完整发布验收。

尚未验证：正式五日成功路线、全部角色和武器组合、长时间运行、夜间人口上限性能、低端硬件和其他平台。未执行磁盘断电等物理故障实验。

## 6. 与 Deadly Days 核心体验的差距

对照对象是《Deadly Days》第一作，不是 Roadtrip。原作明确包含小队管理、程序化城市、随机武器改造、物品与能力组合、夜间危险及明确终点；基地房间和自定义武器是其后续扩展。[官方商店介绍](https://store.steampowered.com/app/740080/Deadly_Days/)、[官方 1.5 更新说明](https://store.steampowered.com/news/posts/?appgroupname=Deadly+Days&appids=740080&enddate=1593799850&feed=steam_community_announcements)。

| 核心体验 | 当前评估 | 下一步 |
| --- | --- | --- |
| 根据资源缺口选择行动 | 任务收益有差异，营地资源显示失真 | 先修真实信息，再评价地点选择是否有意义 |
| 控制整支小队 | 并行派遣、自动战斗、集合、撤离已保留 | 不改变为单人射击；补边界验收 |
| 白天搜刮、夜间升级 | 时间和导演链路成立 | 校准夜间压力及返程距离 |
| 再搜一个还是回家 | 已有搜索、携带损失和真实撤离成本 | 以完整五日路线和玩家试玩判断风险回报 |
| Trait、自由换武器、随机 Build | 数据与运行组件较丰富，正式入口和获取链不足 | 恢复整备，接少量正常奖励 |
| 基地成长和单轮终点 | 五日规则存在，结束页缺失，设施未闭环 | 先完成终点与重开，再讨论设施 |

二次元 3D、蓝时表现、当前缺粮宽限和五日终点属于本项目原创设计。城市侵蚀、更多设施和主线结局可以暂缓，不能为了增加功能数量改变当前循环。

## 7. P0–P4 下一阶段开发路线图

以下均是待用户确认的任务。每项先建立可观测验收，再做最小实现，随后复跑受影响验证；不提出整包重构。

| 任务与目标 | 当前证据 | 修改模块 | 小步骤、依赖与风险 | 验收标准和测试方法 |
| --- | --- | --- | --- | --- |
| P0-A 恢复可信发布门禁 | F06、七组失败专项 | run.ps1、对应 tests | 先逐条对应旧断言和当前行为，再修定位与夹具；真实缺口依赖 P1 恢复；不可删行为断言 | 完整 build 无脚本错误后才导出；新 EXE 独立目录完成启动及核心流程；记录源码清单、哈希和范围 |
| P0-B 补正式入口的保存失败验收 | 底层规则通过，UI 事务未闭合 | main.gd、新接回的营地操作、保存测试 | 随 P1-C 接线分别验证购买、换装、训练、结算；风险是 UI 先变化、失败未回滚 | 每项注入写失败，资源、成员、库存、装备和日期保持原状态；恢复后只能成功一次 |
| P1-A 营地资源和日期绑定 | F01 | camp_hud_root、资源栏、日期模块 | 读取 Campaign 真值→接入显示→覆盖刷新和读档；可首先执行；避免缓存旧 Run | 新开局、归航、继续游戏均与数据一致；真实 6→4、Day1→Day2；原生和规则断言 |
| P1-B 结束页和重新开局 | F02 | main.gd、结束页、流程测试 | 增加 won/lost 页面→菜单和重开→终态读档；独立于成长扩展；风险是重复结算、覆盖旧进度 | 成功、全灭、缺粮失败均有可操作结果；重开重置正确；历史不重复 |
| P1-C 最小整备闭环 | F03 | 营地详情、库存界面、main.gd | 先换装/转交/卸下，再购买，再训练；复用 Campaign 和已有浏览器；依赖 P1-A | 同型号实例独立，单实例不重复装备；购买一次扣款一次；训练成本、结果和保存一致；执行 P0-B |
| P1-D 正式 Town 五日验收 | F07 | tests、正式原生流程验收 | 替换旧路线定位→验证一轮成功→三专精不同固定种子→失败和重开；依赖 P1-A/B/C | 正常伤害、搜索与拾取、自然时段、真实上车；五日成功、续档、单人和全灭分别留证；不强制结束 |
| P2-A 战斗与效果一致性 | F04、效果专项差异 | CombatController、命中解析、Effect/Trait 消费点 | 先确定目标倍率，再修指向命中，再清理剩余真实差异；风险是混淆弹丸和每发伤害 | 自动与指向命中同一目标采用相同规则；遮挡、穿透、散弹、Trait 距离、冷却和暂停分别测试 |
| P2-B 一条可玩的武器升级链 | F05，现有 P9 候选 55/0 | WeaponInventory、Campaign、升级 UI、校验 | 先保留实例字段→预览/选择→支付事务→装备/出勤/保存；依赖整备；先限现有 P9 内容 | 预览、扣款、属性、实战和续档一致；取消、重复点击、无效选项、保存失败均不扣款或重复升级 |
| P2-C 少量正常 Build 奖励 | 起始效果存在，获取链不足 | 行动奖励、结算、效果管理 | 先确定奖励来源，再接一组获取/装备/替换；依赖结算、整备，形式需产品确认 | 正常流程获得至少一种额外效果；下次出勤确实生效，续档不复制、不叠加共享模板 |
| P2-D 五日经济和成长校准 | 食物压力成立，空手归航也快速成长 | day_loop、任务收益、XP 参数 | 固定基线→单变量调参→对照路线；依赖 P1-D 日志 | 记录每日粮食净值、搜点数、时间、伤亡和等级；补给路线可持续、装备路线有代价；人工确认风险取舍 |
| P3-A 模型、动画和反馈验收 | 动画契约通过，两名角色原生证据 | 当前动画控制器、挂载和反馈层 | 先现有开局角色，再全部试玩可用角色；核心循环稳定后进行 | 正式镜头覆盖移动、起停、搜索、开火、换弹、受击和上车；验证中断与连续操作，保存录像 |
| P3-B 性能基线 | 存在优化实现，缺本轮压力数据 | 导航、AI、搜索、迷雾、小地图 | 固定目标机和场景→测量→定位瓶颈→局部优化；依赖硬件目标 | 常态、夜间峰值、配置人口上限及 ×1/2/4；记录 p95/p99、寻路次数和模拟进度；同场景复验 |
| P4-A 长期系统 | 主要为设计 | 长期档案、侵蚀、设施、主线、平台配置 | 五日和发布门禁稳定后，按单项设施→长期威胁→主线终点→跨局解锁→平台扩展分别立项 | 每项独立数据契约、存档迁移与行为验收；其他平台有独立构建和运行证据 |

P0-A 是发布阻断项，不意味着必须通过大范围修改一次解决所有测试。其失败列表先固定，依赖的功能随对应 P1/P2 切片闭合，最终再完成全量构建。中间切片的局部通过不能冒充整体可发布。

阶段完成门槛：

1. **可反复游玩**：真实营地信息、整备、成功/失败结果和重开全部闭合。
2. **五日试玩成立**：正式五日成功路线及关键失败路线具有当前证据。
3. **可交付**：完整门禁通过，新 Windows EXE 在独立目录完成启动和核心流程验收。

## 8. 最值得首先执行的开发任务及完整验收标准

推荐首先执行 **P1-A 营地资源与日期真实绑定**。资源缺口、训练成本和路线选择都依赖这些信息，当前错误贯穿每一天；修复边界明确，适合先建立可靠的玩家决策基线。

目标：当前营地只展示同一份 Campaign 的正式状态。正式数据流为 `Campaign.data` → 营地 view model 或绑定方法 → 资源和日期模块。显示刷新不得写资源、推进日期或创建额外状态真源。

小步骤：

1. 为当前静态显示建立失败断言，读取真实新开局和跨日结果。
2. 接入资源和日期；定义新 Run、继续游戏及营地重建时的刷新入口。
3. 覆盖今日行动打开/取消、跨日和切换 Run。
4. 原生截图及定向回归；实际执行完整 build 并报告门禁状态。

验收标准：

- 新 Run 显示实际 Day 1、食物 6、废料 0。
- 正常空手归航后显示 Day 2、食物 4，与保存记录一致。
- 新开局、继续游戏、连续跨日不残留上一份 Run 的数值。
- 首次和连续缺粮状态符合当前口粮规则。
- 今日行动打开、取消后资源和日期保持正确。
- 纯 HUD 刷新不修改 Campaign 或存档，不重复结算。
- 1600×900 与最小窗口取得原生截图，行为断言不依赖旧节点名。
- 跨日、开局、保存、营地名单受影响验证通过。
- 实际执行 Windows build；若仍受独立门禁阻断，明确失败原因和未产生新 EXE，不标记整体可发布。

本切片先恢复可核验的信息，不扩展设施、角色池或第三种经济资源。随后建议执行 P1-B 结束页，再恢复最小整备和正式五日验收。

## 9. 需要用户决定的产品或技术问题

| 问题 | 建议 |
| --- | --- |
| 武器升级是否必须进入首个五日试玩？ | 先稳定闭环，再以当前 P9 做一条完整升级链 |
| 五日版是否必须建设设施？ | 先完成整备与 Build 奖励，设施放到稳定之后 |
| 起始角色池是否维持当前两人？ | 先完成两人基线，再扩至已完成实战验收的角色子集 |
| 最低目标 PC、分辨率和帧率是什么？ | 明确最低目标机和 60fps 预算后执行性能专项 |

本轮审计与规划到此结束，下一阶段实施等待用户确认。

## 报告文件交付记录

### Task Summary

按用户要求，将本轮项目审计、实际验证、缺陷归类、状态矩阵及 P0–P4 计划保存为仓库报告。没有开始下一阶段开发。

### Changed Files

- 新增：`docs/reports/2026-10-20_project_audit_and_next_phase_plan_report.md`。
- 修改：无既有文件。
- 删除：无。
- 审计过程的一次性脚本和证据位于忽略目录 `test-output/audit-20261020/`，不纳入版本控制。

### Implementation Details

本次只有文档落盘，无运行时代码、数据绑定、资源资产或存档格式变更。已有工作区修改和未跟踪文件保留。

`docs/PLAN.md` 未同步改写：本报告保存的是待确认路线图；该文件已有用户修改，未获授权将本轮提议提升为已批准的实施计划。当前验证证据集中于本报告和对应日志，历史报告维持原时点表述。

### Validation

运行验证结果见第 2–5 节，均来自 2026-10-20 同轮审计。保存报告不重复执行 Godot 测试或 Windows 构建，纯文档变更无需重新构建。

- PASS：`python .agents/skills/encoding-guard/scripts/check_mojibake.py apps/blue-hour/docs/reports/2026-10-20_project_audit_and_next_phase_plan_report.md`，没有可疑编码或文本丢失。
- PASS：本报告 69 个本地 Markdown 链接目标均存在，九个编号章节完整；该检查不代表重新联网验证外部网页。
- PASS：原有受保护文件哈希差异为 0，Git 仅新增本报告，保留原有 18 项工作区状态。

本轮截图为实际 Godot 1600×900 帧缓冲，供审计取证使用，没有进入 Runtime Asset、Portrait 或模型绑定。链接指向的测试输出和 EXE 为本机忽略产物，新检出仓库可能不存在这些文件；源码和报告链接随仓库保存。
