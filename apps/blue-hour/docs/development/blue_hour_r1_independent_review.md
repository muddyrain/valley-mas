# Blue Hour R1 — 独立代码审查与构建门禁诊断

日期：2026-10-19（Asia/Shanghai）。平台：**[Windows] Windows environment required**。

**建议进入 R2，保持发布 BLOCKED。** 未发现证据充分的 R1 新增 P0/P1 源码缺陷；本轮独立复跑日循环专项为 **26 checks / 0 failures**。构建失败已定位到指令线 **20 Hz 重绘节流与逐模拟帧精确位置断言不一致**，并取得原始测试独跑失败、构建前序复放失败及相位对照证据。没有修改实现或断言，没有绕过门禁导出。

独立 code-reviewer 建议 **COMMENT**，architect 状态 **WATCH**，合并审查建议 **COMMENT**；这表示可继续针对已知问题开发，不表示可以合并为发布就绪版本或交付新 EXE。

## 1. 范围、基线与保全

- 游戏根：`D:/my-code/valley-mas/apps/blue-hour`。本报告的代码位置均相对该目录。
- HEAD：`8004ebabc6823c1c238045bf5406916879ed134b`；分支 `master`，跟踪 `origin/master`，未 fetch。
- 开始时已有暂存项 `T  AGENTS.md`、`M  CLAUDE.md`；未暂存项 `docs/PLAN.md`、`missions/mission.gd`、`encounter/encounter_director.gd`；四份未跟踪 development 报告和新增 `tests/mission_dayloop.gd` / UID。**审查了磁盘实际内容、未暂存 diff 和未跟踪测试，不只比较 HEAD。**
- 已读取根 AGENTS / CLAUDE、Blue Hour AGENTS / PROJECT_CONTEXT、项目验证规则及三份指定背景报告；目标路径未发现更深层 AGENTS / override。GitNexus 无可调用工具，回退原生 Git 与源码调用追踪；未重建索引。未发现可读取的 Superpowers SKILL.md，不宣称已启用。
- 按 code-review skill 分为独立正确性审查和架构审查；主审另行调查门禁、核对结论。Godot 规则用于现有代码语义核对，encoding-guard 用于唯一新增的中文报告。
- 唯一新增正式文件是本报告，按本次指定路径交付；不另外生成第二份执行报告。未修改源码、场景、资源、测试断言、配置或现有计划；未暂存、提交、切分支或清理工作区。

本轮证据根 **E** 为 `test-output/r1-independent-review/`。以实际工作区复制 **3,098 文件**，逐文件 SHA-256 核对，所有运行位于 `E/sandbox/project/`。为缩短诊断准备，复用了之前隔离工程的 `.godot` 缓存；**本轮没有重新证明全新导入通过**，也未在原工程运行 Godot。快照、源哈希与缓存来源见 [snapshot.json](../../test-output/r1-independent-review/snapshot.json)、[source-manifest.json](../../test-output/r1-independent-review/source-manifest.json)。

子进程 APPDATA / LOCALAPPDATA / TEMP / TMP 指向 E 内独立 profile；构建前序复放的三个进程刻意共用一个新 profile，其余相位实验分别隔离。探针实际打印了 E 内 `OS.get_user_data_dir()`。原生窗口屏幕外、unfocusable，只使用原测试的 Viewport 合成输入；未操作用户窗口或玩家存档。

## 2. R1 代码审查结果

核心审查：[mission.gd](../../missions/mission.gd)、[encounter_director.gd](../../encounter/encounter_director.gd)、[mission_dayloop.gd](../../tests/mission_dayloop.gd)。调用链联查涵盖 SearchTask、Survivor / Enemy、AmbientThreat、MissionClock、MissionHUD、Town adapter / navigation、Main、Ledger、Campaign、SaveStore、效果规则及相关测试。

