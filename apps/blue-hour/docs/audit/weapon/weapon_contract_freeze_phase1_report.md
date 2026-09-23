# Weapon Contract Freeze Phase 1

冻结日期：2026-09-23

## 1. 范围与当前契约

本阶段冻结后续 subtype、ModifierData、UpgradeData、WeaponInstance 扩展和 rarity/save migration 的契约。它是设计输出，不新增 Resource 脚本或 `.tres` 内容，不修改 WeaponDefinition、WeaponInstance、存档、武器数值、UI、HitEvent、CombatVFXResolver 或战斗流程。

当前主链路保持：

```text
WeaponDefinition + WeaponInstance
  -> AttackSpec
  -> InstantHitResolver
  -> HitEvent
  -> DamageResolver
  -> Enemy.apply_hit()
  -> CombatVFXResolver
```

当前实现证据：

- `data/weapon_data.gd` 有 `WeaponType { MELEE_SHORT, SIDEARM, LONG_GUN }` 和 `Rarity { COMMON, UNCOMMON, RARE, SPECIAL }`。
- `weapons/weapon_instance.gd` 序列化键为 `uid / kind / rarity / modifiers / affix`；内部以 `instance_id / weapon_definition_id` 表示身份。
- `core/equipment.gd` 当前允许 rarity `0..3`，并按 rarity 数值抽取不重复 modifier。
- Campaign 存档当前为 v5；`SaveStore` 只为 v1-v4 创建版本备份。

三份输入基准均已读取自 Downloads。当前正式武器数值的唯一事实源继续采用 Balance Sheet 指定的项目 `.tres`；Design Bible 中不同数值视为提案/设计样例，不能自动覆盖正式参数。

## 2. Weapon Subtype 契约

新增 subtype 的未来 API 名称冻结为 `WeaponSubtype`，语义值如下。实现时可用 Godot enum 表示，但持久化或跨资源边界优先用稳定的 ID；显示文案不作为身份值。

| 稳定 ID | 语义 |
| --- | --- |
| `MELEE` | 近战武器 |
| `HANDGUN` | 手枪/左轮 |
| `SMG` | 冲锋枪 |
| `RIFLE` | 步枪/轻机枪等长枪基础分类 |
| `SHOTGUN` | 霰弹枪 |
| `SNIPER` | 狙击/精确步枪 |

兼容规则：

- 保留现有 `weapon_type`，不删除、不重命名；它继续表示已有的装备/动作大类，并供旧消费者读取。
- 新 `weapon_subtype` 承担内容分类、升级过滤、掉落/UI 筛选语义；`animation_profile` 继续只负责表现姿势，不从 subtype 推导或替代。
- 旧类型只可推导粗分类：`MELEE_SHORT -> MELEE`、`SIDEARM -> HANDGUN`；`LONG_GUN` 无法区分 SMG、RIFLE、SHOTGUN、SNIPER，不能靠旧 enum 单独推导。
- 现有定义迁移必须按 canonical weapon ID 显式映射，不按注册数组位置或显示名称绑定：

| 当前武器 ID | 旧 WeaponType | 冻结 subtype |
| --- | --- | --- |
| `WPN_001_SURVIVAL_KNIFE` | `MELEE_SHORT` | `MELEE` |
| `WPN_002_P9_PISTOL` | `SIDEARM` | `HANDGUN` |
| `WPN_003_R6_REVOLVER` | `SIDEARM` | `HANDGUN` |
| `WPN_004_K9_SMG` | `LONG_GUN` | `SMG` |
| `WPN_005_S12_SHOTGUN` | `LONG_GUN` | `SHOTGUN` |
| `WPN_006_A21_ASSAULT_RIFLE` | `LONG_GUN` | `RIFLE` |
| `WPN_007_H7_HUNTER_RIFLE` | `LONG_GUN` | `SNIPER` |
| `WPN_008_L56_LMG` | `LONG_GUN` | `RIFLE`，保留 `lmg` 内容 tag |

未知 legacy 定义必须显式登记或报告无 subtype；不得默认为某个 subtype。此阶段没有修改 `WeaponDefinition` 或八个 `.tres`。

## 3. ModifierData 契约

未来 `WeaponModifierData extends Resource` 是一个 modifier 的只读内容定义，不是武器个体的运行状态。冻结字段：

