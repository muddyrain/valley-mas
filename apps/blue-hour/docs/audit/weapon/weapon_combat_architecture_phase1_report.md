# Weapon Combat Architecture Phase 1 Report

审计日期：2026-09-21  
范围：`apps/blue-hour` 当前武器、幸存者、敌人、任务、数据与测试链路。  
本阶段边界：仅架构审查与设计；未修改游戏代码、未新增武器/资源/测试文件、未调整战斗数值。  
证据边界：当前工作树包含大量未提交改动；本文按当前可见源码与测试记录审计。GitNexus 本地索引显示 up-to-date，但当前会话未暴露 GitNexus MCP，因此未伪造 `query/context/impact` 结果。

## 1. 当前战斗架构总结

当前系统是“数据驱动定义 + 实例化装备 + 统一 CombatController + 即时几何命中”的架构：

- `WeaponDefinition`（`data/weapon_data.gd`）保存武器静态模板：伤害、攻速、射程、弹匣、散射、pellet、穿透、击退、图标、模型和标签。
- `WeaponInstance`（`weapons/weapon_instance.gd`）保存 UID、定义 ID、稀有度与 modifier；`WeaponModifiers`（`weapons/weapon_modifiers.gd`）把实例 modifier 应用到派生 Resource。
- `Survivor`（`survivors/survivor.gd`）同时持有武器、战斗控制器和视觉控制器；自动攻击与手动指向均进入同一 `try_attack()`。
- `WeaponCombatController`（`weapons/weapon_combat_controller.gd`）管理冷却、弹匣、换弹、散射、目标筛选、穿透、击退、tracer、音效和 `fired` 信号。
- `Mission`（`missions/mission.gd`）负责选目标、视线/距离校验和角色相关伤害计算；敌人最终由 `Enemy.take_damage()`（`enemies/enemy.gd`）直接扣血。
- 视觉动画通过 `combat.fired`、`reload_started`、`reload_finished` 消费战斗结果；动画不反向造成伤害。

结论：当前架构对基础枪械和短周期 Demo 足够清晰，但“命中判定、伤害计算、效果应用、表现通知”仍集中在一次同步调用中，尚未形成可扩展的战斗事件边界。

## 2. 当前攻击流程

```text
玩家输入或自动目标
        │
        ├─ 自动：Survivor.tick()
        │          └─ Mission.choose_target()
        └─ 手动：SquadInput / aim_fire.fire()
                   └─ Mission.command_aim()
        │
        ▼
Mission.attack() 或 AimFire.fire()
        │
        ▼
WeaponCombatController.try_attack(member, mission, point, target?)
  ├─ 状态门禁：死亡、登车、搜索、冷却、换弹
  ├─ 目标门禁：active、实例有效、Mission._can_hit()
  ├─ 方向/近战距离/弹药校验
  ├─ 消耗 1 发弹药，设置冷却
  └─ _resolve()
       ├─ 生成 pellet 射线/近战目标
       ├─ 遍历 Mission.enemies
       ├─ 几何半径 + line_clear() 命中判断
       ├─ 按距离排序并截取 penetration + 1
       ├─ Mission.damage_to(member, enemy)
       │    └─ TraitRuntime.damage_amount()
       │    └─ effects.outgoing_damage()
       ├─ enemy.take_damage(damage) 直接扣血
       ├─ 同步计算并应用击退
       ├─ Visuals.tracer()、Mission.sound.play_cue()
       └─ 发出 fired(pellets)
               │
               ├─ SurvivorWeaponAnimationBridge：开火动画/枪口闪光
               └─ WeaponCombatController 测试：弹药、伤害、命中断言

命中后的当前终点是 `Enemy.take_damage()`；没有独立 Damage Event、Hit Event 或状态效果分发层。
```

### 步骤与数据流

| 步骤 | 文件/函数 | 输入 | 输出 |
| --- | --- | --- | --- |
| 输入/自动选择 | `survivors/survivor.gd:tick`、`missions/mission.gd:choose_target`、`survivors/aim_fire.gd:fire` | 玩家指令、队员状态、敌人列表 | 目标或瞄准点 |
| 攻击门禁 | `weapons/weapon_combat_controller.gd:try_attack` | Member、Mission、Point、Target | 是否开火；冷却/弹药更新 |
| 命中解析 | `WeaponCombatController:_resolve` | WeaponDefinition、队员位置、敌人、地图 line_clear | pellets、impacts |
| 伤害计算 | `missions/mission.gd:damage_to` | 武器伤害、Trait、距离、目标标签、主动效果 | 单个最终伤害数值 |
| 受伤应用 | `enemies/enemy.gd:take_damage` | float damage | HP、死亡状态、碰撞禁用 |
| 附带表现 | `NoiseSystem:emit_weapon`、`Visuals.tracer`、`Soundscape:play_cue`、动画 bridge | 武器和开火结果 | 噪声、曳光、音效、动画 |

