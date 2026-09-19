# Survivor 165cm Unified Runtime Baseline Audit

本轮只读取两个新 GLB 和当前 Standard Survivor 165cm 技术基准，没有替换正式角色、导入正式资产、制作动画或修改 Runtime。

## 结论

两个新 GLB 都是 **1.65m 静态 Mesh**，但都不包含 Skeleton、Skin 或 Animation。它们可以作为 165cm 外观模型候选，不能直接进入 `BH_Humanoid_Rig_v1` Runtime，也不能直接共享现有 Idle / Walking / Running。

当前推荐：**先绑定到统一 Rig，再做蒙皮与静态姿态验收；不要直接替换正式角色。** 由于新 GLB 没有骨骼，不能从文件本身验证 Hips、腿链、Foot / Toe 轴、Rest Pose、权重或 Weapon Socket。

## 新 GLB 审计

| 项目 | 夏知遥新 GLB | 苏晚星新 GLB |
| --- | ---: | ---: |
| 实际 Mesh 高度 | 1.64999998m | 1.65000010m |
| Mesh 数量 | 1 | 1 |
| Vertex | 68,074 | 66,907 |
| Triangle | 101,982 | 102,500 |
| Material | 1 | 1 |
| Texture | 3 × 2048² RGBA | 3 × 2048² RGBA |
| Skeleton | 无 | 无 |
| Skin / Armature modifier | 无 | 无 |
| Bone count | 0 | 0 |
| Animation | 无 | 无 |
| 无权重顶点 | 68,074（全部） | 66,907（全部） |
| Mesh scale / location | `(1,1,1)` / `(0,0,0)` | `(1,1,1)` / `(0,0,0)` |
| Mesh bounds Z | `0.000–1.650m` | `0.000–1.650m` |
| Mesh bounds X | `-0.434–0.433m` | `-0.432–0.432m` |

Z 最低点为 0，表示网格导出时有地面原点基准；但没有骨骼和足部语义，不能据此证明左右鞋底、Heel、Forefoot 或 Toe 的 Runtime 接地正确。

## Standard Survivor 165cm 基准

采用当前已通过的 Standard Survivor / `BH_Humanoid_Rig_v1` 基准记录：

项目 FBX 在 Blender 原始导入下的网格包围盒会受源轴向和导入姿态影响，读数为约 1.533m；本报告采用项目已验收的 canonical 165cm envelope 与 Rig contract 作为技术基准，不把该原始导入包围盒误当作正式身高。

| 指标 | Standard Survivor 165cm |
| --- | ---: |
| Character envelope | 1.650m |
| Hips 原点高度 | 0.9624m |
| 髋关节中点 | 约 0.8766m |
| UpperLeg 左 / 右 | 0.3460 / 0.3460m |
| LowerLeg 左 / 右 | 0.4476 / 0.4475m |
| Ankle / Foot 高度 | 约 0.0860m |
| Shoulder width | 0.2742m |
| UpperArm 左 / 右 | 0.2359 / 0.2203m |
| LowerArm 左 / 右 | 0.2217 / 0.2235m |
| Rest Pose | T Pose，标准 Rig Rest |
| Foot ground | 已通过的统一基准 |

两个新 GLB 没有 Skeleton，因此上述所有骨骼长度、Hips、Foot / Toe、Rest Pose 和 Socket 项目均为 **N/A**，不能声称与 Standard 一致。

## 统一 Runtime 判断

### 是否能统一为 `BH_Humanoid_Rig_v1`

**技术上可以作为下一步绑定目标，当前不能直接使用。** 两个 GLB 的身高和地面最低点符合 165cm Envelope，但缺少进入 Runtime 所需的全部骨骼与蒙皮数据。现阶段无法确认：

- Bone count / hierarchy / naming
- Hips 基准和腿链长度
- Foot / Toe 局部轴向
- Rest Pose
- 左右骨骼对称性
- Skin 权重质量
- Weapon Socket 位置

### 是否能共享一套 Locomotion

**当前不能直接共享。** 阻塞项不是已测出的身高差，而是两个模型没有 Skeleton / Skin。统一 Rig 绑定完成后，仍需逐角色验证骨长、Rest、脚踝高度、鞋底基准和蒙皮变形；只有这些落入统一契约，才可以让公共 Idle / Walking / Running 直接驱动所有角色。

### 未来 8 个 Survivor 规则

“165cm Character Envelope + Lore 身高不驱动 Runtime Scale + 统一 `BH_Humanoid_Rig_v1` + 一套公共 Locomotion”是**可行的目标架构**，但前提是每个新角色都必须交付：

1. 统一 23 骨名称与层级。
2. 统一 Rest Pose、骨骼轴向、Hips 与 Foot ground contract。
3. 角色自己的 Mesh / Skin 权重验收。
4. 统一 Weapon Socket 和静态站姿验收。
5. 通过公共动作在该角色上的接地与变形回归。

165cm 只应约束角色外形包络，不能代替骨架契约，也不能靠 Runtime Scale 抹平骨长差异。

## 推荐下一步

先对两个新 Mesh 执行 **统一 Rig 绑定 / 重新蒙皮** 的独立制作流程，输出候选 Runtime 资源到隔离目录；完成 Skeleton、Skin、Rest、Foot ground、Socket 和静态变形审计后，再决定是否替换正式角色。当前不做 Retarget、AnimationTree 接入或 Gameplay 速度应用。

审计原始数据：[survivor-165cm-baseline-audit.json](../test-output/survivor-165cm-baseline-audit.json)。
