# ANIM-A1：角色动作循环与移动同步修复

日期：2026-10-19，Asia/Shanghai。平台：[Windows] Windows environment required。

**持续动作末帧冻结与独立跑动倍率已修复；R2.1 尾步修复完成集成回归。正式游戏录像已交付。完整 Windows build／新 EXE 仍 BLOCKED。** 原始动作的首尾接缝差异继续存在，不能写成全面动画质量或发布验收通过；本轮没有改动作曲线来消除这些差异。

## 1. 基线、并发责任与历史核查

仓库 `D:/my-code/valley-mas`，游戏 `apps/blue-hour`；开始时 HEAD `8004ebabc6823c1c238045bf5406916879ed134b`，分支 `master`。开始时保留根 AGENTS／CLAUDE 暂存、R1/R2 未提交代码和报告、ANIM-A0 成果，以及正在出现的 R2.1 测试。本轮没有 reset、stash、checkout、add、commit、push 或清理。

最终保全检查发现外部会话已将 HEAD 推进到 `865edec300e01d64d015924b3e6f391567ba46be`。本轮未执行这些提交，也未回退它们；ANIM-A1 源码／报告仍为未提交工作区改动。原文件内容保护和运行副本哈希核对均通过，R2.1 Mission 内容与本轮开始快照一致。根入口的索引 blob／mode 与开始相同，但外部提交已把原暂存内容纳入历史，最终 cached diff 为空，不能声称暂存状态仍未变化。不能把共享仓库的 HEAD 变化误报为本轮自动提交或宣称整个仓库历史未变化。

已读取根／游戏规则、PROJECT_CONTEXT、PLAN 当前阶段、游戏定位与时间契约、Godot 规范、Art Bible／Asset Pipeline／Model Catalog、ANIM-A0、近期动画批量报告、R1、R2、R2 独立审查。R2.1 报告在工作期间落盘后已补读。使用 Godot、task-completion-guard、delivery-reporting、encoding-guard；无可读取的 Superpowers skill。GitNexus CLI 对相关 GDScript impact 返回 UNKNOWN／Target not found，未伪造图谱影响结果；人工核对影响集中在正式动画库、控制器和其测试，Camp 复用同一控制器。

证据根 **E = `test-output/anim-a1-20261019/`**。开始复制 3,105 个当前磁盘文件，逐文件 SHA-256 匹配，见 [snapshot.json](../../test-output/anim-a1-20261019/snapshot.json)、[source-manifest.json](../../test-output/anim-a1-20261019/source-manifest.json)。复用 A0 隔离缓存，未把它说成全新导入；后续完整 build 实际执行了导入阶段。所有运行均在 E 下工程／profile，原工程缓存、构建、玩家存档及既有录像未用于写入。

### F2 与 R2.1 的边界

通过只读线程状态确认“线程A”正在执行 R2.1，磁盘 Mission 已含相对舍入余量合并方案。本轮**没有编辑 `missions/mission.gd`、Survivor.tick／_move 或时间调度**。采用已存在修复进行独立集成验证；R2.1 完成后的报告见 [R2.1](../development/blue_hour_r2_1_animation_tailstep_fix_report.md)。

R2.1 的 `SIMULATION_ROUNDING_TOLERANCE` 只在没有内部技能到期边界时把减法舍入余量并入有效子步，保留完整时间和真实极短边界。本轮新增跨物理／渲染帧测试、实际三档 UI 操作，并复跑原 606／173／26 专项；不是再写一份 F2 修复。R2.1 自己的旧动画基线录像与本轮动画修复后录像分别保存。

### F3 历史配置缺口

指定的 `docs/reports/2026-10-03_survivor_animation_v1_finalization_report.md` 在当前磁盘和可见 Git 历史未找到；未假造该文件或补写其结论，也未 fetch 远端代替当前磁盘事实。

