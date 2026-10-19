# Blue Hour R2 — 统一模拟时间契约

日期：2026-10-19（Asia/Shanghai）。平台：**[Windows] Windows environment required**。

**R2 核心运行验收 PASS；Windows 完整构建／新 EXE 交付 BLOCKED。** 已完成统一时间专项、正式暂停与倍率操作、R1 归航跨日回归及自然昼夜／感染者战斗／全灭保存。旧门禁失败和未验证范围另列，不把专项通过或旧 EXE 作为发布成功。

## 1. 范围与基线

工作区为 `D:/my-code/valley-mas`，游戏根为 `apps/blue-hour`，HEAD `8004ebabc6823c1c238045bf5406916879ed134b`，分支 `master`。保留 G0、G1、R1 源码、规则、报告、测试及暂存内容；没有 commit、push、reset、stash、分支切换或批量资源清理。

已读取根 AGENTS／CLAUDE、游戏 AGENTS／PROJECT_CONTEXT、游戏定位契约、V0、R1 闭环报告及 R1 独立审查。未发现更深层规则。采用 Godot、task-completion-guard、delivery-reporting、encoding-guard；无可调用 GitNexus 工具，回退原生 Git 与调用点检查，没有伪造 impact 结果。未发现可读取的相关 Superpowers skill。

保留小队指挥、自动战斗、多点搜索、Space 暂停可下令、WASD 镜头、五日归航、暮色延缓的局部作用范围，以及现有保存／唯一结算事务。未开发 R3 结束页、R4 营地交互或新玩法。按本次指定路径交付唯一报告，不再生成第二份任务报告。

证据根 **E** 为 `test-output/r2-time-contract/`。[snapshot.json](../../test-output/r2-time-contract/snapshot.json) 与 [source-manifest.json](../../test-output/r2-time-contract/source-manifest.json) 固定了开始时的磁盘内容，复制 3,099 个源文件并逐文件 SHA-256 核对。所有运行位于 E 下副本，原缓存、玩家存档及原 build 不参与执行。修复前对照副本的相关文件也核对为开始快照哈希，见 `E/sandbox/baseline/`。

## 2. 时间来源与生命周期

```text
core/main.tscn → Main 分阶段加载 / Ready Gate
  → Mission.process_mode = DISABLED → 就绪后 INHERIT
MissionHUD：Space / Esc / 设置 / F1 Debug
  → _sync_pause → Mission.time_scale = 0 或所选 1 / 2 / 4
引擎物理帧 delta（Engine.time_scale = 1）
  → Mission.simulation_delta：唯一局部倍率边界
  → 有效模拟区间，按最多 1/60 秒及技能到期边界拆分
  → _advance_world(dt)
      → Periodic / Clock / Director / Search.prepare / Survivor.tick
      → simulation_advanced(dt)
          → Ambient.advance：Town Noise + Enemy；两图搜索噪声
      → City Enemy.tick（Town 不走此分支）
      → 全灭检查 / Search.advance / 拾取 / 撤离准备与关门
  → SpecialPower.advance(dt)
Mission.completed（先 active=false）
  → Main → Campaign.stage_result → 保存 pending
  → 正式结算确认 → Campaign.commit_day → 保存 / 下一天
```

源码检索没有发现生产代码写 `Engine.time_scale` 或 `SceneTree.paused`；原生观测中 Engine.time_scale 为 1。这里的“帧时间”指引擎提供、尚未乘本作局部倍率的物理帧 delta，**不等同于 OS 墙钟时间**。OS 时间只用于观察和录屏，不用于暂停后补算。未把所有子系统的 delta 再乘倍率，也未新增全局时间管理器。

