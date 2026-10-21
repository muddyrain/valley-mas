# ANIM-A0：角色动作与移动运行态专项审计

日期：2026-10-19，Asia/Shanghai。结论：**审计已复现并定位问题，生产系统未修复，不构成发布验收通过。**

“看起来没有移动”至少对应两个已证实的问题：持续动作不循环，角色位移时停在动作末帧；R2 的 ×4 调度产生浮点余量子步，覆写动画运动速度，使移动中的角色选择 Idle。正式输入、导航和世界位移在这些复现中确实工作。另确认默认手枪缺少对应射击表现。没有替换动作源、调 Run 倍率、改模型、Root Motion、移速、导航、武器、时间系统或场景结构。

## A. 环境、Git 基线与原工作区保护

- 仓库 `D:/my-code/valley-mas`；游戏 `apps/blue-hour`；分支 `master`，跟踪 `origin/master`；HEAD `8004ebabc6823c1c238045bf5406916879ed134b`。没有 fetch、reset、stash、checkout、commit、push 或暂存操作。
- 开始时已有 23 项改动。暂存为 `T AGENTS.md`、`M CLAUDE.md`；未暂存内容包含游戏入口、PLAN、设计契约及 R1/R2 的 Mission、Ambient、Enemy、Clock、run.ps1 与测试；另有六份 development 报告和两个测试及 UID。完整原状见 [snapshot.json](../../test-output/anim-a0-20261019/snapshot.json)。本轮不认领或覆盖这些内容。
- 已读根 AGENTS、CLAUDE、技能索引、PROJECT_GUIDE 验证矩阵、TESTING_STRATEGY、Harness 运行证据规则，游戏 AGENTS、PROJECT_CONTEXT、PLAN 当前阶段、游戏定位契约、R1 闭环／独立审查、R2 报告，以及近期动画批量／Expedition／Run-Death 报告。目标路径未发现更深层 AGENTS 或 override。未执行历史计划。
- 使用 Godot、GitNexus 调试流程、delivery-reporting、encoding-guard。没有发现可读取的 Superpowers skill。无 GitNexus MCP；本机 CLI 可用，但 `status` 显示索引为旧提交 `14521b7`，`query` 没有目标调用流程、`context update_motion` 返回 Symbol not found。没有重建索引；按当前磁盘源码和原生 Git 只读检查调用关系。
- 唯一新增正式文件为本报告。全部脚本、JSON、日志、截图、录像和隔离工程放在全新证据根 **E = `apps/blue-hour/test-output/anim-a0-20261019/`**。没有修改 PLAN：本轮只记录专项诊断，且用户限定只能新增报告和隔离诊断材料。
- 从当前磁盘复制 3,102 个源文件，逐文件 SHA-256 一致，见 [source-manifest.json](../../test-output/anim-a0-20261019/source-manifest.json)。运行使用 `E/sandbox/project/`，复制既有 R2 隔离缓存以节约准备；**未重新证明全新导入通过**。所有生产源码／资源复制后未被探针改写。
- 子进程 APPDATA、LOCALAPPDATA、TEMP、TMP 均指向 E/profile；观察器检查 `OS.get_user_data_dir()`。正式流程新建的 Run seed 为 **53514487**，存档为隔离 `user://test-runs/anim-a0-main.json`。后续从正式“继续”回到该 Run 的营地。没有操作玩家 `user://homeward/run.json`。
- 原生窗口在 `(-3000,-3000)`、unfocusable；仅向目标 Viewport 推送 device 42 键鼠事件，无系统键鼠注入。未启动用户可见编辑器或接管用户游戏。

| 环境 | 本轮实际使用 |
| --- | --- |
| [Windows] Godot | `4.7.2.stable.official.ed1daf0bf`；Compatibility；RTX 3060；OpenGL 3.3 NVIDIA 591.86 |
| [Windows] 画面／声音 | 1600×900；帧率上限 30；Dummy 音频，音频未验收 |
| [Windows] Python／Node／Git／FFmpeg | 3.13.5／v26.4.0／2.39.1.windows.1／8.1.1；context:recent 提示 Node 不符仓库 22.x 约束，未调整 |
| [Windows] Blender／Editor／构建 | 均未使用；无新构建、无 EXE 导出 |
| [macOS] | 无可访问环境；运行、工具和性能均未验证 |

