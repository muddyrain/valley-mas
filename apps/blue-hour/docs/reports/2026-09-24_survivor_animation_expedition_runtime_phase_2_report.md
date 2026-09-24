# Survivor Animation Phase 2 — Expedition Runtime Integration

## Task Summary

夏知遥 `SUR_001` 已通过正式 Mission 的现有角色、导航、相机、武器、自动战斗与 HUD 路径使用 11 段 Survivor 动画。K9 SMG 原资源没有正式模型路径，本轮为已有网格增加 `WeaponRoot`、双手握点和枪口节点并接入 K9；没有改 Character Mesh、23 骨 Rig、武器数值、真实移动速度或战斗结算。全程只使用 Blender background、Godot headless 和命令行。

运行时逻辑与结构验收已通过；原生 Expedition 视频、截图和视觉 QA 尚未完成，因此 **Phase 2 视觉验收未通过，暂不批量接入其他幸存者**。

## Changed Files

| 路径 | 本轮作用 |
| --- | --- |
| `survivors/survivor.gd` | 仅 `SUR_001` 选择新 controller；真实伤害事件驱动 Hit/Death |
| `survivors/survivor_expedition_animation_controller.gd` | 11 段动画的正式 Mission 状态、射击/受击覆盖与播放时钟 |
| `survivors/survivor_expedition_aim_modifier.gd` | 上身朝现有战斗目标旋转 |
| `survivors/survivor_expedition_grip_modifier.gd` | Rifle Run 中左手锁定正式武器前握把 |
| `art/blender/weapons/build_smg_runtime.py`、`art/blender/weapons/wpn_004_k9_smg.blend`、`assets/weapons/models/wpn_004_k9_smg.glb` | 在现有 K9 网格外建立正式 WeaponRoot 与握点/枪口节点 |
| `data/weapons/wpn_004_k9_smg.tres`、`art/MODEL_CATALOG.md` | K9 正式模型路径与目录记录 |
| `tests/survivor_expedition_animation_runtime.gd` | 正式 Medium Town Mission 的状态与接触检查及运行轨迹 |
| `tests/weapon_visuals.gd`、`tests/combat_animations.gd`、`tests/combat_animation_mission.gd`、`tests/public_locomotion_production.gd`、`tests/survivor_locomotion.gd` | 新图由夏知遥专项验证；旧图回归继续验证苏晚星；武器朝向在状态切换稳定后判定 |
| `run.ps1` | test/build 的 headless 门禁增加夏知遥专项 |
| `docs/PLAN.md`、本报告 | 阶段状态与验收边界 |

Godot 同时生成了新 GLB 的 `.import` 与三个新脚本及专项测试的 `.gd.uid`，作为资源引用元数据一同保留。

Phase 1.7/1.8 在共享工作区已有未提交的动画、Debug Preview 和报告改动，本轮保留它们，没有将其当作 Phase 2 新增动画。

## Runtime Mapping

| 正式状态或事件 | Survivor 动画 | 驱动 |
| --- | --- | --- |
| 未装备、停止 | `survivor_idle` | 当前移动速度 |
| Expedition 未装备移动 | `survivor_run` | 当前真实速度驱动播放速率 |
| 远程武器静止/移动 | `rifle_idle` / `rifle_run` | 现有装备与移动状态 |
| 自动射击确认 | `rifle_shoot` | `combat.fired` 触发上身 OneShot；保留双手握枪 |
| 小刀静止/实际攻击 | `knife_idle` / `knife_attack` | 现有小刀装备与 `combat.fired` |
| 受到伤害 | `hit_reaction` | 真实 `take_damage`；短时上身 OneShot 后恢复 |
| 致命伤害 | `death` | 真实 `take_damage`；终态完整播放并保持末帧 |

优先级为 Death、Hit 表现覆盖、Knife Attack、Rifle Run/Idle、Run、Idle。除夏知遥外，幸存者继续使用原 Public/Combat 图。正式 Mission 相机尺寸保持 23；测试没有新建替代场景。

