# Standard Survivor Running Reconstruction V1

2026-09-18。标准无武器持续 Run 重构候选已烘焙，等待用户视觉验收。保留 Meshy Running 的周期、交替步态、源 Swing 形状和胸肩节奏，重构支撑/落地压缩，缩短跨步与后方回收，收敛摆臂并修复循环。没有制作 Sprint、Combat Jog、Armed Run 或 Root Motion。

## 交付

- 正式唯一动作：[animations/running.tres](../assets/characters/survivor_animation_template/animations/running.tres)，资源名 Running。
- Blender 制作源：[standard_survivor_running.blend](../art/blender/characters/standard_survivor_running.blend)，仅一个 Running Action，无制作 IK/Copy Rotation 约束、无辅助目标。
- [Front 视频](../test-output/standard-survivor-running-reconstruction/running_front.mp4)
- [Side 视频](../test-output/standard-survivor-running-reconstruction/running_side.mp4)
- [Three-quarter 视频](../test-output/standard-survivor-running-reconstruction/running_three_quarter.mp4)
- [Feet close-up 视频](../test-output/standard-survivor-running-reconstruction/running_feet.mp4)
- [独立验收场景](../test-output/standard-survivor-running-reconstruction/project/running_review.tscn)、[独立 Windows 程序](../test-output/standard-survivor-running-reconstruction/build/StandardSurvivorRunningReview.exe)。

四视频均为 Godot 原生 Compatibility 渲染，960×720、60 FPS、800 帧、13.333 秒，原速 20 次循环。相机与 Running 原样验收一致。已检查四视角阶段图及接缝序列，用户原速视觉验收尚未完成。

## 重构方法

1. 从未修改的正式 FBX 读取 Running；源周期保持 16/24 秒，时间轴 24 FPS。骨骼动画以 120Hz 子帧烘焙，共 81 个时刻，含重复端点；视频帧率不改变步频。
2. 先确定较紧凑的局部支撑行程：脚踝参考前落点 -0.24m、后推点 +0.36m，支撑 0.233333 秒。左右落脚相隔 0.333333 秒。由 0.60m 行程和受力时间形成轨迹，再对最终蒙皮支撑点拟合推荐速度，没有沿用原来的 4.8m/s。
3. 每侧 Landing 约 41.7ms，平脚支撑约 116.7ms，Push Off 75ms；Heel Strike 约 7° 脚尖上抬，随后平脚，再逐渐到约 32° 蹬离。鞋底实际顶点参与高度、俯仰和前后位移迭代。脚只在支撑段受约束，Swing 自由回收，接触边缘平滑衔接。
4. Swing 以原动画左右半周期对齐后的脚踝轨迹平均为基础，前后幅度压至约 62%，垂直回收压至约 38%，再与新支撑端点衔接；没有重新生成整段动作。双腿使用 Blender 双骨 IK、禁止拉伸，Foot / ToeBase 的制作控制最终全部 Bake。
5. Hips 水平轨迹和胸肩跑步旋转保留；垂直曲线改为落地后压缩、支撑伸展、腾空回落，并保留小幅源垂直变化。根据固定腿长约束限制骨盆高度。相对源 Hips 高度调整约 -6.62～-49.69mm；模型、Armature、Root、VisualRoot 对象变换不动。
6. 上臂保留源相位和变化速度，左右半周期协调后压缩幅度；肘弯收敛到约 83～99°。手腕局部动作幅度减小，胸肩与头部保留源节奏。源 28 骨 Rig 没有完整手指链，因此只调整手腕姿态，没有宣称制作了逐指放松握形；手指造型仍由原网格决定。
7. 接缝附近各 1.5 个源帧做离线姿态连续化，所有骨骼最后一帧与首帧一致；不使用 Godot CrossFade。81 条骨骼轨道重新烘焙，6 条非替换轨道逐键保留，共 87 条轨道。

Rest Pose、Skeleton 层级、Skin 权重、网格原顶点、Toe_End Rest 轴均经制作脚本前后检查不变。Toe_End 的姿态可随父链运动，未编辑其 Rest 轴。Blender 文件内网格是编辑源，不是第二套正式 Runtime 模板。

## 周期、支撑与腾空对比

| 指标 | 源 Running | 重构后 |
| --- | --- | --- |
| 时长 / 时间轴 FPS | 0.6666667 秒 / 24 | 相同 |
| Cadence | 180 steps/min | 相同 |
| 单腿周期 / 左右相位差 | 0.666667 / 约 0.333333 秒 | 0.666667 / 0.333333 秒 |
| 支撑 | 原候选低平脚窗约 0.083～0.092 秒，始终无真实接地 | 每侧设计 0.233333 秒，分落地、平脚与蹬离 |
| 腾空 | 整周期双脚高于 3mm，混有错误悬空；双脚高于 60mm 约 42.5% | 双脚高于 3mm 两段各约 66.7ms，共 20%；高于 10mm 共 12.5% |
| 腾空高度性质 | 腾空幅度较大 | 低腾空的持续跑，不追求 Sprint 高腾空 |
| 推荐匹配速度 | 约 4.7～5.0m/s | **2.57m/s**，取实测拟合均值 2.57137m/s |
| 名义单步 / 同脚步幅 | 4.8m/s 时 1.60 / 3.20m | 约 0.857 / 1.714m |