最终保全结果见 [preservation-verification.json](../../test-output/anim-a0-20261019/preservation-verification.json)：开始时已有源文件哈希和暂存入口保持，原 `.godot/` 与 build 元数据无变化。大型缓存和旧输出使用大小及 mtime，不能扩大为逐字节哈希证明。

**并发工作区变化另列**：保全扫描发现，本轮之外新增了 `docs/development/blue_hour_r2_independent_review.md`，并在 `test-output/r2-independent-review/`、`test-output/r2-1-animation-tailstep/` 出现 48 个元数据变化（45 个新文件、3 个开始时已有文件）。这些路径未被本轮工具写入、删除或清理；不能宣称所有历史输出零变化，也不将它们认领为 ANIM-A0 成果。新独立审查已补读，其尾步结论与本轮独立原生取证相符。本报告与隔离证据以开始时固定的生产文件哈希为基线；并发后续工作不合入本次结论。

## B. 正式移动／动画调用关系

### Expedition

```text
core/main.tscn → Main 正式加载／Ready Gate
 → Mission._input:610 → SquadInput.observe:21（释放键／鼠标、指针状态）
 → Mission._unhandled_input:614 → SquadInput.handle:44
 → 原生射线命中地面 → command_move:711
 → move_command_members:700（排除不允许覆盖的搜索者）
 → _move_members:716（导航就绪、目标、全员编队路径验证）
 → Survivor.order_move:119（正式 prepared_path／路径复用）
 → Mission._physics_process:332 → simulation_delta:326
 → _advance_world:352 → Survivor.tick:169 → _move:203
 → actor 世界位置／current_speed／actual_velocity 更新
 → update_motion:113 缓存实际位移推导的速度
 → ExpeditionAnimationController._process:61
 → _advance_runtime:191 → 状态／Rate → AnimationTree.advance
 → Survivor._process:271 插值 VisualRoot 位置和朝向
 → 模型固定局部 Y=PI → Skeleton3D／蒙皮最终画面
```

源码路径均相对游戏根。移动积分在 `survivor.gd:217–250`，最大内步长 1/120 秒；动画输入在 `:189–192`，不是直接用 `current_speed`。渲染状态使用 `_motion_speed`，这一区别正是 ×4 故障的关键。AnimationPlayer 的 `current_animation` 为空可以是 AnimationTree 手动驱动的正常状态，不能因此判定动画没播放；本轮使用状态机节点、play position、片长和骨骼姿态判定。

`survivor.gd:81` 对所有正式 **SurvivorDefinition** 选 `survivor_expedition_animation_controller.gd`；旧 `survivor_animation_controller.gd` 仅用于非正式兼容数据。正式图通过 `survivor_animation_pipeline.gd:39–88` 加载 **Survivor** 库并设手动回调。额外挂载的 **Public** 库不等于正式 Locomotion 正在播放它。旧公共库的循环设置与旧控制器结论不能覆盖正式图。

### Camp

```text
CampAmbientBehavior.setup:61 → _advance:179 → request_poi:154
 → 安全 POI／预约／路径验证 → CampActor.move_to:64
DepartureController.begin:31 / _advance_approach:76
 → CampActor.move_to → NavigationAgent3D
 → CampActor._physics_process:78 → next_path_position／velocity
 → move_and_slide:101 → 世界位置真实改变
 → visual.animation_controller.update_motion:104
 → use_camp_style → WALK／IDLE → 手动 AnimationTree.advance
 → CampActor.face:106 / face_smooth:120 更新 visual.rig 世界朝向
```

营地自然游走使用 `CampAmbientBehavior:132–136` 的 1.15m/s；出发恢复原速度后按 Departure 的 1.7 倍演出规则行进。这是现有规则，本轮未调速。营地独立 CharacterBody 承担位移：嵌套 Survivor 的 `current_speed`／`actual_velocity` 可以为零，必须读取 **CampActor.velocity 与前后 global_position**。只看嵌套 Survivor 的零值会误报营地不动。

