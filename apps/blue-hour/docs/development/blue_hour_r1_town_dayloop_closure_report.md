# Blue Hour R1 — Town 归航闭环修复

日期：2026-10-19（Asia/Shanghai）。平台：**[Windows] Windows environment required**。

**R1 游戏主循环运行验收 PASS；Windows 完整构建及新 EXE 交付 BLOCKED。** 已完成真实搜刮、归航、唯一结算、下一天、自然昼夜、自然来敌造成全灭和保存核对；发布门禁失败仍保留，不宣称本阶段已完成发布交付。

## 1. 范围与工作区

Monorepo 为 `D:/my-code/valley-mas`，游戏根为 `apps/blue-hour`。HEAD 为 `8004ebabc6823c1c238045bf5406916879ed134b`，分支 `master`；未 fetch、切分支、暂存、提交、push、reset 或 stash。

开始时已有 `T  AGENTS.md`、`M  CLAUDE.md` 两项暂存改动，以及 G0、基线审计、V0 三份未跟踪报告。本轮保留这些成果，不重新执行全工程审计。已读取共享规则、游戏局部规则、PROJECT_CONTEXT 和两份指定报告；未发现更深层 AGENTS/override。没有可调用 GitNexus 工具，使用原生 Git、调用点和数据消费检查回退；未伪造 impact 结果或重建索引。

使用 Godot、delivery-reporting、task-completion-guard 和 encoding-guard skills。Superpowers 残留目录未提供可读取的相关 SKILL.md，未宣称已启用。

本报告的证据根目录简称 **E**：`apps/blue-hour/test-output/r1-town-dayloop/`。以当前磁盘内容建立独立副本，逐文件 SHA-256 核对；原缓存、build 和 V0 证据不用于替代本轮运行。见 [snapshot.json](../../test-output/r1-town-dayloop/snapshot.json) 和 [source-manifest.json](../../test-output/r1-town-dayloop/source-manifest.json)。

## 2. 调用关系与根因

```text
main.tscn → Main：菜单 / 营地 / 今日行动 / 分阶段加载
  → Mission.setup → MapProvider → MEDIUM_TOWN_V1 / TownRuntimeAdapter
  → Mission._physics_process → _advance_world
      → MissionClock → warning / phase signals → Atmosphere / Sound / HUD
      → EncounterDirector → spawn validation / existing Enemy pool
      → Survivor / SearchTask / pickups / extraction / all-dead check
  → Mission.completed → Main._mission_complete → Campaign.stage_result
      → SaveStore：pending + checksum
      → Settlement 的确认按钮 → Main.return_to_shelter
      → Campaign.commit_day → SaveStore → 营地 / 下一天

Town：AmbientThreatRuntime 仍负责 Noise 和 Enemy.tick
City：Mission 仍负责 Noise 和 Enemy.tick
```

P1-01 的第一根因是 Town 搜索/移动分支提前 return，绕开既有时钟、全灭、撤离与结算。复用共享流程后，真实操作又暴露两个同源阻断：

1. `command_extract()` 向巴士碰撞体中心下发移动，收到 `INVALID_NAVIGATION_TARGET` 后仍显示归航；搜刮后的队员无法回车。
2. `EncounterDirector.valid_spawn()` 同样要求存在通向巴士中心的路径，导致 Town 夜间增援全部被拒绝。

两者都改用 Town 已有的 `runtime_data.arrival_exit`，即正式巴士 `VehicleExitPoint`。没有放宽碰撞、开导航洞、传送队员、调时段配置或新建昼夜/结算系统。

影响分析：`_advance_world` 由 Mission 物理调度及少量效果测试消费；共享推进影响两张地图。`command_extract` 由 SquadInput 的 E / 巴士交互调用；`valid_spawn` 被既有初始人口与边缘增援调用。因此分别验证 Town 和 FIXED_LEGACY；旧地图继续使用原巴士目标。

## 3. 实际修改

| 文件 | 修改与原因 |
| --- | --- |
| [missions/mission.gd](../../missions/mission.gd) | 移除 Town 重复搜索推进分支，共享时钟、预警、导演、搜索、全灭、撤离路径；导航未就绪不推进。Town 不重复 tick 敌人或 Noise。启用既有导演；同步累计真实行动时长。Town 归航使用已有出口，移动拒绝时不进入撤离准备。 |
| [encounter/encounter_director.gd](../../encounter/encounter_director.gd) | Town 出生点的可达性验证改为巴士出口；City 路径不变。 |
| [tests/mission_dayloop.gd](../../tests/mission_dayloop.gd)、对应 UID | 新增受控回归，覆盖两种 provider 的单次时钟推进、蓝时、夜晚威胁、实际增援、缺员等待、行走到位、准备/关门、唯一结果、全灭丢失物资。 |
| [docs/PLAN.md](../PLAN.md) | 在当前状态入口记录 R1 结果与构建阻断；不重写历史阶段断言。 |
| 本报告 | 按用户指定路径保存唯一交付报告，不重复生成第二份执行报告。 |

