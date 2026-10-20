# Weapon Data Contract Audit

审计日期：2026-09-23

范围：WeaponDefinition、WeaponInstance、Modifier、武器升级、品质、相关 UI / 掉落 / 商店 / 存档契约。
基准：`蓝时归航_Weapon_System_Design_Bible_v1.md`、`蓝时归航_Weapon_Balance_Sheet_v1.md`、`蓝时归航_Weapon_Modifier_Upgrade_System_Design_v1.md`。三份输入均来自 `C:/Users/A/Downloads/`；本报告没有把附件文本复制成仓库设计真源。

## 1. 当前架构

静态武器模板与拥有中的武器个体分开：

```text
WeaponDefinition (.tres)
  -> WeaponInstance (Campaign inventory Dictionary / UID)
  -> Equipment.resource() 派生模板副本并应用 modifiers
  -> AttackSpec
  -> InstantHitResolver
  -> HitEvent / DamageResolver
  -> Enemy.apply_hit()
  -> CombatVFXResolver
```

8 个定义由 `WeaponRegistry.definitions()` 注册。`WeaponInstance` 持久化为普通字典，装备槽引用 UID；商店、日奖励、待结算和历史结果都存储武器字典。设计要求的基础攻击事件链已经存在，但武器成长只实现了品质与基础数值 modifier，没有局内武器等级、候选选择或升级历史。

## 2. WeaponDefinition 字段审计

定义类型位于 `data/weapon_data.gd`。`@export` 字段由 `.tres` 作为内容真源；括号内是 GDScript 类型。

| 设计字段 | 当前字段 | 类型/语义 | 主要使用位置 | 状态 |
| --- | --- | --- | --- | --- |
| id | `id` | `String`，稳定定义 ID | `data/weapon_registry.gd` 注册；`data/catalog.gd`、`core/equipment.gd` 查找 | 满足 |
| display_name | `display_name` | `String` | `ui/weapon_browser.gd`、`core/equipment.gd` 标题 | 满足 |
| category | `weapon_type` | `WeaponType` enum：`MELEE_SHORT / SIDEARM / LONG_GUN` | `melee` getter、动作 Profile、图鉴分类 | 字段存在但分类粒度不足；不能表达 Handgun / SMG / Rifle / Shotgun / Sniper 的完整内容类型 |
| icon_path | `icon_path` | `String`，`@export_file("*.png")` | `WeaponDefinition.icon()`、武器图鉴/库存 | 满足；定义校验要求路径存在 |
| model_path | `model_path` | `String`，`@export_file("*.glb")` | `WeaponVisualController` 加载手持模型 | 字段存在；空路径允许逻辑武器回退，未作为必填资源校验 |
| damage | `damage` | `float`，基础单次/单弹丸伤害 | `AttackSpec`、`Mission.damage_to()`、`InstantHitResolver` | 满足 |
| attack_speed | `attack_rate` | `float`，单位为每秒攻击次数 | `WeaponCombatController` 冷却；图鉴显示“次/秒” | 满足语义；字段名不同。派生别名 `cooldown = 1 / attack_rate` 是秒/次 |
| range | `range` | `float`，世界单位攻击距离 | `AttackSpec`、即时命中和攻击门禁 | 满足 |
| magazine | `magazine_size` | `int`，弹匣容量；另有 `magazine` 别名 | 控制器弹药/换弹、HUD | 满足；近战为 0 |
| reload_time | `reload_time` | `float`，秒 | 控制器换弹；图鉴 | 满足；近战为 0 |
| accuracy | `accuracy` | `float`，0–1 | 即时命中散布计算、图鉴百分比 | 满足 |
| spread | `spread_angle` | `float`，角度；注释定义为完整锥角 | `InstantHitResolver` | 满足；字段名与设计表不同 |
| projectile / pellet | `pellet_count` | `int`，一次攻击生成的射线/弹丸数 | `AttackSpec`、即时命中、霰弹测试 | 仅 pellet 满足；没有 Projectile 类型、速度、生命周期或实体契约 |
| penetration | `penetration` | `int`，额外可命中目标数 | 即时解析器、H7 回归 | 满足 |
| penetration damage multiplier | `penetration_damage_multiplier` | `float` | `AttackSpec` 和后续穿透命中伤害 | 满足 |
| knockback | `knockback` | `Knockback` enum：`NONE / LIGHT / MEDIUM / HIGH` | `AttackSpec`、控制器位移、命中表现 | 满足 |
| animation profile | `animation_profile` | `WeaponType` enum | `WeaponVisualController` / 武器动画桥 | 满足；与装备类别共用同一枚举，类型概念耦合 |
| rarity | `rarity` | `Rarity` enum，整数序号 0–3 | 基础模板默认值；实例派生时覆盖；图鉴颜色与名称 | 字段存在；拥有个体的权威品质在 `WeaponInstance.rarity` |
| tags | `tags` | `Array[String]` | Trait/战斗筛选等内容消费者 | 可存储；没有统一 tag 枚举或完整词典校验，当前值混用 `ranged`、`shotgun_spread` 等行为标签 |