## C. 正式复现步骤、录像与可复核数据

所有指定录像来自本轮正式 `core/main.tscn`：菜单 → 创建 Run／继续 → 营地 → 今日行动 → 商业街 → **MEDIUM_TOWN_V1**。没有使用动画预览录像、Debug 传送／刷敌、改血量、手动推进 Mission 或内部结算快捷调用冒充玩家流程。

| 场景／录像 | 步骤及结果 |
| --- | --- |
| A：[camp-movement.mp4](../../test-output/anim-a0-20261019/videos/camp-movement.mp4)，22.52s | 出生 Idle，等待自然 POI 移动。SUR_001 累计路径约 14.83m、SUR_002 约 7.66m；两人都会移动，但 WALK 随后停在末帧。不是角色世界位置停滞。 |
| B：[town-move-stop.mp4](../../test-output/anim-a0-20261019/videos/town-move-stop.mp4)，21.80s | 实际点击 `(1100,280)`、`(550,260)`、`(1150,300)`，再 X。累计位移路径约 28.01m／31.99m；转向与停止生效，停止后分别回 IDLE／KNIFE_IDLE；持续 Run 中存在末帧冻结。 |
| C：[town-armed-combat.mp4](../../test-output/anim-a0-20261019/videos/town-armed-combat.mp4)，17.04s | 从可复核射线候选中选明确地面，P9／小刀装备不变；移动 → Ctrl 指向射击 → 再移动 → X。P9 弹药 15→11，射击逻辑确实执行，但没有对应手枪射击状态／OneShot。该视频记录表现缺口，不能写成武器动画通过。未造成敌人伤害的空地方向射击不冒充自然接敌战斗。 |
| E：[pause-resume-animation.mp4](../../test-output/anim-a0-20261019/videos/pause-resume-animation.mp4)，27.04s | 移动中 Space、恢复，再经 F1 正式下拉依次选择 ×1／×2／×4，关闭菜单后下地面指令。暂停冻结通过；×4 移动选 Idle 已复现。 |
| D：原始连续帧 `E/clean/frames/search-cancel-verified/` | 点击正式地点，等待进入；地面指挥掩护者；实际 CancelButton 取消；退出后 E 归航。截图与 trace 确认成员职责，见下表。没有把该片段拼接进指定录像。 |

四段均为 H.264、1600×900，完整解码 exit 0、无解码错误。规格、帧数、SHA-256 与来源见 [videos/metadata.json](../../test-output/anim-a0-20261019/videos/metadata.json)。源为 Godot Viewport 连续 JPEG，按真实文件时间戳编码 VFR，无插值造帧、重绘或跨会话拼接。采样和磁盘写入会影响运行负载，**不能据此作 FPS／性能或墙钟倍速精度验收**。

指定录像分别使用首会话 E 根目录与第二会话 E/clean；第三次 `E/confirmation` 使用加固观察器重新走正式入口及暂停／倍率操作，无运行错误，仍复现 ×4 的 IDLE／KNIFE_IDLE。三个会话和失败采集均保留，没有替换原始证据。

### 测量与定位判据

完整数据入口：[measurements.json](../../test-output/anim-a0-20261019/measurements.json)、[首会话 samples.jsonl](../../test-output/anim-a0-20261019/samples.jsonl)、[第二会话 samples.jsonl](../../test-output/anim-a0-20261019/clean/samples.jsonl)、[simulation.jsonl](../../test-output/anim-a0-20261019/clean/simulation.jsonl)、[trace.json](../../test-output/anim-a0-20261019/clean/trace.json)。第三会话数据在 `E/confirmation/`。

样本包含 SUR_ID、成员 ID、实例 ID、模型路径、控制器、输入事件、导航 ready、命令目标／计数／拒绝原因、路径点数／剩余距离、actor／VisualRoot／model 世界位置和朝向、速度、actual_velocity、Tree active／回调模式／节点／片名／播放位置／倍率、关键骨骼姿态、physics／render delta、Engine／Mission time_scale、暂停状态、时钟和时间戳。Camp 另记 agent iteration、当前路径、目标和 CharacterBody.velocity。`wall_msec` 是本进程单调时间；trace 命令 ID 为输入驱动的 epoch 毫秒，可关联源文件时间。行号以本轮磁盘源码为准。

