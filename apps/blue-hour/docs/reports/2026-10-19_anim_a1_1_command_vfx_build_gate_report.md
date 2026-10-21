# 蓝时归航 ANIM-A1.1 — 移动指令线与 Windows 构建门禁

日期：2026-10-19。平台：**[Windows] Godot 4.7.2**。

**F5 指令线专项修复及指定回归 PASS；完整 Windows build 仍 BLOCKED。** 本次构建已通过原生 Survivor Command 45/0 和新增跟随专项 554/0，随后被既有 Camp UI 门禁阻断。没有执行 export、没有新 EXE、没有独立程序启动 PASS。

## 1. 基线、范围和工作区保护

仓库 `D:/my-code/valley-mas`；游戏 `apps/blue-hour`。开始及结束 HEAD 为 `865edec300e01d64d015924b3e6f391567ba46be`，分支 `master`，领先 origin/master 四个提交。本轮没有暂存、commit、push、reset、stash、切分支或清理。

已读取根规则、游戏 AGENTS／PROJECT_CONTEXT、游戏设计契约、测试策略、ANIM-A0／A1 和当前 R1／R2／R2 独立审查／R2.1 报告。采用 Godot、task-completion-guard、delivery-reporting、encoding-guard；未发现可读取的相关 Superpowers 入口。GitNexus MCP 不可用，本地 CLI 对 `_process`、`play_command_line`、`_draw_command_line` 返回 Target not found／UNKNOWN；不能据此声称零影响，已人工核对 Mission 调用点和表现消费者。

开始时 ANIM-A1 的动画库、正式控制器、生成器、四个倍率测试、runtime contract、run.ps1、PLAN 及 A0／A1 报告已有未提交内容，原样作为基线。R2.1 的 Mission 修复已存在，本轮没有编辑它。开始时武器视觉审计线程处于只读审计，后续已 idle；未发现并发修改 R2.1 或本次 VFX 文件的线程。没有向其他线程发送修改指令。

证据根 **E**：`test-output/anim-a1-1-20261019/`，开始时不存在。复制当前磁盘 **3,111 个源文件**并逐文件 SHA-256 核对，在 `E/sandbox/project/` 执行；复用 A1 的隔离导入缓存，完整 build 后续实际执行了 import。开始记录：[snapshot.json](../../test-output/anim-a1-1-20261019/snapshot.json)、[source-manifest.json](../../test-output/anim-a1-1-20261019/source-manifest.json)。

所有运行的 APPDATA／LOCALAPPDATA／TEMP／TMP 均在 E/profile 内；正式流程保存于独立 `user://test-runs/anim-a1-1-main.json`。窗口位于 (-3000,-3000)、unfocusable，仅使用 Viewport device42 输入，没有接管桌面或结束他人进程。

## 2. 根因与执行顺序

原实现 `world_interaction_vfx.gd` 的 `_process` 每帧推进寿命，但只有节流累计达到 `1/20` 秒才重建整条 ImmediateMesh，线头、线身、箭头均在同一个网格里。`play_command_line` 会同步首次绘制，但不重置全局节流相位；后续相位来自此前的渲染帧，与测试起始时刻无关。

原测试 `tests/survivor_command.gd:68–78` 禁用自动 VFX process，按 1/30 秒依次调用 Mission physics 和 VFX process，在第三次调用后检查真实几何。相位为 .04 时，前三次只刷新两次长几何，第三次已经移动的角色与旧线头相差 **0.0923595428m**。精确贴脚断言 `<.001m` 因而正确失败。不是路径未推进，也不是 ANIM-A1 动画末帧或 R2.1 尾步再次失效。

真实游戏还有独立的表现位置：`Survivor._process`（`survivor.gd:271`）把 VisualRoot 插值到物理位置之间。只用 actor.global_position 即使每帧采样，也可能与最终画面的脚部锚点错开；这里的脚部锚点指 VisualRoot 的地面投影，并非随迈步摆动的某根 Foot 骨。

当前调用顺序：

```text
地面输入 → Mission 接受命令／Survivor 路径（原逻辑）
  → play_command_line：同步初始化线身、连接点、线头
物理帧 → Survivor 真实移动（原逻辑）
渲染帧 → Survivor priority 0：VisualRoot 插值（原逻辑）
  → WorldInteractionVFX priority 1：
      先过期／无效成员回收
      → 到 20Hz 时刷新长线身／箭头／流动标记与连接点
      → 每帧从 VisualRoot 地面投影更新六顶点线头及共享透明度
  → 真正绘制画面 → 只读 frame_post_draw 取证
```

