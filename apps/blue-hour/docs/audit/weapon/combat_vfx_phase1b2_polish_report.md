# Combat VFX Phase 1B.2 Polish Report

## 1. 修改文件

- `apps/blue-hour/vfx/muzzle_flash.gd`
- `apps/blue-hour/weapons/combat/vfx/combat_vfx_resolver.gd`
- `apps/blue-hour/vfx/enemy_hit_feedback.gd`
- `apps/blue-hour/tests/combat_vfx_phase1b2_review.gd`

## 2. 优化内容

- 枪口闪光：生命周期从 `0.055s` 调整为 `0.072s`，放射尖端略增大，保留短促橙黄色几何爆闪。
- Tracer：生命周期从 `0.085s` 调整为 `0.115s`，改为发光外层和亮色核心两层短命 BoxMesh，支持单发、连射和多 pellet 的统一入口。
- 命中反馈：保留 core sphere 与 impact ring，增加四向短 spark；缩小核心并降低能量，避免形成大面积白斑。
- 敌人受击：shader overlay alpha 从 `0.72` 降至 `0.32`，发光强度下降，持续时间从 `0.10s` 降至 `0.075s`，保留角色轮廓。

## 3. 当前攻击链路

战斗架构未改变，仍为：

`Weapon -> HitEvent -> CombatVFXResolver -> 短生命周期表现节点`

未修改 `HitEvent`、`WeaponCombatController`、武器定义、武器数值或战斗逻辑。

## 4. 验收产物

- 视频：`apps/blue-hour/test-output/combat_vfx_phase1b2/combat_vfx_phase1b2_preview.mp4`
- 枪口闪光：`apps/blue-hour/test-output/combat_vfx_phase1b2/01_muzzle_flash.png`
- Tracer：`apps/blue-hour/test-output/combat_vfx_phase1b2/02_tracer.png`
- 命中效果：`apps/blue-hour/test-output/combat_vfx_phase1b2/03_hit_effect.png`
- 敌人反馈：`apps/blue-hour/test-output/combat_vfx_phase1b2/04_enemy_feedback.png`

视频规格：`13.0s`、`1600x900`、`15 FPS`、`195 frames`。内容覆盖 P9 单发、A21 连射、S12 多 pellet 和多目标受击。

## 5. 测试结果

- `tests/combat_vfx_phase1b.gd`：`25 checks, 0 failures`
- `tests/combat_vfx_phase1b2_review.gd` headless：`195 frames, 0 failures`
- 桌面渲染 review：`195 frames, 4 screenshots, 0 failures`
- `git diff --check`：通过
- encoding guard：通过，无可疑编码或文本丢失

## 6. 性能与玩法影响

仅增加每次命中四个短生命周期 spark，并将 tracer 拆为同一父节点下的两层短命网格；没有永久粒子、常驻节点、武器分支或战斗逻辑变化。现有玩法数值和命中结果不受影响。

## 7. 视觉观察

枪口闪光更容易在近景中读到，命中反馈具有 ring 与 spark 的层次，敌人闪白不再持续覆盖完整角色。Tracer 在连续视频中方向可读性提升；由于生命周期仍然很短，静态截图不保证每次都截到完整 tracer，这是本阶段保留短反馈节奏的结果。

## 8. 下一阶段建议

先基于视频进行人工节奏验收。如果仍需提升远景 tracer 的稳定可读性，建议下一阶段只评估生命周期和尾部衰减曲线，不改变 CombatVFXResolver 的职责边界。