## 3. 当前优势

1. **攻击入口统一**：自动攻击、集火和手动指向不复制战斗逻辑，均复用 `try_attack()`。
2. **数据与实例边界正确**：共享 `WeaponDefinition` 不被实例 modifier 污染；UID 保证同型号武器仍是不同个体。
3. **命中结果可测试**：`last_pellets` 和 `fired` 明确暴露弹丸与射击次数；现有测试覆盖霰弹多目标、穿透、击退、弹药、换弹和动画不重复造成伤害。
4. **视觉不阻断战斗**：WeaponVisualController 对空模型、空骨架和无效模型安全回退；战斗不依赖视觉模型存在。
5. **地图遮挡已有统一边界**：角色目标筛选与武器射线都使用 `city.line_clear()`，不会把穿墙命中当作正常行为。
6. **角色能力已有稳定注入点**：`Mission.damage_to()` 和 `TraitRuntime` 已承载距离、标签、主动效果和被动效果修正，没有按角色名字硬编码。
7. **性能路径可理解**：当前即时命中避免了大量 Projectile 节点、物理体和生命周期管理，适合当前小型城区战斗切片。

## 4. 当前限制

### 4.1 命中与伤害耦合

`_resolve()` 同时完成射线生成、目标排序、伤害计算、扣血、击退、tracer 和音效。这使得以下能力难以独立加入：

- Projectile 飞行期间改变目标或被障碍拦截；
- 弹射需要在一次命中后生成下一段轨迹；
- 爆炸需要以命中点为中心查询多个目标；
- 元素效果需要在扣血后附加状态且有持续时间；
- 暴击需要记录“本次命中是否暴击”，而不是只留下一个 float。

### 4.2 没有 Damage Event / Hit Event

当前命中直接走：

```text
mission.damage_to(...) -> enemy.take_damage(float)
```

`Enemy.take_damage()` 只接收数值，没有来源、伤害类型、方向、暴击、穿透序号或状态效果上下文。敌人无法基于伤害来源做抗性、受击反应、仇恨、元素免疫或特殊死亡效果；命中后的扩展只能继续向 `_resolve()` 塞条件分支。

### 4.3 即时命中不是 RayCast/Projectile/Area 节点

当前系统不是 Godot `RayCast3D` 节点驱动，也不是 `Area3D` 查询，更不是 Projectile 实体。它是手写的：

- 敌人中心/碰撞半径几何判定；
- `city.line_clear()` 遮挡判定；
- 命中后直接改变 HP 和位置。

这对当前固定速度、无飞行时间的枪械足够稳定，但无法表达子弹速度、追踪、延迟命中、弹道生命周期、碰撞层交互或可被拦截的飞行物。

### 4.4 伤害模型缺少扩展维度

`WeaponDefinition` 当前没有 `damage_type`、暴击率/倍率、元素、爆炸半径、弹射次数、Projectile 速度、效果列表等字段。`WeaponModifiers` 只有 6 个数值操作，modifier 也仍是代码字典，不是独立内容 Resource。

### 4.5 弹药语义不完整

当前弹匣耗尽后经过 `reload_time` 直接补满，没有备弹消耗。对 Roguelite 的搜刮压力、弹药资源、武器稀缺性和特殊武器成本，尚未形成完整经济闭环。

### 4.6 命中表现与战斗结果部分分离

`fired` 触发长枪动画和枪口闪光，但 `pellets` 只作为数组结果；没有“每个命中事件”的独立信号。因此未来按命中点生成爆炸、元素 VFX、伤害数字或受击动画时，需要重新定义输出契约。

## 5. 是否需要 HitEvent 层

结论：**需要；应作为下一阶段的最小架构改造，当前阶段不实施。**

### 5.1 推荐定位

HitEvent 不应替代 WeaponCombatController，也不应成为全局消息总线。它应该是一次具体命中的不可变/只读数据包，先由 CombatController 产生，再由伤害解析器、效果系统、表现系统按需消费。

