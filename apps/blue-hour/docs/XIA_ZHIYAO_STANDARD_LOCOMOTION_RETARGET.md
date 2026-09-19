# 夏知遥 Standard Locomotion Retarget V1

2026-09-18。已完成夏知遥 Idle / Walking / Running 的可重复离线 Retarget、角色专属接地补偿、正式动画资源及独立验收。用户已确认 Standard Survivor Rest / Idle / Walking / Running PASS；这三份已通过的 `.tres` 是本次唯一动作源。当前状态为 **夏知遥候选已制作，等待视觉验收，未接入 Gameplay**。

## 交付

| 动作 | 唯一正式资源 | 时长 / 时间轴 | 验收建议 |
| --- | --- | --- | --- |
| Idle | [idle.tres](../assets/characters/xia_zhiyao/animations/idle.tres) | 14s / 24 FPS | 接地和循环可直接使用，待视觉确认 |
| Walking | [walking.tres](../assets/characters/xia_zhiyao/animations/walking.tres) | 1.0416667s / 24 FPS，115.2 steps/min | 小修：摆动回收与左侧残余滑动值得继续视觉确认 |
| Running | [running.tres](../assets/characters/xia_zhiyao/animations/running.tres) | 0.6666667s / 24 FPS，180 steps/min | 小修：胸部前倾、回收速度和未来速度匹配需要确认 |

三套均为 120Hz 离线烘焙，24 条目标轨道（23 条骨旋转 + Hips 平移），无骨缩放、无对象位移、无 Root Motion、无 Runtime IK 或 Runtime Retarget。资源自己的首尾闭合，不使用 CrossFade。

| 动作 | Front | Side | Three-quarter | Feet close-up |
| --- | --- | --- | --- | --- |
| Idle | [视频](../test-output/xia-zhiyao-locomotion/idle_front.mp4) | [视频](../test-output/xia-zhiyao-locomotion/idle_side.mp4) | [视频](../test-output/xia-zhiyao-locomotion/idle_three_quarter.mp4) | [视频](../test-output/xia-zhiyao-locomotion/idle_feet.mp4) |
| Walking | [视频](../test-output/xia-zhiyao-locomotion/walking_front.mp4) | [视频](../test-output/xia-zhiyao-locomotion/walking_side.mp4) | [视频](../test-output/xia-zhiyao-locomotion/walking_three_quarter.mp4) | [视频](../test-output/xia-zhiyao-locomotion/walking_feet.mp4) |
| Running | [视频](../test-output/xia-zhiyao-locomotion/running_front.mp4) | [视频](../test-output/xia-zhiyao-locomotion/running_side.mp4) | [视频](../test-output/xia-zhiyao-locomotion/running_three_quarter.mp4) | [视频](../test-output/xia-zhiyao-locomotion/running_feet.mp4) |

全部为实际 Godot Compatibility 渲染，960×720 / 60 FPS / 原速。Idle 28s、2 次循环；Walking 12.5s、12 次循环；Running 13.333s、20 次循环。已检查多视角阶段图和接缝连续帧；数值与抽帧检查不替代用户原速审美验收。

[独立场景](../scenes/debug/xia_zhiyao_locomotion_review.tscn) · [独立 Windows 程序](../test-output/xia-zhiyao-locomotion/build/XiaZhiyaoLocomotionReview.exe)。程序按 1 / 2 / 3 切换 Idle / Walking / Running，四视角同步播放，不加载游戏存档或正式控制器。

## 骨骼映射

标准模板 28 骨，夏知遥保留现有正式 23 骨。映射配置唯一入口为 [xia_zhiyao_locomotion.json](../art/blender/rigs/xia_zhiyao_locomotion.json)。下表源名称省略 `mixamorig_` 前缀，左右分别映射，不交换。

| 标准源 | 夏知遥目标 | 处理 |
| --- | --- | --- |
| 无地面 Root | Root | 保持原 Rest，恒定地面原点 |
| Hips | Hips | 世界旋转差；按左右髋关节中点转移平移，避免不同 Hips 定义造成偏移 |
| Spine | Spine | Rest 空间旋转转换 |
| Spine1 | Chest | Rest 空间旋转转换 |
| Spine2 | UpperChest | Rest 空间旋转转换 |
| Neck / Head | Neck / Head | Rest 空间旋转转换 |
| Left / Right Shoulder | Left / Right Shoulder | 保留目标肩宽与原局部骨偏移 |
| Left / Right Arm | Left / Right UpperArm | 保留目标臂长与 Rest |
| Left / Right ForeArm | Left / Right LowerArm | 保留目标臂长与 Rest |
| Left / Right Hand | Left / Right Hand | 转移手腕，不新增手指骨 |
| Left / Right UpLeg | Left / Right UpperLeg | 离线两段腿链适配，固定目标骨长 |
| Left / Right Leg | Left / Right LowerLeg | 同上，不拉伸 |
| Left / Right Foot | Left / Right Foot | 按目标鞋底蒙皮校正接触高度与俯仰 |
| Left / Right ToeBase | Left / Right Toes | 转移旋转并跟随足部补偿 |
| HeadTop_End / headfront / 两侧 HandMiddle4 / 两侧 Toe_End | 无对应目标骨 | 不输出；不改源末梢 Rest 轴，不增加目标骨 |