## 3. 最小修改与生命周期

| 文件 | 本轮修改 |
| --- | --- |
| `missions/world_interaction_vfx.gd:64,80` | VFX render priority=1，在线身节流之外更新短线头；不改变 physics 或模拟 delta。 |
| `missions/world_interaction_vfx.gd:146` | 每个接收者复用一个线头 view，新增一个同材质的 ThrottledBody 子节点；首次命令立即绘制，重复命令仍复用、重启 .8 秒寿命。 |
| `missions/world_interaction_vfx.gd:200,243,246` | 长线身从第一个分段连接点往目标绘制；六顶点连接段每帧连接可见角色与缓存连接点。世界点仍转换为 VFX 局部坐标，目标仍通过 mission.to_global 转换。 |
| 新增 `tests/command_line_follow.gd`、UID | 继承并运行原 Survivor Command 全部断言，再用独立 Mission fixture 检查相位、帧率、生命周期和插值锚点。 |
| `run.ps1:85,213` | 在 test／build 各追加该专项；原门禁顺序及断言保留，A1／R2.1 的已有追加项保留。 |
| `docs/PLAN.md`、本报告 | 同步真实完成项和 Camp UI 构建阻断。 |
| E 下证据 | 隔离源码／profile、工具、日志、逐帧观测、原始 JPEG 和 MP4。无删除文件。 |

没有每帧 new Mesh／MeshInstance；每条活跃线增加一个持久的子网格／绘制实例。每帧仅重新提交两个三角形，仍有固定的小量顶点提交成本，**不宣称底层 GPU 缓冲零分配或已经完成性能基准**。长几何保持 20Hz，半秒测试窗口每条线实测 9–10 次重建；长度不再扩大每帧更新量。

线头与线身共享材质，透明度每渲染帧使用原淡出公式。到站的退化线隐藏，下一次命令可以正常恢复。死亡、上车、进入建筑、非接近阶段搜索、寿命到期或 weakref 失效仍走原清理条件；queue_free 线头父节点同时回收线身子节点。选择环、点击反馈、搜索和战斗特效的实现没有改写。

## 4. 原测试与相位回归证据

**`tests/survivor_command.gd` 字节哈希与开始快照相同**。没有改 `<.001`、删测试、扩大误差、添加等待或约束测试顺序。相位设置只存在于测试／隔离观察器，不进入生产代码。新增 fixture 中的 await process_frame 用于检查 queue_free 完成；贴脚断言在同一推进调用后立即检查。

| 实际运行 | 结果 | E/logs |
| --- | --- | --- |
| 原代码、Native 30 FPS 上限、phase=.04 | **45/1，exit1**；gap=.0923595428m | `legacy-native-red-phase04.*` |
| 修复后、相同原断言及 phase=.04 | **45/0，exit0**；gap=0 | `legacy-native-green-phase04.*` |
| Native 60 FPS 上限、phase=0 | **45/0**；gap=0 | `legacy-native-60fps-phase0.*` |
| Native 30 FPS 上限、phase=.049999 | **45/0**；gap=0 | `legacy-native-phase049.*` |
| 未加相位观察器的原 Headless／Native 60 FPS 测试 | **43/0、45/0** | `legacy-original.*`、`legacy-native-60fps-original.*` |
| 新增完整专项 Headless | **552/0** | `legacy-green-final-follow.*` |
| 新增完整专项 Native，30／60 FPS 上限 | **554/0、554/0** | `legacy-native-follow.*`、`legacy-native-60fps-follow.*` |

新增专项在每次进程内覆盖 **30／60Hz × 0／.01／.025／.04／.049999 初始相位**，每帧检查几何并确认真实 Survivor 位移超过一米、Mesh 资源复用、长几何刷新预算、淡出和 .8 秒回收。另覆盖重复命令、VFX 平移旋转后的坐标空间、VisualRoot 的 -.03m 表现偏移、到站再下令、上车、室内以及释放接收者。

