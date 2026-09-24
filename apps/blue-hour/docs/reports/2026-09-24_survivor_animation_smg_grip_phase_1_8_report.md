# Survivor Animation SMG Grip Phase 1.8

## Task Summary

完成现有 `rifle_idle` / `rifle_run` 的最后一轮 Debug Preview 持枪校准。动画仍为 11 段；正式武器数值、角色 Mesh、冻结的 23 骨 Rig、Weapon Controller、Gameplay 和其余 9 段动画均未改动。全程只运行 Blender background、Godot headless 和命令行工具，没有打开或激活调试窗口。

## Changed Files

- 修改：`art/blender/scripts/integrate_survivor_animations.py`
- 修改：`assets/characters/survivors/animations/combat/rifle_idle.glb`
- 修改：`assets/characters/survivors/animations/combat/rifle_run.glb`
- 修改：`assets/characters/survivors/animations/survivor_animations.tres`，仅两段 Rifle 动画块
- 修改：`scenes/debug/survivor_animation_preview.gd`
- 修改：`docs/PLAN.md`
- 新增：本报告
- 更新忽略目录 `test-output/survivor-animation/` 下的四个验收文件；未新增动画或正式资源

## Implementation Details

沿用 Phase 1.7 的逐帧双臂解算，只微调两个握点。右手后握把目标向肩部收回约 4 cm；左手前握把目标按 Debug Preview 的 `0.84` 武器缩放重新计算，左手肘随之收拢。左手腕方向改为顺枪身向前，使手掌在常用镜头距离进入护木前端区域，减少向下垂空的观感。枪随右手和胸部运动，原有腿部步态、躯干起伏和头发运动继续保留。

Debug Preview 的 SMG 根节点缩放设为 `0.84`，挂接位置仍使用现有 `long_gun.tres` 与手部握点变换。`long_gun.tres` 本身及正式 Weapon Controller 均未修改。`0.84` 是当前 Debug Preview 建议比例，不能直接视为正式 Expedition 武器数值。

## Validation

| 检查 | 结果 |
| --- | --- |
| [macOS] Blender 5.2.1 background 仅导出 `rifle_idle` / `rifle_run` | PASS |
| [macOS] Godot 4.7.2 headless 导入、重建 11 段 AnimationLibrary | PASS |
| [macOS] Godot headless 启动 Debug Preview 场景 10 帧 | PASS，无脚本或资源错误；headless 不提供画面 |
| [macOS] `tests/survivor_animation_pipeline.gd` | PASS，300 checks，0 failures |
| [macOS] `tests/expedition_integration_e00.gd` 真实 Expedition 流程连通 | PASS，58 checks，0 failures；属于结构/逻辑检查，不是画面验收 |
| [macOS] Blender background 三视角逐帧检查 | PASS：Idle 双手在握持区域，枪体位于胸前且不遮脸；Run 三个循环采样点均保持双手靠枪、枪向稳定，腿部与躯干持续运动 |
| [macOS] 四个验收文件 | PASS：两段 H.264 视频均为 1600×900、30 fps、3 秒；两张 1600×900 静帧 |
| [macOS] Godot 原生 GUI / 真实 Expedition 视觉验收 | SKIPPED：当前环境不能保证窗口不抢占用户桌面焦点 |
| [Windows] build、独立 EXE 启动及画面验收 | NOT RUN：本机是 macOS，当前没有已保存的 Windows 远程连接 |

四个文件均从左至右排列正面、45°、侧面，路径：

- `test-output/survivor-animation/rifle_idle_smg_review.png`
- `test-output/survivor-animation/rifle_run_smg_review.png`
- `test-output/survivor-animation/rifle_idle_smg_preview.mp4`
- `test-output/survivor-animation/rifle_run_smg_preview.mp4`

## Known Issues

冻结的 23 骨 Rig 没有独立手指骨；本阶段完成手掌和前臂方向校准，近景下手指仍不能环握。后台 Blender 画面是按现有握点变换复现的 Debug Preview，不能代替 Godot 原生画面。Phase 1.8 的 Debug Preview 精修到此停止；下一步在真实 Expedition 场景检查实际武器比例、镜头距离和动作切换，仅在出现阻断级问题时再回到动画校准。

## Environment

| 工具 | [macOS] macOS compatible | [Windows] Windows environment required |
| --- | --- | --- |
| Godot Editor | 4.7.2，headless 导入与管线验证 | 未访问 |
| Blender | 5.2.1，background 烘焙与三视角渲染 | 未访问 |
| Node | 22.22.3，GitNexus 影响分析 | 未访问 |
| Git | 2.55.0，变更范围检查 | 未访问 |