| 检查项 | 结论、位置与边界 |
| --- | --- |
| Town / City 共用时钟、终局 | `mission.gd:322–391`：两种 provider 进入同一 `_advance_world`。Clock 仅在 355 行 advance；全灭在 381 行附近检查，之后才进行撤离更新。导航未就绪的 Town 在 337 行返回。`action_elapsed` 在 353 行累计，修正原本一直为 0 的时长。 |
| 时钟或搜索双推进 | 未发现。SearchTask 仅在 `364–365` prepare、`385–386` advance；prepare 处理抵达/进入/防御，进度累计在 `search_task.gd:159–188` 的 advance。Town 原先的重复分支已删除。效果到期切片可能多次进入 `_advance_world`，但传入时长是同一帧的分片，并非每次使用整帧 delta。 |
| Enemy / Noise 双推进 | 未发现。`mission.gd:343,375` 排除 Town；Town 的 tick 在 `ambient_threat_runtime.gd:36–52`。两路 `refresh_stats` 不是两路 tick：`enemy.gd:109–121` 依据基础参数重算，未累加时钟或重复造成伤害。暂停/倍速差异另列为 R2 风险。 |
| 导演及初始人口 | `mission.gd:230–231` 仍只为 City 调用 `seed_population`；Town 初始人口来自 Ambient 的一次激活。R1 恢复的是周期补充 / 夜间增援，没有重复初始化人口。`encounter_director.gd:139–141` 和撤离使用相同 Town 出口。 |
| 撤离目标与导航拒绝 | `mission.gd:1124–1127` 使用正式 `VehicleExitPoint` 的 `runtime_data.arrival_exit`，City 保留 bus_position。Town `_move_members:698–728` 先验证目标与全员 formation，任一失败就返回，成功后才下发订单；拒绝不会新设 extraction。搜索取消的已有副作用见第 3 节。 |
| 缺员 / 单人 / 零人 | `board_count:1131–1136` 排除室内成员；`_update_extraction:1147–1151` 在缺少存活成员时重置准备时间，不能遗弃迟到者。全灭检查先于撤离，防止 0/0 被当成成功。此次专项覆盖三人 fixture 的缺员与全灭；不将其扩大为重新验证了所有队伍规模。 |
| 关门与终局幂等 | 关门设置 boarding 后，Survivor 移动、伤害入口及 Enemy 选人均保护上车成员。`mission.gd:1164–1187` 在发 completed 前设 active=false；`run_ledger.gd:49–52` 的 settled 防重复入账；`campaign.gd:302–309,327–329` 以 mission / pending 状态保护暂存结果及确认日结。反复 E 可以重发归航、重置准备，不能重复 completed / 日结。 |
| 保存、成员身份、武器 UID | `mission.gd:206–214` 仍按 member_id 查 equipment UID，再取武器个体；`1177–1186` 返回成员实例 ID。`campaign.gd:403–422` 校验返回/阵亡集合完整唯一、装备奖励 UID 合法且不重复。Main 继续先保存 pending、再提交并保存日结（`main.gd:705–718`）；R1 未修改 schema、SaveStore、成员绑定和装备序列化。未发现 R1 引入身份替换或 UID 混用。 |

以上是当前实现和有限运行证据支持的结论，不是对所有 seed、所有成员/装备、保存迁移及磁盘故障的全面保证。R1 报告中的正常归航、自然昼夜、真实全灭和保存证据作为既有运行资料核对，本轮没有重新操作整段正式 main 流程。

## 3. 发现的问题与严重程度

分级：P0 紧急数据/成果破坏；P1 核心流程或发布门禁阻断；P2 局部正确性或回归保护缺口。**未确认 P0，未发现 R1 新增 P1 源码缺陷。**

### F1 — P1：指令线门禁依赖未同步的重绘相位（既有机制，本轮证实）

位置：`tests/survivor_command.gd:69–78`；`missions/world_interaction_vfx.gd:39,62,79–87,189–205`。

