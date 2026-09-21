# SUR_003～SUR_012 Trait Runtime Phase A 交付报告

日期：2026-09-21

## 结果

| Survivor | Trait | Gameplay Hook | Lv1 / Lv5 | 边界与结果 |
| --- | --- | --- | --- | --- |
| SUR_003 林见月 | `danger_instinct` / 危险直觉 | `damage` | +10% / +22% | 感染者 XZ 距离 4.9m、5.0m 生效；5.1m 不生效；非感染者不生效 |
| SUR_005 沈砚川 | `temporary_repair` / 临时修复 | `interaction` | -12% / -28% | 10s 机械交互为 8.8s / 7.2s；普通 Search 仍为 10s |
| SUR_007 顾予安 | `calm_aim` / 冷静瞄准 | `damage` | +10% / +22% | 感染者 XZ 距离 7.9m、8.0m 不生效；8.1m 生效；非感染者不生效 |
| SUR_009 周野 | `robust_physique` / 强健体魄 | `max_hp` | +12% / +25% | base 100 得到 112 / 125；Spawn、Save、Load、Level 通过，等级变化保持当前生命比例 |
| SUR_010 许昭宁 | `value_judgment` / 价值判断 | `loot_quality` | +8% / +16% Rare+ weight | Common/Uncommon 权重不变；不增加 Roll；固定种子 100,000 样本见下表 |
| SUR_012 宋时雨 | `composed_planning` / 从容不迫 | `power_cooldown` | -3% / -7% | 60s 基准下 Rage、Aid 为 58.2s / 55.8s；Weapon、Reload、Search 不变 |

六项均为 `PASS`。SUR_004 / 006 / 008 / 011 仍无 Runtime Hook，本轮没有创建 Aura、周期治疗或周期暴击系统。

## Runtime 契约

- `SurvivorDefinition → TraitData.at_level(roster.level) → TraitRuntime → Gameplay Hook` 保持唯一链路。
- Damage 由 `Mission.damage_to()` 传入世界 XZ 距离与感染者标签；没有 survivor ID 或角色名分支。
- Interaction 分类由 `WorldAssetData.interaction_tags` 与车辆分类生成。修车铺、加油站和正式车辆为机械交互；其他搜索点不受影响。
- Max HP 在 Survivor 的运行时 Definition 副本上计算，不修改 Catalog 原始数据。`apply_trait()` 在等级变化时保持 HP 比例并限制到新上限。
- Resource Loot Table 与正式装备奖励的 Rare/Epic/Legendary 候选仅调整原权重，然后沿用原单次 RNG 抽取；搜索任务将执行者 Trait 传入装备奖励链，不生成角色专属副本。
- 正式 Power Resource 采用 60s 基准冷却；团队内 `power_cooldown` Trait 取最高有效值，本阶段不实现复杂叠加。

## SUR_010 固定种子抽样

| Level | Sample | Target | Actual | Proc Count |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 100,000 | 20.000% | 20.065% | 20,065 |
| Lv1 | 100,000 | 21.260% | 21.328% | 21,328 |
| Lv5 | 100,000 | 22.481% | 22.548% | 22,548 |

验收重点为 `Rare+ weight = base_weight * (1 + bonus)`。三档实测均在目标值 0.5 个百分点内。

## 验证

- Phase A：76 checks，0 failures；包含自定义伤害目标标签、Loot 最低稀有度参数和正式装备奖励链验证。
- SUR_001 / SUR_002：44 + 111 checks，0 failures；Town 13 checks，0 failures。
- 12 人 Definition / Rig / Public Locomotion：337 checks，0 failures；公共动作 495 checks，0 failures。
- Catalog / Save / Weapon / New Run / Day Loop：19 + 9 + 428 + 40 + 43 checks，0 failures。
- Search Gameplay：67 checks，0 failures；Camp Party：31 checks，0 failures。
- Xia / Su Production Gameplay：各 29 checks，0 failures。
- Godot Headless Import：PASS；本轮日志未出现 Missing Resource 或 Invalid UID。

旧 `effect_system.gd` 仍有 16 项既有断言失败，涉及武器多段命中、旧移动速度期望、已移除的 `corner` 站点与旧时钟断言；Phase A 新增的 Power 冷却与 Trait 检查均通过。`survivor_production_flow.gd` 仍触发既有导航流程超时；`today_action.gd` 仍在既有 Camp UI 的 `departure` 接口断言处阻断。上述问题不属于本轮六个 Trait 的实现。

Windows build 已执行。Search Gameplay 72、Expedition HUD Phase 2 258、Survivor Command 45、Search Active Card 157、Settings 14、Camp Menu Overlay 30 项均通过；随后被既有 `camp_ui_runtime.gd:114` 的 `member_buttons` 访问和旧左侧能力栏断言阻断，未进入 Windows 导出阶段，未更新 EXE。
