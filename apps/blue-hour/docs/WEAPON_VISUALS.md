# 武器 Phase 2A：正式模型与右手挂载

2026-09-12。范围为拓荒短刀、P9、A21 的模型、装备显示和基础待机持握姿势。复用主工作区的 BH_Humanoid_Rig_v1、双角色 runtime GLB、公共 Idle / Walk / Run 和第一阶段武器系统。

## 三把正式资源

| 武器 | GLB（WeaponDefinition.model_path） | tris | 尺寸：宽 × 高 × 长，米 |
| --- | --- | ---: | --- |
| 拓荒短刀 | [wpn_001_survival_knife.glb](../assets/weapons/models/wpn_001_survival_knife.glb) | 848 | 0.043 × 0.075 × 0.341 |
| P9 制式手枪 | [wpn_002_p9_pistol.glb](../assets/weapons/models/wpn_002_p9_pistol.glb) | 1,520 | 0.042 × 0.262 × 0.241 |
| A21 突击步枪 | [wpn_006_a21_assault_rifle.glb](../assets/weapons/models/wpn_006_a21_assault_rifle.glb) | 2,524 | 0.066 × 0.320 × 0.782 |

以上链接对应 `res://assets/weapons/models/` 下的三个同名文件。R6、K9、S12、H7、L56 的 `model_path` 继续为空，装备它们时不显示模型，逻辑仍工作。八张原始图标未修改。

可编辑来源：[短刀 .blend](../art/blender/weapons/wpn_001_survival_knife.blend)、[P9 .blend](../art/blender/weapons/wpn_002_p9_pistol.blend)、[A21 .blend](../art/blender/weapons/wpn_006_a21_assault_rifle.blend)。GLB 实际统计、包围盒和 SHA-256 记录在 [weapon_models.json](../art/blender/weapons/weapon_models.json)。没有角色骨架、碰撞体、贴图或武器动画混入这些 GLB。

建模依据用户的 200px 图标：深灰金属、黑色握把、蓝色小标识，短刀保留宽刃与浅色刃口，P9 保留浅色套筒，A21 保留开放式枪托、弹匣与长护木。复用现有 `generate_weapons` 的 Pistol/AR 构造和公共几何/材质工具；只在正式武器生成入口调整轮廓、颜色与比例，旧展示资产不改。

## 轴、原点与节点契约

1 Godot 单位 = 1 米。Blender +Y 是枪口/刀尖方向，+Z 朝上；导出后 Godot -Z 是武器前方，+Y 朝上。源场景单位缩放 1，变换烘焙到网格，角色挂载不再额外缩放。

```text
WeaponRoot
├── Mesh
├── GripPoint_R
├── GripPoint_L
└── MuzzlePoint
```

`GripPoint_R` 位于原点；`GripPoint_L` 在 A21 护木下方，短刀和 P9 预留近握柄位置；枪口点位于枪管前端，短刀对应刀尖。Godot GLB 导入器会再加一层文件名根节点，控制器取出其中的 `WeaponRoot`，丢弃这个空包装节点。

## 实际挂载链路

[Survivor.equip](../survivors/survivor.gd) 将同一个派生装备 Resource 交给 CombatController 和 [WeaponVisualController](../weapons/weapon_visual_controller.gd)。创建视觉控制器时，Survivor 直接传入公共动画控制器的 `target: Skeleton3D`，避免误选动画参考骨架。

```text
Survivor
├── VisualRoot
│   └── 角色 runtime 模型（既有 Y 轴转 180°）
│       └── 公共动画控制器 / Reference Skeleton / HumanoidRetarget
│           └── 实际蒙皮 Skeleton3D
│               ├── WeaponSocket_R（BoneAttachment3D，RightHand）
│               │   └── WeaponRoot
│               └── WeaponReadyPose（SkeletonModifier3D）
└── WeaponVisualController
```

`WeaponSocket_R.override_pose` 保持 false，只跟随 `RightHand`。控制器按模型路径加载，使用 `profile.attachment_transform() × GripPoint_R.transform⁻¹` 对齐握点。切换时先将旧模型移出树再排队释放；卸装、空路径、缺失骨架或无效模型结构都不保留旧枪。控制器释放时同时清理挂点和姿态节点。