触发：测试手动推进 Mission 与 VFX 各 1/30 秒，在 `frame == 2` 要求线头与当下脚部距离 < 0.001m；VFX 几何实际只在累计 1/20 秒时重绘，计时余量来自此前真实渲染帧。第三次手动调用未必触发重绘。影响：正常节流下可产生约一模拟帧的几何滞后，导致整条 build 在导出前退出。详见第 4 节，不将这项失败归因于 Town 搜索或结算回归。

### F2 — P2：新增日循环专项未接入标准门禁（R1 交付缺口）

位置：`tests/mission_dayloop.gd:4–89`；`run.ps1:140–151,253–261`。

触发：运行 `-Mode test` 或 `-Mode build`。两种入口均未引用该新增测试，原有大量 City 测试不能替代 Town。影响：未来再引入 Town 提前 return 等故障时，新建的 26 项回归不会阻止标准构建。最小建议是在后续授权下将该专项加入 test/build；本轮不改配置。

该专项也未创建实际搜索任务并断言搜索进度增量，未量测 Enemy / Noise 的单次推进；它关闭 Ambient 并手动 tick Mission。当前“无双推进”结论包含静态调用链证据，不能仅用 clock exactly once 一项外推所有系统都已经动态覆盖。

### F3 — P1：Town 暂停 / 倍速时间契约仍分裂（已知 R2）

位置：`mission.gd:322–355`、`ambient_threat_runtime.gd:36–50`、`ui/mission_hud.gd:859–863`。

触发：Space、Esc、设置、Debug 暂停，或 ×2/×4。Mission 使用 delta × time_scale，而 Ambient 只检查 mission.active，使用原始 delta。影响：暂停时敌人/噪声继续推进；倍速时幸存者、搜索、昼夜/增援与敌人运动攻击比例不一致。V0 已有暂停移动与伤害运行证据；倍速不一致目前是代码推导，尚未在本轮量测速率比。R1 接通 clock/director 后扩大了这一既有时间契约的表现面，没有根治它。

最小建议：R2 明确唯一模拟 dt 来源及暂停边界，覆盖四种暂停入口、恢复、×1/×2/×4、敌人伤害/搜索/Noise/技能到期；避免仅让 HUD 标签暂停。HUD.setup 创建 Ambient 的业务副作用仍存在，无 HUD 的 Town fixture 不等同于真实 App。

### F4 — P2：Town 默认避让跳过腕表归航加速（遗留静态缺陷）

位置：`mission.gd:431–478`；`data/effects/old_watch.tres:11–16`。

触发：默认 Town 避让启用、装备旧腕表、进入预警期并沿路径靠近巴士。Town 分支在 467 行提前 return，无法执行 468 行之后的 return_speed 判定。影响：预警可以显示，但 +12% / +18% 归航移速不生效。该分支在 HEAD 已有，未被 R1 修改；本轮未做腕表实机验收。最小建议是让避让计算得到的 speed 继续经过公共归航加速判断，并补 Town 效果回归；不需要重写导航。

### 导航拒绝的已有副作用（WATCH）

`command_extract:1119–1127` 在验证归航路线前已 `_release_tasks()` 并 reset controls；导航拒绝会留下“搜索已取消、归航未开始”。这不是 R1 新增的取消顺序，也不构成当前成功路线被阻断的证据。若产品要求拒绝时保留原命令，后续应先规划、成功后再提交取消；至少补充导航未就绪、无效出口、某成员不可达的失败路径验证。重复归航失败时还应观察此前 extraction 状态，不能只测第一次成功。

## 4. 构建门禁调查

### 4.1 实际执行顺序与历史证据

`run.ps1:24–31` 的 Invoke-Engine 每次启动独立 Godot 进程，收集退出码及 ERROR / SCRIPT ERROR；任一失败就 throw。build 分支的关键顺序是：

1. `run.ps1:204` 导入。
2. `205` 原生 `search_gameplay.gd`。
3. `206` 原生 `expedition_hud_phase2.gd`。
4. `207` 原生 `survivor_command.gd`。
5. 后续其他回归，包括 `256` 的 search_dispatch；`272` 才 export-release。

