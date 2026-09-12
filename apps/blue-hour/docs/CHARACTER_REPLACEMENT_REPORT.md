# A-Pose 幸存者模型替换报告

日期：2026-09-12。角色制作最初在独立工作树 D:/my-code/valley-mas-humanoid-rig、分支 codex/humanoid-rig 完成。现已按用户要求合入主地图工作区 D:/my-code/valley-mas，保留主工作区未提交的地图、巴士、营地出发、武器和 HUD 改动。随后按用户要求单独提交 Rig 与角色替换内容，未推送；最终视觉效果仍待用户确认。

可直接运行 [公共 Rig Inspector](../build/BH_Humanoid_Rig_v1_Review.exe) 和 [合入后的游戏](../build/rig-integration/BlueHourHomeward.exe)，均已完成构建与独立启动验证。关键姿势对照图在 [本地检查总览](../test-output/replacement/review-board.png)。

## 主地图工作区合入

合入时两分支指向同一共同提交，Rig 工作当时均未提交，因此按共同版本执行了工作区三方合入。合入 62 个新增文件、5 个单方修改及 4 个双方修改文件。后续提交只包含 Rig 范围，公共文件按片段暂存，地图和武器等并行内容保留在工作区。

- survivor.gd 保留主工作区 WeaponCombatController、WeaponVisualController、装备/弹药状态及当前标签大小，只合入统一模型容器、公共动画驱动和移除移动 bob。
- camp_main.tscn 仅替换两条角色 GLB 引用，保留主工作区新的巴士、建筑、营地控制器和场景布置。
- RESOURCE_LAYOUT.md 和 PLAN.md 保留主地图、感染者、武器、HUD 与出发流程的内容，再加入 Rig 资料。
- 新导入的回归检查适配当前正式武器 ID 和 33 米默认正交镜头；没有改导航、真实速度或地图渲染。
- 用户明确批准后，清理主工作区 36 个已核对且无运行引用的旧角色文件。逐文件哈希匹配合入前记录；新 source/runtime 和用户 Downloads 文件保留。

主工作区已通过 Rig 302 项（Headless 与原生各一遍，72 张截图）、公共动作兼容 908 项、移动 42 项、稳定性 15 项（新增确认攻击回调实际执行）、真实 Mission 渲染 102 项及原网格/贴图保留 14 项。独立 Inspector 的 Headless/原生启动通过。

主游戏完整构建通过：营地出发 89 项、营地运行 107 项、行动选择 51/68 项、地图资源 131 项、地图 1074 项、镜头与 HUD 静态 70 项及真实行动 134 项、美术 52 个资源/187 项集成、武器 428 项/UI 50 项，以及剩余战斗、搜索、多点指令、五日循环、新开局和效果系统回归。导出游戏的 Headless/原生、菜单、行动、目的地、武器和美术展示共 12 次独立启动全部通过。已将通过验证的 EXE 与 BUILD-INFO.json 复制到主工作区 build/rig-integration/，并校验字节哈希一致。

主工作区的其他任务仍在写入。首次直接构建曾读到与当前磁盘内容不一致的旧资源目录，已保留失败日志；后续验收取自合入后主工作区的 900 文件隔离快照，重新导入并运行主工作区原有完整构建流程。没有回退或覆盖并行任务代码。

[合入记录](../test-output/rig-integration/manifest.json) · [主工作区清理清单](../test-output/rig-integration/removed-from-main.json) · [快照文件哈希](../test-output/rig-integration/snapshot-hashes.json) · [游戏构建日志](../test-output/rig-integration/snapshot-build.log) · [Inspector 构建日志](../test-output/rig-integration/review-build.log)

## 新夏知遥 GLB 检查结果

| 项目 | 实读结果 |
| --- | --- |
| 来源 | 用户 Downloads/Meshy_AI_夏知遥_0912053847_texture.glb |
| Mesh / Material / Texture | YES / YES / YES：1 Mesh、1 材质、3 张内嵌 JPEG |
| Skeleton / Skin / Animation | NO / NO / NO，0 骨骼、0 动画 |
| Triangle Count | 101,982 |
| Texture Resolution | Albedo、Normal、Metallic/Roughness 各 2048×2048 |
| 尺寸 / 姿势 | 1.600 m、鞋底约 0 m、单位对象变换、A-Pose |
| 原文件 SHA-256 | c6d58410eca5a455934511880878c448b0372c501182b6ea0b1fa1a7b79ebeef |