现有控制器历史只有 `fd0e8bad`、`02f4cca0` 两次相关提交，创建时即使用实际速度比，未包含独立 1.45。`git log --all -G '1\.45'` 在控制器、生成脚本和报告范围未给出对应配置提交。生成器只复制动画并重定向骨轨，播放倍率属于控制器，库生成并不会保存运行时的 Rate 参数。因此，**可证实的技术原因是正式新图从接入起缺少独立 Run 基准倍率；无法证实某个历史 1.45 设置在哪次提交被删除**。本轮依据用户明确确认的 1.45 恢复，不把该证据缺口写成已还原历史丢失链。

## 2. 具体修改与数据流

### F1：持续动作与事件动作的配置

`assets/characters/survivors/animations/survivor_animations.tres` 仅增加七行 `loop_mode = 1`：

| 持续循环 LOOP_LINEAR | 一次性 LOOP_NONE，保持原语义 |
| --- | --- |
| survivor_idle、survivor_walk、survivor_run、rifle_idle、rifle_run、knife_idle、unarmed_idle | rifle_shoot、knife_attack、hit_reaction、death |

`tests/build_survivor_animation_library.gd:17` 增加相同 `LOOPING_CLIPS` 清单，复制导入动画后明确设置 loop_mode；重新生成不会再丢循环。没有复制公共动作到角色目录，没有新增或替换动作源。

[library-metadata-only.json](../../test-output/anim-a1-20261019/library-metadata-only.json) 验证：移除新增的七行后，正式库文本与原基线逐字节一致。片长、键、轨道、姿态、资源绑定均未改；GLB、Rig、Root Motion 和 Gameplay 移速未动。

隔离副本实际重新执行生成入口，11 段 Loop 配置全部正确。严格资源值签名最初发现五条四元数轨道的往返差异，随后逐键量测：片长、轨道结构和键时间相同，最大四元数分量向量差为 **6.064333e-8**，小于一个 float32 epsilon；其余轨道精确相同。证据：[regeneration-detail.json](../../test-output/anim-a1-20261019/regeneration-detail.json)、[regeneration-verification.json](../../test-output/anim-a1-20261019/regeneration-verification.json)。这是重生成副本的数值往返，不是本轮对正式曲线的改写；正式库采用七行元数据补丁，未覆盖为重生成文件。

### F3：独立倍率，保留实际速度映射

`survivors/survivor_expedition_animation_controller.gd:9,228` 新增常量 `RUN_PLAYBACK_MULTIPLIER=1.45`，只在 desired 为 RUN／RIFLE_RUN 时相乘：

```text
原运动映射 = clamp(实际水平速度 / 基础速度, .55, 1.6)
RUN / RIFLE_RUN = 原运动映射 × 1.45
WALK = 原运动映射
静止 Idle = 1
ATTACK / DEATH = 1
RifleShoot / Hit OneShot 仍在 Rate 节点之后，独立事件推进不被跑动倍率缩放
```

普通 2.8m/s 对应 rate=1.45；K9 原有 -2% 移速使实际速度约 2.744m/s，rate≈**1.421**，这表示 0.98×1.45 正确生效，不是把 K9 的武器数值改成零修饰。Walk 的 .55 下限、Idle、攻击／受击／死亡的原倍率保持；不把整体倍率上限重新夹成 1.6，也未通过改 Gameplay 距离“匹配”动画。

正式身份链保持 `SurvivorDefinition.survivor_id → model_path → Survivor.setup → ExpeditionAnimationController → Survivor AnimationLibrary`。旧兼容控制器和 Public 库未修改，也未拿旧图循环结论代替正式图验收。

### 修改文件清单

| 类型 | 文件／内容 |
| --- | --- |
| 修改 | `assets/characters/survivors/animations/survivor_animations.tres`：七项循环元数据 |
| 修改 | `tests/build_survivor_animation_library.gd`：生成循环契约 |
| 修改 | `survivors/survivor_expedition_animation_controller.gd`：独立 1.45 常量和条件相乘 |
| 新增 | `tests/survivor_animation_runtime_contract.gd`、UID：12 人循环骨骼与状态、跨物理／渲染时钟回归 |
| 修改 | `tests/public_locomotion_production.gd`、`locomotion_polish.gd`、`survivor_production_pack.gd`、`remaining_survivor_batch.gd`：仅将旧 Run 速度期望对齐新倍率；精度阈值及其他断言保留 |
| 修改 | `run.ps1`：原 batch 专项之后，在 test／build 各插入新增专项；保留 R2.1 及原门禁 |
| 修改／新增 | `docs/PLAN.md` 顶部本阶段记录、本报告；保留其他线程的 R2.1 段落 |
| 新增隔离证据 | E 下工具、日志、原始帧、JSON、截图、视频、源码／缓存副本 |
| 删除 | 无 |