R1 两次 build 的 stdout/result 均保留：Search Gameplay **72/0**、Phase2 **265/0** 后，Survivor Command **45/1**，在第 78 行报同一个错误并 exit 1。尚未执行到 search_dispatch 或导出。日志见旧证据 `test-output/r1-town-dayloop/logs/build*`，包括 [build-final.stdout.log](../../test-output/r1-town-dayloop/logs/build-final.stdout.log)、[build-final.result.json](../../test-output/r1-town-dayloop/logs/build-final.result.json)。

R1 的三次独跑 PASS 也是真实记录：修复前后 `--max-fps 30` 各一次、修复前不限帧一次。它们不能证明独跑必过，也不能证明构建前序必然污染环境。本轮原始测试独跑已获得同一失败。

### 4.2 本轮实验

未改任何原测试文件或断言。额外观察器仅在副本 `validation/command_observer.gd` 继承原测试，记录进入 verify_feedback 的计时余量、断言时几何、重绘数和生命周期；check 始终交给原实现。相位实验只设置运行时计时余量，不调整世界、路径、FPS 逻辑、几何算法或断言容差。它们是诊断，不算原门禁 PASS。

| 实验 | 结果 | 断言时证据 |
| --- | --- | --- |
| 原始测试、不限帧、全新独立 profile | **45 checks / 1 failure**，exit 1 | 原文件第 78 行相同失败；无前序测试，已足以说明前序污染并非必要条件。 |
| 30 FPS，计时余量设为 0 ms | **45/1**，exit 1 | 第三次调用后仅新增 1 次重绘，余量接近 50 ms 边界，gap=0.09235954m。边界对浮点余量敏感。 |
| 30 FPS，余量设为 10 ms | **45/0**，exit 0 | 新增 2 次重绘，第三次调用刷新几何，gap=0。 |
| 30 FPS，余量设为 40 ms | **45/1**，exit 1 | 同样新增 2 次重绘，但发生在前两次调用；第三次不重绘，gap=0.09235954m。仅统计重绘总数仍不足。 |
| 同一新 profile，依 build 顺序复放 Search Gameplay → Phase2 → 原测试加观察器，不限帧、不强制相位 | **72/0 → 265/0 → 45/1** | 自然进入循环的余量 **41.9796667 ms**；断言 gap 同为 0.09235954m，符合 40 ms 对照的机制。 |
| 原始 `mission_dayloop.gd`，Headless | **26/0**，exit 0 | Town / City 均通过；与指令线失败分离。 |
| 原始 `search_dispatch.gd`，Headless | **56/2**，exit 1 | 第 120、167 行的两项既有失败原样重现。 |

准确参数、退出码及耗时在 E 的 `logs/*.result.json`；对应 stdout / stderr / engine.log 一并保留。原始独跑见 [original-uncapped.stderr.log](../../test-output/r1-independent-review/logs/original-uncapped.stderr.log)，相位对照见 [phase-010.stdout.log](../../test-output/r1-independent-review/logs/phase-010.stdout.log)、[phase-040.stdout.log](../../test-output/r1-independent-review/logs/phase-040.stdout.log)，前序复放见 [prefix-observer.stdout.log](../../test-output/r1-independent-review/logs/prefix-observer.stdout.log)。

### 4.3 已证实的机制

`WorldInteractionVFX` 自动 `_process` 在 hover / click / frames 等等待期间累计真实渲染 delta。`verify_feedback:69` 关闭自动 process 后，仍保留这个余量；随后每次手动执行 Mission 移动、VFX `_process(1/30)`。几何并不保证每次调用都更新：50 ms 节流与 33.333 ms 手动步长不同步，是否在第三次重绘取决于已有相位，精确边界还受浮点误差影响。

