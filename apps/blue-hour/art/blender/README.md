# 幸存者 Blender Rig 管线

夏知遥和苏晚星共用 **BH_Humanoid_Rig_v1**。角色使用 canonical name，阶段由目录表达，历史交给 Git。此管线不调用环境生成器，不修改地图。

## 资源边界

| 路径（相对 apps/blue-hour） | 用途 |
| --- | --- |
| assets/characters/{id}/source/{id}.glb | Meshy 原文件，字节不变 |
| assets/characters/infected_basic_a/model/ENM_001_infected_basic_a.glb | ENM_001 原始静态网格，字节不变 |
| assets/characters/{id}/runtime/{id}.glb | 验证后的 Mesh、Material、Skeleton、Skin，无动画 |
| art/blender/characters/{id}.blend | 可编辑角色，打包贴图，没有 Action |
| art/blender/rigs/{id}_fit.json | 对应源哈希、关节坐标、经审阅的修正规则 |
| art/blender/rigs/BH_Humanoid_Rig_v1.blend / .json / .contract.json | 唯一标准 Rig、参考坐标、冻结契约 |
| assets/characters/rigs/bh_humanoid_rig_v1_bone_map.tres | Godot Humanoid 映射 |

当前 id 为 xia_zhiyao、su_wanxing。角色文件不保留版本后缀、重复贴图或旧成品目录。

## 可重复流程

本机已验证 Blender 5.2.1 LTS：D:/Blender/blender.exe。只使用自带 Python、NumPy 和 glTF 导入导出器。从本任务工作树仓库根目录运行：

    & 'D:/Blender/blender.exe' --background --python-exit-code 1 --python apps/blue-hour/art/blender/scripts/build_character_rig.py -- --character xia_zhiyao --report-dir apps/blue-hour/test-output/replacement/xia_zhiyao/poses
    & 'D:/Blender/blender.exe' --background --python-exit-code 1 --python apps/blue-hour/art/blender/scripts/build_character_rig.py -- --character su_wanxing --report-dir apps/blue-hour/test-output/replacement/su_wanxing/poses
    & 'D:/Blender/blender.exe' --background --python-exit-code 1 --python apps/blue-hour/art/blender/scripts/build_character_rig.py -- --character infected_basic_a --report-dir apps/blue-hour/test-output/rigging/infected_basic_a/poses
    python apps/blue-hour/art/blender/scripts/validate_character_rig.py --character xia_zhiyao --runtime apps/blue-hour/test-output/replacement/xia_zhiyao/xia_zhiyao.glb
    python apps/blue-hour/art/blender/scripts/validate_character_rig.py --character su_wanxing --runtime apps/blue-hour/test-output/replacement/su_wanxing/su_wanxing.glb
    python apps/blue-hour/art/blender/scripts/validate_character_rig.py --character infected_basic_a --runtime apps/blue-hour/assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_rigged.glb

构建默认输出到被忽略的 test-output/replacement/{id}/{id}.glb，不覆盖正在运行的模型。--skip-render 只跳过图片，数值检查仍运行；--output 可指定位置。先检查图片和保留性报告，再复制已检查的 GLB 到 canonical runtime 路径；Godot 导入、Inspector 与现有公共动作兼容通过后，才更新角色配置和直接场景引用。最后清理无引用旧资源。

| 脚本 | 职责 |
| --- | --- |
| inspect_character_glb.py | 解析 GLB JSON/BIN、骨骼、属性、三角面和 JPEG/PNG 尺寸 |
| create_humanoid_rig.py | 在 Blender 创建标准 Rig，核对冻结骨名及父级 |
| fit_humanoid_rig.py | 核对源哈希；已有骨架或权重时停止；用审阅坐标拟合 |
| bind_character.py | 新网格自动权重、焊接代理求解、局部修正和四权重归一化 |
| pose_test.py | 12 个静态姿势、三视图及两张弯膝侧视图，检查有限值及屈膝方向 |
| export_character_glb.py | 导出 23 骨及 Skin；拒绝 Action；检查导出权重 |
| validate_character_rig.py | 独立核对源哈希、三角面与静止坐标、贴图字节、固定层级和零动画 |

## 自动权重与修正

两个新 Mesh 都从空权重开始。直接 Bone Heat 失败后，在临时副本焊接 0.01 mm 内重合顶点，以厘米尺度重新求解，两个角色都得到完整热权重。权重按重合位置映射回原网格；临时副本随后删除，不导出。原始三角面、UV 和贴图不重建，不转移旧角色权重。

依据新模型的空间、贴图和沿表面的距离区分长发与衣服。头发主体跟随 Head，衣身下部纠正误分配的手臂权重，鞋底跟随 Foot。部分发束和衣领仍连接成同一表面，在交界周围平滑权重，头发主体与远处衣服保持固定。交界可能混合少量相邻骨骼影响，不能把全部边缘顶点宣称为刚性独立头发。

分区仅适用于已检查源哈希。新增或重新生成角色必须重新审阅关节和分区，不能复制旧权重。未登记的源哈希会失败；没有经审阅修正规则也不会静默导出。

## 固定契约

- 1 Blender Unit = 1 m；Blender +Z 向上、-Y 朝前、+X 为角色自身左侧；GLB/Godot +Y 向上、+Z 朝前。
- 23 个骨骼固定同名同层级，包含 UpperChest、Shoulder、Toes，无手指、头发或布料附加骨。Root 在地面原点。
- 标准参考为 T 姿势；角色保留自己的 A-Pose 网格，按比例拟合骨长和静止旋转。骨骼 local +Y 沿 head→tail，roll 统一使用 -Y 参考。
- 每顶点最多 4 个权重，总和为 1；使用线性蒙皮，匹配 GLB/Godot。
- 向前抬腿为 Blender X 负旋转，屈膝为正旋转；同时核对实际膝关节前移与约 60° 屈曲。

## Godot 检查和已有动画

[公共 Inspector](../../scenes/debug/humanoid_rig_review.tscn) 可选择两名角色，左侧原始 A-Pose，右侧绑定结果。同一场景包含原始姿势、左右转头/抬臂/抬腿/弯膝、前倾、左右 60° 抬臂压力，以及游戏/前/后视角。程序化切换同步下拉框。

运行 run.ps1 -Mode import 后，分别执行 Godot --script tests/humanoid_rig.gd、tests/humanoid_animations.gd、tests/survivor_locomotion.gd。姿势检查加用户参数 -- capture 并使用原生渲染，可保存每角色 36 张截图。tests/locomotion_runtime.gd 检查真实行动场景。

GLB 关闭动画导入，使用 named skins。贴图按 Godot [Embed as Basis Universal](https://docs.godotengine.org/en/latest/tutorials/assets_pipeline/importing_3d_scenes/import_configuration.html) 嵌入导入场景，避免额外 JPG 和旧材质引用。

已有公共库在 assets/animations/humanoid/locomotion/，只有一份 Idle/Walk/Run。survivor_animation_controller.gd 用 Blender 导出的无网格参考骨架和 Godot RetargetModifier3D 驱动各角色，再按实际移动速度选择状态。本次只验证兼容，不重做或增加动作。

art/build_humanoid_review.ps1 构建 build/BH_Humanoid_Rig_v1_Review.exe，每次清空自己的临时项目，防止旧资源混入。run.ps1 -Mode build 构建 build/BlueHourHomeward.exe。两个入口都检查独立启动。当前状态与限制见 [模型替换报告](../../docs/CHARACTER_REPLACEMENT_REPORT.md)。截图、日志、临时项目和导出物不进入 Git。