设计上两个支撑间隔各 0.1 秒；按实际鞋底 3mm 阈值测得明显腾空窗为 **0.091667～0.158333 秒**、**0.425～0.491667 秒**。几何上仍存在跑步腾空，接触边缘低于阈值的时间不算高离地。它比源动作更贴地，是否符合目标持续 Run 的视觉强度需用户确认。

## Heel / Forefoot、速度与预测滑动

120Hz 全周期采样；鞋底选区沿用原验收。高度用 Rest 最低 6cm 中前后各 30% 选区最低点；速度另跟踪各选区中 Rest 最低 3mm 的固定接触顶点中心。Godot 在正式 Mesh / Skin 上独立重建蒙皮，和 Blender 高度最大差 0.0174mm。

| 高度指标 | 源左 / 右 | 重构左 | 重构右 |
| --- | --- | ---: | ---: |
| Heel 最低距地 / Landing 接触 | 最低 16.39 / 15.24mm，持续离地 | Landing 1.50～1.63mm | Landing 1.50～1.98mm |
| Forefoot 最低距地 / Push Off 接触 | 最低 15.58 / 7.09mm | Push Off 1.50～1.51mm | Push Off 1.50～5.59mm，最大值在平脚过渡边缘 |
| 平脚 Heel | 原无真实接触段 | 1.63～6.61mm | 1.98～5.59mm |
| 平脚 Forefoot | 原无真实接触段 | 1.50～4.23mm | 1.98～5.59mm |
| 全周期鞋底最低点 | 14.85 / 7.09mm | -0.667mm | -0.713mm |

持续厘米级悬空已消除，支撑鞋底接近地面。不是数学上的全鞋底零高度：鞋底曲面和小腿混合权重保留，平脚边缘最高约 6.6mm，过渡存在最大约 0.713mm 局部穿入。不会用 Root 下移掩盖这些残差。

| 速度/滑动指标 | 源左 / 右 | 重构左 / 右 |
| --- | --- | --- |
| 支撑速度拟合 | 4.879 / 4.689m/s，原候选窗与前掌大选区 | 接触区 2.571398 / 2.571350m/s |
| 平脚接触区瞬时前掌速度 | 原大选区约 1.51～5.28 / 2.49～5.45m/s | 2.571379～2.571629 / 2.571063～2.571457m/s |
| 前掌接触区预测滑动 | 4.8m/s 下 27.03 / 54.54mm | 2.57137m/s 下 0.0047 / 0.0070mm，低于实际验证精度 |
| 后跟接触区预测滑动 | 4.8m/s 下 37.74 / 54.64mm | 平脚 14.56 / 17.14mm |
| Landing 后跟残差 | 原无真实接触 | 1.25 / 2.88mm |
| Push Off 前掌残差 | 原无真实接触 | 0.29 / 3.04mm |

前后动作的支撑阶段已改变，上表比较各自动作有效/候选支撑窗，速度也分别采用其匹配值，并非固定时间窗同速 A/B。原始大选区口径 27.55 / 57.28mm 与本表最低 3mm 接触区 27.03 / 54.54mm 略有差异。推荐速度来自最终前掌接触区轨迹拟合，左右差约 0.000048m/s；只是制作建议，未修改 Gameplay。

**后跟仍有真实残差。** 原小腿权重在支撑屈伸时会带动后跟局部顶点，前后约 15～17mm、最大侧向约 5.6mm。前掌近零残差不能代表整脚零滑动。本轮禁止改 Skin Weight，已保留并明确报告；后续是否需要再调整腿部时序由本次视觉验收决定。

## Leg / Body 对比

| 指标 | 源左 / 右 | 重构左 / 右 |
| --- | --- | --- |
| Knee 最大弯曲 | 144.44 / 146.55° | 107.74 / 110.11° |
| Knee 最小弯曲 | 28.76 / 13.84° | 16.02 / 17.35° |
| 大腿最大前摆 | 48.72 / 53.18° | 43.71 / 50.27° |
| 大腿最大后摆 | 32.44 / 26.14° | 9.47 / 8.16° |
| 回收期鞋底最低面最高高度 | 0.777 / 0.667m | 0.218 / 0.217m |
| 回收期 Heel 最高高度 | 0.861 / 0.762m | 0.350 / 0.346m |
| 左右回收鞋底高差 | 110.35mm | 约 1.00mm |
| Hips 垂直范围 | 61.74mm | 47.58mm |
| Hips 左右 / 前后范围 | 17.35 / 64.34mm | 17.35 / 64.34mm |
| Torso 前倾 | 7.36～12.66°，均值 9.65° | 7.36～12.59°，均值 9.70° |

大腿前摆下降幅度小于脚部回收下降幅度，右腿前摆仍约 50°，比左腿多约 6.6°；没有把左右完美一致作为已实现结果。膝盖未抬到髋高，收腿高度和腿折叠显著降低。无反折、锁死或骨段拉伸；单个 1/120 秒膝弯最大变化左 7.45°、右 7.65°，出现在快速回收阶段，不是 Loop 端点跳变，仍需原速看是否够柔和。

