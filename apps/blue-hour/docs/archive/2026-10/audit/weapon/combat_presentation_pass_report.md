# Combat Presentation Pass Report

## 1. Camera 调整

真实 `EXPEDITION_COMBAT_CAPTURE_V2` 捕获使用正式 `MEDIUM_TOWN_V1`、正式 `Mission._physics_process()` 和 12 个感染者：

- 探索移动：Camera `size=17`，保留街区、道路和建筑关系。
- 遇敌/战斗：Camera `size=10`，提高幸存者、敌人和 VFX 的屏幕占比。
- 多敌人战斗：恢复 Camera `size=17`，展示战斗密度和街区尺度。

捕获脚本通过现有镜头控制器应用阶段参数，没有修改正式 Expedition camera 的默认配置，也没有遮挡 UI。镜头阶段切换发生在捕获 harness 的阶段边界，作为验收用固定镜头序列。

## 2. VFX 调整

- `MuzzleFlash`：生命周期由 `0.072s` 调整为 `0.105s`，放射几何尺寸略增大，保留橙黄色短促爆闪。
- `CombatVFXResolver.tracer()`：默认及开火调用生命周期调整为 `0.16s`；外层 glow 和白色核心加粗并提高发光层次，尾部仍按现有 tween 渐隐。
- `CombatVFXResolver.hit_burst()`：保留 core/ring/spark 结构，略增冲击几何尺寸和持续时间，并根据 `HitEvent.direction` 定向，增强命中方向感。
- `EnemyHitFeedback`：shader alpha、发光强度和触发强度降低，持续时间调整为 `0.065s`，避免闪白覆盖角色。

没有新增武器、模型、Projectile、元素系统、常驻 VFX 节点或战斗架构。攻击链路保持：

`Weapon -> HitEvent -> CombatVFXResolver`

## 3. 修改文件

- `apps/blue-hour/tests/expedition_combat_capture.gd`
- `apps/blue-hour/tests/combat_presentation_pass.gd`
- `apps/blue-hour/vfx/muzzle_flash.gd`
- `apps/blue-hour/vfx/enemy_hit_feedback.gd`
- `apps/blue-hour/weapons/combat/vfx/combat_vfx_resolver.gd`
- `apps/blue-hour/docs/audit/weapon/combat_presentation_pass_report.md`

`combat_presentation_pass.gd` 复用真实捕获逻辑，只切换输出目录并映射截图文件名；捕获脚本新增可配置输出目录，默认输出行为不变。

## 4. 视频路径

- `apps/blue-hour/test-output/combat_presentation_pass/combat_presentation_pass.mp4`

视频覆盖探索移动、遇敌、自动攻击、多敌人战斗、镜头变化、枪口反馈、tracer 和命中反馈。

媒体规格：`25.000s`、`1600x900`、`15 FPS`、`375 frames`、H.264、`yuv420p`。

## 5. 截图路径

- `apps/blue-hour/test-output/combat_presentation_pass/01_exploration_camera.png`
- `apps/blue-hour/test-output/combat_presentation_pass/02_combat_camera.png`
- `apps/blue-hour/test-output/combat_presentation_pass/03_weapon_vfx.png`
- `apps/blue-hour/test-output/combat_presentation_pass/04_multi_enemy_combat.png`

机器验收清单：`apps/blue-hour/test-output/combat_presentation_pass/review.json`。

## 6. 性能与验证结果

- 原生 capture：`375 frames, 4 screenshots, 0 failures`。
- Capture 统计：12 个正式感染者、38 次 fire attempt、135 次正式 fired、153 个正式命中事件。
- Headless capture：`375 frames, 0 screenshots, 0 failures`。
- `weapon_combat_phase1a.gd`：`11 checks, 0 failures`。
- `combat_vfx_phase1b.gd`：`25 checks, 0 failures`。
- `git diff --check`：通过。
- encoding guard：通过，无可疑编码或文本丢失。
- ffprobe：视频参数与目标一致。

本次只调整一次性短生命周期表现和 capture harness，不改变武器数值、命中规则、Enemy 伤害接口或现有玩法。GitNexus 对本阶段新增/修改的 GDScript 表现符号返回 `UNKNOWN/0`，属于索引尚未覆盖这些符号的边界；既有工作区 dirty changes 未被回滚。

视觉抽查显示探索尺度、近景战斗、多目标构图、tracer 和命中爆发均可读。枪口闪光保持短促节奏，静态截图不保证每张都捕捉到完整闪光，最终强度应以视频连续播放为准。

## 7. 下一阶段建议

先基于 MP4 做人工节奏验收，重点确认近景枪口闪光、连续射击 tracer 和 S12 多 pellet 的读法。如果远景仍需更稳定的轨迹可见性，下一阶段只评估 tracer 生命周期/尾部衰减和镜头过渡曲线，不扩大战斗架构范围。