| 字段 | 类型 | 约束与语义 |
| --- | --- | --- |
| `id` | `String` | 稳定、全局唯一 ID；实例只保存此 ID |
| `name` | `String` | 非空显示名 |
| `description` | `String` | 描述实际效果及单位 |
| `category` | `Category` enum | `STAT / MECHANIC / SPECIAL`；仅用于分类/过滤，不直接决定平衡值 |
| `target_stat` | `StringName` | 稳定目标键；普通属性 modifier 必填，Special 可留空并使用 `effect_id` |
| `operation` | `Operation` enum | `ADD / MULTIPLY / SET`，明确 `value` 的运算方式 |
| `value` | `float` | 运算数值；百分比乘数采用比率，如 `1.15` 表示 +15%，`0.85` 表示 -15% |
| `rarity_weight` | `float` | 候选池相对权重；必须有限且大于 0。它不是武器品质掉落率 |
| `max_stack` | `int` | 正整数；同一 modifier ID 的持有数量上限 |
| `conflict_group` | `StringName` | 空表示无组冲突；相同非空组至多选择一个 modifier |
| `weapon_tags` | `Array[String]` | 空表示不限武器；非空时要求武器具备列出的全部 tags |
| `effect_id` | `StringName` | 可选扩展；仅 `MECHANIC / SPECIAL` 使用，引用效果契约，不放置 Node 或具体目标引用 |

`target_stat` 使用稳定字段 ID（例如 `damage`、`attack_rate`、`magazine_size`、`reload_time`、`accuracy`、`range`、`penetration`、`knockback`、`pellet_count`），不使用本地化名称。属性单位和 operation 由 stat schema 校验。候选生成先按 subtype/tags、rarity 门槛、requirements、max stack 和 conflict group 过滤，再按权重抽取。

`WeaponInstance.modifiers` 继续保存 modifier ID 字符串，不存第二份 name/stat/value 快照；因此修改 ModifierData 的 value 会影响所有引用该 ID 的既有武器。此内容更新策略是本契约的明确选择，后续平衡更新必须作为全局规则变更验收。

## 4. UpgradeData 契约

未来 `WeaponUpgradeData extends Resource` 表示一个武器/等级的候选池配置：

| 字段 | 类型 | 约束与语义 |
| --- | --- | --- |
| `id` | `String` | UpgradeData 配置自身稳定 ID |
| `weapon_id` | `String` | canonical WeaponDefinition ID；`*` 表示通用池 |
| `upgrade_level` | `int` | 选择后到达的等级；当前设计冻结 Level 1 起始，Level 2、Level 3 可升级 |
| `options` | `Array[String]` | ModifierData ID 候选池；所有 ID 必须可解析且在该武器上可用 |
| `weight` | `float` | 此候选池参与同 weapon/level 池合并抽取时的相对权重，有限且大于 0 |
| `requirements` | `Array[Dictionary]` | 内容条件列表；每项必须带稳定 `kind`，按白名单验证其 typed payload |

同一 weapon/level 可有多个 UpgradeData 池。过滤出满足条件的池后，单个 modifier 的有效抽取权重为 `UpgradeData.weight * WeaponModifierData.rarity_weight`；对候选按权重无放回抽取，最多产生 3 个。候选不足 3 个时展示实际数量，不重复填充。requirements 至少支持 `HAS_MODIFIER`、`HAS_TAG`、`RARITY_AT_LEAST`、`UPGRADE_LEVEL_EQUALS`，未识别 kind 视为无效数据。

候选 UI 只消费候选 ID、说明和预览，不直接改 WeaponDefinition 或目标 HP。确认升级是一次存档事务：检查 Weapon UID 和等级仍匹配、检查 max stack/conflict，追加一个 Modifier ID、增加等级、追加 history 并清除 pending offer；任何一步失败都不保存部分状态。

## 5. WeaponInstance 扩展契约

未来的规范内存字段和存档语义：

| 字段 | 类型 | 默认/规则 |
| --- | --- | --- |
| `uid` | `String` | 保持当前稳定武器个体 ID；内部 `instance_id` 可作兼容属性 |
| `weapon_id` | `String` | canonical WeaponDefinition ID；当前序列化 `kind` 保持兼容，不重复保存两个定义 ID |
| `rarity` | `int` | 稳定 rarity ordinal，见第 7 节 |
| `modifiers` | `Array[String]` | ModifierData ID；允许重复至该 ID 的 `max_stack` |
| `level` | `int` | 新获取武器为 1，当前上限 3 |
| `upgrade_history` | `Array[Dictionary]` | 每次已确认升级一条：`level`、`candidate_ids`、`selected_id`、`seed`、`upgrade_data_id` |
| `seed` | `int` | 每把武器个体稳定的非负 seed；创建时由 run seed 与 UID 确定性派生并保存 |
| `pending_upgrade` | `Dictionary` | 空表示无待选；否则保存 `level / candidate_ids / seed / upgrade_data_id`，读档后原样恢复候选 |
| `instance_schema` | `int` | 实例数据契约版本；旧存档缺字段视为 legacy schema 0，新实例使用 schema 1 |

字段命名的规范 API 用 `uid / weapon_id`；为兼容当前存档，v6 迁移前持久化键继续用 `uid / kind`，`kind` 不与 `weapon_id` 双写。modifier 只保存 IDs；升级历史保存玩家已见候选与最终选择；pending offer 在选择提交前保存，避免读档时换候选。`seed` 的派生算法必须有版本号或固定算法测试，避免升级后重抽结果改变。

