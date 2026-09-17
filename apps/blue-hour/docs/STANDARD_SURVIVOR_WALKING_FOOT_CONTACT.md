# Standard Survivor Walking Foot Contact V1

日期：2026-09-17。Blender 制作、Keyframe 烘焙、Godot 独立播放和四视角输出已完成，等待用户视觉验收。保留 Meshy Walking 基础步态，没有整段重新生成。

## 资源与视频

- 动作：[animations/walking.tres](../assets/characters/survivor_animation_template/animations/walking.tres)。资源名 Walking，1.0416667 秒，原地循环，无 Root Motion。
- 制作源：[standard_survivor_walking.blend](../art/blender/characters/standard_survivor_walking.blend)。仅一个 Walking Action，无制作 IK、Copy Rotation 约束或辅助目标。
- [Front](../test-output/standard-survivor-walking-contact/walking_front.mp4)、[Side](../test-output/standard-survivor-walking-contact/walking_side.mp4)、[Three-quarter](../test-output/standard-survivor-walking-contact/walking_three_quarter.mp4)、[Feet close-up](../test-output/standard-survivor-walking-contact/walking_feet.mp4)。每份 960×720、60 FPS、12.5 秒、750 帧，12 次原速循环。
- [独立验收场景](../test-output/standard-survivor-walking-contact/project/walking_review.tscn)、[Windows 验收程序](../test-output/standard-survivor-walking-contact/build/StandardSurvivorWalkingReview.exe)。只加载本模板和 Walking，不接入正式玩法。

Blender 时间轴保持 **24 FPS / 帧 1～26 / 25 个帧间隔**，步频仍为 115.2 步/分钟。左右相位差为 12.5 帧，因此最终使用 **120Hz 子帧烘焙、126 个键时刻（含首尾）**，以保留半帧交替相位和接触过渡；不是把播放速度或动作时间轴改成 120 FPS。Godot 资源有 87 条轨道，其中 81 条骨骼轨道重烘焙，6 条未替换轨道逐键保持。

## 制作方法与边界

1. 原 FBX 只读，Blender 使用源 Walking，不 Retarget。左脚 Heel Strike 为 0.291667 秒，右脚为 0.8125 秒，按周期取模。
2. 每侧支撑期为 0.541667 秒：前 0.083333 秒后跟落地，中间 0.333333 秒 Foot Flat / Mid Stance，最后 0.125 秒后跟抬起、前掌支撑。其余时间为 Swing；Swing 中段沿用源脚踝轨迹，仅在接触边缘各约两帧内连续衔接。
3. 支撑目标沿角色局部后方以 1.425m/s 移动，滚动时补偿接触支点相对脚踝的位移。没有把脚全周期锁死，也没有像 Idle 一样锁定世界位置。
4. Blender 双骨 IK 禁止拉伸；Foot 旋转控制 Heel Strike 和 Toe Off，支撑时 ToeBase 与原 Rest 对齐。用实际蒙皮鞋底迭代校正高度与平坦阶段俯仰，最终烘焙并删除约束。
5. 为使既定腿长够到支撑目标，Hips 仅增加垂直可达性修正，约下沉 6.37～41.09mm，平均 21.47mm。所有模型/骨架对象变换、Root、Rest、Skin 和 Toe_End Rest 轴均不变。
6. 源动画首尾本身不闭合，接缝前后各两帧用离线 Hermite 连续化局部姿态；这也涉及 Hips 和少量上半身局部旋转，最大变化 5.50°。接缝区外 Spine / Head / Arms 局部旋转与原动作最大差仅 0.000024°。没有重新设计上半身，也没有声称其所有键值完全不变。

闭环由动画资源中的键完成，没有 Godot CrossFade 或 Runtime IK。FBX 导入自带的 PhysicalBoneSimulator3D 为原有节点，不参与本动画求解。

## 接地与速度对比

全周期按 120Hz 取 126 点。Blender 评估实际蒙皮，Godot 在正式 Mesh / Skin / Skeleton 上独立重建鞋底顶点。鞋底选择与原样验收相同：Rest 最低 6cm，沿 Foot→ToeBase 方向取后 30% 为 Heel、前 30% 为 Forefoot。下面高度为 Godot/Blender 一致量级的实测，不以脚踝高度替代鞋底高度。

| 指标 | 原动作 | 修正后左 / 右 |
| --- | --- | --- |
| Heel 全周期最低距地 | 23.83 / 26.33mm，始终悬空 | Heel Strike 约 1.00 / 1.00mm |
| Forefoot 全周期最低距地 | 24.62 / 27.26mm，始终悬空 | Toe Off 约 1.00 / 1.00mm |
| Foot Flat：Heel 高度 | 原动作无真实平脚接触阶段 | 1.00～4.40 / 1.00～5.03mm |
| Foot Flat：Forefoot 高度 | 原动作无真实平脚接触阶段 | 1.00～4.31 / 1.00～5.04mm |
| 全周期鞋底最低点 | 约 24～27mm 以上 | -1.44 / -1.85mm |
| Foot Flat：前掌平均后移速度 | 候选支撑速度不均匀 | 1.425 / 1.410m/s |
| Foot Flat：前掌瞬时后移速度 | 见原样原始采样 | 1.393～1.776 / 1.399～1.417m/s |
| Foot Flat：前掌预测残余滑步，同窗同速 | 6.90 / 38.50mm | 4.50 / 4.79mm |
| Foot Flat：后跟选区预测残余滑步 | 原样未单列此选区 | 14.85 / 12.57mm |
| Heel Strike：后跟选区预测残余滑步 | 原样无接触 | 4.65 / 4.98mm |
| Toe Off：前掌选区预测残余滑步 | 原样无接触 | 9.59 / 5.86mm |

