# Survivor Team Aura Runtime V1

## 实现

- `core/aura_runtime.gd` 提供通用 Aura Provider 查询：按 `effect_type` 和 `radius_m` 过滤，排除 Provider 自身、死亡/撤离成员；同类型取最大值。
- `set_the_pace.tres`（SUR_006）使用 `teammate_move_speed`，半径 6m，等级值 8/10/12/14/16%。
- `hold_the_line.tres`（SUR_011）使用 `infected_damage_reduction`，半径 6m，等级值 8/10/12/14/16%。
- `mission.gd` 在现有移动速度和受伤入口调用 Aura Runtime；感染者攻击传递 `infected` 标签，未改变 Max HP 或 Damage System。

## 流程

`SurvivorDefinition -> TraitData.at_level() -> AuraRuntime -> Mission movement/damage hook`

跨类型 Aura 分别作用于移动和感染者伤害；同类型 Provider 使用最大值，不累加。

## 验证

`tests/team_aura_runtime.gd`：21 项通过。

- SUR_006 Lv1/Lv5、6m 内、6.1m 外、Provider 自身排除、同类取最大值：通过。
- SUR_011 Lv1/Lv5、6m 内、6.1m 外、Provider 自身排除、非感染者伤害排除：通过。
- Mission 实际移动 Hook 与感染者受伤 Hook：通过。
- Save/Load 后 Trait Level 与 Aura 行为：通过。
- Trait Foundation：44 项通过。
- Remaining Survivor Batch：337 项通过。
- Godot Headless Import：通过。

Phase A 全量回归仍有工作区既有的 Progression Save/Load 与 SUR_012 Lv5 断言失败；这些失败未触及本轮 Aura 文件和 Hook。

## 结论

`Survivor Team Aura Runtime V1: PASS`

本轮未实现周期治疗、周期暴击、UI、招募、受伤/疲劳/士气系统，也未修改模型、Rig、Skin、Locomotion、Ground、XP 或 Level 系统。
