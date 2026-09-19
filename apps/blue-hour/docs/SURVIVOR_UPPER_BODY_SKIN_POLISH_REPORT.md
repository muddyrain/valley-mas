# Survivor Upper Body Skin Polish V1

日期：2026-09-19。仅处理 Xia / Su 隔离候选的上半身 Skin Weight。

## 结果

已完成袖肘权重精修、肩袖局部平滑和相同公共动作回归。**Su 的软管式弯折明显减轻，Xia 做了小幅修整；肩袖最严重的局部接缝问题尚未消除，不能判定所有视觉目标全部 PASS。**

本轮没有改变 Skeleton、Rest、骨长、Mesh 顶点位置 / 拓扑、公共动画、下半身或 Gameplay。没有新增修正骨、Shape Key、Runtime IK、角色动作副本或布料。权重精修使袖筒折点更集中，不等同于生成新的真实衣料褶皱。

## 视频与截图

[完整验收页](../test-output/survivor-upper-skin/index.html)包含最终视频、同帧前后对比、Idle 回归和测量链接。Run 均为 60 FPS，原 0.6666667s 周期重复 12 次，共 8s；播放倍率 1，没有 CrossFade。

| 角色 | Run upper-side | Run three-quarter | Idle Front |
|---|---|---|---|
| Xia | [视频](../test-output/survivor-upper-skin/evidence/xia_zhiyao/upper_side_polished.mp4) | [视频](../test-output/survivor-upper-skin/evidence/xia_zhiyao/three_quarter_polished.mp4) | [截图](../test-output/survivor-upper-skin/evidence/xia_zhiyao/polished/idle/front_00.png) |
| Su | [视频](../test-output/survivor-upper-skin/evidence/su_wanxing/upper_side_polished.mp4) | [视频](../test-output/survivor-upper-skin/evidence/su_wanxing/three_quarter_polished.mp4) | [截图](../test-output/survivor-upper-skin/evidence/su_wanxing/polished/idle/front_00.png) |

另有 4 段参考视频、4 段左右并排对比视频。Idle 在 0 / 4.5 / 10.25 / 13s 分别输出全身正面和上半身正面，避免只选一帧掩盖回归。视频保留角色原材质和相同灯光，没有隐藏头发或衣服。

候选与源：

- Xia：[GLB](../test-output/survivor-upper-skin/candidates/xia_zhiyao.glb) / [Blender](../test-output/survivor-upper-skin/xia_zhiyao/xia_zhiyao_skin.blend)。
- Su：[GLB](../test-output/survivor-upper-skin/candidates/su_wanxing.glb) / [Blender](../test-output/survivor-upper-skin/su_wanxing/su_wanxing_skin.blend)。
- [Windows 独立验收程序](../test-output/survivor-upper-skin/build/SurvivorSkinReview.exe)：Tab 切角色、Space 切动作、V 切视角。没有替换正式游戏 EXE。

## Weight 修改

输入为上轮通过的 canonical T-Bind `.blend`。原有 UpperArm / LowerArm 混合区延伸到较长前臂，弯肘时一大段袖筒同时收缩。本轮将过渡收窄至 canonical 肘部附近，按袖子前后侧略微错开折线位置，让上臂袖段与前臂袖段保持更明确的形体。

- Su：较强的肘部重分配，目标过渡半宽 31mm，混合强度 0.95。
- Xia：保守精修，目标过渡半宽 40mm，混合强度 0.45。
- 肩袖：在接缝焊接后的邻接图上平滑已有 UpperArm / UpperChest 比例，锁住非袖子边界，限制转移幅度。最终 Su 单骨最大肩部改动约 0.0116，Xia 约 0.00453。
- 总计修改 Xia **1,635** 个顶点权重，Su **1,305** 个；其中肩部区域分别 752 / 383 个。
- 只重新分配已有 UpperArm / LowerArm / UpperChest 权重总量。Head、Chest、Hand 等其他列保持原值；没有扩大头发或躯干的手臂影响范围。袖子区域外的权重全部精确保持。

## Run 前后测量

固定 Rest 肘部顶点带投影到当前骨段夹角平分面的凸包面积 / Rest 截面积，作为局部体积保持的代理指标。它不是闭合网格真实体积，也不是碰撞或褶皱质量证明。数值采样使用同一份 Godot 原生骨骼矩阵。

