# Survivor 165cm Unified Rig Binding V1

本轮只处理两个新 165cm GLB。候选资源写入隔离目录，没有覆盖正式夏知遥、苏晚星、Standard Survivor、动作、Runtime 或 Gameplay。

## 候选资源

- 夏知遥 Blend：[xia_zhiyao_unified_rig_candidate.blend](../test-output/survivor-unified-rig/xia_zhiyao/xia_zhiyao_unified_rig_candidate.blend)
- 夏知遥 GLB：[xia_zhiyao_unified_rig_candidate.glb](../test-output/survivor-unified-rig/xia_zhiyao/xia_zhiyao_unified_rig_candidate.glb)
- 苏晚星 Blend：[su_wanxing_unified_rig_candidate.blend](../test-output/survivor-unified-rig/su_wanxing/su_wanxing_unified_rig_candidate.blend)
- 苏晚星 GLB：[su_wanxing_unified_rig_candidate.glb](../test-output/survivor-unified-rig/su_wanxing/su_wanxing_unified_rig_candidate.glb)

源文件仍保留在用户 Downloads，候选源哈希为：

- 夏知遥：`27a81da65634171718bbf28d58364cc4e1cabf434ab65ab5593f2cff1206f701`
- 苏晚星：`d3d77f82dd1e6d0f6e95439b9eed4cfd9c0b6fee979e2d8104a93e37d9d1a16e`

## 绑定结果

| 项目 | 夏知遥 | 苏晚星 |
| --- | ---: | ---: |
| 实际高度 | 1.64999998 m | 1.65000010 m |
| Vertices | 68,074 | 66,907 |
| Triangles | 101,982 | 102,500 |
| Mesh | 1 | 1 |
| Skin | 1 | 1 |
| Skeleton bones | 23 | 23 |
| Animation clips | 0 | 0 |
| Object scale / location | `(1,1,1)` / `(0,0,0)` | `(1,1,1)` / `(0,0,0)` |
| 无权重顶点 | 0 | 0 |
| 最大影响骨骼数 | 4 | 4 |
| 最大权重和误差 | 1.42e-7 | 1.34e-7 |

两个候选都使用 `BH_Humanoid_Rig_v1` 的 canonical endpoints，没有按角色比例修改骨长，没有缩放骨架，没有添加动画。两个候选的 23 根骨骼名称、层级、端点、长度、轴向和 Rest 数据逐项一致；完整机器结果见 [unified-rig-static-qa.json](../test-output/survivor-unified-rig/unified-rig-static-qa.json)。

Canonical 骨长示例：Hips 0.120000 m、UpperLeg 0.360484 m、LowerLeg 0.341598 m、Foot 0.161012 m、Toes 0.065000 m；两侧完全相同。上肢为 UpperArm 0.230000 m、LowerArm 0.200000 m、Hand 0.090000 m。

源 Mesh 保留了 Meshy 的静态 A Pose；Rig 的冻结 Rest Pose 仍是项目规定的 T Pose。没有改拓扑、没有改外观、没有用 Root 或 VisualRoot 做高度补偿。下一轮应使用公共动作做双角色直驱验证，以确认标准动作在这组 A Pose 外观 Mesh 上的动态变形与脚部表现。

## 静态变形与地面

Blender 静态 QA 对每个候选执行了 Rest、抬臂、屈膝、脊柱前倾和压力姿态。所有评估顶点为有限值，Rest 边长变化 p99 小于 1.000002，最大变化小于 1.000009，没有超过 2 倍的边。

鞋底最低点（Blender Z，毫米）：

- 夏知遥：左 0.188 mm，右 0.000 mm。
- 苏晚星：左 0.000 mm，右 0.019 mm。

两侧均在 0.5 mm 静态接地容差内，没有整体下移或临时 Y Offset。静态姿态证据位于各自的 [qa](../test-output/survivor-unified-rig/xia_zhiyao/qa/) 和 [qa](../test-output/survivor-unified-rig/su_wanxing/qa/) 目录，包含 `rest_front`、`left_arm`、`left_knee_side` 等正面、侧面和 3/4 渲染。

按本轮要求的固定视图另存于各自的 `qa_requested/` 目录：`qa_front.png`、`qa_side.png`、`qa_three_quarter.png`、`qa_feet_closeup.png`、`qa_arm_pose.png`、`qa_knee_bend.png`。

## Weapon Socket contract

候选资源没有写入静态 `WeaponSocket_R` 节点，避免与现有 Godot 运行时动态挂点重名。两者共享相同契约：

- `WeaponSocket_R` → `RightHand`
- 左手辅助握持参考 → `LeftHand`
- 枪口附件 → 武器场景自己的 `MuzzlePoint`

这与现有 `weapon_visual_controller.gd` 的正式架构一致；本轮没有修改武器系统，也没有制作武器动作或 IK。

## 结论

1. 夏知遥和苏晚星已真正绑定到同一套 `BH_Humanoid_Rig_v1`；两者 Skeleton hierarchy、bone length、Rest endpoints、scale 和 socket contract 完全一致。
2. 两个 Mesh 均保持约 102k triangles，Skin 权重满足 Runtime 基础约束：无无权重顶点、最多 4 influences、权重归一化误差低于 `1.5e-7`。
3. 静态双脚接地、抬臂、屈膝和基础变形检查通过。
4. 两个候选满足进入下一轮“公共 Idle / Walking / Running 双角色直驱验证”的资源前置条件；本轮没有播放或接入任何动作，因此公共动作是否完全无需角色专属补偿仍待下一轮动态验收。
5. 本轮没有替换正式角色，也没有修改 Standard Survivor、Retarget、AnimationTree、Gameplay、武器或感染者资源。

## 验证与保护区

- Blender 5.2.1：绑定、GLB 导出、静态姿态渲染、候选 QA 均退出码 0。
- 导出 GLB：两个文件均为 23 bones / 1 skin / 0 animations，尺寸和权重再次通过独立字节审计，见 [export-audit.json](../test-output/survivor-unified-rig/export-audit.json)。
- Godot 4.7.2 headless：临时隔离项目导入两个候选 GLB 通过，生成两个 `.scn` 导入结果，无 Missing Resource / Import Error。
- 350 个正式输入文件保护快照中，绑定流程没有写入正式角色或 Rig 路径。快照期间 `missions/mission.gd` 出现了与本轮无关的既有远征改动；该文件未由本轮脚本触碰，未回滚。
- 没有运行完整 Windows build；本轮只生成隔离美术候选和静态 QA，完整玩法回归属于后续动作直驱接入阶段。