## 3. 自动化证据与循环判定

新增专项不是只检查状态名：对每个正式模型的七个持续片，通过实际 AnimationPlayer 驱动 Skeleton，在每个周期的 1/4、3/4 相位读取全部 23 骨 Transform，连续三个周期要求周期内骨骼实际变化、同相位姿态重复。四个一次性片推进到结束后再推进一秒，确认没有重启循环。随后验证正式控制器 Run／Walk／Rifle Run／Idle 的实际 rate。

City／Town 集成部分使用真实 Mission 与渲染消费者，组合 60Hz 物理与 20／30／144Hz 渲染、×1／×2／×4；真实运动采样必须保持 RUN，另断言模拟区间、暂停相位／位置冻结和恢复停止。它是明确标记的受控 fixture，和第 4 节正式玩家流程分别取证。

| 检查 | 本轮结果／证据 |
| --- | --- |
| 同一新增专项、原动画库／控制器、修正后的测量口径 | **1,873 checks／307 failures**，exit1，`logs/legacy-red-validated-metric.*`；R2.1 保留，红测针对动画循环和倍率 |
| 最终新增专项 | **1,873／0**，exit0，`logs/legacy-contract-transform-metric.*`；[完整结果](../../test-output/anim-a1-20261019/sandbox/project/test-output/animation-runtime-contract/report.json) |
| 原 Survivor Animation Pipeline | **301／0** |
| 原 Survivor Animation Batch | **1,408／0**，含 12 人装备、事件、受击／死亡状态和骨骼保护 |
| 原 Survivor Expedition Animation | **33／0** |
| Public Locomotion Production／Locomotion Polish | **495／0、109／0**，精确倍率期望已对齐 1.45，没有放宽容差 |
| Camp Locomotion／Combat Animation Mission | **171／0、26／0** |
| 原 R2 Time Contract／R2.1 Substeps | **173／0、606／0**，原文件／断言保留 |
| 原 R1 Mission Dayloop | **26／0**，含撤离／全灭／唯一结果受控回归 |
| Parallel Commands／City Noise | **36／0、13／0** |
| Survivor Production Pack 源码模式尝试 | **14 checks／2 failures**，见第 6 节，不能计为导出包验收 |

原专项汇总及日志：[regression-results.json](../../test-output/anim-a1-20261019/regression-results.json)。原 test/build 仍完整执行原断言；修改的四处旧速度期望属于用户要求恢复倍率后的契约更新，不是删除失败或放宽精度。

首次新增测量使用 Basis 转 Quaternion 再算 angle_to，出现“完全相同存储姿态仍有非零角度”的数值底噪，误报一次性动作不保持等。已改为直接比较存储 Transform 的位置和三条 Basis 轴，**未放宽原阈值**。第一版 355 失败及第一次修复后 84 失败原日志保留；最终可信前后对照为同一正确测量口径的 **307→0**，不混用数字。

## 4. 正式 core/main.tscn 玩家流程与视频

主会话由正式菜单正常创建 Run，后续从“继续”回到该营地，再经今日行动／商业街进入正式 MEDIUM_TOWN_V1；输入为 Viewport device42，倍率通过 F1 实际点击下拉和弹出项，Space／X 也是键盘事件。没有手动 tick、传送、改血量／无敌、刷敌或调用内部结束／结算制作录像。

K9 采用用户允许的测试装备：只在隔离 Mission 实例上经既有 equip API 装备，屏幕持续标注 **ANIM-A1 TEST EQUIPMENT: K9 / ISOLATED SAVE**，snapshot 标记 fixture_equipment=true。不改 Campaign、武器数据或玩家存档；这不是合法掉落／营地购买换装流程的通过证明。