右手挂点更新由 Godot 的 BoneAttachment 完成；小幅上肢调整由 SkeletonModifier 在重定向后执行。选择该执行顺序依据 [Godot SkeletonModifier3D 文档](https://docs.godotengine.org/en/stable/classes/class_skeletonmodifier3d.html)，挂点只读语义见 [BoneAttachment3D 文档](https://docs.godotengine.org/en/stable/classes/class_boneattachment3d.html)。没有逐帧从世界坐标追着手搬动模型的替代控制系统。

## 三类基础姿势

[WeaponPoseProfile](../weapons/weapon_pose_profile.gd) 是小型 Resource；[WeaponReadyPose](../weapons/weapon_pose_modifier.gd) 仅调整上臂、前臂与右手旋转，不改骨长、根位移、腿部或 AnimationTree。

| animation_profile | 配置 | 表现策略 |
| --- | --- | --- |
| MELEE_SHORT | [melee_short.tres](../data/weapon_poses/melee_short.tres) | 右臂低位，刀尖向前略抬、略外展，保留 14% 公共上臂动作混合 |
| SIDEARM | [sidearm.tres](../data/weapon_poses/sidearm.tres) | 右肘降低、前臂前伸、枪口水平；左臂沿公共动画 |
| LONG_GUN | [long_gun.tres](../data/weapon_poses/long_gun.tres) | 右臂更靠近胸前，左前臂抬起形成长枪准备姿势，保留左辅助握点 |

三类都用手掌附近的局部偏移，基于统一骨骼空间计算旋转；没有按角色名字写两份修正。空路径/卸装时 profile 清空，恢复公共动画的上肢姿态。

`get_muzzle_point()` 和 `get_support_grip()` 返回当前 Marker Node3D 或 null。下阶段可读取其 global_transform 接特效/左手约束。当前射击仍走原命中线起点；没有将角色朝向、弹匣或伤害依赖到模型上。

## 验证与已知限制

验证入口：[weapon_visuals.gd](../tests/weapon_visuals.gd)、[weapon_runtime.gd](../tests/weapon_runtime.gd)、[weapon_system.gd](../tests/weapon_system.gd)、[humanoid_animations.gd](../tests/humanoid_animations.gd)。Godot 4.7.2 / Windows / Compatibility / RTX 3060 实跑：武器视觉 1,377 项、原生装备 UI 与营地/任务往返 112 项、第一阶段武器 428 项、公共动画 908 项，均通过。

- 数值测试采样双角色、三武器、三动作：实际修改后右手骨与 socket 相差 <1mm，握点距腕骨 <10cm，武器前向与人物前向点积 >0.88，所有变换有限。
- 营地验证通过实际鼠标装备路径，为两位角色分别装备 P9、短刀、A21，确认同一营地实例即时更新；进入真实任务后检查 A21 模型/Combat/HUD 图标一致，另一成员空手；实际撤离、结算、返回营地后 A21 保留。
- 原生 1600×900 截图覆盖每武器 Idle / Walk / Run、高位 3/4、侧面和背面，共 15 张，位于本地 `test-output/weapon-visuals/`。
- 近看可见原角色张开的手指；统一骨骼没有独立手指骨，这一阶段没有制作握拳蒙皮/手型。A21 左手未与辅助握点严格约束，部分角度悬在护木附近；枪托与袖口可能局部相交。报告不把这些称为完成 IK 或最终持枪动作。
- 当前是基础 ready stance；没有射击抬枪、开火后坐、专门近战攻击或换弹动作。公共下肢动作和近战/枪械逻辑仍保持原行为。


## Windows 交付与最终证据

正式产物：[BlueHourHomeward.exe](../build/BlueHourHomeward.exe)，导出时间 **2026-09-12 16:19:29 +08:00**；451,621,288 字节；SHA-256 `6931731E925AF189A00E3F61EE3D2A029A5BCFED003B238CE4292788B6F74B9B`。构建清单 `build/BUILD-INFO.json` 已按该 EXE 实际字节重新核对。

- 完整构建前置检查通过，包含营地/出发、地图、资产、任务、并行搜索、跨日、新开局、效果、武器与公共动画；原生地图 134 项、武器 UI 112 项通过。
- 发布 EXE 在隔离目录实际启动：营地、菜单、任务、今日行动、武器页，各 Headless/原生共 10 项；资源展厅 52 个资产的两种启动也通过，共 **12 项 EXE 独立启动**。
- 发布模板不支持外部 `--script`。使用同一 Godot 4.7.2 editor binary，通过 `--main-pack` 挂载 EXE 的内嵌包，再执行模型测试；Headless / 原生各 **1,377 项、0 失败**。资源来自导出包，测试驱动来自工程；这与直接用发布 EXE 执行脚本不同。
- 首次构建在最后验证入口遇到并行脚本更新：新增必需 GodotPath 参数，而当时已启动的旧构建调用未传入。此前导出、源码检查、10 项 EXE 启动均已完成；随后显式传入导出所用引擎，补跑展厅及内嵌模型检查全部通过，再完成构建清单。当前 `run.ps1` 已传入该参数，无需手动补跑。
- 对照任务开始时 SHA-256，双角色 runtime GLB、公共 AnimationLibrary、CombatController、Inventory、Campaign、AimFire 均未改变。并行移动优化任务于 16:18:37 更新了共享动画控制器/动作树、Survivor 与 Mission，已包含在 16:19:29 的 EXE 中；其改动保留，本轮额外补验武器逻辑、公共动画及原生营地/任务链路。未写玩家存档；测试存档均在 `user://test-runs/`。
- 构建日志中保留既有 new_run 的 2 个 ObjectDB 退出警告，以及营地故障注入测试预期的导航超时修正警告；本轮武器专项没有错误或释放警告。

本地证据：`test-output/weapon-build.log`、`weapon-packed-validation.log`、`art/standalone/weapons-{headless,native}.stdout.log`、`weapon-visuals/results.json`、`weapon-runtime.log`。完整 15 张动作/多视角图已查看，未见脱手或错误指向地面的枪口；已知手型、左手和局部枪托穿插限制保留在上节。

## 重建与扩展

在工程目录执行：

```powershell
& 'D:/Blender/blender.exe' --background --python art/blender/weapons/build_weapons.py
./run.ps1 -Mode import
./run.ps1 -Mode test
./run.ps1 -Mode build
```

[生成入口](../art/blender/weapons/build_weapons.py) 直接覆写三个正式 .blend / GLB 和统计表；没有添加带 v2/copy/final 的资产目录。正式游戏输出是 `build/BlueHourHomeward.exe`，独立包检查副本仅位于既有忽略提交的 `test-output/`。

扩展另外五把时：按相同节点/轴/单位规范制作模型，填写各自 `.tres` 的 `model_path`，沿用已存在的三类 `animation_profile`。如特定枪型确需更细握姿，再有目的地扩展 pose 配置；不用更改库存、存档、弹丸或装备 UI。同步增加导入/握点/双角色动作测试，以及模型统计。

Phase 2B 留项：另外五把 GLB、更完整持枪/射击/换弹/近战动作、手指握持、双手 IK、枪口火焰、弹壳、声音，以及枪口与瞄准方向的精细匹配。

## 本轮文件清单

修改：

- `weapons/weapon_visual_controller.gd`：模型生命周期、正式 socket、profile 和 Marker 查询。
- `survivors/survivor.gd`：仅在创建现有视觉控制器处增加 target skeleton 初始化。
- `data/weapons/wpn_001_survival_knife.tres`、`wpn_002_p9_pistol.tres`、`wpn_006_a21_assault_rifle.tres`：仅填写 model_path。
- `tests/weapon_system.gd`：把三把“模型为空”的旧期望改为正式 PackedScene 可加载，保留其余五把空路径断言。
- `tests/weapon_runtime.gd`：真实 UI 换装、营地刷新、双角色、A21 出勤、HUD 对应和返回营地。
- `run.ps1`、`art/verify_export.ps1`：将武器视觉/公共动画回归和独立包模型验证纳入正式构建。
- `README.md`、`docs/WEAPON_SYSTEM.md`、`docs/PLAN.md`、`docs/VALIDATION.md`、`art/RESOURCE_LAYOUT.md`、`art/MODEL_CATALOG.md`：同步当前入口和 Phase 2A 状态。

新增：

- 上述三个 GLB 及 Godot `.import`；三个 Blender 源；`art/blender/weapons/build_weapons.py` 和 `weapon_models.json`。
- `weapons/weapon_pose_profile.gd`、`weapons/weapon_pose_modifier.gd` 及 Godot `.uid`。
- `data/weapon_poses/{melee_short,sidearm,long_gun}.tres`。
- `tests/weapon_visuals.gd` 及 `.uid`；本报告。

本轮不改 Character Definition、角色 runtime GLB、骨架资源、公共 AnimationLibrary/AnimationTree/动画控制器、WeaponCombatController、WeaponInventory、Campaign 或 AimFire。营地现有 `refresh_equipment` / `refresh_members` 与出勤生命周期直接复用。工作区中的其他营地、地图、UI 及第一阶段武器差异不计为本轮修改。