模板额外字段：`description:String`、`move_speed_modifier:float`、`color:Color`、`sound_pitch:float`。这些字段分别用于说明、移动、Tracer/Muzzle 表现和音效。兼容视图包括 `attack_range`、`magazine`、`reload_seconds`、`melee`；不应在未来再持久化一份同义字段。

缺失于 WeaponDefinition 的未来扩展字段包括：武器细分分类 ID、WeaponData 独立引用策略、Projectile 策略/速度、特殊机制 ID、基础 damage type、升级树/升级池引用。它们是否应进入模板要按内容消费方式决定，不能仅因设计文档列出就全部加字段。

## 3. WeaponInstance 审计

当前定义位于 `weapons/weapon_instance.gd`，类型为 `RefCounted`：

| 能力 | 当前实现 | 结论 |
| --- | --- | --- |
| UID | `instance_id:String`；存档键为 `uid` | 满足，同型号个体可区分 |
| WeaponDefinition reference | `weapon_definition_id:String`；存档键为 `kind`，经 Registry 规范化 | 以稳定 ID 引用，不持有 Resource 指针，适合存档 |
| rarity | `rarity:int`，有效范围 0–3 | 满足当前四级品质 |
| modifiers | `Array[String]` modifier ID | 满足基础 ID 持久化；无数值快照或 modifier schema 版本 |
| upgrade state | 无 `level`、`upgrade_history`、选项/选择记录 | 缺失 |
| seed | 个体无 seed | 缺失；生成函数接收外部 RNG，当前确定性由调用方 seed 保证，选出的 modifier ID 本身会保存 |
| legacy affix | `legacy_affix:String`，存档键 `affix` | 仅用于旧档兼容，和新 Modifier ID 并存 |

`to_dict()` 当前序列化 `{uid, kind, rarity, modifiers, affix}`。Campaign 状态版本当前为 v5。`_normalize_weapons()` 会递归规范化嵌套存档里的武器字典，但不会为武器升级字段补迁移语义。

## 4. Modifier 系统审计

当前 `WeaponModifiers.RULES` 是 GDScript 常量字典，不是 `ModifierData Resource`。每项包括：

- modifier ID；
- UI label；
- 作用字段 `stat`；
- 固定乘数 `factor`，可视为当前实现的数值操作。

现有 6 项为伤害、攻速、弹匣、换弹、精准和射程。缺口如下：

| 目标契约 | 当前状态 |
| --- | --- |
| 独立 ModifierData Resource | 缺失；规则在 `weapons/weapon_modifiers.gd` 常量中 |
| modifier id | 已有字符串 ID，gear 校验 ID 合法且当前实例不允许重复 |
| name / description / category | 只有展示 label；没有独立 description/category 字段 |
| value | `factor` 存在，但操作 stat 和数值被硬编码为一张规则表，不支持每个实例保存可变 value |
| rarity_weight | 缺失；Modifier 候选为均匀抽样。武器品质本身的稀有度抽样由 Equipment 处理 |
| max_stack | 没有可配置字段；通过拒绝重复 modifier ID 实现“单个 ID 不叠层” |
| conflict_group / conflicts | 缺失；不同 modifier 之间无冲突过滤 |
| weapon type/tag 限定 | 只有近战过滤规则，未使用可配置 tag include/exclude 契约 |
| 战斗机制与特殊效果 modifier | 暴击、穿甲增量、击退增量、多射、燃烧、冻结、爆炸、弹射均未由当前武器 Modifier 系统实现 |

`Equipment.create()` 按实例 rarity 的次数从当前合法列表中不重复随机选择 modifier；由于采用 `pop_at()`，当前可实现的是最多 3 项简单数值 modifier。此处不是文档建议的“候选池生成”：没有生成三个可供玩家选择的候选，也没有权重、冲突组或存档选择记录。

## 5. Upgrade 系统审计

当前武器升级能力：实例有品质和静态 modifier 列表；Weapon Browser 可显示已有 modifier；存档保留其 ID。不存在武器等级/经验、升级路线、升级历史、候选池、每次 3 选 1、候选权重、候选 seed 或武器升级 UI 接口。

需要区分 Campaign 中已有的被动/技能 `upgrade_effect()`：该操作升级 Effect，不代表 WeaponInstance 升级，不能作为武器升级已实现的证据。

未来候选生成接口至少需要明确：輸入的武器 UID/定义 ID/level/current modifiers/rarity/tags；符合候选过滤后的稳定排序或 seeded sampling；候选 ID 列表与 seed/已生成状态；玩家确认后追加 upgrade history 并原子保存。UI 只消费候选 DTO 并提交选择，不应直接编辑 WeaponDefinition 或目标 HP。

## 6. 品质差异与迁移风险

| 当前序号 | 当前名称 | 目标名称/方向 | 差异 |
| --- | --- | --- | --- |
| 0 | 普通 Common | 普通 Common | 名称/基础语义可兼容 |
| 1 | 精良 Uncommon | 优秀 Uncommon | 中文名称变化 |
| 2 | 稀有 Rare | 稀有 Rare | 可兼容 |
| 3 | 特殊 Special | 史诗 Epic | 目标新增史诗与传说两个语义层；当前序号 3 还不是“改变玩法”的传奇 |
| — | — | 传说 Legendary | 新增序号/数据，需要定义触发规则和旧档映射 |

