# Standard Survivor Template 静态基线

日期：2026-09-17。来源为用户提供的女性 165cm、新脚踝位置模板。

**接入完成；Skeleton / Skin / Mesh、原始身高、Rest Pose 地面接触通过。左右 Toe_End 末端轴不完全镜像，作为已知源资产问题记录，不作动作可用性验收。** 未制作或接入 Idle / Walk / Run，未进行 Retarget 或脚部补偿。

## 唯一正式入口

- 场景：[survivor_animation_template.tscn](../assets/characters/survivor_animation_template/survivor_animation_template.tscn)
- 模型：[source/survivor_animation_template.fbx](../assets/characters/survivor_animation_template/source/survivor_animation_template.fbx)
- 贴图：[source/survivor_animation_template_albedo.png](../assets/characters/survivor_animation_template/source/survivor_animation_template_albedo.png)
- 模型 UID：`uid://d3wg82rj1fk16`。场景采用直接资源路径，不复用旧模板 UID。

唯一模板目录为 `assets/characters/survivor_animation_template/`，无版本后缀、备份模型或 Runtime 控制脚本。未接入角色目录、Debug 角色名单、Mission 或公共动画系统。

## 源件与导入边界

原始包：`C:/Users/A/Downloads/AI_survivor_animation_te_biped.zip`。包内仅一个 FBX 和一个 PNG，无附带指令文档。

| 文件 | SHA-256 |
| --- | --- |
| ZIP | `7904a28aad5d1d91fb3aa17b50d5922c9bbac0f33a30daa17369b0a08cbfe4d5` |
| 包内原始 FBX | `0233e177d5dd0db62652d3b8e30af1f5386d673e978e7bf40f82419105ae9d77` |
| 正式 FBX | `033932ed14562004a68f8a98f305bf3e1d5fb0c2ecc2fbb036639a6cc88dd4b5` |
| 原始及正式 PNG | `7e6086804ee6d0e925ca3686de8ccb670583b1c8cf2c740ffaf85a998eb54cc0` |

FBX 将内嵌 JPEG 的四个文件名字段错误写成 `.fbm`。`prepare_standard_survivor.py` 仅纠正这些字段，结构化往返校验确认其余 1,141 个对象未变，包括 Mesh、Skeleton、Skin、Rest 和源动作。外部 PNG 字节不变，由模板专属 `standard_survivor_import.gd` 设置为 albedo。没有修改模型形状、骨骼轴、权重或比例。

源 FBX 带有 `Idle_4`、`Walking`、`Running`。`.fbx.import` 设置 `animation/import=false`；Godot 的导入回调仍收到源播放器，因此模板专属导入脚本将其移除。最终场景没有 AnimationPlayer、AnimationTree、动画库或 Runtime 动作，源文件中的动作数据仅保留为未使用的原始数据。

## 尺度与绑定

| 指标 | Blender 源审计 / Godot 实测 |
| --- | --- |
| 身高 | 1.6499997449m / 1.6499997377m |
| Godot Y 范围 | -0.0000001312m 至 1.6499996185m |
| Mesh | 1 个，34,098 顶点，49,349 三角形 |
| Skeleton / Skin | 1 个 Skeleton3D，28 骨，28 个有效 Skin bind |
| 单顶点影响数 | 最大 4 |
| 无权重顶点 / 无效 bind | 0 / 0 |
| 原始权重和范围 | 0.9999998659～1.0000001192 |
| Godot 权重和范围 | 0.9999541789～1.0000000149，符合 0.0001 校验容差 |
| Rest 蒙皮相对网格最大位移 | Blender 0.0000001822m；Godot CPU bind 重建 0.0000669778m |

场景根 `StandardSurvivorTemplate` 与 `Model` 包装节点均 identity。FBX 原生厘米/轴转换在导入层表现为共同的 `(100,100,100)` scale 和坐标轴转换，Mesh 与 Skeleton 的完整 global transform 相同，位置均为零；世界尺寸仍为 1.65m。没有单独 Mesh 缩放、VisualRoot、Y Offset、Root 下移或旧 ground correction。

## Skeleton 层级

Godot 将源 `mixamorig:` 名称规范为 `mixamorig_`；下列树省略该前缀，`headfront` 保持原名。

```text
StandardSurvivorTemplate / Model / target_character / Skeleton3D
Hips                         # 唯一根骨，无额外 Root 骨
  Spine
    Spine1
      Spine2
        Neck
          Head
            HeadTop_End
            headfront
        LeftShoulder -> LeftArm -> LeftForeArm -> LeftHand -> LeftHandMiddle4
        RightShoulder -> RightArm -> RightForeArm -> RightHand -> RightHandMiddle4
  LeftUpLeg -> LeftLeg -> LeftFoot -> LeftToeBase -> LeftToe_End
  RightUpLeg -> RightLeg -> RightFoot -> RightToeBase -> RightToe_End
```

Hips 源位置约为 X=0.003523m、高度 0.962425m。Foot 为脚踝关节，ToeBase 为前掌关节，Toe_End 为末端；没有独立名为 Ankle 的骨。所有 bone pose 与导入 rest transform 一致，父子链和蒙皮绑定有效，未套用公共 23 骨 humanoid rig。

## Foot / Toe 与地面