| 系统 | R2 前来源／问题 | R2 后来源、暂停与生命周期 |
| --- | --- | --- |
| Main 加载 | 父级 process_mode 禁用行动 | 保留 Ready Gate；Mission 在 Town 命令未就绪时也返回零模拟时间，技能不再越过就绪检查提前计时。 |
| Mission | delta × time_scale，Town 之外另有独立循环 | 唯一缩放一次；无效／负 delta、暂停、不活跃或 Town 未就绪不推进；结束时停止剩余子步。 |
| MissionClock / Director | Mission 的有效 delta；Ambient 不同步 | 同一个 dt；阶段阈值与威胁分级采用微秒数值容差，避免子步累计误差造成晚一帧。导演只消费一次 dt。 |
| Town Ambient | 独立 _physics_process 原始 delta，暂停仍 tick | 移除独立回调，订阅 Mission.simulation_advanced；保留其 Enemy／Noise 职责，runtime_ready 与 active 仍检查。 |
| City Enemy / Noise | Mission 拥有 tick | 保留原归属，不由 Ambient 再 tick；Ambient 只发搜索噪声。City 下车演出仍独占一个外层帧阶段，释放队伍当帧不提前进入战斗／到站噪声阶段。 |
| Survivor | tick 内消费 dt，移动再按 1/120 秒积分 | 不二次缩放；死亡、上车、室内状态继续按原规则跳过战斗／移动。 |
| Enemy / 感染者动画 | AI tick 原始 Ambient delta；AnimationPlayer 自动播放 | AI、移动、攻击、windup、记忆、感知均消费同一个有效 dt；动画改为手动 advance，随 Enemy.tick 推进，暂停不原地继续播放。目标死亡／室内／上车保护保留。 |
| Noise / 搜索噪声 | Town 原始 delta；搜索周期每调用最多一次 | Noise.elapsed 使用所属地图的同一 dt；搜索噪声按周期补发，处理到期余量，不额外缩放。 |
| SearchTask | prepare / advance / exit 来自 Mission | 全部同一 dt；保留进入／隐藏／退出、取消保留进度与每地点独立任务。 |
| Trait / Aura / Periodic | Trait／Aura 为按状态求值，Periodic 消费 Mission dt | 规则求值本身没有独立时钟；周期触发／持续时间使用模拟 dt，死亡／上车 provider 不继续周期触发。 |
| SpecialPower | 到期切片后消费 Mission dt | 保留到期精确分片及冷却；暮色延缓只冻结白昼／蓝时，世界、Noise、搜索继续；全局暂停冻结两者。 |
| 撤离 | 准备／关门倒计时为 dt；人物缩放和车门却是真实时间 Tween | 倒计时与表现均由模拟进度驱动：原有 8s 准备、1.4s 关门、0.65s 人物缩放及 1s 门动画不变；缺员等待、上车保护与唯一完成继续复用。 |
| 结算／Campaign | 事件驱动事务 | 没有新增计时或新结算系统；结束、暂存与确认保持原有幂等保护。 |
| UI／镜头／表现 | 独立渲染帧 | 菜单、镜头、提示和指令反馈可响应；幸存者动画的渲染时间原已单独按局部倍率推进，不再乘已缩放的物理 dt。纯表现的提示／特效不作为战斗、搜索或结算时钟。 |

影响范围检查覆盖 Mission 调度及其受控测试、HUD 创建 Ambient 的入口、Ambient 的直接测试调用、Enemy 动画和两个地图 provider。HUD 创建 Ambient 的已有装配副作用保留；本阶段没有扩大为业务装配重构。正式 HUD 内现存倍率入口是 **F1 菜单的“时间 ×1／×2／×4”下拉项**，没有新增另一套倍率控件。

## 3. 修改文件

| 文件 | 修改 |
| --- | --- |
| [missions/mission.gd](../../missions/mission.gd) | 唯一 simulation_delta 边界、有界子步、共享模拟信号、加载与 City 到站阶段保护；撤离表现改为模拟进度。 |
| [encounter/ambient_threat_runtime.gd](../../encounter/ambient_threat_runtime.gd) | 消费共享有效 dt，保留 Town Enemy／Noise 与两图搜索噪声职责。 |
| [enemies/enemy.gd](../../enemies/enemy.gd)、[infected_animation_controller.gd](../../enemies/infected_animation_controller.gd) | 感染者动画随模拟 tick 手动推进。 |
| [time/mission_clock.gd](../../time/mission_clock.gd) | 子步累加后的阶段／威胁阈值数值边界。 |
| [tests/time_contract.gd](../../tests/time_contract.gd)、对应 UID | 新增两个 provider、三个倍率、冻结／恢复／生命周期、实际攻击／移动／搜索／技能／周期与撤离回归。 |
| [tests/ambient_threat_runtime.gd](../../tests/ambient_threat_runtime.gd) | 直接调用适配为 advance；未更改原断言。 |
| [run.ps1](../../run.ps1) | mission_dayloop 与 time_contract 同时接入 test、build；未删除或跳过旧门禁。 |
| [docs/PLAN.md](../PLAN.md)、本报告 | 同步本阶段事实与残留风险，保留历史原文。 |

