# Unified Survivor T-Pose Bind Alignment V1

日期：2026-09-19。范围：Xia / Su 隔离候选的 Mesh Bind 与 Skin；没有替换正式角色或接入 Gameplay。

## 结论

**T-Pose Bind / 冻结骨架 / 公共动作直驱合同 PASS。完整 Skin 生产发布暂不放行，等待近景视觉验收。**

两角色现在以实际 T-Pose 网格和重新计算的 inverse bind 绑定，不再依赖 A-Pose 网格搭配 T-Rest 骨架，也没有隐藏 Armature Pose Offset。Idle 双臂已自然位于躯干外，Walk / Run 恢复可见摆臂。公共动作、骨架和脚部轨迹保持原样。

仍有少量肩部、袖肘、胸颈与长发接缝的局部压缩 / 拉伸；Run 的裙摆仍随腿链抬起，属于保留下来的下半身结果。不能把骨架与权重归一化通过等同于服装穿插全通过。尤其 Xia Idle 约 10.23s 的胸颈 / 发束接缝、Run 的袖肘，以及 Su Run 的肩袖接合处应近看。

**可以正式建立以下生产流程规范：** Static Mesh → 对齐 canonical T-Pose → 冻结 BH_Humanoid_Rig_v1 → Skin Contract → 直接共享公共 Locomotion。每个 Mesh 仍须通过独立静态及动态蒙皮验收；165cm 和相同骨架不能自动证明不同衣服、头发、鞋子均适配。当前候选不等于未来 12 人已获生产验收。

## 交付入口

- [完整视频与静态 QA 图库](../test-output/survivor-t-pose-bind/index.html)：24 段视频、40 张静态图、八相位前后侧近景。
- [Windows 独立验收程序](../test-output/survivor-t-pose-bind/build/SurvivorBindReview.exe)：Tab 切角色，Space 切动作，V 切视角，Esc 退出；不读取正式存档。
- Xia：[候选 GLB](../test-output/survivor-t-pose-bind/candidates/xia_zhiyao.glb) / [Blender 源](../test-output/survivor-t-pose-bind/xia_zhiyao/xia_zhiyao_t_pose_bind.blend) / [静态 QA 总图](../test-output/survivor-t-pose-bind/evidence/xia_zhiyao/static_sheet.jpg)。
- Su：[候选 GLB](../test-output/survivor-t-pose-bind/candidates/su_wanxing.glb) / [Blender 源](../test-output/survivor-t-pose-bind/su_wanxing/su_wanxing_t_pose_bind.blend) / [静态 QA 总图](../test-output/survivor-t-pose-bind/evidence/su_wanxing/static_sheet.jpg)。
- [测量摘要](../test-output/survivor-t-pose-bind/bind-summary.json)、[Blender 合同检查](../test-output/survivor-t-pose-bind/bind-contract-qa.json)、[原生合同检查](../test-output/survivor-t-pose-bind/static-native-qa.json)、[T 空间动态区域测量](../test-output/survivor-t-pose-bind/upper-dynamic-qa.json)。

## Mesh 对齐与 Skin 方法

读取上一轮隔离候选 `.blend`、源 A-Pose 关节标记和冻结 canonical 骨架。对手臂表面分段旋转 / 平移至 canonical 肩、肘、腕位置；在网格数据中完成对齐，再重新分配上肢权重与导出 inverse bind。没有修改 Rig Rest，也不运行公共动画生成器。

为满足统一关节位置，上臂包络轴向适配约 **+11.5%**，前臂约 **+2.7%**，肩段约 **+8.2%**；手掌尺寸保持不变。这是局部网格包络适配，**不能描述成所有源肢段比例完全不变的刚性旋转**。身高、主体、拓扑、UV 和纹理保持，局部上肢比例是否符合角色外观仍属于本轮视觉验收项。没有任何对象级缩放或旋转来掩盖对齐。

Skin 采用相邻骨段平滑过渡，重新限制对齐后 T 空间的 Elbow / Wrist / Hand 影响范围；清除胸口残留腿链权重，平滑连接的发束 / 衣服 / 肩部接缝，并在四权重截断前合并相邻胸部控制，减少不同第五权重交替丢失造成的尖刺。最多四个影响，归一化，无无权重顶点。

