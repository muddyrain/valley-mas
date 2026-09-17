# Standard Survivor Idle_4 原样验收

日期：2026-09-17。结论：**建议小修后复验，不建议直接作为正式接地 Idle 保留；当前证据不足以要求整段重做。** 本轮只验收，未执行修正。

原动作有连续的身体摆动和近乎闭合的循环，未发现膝反折、脚趾突然翻转或单侧塌陷。但双脚在整个周期内悬空，前掌持续高于后跟，且有水平滑动，站立支撑感不足。

## 视频与独立场景

四份视频均为原生 Godot 4.7.2 Compatibility 渲染、960×720、H.264、30 FPS、28 秒，按原速播放两次完整循环。无插帧滤镜、慢放、动作混合、IK、Retarget 或修正。**源动作是 24 FPS；30 FPS 仅为视频采样率。**

- [正面视频](../test-output/standard-survivor-idle/idle_front.mp4)
- [侧面视频](../test-output/standard-survivor-idle/idle_side.mp4)
- [3/4 视角视频](../test-output/standard-survivor-idle/idle_three_quarter.mp4)
- [双脚近景视频](../test-output/standard-survivor-idle/idle_feet.mp4)
- [独立验收工程](../test-output/standard-survivor-idle/project/project.godot)
- [独立验收场景](../test-output/standard-survivor-idle/project/idle_review.tscn)

场景含同一角色、Y=0 地面、10cm 固定网格、灯光和四个静止机位。角色外层 transform 为 identity，保留源 FBX 的统一单位转换；没有 Mesh 单独缩放、Root 下移、VisualRoot 或 Y Offset。

验收工程位于被 Git 忽略的 `test-output/standard-survivor-idle/`，源件副本仅供隔离验证，不是第二份正式模板。正式模板仍保留静态导入配置，没有向正式资源目录写入动画或播放器。

## 原始数据与播放一致性

- 当前正式 FBX：`assets/characters/survivor_animation_template/source/survivor_animation_template.fbx`。
- SHA-256：`033932ed14562004a68f8a98f305bf3e1d5fb0c2ecc2fbb036639a6cc88dd4b5`，验收前后及隔离副本一致。
- 源 Action：`target_character|Idle_4`；FBX TimeMode=11、CustomFrameRate=24；源帧范围 1～337，时间差为 **14.000 秒**。
- 使用 Godot `FBXDocument.generate_scene(state, 24.0, true, false)` 做标准格式转换，绕过编辑器轨道优化，保留不可变轨道。隔离播放器仅保留 `Idle_4`，不播放源 Walking / Running。
- 28 骨、87 条导入轨道。未调用任何 Keyframe 增删改 API，未修改 clip 的 loop mode、速度或时长；第二次循环仅把播放时间跳回 0。
- Godot 导入动画的轨道、时间、值、插值与过渡签名在录制前后相同：`bc11026c886f66e21d90e030d884134d7bde3ac0227e972f47e754efaf5d81c3`。
- Blender 直接读取源 FBX；Godot 独立读取字节相同的 FBX。对 17 个关注关节、841 个 60Hz 采样点比较世界位置，最大差异 **0.004409mm**。标准导入的表示转换没有引入可见轨迹偏差；不将导入后的轨道序列化声称为 FBX 字节级相同。

## Foot / Toe / 地面接触

沿用静态基线的鞋底选区：Rest 网格最低 6cm，按左右脚分组，沿 Foot→ToeBase 水平方向取后 30% 为 Heel、前 30% 为 Forefoot。整个动画追踪同一批带权重顶点，按每个采样点的区域最低高度统计；不是只测骨点，也不在每帧重新选最低区域。

| 全周期测量 | 左脚 | 右脚 |
| --- | ---: | ---: |
| Heel 最低点距地范围 | 18.68～35.61mm | 19.12～27.74mm |
| Forefoot 最低点距地范围 | 30.01～42.26mm | 31.13～37.32mm |
| Heel / Forefoot 超过 3mm 的采样数 | 均 841/841 | 均 841/841 |
| 后跟到前掌的鞋底采样线向上倾角 | 3.28～6.03° | 4.22～6.71° |
| ToeBase→Toe_End 世界倾角 | 1.03～1.89° | 1.84～2.90° |
| Heel 顶点组中心水平范围，左右 / 前后 | 33.54 / 39.11mm | 29.87 / 22.49mm |
| Forefoot 顶点组中心水平范围，左右 / 前后 | 29.74 / 33.05mm | 26.60 / 20.56mm |

**双脚稳定接地：不通过。** 双侧后跟、前掌持续离地，且水平位置变化达到厘米级；这不是静态基线本身的地面高度问题，静态 Heel / Forefoot 距地只有约 0～0.37mm。相同 FBX 在两个求值器中复现，问题已存在于源 Idle 相对当前网格/Rest 的姿态关系中，没有证据指向本轮 Godot 导入或场景偏移。

