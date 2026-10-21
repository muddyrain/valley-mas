# 幸存者移动表现优化

2026-09-12。范围为当前正式 Mission 的幸存者移动与公共动画驱动。模型、Skeleton、Skin、动画关键帧、地图、HUD、武器玩法和营地逻辑均不属于本次改动。

## 当前 Locomotion 原实现

正式 Mission 的实际链路为：鼠标目标 → `city.path()` / AStarGrid2D → 幸存者的路径点数组 → `Node3D.position` → 实际 XZ 位移速度 → 公共 AnimationTree。这里没有 CharacterBody3D、NavigationAgent3D 或 move_and_slide；它们属于营地角色。本次沿用已有网格导航。

原先没有 current velocity 或加减速阶段。角色每次物理更新按最高速度消耗路径，视觉 Yaw 直接赋值。动画已有 0.18 秒交叉淡入淡出和基于速度的播放倍率；只有 Walk/Run 有迟滞。

## 找到的不丝滑原因

1. 按住鼠标每 0.08 秒重新寻路，AStar 把已经走过的四舍五入起始网格点重新放在前面，角色反复回拉。原生同目标持续命令样本中每名角色发生约 90 次反向小步，约 3 秒仅前进 0～0.63 米。
2. 瞬时满速、到点瞬停、视觉瞬间转身。
3. 物理移动和手动骨骼推进为 60 Hz，摄像机在渲染帧更新；本机原生渲染约 165 FPS。匀速直线阶段约 63.6% 的渲染帧重复同一个角色位置。
4. Idle 没有进出阈值差；原先全局动画倍率同时作用于正在交叉混合的不同动作，无法各自保持与实际速度对应的步频。

## Acceleration / Deceleration 调整

- 加速 10 m/s²，减速 14 m/s²。4.2 m/s 起步约 0.42 秒；最高速度和现有速度增益、惩罚保留。
- 路径内以最多 1/120 秒的积分步长处理水平速度和距离，使用梯形积分。沿既有折线路径推进，不添加会穿过建筑的自由惯性位移。
- 记录实际位移得到的 XZ velocity；动画读取实际速度，不读取目标速度。没有新增整体 Y 位移或缩放反馈。

## Rotation Smoothing 调整

视觉朝向按最短角追踪实际移动方向，上限 600°/秒，处理 ±PI。90° 约 0.15 秒，180° 约 0.3 秒；导航始终立即按路径推进，不等待模型转完。

## Animation Playback Speed 调整

继续读取现有动作元数据：Walk 参考速度约 0.96774 m/s，Run 约 2.95238 m/s。两段动画各有独立 Rate，倍率响应时间常数约 56 ms；两名角色在同实际速度下步频一致。

Walk 限幅 0.8～1.8，Run 0.65～1.55。未机械采用建议的 1.25 上限：1.3 m/s 的 Walk 需要约 1.343 倍，4.2 m/s 的 Run 需要约 1.423 倍，压到 1.25 会加重滑步。高速增益超过动作倍率上限时仍有脚滑，这是当前动作库的边界。

## Idle / Walk / Run Blend 调整

Idle → Walk/Run 为 0.18 秒，返回 Idle 及 Walk ↔ Run 为 0.20 秒。Idle 保持自身时钟，Walk/Run 混合期间分别使用各自动作的速度倍率。

Idle 进入移动阈值 0.08 m/s，退出移动阈值 0.035 m/s；Walk → Run 为 1.9 m/s，Run → Walk 为 1.65 m/s。两名角色使用相同的物理速度阈值。