十种组合的最大 gap 均为 **0**，见 [Native 30 相位数据](../../test-output/anim-a1-1-20261019/results/legacy-native-follow/survivor-command/follow-phases.json)、[Native 60 相位数据](../../test-output/anim-a1-1-20261019/results/legacy-native-60fps-follow/survivor-command/follow-phases.json)。相位矩阵使用受控 physics／render 调用，不能冒充自然 main 调度；自然调度证据见下一节。

开发失败保留：第一版矩阵推进了原搜索任务，造成后续原测试找不到 arrival_house 的 SCRIPT ERROR；已改成独立 Mission 后再跑矩阵。首版预算把两名成员的重建总数当成一条线，10 项误报；已按实际接收者数量归一，未改原测试精度。相关 `legacy-red-follow.*`、`legacy-red-follow-isolated.*`、`legacy-green-follow.*` 保留，不计最终 PASS。旧实现的有效矩阵红测为 `legacy-red-final-contract.*`（544/127）；最终版额外补了生命周期检查，因此不把不同版本总数伪装成同数量前后对照。

## 5. 正式 Town 流程与录像

从正式 `core/main.tscn` 正常菜单创建 Run／继续 → 营地 → 今日行动 → 商业街 → MEDIUM_TOWN_V1。地面点击通过实际 Viewport 输入送达，最后按 X 停止；没有手动 tick、传送、改速度／HP／装备、开无敌或直接调用结束。两名正式角色为 SUR_001 夏知遥、SUR_002 苏晚星，使用各自 Definition 模型和正式 ExpeditionAnimationController。

| 自然调度观测 | 30 FPS 场景 | 60 FPS 场景 |
| --- | --- | --- |
| render delta 中位数 | .0333333333333333s | .0166666666666667s |
| 完整渲染帧观测／有线头的角色观测 | 936／370 | 1,114／658 |
| 最大线头—VisualRoot 地面投影误差 | **0m** | **0m** |
| SUR_001／SUR_002 采样累计位移 | 23.871／21.890m | 24.434／24.434m |
| 结束速度及状态 | 两人 speed=0；IDLE／KNIFE_IDLE | 两人 speed=0；IDLE／KNIFE_IDLE |
| 最后指令线数量／原生日志错误 | 0／0 | 0／0 |

上表位移是采样路径累计值，窗口不同，不用于宣称两档行程相等或 FPS 性能基准。运动判定按正式控制器 `_motion_speed > .08`，四组有效运动样本均为 RUN，错误 Idle=0。30 FPS 的 SUR_002 曾有一帧 current_speed=.103、motion_speed=.076 的 KNIFE_IDLE，低于原 .08 动作阈值，是合法低速瞬态；未删该样本，也未把它误归为 ×4 尾步。暂停、三倍率和循环资源回归另见第 6 节。

实际坐标、身份／实例、路径、速度、动画相位／倍率、时钟与 VisualRoot 在 `E/{town30,town60fps}/samples.jsonl`；每个渲染帧的线头、地面投影、误差、透明度和 lifetime 在 `line-frames.jsonl`；键鼠输入与快照在 trace.json。汇总：[native-runtime-measurements.json](../../test-output/anim-a1-1-20261019/native-runtime-measurements.json)。

- [town-move-stop.mp4](../../test-output/anim-a1-1-20261019/videos/town-move-stop.mp4)：**11.28s**，1600×900，91 张连续来源 JPEG；展示真实移动、短时指令线和停止回收。
- [town-move-stop-60fps.mp4](../../test-output/anim-a1-1-20261019/videos/town-move-stop-60fps.mp4)：**11.52s**，同规格，100 张连续来源 JPEG，独立自然运行。

保存的画面约每 .1 秒采集一次，编码按原始文件时间戳保留时长，**不是 30／60fps 全帧录制**；逐渲染帧数值观测独立保存。没有拼接会话、插值或重绘。两段 MP4 全量解码 exit0，来源、SHA-256、规格与编码日志见 [videos/metadata.json](../../test-output/anim-a1-1-20261019/videos/metadata.json)。已查看原始游戏帧，指令线从可见角色地面锚点延伸，无动画预览替代。

## 6. 时间、动画与周边回归

| 原有专项 | 本轮结果 | E/logs |
| --- | --- | --- |
| R2.1 simulation_substeps | **606/0** | `legacy-substeps.*` |
| R2 time_contract | **173/0** | `legacy-time.*` |
| ANIM-A1 runtime contract，12 人持续循环／一次性／倍率／跨帧 | **1,873/0** | `legacy-animation-contract.*` |
| Survivor Expedition Animation | **33 项，failures=[]** | `legacy-expedition-animation.*` |
| Parallel Commands | **36/0** | `legacy-parallel.*` |
| Combat VFX Phase1B | **25/0** | `legacy-combat-vfx.*` |