**脚尖上翘：存在持续的轻度前掌抬高，在脚部近景可辨；没有发现夸张的脚趾翻折或大幅突然上翘。** 表中鞋底采样线倾角不是单根 Foot 骨的欧拉角，也不能把鞋头自带的上弯轮廓全部算作动画错误。

**左右表现并不完全一致：** 左脚后跟高度与前后移动幅度更大，右脚 Toe 链倾角略高。未见单侧突然扭转、脚踝塌陷或小腿长度改变；左右差异主要表现为支撑和摆动幅度不一致。

**Toe_End 轴不镜像在本片段中的影响：** 左右 ToeBase、Toe_End 的局部旋转在整段中基本恒定，数值变化不超过约 0.00005°。其世界方向仍随父骨变化。本段没有独立脚趾旋转可暴露“相同局部旋转造成不同左右运动”的问题，未见相应的动态翻转异常；不能据此认定已知 Rest 轴差异被修复，也不能把悬空直接归因于它。后续若制作脚趾动作，仍需单独验证。

## 膝盖、Hips 与身体表现

| 指标 | 结果 |
| --- | --- |
| 左 / 右膝弯曲角 | 7.40～29.30° / 12.85～26.04° |
| 膝盖反折或锁死 | 未发现；整周期位于同一前屈侧，没有到 0° |
| 骨段拉伸 | 大腿、小腿长度变化小于 0.001mm |
| 60Hz 连续采样最大局部旋转步长 | 左小腿 0.451°、右小腿 0.322°；左右 Foot 约 0.24° |
| Hips 垂直范围 | 0.972831～0.981827m，变化约 9.00mm |
| Hips 左右 / 前后范围 | 107.85mm / 39.38mm |
| 循环首尾 Hips 位置差 | 0.0149mm |
| 循环首尾 Mesh 顶点最大位移 | 0.0263mm |

膝盖变化连续，数值检查未发现突跳，抽帧中没有反折或锁死。Hips 有明显左右重心转移与轻微起伏，但不存在逐圈累积的根位置漂走。由于脚部未钉住地面，重心摆动的落脚支撑不自然；这里是视觉支撑判断，没有做质量分布或物理重心计算。

上半身不是完全僵硬：Spine 相对首帧旋转约 11.25°、Head 约 13.73°、左右上臂约 6.07° / 9.74°，有低头、转头和躯干摆动。胸部 Spine2 基本恒定，手臂与手掌表现克制、略有固定姿态感。当前主要阻塞项是接地与滑动，不能仅凭胸段不动就要求整段重做。

视觉审阅覆盖四个机位的 0、2、4、6、8、10、12、13.967 秒原生画面与脚部放大图；动态数值覆盖完整周期 841 个采样点。未把抽帧审阅描述为逐帧人工观看全部视频。

## 验证与变更范围

- 隔离 Godot Headless Import：退出码 0，无脚本/资源错误；独立 Scene Load 和 14 秒 clip 断言通过。
- 同一 Skeleton/Skin 绑定、角色根 identity、源件哈希、动画键签名及 Blender/Godot 轨迹交叉检查通过。
- 原生四视角采集完成，每视角 840 帧；画面变化检查通过，无空白或冻结输出。FFprobe 验证四份 MP4 均为 28 秒 / 30 FPS / 960×720 / 840 帧。
- 本轮开始时记录的 **308 个受保护文件全部哈希不变**，含正式模板、夏知遥、苏晚星、感染者、公共 rig/animations、Survivor Runtime、武器、Mission/Core、数据和 Debug。没有接入正式角色或 gameplay。
- 本轮没有重跑正式双角色或全游戏构建：本次是完全隔离的源动作验收，没有修改产品功能或正式导入配置；上一轮静态基线的正式回归结果不冒充本轮新测试。
- 新增本报告；在 `docs/PLAN.md` 记录“原样验收完成、接地不通过、待指令”。静态基线仍成立，未标记正式 Idle 接入完成。
- 本地新增隔离工程、只读测量/保护/输出验证脚本、数值 JSON、日志、逐帧图、四份 MP4 和四份联系表，均在 `test-output/standard-survivor-idle/`，不纳入正式 Runtime 资源。

证据文件：`source-measurements.json`、`godot-measurements.json`、`verification.json`、`protected-result.json`、`import.log`、`capture.log`。保护结果为 308 个文件、0 个变化。

独立场景复看：

```powershell
& 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe' --path apps/blue-hour/test-output/standard-survivor-idle/project
```

本轮停在原样验收。建议后续经用户指令再处理脚底接触、Foot 姿态与脚部滑动，并验证与 Hips 重心转移的协调；没有执行这些修改，也没有制作 Walk / Run、Combat Jog 或武器动作。