22 根源骨映射到目标骨，加目标自身 Root，共 23 骨。源、目标骨名和层级没有修改。正式资源路径直接指向夏知遥现有 `BH_Humanoid_Rig_v1/Skeleton3D`。

## 比例与可重复流程

| Rest 指标 | Standard Survivor | 夏知遥 |
| --- | --- | --- |
| 网格身高 | 1.65m | 1.59999985m，未缩放 |
| Hips 原点高度 | 0.9624m；髋关节中点约 0.8766m | Hips 与髋关节中点均 0.86m |
| 大腿长度，左 / 右 | 0.3460 / 0.3460m | 0.3616 / 0.3616m |
| 小腿长度，左 / 右 | 0.4476 / 0.4475m | 0.3499 / 0.3499m |
| 腿链总长比例 | 1 | 平均 0.89655016 |
| 脚踝高度 | 0.0860m | 0.1550m |
| 肩关节间宽度 | 0.2742m | 0.2500m |
| 上臂长度，左 / 右 | 0.2359 / 0.2203m | 0.2000 / 0.2000m |
| 前臂长度，左 / 右 | 0.2217 / 0.2235m | 0.1889 / 0.1889m |

不能只按身高 160/165 复制动作：夏知遥小腿明显更短、脚踝更高，且 Hips 的解剖位置不同。流程保留目标骨长、局部 Rest 偏移与世界旋转变化，足部位移按实际腿链比适配；缩放的是动作轨迹，不是角色或骨骼。

1. Godot 从正式 FBX 取得源 Rest/绑定，从正式夏知遥 GLB 取得目标 Rest/绑定；动画采样仅加载已通过的 `idle.tres` / `walking.tres` / `running.tres`，不读取 FBX 原始动作作为制作源。
2. 根据映射转换源世界旋转差，转移髋中点运动；手臂、肩宽、胸椎偏移继续使用目标 Rest。
3. 以真实蒙皮顶点跟踪 Heel / Forefoot；离线双骨 IK 适配脚踝轨迹，匹配源的落地、平脚、蹬离与摆动高度。脚的水平轨迹沿用源支撑后移，不做全周期 Foot Lock。
4. 脚底俯仰补偿随离地高度平滑退出，避免接触切换导致膝盖跳变。目标骨长逐帧断言固定。必要的可达性调整只写 Hips 动画；模型 / VisualRoot / Root 不下移。
5. Godot 写入角色专属动画，独立播放器直接播放。Running 独立重烘焙字节一致，验证了流程可复现。

## Foot Contact 与 Sliding

使用原 Mesh / Skin 的实际线性蒙皮。鞋底为 Rest 最低 6cm；前后各 30% 为前掌/后跟高度区域。滑动跟踪这些区域中 Rest 最低 3mm 的固定顶点中心。离线采样 120Hz，Godot 实际播放另以 240Hz 检查关键帧之间的接地。以下地面距离正值表示离地。

| 阶段 / 高度 | Idle 左 / 右 | Walking 左 / 右 | Running 左 / 右 |
| --- | --- | --- | --- |
| Landing Heel | 不适用 | 1.50 / 1.50mm | 1.50 / 1.50～1.57mm |
| Flat Heel | 1.94～3.14 / 1.85～2.83mm | 1.50～4.78 / 1.60～2.06mm | 1.50～3.93 / 1.50～1.64mm |
| Flat Forefoot | 1.88～2.19 / 1.88～2.12mm | 1.50～4.31 / 2.07～2.47mm | 1.57～4.38 / 2.40～3.84mm |
| Push Off Forefoot | 不适用 | 约 1.50 / 1.50mm | 约 1.50 / 1.50mm |
| 全周期最低鞋底，Godot 240Hz | 1.500mm | 1.157mm | 1.269mm |
| 双脚同时高于 3mm | 0% | 0% | 20%，保留两段跑步腾空 |

没有持续悬空或穿地；没有用整体 Y Offset 修复。Heel Strike 可正常抬前掌，Toe Off 可正常抬后跟；不能把这些阶段的离地视为 Flat 接触错误。