这些是原断言独立实际运行，汇总：[regression-results.json](../../test-output/anim-a1-1-20261019/regression-results.json)。R2.1／A1 已拥有的修复没有竞争写入。没有重新调 Run 倍率、改动作资源、时间／Gameplay、导航、武器或地图。自动化覆盖三档模拟时间、暂停恢复和动作循环，不冒充本轮又录制了全部 A1 战斗／营地／倍率流程。

## 7. 正式 Windows build 与剩余阻断

实际执行隔离工程 `run.ps1 -Mode build -GodotPath <4.7.2 console>`：**187.090s，exit1**。详见 [build-final.result.json](../../test-output/anim-a1-1-20261019/logs/build-final.result.json)、[完整 stdout](../../test-output/anim-a1-1-20261019/logs/build-final.stdout.log)、[stderr](../../test-output/anim-a1-1-20261019/logs/build-final.stderr.log)。

实际已通过：import、Search Gameplay **72/0**、Phase2 **265/0**、原生 Survivor Command **45/0**、新增 Command Line Follow **554/0**、Search Active Card **157/0**、Settings **14/0**、Camp Menu Overlay **30/0**。

随后 `tests/camp_ui_runtime.gd`：

1. SCRIPT ERROR：`member_buttons` 在 `Control (camp_hud_root.gd)` 上不存在。
2. 原断言 `Camp exposes active abilities on its left edge` 失败（该测试 :23，check 入口 day_loop_runtime.gd:19）。

这是 R2／R2.1 已记录的 Camp UI 阻断，本轮不扩大范围修复。构建没有运行到后部全部动画／时间门禁，不能用它们的独立绿测假称整个 build 通过。`executable_exists=false`，没有 export 或启动新 EXE，也没有直接 export 绕过测试。

另有一次原生 Survivor Command 退出打印 **4 ObjectDB instances leaked** 告警（位于其 45/0 之后、新专项引擎启动之前）；独立原生专项未复现该告警。未定位其所有权来源，不宣称已修复；本次线节点到期回收由独立断言及自然运行另行验证。

## 8. 保全、已验证与未测试

[protected-runtime-hashes.json](../../test-output/anim-a1-1-20261019/protected-runtime-hashes.json) 确认 Mission、Survivor、正式动画控制器／库、原 Survivor Command／time_contract／simulation_substeps／A1 contract 的字节哈希不变。根规则及 Git index 保留；本轮新增项与 run.ps1 的两处追加不覆盖 A1 成果。旧磁盘 VFX 原始字节另存 E/baseline；Git blob 的换行与磁盘不同，比较时明确区分内容和字节，不把换行差异写成并发源改动。

最终 [preservation-verification.json](../../test-output/anim-a1-1-20261019/preservation-verification.json)、[final-checks.json](../../test-output/anim-a1-1-20261019/final-checks.json) 记录本轮文件清单、原缓存／旧 build／旧证据的大小和 mtime、源码／索引及媒体检查。没有把大型旧产物的 metadata 核对宣称为逐字节证明。PLAN 已同步本阶段；旧报告保持历史事实。

已验证：F5 原生前后对照、相位矩阵、自然 30／60 FPS 调度、出现／跟随／淡出／回收、原命令保护分支、时间与动画专项、真实 Town 录像及完整 build 的实际阻断位置。

未通过：完整 Windows build。未测试：export／新 EXE 启动、macOS、全部地图 seed／武器组合、完整性能与 GPU 分配基准、全部主流程及五日通关。ANIM-A1 的原曲线接缝／脚滑、F4 手枪、F6 模型回退及其它旧门禁问题没有修复或重新销账。

环境：[Windows] Godot `4.7.2.stable.official.ed1daf0bf`，Compatibility／RTX3060／NVIDIA591.86，Dummy 音频；Python3.13.5、FFmpeg8.1.1、Git2.39.1.windows.1。Node26.4.0 不符仓库22.x约束，未调整；Blender未使用。[macOS] 无可访问环境，未验证。

**ANIM-A1.1 到此停止；不继续其他阶段，不自动提交。**