未修改 Main、HUD、Survivor、SearchTask、Trait／Periodic、Campaign、SaveStore、内容 Resource 或 R1 的 EncounterDirector 修复；它们通过既有消费链复用新的有效 dt。

## 4. 自动化测试

全新隔离导入 PASS，exit 0，211.836s。测试与源码使用 Godot 4.7.2；受控测试允许构造位置、装备和计时 fixture，**不是原生正式玩家流程的替代证据**。没有修改 search_dispatch 或指令线断言。

| 检查 | 结果／E 内日志 |
| --- | --- |
| 修复前时间专项 | 45 项／9 失败；Town Noise、Enemy、暂停在各倍率下失败。`logs/legacy-red-time-isolated.*`。更早夹具因队友击杀探针敌人多报 3 项，已单独保留，未计为产品问题。 |
| 最终 Time Contract | **173 项／0 失败**，`logs/legacy-time-final.*`，详情 `sandbox/project/test-output/time-contract/report.json`。 |
| R1 日循环 | **26 项／0 失败**，`logs/legacy-r1-final.*`。 |
| Ambient 原有专项 | **56 项／0 失败**，`logs/legacy-ambient-contract.*`；原断言保留，仅改调用接口。 |
| City 到站／Noise | **13 项／0 失败**，`logs/legacy-final-noise.*`；子步跨阶段时曾新增 1 项失败，已修复且保留中间日志。 |
| 并行指令 / Campaign 跨日 | 36／43 项，均 0 失败；`logs/legacy-parallel_commands.*`、`legacy-day_loop.*`。 |
| 感染者战斗 / 基础 / 周期 Trait | 10／62／24 项，均 0 失败；`logs/legacy-encounter_combat.*`、`legacy-infected_basic.*`、`legacy-sur_008_morale_boost.*`。 |
| 旧 City search_dispatch | 新旧均 **56 项／2 失败**，相同断言；`logs/legacy-{baseline-,}search_dispatch.*`。 |
| 旧武器专项 | 新旧均 **474 项／1 失败**：Empty model allowed WPN_004_K9_SMG。未扩大修复。 |
| 旧效果专项 | 修复前 324／16 失败，修复后 324／19 失败；另一个保留断言的诊断运行 324／18。该组整体为 **FAIL**，不能归并成全部旧失败已解决。 |

效果专项中两处新增的“Movement and reload continue during freeze”失败，诊断实际为 moving=true、reload=1.00000000000000490，与精确 `== 1` 差 4.88e-15；见 `logs/legacy-effect-probe.*`。直接射击伤害断言在前后运行也有不同倍数的偏差，不能仅凭失败数量断定同一根因或宣称完整装备／效果回归通过。正式装备 UID 和新专项的确定性战斗对照另行验证。原断言完整保留，完整效果门禁仍待专项治理。

### 相同模拟区间的对照

下表的每一行在 ×1／×2／×4 下分别执行相同模拟时长；倍率之间差异小于 0.0001m／测试浮点容差。没有用相同调用次数假装相同模拟区间。

| provider | 幸存者移动 2s | 感染者移动 2s | 感染者造成伤害 4s | 自动射击 4s | 三倍率差异 |
| --- | --- | --- | --- | --- | --- |
| Town | 5.20805693m | 3.75496674m | 32 HP | 8 发／144 伤害 | 记录值相同 |
| City | 5.20790386m | 3.75501728m | 32 HP | 8 发／144 伤害 | 记录值相同 |

