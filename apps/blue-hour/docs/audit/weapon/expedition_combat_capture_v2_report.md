# Expedition Combat Capture V2 Report

## 1. 根因

旧捕获 harness 关闭了正式 `Mission` 物理循环，只手动推进枪口和命中反馈。这样没有同步 `Survivor.tick`、`Enemy.tick`、探索可见性、相机跟随和敌人生命周期；同时 harness 在 `center_squad()` 之后又写入局部相机中心，导致镜头回到大范围构图。

正式 `Mission.spawn_enemy()` 不会因为手动创建就立即回收敌人；它会把敌人加入 `mission.enemies`，之后由正式世界 tick 处理 active/dead 状态。真正导致旧证据不稳定的是：探索系统会按幸存者视野重新覆盖 `enemy.visible` 和碰撞层，敌人 AI 也会在正式 tick 中移动或离开构图。

## 2. 修改文件

- `apps/blue-hour/tests/expedition_combat_capture_v2.gd`
- `apps/blue-hour/docs/audit/weapon/expedition_combat_capture_v2_report.md`

没有修改 `WeaponCombatController`、`HitEvent`、`CombatVFXResolver`、武器配置、武器数值、VFX 参数或战斗平衡。

## 3. Capture Mode

新增 `EXPEDITION_COMBAT_CAPTURE_V2` 测试模式，仅存在于 capture harness：

- 通过 `MEDIUM_TOWN_V1` 创建正式 `Mission` 和 `MediumTownRuntime`。
- 使用正式 `Mission._physics_process()`，因此攻击仍经过 `Survivor.tick -> WeaponCombatController -> InstantHitResolver -> HitEvent -> Enemy.apply_hit -> CombatVFXResolver`。
- `director_enabled=false` 只关闭动态刷怪；敌人仍由正式 `mission.spawn_enemy()` 创建并保留在 `mission.enemies`。
- 捕获阶段固定敌人的 AI 决策计时器、位置和可见碰撞层，避免验收对象被移动或探索刷新隐藏；没有替换成假的敌人。
- 0-5 秒调用正式 `mission.command_move()` 观察移动和 Expedition camera；5-25 秒调用正式自动/指向战斗入口，覆盖 P9、A21、S12 和多目标阶段。

## 4. Enemy 生命周期

捕获敌人均为 `ENM_001_infected_basic_a` 的正式实例，数量为 12。harness 将 HP 提高到不会在录制期间死亡，并在每个正式 tick 后重新确认 `active`、`visible` 和 `HitArea.collision_layer=2`。没有修改 `_retire_enemy()`，也没有改动运行时清理规则。

## 5. Camera 验证

当前正式镜头基础参数为 `ExpeditionCamera.DEFAULT_SIZE=23`、`OFFSET=(34,40,43)`，V2 harness 只通过正式 `camera_controller.apply()` 改变验收 framing：

- 0-5 秒尺度段：`size=17`，展示角色、街区、道路和建筑关系。
- 5-20 秒战斗段：`size=10`，焦点为幸存者与当前感染者，保证枪口、tracer、命中反馈可读。
- 20-25 秒密度段：恢复 `size=17`，展示 12 个感染者和街区战斗范围。

这避免用无限缩放掩盖比例问题，同时保留一张全局尺度图和一张近距离战斗图。

## 6. 产物

- 视频：[expedition_combat_capture.mp4](../../test-output/expedition_combat_capture/expedition_combat_capture.mp4)
- `01_expedition_scale.png`
- `02_real_combat_view.png`
- `03_weapon_vfx_view.png`
- `04_multi_enemy_view.png`
- 帧序列：`apps/blue-hour/test-output/expedition_combat_capture/frames/`
- 机器清单：`apps/blue-hour/test-output/expedition_combat_capture/review.json`

视频参数：1600x900、15 FPS、375 帧、25.0 秒、H.264。录制统计：12 个正式敌人、38 次 harness fire attempt、135 次正式 `fired` 信号、165 个正式命中事件、0 failures。

## 7. 测试结果

- V2 capture headless：375 帧，0 failures。
- V2 capture native：375 帧，4 screenshots，0 failures。
- `weapon_combat_phase1a.gd`：11 checks，0 failures。
- `combat_vfx_phase1b.gd`：通过；报告生成 `review.json` 为 25 checks，0 failures。
- `combat_presentation_pass.gd`：210 帧，0 failures。
- `combat_animation_mission.gd`：47 checks，0 failures；Godot 输出了既有 `Enemy._resolve_attack()` 到 survivor `take_damage()` 的 typed-array runtime error，但测试本身按现有脚本返回 0 且 failures 为 0，该问题不由本次 capture harness 引入。
- Encoding guard：通过，无 mojibake 或文本丢失。
- `git diff --check`：通过。
- ffprobe：25.000 秒、1600x900、15 FPS、375 帧。

## 8. 对现有玩法的影响

无。改动只新增一次性视觉证据 harness 和报告；正式战斗逻辑、敌人清理、武器行为、数值和 VFX 参数未改。

## 9. 下一阶段建议

先基于视频和四张截图做人工视觉评审：确认枪口闪光/tracer 的可读性、S12 多 pellet 的空间层次、命中反馈冲击和敌人闪白。只有在评审确认效果不足时，才进入 VFX 参数或镜头表现的独立优化阶段；本阶段不继续扩大战斗架构范围。