`Main`、`MissionClock`、`Campaign`、SaveStore 和正式数据 Resource 均复用原实现，未修改其 schema、身份绑定、武器 UID、保存事务或 once-only status 保护。未改 R2 暂停、R3 结束页、R4 营地 HUD、美术资产或其他子项目。

## 4. 测试先行与回归

受控回归与真实操作分开记录。受控测试可以固定位置、关闭敌人、手动推进 Mission 或施加伤害，用于定位边界；**不能作为真实流程录像的替代**，也没有直接调用 `_finish()`、`stage_result()` 或 `commit_day()` 伪造流程。

| 验证 | 实际结果 | E 内日志 |
| --- | --- | --- |
| 全新副本 import | PASS，exit 0，196.721s | `logs/import.*` |
| 首次修复前 | 18 checks / 8 failures，Town 时钟和终局不推进 | `logs/legacy-red-dayloop.*` |
| 巴士中心目标回归，修复前 | 20 checks / 1 failure | `logs/legacy-red-return-target.*` |
| 夜间增援回归，修复前 | 26 checks / 1 failure，Town 无法增援 | `logs/legacy-red-night-spawn.*` |
| 最终专项 | **26 checks / 0 failures** | `logs/legacy-green-night-spawn.*` |
| Clock / rules / Campaign day loop | 7 / 19 / 43 checks，全部 PASS | `logs/legacy-encounter_clock.*`、`legacy-rules.*`、`legacy-day_loop.*` |
| Parallel commands | 36 checks / 0 failures | `logs/legacy-parallel_commands.*` |
| 旧 City search_dispatch | 56 checks / 2 failures；修复前源码同样两项失败 | `logs/legacy-search_dispatch.*`、`legacy-baseline-search_dispatch.*` |
| 旧原生 Survivor command，30 FPS | 修复前后均 45 checks / 0 failures | `logs/legacy-native-{baseline-,}survivor_command.*` |

旧搜索失败为“A nearby scavenger no longer lends their trait to another searcher”和“Former worker reaches the bus and casualty settlement completes”。保留失败，未修改断言使其变绿。

测试开发期间曾把三人 fixture 的出生点当成全部已在上车半径内，导致 3 项错误断言；现改为让队员实际沿归航路径进入范围。中间失败日志全部保留，不计为最终 PASS。

## 5. 正式 main.tscn 操作验收

独立进程实例化 `res://core/main.tscn`，由正式 `_ready`、UI 信号、Ready Gate 和引擎物理调度推进。仅向其 Viewport 推送 device 42 键鼠输入；没有手动 tick Mission、改时钟、改血量、开无敌、生成 Debug 敌人或内部调用结算。菜单“继续”重载本次正常创建并保存的 Run，不是结束存档 fixture。

最终代码的完整序列：主菜单 → 继续 → 第 2 天营地 → 今日行动 → 商业街 → Medium Town → 移动/搜刮/拾取 → E → 步行归航 → 2/2 到位 → 8 秒准备 → 1.4 秒关门 → 结算 → 点击确认 → 第 3 天营地。

第 2 天开始为食物 6 / 废料 5；该次实际搜刮为 **0 食物 / 3 废料**，结算用时约 41.117 秒；两名成员返回，扣 2 口粮，进入第 3 天为 **食物 4 / 废料 8**。历史记录从 1 条变为 2 条，Mission completed 只增加一次。pending 与确认后存档均验证 envelope SHA-256、完整 payload、成员身份及资源账目。

证据：[closure-checks.json](../../test-output/r1-town-dayloop/acceptance/closure-checks.json)、[正式 trace](../../test-output/r1-town-dayloop/acceptance/trace.json)、`E/saves/day-2-pending.json`、`day-3-camp.json`；截图在 `E/acceptance/screenshots/01-camp.png`～`10-next-day.png`。最终会话 `logs/acceptance.*` 与最终观测结果作为完成依据。营地固定 HUD 数字仍属于 R4 已知问题；跨日和库存以 Campaign 与真实保存核对，不以固定展示值证明。

早一轮第 1 天也正常带回 2 食物 / 5 废料并进入第 2 天；重启后资源、成员和历史一致。其结算后观察器错误访问已移除 HUD，产生 `validation/driver.gd` 错误；随后修正了观察器，并用最终代码重新完成上述无该错误流程。没有隐藏这份失败日志，也没有把观察器异常归因于游戏实现。

### 自然昼夜、全灭与保存

最终 Run seed 为 **57930457**；第 2 / 3 天正式 Town seed 分别为 **58051024 / 58163672**。两个正式加载的全部 Ready Gate 为 true。