## Validation

| 检查 | 结果 |
| --- | --- |
| [macOS] Godot 4.7.2 headless import | PASS，退出码 0 |
| [macOS] 正式 Medium Town Mission 专项 | PASS，33 checks / 0 failures；22 次真实自动射击，含移动中射击、小刀、受击与死亡全片段 |
| [macOS] `survivor_animation_pipeline.gd` | PASS，300 checks / 0 failures |
| [macOS] `weapon_visuals.gd` | PASS，1789 checks / 0 failures |
| [macOS] `combat_animations.gd` | PASS，1763 checks / 0 failures，旧图苏晚星 |
| [macOS] `combat_animation_mission.gd` | PASS，26 checks / 0 failures，旧图苏晚星 |
| [macOS] `mission_locomotion_style.gd` | PASS，110 checks / 0 failures，旧图苏晚星 |
| [macOS] `public_locomotion_production.gd` | PASS，495 checks / 0 failures；夏知遥按 Expedition 新图判定，苏晚星保持旧图契约 |
| [macOS] `survivor_locomotion.gd` | PASS，21 checks / 0 failures，旧 Public 图苏晚星 |
| [macOS] `camp_locomotion_style.gd` | PASS，171 checks / 0 failures |
| [macOS] `locomotion_mission.gd` | PASS，16275 checks / 0 failures |
| [macOS] `survivor_production_gameplay.gd` | PASS，29 checks / 0 failures，1116 frames |
| [macOS] `expedition_integration_e00.gd` | PASS，58 checks / 0 failures |
| [macOS] 原生 Expedition 视频、截图、视觉 QA | 未执行：本机 Godot headless 为 dummy renderer，无法获得真实相机画面；无法保证 GUI 不抢桌面焦点 |
| [macOS] `survivor_production_flow.gd` | 无法 headless 完成：旧测试直接从窗口 viewport 截图，dummy renderer 无可用画面，最终触发自身 150 秒超时；不计入运行时通过项 |
| [Windows] build、独立 EXE 启动 | 未执行：当前本机是 macOS，没有可用 Windows 远程连接 |

运行轨迹：`test-output/survivor-animation/expedition-runtime/runtime.json`。正式 K9 持枪稳定段左掌与前握把的最大距离：Rifle Idle 0.6 mm、Rifle Run 小于 1 mm、移动射击小于 1 mm。静止自动射击的目标方向点积中位数约 0.957，移动射击末段约 0.815；这只能说明枪口大体朝向目标，不能替代画面判断。武器视觉回归在状态切换第 0 帧曾测到短暂反向，稳定帧通过；需在原生视频中判断是否可见。

## Visual QA And Decision

真实镜头下的脚滑、高抬腿、枪体比例、遮脸、跑步生命感、射击衔接、受击清晰度和倒地观感均 **未被画面证据验证**。由于没有 30–60 秒真实 Expedition 录像和所需六类截图，不能断言没有阻断级动画问题，也不能确认 SMG 正式比例是否需要调整。正式 K9 沿用原网格尺寸，没有把 Debug Preview 的 `0.84` 缩放写入武器数据。

下一步只需在可保证不抢焦点的原生渲染环境中采集正式相机视频与截图，并据此判断是否存在阻断问题。完成这项视觉验收前，不启动其他幸存者的批量接入。

## Impact And Environment

GitNexus 对本轮 GDScript 的目标符号返回 `UNKNOWN / Target not found`，索引没有提供可用调用图；人工调用点检查显示生产接线仅从 `Survivor.setup` 选择夏知遥新 controller，伤害仍从原 `take_damage` 进入，其他角色维持旧图。未收到 HIGH/CRITICAL 风险结果。工具环境为 macOS、Godot 4.7.2 headless、Blender 5.2.1 background；没有激活任何桌面应用。