Godot 的淡入淡出时长不随下游动画倍率缩放，本次并未把原有 0.18 秒误判为硬切；相关行为见 [AnimationNodeStateMachineTransition 官方说明](https://docs.godotengine.org/en/stable/classes/class_animationnodestatemachinetransition.html)。公共关键帧和 AnimationLibrary 均未改动。

## Arrival / Stop 调整

根据整条剩余路径计算 `sqrt(2 × deceleration × remaining_distance)` 的到达速度上限，不在每个网格点刹停。最后直接消耗完剩余水平距离，避免尾部无限挪动。

普通 X 停止沿当前安全路径减速；4.2 m/s 时约 0.3 秒、0.63 米。搜索、自卫、指向射击、死亡和上车继续保留立即停止的玩法契约。

同一目标不重复重建已有路径；换目标时只在下一段可直达的情况下跳过起始网格点，受阻时保留原路径。没有修改地图寻路器。

## Physics / Render 更新检查

世界位置仍由 Mission 的物理更新决定。Mission 显式启用幸存者视觉插值：只插值模型的 XZ 和 Yaw，延迟最多一个物理步；Root Motion 始终关闭。动画按渲染 delta × Mission time_scale 推进，战术暂停不推进动画。

营地和 Rig Inspector 继续使用已有的显式动画时钟。真实 Mission 手动推进的自动化测试也继续按测试 delta 驱动，不发生双倍推进。

此次没有打开全项目 physics interpolation 或改摄像机脚本。官方关于物理与渲染更新差异的解释见 [Godot 插值说明](https://docs.godotengine.org/en/stable/tutorials/physics/interpolation/advanced_physics_interpolation.html)。

## FPS / Frame Time 测试

设备 NVIDIA GeForce RTX 3060，Godot 4.7.2，Compatibility，1600×900，正式地图、HUD、摄像机尺寸 25。原生实时运行，不设置 fixed FPS，不手动推进物理；测量窗口排除 PNG 编码和场景初次装载。为隔离移动，三组性能样本都关闭敌人生成与战斗，不代表高敌群、夜景或其他硬件。

| 样本 | FPS 前 → 后 | 平均帧时前 → 后 | P95 前 → 后 | 优化后 P99 / 最大帧时 |
| --- | --- | --- | --- | --- |
| 夏知遥单人 | 165.08 → 164.96 | 6.06 → 6.06 ms | 6.66 → 7.21 ms | 8.44 / 19.19 ms |
| 苏晚星单人 | 165.00 → 164.73 | 6.06 → 6.07 ms | 6.73 → 7.00 ms | 9.27 / 14.55 ms |
| 双人 | 164.90 → 163.72 | 6.06 → 6.11 ms | 6.90 → 6.81 ms | 9.12 / 12.45 ms |

物理配置 60 Hz，实测约 60 Hz；优化后三组物理处理峰值分别约 1.52、1.43、2.46 ms。全部六组计时样本均无超过 33.33 ms 的帧；本次没有证据把观察到的回拉归因于地图掉帧，也没有宣称提升地图性能。

直线移动中渲染位置重复率由约 63.6% 降为 0%。证据保存在 `test-output/locomotion-polish/verified-project/test-output/locomotion-polish/{before,after}.json`；两次使用同一份冻结的正式地图副本，仅切换本次四个运行文件。

包含并行任务最终地图、HUD、武器资源的交付源码另行原生复测：夏知遥 164.68 FPS / 6.07 ms，苏晚星 165.03 FPS / 6.06 ms，双人 165.04 FPS / 6.06 ms；P95 分别为 6.52、6.39、6.40 ms，最大帧时 12.46、10.71、14.84 ms，没有超过 33.33 ms 的帧。三组停止均回到 Idle，持续目标反向小步均为 0。证据为 `test-output/locomotion-polish/delivery-project/test-output/locomotion-polish/delivery.json`。

## 夏知遥实测结果

单人原生长直线、同目标连续命令、转向、快速反向、短距离到达和 Walk 已执行。持续命令样本前进距离由约 0.52 米提升至约 13.44 米，无反向回拉；动画状态、转身、停止使用公共规则。没有整体弹跳。

## 苏晚星实测结果

相同测试已执行。持续命令样本从几乎原地摆动变为前进约 12.67 米，无反向回拉。默认速度 4.0 m/s，夏知遥为 4.2 m/s，保留这一原始数据差异；相同速度输入下的步频专项通过。

## 双角色同时移动结果

两人同时移动的回拉次数降为 0，匀速直线模型插值重复率为 0%。混合和转身规则相同，动画状态互相独立，共用同一个 AnimationLibrary。

## Mission 实际运行结果

原生正式地图和摄像机已执行前后测试。另用真实 Mission/地图的可重复物理推进验证小角度转向、90° 转向、完整绕障、到达、Ctrl 停步和战术暂停；修车铺、货运库房、巴士三段两人均到达，沿途没有进入禁止网格，没有新增 Y 弹跳。

109 项移动专项、42 项共享动画移动检查、15 项视觉稳定检查、908 项公共动画兼容检查已通过。完整 Windows 构建也已通过，包括 1921 项地图、48 项行动、52 项搜索、36 项并行命令、329 项效果、134 项正式地图原生流程检查；另补跑 50 项真实鼠标/键盘控制检查通过。

独立 EXE 的菜单、营地、今日行动、Mission、武器页、展厅共 12 组 headless/native 启动通过；另用同版本 Godot 挂载 EXE 验证包内武器与角色资源，两组通过。最终构建于 2026-09-12 16:30，451,621,400 字节，SHA256 为 `EE57DABC34F82501B2D0907142B66A817E5FD9EF996ED660D929437EC07293D7`。

最终交付副本重新采自当前主工作区，包含已完成的地图/HUD/武器改动和导出检查修正；没有把最初性能对比副本中的旧资源覆盖回主工作区。26 个角色 Source/Runtime、标准 Rig 和公共动画源文件与本次开始时的哈希完全一致。

已发布到唯一正式入口 `build/BlueHourHomeward.exe`，并同步 `build/BUILD-INFO.json`。本任务不自动提交 Git；停止在当前阶段，等待用户验收。

## 修改文件列表

- `survivors/survivor.gd`：重发命令修复、加减速、到达、转向、视觉插值。
- `survivors/survivor_animation_controller.gd`：Mission 渲染时钟、迟滞、独立动作倍率。
- `assets/animations/humanoid/locomotion/bh_humanoid_locomotion_tree.tres`：动作倍率节点与混合时间；不修改关键帧。
- `missions/mission.gd`：只增加启用视觉表现、普通停止调用两处。
- `tests/locomotion_polish.gd`、`tests/locomotion_mission.gd`、`tests/locomotion_polish_runtime.gd` 及其三个 `.uid`：专项、正式路径与原生性能验证。
- `tests/survivor_locomotion.gd`、`tests/effect_system.gd`：原有匀速断言先进入稳定速度，继续验证最高速度及原有增益。
- `tests/mission_flow.gd`：普通停止改为先验证短暂减速结束，再检查稳定停住。
- 本报告和 `docs/PLAN.md`：记录本次范围与完成状态。

以上为本任务的修改，不包含其他任务在主工作区的地图、营地、HUD、武器或资产改动。合入时保留了并行新增的武器初始化。

## 仍然存在的问题

现有 in-place 动作没有脚底锁定；极低速起停、急转和超过倍率上限的高速增益仍可能出现脚滑。折线路径方向保持既有导航行为，模型快速追踪方向，不会等待转身；急速反向仍有短暂侧滑。

本次解决位移回拉、瞬时起停和更新频率不一致，不能把自动化通过当成用户手感验收。部分 Mission 测试退出仍打印已有 ObjectDB 清理警告；未扩展为地图或对象池改造。没有制作新动作、修改网格/权重或开始 Foot IK、Root Motion、Stride Warping。