Clock／Noise／Enemy 冷却的 2s 增量、搜索 2s 进度、技能 2s 持续／冷却增量、周期 Trait 触发、暮色延缓到期后余量、0.4s 关门推进均有独立断言。暂停不推进、恢复只消费下一帧、不补算暂停墙钟时间；Town 未就绪与 inactive 均不推进。

## 5. 原生正式入口验收

原生驱动仅实例化正式 `res://core/main.tscn` 并向目标 Viewport 推送 device 42 键鼠事件；没有手动 tick Mission、内部设置倍率、改 HP、传送角色、开无敌、调时段或调用内部结束／结算方法。倍率下拉采用实际点击并点击弹出项，未调用 select 或发射 item_selected 冒充玩家输入。

### 暂停／恢复

Space、Esc、设置和 F1 Debug 四入口均已完成前后快照核对，包括 Clock、Noise、增援计时、Enemy 位置／AI／攻击计时／动画位置、Survivor 位置／HP／战斗计时、搜索进度及现有技能状态；见 [pause-checks.json](../../test-output/r2-time-contract/acceptance/pause-checks.json)。准备和关门阶段另有实际暂停／恢复，车门位置、角色缩放与倒计时一起冻结，见 [return-pause-checks.json](../../test-output/r2-time-contract/cycle/return-pause-checks.json)。

正式开局的两名角色不含周期 Trait provider；活跃周期效果的冻结／触发／到期由受控专项验证，不把空 provider 快照写成该角色组合已演示活跃周期效果。Space 中用正式快捷键激活技能并保持持续／冷却状态冻结，遵守原有暂停可下令契约。

| 实际暂停状态 | 前后观测墙钟跨度 | 结果 |
| --- | --- | --- |
| Space，搜索中且技能已激活 | 4.513s | 世界状态冻结。 |
| Esc | 4.484s | 世界状态冻结，菜单可操作。 |
| 设置（Esc 菜单已隐藏） | 4.836s | 世界状态冻结，设置可操作。 |
| F1 Debug | 4.162s | 世界状态冻结，既有调试 UI 可操作。 |
| 巴士准备中 | 3.799s | 准备剩余时间、双方状态冻结。 |
| 关门中 | 3.672s | 关门剩余时间、车门位置及人物缩放冻结。 |
| 自然近身接敌后 Space | 5.935s | HP 87.5／100 不变，Clock 308.8666667s 不变，敌人位置／AI／攻击／动画计时不变。 |

第一次观察器把镜头投影 screen 坐标的微小浮点变化算成世界变化，实际世界坐标和状态不变；已排除纯投影字段并重跑。原始失败 trace／帧保留于 E 根目录，最终四入口证据位于 `E/acceptance/`。没有放宽游戏世界状态比较，也没有隐藏失败。

### 正式 UI 倍率

最终会话 `E/cycle/` 中三档均通过实际下拉选择，Engine.time_scale 始终为 1；`E/cycle/speed-checks.json` 记录按钮文本、完整状态和实测量。

| 所选倍率 | 观测物理帧数 | 应推进 = 帧数 / 60 × 倍率 | Clock 增量 | Noise 增量 | Clock 误差 |
| --- | --- | --- | --- | --- | --- |
| ×1 | 136 | 2.2666666667s | 2.2666666667s | 2.2666666667s | -6.84e-14s |
| ×2 | 72 | 2.4s | 2.4s | 2.4s | -1.01e-13s |
| ×4 | 40 | 2.6666666667s | 2.6666666667s | 2.6666666667s | -1.66e-13s |

原生前后快照还记录双方行动、搜索、技能、弹药、伤害、敌情等；相同模拟区间的严格数值对照见第 4 节。截图／连续 PNG 压缩会拖慢引擎追帧；上述误差基于实际引擎物理帧，不宣称录屏墙钟速度精确等于 1／2／4，也不以此作 FPS 或性能验收。

### R1 正式主循环、存档与装备

本次正常创建 Run seed **60130168**，作战专精、两名成员。最终代码会话从主菜单“继续”重载本次正常生成的保存，完成第 2 天营地 → 今日行动 → 商业街 → Medium Town → 真实搜索／拾取 → E 步行归航 → 2/2 → 准备／关门（含暂停恢复）→ 结果 → 正式确认 → 第 3 天营地。