新手臂与衣身之间有清楚的空隙。白色及膝袜、短裙与鞋子保持原几何和材质。肩部仍按正常身体结构连接；部分长发与衣领/衣服存在连续表面，不能视为完全独立的头发部件。

## 新苏晚星 GLB 检查结果

| 项目 | 实读结果 |
| --- | --- |
| 来源 | 用户 Downloads/Meshy_AI_苏晚星_0912053910_texture.glb |
| Mesh / Material / Texture | YES / YES / YES：1 Mesh、1 材质、3 张内嵌 JPEG |
| Skeleton / Skin / Animation | NO / NO / NO，0 骨骼、0 动画 |
| Triangle Count | 102,500 |
| Texture Resolution | Albedo、Normal、Metallic/Roughness 各 2048×2048 |
| 尺寸 / 姿势 | 1.600 m、鞋底 0 m、单位对象变换、A-Pose |
| 原文件 SHA-256 | ab46eb89e4bc94278b32f00bfe2c5dcb68211ffe8a15e67a200b3801f835e7d9 |

袖子与衣身有明显间隙；长发仍覆盖肩后和上臂后方，需要区分权重，不能只按最近骨骼分配。源文件详情见 [GLB 审计 JSON](../art/blender/rigs/source_glb_audit.json)。

## 夏知遥 Rig / Weight 结果

继续使用 BH_Humanoid_Rig_v1，23 根骨骼的名字、父级、语义和轴规则没有改变。按新 A-Pose 重新审阅肩、肘、腕、髋、膝、踝坐标，保留原网格姿势，没有复制旧顶点权重。

直接 Bone Heat 对 51,209 个顶点全部留下空权重；在临时副本焊接重合接缝、放大到厘米尺度求解后，50,839 个代理顶点得到完整自动权重，再映射回原网格。主体头发、衣身下部和鞋底做局部修正；发衣连接处沿表面平滑，避免硬切权重造成拉裂。

最终：1 Skeleton、1 Skin、23 个 named binds、每顶点最多 4 个权重、0 个未绑定顶点、0 个动画。头部/头发分区中远离交界的 16,233 个核心顶点没有 Arm/Shoulder/Hand 权重；交界过渡区允许混合相邻影响。权重和为 1，最大误差约 1.2×10⁻⁷。

[拟合参数](../art/blender/rigs/xia_zhiyao_fit.json) · [权重报告](../art/blender/rigs/xia_zhiyao_build_report.json) · [姿势指标](../art/blender/rigs/xia_zhiyao_pose_report.json) · [原网格保留检查](../art/blender/rigs/xia_zhiyao_preservation_report.json)

## 苏晚星 Rig / Weight 结果

采用同一标准和同一脚本，根据新模型调整骨骼空间位置；没有建立角色专属骨骼标准或动画。

直接 Bone Heat 对 51,374 个顶点留下空权重；51,155 个焊接代理顶点重新自动求解成功。重新检查白发和白袖的空间边界，处理长发主体、鞋底及局部衣身权重，发衣连接处保留平滑过渡。

最终：1 Skeleton、1 Skin、23 个 named binds、每顶点最多 4 个权重、0 个未绑定顶点、0 个动画。头部/头发核心区 18,644 个顶点没有 Arm/Shoulder/Hand 权重；最大权重和误差约 1.2×10⁻⁷。

[拟合参数](../art/blender/rigs/su_wanxing_fit.json) · [权重报告](../art/blender/rigs/su_wanxing_build_report.json) · [姿势指标](../art/blender/rigs/su_wanxing_pose_report.json) · [原网格保留检查](../art/blender/rigs/su_wanxing_preservation_report.json)

## Rig Inspector 测试结果

保留同一个 [Humanoid Rig Inspector 场景](../scenes/debug/humanoid_rig_review.tscn)，通过下拉框选择角色，不复制两份测试场景。程序化切换也同步下拉框。

