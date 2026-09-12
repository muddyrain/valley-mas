# BH_Humanoid_Rig_v1 交付报告

本文保留第一阶段及旧 Mesh 的历史验收记录。当前已进入 A-Pose 双角色替换，现用路径、指标与交付状态以 [角色替换报告](CHARACTER_REPLACEMENT_REPORT.md) 为准；以下“当前”“本轮”均指第一阶段当时。

日期：2026-09-12。当前工作树 `D:/my-code/valley-mas-humanoid-rig`，分支 `codex/humanoid-rig`，基线 `ef620ee2`。没有提交、合并或修改原工作区中的地图任务。

状态：基础设施、首版骨架与权重、静态姿势和 Godot 导入验证已完成，作为首版 Rig 审阅候选交付，等待用户美术确认。大幅抬臂与长发穿插仍有限制；不宣称所有角度完美或公共动作已可直接上线。

用户复看后大致认可，指出左膝弯曲异常。本轮确认是 Blender/Godot 检查姿势的旋转符号反了：大腿向后抬、小腿向前折，左右腿共用此错误。已同步修正为大腿向前抬、小腿向后弯，补充两张弯膝侧视图。新增的实际关节位置/弯曲方向检查在旧实现复现 6 项失败，修正后 Godot 146 项全部通过；Blender 也验证了前移方向与约 60° 的膝关节屈曲。骨架、蒙皮及导出 GLB 未改变。独立检查程序已更新为文件版本 0.1.0.1，并通过 Headless/原生独立运行验证；姿势图已更新，等待复看，没有开始动画阶段。此前结构与有限值检查未覆盖膝盖的生理弯曲方向，本次已补齐。

用户随后确认膝盖与整体效果正常，反馈抬臂时腋下/袖根被拉扯。袖根修订已完成：原分区交界的权重变化太陡，本次沿衣服表面平滑这段过渡，保留外围固定权重和接缝一致性，权重配方升级为 `xia_anatomical_v2`。本次改变的是夏知遥蒙皮，骨架规范、骨骼位置、网格及贴图未变。已重建可编辑 .blend、GLB、38 张 Blender 图和 12 张 Godot 图；检查程序当前版本为 **0.1.0.2**，独立 Headless/原生运行通过，等待袖根效果复看。

## GLB 检查结果

实际运行路径来自 `data/survivors/xia_zhiyao.tres`、`data/survivors/su_wanxing.tres`，营地静态模型也引用同一 `model/` GLB。检查直接读取 GLB 2.0 的 JSON/BIN chunks、nodes、skins、animations、accessors 和 primitive attributes。

| 项目 | 夏知遥 | 苏晚星 |
| --- | --- | --- |
| Mesh | YES，1 个，50,346 三角面 | YES，1 个，51,016 三角面 |
| Material / Texture | YES，1 材质、3 张内嵌 JPEG | YES，1 材质、3 张内嵌 JPEG |
| Armature / Skeleton | NO | NO |
| Skin / Vertex Weights | NO，无 JOINTS/WEIGHTS | NO，无 JOINTS/WEIGHTS |
| Animation | NO，0 | NO，0 |
| Bone Count | 0 | 0 |
| Bone Names / Hierarchy | 空，无骨骼层级 | 空，无骨骼层级 |
| 备注 | 1.6 m，原始自然 A 站姿；source 与 model 字节相同 | 1.6 m；source 与 model 字节相同，仅审计 |

贴图分别用于 Albedo、Normal、Metallic/Roughness。两者各只有一个 Mesh 节点，未发现可复用的旧骨架；没有覆盖现有 Skeleton。此表是旧 Mesh 审计快照；source_glb_audit.json 现在记录重新生成的 A-Pose 源文件。

## Demo 跳动来源

`survivors/survivor.gd` 原 `_move()`：`pulse += delta * 13`，随后 `rig.position.y = absf(sin(pulse)) * 0.075`。这是代码驱动的整模位移，GLB 本身没有动画。原 `tick()` 的攻击反馈还将整模 scale 设为 `(1.03, 0.95, 1.03)`，再 tween 回 `Vector3.ONE`，覆盖了 GLB 原有 0.5 的显示缩放。

已移除 pulse、移动高度写入和攻击整模缩放，共删除 7 行。静止、移动与攻击均保留初始模型变换，模型在地面平稳滑动。路径预算、拐点、速度计算、导航、朝向逻辑未改。阵亡倒地与登车消隐分别属于既有状态反馈，未作为走路跳动删除。