建议字段：

```text
HitEvent
- source        : Node / source instance id
- weapon_id     : weapon definition id
- weapon_uid    : weapon instance id（可选但推荐）
- target        : Node / target id
- hit_position  : Vector3
- direction     : Vector3
- base_damage   : float
- damage        : float
- damage_type   : enum/string（physical、fire 等）
- critical      : bool
- penetration_index : int
- knockback    : float/enum
- status_effects : Array/Effect payload
- hit_kind      : enum（direct、projectile、explosion、bounce）
```

### 5.2 最小职责边界

推荐未来链路：

```text
WeaponCombatController
  -> HitResolver（即时命中或 Projectile 命中）
  -> HitEvent
  -> DamageResolver / EffectResolver
  -> Target.apply_hit(HitEvent)
  -> Presentation / Noise / Combat Log
```

`Enemy.take_damage(float)` 可以在过渡期保留为兼容入口，但新战斗路径应逐步改为 `apply_hit(HitEvent)`；不要一次性删除已有函数，避免破坏敌人近战攻击和旧测试。

### 5.3 为什么不是只加更多参数

把 `take_damage()` 改成十几个参数会把顺序耦合、默认值和调用方判断扩散到敌人、任务、测试和特殊能力。HitEvent 把“发生了什么”封装成一个对象，能让即时命中、Projectile、爆炸和弹射共享后续伤害/状态管线。

## 6. 是否需要 Projectile 抽象

结论：**需要抽象，但不应立即把所有枪械改成 Projectile 节点。**

### 6.1 推荐两层模型

1. `AttackSpec`/`WeaponAttack`：描述一次攻击意图：来源、方向、发射数量、伤害快照、射程、穿透、效果和命中策略。
2. `Projectile`：只有需要飞行时间、可见实体、追踪、反弹或延迟爆炸的攻击才实例化。

即时命中武器仍可走：

```text
AttackSpec -> InstantHitResolver -> HitEvent
```

投射物武器走：

```text
AttackSpec -> ProjectileFactory -> Projectile lifetime -> HitEvent
```

这样不会为当前 P9、K9、A21、S12、H7 强行制造大量节点，也不会把性能成本提前支付。

### 6.2 Projectile 最小接口

未来 Projectile 至少需要：

- source / weapon instance identity；
- position / velocity / lifetime；
- collision policy（敌人、世界、友军）；
- remaining penetration/bounce；
- hit policy（首次命中、穿透、爆炸、链式）；
- `on_hit(HitEvent)`；
- 可选 tracer/mesh/VFX；
- 可取消、回收或对象池化。

不要把 Projectile 直接绑定具体武器 ID；武器只提供 `AttackSpec` 和策略数据。

## 7. Roguelite 扩展建议

### 7.1 武器升级

当前 `WeaponInstance` 的 UID、rarity、modifiers 方向正确，建议保留。下一步应把现有 `WeaponModifiers.RULES` 迁移为数据驱动的升级定义，而不是马上改变战斗控制器。

建议 `WeaponModifierData` 字段：

```text
id
display_name
description
stat_operations
allowed_weapon_tags
excluded_weapon_tags
rarity
weight
max_stacks
conflicts
```

### 7.2 升级候选与随机权重

候选生成应使用可复现 RNG，并保存结果或 RNG 状态，避免读档后同一次升级出现不同候选：

```text
WeaponInstance
  -> upgrade_level
  -> modifier_ids
  -> candidate_pool_id / seed
  -> selected_modifier_id
```

建议规则：

- 候选由武器标签、已有 modifier、稀有度和升级等级过滤；
- `weight` 只用于候选抽样，不直接改变伤害；
- `max_stacks` 与 `conflicts` 在候选生成阶段处理；
- 存档保存 instance UID、定义 ID、modifier IDs、升级等级和必要的候选 seed；
- 派生 Resource 仍由 `Campaign.gear.resource()` 创建，不能修改共享模板。

### 7.3 高级能力映射