| 指定视频，均 1600×900／H.264 | 内容与可核对结果 |
| --- | --- |
| [camp-walk-loop.mp4](../../test-output/anim-a1-20261019/videos/camp-walk-loop.mp4)，30.40s | Idle→自然 POI Walk→停止 Idle。SUR_001 沿真实路线累计 14.83m，连续约 **3.42 周期**、3 次相位回绕；SUR_002 7.67m、单次约1.73周期。两人无移动停帧。 |
| [town-run-loop.mp4](../../test-output/anim-a1-20261019/videos/town-run-loop.mp4)，21.20s | 正式地面指令、连续 Run、转向和 X 停止。SUR_002／SUR_001 累计路径 52.85／47.51m，连续约 **5.34／4.88 周期**；移动停帧采样为零。 |
| [rifle-run-loop.mp4](../../test-output/anim-a1-20261019/videos/rifle-run-loop.mp4)，19.04s | 两名测试 K9 持枪移动、转向、X→Rifle Idle；两人约 38.38m，连续约 **14.59 周期**，无移动停帧。 |
| [speed-pause-comparison.mp4](../../test-output/anim-a1-20261019/videos/speed-pause-comparison.mp4)，32.36s | 正式 ×1／×2／×4 下拉操作、Space 冻结／恢复和再次地面移动；所有有效运动样本为 RUN 或 RIFLE_RUN，没有错切静止状态。 |

原始连续 JPEG、输入 trace、逐帧数据在 `E/final/`、`E/before-rate/`、`E/camp-confirmation/`。全部视频按真实原始文件写入时间编码 VFR，不插值、不重绘、不合成会话。规格、帧数、SHA-256、完整解码退出码见 [videos/metadata.json](../../test-output/anim-a1-20261019/videos/metadata.json)，指定四段均完整解码 exit0。录制负载影响墙钟帧率，不作为性能或精确墙钟倍速基准。

### 营地补录的来源与限制

首段 48.48s 营地自然录像中，两人最长单次只走约 1.86／1.94 周期，不能声称达到三周期。该原片保留为 `camp-walk-loop-short-observation.mp4`。补录从 **ANIM-A0 通过正式 UI 创建的 seed53514487 隔离存档**逐字节复制到全新 A1 测试保存，再从 main 菜单“继续”进入，等待其原有自然 POI 路线；没有更改成员／seed／位置、强制 POI 或直接调用 move_to。来源哈希见 [camp-save-provenance.json](../../test-output/anim-a1-20261019/camp-save-provenance.json)。

补录证明 SUR_001 连续超过三周期；SUR_002 的营地三周期证明来自自动化，不把其1.73周期原生片写成三周期。两名角色都已经走真实 Camp／Town 玩家流程。

### 坐标、相位与时间数据

[runtime-measurements.json](../../test-output/anim-a1-20261019/runtime-measurements.json) 汇总实例 ID、模型、前后世界坐标、路径距离、状态、真实相位回绕、最长连续周期、倍率映射误差及错误状态数。每个原始 sample 还包含路径点／目标／剩余距离、current_speed／actual_velocity、VisualRoot／模型世界坐标与朝向、Tree active、播放片名／相位／片长、rate、physics/render delta、Engine／Mission time_scale、暂停状态、关键骨骼姿态和进程时间戳。

| 正式有效帧对照 | Clock 增量 | 按物理帧应推进 |
| --- | --- | --- |
| ×1，8 帧 | .133333333333334s | 8/60×1 = .133333333333333s |
| ×2，7 帧 | .233333333333299s | 7/60×2 = .233333333333333s |
| ×4，5 帧 | .333333333333300s | 5/60×4 = .333333333333333s |

Space 的有效冻结观测跨 **1.938s** 墙钟，clock=47.9333333333319s，坐标、动画相位与所采骨骼姿态相同；恢复只消费接下来的模拟时间。F1 菜单暂停的坐标／相位也不推进，但分组最早帧可能包含 VisualRoot 的插值落位，不能将整个菜单分组写成逐字段骨骼快照完全相同。已有表现插值不随本轮改动重构。

