# Blue Hour R2.1 — 高倍率模拟尾步与动画状态修复

日期：2026-10-19（Asia/Shanghai）。平台：**[Windows] Windows environment required**。

**R2.1 尾步修复及指定运行验收 PASS；Windows 完整构建／新 EXE 仍 BLOCKED。** 正常 ×4 外层物理帧不再产生第五个无意义 tick，Town 和 City 的最终移动速度与 Run 动画均恢复；感染者的动画速度采样也同步恢复。真实技能边界、极短有效时间、暂停和原 R1/R2 回归保持。

本轮的生产修复仅位于 Mission 调度；没有修改 Mixamo、动画控制器或 Run 播放倍率。工作期间另有并行动画线程修改了动画循环、1.45 播放倍率和相关测试，已保留并单独记录。**本报告的修复前后对照、原专项和正式录像都在这些动画修改之前的隔离快照完成，因此没有借用其倍率或资源调整掩盖 F1。** 后续合并快照检查另行列出。

## 1. 范围与基线

Monorepo：`D:/my-code/valley-mas`，游戏：`apps/blue-hour`；HEAD `8004ebabc6823c1c238045bf5406916879ed134b`，分支 `master`。已读取根 AGENTS／CLAUDE、游戏 AGENTS／PROJECT_CONTEXT、长期游戏设计契约及 R2 交付／独立审查报告；没有更深层规则。使用 Godot、task-completion-guard、delivery-reporting 和 encoding-guard；GitNexus 无可调用工具，以原生 Git 与调用点核查回退，未伪造 impact 结果。

保留小队自动战斗、战术指挥、Space 暂停可下令、WASD 镜头、暮色延缓的局部冻结、五日归航及现有唯一结算。没有启动 R3、R4 或新玩法。

证据根 **E**：`test-output/r2-1-animation-tailstep/`。从本轮磁盘建立 3,104 文件快照，并在 `E/sandbox/current/` 运行；复用了先前隔离工程的 `.godot` 缓存。正式视频运行前没有声称全新导入；后续完整 build 实际执行了其导入阶段。子进程 APPDATA／LOCALAPPDATA／TEMP／TMP 均在 E/profile 内，正式运行保存于隔离 `user://test-runs/r21-main.json`，没有使用玩家保存。

初次复制期间，并行线程更新了 `docs/reports/2026-10-19_anim_a0_movement_audit.md`，导致逐文件哈希检查中止；没有覆盖该文档。保留原快照并记录差异后继续复制，见 [concurrent-source-updates.json](../../test-output/r2-1-animation-tailstep/concurrent-source-updates.json)。第一次测试启动因副本尚不完整而失败，日志 `red-substeps.*` 保留，不作为产品红测；有效红测为 `red-substeps-ready.*`。

起始 Git 状态及源哈希：[snapshot.json](../../test-output/r2-1-animation-tailstep/snapshot.json)、[source-manifest.json](../../test-output/r2-1-animation-tailstep/source-manifest.json)。G0/G1、R1/R2 未提交成果与新增测试均作为基线保留；没有 commit、push、reset、stash、暂存、切分支或批量清理。

## 2. 根因、调用关系与最小修复

```text
引擎物理 delta → Mission.simulation_delta：乘一次局部倍率
  → _physics_process：1/60 上界 + SpecialPower.next_expiry 分片
  → _advance_world(dt)
      → Periodic / Clock / Director / Search / Survivor
      → simulation_advanced(dt) → Town Ambient Noise / Enemy
      → City Enemy（Town 排除）→ 全灭 / 搜索 / 拾取 / 撤离
  → powers.advance(dt)

Survivor._move → 位移 / dt → actual_velocity
  → update_motion → 最后采样的 _motion_speed → 正式渲染动画消费者
Enemy._move_path → moved / dt → infected animation speed_scale
```

原循环在 ×4／60Hz 下连续减去四个 1/60，剩下约 **6.938893903907228e-18 秒**；`while left > 0` 把它再次送入所有模拟系统。Survivor 移动积分忽略 ≤1e-6 的微小时段，后续却仍写零位移速度；最终渲染读到零，切为 Idle。感染者同样在尾步得到零位移，追逐动画倍率被压至最低约 .9。本轮红测对两者均取得动态证据。

修复只改变子步预算分配：