| 典型样本 | 数据与判断 |
| --- | --- |
| Town，进程 146186ms、clock=42.566667s | SUR_001，实例 `821714507078`，`xia_zhiyao/runtime/xia_zhiyao.glb`，正式 Expedition 控制器；位置 `(-2.393043,.025,105.315941)`→`(-2.706161,.025,105.112640)`，间隔位移 .373328m；current_speed=2.8，motion_speed≈2.799993，Tree active，RUN，播放位置=片长=5.133333s，腿旋转不变。输入／路径／位移正常，动作末帧冻结。 |
| Camp，进程 64972ms | SUR_001 visual 实例 `378678549716`；位置 `(.629461,.000842,4.184358)`→`(.740289,.000842,4.153662)`，位移 .115001m；动画速度≈1.150005，WALK，rate=.55，播放位置=片长=2.066667s，腿旋转不变；VisualRoot 跟随实际 actor。 |
| ×4，进程 140241ms、clock=69.733333s | 第二会话 SUR_001 实例 `748213523795`，path_count=1、remaining≈.714776m、current_speed=2.8，但 actual_velocity=0、motion_speed=0，状态 IDLE；后续样本位置持续变化。不是寻路失败，而是末次余量子步覆写观测速度。 |
| Space 冻结窗口 | 2,429ms 墙钟内 clock 均为 53.4499999999982s；actor、播放位置和骨骼姿态保持。Tree 仍 active 是手动零推进，不是暂停失效。Engine.time_scale=1，SceneTree.paused=false，Mission.time_scale=0。 |

首会话 B 中 VisualRoot 与 actor 最大位置差约 .0467m；×4 对照最大约 .1867m，符合现有一物理帧表现插值量级。模型固定 PI 朝向修正保留，rig yaw 随转向改变。未发现这些样本中模型独留原地、世界／局部空间混用或骨架脱离 actor；这不是对所有帧率与所有模型显示的全面排除。

| D 的正式截图／clock | 角色应当做什么／实际状态 |
| --- | --- |
| [搜索隐藏](../../test-output/anim-a0-20261019/clean/screenshots/50-search-worker-hidden.png)，121.733333s | crew:0/SUR_001 searching=true、inside=true、path=0；合法在建筑内停留且隐藏。crew:1/SUR_002 空闲。 |
| [掩护者移动](../../test-output/anim-a0-20261019/clean/screenshots/51-cover-member-moves.png)，122.183333s | crew:0 仍在 `(6.685064,.08,45.047565)`；crew:1 从 `(-7.300414,.08,48.704514)` 移到 `(-7.861386,.08,48.042274)`，path=1。 |
| [取消](../../test-output/anim-a0-20261019/clean/screenshots/52-cancel-search.png)，122.750000s | 正式取消按钮后 crew:0 searching=false、inside=false，已获得归队路径；没有要求所有搜索者在地面命令时一起移动。 |
| [归航](../../test-output/anim-a0-20261019/clean/screenshots/54-return-orders.png)，126.283333s | extraction=true，两人都有返程路径；归航等待前的 remaining 约 64.45／66.83m。此处只验证指令后的移动，未重做完整撤离／结算。 |

诊断分类：无事件／UI 已消费／非 active 与关闭阶段先看输入和 `SquadInput.handle` 门槛；导航拒绝看 `NAVIGATION_NOT_READY`、`INVALID_NAVIGATION_TARGET`、`UNREACHABLE_TARGET`、`UNREACHABLE_FORMATION`、`NO_REACHABLE_MEMBERS`；命令接受看 `nav_targets` 增量、目标和路径；路径有而位置不动再检查 physics、暂停、搜索、速度和避让；位置变而 rig 不变才归表现变换问题；本次主要是位置变且姿态／播放相位异常。`command_move` 的 inactive／关门早退没有独立拒绝信号，因此不能仅凭旧的 last_command_rejection 推断最新事件。

## D. 逐条发现

### F1 — P1，已证实：正式持续动作全部未设置循环