| 未来能力 | 推荐落点 |
| --- | --- |
| 暴击 | AttackSpec/HitEvent 的 crit roll 与 `critical` 字段；伤害解析器计算倍率 |
| 元素伤害 | `damage_type` + `status_effects`；目标提供状态抗性/免疫接口 |
| 爆炸 | 命中点生成 `AreaQuery`，为每个目标生成独立 HitEvent |
| 范围伤害 | 独立范围查询策略，不复用 pellet_count 伪装 |
| 弹射 | Projectile/HitResolver 持有 bounce 次数和已命中集合 |
| 特殊武器 | AttackSpec + 策略/效果数据，不在 `try_attack()` 追加武器 ID 分支 |
| 武器升级效果 | WeaponModifierData 改变 AttackSpec 或后续 HitEvent，不直接改目标 HP |

## 8. 推荐最小改造方案

本阶段不实施，仅给出下一阶段可落地的最小顺序：

### 保留

- `WeaponDefinition` 作为静态内容模板；
- `WeaponInstance` 的 UID/定义 ID/rarity/modifier 存档契约；
- `Mission.choose_target()` 与 `_can_hit()` 的队伍/地图决策职责；
- `WeaponCombatController` 的冷却、弹匣、换弹和统一攻击入口；
- 现有即时命中测试、动画测试和视觉资源。

### 新增

1. `HitEvent` 数据类或 Resource-like RefCounted（建议先用轻量 `RefCounted`，避免每次命中创建编辑器 Resource）。
2. `AttackSpec`/`WeaponAttack` 数据包，隔离一次攻击快照与 WeaponDefinition。
3. `HitResolver` 接口：先实现 `InstantHitResolver`，复用当前几何命中逻辑。
4. `Target.apply_hit(event)` 兼容入口；Enemy 内部暂时转发到旧 `take_damage()`。
5. 专用 `DamageResolver`，把 `Mission.damage_to()` 的角色/效果修正迁入可测试的事件前阶段。
6. 针对 HitEvent 的纯逻辑测试：暴击标记、穿透序号、击退方向、状态列表和重复命中去重。

### 暂不新增

- Projectile 节点和对象池；在第一种真正需要飞行时间的武器确定后再加。
- 元素/爆炸/弹射内容；先稳定事件契约。
- 新武器、新模型、新数值和特殊效果资源。

## 9. 下一阶段实施计划

### Phase 1A：事件契约

- 定义 HitEvent 和 AttackSpec 的字段、生命周期与只读约束。
- 让当前即时命中先产生 HitEvent，再由兼容适配器调用 Enemy。
- 保留 `Enemy.take_damage(float)`，完成旧测试回归。

### Phase 1B：解析职责拆分

- 从 `_resolve()` 拆出 `InstantHitResolver`。
- 从 `Mission.damage_to()` 拆出事件前伤害快照计算。
- 让击退、噪声、tracer 和音效消费攻击/命中结果，而不是散落在目标扣血循环中。

### Phase 1C：Roguelite 升级契约

- 将 modifier 规则数据化；
- 加入升级等级、候选池、权重、冲突和上限；
- 保存可复现随机状态；
- 验证装备转移、死亡、撤离、跨日和读档后的实例身份。

### Phase 2：按需求引入 Projectile

- 选择一个确实需要飞行时间的武器作为垂直切片；
- 实现 ProjectileFactory、生命周期、碰撞策略、对象池和 HitEvent 输出；
- 继续让即时命中武器走 InstantHitResolver，不做全量迁移。

### Phase 3：高级效果

- 暴击；
- 元素状态；
- 爆炸/AoE；
- 弹射；
- 特殊武器策略。

每一步都应以 HitEvent 为观察边界，并增加固定种子测试；不要在 `WeaponCombatController._resolve()` 中继续堆叠能力分支。

## 10. 最终结论

当前战斗系统已经能可靠支撑基础 Demo：自动/手动攻击统一、即时命中稳定、穿透/霰弹/击退存在、实例升级数据有存档边界，且测试覆盖较完整。

但它还不具备直接承载完整 Roguelite 战斗效果的架构余量。最关键缺口不是武器字段数量，而是缺少一次独立的“命中事实”对象和可替换的命中解析器。

建议结论：

- **HitEvent：需要，优先级 P0。**
- **Projectile 抽象：需要，优先级 P1；先抽象接口，后按具体武器引入实体。**
- **当前武器/资源/数值：保持不动。**
- **下一阶段最小改造：HitEvent + AttackSpec + InstantHitResolver + 兼容 Enemy.apply_hit。**

这条路径能保留当前武器、测试和性能特征，同时为暴击、元素、爆炸、范围、弹射、Projectile、特殊武器和 Roguelite 升级提供共同扩展边界。
