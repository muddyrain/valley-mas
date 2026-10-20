# Survivor Camp Roster Integration V1

> 2026-09-23 更新：本报告记录 2026-09-22 的旧展示规则。当前 Camp 仅显示 `get_recruited_survivors()`，标题为“营地成员 N”；已发现与未解锁角色不进入 Camp 列表。当前验收以 `docs/PLAN.md` 的 2026-09-23 条目和 `tests/camp_roster_recruitment_integration.gd` 为准。

## Architecture

Camp 的 `M04_SurvivorRoster` 通过 `SurvivorRosterAdapter` 读取 `Campaign.roster_manager()`。适配层调用 `get_recruited_survivors()`、`get_discovered_survivors()` 和 `get_all_survivors()` 生成稳定的动态视图，已招募角色排在前面，数量标题使用 `RECRUITED / TOTAL`。

`PortraitSlot` 只负责呈现视图数据：

- `RECRUITED`：头像、姓名、等级、Trait/招募状态，并允许打开详情。
- `DISCOVERED`：已发现姓名与“等待救援”状态，不提供等级和详情数据。
- `LOCKED`：使用“未知幸存者”占位，不暴露头像、姓名、等级或 Trait。

Camp 根节点新增 `refresh_roster()`，招募或加载状态变化后可重建列表；Roster Manager 仍是所有权状态的唯一来源。

## Verification

专项脚本：`tests/camp_roster_recruitment_integration.gd`

- 初始 `SUR_001` / `SUR_002`：`2/12`，完整资料可见。
- 锁定角色：未知占位、无真实头像和详情资料。
- `discover_survivor("SUR_004")`：显示“陆清禾 · 已发现 · 等待救援”。
- `recruit_survivor("SUR_004")`：刷新为 `3/12`，显示正式资料。
- Save/Load：`SUR_004 = RECRUITED` 与 Camp 数量、视图一致。
- 动态容量：继续招募后 `5/12` 与 `12/12` 均可正确刷新。

结果：`CAMP ROSTER INTEGRATION: 0 failures`。

相关回归：Survivor Recruitment Roster 17 项、Camp Party 31 项、Progression 29 项、Trait Foundation 44 项、Team Aura 21 项、Periodic Effect 13 项、XP Gameplay 6 项通过；Character System 12 SurvivorDefinitions / Traits 与 Godot Headless Import 通过。旧 Camp skeleton 脚本仍报告 M07/M08/M09 artwork 断言；Mission Flow 仍被既有搜索目标数量断言和非有限坐标错误阻断。这些失败均不经过本次 M04 roster 数据路径。