## 6. 存档影响与迁移

当前 Campaign v5 接受 v2-v5 状态，武器字典可出现在：

- `inventory`：拥有武器个体；
- `equipment`：成员到武器 UID 的映射，不是定义副本；
- `shop`、`day_rewards`：每日商店与固定奖励；
- `pending`、`history`：待结算和结算历史中的奖励武器；
- 复制奖励及未来 pending upgrade 数据。

后续实现若加入实例字段，应将 Campaign 升到 v6，并在恢复时递归迁移所有嵌套武器字典。v5 legacy item 补默认 `level=1`、`upgrade_history=[]`、稳定派生 `seed`、空 `pending_upgrade`、`instance_schema=0`；保留 UID、定义 ID、现有 modifier 和 affix，不重抽内容。新建实例采用 `instance_schema=1`。

当前 `SaveStore` 的自动备份白名单只有 v1-v4；Campaign 升 v6 前必须将 v5 加入迁移备份覆盖，并新增 v5 fixture，验证 `.v5.bak` 保留原文、读档后所有武器实例身份/词条/位置不变。升级确认时必须先构造并验证完整副本，再一次性写入，避免半写入存档。

## 7. 品质系统与迁移方案

冻结 ordinal，不插入和重排旧值：

| ordinal | 目标 ID | 英文名 | 中文名 | UI 色向 |
| --- | --- | --- | --- | --- |
| 0 | `COMMON` | Common | 普通 | 白/浅灰 |
| 1 | `UNCOMMON` | Uncommon | 优秀 | 绿 |
| 2 | `RARE` | Rare | 稀有 | 蓝 |
| 3 | `EPIC` | Epic | 史诗 | 紫 |
| 4 | `LEGENDARY` | Legendary | 传说 | 橙 |

旧 `SPECIAL=3` 保留 ordinal 3 并迁移为 `EPIC=3`；`LEGENDARY=4` 只追加。旧档保存的是整数而不是名称，所以不得把旧值 3 重解释为 Legendary。旧 Special 实例已有的 modifier IDs 原样保留，以 `instance_schema=0` 作为 legacy composition，不能因新 Epic slot 规则强行删词条或重抽。

品质不再直接等于 modifier 数量。品质定义的内容槽位冻结为：Common 0 个；Uncommon 1 个基础 modifier；Rare 2 个基础 modifier；Epic 2 个基础 modifier + 1 个 Special modifier；Legendary 2 个基础 modifier + 1 个签名 Special modifier。传奇差异由签名机制内容表达，不通过无限增加数值词条表达。实现时通过 rarity profile 提供 `id / display_name / color / drop_weight / modifier_slots`，不再让 enum ordinal 同时承担显示、掉落权重和 modifier 数量策略。

当前 UI 的四项 `RARITY_NAMES / RARITY_COLORS` 数组需迁移为按稳定 rarity ID 查询 profile；Epic 紫色、Legendary 橙色。modifier 候选的 `rarity_weight` 只参与已过滤的 modifier 抽样；武器品质掉落使用 rarity profile 的独立 `drop_weight`。新权重数值属于平衡，不在本冻结报告中设定。Trait 的 `minimum_rarity` 也按冻结 ordinal 检查，需验证阈值迁移。

## 8. 后续实现顺序

1. 新增 subtype 字段与显式 canonical ID 兼容映射；只补数据分类，不改旧 `weapon_type` 和 `animation_profile` 行为。
2. 新增 `WeaponModifierData` 类型和内容加载/唯一 ID 校验；先将现有六条规则以等价数据表达，确认行为测试不变，再让 `Equipment` 读取 Resource。
3. 新增 `WeaponUpgradeData` / rarity profile 数据与校验；本轮不批量填特殊 modifier 内容。
4. 实现 WeaponInstance 新字段及 Campaign v5→v6 迁移，先补 backup、失败回滚和嵌套存档 fixture。
5. 实现固定 seed 候选生成和事务式选择，然后接升级 UI；保持 `WeaponDefinition` 模板隔离与现有 HitEvent 链路。
6. 通过固定 seed 战斗回归确认 modifier、品质、穿透、S12 pellet 和存档后属性；再制作内容和调整 drop balance。

## 9. 本次执行结果

- 新增本报告与项目交付记录，并在 `docs/PLAN.md` 登记“契约已冻结、尚未实现”的状态；没有改 `.gd`、`.tres`、场景、UI、存档、武器数值或战斗表现。
- GitNexus 索引状态 up-to-date；`query weapon` 返回相关文件但没有 execution process，GDScript 类级关系仍以源码为准。
- 编码检查、空白检查和 `git diff --check` 通过（见交付记录）；本阶段是文档契约冻结，不运行 Godot build。下一阶段代码实施前需运行武器与存档迁移专项测试。