定向行为测试先在旧实现复现 8 项失败，修改后夏知遥、苏晚星和白模的 12 项检查全部通过，包括终点、移动高度、攻击及延迟缩放。

## BH_Humanoid_Rig_v1 结构

```text
Root
└─ Hips
   ├─ Spine → Chest → UpperChest
   │                    ├─ Neck → Head
   │                    ├─ LeftShoulder → LeftUpperArm → LeftLowerArm → LeftHand
   │                    └─ RightShoulder → RightUpperArm → RightLowerArm → RightHand
   ├─ LeftUpperLeg → LeftLowerLeg → LeftFoot → LeftToes
   └─ RightUpperLeg → RightLowerLeg → RightFoot → RightToes
```

共 23 根。标准骨架独立于任何角色；命名、父级、左右、单位、轴和 roll 固定。参考骨架 T 站姿与角色拟合的 A 站姿分开保存，不改变源网格。兼容 Godot 的 Body 骨骼命名，包含全部 required bones；已提供同名 BoneMap。详见 [管线契约](../art/blender/README.md)。未声称已验证尚未制作的公共动画重定向。

## Blender 自动化方案

实跑 `D:/Blender/blender.exe`：Blender 5.2.1 LTS，构建 `9e2066aef7ef`。复用既有 `art/blender/`，未新增根级 tools 目录、插件或依赖。

流程：审计 → 源哈希/旧骨架保护 → 创建标准 Rig → 按夏知遥关节点拟合 → 权重绑定与接缝归一 → 保存可编辑 .blend → 导出 GLB → 静态姿势和 Godot 检查。入口与各模块见 [Blender README](../art/blender/README.md)。

默认热权重实际失败，最终没有伪称 Automatic Heat 成功。试点采用经审阅的角色分区配方，自动生成、沿表面填充、平滑和归一权重。未来角色复用骨骼规范与工具，需要各自的拟合坐标和姿势验收；不保证任意 Meshy 模型一键完成。

## 夏知遥 Rig 测试结果

当时输出夏知遥绑定 GLB 与可编辑 Blender 文件，保存静止姿态，没有 Action、NLA 或动画片段。旧资源已由后续 canonical source/runtime 资产替代，现用路径见角色替换报告。

测试包含：左右转头各 25°，左右抬臂各 40°，左右抬腿各 30°，左右抬腿 25° 并弯膝 60°，躯干前倾 12°，以及原始姿态；额外保留左右各 60° 的抬臂压力测试。共 12 个姿态、38 张 Blender 图（正面/背面/高位 3/4，另加左右弯膝侧视图），以及 12 张 Godot 原生对照图，没有写入关键帧。

Godot 4.7.2 已通过 146 项结构、必需骨、父级、BoneMap、named Skin、归一权重、静止旋转保持与腿膝方向检查，原生 Compatibility 渲染使用 RTX 3060。检查场景按 rest rotation 叠加姿势，已校正与 Blender 的变换语义差异。独立 GLB 的 7 项保留检查全部通过：50,346 个三角面及 rest 坐标保留到 1 微米精度，3 张内嵌贴图字节未改变。25,681 个 Blender 顶点均有归一权重，最大 4 个影响。数值验证和自动截图不替代用户最终美术验收。

已检查全部 12 个游戏视角姿势，并重点查看抬臂正/背面、转头背面、腿膝和原生截图。基础角度下头、手脚和鞋子保持连接，未见整模爆炸；挂件误拉伸和手指错误权重已修复。原始网格与默认游戏模型引用保留，绑定 GLB 只用于本轮独立审阅。

验证证据：`test-output/rig/poses_final/`、`pose-overview.png`、`review.html`、`godot-pose-*.png`、`godot-rig.json`、`visual-stability.json`。可重建的数值结果纳入 [姿势报告](../art/blender/rigs/xia_zhiyao_pose_report.json)、[导出报告](../art/blender/rigs/xia_zhiyao_build_report.json) 和 [保留检查](../art/blender/rigs/xia_zhiyao_preservation_report.json)。

袖根修订用同一源网格、同一组 5,926 条袖根布料边比较（长度 >2 mm；选区定义完整记录在 [袖根前后报告](../art/blender/rigs/xia_zhiyao_sleeve_report.json)）。40° 抬臂时，左/右袖根超过两倍拉伸的边从 122/58 降到 52/45；60° 压力姿势从 191/130 降到 108/89。四个姿势全模型的严重拉伸边数也均减少。权重平滑将变形分散到更多邻近布料，因此不是每个统计量都下降：右侧袖根 P95 略升，基础抬臂全模型 P99 由约 1.04 升至约 1.09～1.10，不能用“全指标改善”描述结果。局部尖锐牵拉减轻，大幅展开仍保留。

