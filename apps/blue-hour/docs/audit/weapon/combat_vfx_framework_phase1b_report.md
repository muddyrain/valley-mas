# Combat VFX Framework Phase 1B 实现报告

## 1. 修改文件

- `weapons/combat/vfx/combat_vfx_resolver.gd`：统一战斗表现入口。
- `vfx/muzzle_flash.gd`：共享程序化枪口闪光网格。
- `vfx/enemy_hit_feedback.gd`：共享 shader 闪白反馈。
- `weapons/weapon_combat_controller.gd`：发出 `fired` 与 `hit_resolved` 事件，保持战斗逻辑独立。
- `weapons/weapon_visual_controller.gd`：为 P9、K9、S12、A21 接入统一枪口 socket/fallback。
- `survivors/survivor.gd`：绑定 `CombatVFXResolver`。
- `enemies/enemy.gd`：接收 `HitEvent` 并驱动受击反馈。
- `tests/combat_vfx_phase1b.gd`：四把武器、命中、受击和视频素材验收。
- `run.ps1`：加入 Phase 1B headless 测试入口。

## 2. VFX 架构

战斗控制器只发布事件；`CombatVFXResolver` 订阅事件并生成短生命周期表现：

```text
WeaponCombatController
        ├─ fired(pellets)
        └─ hit_resolved(HitEvent)
                 ↓
        CombatVFXResolver
          ├─ muzzle flash
          ├─ tracer
          ├─ hit burst
          └─ Enemy.apply_hit_feedback()
```

解析器不按武器 ID 分支，也不改变伤害、攻击间隔、弹丸或武器配置。

## 3. HitEvent 接入

即时命中解析器生成 `HitEvent`，控制器先调用 `Enemy.apply_hit(event)` 完成既有伤害链路，再发出 `hit_resolved`。表现层只消费事件；敌人的 shader 闪白与击退处于同一次命中处理路径。

## 4. 已实现效果

- 枪口闪光：P9、K9、S12、A21 使用共享程序化网格，约 55 ms 生命周期。
- Tracer：每个 pellet 生成独立短生命周期线束，支持单发、连射和多 pellet。
- 命中反馈：普通/重击使用不同尺寸和持续时间的程序化闪光环。
- 敌人受击：通用 shader overlay 闪白，生命周期约 100 ms，可在敌人复用时清理。

## 5. 验收素材

目录：`test-output/combat_vfx_phase1b/`

- [screenshot_01_pistol_fire.png](../../test-output/combat_vfx_phase1b/screenshot_01_pistol_fire.png)
- [screenshot_02_rifle_fire.png](../../test-output/combat_vfx_phase1b/screenshot_02_rifle_fire.png)
- [screenshot_03_hit_feedback.png](../../test-output/combat_vfx_phase1b/screenshot_03_hit_feedback.png)
- [screenshot_04_shotgun_hit.png](../../test-output/combat_vfx_phase1b/screenshot_04_shotgun_hit.png)
- [combat_vfx_phase1b_preview.mp4](../../test-output/combat_vfx_phase1b/combat_vfx_phase1b_preview.mp4)，12 秒。

截图和视频由原生 Godot 运行生成。当前截图的场景镜头仍偏远，效果在代码检查中可见，但需要后续调整验收相机距离后再做美术级确认。

## 6. 性能影响

效果均为短生命周期节点；tracer、hit burst 和 muzzle flash 在 tween/计时结束后释放。未引入永久粒子、Projectile 或对象池改造，也未改变敌人数量、伤害和攻击频率。

## 7. 测试结果

- Phase 1B headless：25/25。
- Phase 1A、武器视觉、战斗动画及任务 locomotion 回归测试：前序运行均通过（见当前工作区测试输出）。
- 原生 Phase 1B：已生成四张截图和 12 秒视频；最终可重复的 headless 检查为 25/25。原生截图的镜头距离仍需人工美术验收。
- GitNexus：当前环境未提供 MCP 工具；本地 CLI 索引未收录工作树新增符号，impact 返回 `UNKNOWN`，已改用原生调用检索和 `git diff` 检查。

## 8. 对现有玩法的影响

不改变武器数值、命中规则、伤害、击退距离、敌人行为或动画状态。玩家看到的反馈增加在现有攻击事件之后，战斗结果保持一致。

## 9. 下一阶段建议

先将验收相机和目标布置收敛为稳定的近景证据，再在独立阶段加入对象池/批处理评估；随后才考虑暴击、元素、爆炸、Projectile 和 Roguelite 升级等扩展。
