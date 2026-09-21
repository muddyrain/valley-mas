# Search Command Ownership Refactor V1

日期：2026-09-21

## 本次范围

本次只整理 Search Command 的所有权与索引，不改变 SearchTask 阶段、搜索进度、奖励、建筑/车辆注册、Search UI、地图、Enemy、Navigation 或 Command Line 的表现逻辑。

## 实际修改文件

- `apps/blue-hour/missions/mission.gd`
  - 新增 `survivor_tasks[survivor_id]`，与既有 `search_tasks[target_id]` 形成双向活动任务索引。
  - 新增 `_bind_search_task()` / `_unbind_search_task()`，创建、改派、完成、取消、死亡、撤离统一经过双索引绑定和解绑。
  - `task_for(member)` 优先使用幸存者索引；发现旧 fixture 缺失索引时，才从目标索引兼容修复。
  - `command_search(target_id, survivor)` 返回是否接受，并把明确的 Survivor 传给 SearchTask 和 Command Line。
  - 新增 `command_recall_survivor(member)`，可按幸存者取消自己的任务。
  - 遍历任务时使用 `values().duplicate()`，允许完成/取消在当前 tick 立即解绑。
- `apps/blue-hour/missions/search_task.gd`
  - 新增稳定 `survivor_id`。
  - `assign()` 记录执行者身份；`release()` 在完成、取消或 worker 无效时解绑 Mission 双索引。
- `apps/blue-hour/missions/squad_input.gd`
  - 建筑点击将当前明确选中的 Survivor 传入 `command_search()`。
- `apps/blue-hour/ui/mission_hud.gd`
  - POI 搜索按钮将当前选中的 Survivor 显式传入 `command_search()`。
- `apps/blue-hour/tests/search_command_ownership.gd`
  - 新增 A/B 并行搜索、C 普通移动、独立取消、继续推进和单 Survivor fixture。
- `apps/blue-hour/run.ps1`
  - 将所有权 fixture 加入 headless `test` 流程。
- `apps/blue-hour/docs/SEARCH_COMMAND_OWNERSHIP_REFACTOR_PLAN.md`
  - 同步状态为“已实施，待交付报告归档”。

`search_card.gd` 未改动。其取消按钮继续传递卡片自身的 `site_id` 到 `command_recall()`，不会依赖当前选中目标推断取消对象。

## 最终数据关系

```text
search_tasks[target_id]   -> SearchTask
survivor_tasks[member_id] -> SearchTask

SearchTask
  - site_id
  - worker: Node3D
  - survivor_id: String
```

约束为一个目标最多一个活动任务、一个幸存者最多一个活动任务。任务完成、主动取消、worker 死亡、全队召回、撤离和改派都会清理旧关系；改派先解绑旧 worker，再绑定新 worker，目标进度保持不变。

## API

正式生产路径使用：

```gdscript
mission.command_search(target_id, survivor)
mission.command_recall(target_id)
mission.command_recall_survivor(survivor)
mission.task_for(survivor)
```

`selected_search_member` 只由输入/UI 层作为显式参数传递，生产 SquadInput 与 Mission HUD 不再让 Mission 从 UI 状态推断执行者。

为兼容当前大量旧 headless fixture，`command_search(target_id)` 暂时保留无参兼容分支：Town fixture 回退到旧 selected member，Legacy fixture 按最近可用幸存者选择。这不是新的生产入口，后续应迁移旧 fixture 后删除该分支。

## 验证结果

通过：

- `tests/search_command_ownership.gd`：14 checks，0 failures
- `tests/survivor_command.gd`：43 checks，0 failures
- `tests/search_gameplay.gd`：67 checks，0 failures
- `tests/parallel_commands.gd`：36 checks，0 failures
- `tests/search_active_card.gd`：137 checks，0 failures
- `tests/expedition_search.gd`：1222 checks，0 failures
- Godot 4.7.2 headless 导入/解析：通过
- `git diff --check`：通过（本次相关文件）

`tests/search_dispatch.gd` 当前为 56 checks、2 failures。失败点是工作树中其他线程已有的 Trait 共享行为和撤离结算预期，不是本次新增双索引的断言；本报告不把该回归标记为通过。

## 视觉证据

本次所有权 fixture 是 headless 数据验证，没有单独生成新的 ownership 截图或录屏。现有生产 Search 流程的可视证据可复用：

- `apps/blue-hour/test-output/search-gameplay/parallel-search.png`
- `apps/blue-hour/test-output/expedition-integration-e02/04_ground_click_during_search.png`
- `apps/blue-hour/test-output/expedition-integration-e02/building_search_full_flow.mp4`
- `apps/blue-hour/test-output/expedition-integration-e02/search_cancel_and_reassign.mp4`

这些素材验证现有 Search Card、地面点击不中断搜索、取消和改派表现；所有权 fixture 额外验证了不同 Survivor 的任务索引不交叉。

## 已知限制

1. 旧测试仍有无参 `command_search()` 调用，兼容分支暂时保留；正式 Town 输入已经使用显式 Survivor 参数。
2. 当前 GitNexus GDScript `impact` 对相关符号返回 `UNKNOWN / not found`，因此调用点通过 `rg` 和回归测试人工核验；当前环境没有可用的 GitNexus MCP 符号分析工具。
3. 工作树包含其他线程的大量未提交改动，本次报告只归因于上面列出的 Search Command Ownership 相关路径。