位置：`assets/characters/survivors/animations/survivor_animations.tres`；`tests/build_survivor_animation_library.gd:17–33`；`survivor_animation_pipeline.gd:53–88`；`survivor_expedition_animation_controller.gd:220–240`。

库内 11 段的 `Animation.loop_mode` 实测全部为 **LOOP_NONE(0)**。Idle、Walk、Run、Rifle Idle、Rifle Run、Knife Idle 等持续动作到末端后，状态名不会改变，控制器仅在 desired 改变时 transition，所以继续 `tree.advance` 仍保持末帧。不是 Skeleton 不匹配，也不是 Tree inactive。生成脚本直接复制导入动画并保存，未为持续片建立循环策略；运行装配也没有补上该契约。

正式营地 WALK 冻结在 2.066667s，rate=.55 时约 3.76s 后就可能僵直滑行；普通 Run 冻结在 5.133333s；隔离 Rifle Run 冻结在 1.366667s。首会话 Town 的有效移动采样中，两人分别有 41／10 个末端停帧且腿旋转不变的样本；营地分别 79／25 个。12 人 fixture 均在持续推进后保持同一末帧一秒，见 [fixture.json](../../test-output/anim-a0-20261019/fixture.json)。这是共享表现故障，不能通过批量换模型解决。

### F2 — P1，已证实：R2 ×4 浮点余量子步把真实移动表现成 Idle

位置：`missions/mission.gd:343–351`，`survivors/survivor.gd:189–192,217–250`，`survivor_expedition_animation_controller.gd:113–117,211–229`。

物理 delta=1/60，局部 ×4，四个 1/60 子步减完后还剩 **6.93889390390723e-18s**；`while left > 0` 将其再次送入 Survivor。`_move` 的积分循环条件是 `left > .000001`，因此该子步位移为零；actual_velocity 被覆为零，update_motion 又将 `_motion_speed` 覆为零。随后渲染帧依此选 IDLE／KNIFE_IDLE／RIFLE_IDLE。移动积分之前四步已正常完成，所以 current_speed=2.8 和世界位移仍可同时成立。

正式第二会话记录 **201 个余量子步**，对应 804 个正常 ×4 子步；×1／×2 未出现同类余量。第三次无诊断错误的正式复跑再次出现移动中 IDLE／KNIFE_IDLE。隔离单人 K9 的 12 个外层物理帧对照：

| 档位 | 真实位移 | 最后缓存运动速度 | 动画状态 |
| --- | --- | --- | --- |
| ×1 | .200000m | 1.916671 | RIFLE_RUN |
| ×2 | .721101m | 2.744004 | RIFLE_RUN |
| ×4 | 1.818703m | 0 | RIFLE_IDLE |

此表外层帧数相同、模拟时间不同，只用于定位末次采样，不能当成相同模拟时长的移速比较。当前磁盘 R2 diff 新增了有界子步；本缺陷与该调度及现有末次速度缓存相互作用有关。没有修改 R2 生产代码进行对照修复。

审计期间新增的 [R2 独立审查](../development/blue_hour_r2_independent_review.md) 将同一尾步问题定为 P2；ANIM-A0 因正式玩家流程中的核心移动观感失败而按 P1 排序。这是修复优先级口径差异，不代表新增了 Gameplay 位移停摆、伤害重复或数据损坏的证据。

### F3 — P2，已证实差异：正式 Run／Rifle Run 没有独立 1.45 倍率

位置：`survivor_expedition_animation_controller.gd:226–229`。当前值为 `clamp(speed/base_speed,.55,1.6)`；普通 2.8/2.8 时约 **1.0**，12 人 fixture 的 RUN／RIFLE_RUN 均为 1.0，营地 WALK 为 .55。没有发现正式调用链再乘 1.45。×4 时 rate=1 还可能只是 Idle 的默认值，不能误读为跑步倍率已经正确。

用户提供的历史 Run／Rifle Run 目标为 1.45；本轮确认它与当前代码不一致，未擅自恢复或重调。倍率差异不能解释完全停帧，也不能先靠调速掩盖 F1／F2。后续应在循环和时间边界修好后，单独确认历史契约在正式图的落点。