前序复放断言时，当前脚部为 `(-16.552086, 0.045, 37)`，线头仍为 `(-16.644445, 0.045, 37)`。两者高度相同，差异在移动方向；guard.current_speed=2.8，数量级符合一个 1/30 秒移动步长。相位 10 ms 时同一路径、同一断言 gap=0。这直接支持“网格仍是上次重绘的位置”，不支持地面高度错位或队员被另一物理循环重复推进。

VFX 的 20 Hz 节流在本次 R1 前已存在，且 [P02 报告](../EXPEDITION_RUNTIME_PERFORMANCE_P02_REPORT.md) 明确记载它是性能优化。`survivor_command.gd` 和 VFX 本轮 R1 diff 均未改动。**已证实的是既有节流与断言的契约冲突；R1 历史两次 build 没有相位遥测，不能追溯宣称其每次失败的相位也恰好是 41.98 ms。**

### 4.4 其他因素的判定

| 因素 | 结论 |
| --- | --- |
| 帧率 / 真实等待 | 是重绘初始相位的来源之一。30 FPS 对照仍可一过一败，固定 30 FPS 不能作为可靠修复。VSync、驱动/缓存、调度和截图 I/O 对相位的具体贡献尚未分离量测；不宣称“GPU 变慢”是根因。 |
| 共享进程状态 | 各 Invoke-Engine 为独立进程，Node、Resource 内存、SceneTree 和合成输入不会直接跨进程继承。失败 fixture 为 FIXED_LEGACY，Mission 自动 physics 已关闭；Town Ambient 的 R2 问题不能直接解释该断言。 |
| 共享磁盘环境 | 实际存在：`maps/exploration.gd:36–40` / `exploration_state.gd:5–25,56–76` 保存同地图探索记录到 user://exploration。Phase2 与 Survivor fixture 使用同 seed；不能泛称测试完全无共享状态。此类状态可能影响显示/耗时，但原始测试在新 profile 独跑仍失败，且只调相位即可翻转结果，故尚无证据把探索记录认定为本断言的语义根因。 |
| 设置 / 存档污染 | 前三项直接创建 Catalog / Campaign / Mission，HUD.setup 未传 preferences；未调用 Settings 保存或读取正式玩家 Run。输出主要为各自 test-output JSON / PNG 和探索记录。未发现前序写脚本、资源或配置；本轮原文件哈希亦保持。 |
| 指令线生命周期 | 失败探针 line_count=1、自动 VFX process=false，elapsed 约 0.166s（前序复放）或 0.400s（30 FPS 对照），均 < 0.8s；实体有效且 mesh 有 surface。本次不是 queue_free 后访问、死亡/上车清线或错误接收者。原测试的消隐及 0.8s 清理检查仍执行。 |

## 5. search_dispatch 两项既有失败

| 位置 | 失败断言 | 判断 |
| --- | --- | --- |
| `tests/search_dispatch.gd:120` | `A nearby scavenger no longer lends their trait to another searcher` | 当前交互耗时经 `mission.gd:499–504` 的 effects / TraitRuntime 计算，旧断言直接以 talent.search_multiplier / site.search_seconds 推导一秒增量。这是需要核对 fixture、效果与新 Trait 契约的线索；本报告没有证明具体是哪项造成偏差，不能直接删断言或归咎于附近成员。 |
| `tests/search_dispatch.gd:167` | `Former worker reaches the bus and casualty settlement completes` | 是旧 City 在“搜索召回 → 中途停住成员 → 等待 → 重发归航 → 30s”后未满足预期人数/终局的联合断言。仅凭失败无法区分路径、时间预算和前序状态；本轮不将其包装成 Town arrival_exit 回归。 |

R1 留存的 `legacy-baseline-search_dispatch` 和 `legacy-search_dispatch` 均为 **56 checks / 2 failures**，错误文本相同，分别覆盖修复前后。原始错误可见 [legacy-baseline-search_dispatch.stderr.log](../../test-output/r1-town-dayloop/logs/legacy-baseline-search_dispatch.stderr.log)、[legacy-search_dispatch.stderr.log](../../test-output/r1-town-dayloop/logs/legacy-search_dispatch.stderr.log)。这些是定向运行结果；完整 build 因更早失败尚未到达该项。两项保持未解决，未修改断言。

