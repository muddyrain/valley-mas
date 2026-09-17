# Standard Survivor Idle_4 Foot Contact 验收

日期：2026-09-17。本轮完成用户要求的 Foot Contact Fix V1。正式文件采用稳定名称，不添加版本或备份后缀。

**结论：接地专项修正已烘焙，独立场景中无明显悬空、穿地或整脚滑步。保留原 Idle_4 的 14 秒节奏与上半身动作，未重新生成或整段重做。** 后跟受原有小腿蒙皮权重影响，仍存在约 5mm 局部形变；这不是零形变结果，详见量测。

## 交付资源

- 唯一烘焙动作：[animations/idle.tres](../assets/characters/survivor_animation_template/animations/idle.tres)，资源名 `Idle_4`，14 秒，24 FPS，337 个采样键时刻；87 条轨道。
- Blender 制作源：[standard_survivor_idle.blend](../art/blender/characters/standard_survivor_idle.blend)，仅一个 Idle_4 Action，无 IK/Copy Rotation 约束、无辅助控制骨或目标物。
- [Front 视频](../test-output/standard-survivor-foot-contact/idle_front.mp4)
- [Side 视频](../test-output/standard-survivor-foot-contact/idle_side.mp4)
- [Three-quarter 视频](../test-output/standard-survivor-foot-contact/idle_three_quarter.mp4)
- [Feet close-up 视频](../test-output/standard-survivor-foot-contact/idle_feet.mp4)
- [独立验收场景](../test-output/standard-survivor-foot-contact/project/idle_review.tscn)
- [独立 Windows 验收程序](../test-output/standard-survivor-foot-contact/build/StandardSurvivorIdleReview.exe)

四份视频均为原生 Godot 4.7.2 Compatibility 渲染、960×720、30 FPS、28 秒，两次完整循环。30 FPS 是视频采样率，动作时长和播放速度未变。视角、地面和灯光沿用原样验收，便于比较。独立场景只加载本模板和烘焙 Animation，不使用 Runtime IK。

Blender 文件作为可编辑动作制作源包含原模板网格，不是第二份正式 Runtime 模型；正式静态模板 FBX、PNG、Rest 场景与导入设置均保持原样。

## 修正方法与保留范围

1. 从当前正式 FBX 读取 `Idle_4`，不改变源文件。双脚原动作没有迈步，本次把整个 14 秒作为双脚支撑阶段。
2. 支撑点采用原动画脚踝的平均水平位置；Foot 世界朝向保留原动作平均水平朝向，俯仰回到模板鞋底可接地的姿态。Foot 目标位于 Rest 脚踝高度之上 1mm，给原有蒙皮形变留出亚毫米余量；这是脚部目标，不是模型或地面偏移。
3. 使用 Blender 双骨 IK、禁止拉伸，Foot 使用制作时的世界旋转约束；ToeBase 的局部姿态回到其 Rest 对齐姿态。没有编辑任何 Rest 骨轴，Toe_End 的局部原动画轨道也保留。
4. 根据双腿可达范围计算骨盆垂直修正，保留至少约 15° 的膝弯曲余量；对约束包络做周期平滑。原 Hips 水平轨迹和旋转保持，必要的垂直修正约为 **下沉 17.36～27.76mm**。
5. 逐帧烘焙到 Keyframe，移除制作辅助约束。将骨骼变换做坐标系转换后写入**同一原骨架**的 Animation，没有重定向到其他 Rig。

必要的骨盆调整来自腿长约束：源动作部分帧髋关节过高，在鞋底落地、腿段长度不变的条件下无法继续保持原高度。仅整体下移会保留原滑动和前掌俯仰问题；本次实际重算双腿关节并锁定脚部，模型对象与场景 Root 均不动。

Blender 中未编辑轨道的 key 值、时间、插值和手柄哈希一致。Godot 资源复制原源动作后，只替换 Hips 位置及左右 UpLeg / Leg / Foot / ToeBase 对应的 25 条位置/旋转/缩放轨道；其余 **62 条轨道逐键相同**，包括 Hips 旋转、Spine / Head / Arms 与 Toe_End。骨段长度变化只有浮点误差量级，未以骨骼缩放补偿腿长。

## 接地与滑动量测

完整周期以 60Hz 采样，共 841 点，包括首尾。Blender 评估实际蒙皮顶点；Godot 在正式 Mesh / Skin / Skeleton 上独立重建 2,987 个鞋底选区顶点，避免只用脚踝高度判定接地。

Heel / Forefoot 定义与原样验收相同：Rest 最低 6cm 顶点，沿 Foot→ToeBase 的水平方向取后 30% / 前 30%；始终跟踪同一批顶点。下表接地值为最终 Godot 实测。

| 指标 | 原动作左 / 右 | 修正后左 | 修正后右 |
| --- | --- | ---: | ---: |
| Heel 距地范围 | 18.68～35.61 / 19.12～27.74mm | 1.09～2.95mm | 1.14～2.48mm |
| Forefoot 距地范围 | 30.01～42.26 / 31.13～37.32mm | 1.361～1.369mm | 0.995～1.000mm |
| 整个鞋底选区最低点范围 | 持续悬空 | 0.124～0.831mm | 0.111～0.820mm |
| Heel / Forefoot 高于 3mm 的采样数 | 双侧均 841/841 | 0/841 | 0/841 |
| Foot 骨水平位置单轴最大范围 | 厘米级 | 0.00863mm | 0.00863mm |
| Heel 选区中心水平范围，左右 / 前后 | 33.54/39.11；29.87/22.49mm | 5.47 / 3.48mm | 5.56 / 2.79mm |
| Forefoot 选区中心水平范围，左右 / 前后 | 29.74/33.05；26.60/20.56mm | 0.0117 / 0.0074mm | 0.0099 / 0.0080mm |