### F4 — P2，已证实：默认 P9 有攻击逻辑，缺少对应动作／瞄准表现接线

位置：`data/weapons/wpn_002_p9_pistol.tres:12,25`，`survivor_expedition_animation_controller.gd:25–26,209–224,248–255`，`survivors/survivor.gd:255–258`。

P9 的 animation_profile=SIDEARM。正式控制器只将 LONG_GUN 分配 Rifle 状态与射击 OneShot，近战分配刀动作；SIDEARM 落到普通 IDLE／RUN，`_on_fired` 对它没有分支，静止朝向更新也只涵盖 long gun。正式 Ctrl 射击消耗 4 发，但 shoot_requests 始终为 0。该缺口影响开局即用的 SUR_001，属于真实可见反馈不足；不应把 SIDEARM 强制改为 LONG_GUN 或擅自新增动作源。本轮没有声称 P9 射击伤害或完整自然接敌战斗动画已通过。

### F5 — P1（构建门禁）／P2（VFX 滞后），已证实独立：脚部指令线的节流相位

位置：`tests/survivor_command.gd:69–78`；`missions/world_interaction_vfx.gd:39,79–87,189–205`。

本轮原测试 Headless **43/0**；保留原断言的 Native 相位诊断，将 VFX 初始余量设为 .04s 后为 **45/1**：actor speed=2.8，脚部 `(-16.552086,.045,37)`，线头 `(-16.644445,.045,37)`，gap=.092359543m，第三次手动调用未重绘。见 [phase stdout](../../test-output/anim-a0-20261019/logs/legacy-native-command-phase.stdout.log) 与 [stderr](../../test-output/anim-a0-20261019/logs/legacy-native-command-phase.stderr.log)。相位修改仅用于独立 fixture，不是自然玩家流程或修复。

20Hz VFX 几何节流与逐 1/30s 精确贴脚断言冲突，重现 R1 独立审查的机制。它会使线头短暂落后，也会阻断构建，但该线网格不控制 Survivor／VisualRoot／AnimationTree。F1 在 Camp 也发生，F2 在正常 Town 命令中发生，不能将三者合为一个根因。此次不追溯断言 R1 历史每次失败都具有同一初始相位，也不将一次 Headless 通过写成门禁已修复。

### F6 — P2，已证实风险：模型契约失败的降级不透明

位置：`survivors/survivor.gd:70–88`；`survivor_animation_pipeline.gd:39–60`。缺失 model_path 会进入程序几何体回退；资源存在但不含合格 Skeleton 时只释放 controller，保留 VisualRoot 中原模型，没有同样回退或明确告警。

独立 fixture 以复制的 Definition 验证：不存在的模型路径→程序几何体、无控制器；不含骨骼的树 GLB→VisualRoot 保留、控制器为空。见 [fallback-verified.json](../../test-output/anim-a0-20261019/fallback-verified.json)。这是失败分支风险；**12 个正式模型都正常加载，本次正式复现不是由 fallback 触发**。损坏／无法实例化的资源及文件 IO 失败未测。

## E. 12 人与 Camp／Expedition 覆盖

Definition 的 survivor_id 是唯一身份键，表中模型目录来自 Definition.model_path；并非按目录顺序做绑定。全部使用同一个 Expedition 控制器、同一个 Survivor 库。骨骼名、父级和 Rest 与 SUR_001 比较一致，均为 23 骨；11 段所有骨轨目标都可解析。

| SUR_ID／角色 | 模型目录 | 正式 main 流程 Camp／Town | 隔离 23 骨／11 段轨道／Run、Camp Walk、Rifle Run |
| --- | --- | --- | --- |
| SUR_001 夏知遥 | xia_zhiyao | 已测／已测 | 结构有效；三种持续状态均末端冻结 |
| SUR_002 苏晚星 | su_wanxing | 已测／已测 | 同上 |
| SUR_003 林见月 | lin_jianyue | 未测／未测 | 同上 |
| SUR_004 陆清禾 | lu_qinghe | 未测／未测 | 同上 |
| SUR_005 沈砚川 | shen_yanchuan | 未测／未测 | 同上 |
| SUR_006 唐栀 | tang_zhi | 未测／未测 | 同上 |
| SUR_007 顾予安 | gu_yuan | 未测／未测 | 同上 |
| SUR_008 程茉 | cheng_mo | 未测／未测 | 同上 |
| SUR_009 周野 | zhou_ye | 未测／未测 | 同上 |
| SUR_010 许昭宁 | xu_zhaoning | 未测／未测 | 同上 |
| SUR_011 贺临川 | he_linchuan | 未测／未测 | 同上 |
| SUR_012 宋时雨 | song_shiyu | 未测／未测 | 同上 |