当前序号影响面：

- `WeaponDefinition.Rarity` 与 `.tres`/存档中的整数 ordinal；
- `Equipment.valid()` 的 `0..3` 范围、`create()` clamp 和 modifier 数量上限；
- `RARITY_NAMES` / `RARITY_COLORS` 和 `weapon_browser.gd` 的数组索引；
- `Equipment.roll()` 当前只抽 1–3 级品质，Trait 最低品质规则读取整数门槛；
- Campaign 的复制奖励估价按 rarity 整数加价；商店基础价格来自 `day_loop.tres`；
- WeaponInstance 位于 inventory、equipment 引用、day_rewards、shop、pending、history 等存档结构中；
- `SaveStore` 目前只为全局状态版本 1–4 建立迁移备份，v5 升级到 v6 时需要显式扩充备份路径。

迁移不能简单把旧 `3` 解释成新 Legendary，也不能静默重新抽 modifier。建议先把旧 `SPECIAL(3)` 明确映射为 `EPIC(3 或 4)` 的兼容层，再新增 Legendary；最终 ordinal 和映射由设计确认。迁移时需递归覆盖 Campaign 中所有武器字典，保留 `uid/kind/modifiers/affix`，仅变更 rarity/schema 字段，并保留原存档备份。由于当前 weapon instance 没有独立 schema version，存档迁移应由 Campaign 全局版本承担且做到一次性。

## 7. 数据契约差异与风险

1. **设计数字源冲突。** Design Bible 列出 P9 `20 damage / 2.5/s / range 12 / magazine 12` 等数值；Balance Sheet 说明具体正式参数以 `.tres` 为准，当前正式 P9 是 `18 / 2/s / range 14 / magazine 15`。K9、A21、S12、H7、短刀也存在不同数值。应把 Balance Sheet 的“现行值来自 `.tres`”和 Design Bible 数值的“未来目标或历史提案”关系写清，否则模型、UI 和平衡验收可能引用不同版本。
2. **类别与标签没有统一词典。** 模板只区分 melee/sidearm/long gun；模型姿势 Profile 也复用这三个值。未来 UI 筛选、modifier 限定和 Blender 批量制作需要 Handgun/SMG/Rifle/Shotgun/Sniper/Melee 的稳定 subtype/tag 契约。
3. **Rarity ordinal 是存档 API。** 改名称和颜色较小，改变层级含义则会影响掉落、Modifier 数量、复制估值及旧档；Campaign v5 到 v6 的备份也必须覆盖。
4. **Modifier 目前保存操作 ID，不保存 schema/value。** 若今后调数值直接改常量，所有已有实例会立即改变效果；若希望旧武器保留获取时效果，需要 modifier content version 或数值快照。需要产品选择：modifier ID 永远引用最新版规则，还是实例锁定规则版本。
5. **随机结果可重现边界不完整。** 现有 modifier 选择结果通过 IDs 保存，已生成内容恢复稳定；重新生成候选时没有个体 seed/history。升级系统需在事务/存档中保存候选和选择，避免读档刷新候选。
6. **Definition 与 Instance 都有 rarity 字段。** 基础模板 `.tres` 默认 Common，派生模板由 Equipment 覆盖；UI 查询派生值正确。应继续把拥有个体的 rarity 视为唯一真源，避免直接在共享模板上改品质。

## 8. 推荐实施顺序

1. 冻结三个设计基准之间的优先级：`.tres` 是当前平衡真源；确认 Design Bible 数字是提案还是待替换参数。
2. 先定义稳定内容词典：weapon subtype、tag、rarity ID/ordinal、modifier category/value/unit、特殊效果与兼容规则。
3. 设计 ModifierData/WeaponUpgradeData 数据契约，确定规则版本策略、max stack、conflict、rarity weight、seed、候选保存和 upgrade history；本次不实现。
4. 定义 Campaign v6 迁移映射及 v5 备份测试，再开始升级字段实现；不要提前重排 enum。
5. 契约冻结后接入升级候选 UI 和 Weapon Browser，保留 `WeaponDefinition` 共享模板与实例派生隔离。
6. 最后执行数值平衡、掉落/商店权重、武器模型制作和固定 seed 的跨日/存档回归。

## 9. 验证与证据边界

- 当前代码基准测试：`tests/weapon_system.gd` 428 checks / 0 failures；`tests/weapon_combat_phase1a.gd` 11 checks / 0 failures。
- Balance Sheet 规定当前正式数值以 `.tres` 为准；设计基准把五级品质、ModifierData 和升级候选列为目标能力。
- GitNexus `query weapon` 返回相关文件定义但没有 execution processes；`WeaponDefinition`、`WeaponInstance` 等 GDScript 类名没有独立 symbol context。本报告的字段与消费位置依据源码/配置/测试直读，不将未返回的图谱关系当作证据。
- 本次只生成审计文档，没有修改脚本、Resource、武器数值或存档数据；不需要 Godot build、UI 截图或影响分析。