Blender Z < 0.70m 的全部顶点坐标与权重与输入候选逐项完全一致。没有新增发骨、裙骨、布料、IK 或角色专属动作。

## 基础与静态结果

| 项目 | Xia | Su |
|---|---:|---:|
| Blender 高度 | 1.649999976m | 1.650000095m |
| 顶点 | 68,074 | 66,907 |
| 三角形 | 101,982 | 102,500 |
| 骨骼数 | 23 | 23 |
| 无权重顶点 | 0 | 0 |
| 每顶点最大影响数 | 4 | 4 |
| Blender 权重和最大误差 | 4.75e-8 | 4.84e-8 |
| Godot Rest Skin 最大重建误差 | 0.063mm | 0.065mm |

两角色骨骼名、父子关系、完整 Rest 矩阵、骨长、骨轴和 Socket 合同完全一致，也与输入冻结骨架一致。Mesh / Armature 对象均为 Identity；所有 pose matrix_basis 为 Identity；无约束、无内嵌动画。Blender Rest Skin 重建误差低于 0.00004mm；Godot 的较小误差来自导入后权重 / 数值量化，不是额外 Offset。Rest 鞋底最低点约 Y=0。

拓扑索引、UV、纹理像素哈希、材质数量未变。未减面、未生成 LOD。Socket 沿用 RightHand、LeftHand 辅助参考和武器侧 MuzzlePoint 合同，未新增武器内容。

静态截图覆盖 T Rest Front / Side / Three-quarter / Feet、Arm 45°、Arm 90°、Elbow 90°、Knee 90°。角度定义：Arm 45 为从垂臂抬起 45° 的侧举；Arm 90 为前举 90°，T Rest 本身为侧举 90°；Knee 90 为大腿前抬 30°加膝屈曲 90°。这些仅为瞬时 QA 姿态，不保存为动作资源。测试显示可正常抬臂、屈肘、屈膝，但极端肩袖接缝的体积与折痕仍需近景确认；不宣称所有压力姿态无局部变形。

## 公共动作回归

两角色的 AnimationPlayer 直接使用同一 AnimationLibrary 及同一三动作实例。隔离工程只重定位 library 的资源路径；`public_idle.tres`、`public_walking.tres`、`public_running.tres` 与正式公共源 **SHA-256 完全一致**。没有 Retarget、角色专属补偿、AnimationTree CrossFade 或 Runtime IK。

| 动作 | 时长 | 视频采样 | 播放 |
|---|---:|---:|---|
| Idle | 14s | 30 FPS | 完整一次循环 |
| Walking | 1.0416667s | 120 FPS | 完整循环重复约 8.33s |
| Running | 0.6666667s | 60 FPS | 完整循环重复 8s |

原生骨骼矩阵按 120Hz 采样，与上一轮 canonical public library 直驱结果的最大差为 **0**。因此 Hips / Knee / Toe / Arm / Head 的动作及首尾骨骼连续性保持。全网格 Loop 首尾误差：Idle / Run 为 0，Walk < **0.00005mm**。没有通过 CrossFade 掩盖 Loop。

### 脚部

单位均为 mm。高度为两脚 Heel / Forefoot 固定鞋底区域的范围；滑步为同一固定前掌接触点在支撑阶段、抵消公共参考速度后的水平范围，不是整周期 Swing 位移。

| 角色 / 动作 | Heel 支撑高度 | Forefoot 支撑高度 | 左 / 右预测残余滑步 |
|---|---:|---:|---:|
| Xia Idle | 1.62–4.33 | 2.46–3.29 | 2.66 / 3.04 |
| Su Idle | 1.52–3.48 | 1.61–2.44 | 2.41 / 2.55 |
| Xia Walk | 1.63–3.04 | 2.47–7.41 | 2.16 / 2.05 |
| Su Walk | 1.52–3.20 | 1.67–6.37 | 2.18 / 1.77 |
| Xia Run | 1.90–2.73 | 2.78–6.49 | 1.83 / 0.90 |
| Su Run | 1.69–3.01 | 1.92–5.51 | 1.65 / 0.75 |