11 段片长秒数：death 6.066667、hit_reaction .9、knife_attack 4.266667、knife_idle 8.333333、rifle_idle 8.333333、rifle_run 1.366667、rifle_shoot 1.9、survivor_idle 8.333333、survivor_run 5.133333、survivor_walk 2.066667、unarmed_idle 3.833333；loop 均为 0。death／hit／attack 作为一次性动作不能按持续 locomotion 的要求一律改 Loop。全部 11 段资源和轨道核验不等于本轮逐人完整演示 11 段战斗。

23 骨清单和每人原始对照在 fixture.json：Root、Hips、双侧 UpperLeg／LowerLeg／Foot／Toes、Spine／Chest／UpperChest、双侧 Shoulder／UpperArm／LowerArm／Hand、Neck、Head。本轮未修改 Skeleton、Rest、GLB 或角色数据，也未将其余十人强加进正式 Run。

## F. R1／R2 回归与已知失败

| 本轮执行 | 结果及边界 |
| --- | --- |
| 正式 main 三次运行 | 首次创建、后续正式继续；Camp／Town、位移、输入与表现数据均取得。第三次守卫加载边界后 stderr 为空，×4 动画问题仍复现。 |
| 原 `tests/time_contract.gd` | **173 checks / 0 failures**，exit 0；证明原有受控时钟／Gameplay 断言通过，不能覆盖本报告的动画末次采样、循环和真实画面。 |
| `validation/roster_and_substep.gd` 最终版 | exit 0，12 人／11 段资源／3 档子步记录；检测到 F1/F2，不能写成动画 PASS。 |
| 原 `tests/survivor_command.gd` Headless | 43/0，exit 0；Native 才执行的画面检查未在此计数。 |
| 原断言 + .04s 相位观察器 Native | **45/1，exit 1**；准确重现脚部线断言，不改原测试、不放宽容差。 |
| 失败回退 fixture | 最终版 exit 0，验证 F6；资源为诊断替身，不是正式模型存在缺陷的证明。 |
| 四段视频 | 编码成功，完整解码均 exit 0；规格和原始来源可复核。 |

R1 的正式路径／唯一结算、R2 的完整昼夜／自然全灭等历史证据仍是既有资料；本轮只重测相关移动和时间片段，没有重做整段归航结算、下一天或全灭。R2 暂停／共享模拟时间改动保留；本次新的 ×4 动画回归不因旧 173/0 而消失。

历史完整 Windows build 仍为 BLOCKED：R1 的指令线相位风险未修；R2 曾通过指令线后停在 Camp UI 的 member_buttons／左侧能力契约。本轮没有重新运行完整 build，未覆盖旧 EXE。旧 City search_dispatch 两项、武器与效果专项失败、腕表 Town 避让提前 return、R3／R4 风险不在本轮修复或重新验收范围。

### 诊断工具自身失败记录

- 首会话观察器沿用 R2 的敌人 `AnimationPlayer.current_animation_position` 读取，遇手动 Tree 且 current_animation 为空时打印错误；第二版避开该读取，但在加载中 clock 尚为空时又产生 5 个空样本。相关日志均保留于 E/logs/main.*、clean.*。测量脚本明确排除 5 个缺少 wall_msec 的空样本，不把这些错误归到生产动画。
- 第三版 `driver_guarded.gd` 同时检查加载边界，从正式入口复跑，stderr 为 0 字节、空样本为 0，仍复现 ×4。没有改生产代码来消除探针错误。
- 首版子步 fixture 使用空 loadout，Mission 因此没有幸存者，探针越界后由本轮停止该进程；原日志 `legacy-roster-substep.*` 保留。最终版使用一名正式角色与 K9，正常结束并输出数据。不是产品“角色消失”的证据。
- 初次武器采集误点地点并派出搜索者，初次取消采集又等到搜索自然完成，均保留原帧／trace；最终武器片只选射线确认的地面，最终取消片在进入后立即暂停定位，再实际取消。未把前述失败片拼进最终媒体。
- 首次 fallback 用整座 Camp 场景作为反例，但其中确有可找到的骨架，不是无骨架模型；最终改用现有树 GLB，两个结果分别保留。

