# Survivor Animation SMG Pose Phase 1.7

## Task Summary

修正现有 Rifle Idle / Rifle Run 的 SMG 双手持枪姿态。仅修改动画烘焙脚本、这两段 GLB 与共享 AnimationLibrary 中对应的两段数据；动画总数仍为 11。Character Mesh、`BH_Humanoid_Rig_v1`、Weapon Controller、Gameplay 均未改动。

## Changed Files

- 修改：`art/blender/scripts/integrate_survivor_animations.py`
- 修改：`assets/characters/survivors/animations/combat/rifle_idle.glb`
- 修改：`assets/characters/survivors/animations/combat/rifle_run.glb`
- 修改：`assets/characters/survivors/animations/survivor_animations.tres`（仅 Rifle Idle / Rifle Run 动画块）
- 新增：本报告
- 删除：无

## Implementation Details

Phase 1.6 的固定肩臂旋转无法让双手在整段动作中保持与握点的相对位置。本次按现有 RightHand 武器挂接变换确定后握把和枪口方向，再从同一枪体变换确定左手前握把目标。逐帧解算双臂上臂、前臂和手腕旋转并烘焙进原有两段动画；枪随右肩位移和胸部转向运动，保留原始跑动腿部、躯干和头发运动。Rifle Idle 将枪托放在右肩前侧，枪体降至脸部下方。导出源改用仓库归档 FBX，可用 `BH_ANIMATION_SOURCE_ROOT` 覆盖。

运行时仍通过既有 `SurvivorAnimationPipeline` 加载同一 `AnimationLibrary`。没有新增状态、动画、武器挂点或正式武器逻辑。

## Validation

| 检查 | 结果 |
| --- | --- |
| Blender 5.2.1 仅导出 `rifle_idle` / `rifle_run` | PASS |
| Godot 4.7.2 重新导入并重建 11 动画库 | PASS |
| `tests/survivor_animation_pipeline.gd` | PASS，299 checks，0 failures |
| 正面、45 度、侧面原生画面逐帧抽查 | PASS，双手保持在 SMG 握持区域，枪托靠近右肩，枪体不遮脸；跑动保留步态和躯干起伏 |
| 视频容器检查 | PASS，两段均为 H.264、1600×900、30 fps、4 秒 |
| Windows build 与独立 EXE 启动 | NOT RUN；本机是 macOS，Bifrost 无已保存 Windows 连接 |

视频从左至右为正面、45 度、侧面：

- `test-output/survivor-animation/rifle_idle_smg_preview.mp4`
- `test-output/survivor-animation/rifle_run_smg_preview.mp4`

1600×900 静帧：

- `test-output/survivor-animation/rifle_idle_smg_review.png`
- `test-output/survivor-animation/rifle_run_smg_review.png`

## Known Issues

冻结的 23 骨 Rig 没有独立手指骨，因此能校准手掌与前握把的接触位置，不能在本阶段单独收拢手指。Windows 正式构建、独立程序启动和该平台画面验收仍待可用 Windows 环境。

## Environment

| 工具 | [macOS] macOS compatible | [Windows] Windows environment required |
| --- | --- | --- |
| Godot Editor | 4.7.2，完成导入、管线测试和 Compatibility 原生渲染 | 未使用，无法访问 |
| Blender | 5.2.1 LTS，完成两段烘焙 | 未使用，无法访问 |
| Node | 22.22.3，GitNexus 分析 | 未使用，无法访问 |
| Git | 2.55.0，完成变更范围检查 | 未使用，无法访问 |