两人均执行 Original Pose、Head Left/Right、Arm Left/Right、Leg Left/Right、Knee Left/Right、Body Forward、左右 Arm Stress Test；每个姿势均有 Game Camera、Front、Back，Blender 另有左右弯膝侧视图。

- Blender：每人 38 张图，共 76 张；全部姿势坐标有限，左右膝均向前抬、小腿向后屈曲约 60°。
- Godot Headless 与原生渲染：各通过 302 项结构、蒙皮、材质、1.6 m 身高、地面基准和姿势检查；原生生成 72 张图。
- 原网格与贴图保留：每人 7 项通过。三角面与静止坐标在 1 μm 精度相同，内嵌贴图字节相同，源 SHA-256 相同。
- 已有公共 Idle/Walk/Run：908 项通过，两个播放器共享同一 AnimationLibrary，播放状态独立；没有新增或修改动作片段。
- 已复核主要风险角度：抬臂未见严重肩塌陷或胸腹拉坏，腿/膝正常，鞋子跟脚，裙装与袜子无明显破坏。发衣交界及极限近景仍有小折痕，见最后一节。

证据：[Godot Rig 结果](../test-output/rig/godot-rig.json) · [动画兼容结果](../test-output/locomotion/validation.json) · [姿势总览](../test-output/replacement/review-board.png)。

## 游戏内替换结果

先生成暂存 GLB，完成 Blender 姿势与原文件保留检查，再安装 canonical runtime 并验收 Godot/Inspector/已有公共动作，最后显式更新两份 Character Definition 的 model_path。实际行动场景通过后才清理旧资产。

- 当前 survivor.gd 通过 Character Definition 动态加载新 runtime GLB；原始约 1.6 m 比例、+Z 模型前向到游戏 -Z 前向的适配、鞋底地面基准保持正常。
- scenes/camp/camp_main.tscn 仅变更两条角色 PackedScene 引用；场景布置、建筑、植被、地图生成、导航和渲染代码没有修改。其他角色展示入口已通过同一 Character Definition 取模型。
- 主工作区真实 Survivor 移动检查 42 项、视觉稳定 15 项、真实 Mission 渲染/镜头检查 102 项通过；原 Demo 整模弹跳没有恢复。
- 原独立 Rig 工作树阶段的 Windows 构建通过 52 个美术资产、84 项美术集成、765 项玩法检查，以及独立游戏启动；合入后的主工作区构建结果以本报告开头的合入记录为准。
- 独立公共 Inspector 的 Headless/原生启动通过，临时构建项目每次重建，避免旧资源混入导出包。
- 本次没有创建角色专属动作，没有扩展公共动作库。已有公共移动接入保持原样。

[游戏镜头证据](../test-output/locomotion/game-run.png) · [实际行动验证](../test-output/locomotion/runtime-validation.json) · [游戏构建日志](../test-output/rig-integration/snapshot-build.log) · [检查程序构建日志](../test-output/rig-integration/review-build.log)。

## Source / Runtime 最终资源路径

| 角色 | Source | Runtime | Blender |
| --- | --- | --- | --- |
| 夏知遥 | [xia_zhiyao.glb](../assets/characters/xia_zhiyao/source/xia_zhiyao.glb) | [xia_zhiyao.glb](../assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb) | [xia_zhiyao.blend](../art/blender/characters/xia_zhiyao.blend) |
| 苏晚星 | [su_wanxing.glb](../assets/characters/su_wanxing/source/su_wanxing.glb) | [su_wanxing.glb](../assets/characters/su_wanxing/runtime/su_wanxing.glb) | [su_wanxing.blend](../art/blender/characters/su_wanxing.blend) |

Runtime SHA-256：

- 夏知遥：3ffebbcbb5070e339a2fdffa578a8d64d25098c5b03e323a8f594df5f457b646
- 苏晚星：7f0b4207ea92ad3b2f6ec65e695472a8370516c7663ca0e7cc36e81088eb9248

Godot 使用 GLB 自带材质和贴图，导入时嵌入 Basis Universal 压缩纹理，不沿用旧材质或抽出重复 JPG。配置使用 named skins，关闭动画导入。