| 滑动 / 速度 | Idle 左 / 右 | Walking 左 / 右 | Running 左 / 右 |
| --- | --- | --- | --- |
| Flat 前掌拟合后移速度 | 约 0 / 0 | 1.26354 / 1.26098m/s | 2.30599 / 2.30711m/s |
| 共同匹配速度 | 0 | 1.26226m/s | 2.30655m/s |
| 此共同速度下前掌预测残差 | 0.057 / 0.111mm | 5.19 / 0.65mm | 0.082 / 0.073mm |
| 此共同速度下后跟预测残差 | 0.057 / 0.110mm | 5.16 / 0.65mm | 0.113 / 0.060mm |
| 沿用源推荐速度时前掌残差 | 同上 | 1.425m/s 时 51.92 / 53.43mm | **2.57m/s 时 30.82 / 30.67mm** |

残差是支撑窗内水平包围跨度，不是整周期脚位移；拟合平脚速度也不代表滚动落地/蹬离阶段瞬时速度恒定。亚毫米数值是离线测量结果，不宣称实机整鞋绝对无滑动。

**夏知遥 Running 当前不完全匹配 2.57m/s。** 保持周期时，经比例适配得到约 2.31m/s，比标准推荐速度低约 10.3%。本轮没有修改 Gameplay、播放倍率或源动作。若后续必须统一为 2.57m/s，需要单独批准目标角色步幅/时序匹配；本轮不自动扩大步幅或调整速度。

## Hips / Knee / Toe 与专属补偿

| 指标 | Idle | Walking | Running |
| --- | --- | --- | --- |
| Hips 高度范围 | 0.8515～0.8555m | 0.7963～0.8558m | 0.7905～0.8336m |
| Hips 垂直幅度，源 → 目标 | 4.42 → 4.06mm | 66.42 → 59.49mm | 47.58 → 43.12mm |
| Knee 弯曲，左 / 右 | 16.03～25.64° / 18.33～27.71° | 9.25～91.84° / 8.86～93.71° | 27.89～118.30° / 29.11～119.73° |
| 每 1/120s 最大膝弯变化，左 / 右 | 0.145 / 0.096° | 9.90 / 8.53° | 9.95 / 9.96° |
| Flat 鞋底俯仰，左 / 右 | -0.63～0.00° / -0.51～-0.01° | -1.52～1.02° / -0.11～0.23° | -1.12～1.05° / 0.19～0.81° |
| Foot 额外俯仰补偿范围，左 / 右 | 0.13～0.76° / 0.21～0.72° | -10.75～6.75° / -10.82～6.54° | -8.20～2.56° / -8.16～4.14° |
| 可达性额外 Hips 调整 | 0 | 最大下调 0.628mm | 0 |

脚尖没有在平脚支撑时持续上翘。Toes 使用目标 Rest；源 Toe_End 不进入映射，因此其已知左右 Rest 轴差异没有直接复制到目标。未观察到 Toe 突然翻转、腿链拉伸、膝盖反折或锁死。Walking / Running 快速回收仍应原速确认；不把每步约 10° 的 120Hz 膝弯变化描述为完全无感。

直接 Rest 旋转转换、尚未做角色接地补偿时，Walking 最低鞋底左 / 右约 -13.40 / -16.72mm，Running 约 -16.01 / -14.85mm；Idle 最低面离地约 3.06～7.85mm。因此三套都需要角色专属补偿。补偿配置和烘焙结果分别保存在夏知遥专属 profile 与 animations 目录，标准源从未反向修改。

Head / Spine 保留源旋转节奏，但目标 Rest 和胸椎位置不同：以 Hips→Neck 连线定义的 Running 躯干前倾从源 7.36～12.59° 变为目标 10.88～15.82°；Walking 从 -1.13～3.07° 变为 2.36～6.56°，Idle 从 -6.13～1.31° 变为 -2.75～4.76°。这是记录出的姿态差异，未宣称完全相同。候选保留此差异供视觉验收，Running 建议小幅胸椎姿态确认，而不是重新调整整个 Retarget。

手臂按目标长度和肩宽运动，没有模型缩放。模型无完整手指链，手形保持原网格；长发和衣服使用现有蒙皮，没有添加布料、发骨或物理修正。

## Loop

所有 23 骨首尾位置差为 0mm，旋转差在浮点精度范围内；最终 `.tres` 的全部轨道首尾直接检查通过。包括 Hips / Foot / Knee / Toes / Arms / Head，不靠运行时混合。Root 保持 Rest，周期净位移为零。

接缝相邻采样的有限差分速度不是数学上的完全相等：Idle 双脚约 0.00039 / 0.00013m/s，Walking 约 0.156 / 0.00058m/s，Running 约 0.329 / 0.00233m/s；Hips 分别约 0.0036 / 0.0163 / 0.0234m/s。接缝阶段图没有首尾姿态重置，但 Walking / Running 左脚回收节奏仍属于视觉确认项。

