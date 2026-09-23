# Weapon RarityProfile Resource 化 Phase W2-2

## 1. 当前 rarity 实现

原有 WeaponDefinition rarity ordinal 为 0–3（Common / Uncommon / Rare / Special）。UI 和修饰容量依赖代码中的硬编码数组或 ordinal；WeaponInstance 继续以整数 ordinal 保存品质。Epic 对应旧的 Special ordinal 3。

本阶段将品质名称、颜色、掉落权重及修饰/特殊效果槽位移入五个 `WeaponRarityProfileData` Resource。旧 ordinal 仍是当前武器实例与存档契约，Legendary tier 4 暂不参与现有掉落和实例范围。

## 2. Resource 与 Registry

- 新增 `data/weapon_rarity_profile_data.gd`，定义 `id`、`display_name`、`color_key`、`tier`、`modifier_slots`、`special_effect_slots`、`drop_weight`、`allowed_modifier_rarity`。
- 新增 `data/weapons/rarity/{common,uncommon,rare,epic,legendary}.tres`。
- 新增 `data/weapon_rarity_registry.gd`，提供 `definitions()`、按稳定 ID / tier 查询以及重复 ID、重复/错配 tier、颜色格式、槽位合同、权重和允许 Modifier rarity ID 校验。
- 目录沿用项目已有 `data/weapons/` Resource 结构。

槽位合同为 Common `0+0`、Uncommon `1+0`、Rare `2+0`、Epic `2+1`、Legendary `3+1`。每个配置的 `drop_weight` 保持 `1.0`。ModifierData 目前没有 rarity 分类，所以 `allowed_modifier_rarity` 先作为已校验的扩展数据，不改变候选筛选。

## 3. 兼容方案

- 保留 `WeaponDefinition` 与 `WeaponInstance` 定义及存档字段；不迁移旧 ordinal。
- 注册表将旧 ID `SPECIAL` 解析为 `EPIC`，tier 3 仍解析为 Epic。
- `Equipment` 从 Profile 取掉落权重和槽位。特殊效果尚无运行时对象，本阶段以 modifier + special-effect 槽位总数保持旧 ordinal 0–3 的 Modifier 数量：0、1、2、3。
- 随机掉落仍仅在 tier 1–3 间等权抽取；Legendary profile 不加入现行随机掉落池。
- Weapon Browser 的品质名称与颜色从 Profile 读取，品质颜色值保持现有 Common / Uncommon / Rare 配色及 Epic / Legendary 设计值。

## 4. 修改文件

- `core/equipment.gd`
- `ui/weapon_browser.gd`
- `data/weapon_rarity_profile_data.gd`
- `data/weapon_rarity_registry.gd`
- `data/weapons/rarity/common.tres`
- `data/weapons/rarity/uncommon.tres`
- `data/weapons/rarity/rare.tres`
- `data/weapons/rarity/epic.tres`
- `data/weapons/rarity/legendary.tres`
- `tests/weapon_rarity_profile.gd`
- `tests/weapon_system.gd`
- `docs/PLAN.md`

## 5. 测试结果

- Godot 4.7.2 headless Resource import：通过。
- Weapon Rarity Profile：32 checks / 0 failures。
- Weapon System：474 checks / 0 failures，覆盖 Modifier 定义与计算、武器派生、旧存档和战斗行为。
- Expedition Combat Capture：375 帧、4 张截图、0 failures。为保留既有 capture，输出到 `test-output/expedition_combat_capture_w2_2/`。
- `Weapon Modifier Test` 由 Weapon System 同一回归脚本覆盖，Modifier ID、属性、倍率、候选顺序与派生武器结果均通过。
- GitNexus CLI 可运行，但 impact 索引未找到相关 GDScript 方法（risk: UNKNOWN）；使用原生引用搜索确认改动限于品质读取点和注册表。

## 6. 玩法与数据影响

没有修改武器基础数值、武器种类、存档结构或当前战斗/VFX 链路。当前掉落仍在 Common 之外的三个旧 ordinal 间等权分配，既有品质仍生成相同数量 Modifier；捕获回归通过。Legendary 是数据定义，不会在本阶段掉落。

## 7. 下一阶段建议

后续先为 `WeaponModifierData` 冻结并补齐独立 rarity 分类与允许规则语义，再使用 `allowed_modifier_rarity` 做候选过滤。之后单独设计 WeaponUpgradeData 和实例升级存档迁移；Legendary 解锁、特殊效果槽消费及掉落权重属于玩法/平衡变更，需另行验收。本报告不建议在本阶段引入这些行为。