## G. 推荐最小修复范围及先后顺序（未实施）

1. **先关闭 F2 的数值边界回归**：在 Mission 的有界子步边界妥善消耗／排除浮点残量，确保不足移动积分精度的子步不会覆盖本物理帧有效运动采样。不扩大为移动架构重构；保留技能到期切片和唯一模拟 dt。增加 ×1／×2／×4 的整帧位移、末次动画速度与原生状态断言，尤其覆盖多个渲染／物理帧比率及暂停恢复。
2. **修 F1 的持续动画契约**：为已有持续片建立明确 Loop 清单，在生成库流程与正式序列化资源中保持一致；保留 Death／Hit／Shoot／Attack 的一次性语义。先验证至少三完整周期、停止、转向和中断，再验证 Camp、长时间普通 Run 和 Rifle Run。无需换动作源、改骨骼、批量改 GLB 或引入 Root Motion。
3. **单独确认 F3 的 1.45 历史目标**：循环及时间边界稳定后，确认正式图是否应保留独立基准倍率，再作用户授权的局部实现和观感对照；不通过修改 Gameplay 移速补偿动画，不在本轮直接重调。
4. **补 F4 的 Sidearm 表现**：明确手枪的现有动作可复用范围、瞄准方向与射击反馈，再局部接线；不篡改武器类型／数值。正式玩家流程必须看到实际装备移动、射击确认、再移动和停止，且补自然接敌验证。
5. **独立处理 F5 和 F6**：VFX 先确认“每次重绘正确且间隔受控”还是“线头每帧贴脚”的产品契约，再相应修测试／局部线头更新，避免任意 sleep 或撤销全部性能优化；模型失败至少要输出可定位的身份／路径／失败原因，并定义一致降级。本轮正式 12 人没有加载失败，不建议为回退风险批量替换模型。

完成上述局部修复后，仍须分别重跑相关旧门禁、真实 main 流程与完整 Windows build／独立 EXE；本报告不授予修复或发布授权。

## H. 已验证、失败与未测试

- **已验证的事实**：正式输入和导航可接受地面指令；两名开局成员实际移动数米、转向、停止；Camp 自然移动与出发路径；搜索职责／隐藏／取消／返程命令；Space 冻结和恢复；三档真实 UI 操作；12 人模型／23 骨／共享库绑定；四段真实游戏录像与解码；源文件及工作区保全。
- **明确失败**：持续动作 Loop 契约；×4 移动动画状态；当前独立 1.45 倍率与历史目标的一致性；P9 射击动作反馈；.04s 相位下原指令线精确贴脚门禁。动画和发布验收均不能宣称通过。
- **未测试／不可外推**：其余十名成员的正式玩家流程、正式流程中 K9 Rifle 自然接敌及小刀实际命中／攻击完整片段、所有地图 seed、所有武器／成长／效果组合、全时长动画与所有中断、Death 暂停终态、完整撤离结算／下一天／全灭、旧全部门禁、macOS、音频、性能、存档损坏／磁盘故障、全新导入、Windows build 与新 EXE。长枪验证来自明确标记的隔离 fixture。
- **交付文件**：新增本报告；E 下新增隔离脚本、日志、原始帧、截图、测量 JSON 与录像；生产文件修改／删除为零。所有本轮 Godot 子进程已结束，不关闭用户进程。详细最终核对见 [final-checks.json](../../test-output/anim-a0-20261019/final-checks.json)。

ANIM-A0 到此停止。等待用户确认下一阶段，不把定位结果写成修复完成。