- 定义 `SIMULATION_ROUNDING_TOLERANCE = 8 × double machine epsilon`，是相对于当前剩余区间的舍入容差，**不是固定“丢弃小 delta”阈值**。
- 在进入 world tick **之前**，若 `left-dt` 只有舍入量，且 `next_expiry >= left`，令 `dt=left`，把完整余量消费在当前有效子步中；之后 left 正好归零。
- 只要剩余区间内存在真实技能／冷却到期边界，就不合并跨越它。独立的极短帧仍进入模拟，真实边界后的极短余量也仍消费。
- 原来的 City 到站外层阶段、唯一时间来源、暂停／Ready Gate／inactive 判断及各地图 Enemy／Noise 所有权不变。没有新增全局时钟、积压时间或动画补偿。

最终子步可能比 1/60 大几个浮点舍入位，而非增加第五次 gameplay 调用；在有真实到期边界的帧，合法子步数仍可超过 1／2／4。不能将“无技能边界时的四步”推广为任何场景都只能四步。

影响核查：`Mission._physics_process` 由引擎及现有受控测试调用，其共享信号驱动 Ambient；下游搜索、攻击、效果、时钟和撤离消费同一个 dt。未修改这些系统的计算或结算事务，原 173／26 专项继续验证其行为。

## 3. 修改文件

| 文件 | 本轮修改 |
| --- | --- |
| [missions/mission.gd](../../missions/mission.gd) | 增加相对舍入容差；只在没有内部效果边界时，将舍入余量并入当前子步。 |
| [tests/simulation_substeps.gd](../../tests/simulation_substeps.gd)、UID | 新增 606 项回归，先稳定复现 F1，再验证修复；覆盖两图三倍率、末次速度／动画、停止、感染者采样、区间守恒及极短效果边界。 |
| [run.ps1](../../run.ps1) | 在 test 和 build 的 time_contract 后各加入新专项；原门禁及断言均保留。 |
| [docs/PLAN.md](../PLAN.md)、本报告 | 顶部补充 R2.1 事实与构建阻断；历史记录不重写，按本次指定路径交付唯一报告。 |

Survivor、Enemy、动画控制器、MissionClock、Ambient、Campaign、SaveStore、原 173／26 测试和美术资源均没有被**本轮**修改。工作区中其他线程的这些文件改动不是本轮补丁；不得把全工作区 diff 直接当作 R2.1 修改清单。

## 4. 自动化及前后数值

有效红测 **606 checks／36 failures**，exit1；失败只涉及 ×4：每图15个额外子步断言、最终速度、Run 状态及感染者倍率。修复后同一文件、同一断言 **606／0**，exit0；没有放宽断言。见 [red-substeps.json](../../test-output/r2-1-animation-tailstep/results/red-substeps.json)、[green-substeps.json](../../test-output/r2-1-animation-tailstep/results/green-substeps.json)。

相同 1 秒模拟区间、相同 seed／路线，最终速度单位 m/s：

| provider | 倍率 | 位移（前后相同） | 修复前速度／状态 | 修复后速度／状态 | 感染者动画倍率 前→后 |
| --- | --- | --- | --- | --- | --- |
| Town | ×1 | 2.408216m | 2.800265／Run | 2.800265／Run | .979963→.979963 |
| Town | ×2 | 2.408216m | 2.800265／Run | 2.800265／Run | .979963→.979963 |
| Town | ×4 | 2.408216m | **0／Idle** | **2.800265／Run** | **.9→.979963** |
| City | ×1 | 2.407935m | 2.800026／Run | 2.800026／Run | 1.016942→1.016942 |
| City | ×2 | 2.407935m | 2.800026／Run | 2.800026／Run | 1.016942→1.016942 |
| City | ×4 | 2.407935m | **0／Idle** | **2.800026／Run** | **.9→1.016942** |

无技能边界时，三倍率每外层帧分别为 1／2／4 次有效 tick；Clock／Noise 1秒增量、Enemy冷却1秒减量均正确。停止后所有倍率正常 Idle，暂停无子步，恢复只消费下一帧。

边界专项还验证：1e-12／1e-7／.007 秒技能持续时间精确分片；暮色延缓到期后只将剩余区间交给时钟；真正 1e-12 秒外层时间不丢弃；1/60 秒到期与只差6.94e-18的真实余量仍保持两个子步、总时间守恒。周期效果以1秒间隔作用三名成员一次，再以真实1e-12秒时间使其到期，未重复触发。没有通过删掉所有微小 tick 来变绿。