本轮也在新隔离副本定向复跑，仍为 **56 checks / 2 failures、exit 1**，同样只报告第 120 / 167 行这两项。见 [headless-search-dispatch.stderr.log](../../test-output/r1-independent-review/logs/headless-search-dispatch.stderr.log)。本轮未复跑修复前版本，其对照来自 R1 留存日志。

## 6. 最小修复建议与 R2 门槛

建议按问题分别处理，不重新开发 R1：

1. **指令线门禁**：后续明确契约为“每次实际重绘时线头正确，更新间隔受控”，在确定发生重绘后保留脚部精度断言；另用多个初始相位验证节流及 0.8s 清理。不要仅增加任意 sleep、强锁 30 FPS、放宽成大容差、吞 ERROR，或删除失败断言。若产品要求线头每帧严格贴脚，则应局部更新线头并保留昂贵几何的节流，评估成本后再改；不建议为一个测试直接撤回整套性能优化。本轮未实现任何方案。
2. **R1 回归接入**：把 mission_dayloop 纳入正式 test/build，补导航拒绝与搜索/Noise 单次量的针对性覆盖；原生正式闭环继续保留为不同证据层。
3. **R2**：优先统一 Mission / Ambient 时间来源及生命周期，明确加载未就绪、暂停、恢复、倍速的共同边界。腕表提前 return 可在触及移动/时间边界时一并评估，避免扩大为导航重构。
4. **剩余门禁债**：独立诊断 search_dispatch 两项及 V0 已证实的营地 UI / 旧 Trait 契约失败。指令线绿只解除第一道阻断，不代表后续全部通过。完整 run.ps1 build、导出和新 EXE 独立启动均须实际重新通过，才可解除发布 BLOCKED。

**进入 R2：建议可以。** 当前 R1 的共享时钟、归航/全灭、唯一结果链路没有发现需先推倒的新增缺陷，且 R2 正是已知最高风险时间契约的后续任务。进入 R2 时应固定本次工作区快照与失败基线；不能把开发阶段推进写成 R1 全量构建完成。本报告不授权执行这些修复。

## 7. 验证、交付与限制

- 本轮新执行的是隔离定向测试、相位实验及 build 前三个运行测试的同序复放；**未重新执行完整 run.ps1 build，未导出或启动新 EXE**。使用既有 R1 两次完整 build 日志确认其真实停止位置，没有将前序复放冒充完整构建。
- 未重做正式 main 闭环、多 seed 平衡、暂停/倍速实机、腕表效果、保存迁移/损坏/写入失败、音频、性能或全部测试。截图 I/O 和耗时只作诊断上下文，不作为性能基准。
- [Windows] Godot 日志为 `4.7.2.stable.official.ed1daf0bf`，Compatibility / RTX 3060 / OpenGL NVIDIA 591.86；Python 3.13.5，Node v26.4.0（context:recent 提示不符仓库 Node 22.x 约束），Git 2.39.1.windows.1。Blender 未使用。[macOS] 无可访问环境，Godot / Blender / Node / Git 均未验证。
- 不同步既有 PLAN：本轮只独立评价和记录证据，没有改变实现或阶段交付状态，且用户禁止修改现有配置和源码；所有建议留在本报告。R1 报告仍保留“运行闭环通过 / 构建阻断”的边界。
- 保全检查见 [preservation.json](../../test-output/r1-independent-review/preservation.json)，最终报告编码、链接与其他交付核对见 [final-checks.json](../../test-output/r1-independent-review/final-checks.json)。保全按源文件 SHA-256、根规则/索引哈希及原缓存/构建/已有证据的大小和 mtime 核对；后者不冒称大型二进制逐字节验证。所有本轮启动的 Godot 进程已结束，不关闭用户进程。