| 静态测量 | 左脚 | 右脚 |
| --- | ---: | ---: |
| Foot / 脚踝高度 | 86.030mm | 86.030mm |
| ToeBase 高度 | 38.379mm | 39.032mm |
| Toe_End 高度 | 38.379mm | 39.032mm |
| 大腿关节间长度 | 345.991mm | 345.992mm |
| 小腿关节间长度 | 447.582mm | 447.520mm |
| 膝盖 Rest 弯曲角 | 9.603° | 9.226° |
| 鞋底后跟最低点 | 0.325mm | 0.358mm |
| 鞋底前掌最低点 | 0.369mm | 约 0mm |

鞋底采样选取 Rest 网格最低 6cm、按左右 Foot 的 X 符号分组，再沿 Foot → ToeBase 水平投影取后 30% / 前 30% 区域最低点。这是静态网格接地测量，不是 Foot IK 或动作接触保证。

原生正面、左右侧面及脚部近景未见整体悬空、明显穿地、踝部塌陷、小腿拉伸、膝反折或整只脚持续上翘。ToeBase → Toe_End 接近水平；鞋头轮廓自带的小幅上弯不是整脚骨骼上翘。

**左右并非严格对称：**

- 以世界 X=0 镜像比较，Foot 原点差约 0.00082mm，三轴最大镜像角差约 0.962°，无整体翻转。
- ToeBase 原点差约 0.686mm，轴向最大差约 3.972°。
- Toe_End 原点差约 4.402mm，三轴镜像角差约 23.50° / 20.36° / 28.78°；左右 ToeBase → Toe_End 长度差约 3.071mm。
- 左右 UpLeg / Leg 的世界镜像位置差约 7.044mm，Hips 本身偏离 X=0 约 3.523mm。小腿长度仅差约 0.062mm，不是导入造成的单侧拉伸。
- Toe_End 分别影响 1,616 / 1,715 个源顶点，不能当作无权重辅助骨忽略。后续若旋转脚趾末端，相同局部旋转未必产生镜像动作。

轴向比较先镜像左侧世界坐标，再反转一个局部轴以恢复右手系，没有将左右骨轴简单要求为相同向量。Blender 原件与 Godot 导入结果均存在上述差异，原因在源 Rest 骨架/轴设置，而非本轮缩放或偏移。**本轮只报告，不修改源骨架，不制作补偿动作；左右末端轴完全对称这一项不能标为通过。**

## 验证结果

- Godot 4.7.2 Headless Import：通过，最终日志无脚本或资源错误。
- 正式模板 Scene Load / Skeleton / Skin / Rest / 高度 / UID / 递归依赖：152 项通过；资源路径依赖仅为本模板场景、FBX 和 PNG。
- 原生 OpenGL 静态捕获：7 个视角，连同保存检查共 159 项通过。照片来自原始 Rest Pose，无动作播放。
- 夏知遥、苏晚星：复用既有骨架检查的逐角色入口，303 项通过；既有公共动画基础回归 908 项通过。
- 301 个受保护文件 SHA-256 不变，覆盖两名角色、感染者、公共 rig/animations、Survivor Runtime、动画接口、武器、Mission/Core、数据及 Debug 模块。
- Windows Release 已导出至 `build/BlueHourHomeward.exe`，独立目录原生启动通过。该启动验证游戏包可用，不代表新模板已接入 gameplay；新模板视觉证据来自上述独立场景。
- 本轮执行定向回归，没有宣称跑过完整 `run.ps1 -Mode build` 套件。Windows 构建信息记录在 `build/BUILD-INFO.json`。

数值和日志位于本地 `test-output/standard-survivor-baseline/`：`source-audit.json`、`preparation.json`、`godot-audit.json`、`protected-result.json`、`import.log`、`scene-load.log`、`formal-characters.log`、`humanoid-animations.log`、`capture.log`。截图为 `front.png`、`left.png`、`right.png`、`three_quarter.png`、`feet_front.png`、`feet_left.png`、`feet_right.png`。

复验入口：

```powershell
./apps/blue-hour/run.ps1 -Mode import
& 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe' --headless --path apps/blue-hour --script tests/standard_survivor_template.gd
& 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe' --path apps/blue-hour --script tests/standard_survivor_template.gd -- capture
```

## 本轮文件变更

- 正式模板目录内 FBX、PNG、两份 `.import`、静态 `.tscn` 共 5 个文件。
- 新增 `art/standard_survivor_import.gd`，仅处理本模板材质和源播放器排除。
- 新增 `art/blender/scripts/inspect_standard_survivor.py`、`prepare_standard_survivor.py`，分别审计源件、纠正四个纹理元数据字段。
- 新增 `tests/standard_survivor_template.gd` 及 `.uid`，验证静态基线并可选输出原生截图。
- 新增本报告，更新 `art/MODEL_CATALOG.md` 和 `docs/PLAN.md`。
- 本地验证脚本、数值、截图、日志及 Windows 构建位于 Git 忽略目录；旧模板删除记录沿用上一轮，不计为本轮新删除。

公共 AnimationPlayer / AnimationTree 架构、`survivor_animation_controller`、正式角色、感染者和 gameplay 均未修改。计划已同步；停止于此，等待下一步指令。
