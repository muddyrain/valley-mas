# Weapon Combat Phase 1A Implementation Report

## 1. 修改文件

- `weapons/combat/attack_spec.gd`
- `weapons/combat/hit_event.gd`
- `weapons/combat/instant_hit_resolver.gd`
- `weapons/combat/damage_resolver.gd`
- `weapons/weapon_combat_controller.gd`
- `survivors/survivor.gd`
- `missions/mission.gd`
- `enemies/enemy.gd`
- `tests/weapon_combat_phase1a.gd`
- `run.ps1`

## 2. 新增架构

Phase 1A 使用轻量 `RefCounted` 数据对象，不创建编辑器 `Resource`：

```text
WeaponDefinition + WeaponInstance
        -> AttackSpec
        -> InstantHitResolver
        -> HitEvent
        -> DamageResolver
        -> Enemy.apply_hit()
        -> Enemy.take_damage(float)
```

`AttackSpec` 是一次攻击的快照，保留来源角色、武器定义、武器实例 UID、方向、起点、伤害、弹丸数量、射程、穿透、击退和效果字段。实际装备 UID 从 Mission 的存档装备实例传到 Survivor 和 CombatController；未关联实例的旧测试和调试入口仍可只传武器定义。

`InstantHitResolver` 只负责现有即时命中的几何检测、弹丸散布、穿透排序和 `HitEvent` 生成。原有射线规则、弹丸规则、墙体遮挡、伤害倍率和 tracer 表现保持不变。随机源由控制器显式传入，解析器不再反向依赖 `member.combat`。

## 3. 当前攻击链路变化

`WeaponCombatController.try_attack()` 现在创建 `AttackSpec`，调用 `InstantHitResolver.resolve()`，再逐个把生成的 `HitEvent` 交给目标。击退、音效、噪声和 `fired` 表现信号仍在控制器中按原时序执行。

`DamageResolver` 是当前的兼容边界，目前只读取 `event.damage`，不改变数值。`Enemy.apply_hit(HitEvent)` 再转发到既有 `take_damage(float)`。敌人近战和旧测试继续使用 `take_damage(float)`，没有删除旧接口。

## 4. HitEvent 数据结构

`HitEvent` 字段包括：`source`、`weapon_id`、`weapon_uid`、`target`、`hit_position`、`direction`、`base_damage`、`damage`、`damage_type`、`critical`、`penetration_index`、`knockback`、`status_effects`、`hit_kind`。`DamageResolver.resolve()` 当前只返回 `damage`，为后续规则保留稳定入口。

## 5. AttackSpec 数据结构

`AttackSpec` 字段包括：`source`、`weapon`、`weapon_instance`、`weapon_id`、`weapon_uid`、`direction`、`origin`、`damage`、`pellet_count`、`range`、`penetration`、`penetration_damage_multiplier`、`knockback`、`damage_type`、`status_effects`。

## 6. 测试结果

新增 `tests/weapon_combat_phase1a.gd`，覆盖：

- source、weapon definition 和 weapon instance identity；
- HitEvent 字段创建；
- penetration index；
- direction 保留；
- 多目标产生独立 HitEvent；
- base damage 与 resolved damage 分离。

`run.ps1 -Mode test` 已加入该测试。本次使用 Godot 4.7.2 执行结果如下：

- `weapon_combat_phase1a.gd`: 10/10 通过；
- `weapon_system.gd`: 428/428 通过；
- `combat_animations.gd`: 3443/3443 通过；
- `encounter_combat.gd`: 9/10 通过，既有“自然首发应为 5–15 秒”断言连续两次得到 0.00 秒，后续战斗断言通过；
- `run.ps1 -Mode test`: 在后续 `camp_departure.gd` 遇到既有 `Visible input target` / 空控件错误后中止，未完成全量套件。

同时完成 `git diff --check` 和 encoding guard 检查，均通过。GitNexus `detect-changes --scope unstaged` 因工作树包含大量预先存在的改动，报告 125 个文件、75 个符号、低风险；新增 Phase 1A 文件尚未进入索引。

## 7. 对现有玩法的影响

没有新增武器、模型、VFX、元素、暴击、Projectile 或升级逻辑，也没有修改武器数值。即时命中的几何判定、伤害计算、穿透倍率、击退、音效、噪声和动画信号保持原行为；本阶段只增加事件边界和实例身份传递。

## 8. 下一阶段建议

下一阶段可在现有 `DamageResolver` 中逐步加入暴击、元素、状态和 AoE 规则。Projectile 应复用 `AttackSpec` 输出 `HitEvent`，不要把 projectile 生命周期或特殊武器分支重新塞回 `WeaponCombatController.try_attack()`。
