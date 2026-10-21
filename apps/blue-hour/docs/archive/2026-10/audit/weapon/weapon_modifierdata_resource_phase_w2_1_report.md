# Weapon ModifierData Resource 化 Phase W2-1

实施日期：2026-09-23

## 1. 当前 Modifier 实现方式

原规则集中在 `weapons/weapon_modifiers.gd` 的 `RULES` 常量字典。`core/equipment.gd` 通过其 ID 列表筛选存档中的 modifier、抽取词条并对武器定义副本应用倍率；`ui/weapon_browser.gd` 直接从同一字典读取图鉴文案。Modifier ID 已保存在 `WeaponInstance.modifiers` 中，本轮保持这些 ID 和存档结构不变。

六项旧规则及效果：

| ID | target_stat | operation | value | 旧效果 |
| --- | --- | --- | ---: | --- |
| `DAMAGE_UP` | `damage` | `MULTIPLY` | 1.12 | 伤害 +12% |
| `ATTACK_SPEED_UP` | `attack_rate` | `MULTIPLY` | 1.10 | 攻击速度 +10% |
| `MAGAZINE_UP` | `magazine_size` | `MULTIPLY` | 1.25 | 弹匣容量 +25%，向上取整 |
| `RELOAD_SPEED_UP` | `reload_time` | `MULTIPLY` | 0.82 | 换弹时间缩短 18% |
| `ACCURACY_UP` | `accuracy` | `MULTIPLY` | 1.08 | 精度 +8%，上限 100% |
| `RANGE_UP` | `range` | `MULTIPLY` | 1.12 | 射程 +12% |

近战过滤仍排除弹匣、换弹和精度三项；远程武器保留全部六项。

## 2. 新增 Resource 文件

- `data/weapon_modifier_data.gd`：轻量 Resource 契约，包含 `id / name / description / category / target_stat / operation / value / rarity_weight / max_stack / conflict_group / weapon_tags / effect_id`。
- `data/weapon_modifier_registry.gd`：固定内容清单、按 ID 查询、重复 ID 检查及字段校验。
- `data/weapons/modifiers/damage_up.tres`
- `data/weapons/modifiers/attack_speed_up.tres`
- `data/weapons/modifiers/magazine_up.tres`
- `data/weapons/modifiers/reload_speed_up.tres`
- `data/weapons/modifiers/accuracy_up.tres`
- `data/weapons/modifiers/range_up.tres`

六个资源均为 `STAT / MULTIPLY`，初始 `rarity_weight=1.0`、`max_stack=1`、无 conflict group、weapon tag 和 effect ID；没有增加升级/稀有度行为或改变抽取权重。

## 3. 修改文件列表

- `weapons/weapon_modifiers.gd`：删除常量规则表作为数据事实源，保留原调用 API，改为读取 Registry Resource 并通用应用 `ADD / MULTIPLY / SET`；旧倍率所需的弹匣取整和精度钳制不变。
- `ui/weapon_browser.gd`：词条说明改从 Resource 读取；Resource 的 description 保留原标签文本，因此图鉴显示和 rarity 展示保持原样。
- `tests/weapon_system.gd`：验证 Registry 唯一性、字段约束、近战过滤、六项旧 ID/stat/倍率和最终派生数值。
- `tests/expedition_combat_capture.gd`：增加仅允许写入 `res://test-output/` 子目录的输出路径参数，以隔离方式运行 capture，保留此前同目录评审视频和帧图。
- `docs/PLAN.md`：登记 W2-1 实现、验证和标准 build 门禁状态。
- `docs/reports/2026-09-23_weapon_modifierdata_resource_w2_1_report.md`：本次交付记录。

Godot 自动生成的两个脚本 UID 文件也随新脚本登记：`data/weapon_modifier_data.gd.uid`、`data/weapon_modifier_registry.gd.uid`。

## 4. 兼容层与数据流

```text
WeaponInstance.modifiers: Array[String]
  -> WeaponModifiers.choices / has_id / apply (compatibility API)
  -> WeaponModifierRegistry.by_id
  -> WeaponModifierData Resource
  -> derived WeaponDefinition copy
```

既有 modifier ID、武器个体保存格式、Equipment 候选顺序、近战过滤、定义副本隔离和战斗消费链路保持稳定。`WeaponModifiers.RULES` 不再存在；`WeaponModifiers` 是过渡 API，所有规则字段和图鉴文案的事实源变成独立 Resource。

本阶段没有扩展 WeaponDefinition、WeaponInstance、Campaign 存档、HitEvent、DamageResolver 或 CombatVFXResolver。没有新增武器内容、修改倍率或引入新玩法。

## 5. 测试结果

- `[Windows]` Godot 4.7.2 import：PASS。
- `[Windows]` `tests/weapon_system.gd`：451 checks / 0 failures。
- `[Windows]` `tests/weapon_combat_phase1a.gd`：11 checks / 0 failures。
- `[Windows]` `tests/combat_vfx_phase1b.gd`：25 checks / 0 failures。
- `[Windows]` `tests/expedition_combat_capture.gd`：375 帧、25 秒、4 张截图、153 HitEvent、0 failures；隔离输出位于 `test-output/weapon_modifier_resource_capture/`。
- `[Windows]` `encounter_combat.gd`：10 checks / 1 failure，现有 “Natural first shot occurs 5-15 seconds after arrival” 实际为 0.00 秒。失败发生在自动遭遇开火计时断言，本轮没有改该战斗行为。
- `[Windows]` Release 导出 `build/BlueHourHomeward.exe`：PASS；独立 headless 与 native weapon startup：PASS。
- `[Windows]` 导出包验证：56 个美术资源 headless/native 通过；内嵌包 `weapon_visuals` 与 `combat_animations` headless/native 均通过；内嵌包重新运行 `weapon_system.gd` 为 451 checks / 0 failures。
- `[Windows]` 标准 `run.ps1 build`：前置综合套件被 `tests/survivor_command.gd` 的 “Line follows the moving survivor's feet” 失败阻断，未到脚本里的正式导出步骤。随后对同一 Release preset 直接导出并完成上述独立验证，因此能确认导出包有效，但不能报告标准完整 build 流水线全绿。
- GitNexus 在本仓库索引中未解析 `WeaponModifiers` GDScript 类和这些调用方法；已用源码搜索确认直接消费方是 `core/equipment.gd` 与 `ui/weapon_browser.gd`。未运行 GitNexus `detect_changes`，本次没有提交。
- Encoding Guard 与 `git diff --check`：最终结果记于交付记录。

## 6. 下一阶段建议

先处理并单独复验现有 survivor foot-follow 与 encounter 首次射击计时失败，再运行完整发布流水线。后续按冻结契约新增 Rarity Profile 和 UpgradeData；升级 UI、候选抽取与随机词条内容应分开阶段，不在 W2-1 范围内。