## 验证、保护与限制

- Godot 主项目 Headless Import、独立项目 Import / Scene Load、Windows release 导出与三套独立启动完成。独立导出仅包含夏知遥模型、三动作及验收场景，不覆盖正式 Gameplay EXE。
- 实际 Mesh / Skin 播放、Rest 不变、轨道绑定、Root 固定、无骨缩放、全循环及 240Hz 接触检查：**18,928 项通过**。
- Godot 与离线结果最大关节差 0.000382mm，最大鞋底高度差 0.000351mm；此项用于证明烘焙/导入一致，不表示测量超过浮点精度的物理真实性。
- 夏知遥 / 苏晚星定向正式骨架回归 **302 项通过**，苏晚星未接入任何新动作。
- 直接运行现有 `humanoid_rig.gd` 时，其目录已包含第三个感染者；通用脚本对所有角色硬编码 1.6m，产生一项身高断言失败（453 项中的一项）。随后原样复用该脚本的检查函数，仅检查两名正式幸存者，302 项全部通过。未修改原测试或感染者来消除不相关失败；两份日志保留。
- 12 段视频帧数、时长、60 FPS、H.264、运动内容与分辨率检查通过；Running 重烘焙 JSON SHA-256 完全一致。
- 开始时记录 344 个受保护文件。角色 GLB、贴图/权重、公共 Rig/动画、标准三动作、苏晚星与武器均未改变。收尾检查时 5 个既有文件发生外部编辑：`missions/mission.gd`、`missions/search_task.gd`、`missions/squad_input.gd`、`missions/world_interaction_vfx.gd`、`core/main.gd`；本次工具写入范围不包含它们，也未覆盖或回退。因此该次保护快照为 **339 个哈希不变，5 个外部差异保留**，不能写成全部未变。
- 当前 Gameplay 仍使用原控制器/公共动作；本轮新增资源的引用仅来自导入工具、专项测试和独立验收场景。

证据：[analysis.json](../test-output/xia-zhiyao-locomotion/analysis.json)、[runtime-validation.json](../test-output/xia-zhiyao-locomotion/runtime-validation.json)、[formal-survivors.json](../test-output/xia-zhiyao-locomotion/formal-survivors.json)、[protected-result.json](../test-output/xia-zhiyao-locomotion/protected-result.json)、[video-verification.json](../test-output/xia-zhiyao-locomotion/video-verification.json)、[repeatability.json](../test-output/xia-zhiyao-locomotion/repeatability.json)。

## 复现与修改文件

在仓库根目录，按顺序运行。Godot 使用本机 4.7.2 console 程序；Blender 使用本机 5.2.1 自带 numpy / mathutils，无新增第三方依赖。

```powershell
$godotExecutable = 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe'
& $godotExecutable --headless --path apps/blue-hour --script art/blender/scripts/export_locomotion_retarget.gd
& 'D:/Blender/blender.exe' --background --factory-startup --python-exit-code 1 --python apps/blue-hour/art/blender/scripts/retarget_standard_locomotion.py
& $godotExecutable --headless --path apps/blue-hour --script art/blender/scripts/import_locomotion_retarget.gd
& 'D:/Blender/blender.exe' --background --factory-startup --python-exit-code 1 --python apps/blue-hour/art/blender/scripts/analyze_locomotion_retarget.py
& $godotExecutable --headless --path apps/blue-hour --script tests/xia_zhiyao_locomotion.gd
./apps/blue-hour/art/build_xia_locomotion_review.ps1 -Capture
python apps/blue-hour/art/blender/scripts/verify_locomotion_videos.py
```

新增正式文件：

- `assets/characters/xia_zhiyao/animations/{idle,walking,running}.tres`。
- `art/blender/rigs/xia_zhiyao_locomotion.json`。
- `art/blender/scripts/export_locomotion_retarget.gd`、`retarget_standard_locomotion.py`、`import_locomotion_retarget.gd`、`analyze_locomotion_retarget.py`、`locomotion_protection.py`、`verify_locomotion_videos.py`。
- `debug/xia_zhiyao_locomotion_review.gd` 及 UID、`scenes/debug/xia_zhiyao_locomotion_review.tscn`。
- `tests/xia_zhiyao_locomotion.gd` 及 UID、`art/build_xia_locomotion_review.ps1`、本报告。

更新 `docs/PLAN.md` 与 `art/MODEL_CATALOG.md` 的状态和资源登记。中间采样、比较数据、视频、日志、独立工程及 EXE 全部在忽略目录 `test-output/xia-zhiyao-locomotion/`，不保留重复正式版本。

本轮停止于夏知遥三套动作独立视觉验收。没有接入苏晚星、Gameplay、Combat Jog、Armed Idle / Run 或武器系统。
