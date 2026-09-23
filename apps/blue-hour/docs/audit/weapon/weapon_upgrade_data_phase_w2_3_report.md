# Weapon UpgradeData + Upgrade Candidate Phase W2-3

## 1. WeaponUpgradeData 设计

新增 `WeaponUpgradeData` Resource，字段为 `id`、`weapon_id`、`level`、`name`、`description`、`upgrade_type`、`modifier_additions`、`stat_changes`、`requirements`、`weight`、`conflict_group`。为衔接 Phase 1 冻结契约，Resource 同时暴露 `upgrade_level` 与 `options` 兼容属性，分别映射 `level` 与 `modifier_additions`；不重复存储两份数据。

`upgrade_type` 支持武器专属、通用和路线升级；通用项必须使用 `weapon_id="*"`。数据校验 canonical weapon ID、modifier ID、stat schema、有限正权重和 requirement typed payload。支持的 requirement kind 为 `HAS_MODIFIER`、`HAS_TAG`、`RARITY_AT_LEAST`、`UPGRADE_LEVEL_EQUALS`，未知 kind 或额外 payload 会被拒绝。

新增 `WeaponUpgradeRegistry` 管理稳定 ID 和配置验证。`data/weapons/upgrades/` 中有附件给出的三个 P9 Level 2 数据样例：精准强化（伤害 ×1.15、精准度 ×1.20）、快速射击（攻速 ×1.25）、扩容弹匣（弹匣 ×1.40）。这些是候选预览数据，不会应用到 WeaponDefinition 或战斗。

## 2. WeaponInstance 扩展规划

本阶段没有修改 `WeaponInstance` 字段或 `to_dict()/from_dict()`。后续规范字段依照冻结契约规划：

| 字段 | 默认/用途 |
| --- | --- |
| `level` | 新实例为 1，最大 3 |
| `upgrade_history` | 已确认的候选、选择、seed 与 UpgradeData ID |
| `seed` | 从 run seed 和 weapon UID 稳定派生并持久化 |
| `pending_upgrade` | 未确认 offer 的等级、候选 ID、seed 与配置 ID |
| `instance_schema` | 缺省旧实例为 0，新实例 schema 1 |

字段命名遵循已冻结契约的单数 `pending_upgrade`，没有采用附件中未冻结的 `pending_upgrades[]`。持久化仍沿用 `uid/kind`，内存 `weapon_id` 不与 `kind` 双写。

## 3. UpgradeCandidateGenerator

新增 `UpgradeCandidateGenerator.generate()`，接收当前 WeaponInstance、匹配的 WeaponDefinition、RarityProfile、当前等级、候选资源、显式 RNG 和已占用 conflict group。只返回候选数据，不修改实例或 Definition。

生成时要求 instance 与 definition 身份一致，并只检查下一等级；再过滤 weapon-specific/general 范围、要求的 modifier/tag/rarity/current level、已有 modifier 的 max stack 与 tags、已占用 Modifier/upgrade conflict group，以及 rarity profile 的 special-effect slots。通过权重无放回选取，数量上限默认 3，资源不足时返回实际数量。候选权重为 `WeaponUpgradeData.weight`，对每个 `modifier_additions` 再乘相应 `WeaponModifierData.rarity_weight`；纯 stat preview 候选使用自身权重。

Generator 可通过 modifier additions 引用后续 `SPECIAL` Modifier，且会检查 Epic / Legendary special-effect 槽位。当前没有 SPECIAL Modifier 内容，也没有升级确认/应用事务、Level 3 样例或 UI。

## 4. 存档影响

`WeaponInstance` 和 Campaign 仍为 v5；未修改 `SaveStore`、迁移逻辑和任何存档写入点。日后真正落字段时需要 Campaign v5→v6 迁移，递归覆盖 `inventory`、`shop`、`day_rewards`、`pending`、`history`、装备复制奖励及待确认升级；为 v5 增加备份白名单、fixture 与 `.v5.bak` 验证。legacy 武器需保留 UID、kind、rarity、modifiers、affix，不重抽内容。

## 5. 修改文件

- `data/weapon_upgrade_data.gd`
- `data/weapon_upgrade_registry.gd`
- `data/weapons/upgrades/p9_precision_upgrade.tres`
- `data/weapons/upgrades/p9_fire_rate_upgrade.tres`
- `data/weapons/upgrades/p9_magazine_upgrade.tres`
- `weapons/upgrade_candidate_generator.gd`
- `tests/weapon_upgrade_candidates.gd`
- `run.ps1`（接入 test/build 专项）
- `docs/PLAN.md`

## 6. 测试与限制

- `tests/weapon_upgrade_candidates.gd`：35 checks / 0 failures。
- `tests/weapon_system.gd`：474 checks / 0 failures。
- `tests/weapon_rarity_profile.gd`：32 checks / 0 failures。
- `tests/expedition_combat_capture.gd`：375 帧、4 张截图、harness failure 列表 0；输出位于 `test-output/expedition_combat_capture_w2_3/`。
- 全项目 Godot 4.7.2 `import` 被工作区现有 `ui/expedition/minimap.gd:576` 的 `_draw_survivor_marker()` 参数数量错误阻断。
- Expedition capture 日志包含重复 `instance_set_transform` 非有限向量错误及 `expedition_camera.gd:43` 方向退化警告。Capture 进程完成，但截图不能标记为干净视觉通过；这些脚本不属于本阶段改动范围。
- GitNexus CLI impact/context 对 GDScript 符号返回 not found / risk UNKNOWN。原生引用检查发现 Campaign v5 武器数据嵌套在多个状态分支，故本阶段不触碰实例存档和 Campaign。

## 7. 后续实现顺序

1. 修复并通过独立 Expedition/MiniMap 门禁，再重新检查 capture 的非有限 transform 与镜头方向。
2. 冻结 SPECIAL Modifier 的 stat/effect schema 及 rarity 分类，并补足 Registry 验证。
3. 冻结升级确认事务、候选快照/重抽版本策略和种子派生算法，再实施 Campaign v6 递归迁移及 v5 备份兼容。
4. 接入等级推进和候选选择流程；最后制作升级 UI，并补跨撤离、死亡、存读档和兼容性回归。