×4 有效运动样本无错误 Idle；最大倍率映射误差小于 7e-15。相同模拟区间的位移／战斗／搜索／效果／撤离守恒由原173与606专项复验，原生不等长窗口的行程不用于宣称距离精确相等。

## 5. 1.0→1.45 对照、步频与接缝

先在 **F1 已修复、R2.1 已存在、倍率仍为1.0** 的固定副本录制 [town-run-rate-before.mp4](../../test-output/anim-a1-20261019/videos/town-run-rate-before.mp4)（17.72s）和 [rifle-run-rate-before.mp4](../../test-output/anim-a1-20261019/videos/rifle-run-rate-before.mp4)（13.00s），再用1.45最终代码录制上表两段。它们均为正式 main 游戏画面，不用 A0 的末帧冻结片段伪装成倍率对照。相同 Run／地图内容继续使用，输入采样时长不同，不能把视频时长比当作精确位移对照。

基础速度、角色移速和武器修饰不变。普通 Run 的片长5.133333s，在 full-speed rate1.0时周期约5.133s，在1.45时约**3.540s**；K9 Rifle Run 片长1.366667s，实际 rate约 .98→1.421，对应周期约1.395→**.962s**。这衡量片循环节奏，不等于把一个片段误认为一次迈步。

原生连续帧和实际骨相位都确认节奏变快、脚／腿持续运动，停止和转向不会阻塞真实位移。没有再出现 A0 中“几米位移配同一末帧”的持续滑行。**未新增 Foot Lock／IK、重新烘焙或改变位移，因此不能声称原步态在所有支撑相位完全无脚滑。** 本轮没有做蒙皮鞋底接触分类或亚帧足底滑移精测，相关观感请结合前后完整录像评估。

已额外量测原片端点，见 [loop-seams.json](../../test-output/anim-a1-20261019/loop-seams.json)：

| 持续片 | 原始最大局部旋转端点差 |
| --- | --- |
| survivor_walk／unarmed_idle | 约 .04° 数值量级 |
| survivor_idle／knife_idle | 约 3.13°／5.33° |
| survivor_run | 约 **22.96°**，LeftLowerArm |
| rifle_run | 约 **83.63°**，RightUpperArm |
| rifle_idle | 约 **30.18°**，Head |

这些是原曲线的局部端点差，F1/F3 没有改变它们；长枪最终画面还经过既有握持／瞄准约束，不能直接把83.63°当作屏幕上同等幅度的跳变。已经检查回绕相邻原帧与正式片段，但**循环接缝的完全平滑验收未通过／未关闭**。本轮关闭的是“停止在末帧”和“倍率丢失”，不会通过修改用户禁止变更的曲线、Rig 或 Root Motion 让此表消失；未继续 ANIM-A2。

## 6. Windows build 与剩余失败

实际执行 `E/sandbox/project/run.ps1 -Mode build`，**106.914s，exit1**。导入、Search Gameplay72和Phase2 265通过，随后正式 Native Survivor Command **45 checks／1 failure**，原样停在 `tests/survivor_command.gd:78` 的 **Line follows the moving survivor's feet**。原断言未改，未删除门禁或直接 export。证据：[build-final.result.json](../../test-output/anim-a1-20261019/logs/build-final.result.json)、[stdout](../../test-output/anim-a1-20261019/logs/build-final.stdout.log)、[stderr](../../test-output/anim-a1-20261019/logs/build-final.stderr.log)。

这是 A0/R1 已确认的20Hz VFX相位风险，不据此把本轮骨骼循环或移动守恒判成失败，也不把其它专项绿写成 build绿。本次尚未运行到 build 后部新增动画／时间门禁，其证据来自单独实际运行。`executable_exists=false`，原 build 不变；**没有新 EXE，未执行新导出程序启动**。

`survivor_production_pack.gd` 头部要求在 exported embedded pack 运行，本轮曾误以源码模式执行，得到14项／2失败：两份 source GLB 在源码工程当然仍存在。该次日志保留在 regression-results，不能把它改写成导出包通过，也不能归因于倍率。对应12项其余断言未报错；真正内嵌包验证因 build阻断仍未执行。没有为此删除源资产或放宽原断言。