预测残余滑步为选区中心局部后移坐标减去 `1.425 × 支撑相位时间` 后的最大值减最小值；右脚跨首尾的支撑窗先展开为连续时间。它是恒速前进时的预测，不是已接入 gameplay 的实测。Heel Strike / Toe Off 的滚动和蒙皮形变也会改变选区中心，不能将这些数值解释成刚体接触点完全打滑。

原样报告的 **18～41mm** 使用旧候选支撑窗和约 **1.450m/s**，不能与新阶段结果直接当作同口径对比。表内另列相同 Foot Flat 时间窗与 1.425m/s 的原始结果，公平比较为左 **6.90→4.50mm**、右 **38.50→4.79mm**。

残差仍存在：后跟受小腿蒙皮影响，选区中心有 12.57～14.85mm 的前后变化和约 5mm 侧向变化；左脚平脚阶段入口有短暂 1.776m/s 的前掌速度峰值。鞋底形状并非刚性平面，局部最大穿入 1.85mm，平脚端部最高约 5mm。四视角阶段与接缝抽帧未见明显持续悬空或大幅穿地，但没有把该结果报告为零滑动、零形变或零穿入，仍需用户观看原速视频确认。

Toe Off 后跟正常抬起，前掌最后离地；Swing 允许离地并保留源摆动脚上翘。没有持续支撑脚脚尖上翘，未见 Toe 翻转。左右已知 Toe_End Rest 轴差异未修改。

## Hips、Knee 与 Loop

| 指标 | 原动作 | 修正后 |
| --- | ---: | ---: |
| Hips 左右范围 | 53.04mm | 53.04mm |
| Hips 前后范围 | 43.33mm | 43.33mm |
| Hips 垂直范围 | 62.12mm | 66.42mm |
| Hips 高度范围 | 0.92666～0.98878m | 0.89133～0.95775m |
| 左膝弯曲 | 10.89～73.74° | 10.55～76.03° |
| 右膝弯曲 | 11.50～77.53° | 11.17～78.96° |
| Mesh 首尾最大位置差 | 131.44mm | 0mm |

膝盖全周期保持前屈，没有锁死、反折或骨段拉伸。骨段长度数值波动不超过约 0.016mm。离地过渡中左/右膝每 1/120 秒最大弯曲变化为 5.93° / 5.65°；接缝两侧对应变化为左 1.47° / 1.66°，右 0.165° / 0.164°，没有在循环边界额外跳变。

| 骨骼 | 修正前首尾位置差 | 修正前局部旋转差 | 修正后位置 / 局部旋转差 |
| --- | ---: | ---: | ---: |
| Hips | 14.44mm | 0.591° | 0mm / 0° |
| Left Foot | 102.53mm | 2.039° | 0mm / 0° |
| Right Foot | 42.57mm | 1.251° | 0mm / 0° |
| Left Knee | 24.80mm | 9.744° | 0mm / 0° |
| Right Knee | 46.98mm | 7.425° | 0mm / 0° |
| Left ToeBase | 119.08mm | 0.665° | 0mm / 0° |
| Right ToeBase | 42.74mm | 0.329° | 0mm / 0° |

不仅比较重复端点，还核对接缝前后相邻采样：左 Foot 位移为 23.65 / 24.81mm，右 Foot 为 11.876 / 11.876mm；左 ToeBase 局部转角 0.149 / 0.139°，右侧低于 0.000005°。左侧此时为 Swing，较大的帧间位移属于连续向前摆动。有限差分速度并非数学上完全相等，左 Foot 接缝前后速度向量差约 0.154m/s；未出现原有 102.53mm 的边界位置跳跃。完整指标见 [contact-analysis.json](../test-output/standard-survivor-walking-contact/contact-analysis.json)。

模型和骨架对象全程静止、Hips 周期净位移为零。未制作 Root Motion。

## 验证与影响

- Godot 4.7.2 Headless Import：独立验收项目和主项目均通过，日志无 Missing Resource / UID / Parse Error。
- 正式模板实际蒙皮、绑定、接触、Rest、Loop、无 Runtime IK 共 **615 项通过**。
- Godot 与 Blender 全周期关节最大位置差 **0.0119mm**。
- 正式夏知遥、苏晚星基础回归 **303 项通过**。
- 本轮开始记录的 **324 个受保护文件全部哈希不变**，包括模板源 FBX/PNG/导入设置、已通过 Idle、正式角色、公共动画、移动/战斗/武器/任务系统；不覆盖工作树既有其他改动。
- 四视频通过编码、分辨率、帧数、时长、非空画面和运动帧检查，已检查四视角阶段图与接缝图。
- 独立 Windows release 构建成功，导出程序实际原生启动 180 帧并正常退出，退出码 0。没有重建或覆盖正式 Gameplay EXE；本轮交付为模板专用验收程序。

本轮新增正式文件：`art/blender/characters/standard_survivor_walking.blend`、`art/blender/scripts/bake_standard_survivor_walking.py`、`art/blender/scripts/import_standard_survivor_walking.gd`、`assets/characters/survivor_animation_template/animations/walking.tres`、`tests/standard_survivor_walking.gd` 及 UID、本报告。更新 `docs/PLAN.md` 和 `art/MODEL_CATALOG.md` 的 Walking 状态。独立场景、测量脚本/JSON、视频、构建和日志均位于忽略的 `test-output/standard-survivor-walking-contact/`。

Walking V1 已交付候选，停止等待视觉验收。不继续 Running，不接入夏知遥、苏晚星或正式 gameplay。