| 验收 | 结果与边界 |
| --- | --- |
| 自然白昼 → 蓝时 → 夜晚 | PASS。第 3 天 clock 在约 150.000s / 168.000s 发出 phase 1 / 2；保持 ×1，未设置时段或调用 Clock.advance。 |
| 现有夜间规则 | PASS，所测范围。实际累计生成 107 名导演增援，威胁升至 8，实际击退 31；107 是累计生成数，不是同时人口。预警、阶段与威胁规则另有专项覆盖；没有改配置调难度。 |
| 实际全灭 | PASS。两名队员 HP 100 → 0，living=0，在 clock≈351.55s 进入行动失败结果；非暂停状态，敌人来自自然人口/昼夜导演。 |
| 全灭操作限定 | 先正常自动战斗与可见集火；队伍持续击杀后，使用正式 Ctrl 手动朝空地瞄准约 20 秒，让自然来敌接近。没有生成 Debug 敌人、施加测试伤害、改 HP/位置或调用内部终局。此项证明全灭链路，不评价自然生存平衡。 |
| 全灭掉落与身份 | PASS。行动账本实际携带 1 食物 / 6 废料，pending 带回 0/0，returned_ids=[]、lost_ids 包含两名出勤者。 |
| 唯一结算 / 保存 | PASS。该次只新增一个 completed 事件；确认后 history 从 2→3，status=lost、members=[]；库存仍为食物 4 / 废料 8，未入账本次物资。payload 与磁盘 envelope SHA-256 一致。 |
| 结束页 | R3 已知 FAIL、未修复：确认失败结果后进入 ended，仍为空画面。Mission 的全灭结果与持久化完成不扩张为结束页可用。 |

证据：[night-wipe-checks.json](../../test-output/r1-town-dayloop/acceptance/night-wipe-checks.json)、`E/saves/day-3-wipe-pending.json`、`day-3-lost.json`、`acceptance/screenshots/20-day-warning.png`、`21-phase-{0,1,2}.png`、[满血迎敌](../../test-output/r1-town-dayloop/acceptance/screenshots/30-two-alive-before-wipe.png)、[实际减员](../../test-output/r1-town-dayloop/acceptance/screenshots/30-casualty.png)、`31-wipe-settlement.png`、`32-lost-R3-ended-page.png`。两张战斗截图原样复制自同一录像的连续原始帧；按键等待后采集的 `30-manual-aim-natural-damage.png` 实际已经是结果页，不凭文件名声称它展示受伤过程。

自动监测后以 `finish_wipe.py` 接续同一游戏进程、同一录像进行正式集火/手动瞄准操作。录屏降低推进速度，使 20 秒按键操作的外部 45 秒等待超时；Godot 没有退出或发生脚本错误，随后正常释放按键并进入 result，再由正式按钮确认。超时调用和后续实际状态均保留在工具输出、trace 与原始帧，不把外部等待超时当作游戏通过证据。

## 6. Windows build

已在隔离副本实际执行两次 `run.ps1 -Mode build`，分别为最初共享推进版本和最终生产代码。匹配的 4.7.2 模板仅复制到隔离 profile，未改真实用户存档。

两次 build 均在 `tests/survivor_command.gd:78` 的 **“Line follows the moving survivor's feet”** 停止，exit 1；最终耗时约 133.235s。其前面的 Search Gameplay 72 项和 HUD Phase2 265 项通过。未进入 export，未生成本轮 EXE，也未覆盖原 `build/BlueHourHomeward.exe`，更没有用 direct export 绕过 gate。

该原生断言单独运行时，修复前和修复后在 30 FPS 都通过；修复前无帧率限制的独立运行也通过。**因此本轮不能把 build 失败断定为已证实的旧问题，也不能声称全量兼容通过。** 现象具有时序敏感性，根因与可靠门禁修复仍待专项处理。见 `E/logs/build.*`、`build-final.*`、`legacy-native-baseline-uncapped.*`。

新 Windows 构建及新 EXE 独立启动验收：**BLOCKED**。本报告不提供旧 EXE 冒充新产物。

## 7. 截图、录像与工具

三段正式录像均为真实 1600×900 Viewport 帧，H.264 MP4：

| 视频 | 时长 | 内容 |
| --- | --- | --- |
| [town-day-cycle.mp4](../../test-output/r1-town-dayloop/videos/town-day-cycle.mp4) | 117.00s | 自然预警 / 白昼、18 秒蓝时、夜晚；录像墙钟时间不等于游戏时间。 |
| [town-return-settlement.mp4](../../test-output/r1-town-dayloop/videos/town-return-settlement.mp4) | 35.48s | 最终代码的步行归航、等待、准备、关门、结果和确认后下一天。 |
| [town-wipe.mp4](../../test-output/r1-town-dayloop/videos/town-wipe.mp4) | 48.36s | 从两人满血迎敌到实际受伤、阵亡、失败结算的连续片段。 |