第 2 天起始 food=6、scrap=5；实际带回 2 食物／5 废料，扣 2 口粮，进入第 3 天为 **food=6、scrap=10**。history 增加一次，Mission 只发一次完成；成员身份与两把装备 UID `initial:crew:0`、`initial:crew:1` 保持一致。pending 与确认后保存均核对 envelope SHA-256 及完整 payload 等于 Campaign；见 [closure-checks.json](../../test-output/r2-time-contract/cycle/closure-checks.json) 和 `E/saves/day-2-pending.json`、`day-3-camp.json`。第 1 天亦正常完成并在重启后载入第 2 天，未通过结束存档 fixture 伪造。

第 3 天按正式 UI 选择 ×4 自然推进，在 clock≈150.000s／168.000s 进入蓝时／夜晚，近身后用正式 UI 改回 ×1，受伤后完成上述冻结验证；恢复后继续自然感染者战斗。最终 clock≈363.15s、threat=8、累计导演夜间增援 115、击退 41、两人 HP=0，正常进入失败结算。115 是累计生成数，不是同时人口。

本次只使用正常自动战斗及正式 Ctrl 向空地指向射击；先后有约 12s／20s 的 Ctrl 操作，让自然来敌近身，没有 Debug 生成、直伤或无敌。此项证明自然来敌可触发全灭链路，不评价生存平衡。纯等待观察器后改由 `finish_night.py` 接续同一 Godot 进程与同一连续录像；只停止输入侧 Python，未重开场景或改运行状态，见 `E/continuation.json`、`logs/night-input-retry.log`、`night-finish.log`。

行动实际携带 1 食物／6 废料，全灭 pending 带回 0／0，returned_ids=[]、lost_ids 为两名出勤者；确认后 status=lost、members=[]，库存仍为 **6 食物／10 废料**。history 仅增一次；本最终会话共两个完成事件，对应第 2 天成功与第 3 天全灭各一次。pending 与 lost 保存均核对 envelope SHA-256 和完整 payload，见 [wipe-checks.json](../../test-output/r2-time-contract/cycle/wipe-checks.json)、`E/saves/day-3-wipe-pending.json`、`day-3-lost.json`。确认后的 R3 空结束页原样保留，不宣称结束页通过。

第 3 天首次今日行动输入落在控件禁用时段，观察器停止；等界面稳定后，同一“商业街”正常选中并出发。该输入失败日志保留，不能据此认定行动耗尽，也未修改行动资源或保存。

## 6. Windows build 与已知风险

实际执行隔离副本完整 `run.ps1 -Mode build`，耗时 **166.461s**，exit 1。本次 Search Gameplay 72/0、Phase2 265/0、Survivor Command 45/0、Search Active Card 157/0、Settings 14/0、Camp Menu Overlay 30/0；随后 Camp UI 报 `member_buttons` 不存在及“Camp exposes active abilities on its left edge”。未进入 export，未生成新 EXE，也未覆盖原构建。见 `E/logs/build-final.*`。

指令线本次通过不代表 R1 审查所证实的 20Hz 重绘相位风险已解决；原测试与实现未改。search_dispatch 两项失败、旧 Camp UI、武器／效果测试契约债仍保留。R1 日循环与 R2 时间专项已接入 test/build，但此次完整 build 在更早的 Camp UI 停止，**未执行到新增门禁**；其通过证据来自隔离定向执行。

其他保留风险：HUD 创建 Ambient 的装配副作用；Town 避让分支跳过旧腕表加速（R1 审查 F4，本轮未改移动规则）；R3 全灭后空结束页；R4 营地交互／固定 HUD。未扩大为所有武器／角色、五日通关、多 seed、存档迁移及磁盘故障、音频、性能、macOS 或独立新 EXE 验收。

## 7. 媒体、环境与保全

四段指定视频均为真实 1600×900、H.264 MP4，完整解码 exit 0、无错误，见 [decode-checks.json](../../test-output/r2-time-contract/videos/decode-checks.json)。