三动作所有 Heel / Forefoot 支撑、Landing、Push Off 测量与上一轮的差为 **0mm**。Heel Strike / Toe Off / Flight 动作没有变化，没有新增持续脚尖上翘、穿地或腿部拉伸。原有 Push Off 窗口末段前掌约 **17–22mm** 的离地仍保留；这不是本轮新增问题，也没有被修复成“全支撑窗口零间隙”。数据中的 3mm 全鞋底离地比例不能当作生理腾空比例，Walk 也会因阈值过严被计入。

脚部残余滑步计算沿用公共 canonical 参考速度：Walk 约 1.24486m/s、Run 约 2.27623m/s。实际鞋面拟合分别约 1.2444–1.2446m/s、2.2812–2.2844m/s。这里只用于相同数据的回归比较，没有应用任何 Gameplay 速度，2.8m/s 候选不变。

### 上半身与服装

Idle Front 已无整条手臂收进身体的原始错位；双手位于裙摆两侧。Walk / Run 的屈肘、摆臂和肩胸运动可见，没有锁死上半身。手腕区域最大动态边长比约 Xia 1.25、Su 1.72，未再出现整段手臂扭转。

剩余重点：Xia Run 袖肘的 P99 最大边长比约 **1.90**，Su 约 **1.61**；肩部接缝个别短边可达约 **3.46 / 3.56** 倍；Idle 胸颈 / 发束接缝最大约 **5.84 / 3.49** 倍。这些以 Rest 边长 >2mm、30Hz 采样统计，属于定位局部压缩 / 拉伸的证据，不能直接等价为同倍率整条袖子拉长，也不能证明无碰撞。不得据此给出无条件生产 PASS。

长发主体保持 Head 主导，没有添加摆动系统；与肩袖相接的少量顶点仍有混合权重。裙摆与鞋子保留原下半身方案，Run 中裙摆随腿抬起、鞋帮的局部折叠仍应在近景审阅；没有把这些原有结果重新包装成已修复。

## 验证与边界

- Blender 合同全部通过，两候选 Skeleton 完全相同；Rest、拓扑、UV、纹理像素、材质数量、下半身数据及 Socket 检查通过。
- 隔离 Godot Headless Import / Scene Load 通过；原生直驱 **87,064** 项检查，0 failures；视频采集合同 **4,835** 项，0 failures。
- 24 段 MP4 均经 ffprobe 核对帧数；完整时长的循环直接重复，无混帧或 CrossFade。
- Windows 隔离 EXE 导出并启动 180 帧，退出码 0。未覆盖正式游戏 EXE，没有运行正式 Gameplay 场景回归。
- 保护快照覆盖 **172** 个既有角色 / 动画 / Rig / Gameplay 等文件，哈希全部未变。旧角色、旧 Retarget、公共动画、Skeleton、武器和 Gameplay 均未由本轮修改。
- 所有运行证据保留在被 Git 忽略的 `test-output/survivor-t-pose-bind/`；本轮没有提交代码。

## 修改清单与复现

- 新增 `art/blender/scripts/align_survivor_bind.py`：可重复的 T Bind 网格对齐与上半身 Skin 修整。
- 新增 `art/blender/scripts/validate_survivor_t_bind.py`：Blender 冻结合同检查。
- 新增 `art/blender/rigs/survivor_skin_contract.json`：共享 Skin 规范及逐角色视觉放行要求。
- 新增 `art/blender/scripts/survivor_bind_qa/`：隔离工程准备、静态姿态、原生数据分析、图库、Windows 验收与复现脚本。
- 新增本报告；同步 `art/ASSET_PIPELINE.md` 与 `docs/PLAN.md` 的候选阶段状态。
- 候选 GLB、Blender 源、截图、视频、测量 JSON、日志和 EXE 仅写入本轮隔离目录，没有覆盖输入候选。

复现入口：[reproduce.ps1](../art/blender/scripts/survivor_bind_qa/reproduce.ps1)。输入依赖上一轮保存的候选 `.blend` 和 canonical QA 证据，不伪称仅凭干净代码 checkout 就能重建全部源素材；详见 [工具说明](../art/blender/scripts/survivor_bind_qa/README.md)。

本轮停止于绑定修正和双角色动态回归。下一步只能在视觉确认后决定是否继续局部 Skin 精修；不能通过修改公共动作、角色专属 Keyframe 或改 Rig Rest 解决剩余接缝问题。本报告不授权替换正式角色或接入 Gameplay。