| 原有／相关专项 | 本轮结果 | E/logs |
| --- | --- | --- |
| Time Contract | **173／0** | `r2-time.*` |
| Mission Dayloop | **26／0** | `r1-dayloop.*` |
| Ambient | **56／0** | `ambient.*` |
| City Noise／到站 | **13／0** | `city-noise.*` |
| Locomotion Mission | **16,275／0** | `motion.*` |
| Survivor Expedition Animation | **33／0** | `expedition-animation.*` |
| Infected Basic | **62／0** | `infected.*` |

173项仍对照搜索增量、八发／144伤害、感染者32伤害、技能持续／冷却及撤离表现；26项继续覆盖归航、全灭与一次完成。它们是受控回归，未冒充本轮重新完成了真实归航结算跨日。本轮没有直接调用内部结束／结算方法制作正式验收画面。

## 5. 正式 main.tscn 与录像

原生驱动只实例化正式 `res://core/main.tscn`，由引擎正常调度，并向目标 Viewport 推送 device42 键鼠事件。正常创建作战专精 Run，菜单→营地→今日行动→商业街→Medium Town；最终会话从菜单“继续”加载本次正常保存后再次进入同一出勤。没有传送、改HP、无敌、Debug生成敌人或内部设置倍率。

使用 F1 打开 Debug、实际点击倍速下拉及其弹出项、再 F1 关闭。原有 F1 打开即暂停的规则保留；倍率入口仍是 Debug 菜单，没有新增常驻玩家 HUD。

在道路及建筑邻近区域各执行两段移动，依次 ×4／×2／×1；六段中两名角色的实际移动采样均为 Run，速度约2.3～2.8m/s（避让与加速阶段会影响瞬时值），按 X 停止后回到 Idle。代表性单段从点击前至移动采样的位移：×4为4.088／1.984m，×2为1.848／1.778m，×1为.728／.645m；采样物理帧数不同，**不能据此计算严格墙钟倍率或FPS**。同模拟区间的准确三档对照在第4节。

随后自然进入夜间，在×4移动中 Space 暂停：**5.702秒墙钟**内 clock保持 **241.483333333418**，双方位置、HP、AI／攻击／动画、Noise、周期、技能及任务状态冻结；两名HP均100。Space期间按既有契约重新下达移动，恢复后两人再次 Run；纯活跃观测区间为 **32物理帧→2.133333333335秒**，对应32/60×4，无暂停时长补算。再按X正常Idle。该样本没有活跃搜索／周期provider，相关活跃效果冻结仍由173专项覆盖，不能把空状态快照扩大为全部角色组合实机通过。

原生数据：[speed-acceptance.json](../../test-output/r2-1-animation-tailstep/final-run/speed-acceptance.json)、[pause-acceptance.json](../../test-output/r2-1-animation-tailstep/final-run/pause-acceptance.json)、[summary.json](../../test-output/r2-1-animation-tailstep/summary.json)。原始键鼠、完整状态及逐帧观测保留于 E/final-run/trace.json、telemetry.json。

| 实际1600×900／H.264视频 | 时长 | 内容 |
| --- | --- | --- |
| [r2-1-run-speed-comparison.mp4](../../test-output/r2-1-animation-tailstep/videos/r2-1-run-speed-comparison.mp4) | 43.56秒 | 实际三档下拉选择、道路／建筑旁移动、模型动作与停止切换。 |
| [r2-1-pause-resume-regression.mp4](../../test-output/r2-1-animation-tailstep/videos/r2-1-pause-resume-regression.mp4) | 35.00秒 | 夜间×4真实移动、暂停冻结、暂停下令、恢复Run与停止Idle。 |

视频来自真实 Viewport 连续PNG，按写入时间编码，不插值、不重绘、不生成替代画面；正式两段均完整解码exit0、无错误，见 [metadata.json](../../test-output/r2-1-animation-tailstep/videos/metadata.json)、[decode-checks.json](../../test-output/r2-1-animation-tailstep/videos/decode-checks.json)。截图：[×4移动](../../test-output/r2-1-animation-tailstep/final-run/screenshots/moving-4-0.png)、[停止](../../test-output/r2-1-animation-tailstep/final-run/screenshots/stopped-x4.png)、[暂停前](../../test-output/r2-1-animation-tailstep/final-run/screenshots/confirmed-pause-before.png)、[暂停后](../../test-output/r2-1-animation-tailstep/final-run/screenshots/confirmed-pause-after.png)、[恢复Run](../../test-output/r2-1-animation-tailstep/final-run/screenshots/confirmed-resumed.png)。