额外检查选区外（含头发、腿部、远端手部）的最大权重差仅约 6e-8；白色挂件实测选区 230 个顶点权重不变，原生及 Blender 图中挂件保持连接。最初使用颜色/亮度的宽泛挂件选区误含衣服接缝，检查失败后通过具体位置与中性白色重新界定，未放宽不变阈值。Godot 146 项、GLB 保留 7 项再次通过。本次仅更新 Rig 独立程序，没有重新修改游戏运行逻辑或地图；原完整游戏构建的验证记录属于前次交付。

Windows 游戏构建通过 52 个资产、84 项美术集成、765 项玩法检查及 6 项独立启动/内嵌资源验证。只有 7 行反馈删除影响游戏行为。另提供专用 `build/BH_Humanoid_Rig_v1_Review.exe`，其构建脚本不改游戏主入口，已通过独立目录 Headless 与原生启动验证。最后再执行完整资产重建（跳过重复渲染），GLB SHA256 与已验收版本完全一致。既有玩法测试退出时仍有少量 ObjectDB 释放警告，不属于本轮 Rig 导入失败。

编码检查、Git 空白检查和 37 个本次文档内链接检查通过。GitNexus 索引仍落后，不将其“0 个已索引符号变化”当作 GDScript 无影响的证明；本轮以实际差异、定向行为测试和 Godot 实跑为依据。所有本轮测试进程均已退出，未修改原工作区的服务或窗口。

## 存在的模型 / 权重问题

原资产是贴图式单 Mesh，包含细碎、相交和法线/UV 接缝结构。长发、衣袖、挂件与躯干没有独立的制作语义，默认热权重不足以直接交付。

- 40° 抬臂可作为基础试点；60° 侧抬臂时宽袖明显形成扇状展开，腋下与肩部仍有褶皱拉伸，不视为最终大幅动作验收通过。
- 长发整体跟随 Head，没有附加发骨；转头和抬臂时仍有发梢与肩/背包穿插，细小发片局部拉伸。若后续镜头近看，应单独处理这些区域。
- 裙摆使用 Hips/大腿混合，没有布料模拟；30° 抬腿可检查基础变形，蹲下、跨大步和更大角度尚未验收。
- 鞋子主要整体跟随 Foot，当前测试没有脱脚；手指与脚趾不做独立动作，武器也尚未挂接 Hand 骨骼。
- 边长指标如实保留：袖根修订后基础抬臂全模型 P99 拉伸约 1.09～1.10，转头约 1.56～1.59；仍有少量短边达到更高比值（>2 mm 的受检边最大约 12.8 倍，发生在压力姿势）。这些局部瑕疵没有被删除或用放宽自动阈值隐藏，第一版只在上述测试范围内供审阅。

## 修改文件列表

- 既有运行时文件：`survivors/survivor.gd`，仅删除临时反馈。
- 新增骨骼/权重脚本与审计：`art/blender/scripts/`。
- 新增标准 Rig、试点 .blend、拟合和报告：`art/blender/rigs/`。
- 新增运行时试点模型与导入设置：`assets/characters/xia_zhiyao/rigged/`。
- 新增 BoneMap：`assets/characters/rigs/bh_humanoid_rig_v1_bone_map.tres`。
- 新增检查场景及脚本：`scenes/debug/humanoid_rig_review.tscn`、`debug/humanoid_rig_review.gd`。
- 新增验证：`tests/humanoid_rig.gd`、`tests/survivor_visual_stability.gd`。
- 新增独立检查程序构建：`art/build_humanoid_review.ps1`。
- 新增说明与本报告：`art/blender/README.md`、`docs/HUMANOID_RIG_REPORT.md`；本分支计划同步到 `docs/PLAN.md`。

没有修改地图主场景、地图生成/布置、地图资产、渲染或关卡逻辑；也没有修改营地与共享角色场景、角色配置或模型原件。`survivor.gd` 是唯一共用运行时代码改动，合并前应核对地图线程是否同时改动它。`docs/PLAN.md` 在原工作区已被地图任务修改，只在本工作树追加 Rig 状态，合并时保留两边条目。

## 下一步建议

先查看隔离的姿势检查场景与截图，确认这版 Rig 的可用范围。确认后再决定权重小修、将试点模型接入角色配置，以及下一个独立阶段的 `BH_Humanoid_Animations_v1`。本任务不自动开始公共动画，也不对苏晚星完整绑定。