落地后约 58.3ms 内，左 Hips 从 0.90565m 压到 0.88572m，右从 0.90922m 压到 0.88765m，压缩约 **19.93 / 21.57mm**；之后伸展到 Push Off 结束约 0.92357 / 0.92298m。全周期高度 0.88395～0.93153m。实际受力相位有明确压缩与伸展，未用模型整体偏移假装修复。

## Upper Body 对比

| 指标 | 源左 / 右 | 重构左 / 右 |
| --- | --- | --- |
| 上臂最大前摆 | 36.74 / 12.31° | 21.10 / 21.10° |
| 上臂最大后摆 | 86.91 / 89.49° | 35.10 / 35.10° |
| 肘关节弯曲 | 64.49～115.70 / 78.08～119.39° | 两侧约 83.44～98.70° |
| 半周期对齐左右上臂角 RMS 差 | 9.72° | 低于 0.0001°，目标轨迹已协调 |
| 胸肩连线转角范围 | 约 30.39° | 约 30.39°，保留原节奏 |

肘部不再后抬到近水平。减少摆臂幅度的同时保留源加减速时序，不使用纯正弦钟摆；左右协调的是角度轨迹，胸肩和源 Hips 的差异仍让手部世界路径有自然差别。头部跟随身体，局部源节奏保留并修复接缝。手掌仍是原模型展开的手指轮廓，手腕动作已收敛；放松感属于本次视觉验收重点，不冒充已完成手指重塑。

## Loop / Motion

| 骨骼 | 原首尾位置差 | 原世界旋转差 | 重构首尾 |
| --- | ---: | ---: | --- |
| Hips | 5.57mm | 0.157° | 0mm / 约 0° |
| Left / Right Foot | 53.86 / 35.35mm | 6.137 / 3.624° | 0mm / 小于 0.00001° |
| Left / Right Knee | 26.00 / 26.94mm | 8.232 / 1.322° | 0mm / 小于 0.00001° |
| Left / Right ToeBase | 61.04 / 39.26mm | 6.099 / 0.468° | 0mm / 小于 0.00001° |
| Left / Right Hand | 13.64 / 27.79mm | 2.175 / 2.582° | 0mm / 小于 0.00001° |
| Head | 3.09mm | 0.399° | 0mm / 约 0° |
| 全 Mesh 最大首尾位移 | 66.96mm | — | 0mm |

全部骨骼位置/旋转/缩放轨道均有闭环测试。接缝前后有限差分速度并非严格相等：Foot 约左 0.190 / 右 0.010m/s，Knee 约 0.145 / 0.201m/s，Hand 约 0.218 / 0.346m/s；这是离散采样连续运动的差值，未报告为数学上无限阶光滑。接缝序列未见原有数厘米的姿态重置，原速循环供用户确认。没有运行时 CrossFade。

Root / Armature / Mesh 对象不动，Hips 周期净位移为零。动作保持 In-Place，没有生成 Root Motion。

## 验证与文件范围

- Godot 主项目 Headless Import 与独立项目 Import/Scene Load 成功，日志无 Missing Resource / UID / Parse Error。
- 正式模板实际蒙皮、绑定、Rest、接地、全轨道闭环及无 Runtime IK：**402 项通过**。
- Godot / Blender 全周期关节最大差 **0.0078mm**；独立播放器与 Windows EXE 键签名一致。
- 正式夏知遥、苏晚星基础回归 **303 项通过**。
- **329 个受保护文件哈希未变**，包含 Rest 模板、Idle V1、Walking V1、正式角色、公共动画、武器和 Gameplay。源 FBX SHA-256 仍为 `033932ed14562004a68f8a98f305bf3e1d5fb0c2ecc2fbb036639a6cc88dd4b5`。
- 四视频编码、时长、帧率、800 帧与运动内容验证通过；独立 Windows release 实际启动 180 帧、退出码 0。本轮仅构建模板验收程序，不覆盖正式 Gameplay EXE。
- 证据：[comparison.json](../test-output/standard-survivor-running-reconstruction/comparison.json)、[runtime-contact.json](../test-output/standard-survivor-running-reconstruction/runtime-contact.json)、[verification.json](../test-output/standard-survivor-running-reconstruction/verification.json)。

正式新增：`art/blender/characters/standard_survivor_running.blend`、`art/blender/scripts/bake_standard_survivor_running.py`、`art/blender/scripts/import_standard_survivor_running.gd`、`assets/characters/survivor_animation_template/animations/running.tres`、`tests/standard_survivor_running.gd` 及 UID、本报告。更新 `docs/PLAN.md` 和 `art/MODEL_CATALOG.md`。录像、独立场景、构建、迭代测量与日志均在忽略目录 `test-output/standard-survivor-running-reconstruction/`；没有版本后缀正式资源。

完成制作与验证，状态为 **Running Reconstruction V1 候选，待视觉验收**。停止，不继续 Combat Jog 或 Armed Run。