未检测到持续悬空或地面以下的鞋底点。ToeBase→Toe_End 世界倾角接近水平，残差低于 0.001°；没有原先持续前掌上翘或脚趾突然翻转。左右 Heel 接触高度稍有差异，但均在 3mm 内。

**残余量不隐瞒：** Foot 已锁定，但 Heel 选区中心不是刚体点，原有小腿蒙皮权重仍会使其变化。仅跟踪 Rest 最低 3mm 的后跟接触顶点时，中心水平范围为左 4.72/3.82mm、右 4.97/2.61mm；相对首帧的最大单顶点水平位移约左 4.84mm、右 4.78mm。前掌接触顶点相对首帧最大位移为左 0.252mm、右 0.134mm。本轮没有修改权重来消除这一局部形变，四视角抽帧未见厘米级整脚滑步。

## Hips、膝盖与循环

| 指标 | 原动作 | 修正后 |
| --- | ---: | ---: |
| Hips 左右范围 | 107.85mm | 107.85mm |
| Hips 前后范围 | 39.38mm | 39.38mm |
| Hips 垂直起伏范围 | 9.00mm | 4.42mm |
| Hips 高度范围 | 0.972831～0.981827m | 0.952133～0.956554m |
| 左膝弯曲范围 | 7.40～29.30° | 16.81～21.73° |
| 右膝弯曲范围 | 12.85～26.04° | 16.09～23.12° |
| 循环首尾 Hips 位置差 | 0.0149mm | 0.0149mm |
| 循环首尾 Mesh 顶点最大位移 | 0.0263mm | 0.0262mm |

Hips 的水平重心变化与旋转保留；垂直起伏有明确改变，没有声称 Hips 动画完全不动。双膝始终前屈，没有锁死、反折或拉伸；大腿、小腿长度波动不超过约 0.0021mm。上半身局部动作保持原节奏，世界高度随骨盆自然降低。

循环端点没有新增可见跳变。Foot 骨首尾位置差为左约 0.00036mm、右约 0.00008mm。视频以资源原速循环两次，脚部两个周期的 420 对同时间画面全部一致；上半身仍保留源动作微小首尾差异。

## 验证与边界

- Blender Rest 矩阵、父子层级和 Armature / Mesh 对象变换前后比较通过；28 骨、原 Mesh/Skin/Weight 保留；Toe_End Rest 轴未修改。
- Godot Headless Import、独立 Scene Load 和无 IK 播放通过；Blender 烘焙与 Godot 的完整周期关注关节最大位置差为 **0.01743mm**，包含循环端点。
- [standard_survivor_idle.gd](../tests/standard_survivor_idle.gd)：**5,107 项通过**，包含 841 点双侧 Heel / Forefoot / Sole 接地、Rest、骨数、Skin 与模型 identity 检查。
- 夏知遥、苏晚星正式资源基础回归：**303 项通过**。
- 本轮开始时登记的 **308 个受保护文件哈希全部不变**，包含原标准模板、正式角色、感染者、公共动画、Survivor Runtime、武器和 Mission/Core；未接入 gameplay。
- 四个视频各 840 帧，FFprobe 校验 28 秒 / 30 FPS / 960×720 通过；非空白与画面变化检查通过。视觉审阅为四视角关键时刻抽帧及脚部近景，数值测量覆盖整个周期，不声称逐帧人工观看全部视频。
- Windows 独立验收程序已导出并原生启动，打印 `NATIVE READY: baked Idle_4; four views; no runtime IK`，正常退出。此次构建的是隔离动作验收程序，未重建或替换正式 gameplay EXE。

## 文件变更与复验

正式新增文件：

- `art/blender/characters/standard_survivor_idle.blend`
- `art/blender/scripts/bake_standard_survivor_idle.py`
- `art/blender/scripts/import_standard_survivor_idle.gd`
- `assets/characters/survivor_animation_template/animations/idle.tres`
- `tests/standard_survivor_idle.gd`
- 本报告。

更新 `docs/PLAN.md` 和 `art/MODEL_CATALOG.md`，记录专项修正完成及尚未接入正式角色。隔离工程、测量脚本、视频、联系表、日志、JSON 与 EXE 位于 Git 忽略的 `test-output/standard-survivor-foot-contact/`。没有保留 `v2/fixed/old/backup` 正式动作副本。

```powershell
& 'D:/Blender/blender.exe' --background --factory-startup --python-exit-code 1 --python apps/blue-hour/art/blender/scripts/bake_standard_survivor_idle.py
& 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe' --headless --path apps/blue-hour --script art/blender/scripts/import_standard_survivor_idle.gd
& 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe' --headless --path apps/blue-hour --script tests/standard_survivor_idle.gd
```

关键证据：`baked-pose.json`、`source-measurements.json`、`godot-measurements.json`、`runtime-contact.json`、`animation-export.json`、`verification.json`、`protected-result.json`。

完成后停止。未继续 Walking / Running、Combat Jog、武器动作或正式角色接入，等待用户下一步指令。