全灭短片截取完整原片约 498.243s 起至首次真实结算帧后约 4 秒；[town-wipe-full.mp4](../../test-output/r1-town-dayloop/videos/town-wipe-full.mp4) 保留全部约 576.12s，未删除等待期间的原始证据。选段元数据见 [wipe-excerpt.json](../../test-output/r1-town-dayloop/videos/wipe-excerpt.json)。

真实失败录像同样保留：[FAIL-return-invalid-navigation-target.mp4](../../test-output/r1-town-dayloop/videos/FAIL-return-invalid-navigation-target.mp4)（119.24s），[FAIL-night-no-reinforcements.mp4](../../test-output/r1-town-dayloop/videos/FAIL-night-no-reinforcements.mp4)（99.20s）。早期观察器恢复流程的原片也保留，未混入最终通过视频。

截图与 PNG 原始帧直接来自真实 Godot Viewport，不重绘、不拼图、不补造结算。按 PNG 文件写入时间编码变帧率视频，不插值生成帧；全灭片段仅连续截取，不拼接不同会话。编码尺寸、帧数、时长见 [metadata.json](../../test-output/r1-town-dayloop/videos/metadata.json)（其中 town-wipe 为截取前原片记录），最终短片参数见 wipe-excerpt.json。三段正式 MP4 完整解码均 exit 0、无错误，见 [decode-checks.json](../../test-output/r1-town-dayloop/videos/decode-checks.json)。录像不能作为 FPS 或性能测量。

关键截图：[正式 Town](../../test-output/r1-town-dayloop/acceptance/screenshots/04-town.png)、[成功结算](../../test-output/r1-town-dayloop/acceptance/screenshots/09-settlement.png)、[下一天营地](../../test-output/r1-town-dayloop/acceptance/screenshots/10-next-day.png)、[自然夜晚](../../test-output/r1-town-dayloop/acceptance/screenshots/21-phase-2.png)、[全灭结算](../../test-output/r1-town-dayloop/acceptance/screenshots/31-wipe-settlement.png)。

观察/输入驱动为 `E/sandbox/project/validation/driver.gd`；工具保留在 `E/tools/`：`snapshot.py`、`launch.py`、`close_loop.py`、`night_wipe.py`、`finish_wipe.py`、`build.py`、`media.py`、`clip_wipe.py`。每次启动参数、耗时和退出码在 `E/logs/*.result.json`。命名为 red / diagnostic / FAIL 的中间失败不纳入最终通过统计。

## 8. 环境、保全与未验证项

| 环境 | 本轮情况 |
| --- | --- |
| [Windows] Godot | 4.7.2.stable.official.ed1daf0bf；Compatibility / NVIDIA RTX 3060，OpenGL 3.3 NVIDIA 591.86 |
| [Windows] 分辨率 / 音频 | 正式流程 1600×900；旧 build UI 用其自身 1920×1080；Dummy 音频，听觉未验收 |
| [Windows] Python / Node / Git | 3.13.5 / v26.4.0 / 2.39.1.windows.1；pnpm context:recent 提示 Node 与仓库 22.x 约束不符，未调整工具链 |
| [Windows] Blender | 未使用；没有运行资源生成或批量清理 |
| [macOS] | 无可访问环境，Godot / Blender / Node / Git 和平台运行均 NOT_TESTED |

所有运行位于 `E/sandbox/project/`，APPDATA、LOCALAPPDATA、TEMP、TMP 独立指向 `E/profile/`；正式输入会话保存于隔离 `user://test-runs/r1-main.json`。驱动验证 OS 用户目录位于该 profile；窗口在 `(-3000,-3000)`、unfocusable，未抢占前台或注入系统输入。

最终游戏进程已退出；未关闭用户进程。保全、定向编码、报告链接、Git 空白及录像存在性检查均 PASS，最终会话无 SCRIPT ERROR / ERROR，见 [final-checks.json](../../test-output/r1-town-dayloop/final-checks.json)。G0 暂存内容和既有三份报告保留；原缓存/build/既有测试输出的大小与 mtime 无变化，不能扩张为这些大型二进制的逐字节哈希证明。测试副本的三个相关代码文件与交付源码 SHA-256 一致。

已在 `docs/PLAN.md` 顶部同步当前 R1 运行结果、构建阻断和后续阶段边界；未执行旧计划，也未新增临时计划集合。

未扩大验收范围：R2 的暂停/倍速一致性、R3 结束页、R4 营地动态 HUD、五日通关、全部地图 seed、全部角色/装备、存档迁移及磁盘故障、音频、性能、macOS、新导出 EXE。当前 R1 运行通过也不等于这些系统通过。