| 指标 | Su 前 → 后 | Xia 前 → 后 |
|---|---:|---:|
| 肘部截面积保持率最小值 | 34.90% → **48.61%** | 54.58% → **58.90%** |
| 肘部截面积保持率中位数 | 55.74% → 58.10% | 72.29% → 73.37% |
| 袖肘最小 P01 边长比 | 0.285 → **0.393** | 0.356 → 0.336 |
| 袖肘最大 P99 边长比 | 1.627 → 1.728 | 2.033 → 2.021 |
| 袖肘单边最大拉伸比 | 2.885 → 2.704 | 2.805 → 2.719 |
| 肩部单边最大拉伸比 | 3.544 → 3.544 | 3.456 → 3.456 |

Su 的压缩改善最明显；较集中折线使 P99 拉伸略升，不能描述为所有指标同时改善。Xia 的总体截面改善较小，局部内折压缩略增。肩部最大异常没有下降，因此肩袖只完成保守平滑，残余接缝不能宣布解决。

同帧侧面与 3/4 视图中，Su 前臂袖段更完整、折点更明确；仍保留原服装较平滑的管状横截面。Xia 的变化更轻。没有观察到新的整条手臂扭转或袖子跨躯干拉裂；这不等于做了逐三角形碰撞证明。原肩部与长发接合处的局部压缩仍需近景视觉确认。

## 回归与冻结范围

- Blender 重新打开输入 / 输出检查：完整 Bone Rest / 轴 / 长度、Mesh 坐标与拓扑、UV、纹理像素、材质、Socket、对象变换、Pose、0 内嵌动画均一致。
- 两角色均约 1.65m，23 bones，0 无权重顶点，最多 4 影响，权重归一化误差 < 1e-6。
- 三套公共 `.tres` 字节与正式源 SHA-256 一致；两角色使用同一个 AnimationLibrary 和相同 Animation 实例。
- Idle / Walking / Running 的所有原生采样骨骼矩阵与输入候选回归完全一致。
- Y < 1.02m 的全部下半身顶点，三动作采样位移变化 **0mm**；Foot Ground / Sliding / Heel Strike / Toe Off 保持输入结果。头顶区域位移变化 **0mm**。
- Wrist 区域边长统计完全一致，没有改 Hand 权重；袖子区域外的几何与权重逐项保持，没有新躯干 / 头发权重污染。
- Idle / Run 全网格首尾误差 0；Walk < **0.00005mm**，与输入一致。
- 隔离 Godot Headless Import、Scene Load 和 **87,064** 项直驱检查通过；最终采集无脚本错误。Windows 独立 EXE 导出并实际启动 180 帧，退出码 0。
- 12 段 MP4 经 ffprobe 验证，每段 480 帧、60 FPS；4 段为用户要求的最终视角，其余是参考和对照。

数据：[原生回归](../test-output/survivor-upper-skin/native-qa.json)、[Blender 检查](../test-output/survivor-upper-skin/blender-qa.json)、[媒体检查](../test-output/survivor-upper-skin/media.json)。边长统计以 Rest 长度 >2mm 的边为样本、30Hz 统计；骨骼轨迹为 120Hz 原生采样。导入器因权重改变而重排的缓存索引，通过精确坐标和三角形集合匹配，不误判为拓扑编辑。

保护快照 170 个文件中，角色、公共动作、Rig 和输入候选均保持；工作期间发现 `missions/mission.gd`、`missions/search_task.gd`、`missions/world_interaction_vfx.gd` 三个文件由其他工作发生变化。本轮没有写入这些文件，也没有回退并发修改。因此不声称整个工作区 Gameplay 哈希完全不变。

## 文件与停止点

新增 `art/blender/scripts/polish_survivor_skin.py` 与 `art/blender/scripts/upper_skin_qa/`，以及本报告；同步 `docs/PLAN.md` 的验收状态。候选、视频、截图、数据和 EXE 全部在隔离目录 `test-output/survivor-upper-skin/`，未覆盖旧候选或正式角色。没有新增依赖或提交 Git。

复现：[reproduce.ps1](../art/blender/scripts/upper_skin_qa/reproduce.ps1)，输入和限制见 [README](../art/blender/scripts/upper_skin_qa/README.md)。不重跑 T-Bind 转换或公共动作生成器。

本轮停止。已交付 Weight Polish 与指定视角回归；肘部改善可以视觉验收，肩袖残余不标记为完全通过。没有继续 Gameplay、其他角色或武器动作。