### 失败取证保留

第一次观察器在角色已走完路径、正常Idle时仍要求Run，且读取了没有current_animation的AnimationPlayer位置；修正的是E内观察器，未修改游戏。原始日志、trace、JSON保留于E根，录像 [FAIL-first-observer-run-speed.mp4](../../test-output/r2-1-animation-tailstep/videos/FAIL-first-observer-run-speed.mp4) 为13.48秒。

第二次三倍率移动已通过，后续恢复观测仍落在抵达后，被原观察器误判；失败JSON与 [FAIL-observer-arrival-after-resume.mp4](../../test-output/r2-1-animation-tailstep/videos/FAIL-observer-arrival-after-resume.mp4)（18.56秒）保留。最后一次在暂停中按正式操作重新建立完整移动路线，恢复初期确认Run、再观察活跃区间；没有删除原游戏断言或把到达后的Idle当作本轮F1复发。最终原生Godot日志无ERROR／SCRIPT ERROR，exit0。

## 6. Windows build 与残留风险

本轮实际执行隔离 `run.ps1 -Mode build`，**176.866秒、exit1**。Search Gameplay72、Phase2 265、Survivor Command45、Search Active Card157、Settings14、Camp Menu Overlay30通过；随后仍因Camp UI访问不存在的 `member_buttons` 及“Camp exposes active abilities on its left edge”失败。见 [build.result.json](../../test-output/r2-1-animation-tailstep/logs/build.result.json)。

未到新增时间门禁或export，未生成新EXE，未覆盖原build；没有直接导出绕过门禁。因此不提供旧EXE冒充本轮交付。导入阶段执行成功不等于后续全量构建通过。

继续保留：指令线20Hz相位敏感、search_dispatch两项、旧武器空模型、旧效果夹具／精确浮点／升级搜索SCRIPT ERROR、指向射击缺少Focus加成；本轮未修复或放宽其断言，也没有重跑全部这些专项。HUD创建Ambient、Town腕表避让分支、R3空结束页和R4营地问题仍在原范围。

这些测试与PNG录制都不作为性能基准；录制会降低引擎追帧速度。未验证FPS、音频、多seed平衡、所有武器／角色组合、五日通关、存档故障／迁移、macOS或新EXE。没有把本轮移动录像扩大成正式完整归航／全灭跨日重录。

## 7. 并发工作、保全与环境

并行动画线程在本轮开始后修改了 `survivor_animations.tres` 的循环、`survivor_expedition_animation_controller.gd` 的1.45节奏因子、生成工具及数项测试，并新增其审计／runtime contract。它们原样保留，不纳入第3节本轮修改。原生录像、红绿606、原173／26和完整build均使用本轮固定动画基线；原文件副本保存在 E/validated-animation-baseline/，哈希见 [integration-check-source-states.json](../../test-output/r2-1-animation-tailstep/integration-check-source-states.json)。

为检查同一工作区并发组合，另将这两个最新运行文件复制到隔离副本，单独执行 integration-substeps **606/0** 与 integration-time **173/0**；日志为 `logs/integration-{substeps,time}.*`。它们不替换原红绿或录像证据，也不代表并行动画任务／全量合并构建已经验收。

本轮窗口(-3000,-3000)、unfocusable，使用Viewport输入，未接管桌面前台。Windows Godot `4.7.2.stable.official.ed1daf0bf`、Compatibility／RTX3060／NVIDIA591.86；1600×900、Dummy音频。Python3.13.5、Git2.39.1.windows.1；Nodev26.4.0不符仓库22.x约束，未调整。Blender未使用；macOS无环境、未验证。

已在PLAN顶部同步本轮实际状态；未重写历史报告或计划，也未宣称R3开始。源文件与并发差异、根规则／Git索引保全、日志、编码、链接及本轮进程退出检查见 [final-checks.json](../../test-output/r2-1-animation-tailstep/final-checks.json)。大型既有缓存／构建／证据只按大小和mtime核对，不冒称逐字节验证；并发产物变化另列，未清理或结束他人进程。