## 删除或替换的旧资源

原独立工作树已清理两人的旧 model/、rigged/ 成品及 source/ 下以 character_ 开头的旧源文件和配套资源。此次主工作区合入实际清理其中仍存在的 36 个旧文件；保留新 canonical source/runtime。

原工作树阶段合计 46 个旧资产文件：6 个旧 GLB、15 张重复 JPG、4 个旧材质、21 个导入旁文件；另清理旧可编辑角色 .blend 及自动备份。主工作区此前没有那 10 个中间 Rig 资源，本次实际清理 4 个旧 GLB、12 张 JPG、4 个旧材质和 16 个导入旁文件。当前可编辑角色在 art/blender/characters/，标准 Rig .blend 保留。没有删除用户 Downloads 原文件。

完整删除清单见 [本地记录](../test-output/replacement/removed-resources.json)。运行代码、场景、配置、导入文件和构建入口均已无旧角色资源路径引用。历史报告保留过去事实，并注明当前路径以本报告为准。

Rig 与角色替换内容按用户要求单独提交；Git 历史中的旧源资源仍可恢复。合入和提交均未覆盖地图任务的未提交修改，没有推送。

## 修改文件列表

以下为本次替换修改，公共动画库和控制组件来自此前阶段，本次只重新验收。

- assets/characters/{xia_zhiyao,su_wanxing}/{source,runtime}/：4 个 canonical GLB 与对应 .import；清理上述旧资源。
- art/blender/characters/{xia_zhiyao,su_wanxing}.blend：两名角色的可编辑新资产。
- art/blender/rigs/：两个 fit.json、source_glb_audit.json，以及每人的 build/pose/preservation 报告；沿用固定标准 Rig。
- art/blender/scripts/inspect_character_glb.py：实际读取贴图分辨率与哈希。
- art/blender/scripts/bind_character.py：焊接临时代理的新热权重与经审阅的分区过渡，移除旧角色权重配方。
- art/blender/scripts/build_character_rig.py、validate_character_rig.py：canonical 路径、按角色隔离暂存/报告、可指定暂存验证路径。
- art/blender/scripts/create_humanoid_rig.py：保存时不积累自动备份；构建入口保留现有标准资产。
- debug/humanoid_catalog.gd、humanoid_rig_review.gd：统一选择新模型、同步角色选择框。
- tests/humanoid_rig.gd、verify_character_models.gd：新路径、导入材质/高度检查、三视角截图。
- data/survivors/xia_zhiyao.tres、su_wanxing.tres：正式 model_path。
- scenes/camp/camp_main.tscn：仅两条角色资源引用。
- art/build_humanoid_review.ps1：复制 canonical 资源及导入配置，重建隔离检查项目。
- art/blender/README.md、art/RESOURCE_LAYOUT.md：当前流程和资源命名。
- docs/PLAN.md、HUMANOID_ANIMATIONS_REPORT.md、CHARACTER_REPLACEMENT_REPORT.md：实施状态和验证结果。
- docs/HUMANOID_RIG_REPORT.md、CHARACTER_SYSTEM_REPORT.md、ASSET_NAMING_2026-09-12.md：标明历史快照，避免旧路径被误作当前配置。

## 当前仍存在的问题

1. 部分发束与衣领仍为连续网格。交界权重经过平滑，主体长发不会被手臂错误拖走；极限抬臂或近距离转头仍可能见小折痕/穿插。没有加入头发物理、布料骨或碰撞模拟。
2. 线性蒙皮下的裙装、袖根和屈膝近景仍有轻微压缩；游戏视角未见严重模型破坏。本次不继续做微小权重雕修。
3. 每人约 10 万三角面，本次保留原网格，没有减面或评估大量同时出场的性能预算。
4. 现有公共移动库兼容通过，但 Foot IK、枪械握持和其他动作均未扩展。真实 Mission 测试退出时仍有既有的 2 个 ObjectDB 实例警告，未扩大到场景生命周期修复。
5. 已合入主地图工作区；最终视觉风格与极限姿势待用户复看。

本阶段停止，不自动继续制作动画或修改地图。
