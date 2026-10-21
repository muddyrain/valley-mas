# Weapon System Design Bible v1 执行对照报告

来源附件：`C:/Users/A/Downloads/蓝时归航_Weapon_System_Design_Bible_v1.md`

本次把附件作为武器系统设计基线与现有实现对照。附件没有提供独立的代码入口、验收脚本或明确的“覆盖现有数值”指令，因此执行范围锁定为：确认已有能力、标出缺口、验证当前可用闭环，并保留现有正式玩法数值。

## 1. 当前已落地能力

### 系统定位与获取

- 武器定义与武器个体分离：`WeaponDefinition` 保存共享模板，`WeaponInstance` 保存 UID、定义 ID、稀有度和 modifier。
- 建筑搜刮、任务奖励、商店和特殊复制奖励都通过现有 Campaign/Equipment 流程产生武器实例。
- 采用无限备弹语义下的弹匣与换弹时间；攻击会消耗当前弹匣，换弹后补满，不新增弹药资源模型。
- 武器不绑定职业；角色通过默认装备、推荐标签和 Trait 产生差异。

### 第一批武器

当前注册 8 把正式定义：

`拓荒短刀、P9、R6、K9、S12、A21、H7、L56`

其中附件要求的短刀、P9、K9、A21、S12、H7 均有逻辑定义；R6 与 L56 是现有扩展池。P9、A21、短刀已有正式手持 GLB，其余定义仍允许逻辑运行时使用空模型回退。

### 数据与战斗链路

`WeaponDefinition` 当前覆盖：

- ID、显示名、类别、图标/模型路径；
- 伤害、攻速、射程、弹匣、换弹、精准度、散布；
- pellet 数量、穿透、穿透伤害倍率、击退；
- 动画 Profile、稀有度、标签和武器颜色。

战斗保持现有扩展链路：

`WeaponDefinition + WeaponInstance -> AttackSpec -> InstantHitResolver -> HitEvent -> DamageResolver -> Enemy.apply_hit()`

## 2. 与附件规格的差异

### 数值

附件中的 P9、K9、A21、S12、H7 和短刀数值与当前正式 `.tres` 不一致。例如当前 P9 为 `18 damage / 2 attacks/s / 14 range / 15 magazine`，附件写的是 `20 / 2.5 / 12 / 12`。

本次不覆盖这些数值。当前数值已经被 `weapon_system.gd`、战斗回归和实际远征捕获验证；直接替换会改变现有玩法平衡，应另开平衡变更并更新全部测试。

### 品质

附件定义五级品质：普通、优秀、稀有、史诗、传说。当前实现有四级：普通、精良、稀有、特殊，并已用于实例存档、颜色和 modifier 数量。

这是内容规则变更，不通过别名直接伪装兼容。若采纳附件五级品质，需要同步 `WeaponDefinition.Rarity`、`WeaponModifiers`、UI、生成权重、商店价格、存档迁移和测试。

### 随机词缀与升级路线

当前已有六种代码驱动的数值 modifier：伤害、攻速、弹匣、换弹、精准、射程；实例能保存 modifier ID，派生 Resource 不污染共享模板。

缺失部分：

- 独立的 `WeaponModifierData`/升级内容 Resource；
- 武器升级等级、候选权重、冲突、最大叠层和可复现候选 seed；
- P9 精准/速射路线等局内选择流程；
- 武器升级 UI 与跨日/撤离/死亡/读档回归。

附件的“升级路线”不能仅通过增加几个 `WeaponDefinition` 字段完成，必须落在 `WeaponInstance` 存档和候选选择流程上。

### 模型规范

现有正式模型遵循角色挂点与 `WeaponRoot` 兼容契约，但只有短刀、P9、A21 完成正式手持 GLB。K9、S12、H7、R6、L56 的逻辑和图标存在，模型交付仍是后续内容工作。

## 3. 当前验收

本次不修改游戏代码，仅新增本报告。现有专项测试覆盖：

- 8 把正式武器定义、字段校验、图标和模型回退；
- 武器实例 UID、装备转移、库存隔离、存档迁移；
- 弹匣、换弹、无限备弹语义；
- 短刀近战距离、S12 多 pellet、H7 穿透、击退和即时命中事件；
- Weapon -> HitEvent -> CombatVFXResolver 的既有表现链路。

此前已完成的相关验证结果：

- `tests/weapon_system.gd`：通过；
- `tests/weapon_combat_phase1a.gd`：通过；
- `tests/combat_vfx_phase1b.gd`：通过；
- 真实 Expedition combat presentation capture：`375 frames, 0 failures`。

## 4. 玩法影响

本次没有修改武器数值、武器数量、模型、Projectile、元素、暴击、AoE、弹射或升级逻辑，因此不改变当前玩家看到的武器行为，也不改变已有存档契约。

## 5. 下一步实施顺序

如果附件要从设计基线进入正式开发，建议按以下顺序单独立项：

1. 先确认附件数值是否替换现有正式数值，并建立平衡迁移清单。
2. 冻结五级品质与 modifier 数据契约，补齐武器升级等级、候选池、冲突和存档字段。
3. 完成升级选择 UI 与固定种子回归，再补 K9、S12、H7 的正式手持模型。
4. 最后再评估真正的 Projectile、元素、爆炸、弹射和特殊武器；继续复用现有 HitEvent，而不是在 `WeaponCombatController` 中增加按武器 ID 的分支。

在上述决策明确前，继续添加武器或直接替换数值会同时扩大内容、平衡和存档迁移风险。