| 视频 | 时长 | 内容 |
| --- | --- | --- |
| [pause-freeze.mp4](../../test-output/r2-time-contract/videos/pause-freeze.mp4) | 7.88s | 自然近身受伤后 Space，感染者与世界冻结。 |
| [resume-combat.mp4](../../test-output/r2-time-contract/videos/resume-combat.mp4) | 40.16s | 从暂停恢复进入连续战斗，含正式指向射击。 |
| [speed-comparison.mp4](../../test-output/r2-time-contract/videos/speed-comparison.mp4) | 22.48s | 三档实际下拉选择与行动推进。 |
| [town-return-regression.mp4](../../test-output/r2-time-contract/videos/town-return-regression.mp4) | 35.36s | 第 2 天正常归航、准备／关门暂停恢复、结算及第 3 天。 |

恢复战斗短片为 [完整连续原片](../../test-output/r2-time-contract/videos/resume-combat-full.mp4) 开头约 40s，未拼接；原片 349.24s 保留至真实全灭结算及确认结束。截取信息见 [resume-excerpt.json](../../test-output/r2-time-contract/videos/resume-excerpt.json)，原始编码元数据见 [metadata.json](../../test-output/r2-time-contract/videos/metadata.json)。另保留 `natural-day-cycle.mp4`、`natural-contact.mp4` 及较早四种菜单暂停录像。

画面直接来自真实 Viewport，不重绘、不生成替代画面、不插值造帧；视频按连续 PNG 的文件写入时间编码。失败观察器录像 [FAIL-observer-camera-projection-pause-freeze.mp4](../../test-output/r2-time-contract/videos/FAIL-observer-camera-projection-pause-freeze.mp4) 原样保留，FAIL 指观察口径失败，不能误读为最终世界仍在偷跑。

关键截图：[正式 Town](../../test-output/r2-time-contract/cycle/screenshots/03-town.png)、[×4 选项](../../test-output/r2-time-contract/cycle/screenshots/20-speed-selected-x4.png)、[关门暂停](../../test-output/r2-time-contract/cycle/screenshots/32-closing-paused-after.png)、[正常结算](../../test-output/r2-time-contract/cycle/screenshots/33-settlement.png)、[下一天](../../test-output/r2-time-contract/cycle/screenshots/34-next-day.png)、[接敌暂停前](../../test-output/r2-time-contract/cycle/screenshots/43-contact-pause-before.png)、[暂停后](../../test-output/r2-time-contract/cycle/screenshots/44-contact-pause-after.png)、[自然全灭结算](../../test-output/r2-time-contract/cycle/screenshots/46-wipe-settlement.png)。

环境：[Windows] Godot `4.7.2.stable.official.ed1daf0bf`，Compatibility／RTX 3060／OpenGL NVIDIA 591.86，1600×900，Dummy 音频；Python 3.13.5、Node v26.4.0（不符仓库 Node 22.x，未调整）、Git 2.39.1.windows.1。Blender 未使用。[macOS] 无可访问环境，未验证。

APPDATA／LOCALAPPDATA／TEMP／TMP 均指向 E/profile；真实玩家保存未使用。驱动验证 OS 用户目录在该 profile 下，正式 Run 位于 `user://test-runs/r2-main.json`。窗口 `(-3000,-3000)`、unfocusable，不注入系统键鼠或接管用户窗口。

最终 41 项交付检查 PASS，见 [final-checks.json](../../test-output/r2-time-contract/final-checks.json)：运行代码与测试副本 SHA-256 一致，正式 UI／结算／保存及视频格式、解码均已核对。保全记录见 [preservation-verification.json](../../test-output/r2-time-contract/preservation-verification.json)：源码变化仅为本阶段列出的 11 个文件，其他原始源文件、G0／G1／R1 成果及暂存入口保持；原缓存／build／历史证据的大小与 mtime 无变化。元数据核对不冒称大型二进制逐字节验证。

定向编码、Git 空白、报告本地链接检查 PASS。本轮启动的 Godot 进程已全部退出，未关闭用户进程。已在 PLAN 当前入口补充 R2 事实和发布阻断，历史阶段原文保留。运行验收通过不消除第 6 节的完整构建、旧效果／武器／搜索断言和 R3／R4 风险。