F4 手枪射击表现、F5 指令线实现、F6 模型失败回退均未主动修复；AI、导航、地图、营地经济、武器数值、R3/R4、真实存档均未修改。旧完整搜索／效果／武器门禁没有全部重跑，不能据本轮回归替它们销账。

## 7. 十二人覆盖与完成边界

所有正式模型仍从 Definition 按 SUR_ID 绑定同一23骨架和同一11段库。12人各七个持续片真实骨骼推进三个周期，四个一次性片结束不重启，正式控制器的Run／Rifle／Walk／Idle状态及倍率均自动化覆盖；原batch另覆盖武器事件／Hit／Death。

| 角色 | 自动化资源／骨骼／状态 | 正式 Camp／Town 玩家流程录像 |
| --- | --- | --- |
| SUR_001 夏知遥 | PASS，证据见1873专项及1408 batch | 已覆盖；营地自然连续3.42周期、Town／K9／暂停倍率 |
| SUR_002 苏晚星 | PASS，同上 | 已覆盖；营地自然移动，Town／K9／暂停倍率；营地原生单次未满3周期 |
| SUR_003 林见月 | PASS，同上 | 未测试 |
| SUR_004 陆清禾 | PASS，同上 | 未测试 |
| SUR_005 沈砚川 | PASS，同上 | 未测试 |
| SUR_006 唐栀 | PASS，同上 | 未测试 |
| SUR_007 顾予安 | PASS，同上 | 未测试 |
| SUR_008 程茉 | PASS，同上 | 未测试 |
| SUR_009 周野 | PASS，同上 | 未测试 |
| SUR_010 许昭宁 | PASS，同上 | 未测试 |
| SUR_011 贺临川 | PASS，同上 | 未测试 |
| SUR_012 宋时雨 | PASS，同上 | 未测试 |

未测试的其它边界：macOS、音频／FPS性能、全部地图seed、全部装备成长组合、实际五日通关、真实玩家存档迁移或磁盘故障、新EXE及全部角色的自然接敌画面。自动化原Dayloop通过不等于本轮重录完整搜刮归航结算和全灭流程。

## 8. 工作区保全、环境与交付

本轮按独立文件补丁保留 R2.1 的 Mission、原606测试、UID、run.ps1入口及PLAN记录；新动画专项只在已有batch后插入两条调用。不存在“把整个工作区diff当成本轮改动”的做法。根规则内容与索引 blob 保持，外部提交导致的暂存状态变化见第1节；其它并发新增报告、证据和既有文件变动单列于 [preservation-verification.json](../../test-output/anim-a1-20261019/preservation-verification.json)，未删除或回滚它们。

所有写盘运行使用 E/profile；主会话保存 `user://test-runs/anim-a1-main.json`，营地补录使用独立复制件。窗口(-3000,-3000)、unfocusable，仅向自身Viewport输入；本轮Godot进程均已退出，不结束他人进程。

| 环境 | 本轮情况 |
| --- | --- |
| [Windows] Godot | 4.7.2.stable.official.ed1daf0bf；Compatibility／RTX3060／OpenGL3.3 NVIDIA591.86；1600×900；Dummy音频 |
| [Windows] Python／Node／Git／FFmpeg | 3.13.5／v26.4.0／2.39.1.windows.1／8.1.1；Node不符仓库22.x约束，未调整 |
| [Windows] Blender／Editor | 未使用；未烘焙、未改资产源或用户偏好；build执行其Headless导入 |
| [macOS] | 无可访问环境，Godot／Blender／Node／Git及运行均未验证 |

已在PLAN同步本阶段实际完成、历史缺口与构建阻断。报告编码、链接、源文件保护、媒体解码与最终检查见 [final-checks.json](../../test-output/anim-a1-20261019/final-checks.json)。原缓存／旧build／旧输出按大小和mtime核对，不能冒称大型二进制逐字节证明。

**本阶段到此停止，不继续 ANIM-A2，不自动提交。**
