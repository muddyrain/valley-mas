# SearchTask Multi Survivor Command System V1 审计

审计日期：2026-09-21
审计范围：当前 Expedition 的 SearchTask、Mission 命令分发、建筑/车辆搜索绑定、Survivor 状态、Command Line 与现有并行搜索测试。
审计性质：只读审计。本轮未修改 SearchTask、Mission、Survivor、UI、地图、Loot、Enemy、Navigation 或测试代码。

## 结论摘要

当前实现已经支持“一个目标一个活动任务、每个任务一个 worker”，因此不同建筑或车辆可以在同一时间推进不同搜索；取消、完成、掉落和指令线也基本按任务隔离。它已经覆盖了目标级并行搜索的主要运行基础。

但它还没有完全达到附件要求的个人命令模型。任务字典的主键仍是目标 `site_id`，`SearchTask` 内部只有一个 `worker`，Medium Town 的 `command_search()` 还依赖全局 `selected_search_member`，调用方不能显式传入“这条搜索命令属于哪个幸存者”。因此当前是“按目标索引的并行任务”，不是“每个幸存者直接拥有个人 SearchTask 命令”。

**总体判定：PARTIAL / 需要后续实施。** 不建议把当前结构直接宣称为 SearchTask Multi Survivor Command System V1 完成。

## 1. 当前搜索任务架构

### 1.1 Mission 持有任务表

`apps/blue-hour/missions/mission.gd:65-75` 定义：

```gdscript
var search_tasks: Dictionary = {}
var selected_search_id := ""
var search_task: RefCounted:
    get: return search_tasks.get(selected_search_id)
```

实际创建任务时使用 `search_tasks[id] = task`（`mission.gd:767-771`）。这里的 `id` 是建筑或车辆的运行时目标 ID，而不是幸存者 ID，也不是独立命令 ID。

`selected_search_id` 只是当前检查/操作的目标。`search_task`、`search_id`、`search_status` 都是 selected task 的便捷 getter；注释明确说明 selected task 只是 inspection target，其他任务仍会运行。

### 1.2 SearchTask 是一个目标占用任务

`apps/blue-hour/missions/search_task.gd:6-15` 保存 `site_id`、`worker`、阶段、进度相关运行标记和搜索开始状态。一个实例只能持有一个 worker；目标是否完成和真实百分比仍存放在 `city.sites[site_id]` 中。

阶段定义（`search_task.gd:3`）：

```text
IDLE
ASSIGNED
MOVING_TO_ENTRANCE
ENTERING
SEARCHING_INSIDE
SEARCHING_OUTSIDE
DEFEND
EXITING
COMPLETE
CANCELLED
```

`assign()`（`search_task.gd:20-29`）写入目标占用、绑定 worker 的伤害信号并下发入口移动。`prepare()`（`search_task.gd:96-152`）处理到达、进门、自卫暂停和开始搜索。`advance()`（`search_task.gd:154-184`）推进目标进度，达到 1.0 后标记 `searched`、发放既有掉落、释放 worker 并发出 `search_completed`。

## 2. SearchTask 生命周期与状态归属

运行时目标状态由 `Mission.search_target_state(id)`（`mission.gd:594-607`）从三类数据合成：

| 状态数据 | 实际来源 | 说明 |
|---|---|---|
| 当前占用者 | `search_tasks[id].worker` | 一个目标最多一个活动 worker |
| 当前进度 | `city.sites[id].progress` | 任务取消后保留，重新派遣可继续 |
| 完成状态 | `city.sites[id].searched` | 完成后阻止再次派遣和重复奖励 |
| 任务阶段 | `search_tasks[id].phase` | 到达、搜索、自卫、退出等过程态 |
| 是否已开始搜索 | `search_tasks[id].search_started` | 普通移动是否可覆盖的关键条件 |
| 取消标记 | `city.sites[id].search_cancelled` | `release()` 非完成释放时写入 |

因此当前存在一个清晰的“目标状态视图”，但不存在独立的“幸存者个人命令状态视图”。`task_for(member)`（`mission.gd:588-592`）只能遍历全部目标任务，反查 worker；没有 survivor-to-task 索引。

`SearchTask.allows_move_override()`（`search_task.gd:16-18`）只允许未开始搜索的 `ASSIGNED`、`MOVING_TO_ENTRANCE` 和 `DEFEND` 被普通移动覆盖。已开始搜索后返回 false，符合上一阶段 Survivor Command V1 的保护规则。

## 3. Mission 命令分发链

### 3.1 搜索点击链

当前世界点击入口为：

```text
SquadInput.handle()
  -> 命中带 site_id 的交互代理
  -> Mission.command_search(id)
  -> 检查目标可搜索/可达
  -> 选择 worker
  -> SearchTask.new()
  -> search_tasks[id] = task
  -> task.assign(id, worker, mission)
  -> 搜索反馈与可选 Command Line
```

`apps/blue-hour/missions/squad_input.gd:81-91` 负责把建筑命中分派到 `command_search(id)`，普通地面命中才进入 `command_move()`。

`apps/blue-hour/missions/mission.gd:724-776` 的关键限制是：

- 方法签名只有 `command_search(id: String)`，没有 worker/member 参数。
- Medium Town 必须有有效的全局 `selected_search_member`（`mission.gd:742-750`）。
- Medium Town 会拒绝该 selected survivor 已有任务、已死亡、上车、在建筑内等情况。
- 选择 worker 时会过滤所有已有任务，但 Town 分支还强制 `member == selected_search_member`。
- 任务创建后只以 `search_tasks[id]` 保存。

这意味着 UI/调用方必须先切换全局 selected survivor，再点击目标，才能表达“由 B 接这个搜索”。命令本身没有携带 B 的身份。

### 3.2 普通移动链

`Mission.move_command()` 使用 `move_command_members()`（`mission.gd:629-640`）过滤：

- `boarding`、`inside_building`、`searching` 的成员不接收普通移动；
- 没有任务或任务允许覆盖的成员才进入移动命令；
- `_move_members()` 只对实际下发的成员释放其允许覆盖的任务（`mission.gd:642-692`）。

因此当前规则可以实现：

- A 已开始搜索时，地面点击不会打断 A；
- B 仍可移动；
- B 的未开始搜索任务可以被 B 的普通移动覆盖；
- 取消或撤离可以显式释放指定任务。

## 4. 建筑与车辆绑定

### 4.1 Legacy Map

`apps/blue-hour/maps/city.gd:78-92` 的 `register_site()` 为建筑和车辆建立统一的 `city.sites[id]` 记录，包含：

- `spec`
- `progress`
- `searched`
- `body`
- `vehicle`
- `search_anchor`

入口代理和 `SearchUIAnchor` 与原模型实例分离。建筑/车辆都通过目标 ID 进入 Mission 的同一 SearchTask 系统。

### 4.2 Medium Town

`apps/blue-hour/maps/expedition/town_search_registry.gd:20-60`：

- 建筑来自 `runtime_data.building_search_points` 与 `building_entries`；
- 车辆来自 `environment_root`，只有带 `lootable` meta 且存在入口锚点的车辆可注册；
- 装饰车辆被拒绝，不会误成为搜索目标；
- 两者都进入 `_register()`，使用同一份 site 字典和 Loot profile。

`town_search_registry.gd:69-129` 为建筑和车辆生成独立 Search 根节点、命中代理、`SearchUIAnchor`、发现点，并写入 `city.sites`。建筑使用非车辆入口/进门流程，车辆由 `site.vehicle` 走室外搜索流程；任务模型没有分叉成两套。

### 4.3 Search UI 与目标状态

`town_search_registry.gd:233-249` 的 `snapshot()` 同时返回目标类型、交互点、UI anchor、耗时、loot profile、当前 worker、完成状态和目标状态。该快照说明建筑/车辆的目标数据已经统一，但任务身份仍然是 target-centric。

## 5. Survivor 状态与占用关系

当前关系是：

```text
city.sites[target_id]
  -> search_tasks[target_id]
      -> worker = Survivor
```

反向查询只能调用 `Mission.task_for(member)` 遍历任务（`mission.gd:588-592`）。这在任务量很小时可工作，但它没有表达以下独立概念：

1. Survivor 当前个人命令；
2. 目标当前占用者；
3. SearchTask 实例的身份。

`selected_search_id` 仍贯穿多个 UI/命令消费者：

- `ui/mission_hud.gd:120,179,419,466,637`
- `ui/expedition/poi_context.gd:33-36,79,185`
- `ui/expedition/poi_entry.gd:67`
- `ui/expedition/minimap.gd:129-130,301,319`
- `ui/expedition/world_markers.gd:69`
- `ui/expedition/search_card.gd:138`

这些消费者可以继续显示“每目标一张活动卡”，但如果以后要显示每个幸存者的个人命令，不能再把 selected target 当作唯一命令上下文。

## 6. Command Line 数据来源

当前 Command Line 已按幸存者独立，属于可复用基础：

- `apps/blue-hour/missions/world_interaction_vfx.gd:141-163` 使用 `member.get_instance_id()` 作为 `command_lines` key；
- 每名幸存者最多保留一条短时线，重复命令更新目标并重置寿命；
- `world_interaction_vfx.gd:174-178` 通过 `mission.task_for(member)` 判断搜索命令是否仍处于 approaching 状态；
- `world_interaction_vfx.gd:188-205` 从幸存者当前位置绘制到目标点，跟随角色重绘；
- 搜索命令在 `mission.gd:772-775` 传入实际 `nearest` worker。

因此指令线数据模型已经是 survivor-keyed，不是当前 SearchTask 主键问题的主要阻塞点。后续只需保证新的个人命令分发结果继续传入实际 worker。

## 7. 当前已经具备的并行能力

### 7.1 代码结构上已具备

`Mission._advance_world()` 会遍历 `search_tasks.values()`，先对每个任务执行 `prepare()`，再对每个任务执行 `advance()`（`mission.gd:323-390`）。这使不同目标可以在同一世界步推进。

当前可成立的能力边界：

| 能力 | 当前判定 | 依据 |
|---|---|---|
| A 搜目标 1、B 搜目标 2 | 结构上支持 | `search_tasks[target_id]` 可同时存在，worker 可不同 |
| A 完成时 B 继续 | 支持 | 完成只调用对应 task 的 `release()`，事件带 target/worker |
| 取消 A 不清理 B | 支持 | `command_recall(id)` 只释放指定 `search_tasks[id]` |
| 目标不能被两人同时占用 | 支持 | 同一 target ID 已存在任务时只选择该任务，不创建第二个 |
| 普通移动不打断已开始搜索 | 支持 | `move_command_members()` + `allows_move_override()` |
| Command Line 按人独立 | 支持 | `member.get_instance_id()` keyed |
| 单幸存者搜索 | 结构上支持 | worker 选择和任务循环不要求至少两人 |

### 7.2 仍受全局选择约束

Medium Town 的搜索接取依赖 `selected_search_member`。因此“B 搜车、A 搜房”在当前正式入口下要求玩家先更新全局选择，再分别点击目标；不能由一个带成员身份的命令调用一次性表达，也不能把多个显式个人命令排队交给 resolver。

这不是当前任务推进器不能并行，而是命令身份和分发 API 仍然集中在选中成员/选中目标。

## 8. 取消、完成和 UI 隔离

### 8.1 取消

`command_recall(id)`（`mission.gd:794-803`）默认使用 selected target，但也可显式传入目标 ID。它调用该任务的 `release()`，清理 worker 搜索状态、释放伤害订阅、保留 site.progress，并发出 `search_cancelled(id)`（`search_task.gd:31-60`）。

该路径具备“取消 A，不影响 B”的目标级隔离；风险在于无参数调用仍依赖 selected target，个人命令取消尚未成为一等接口。

### 8.2 完成

`SearchTask.advance()` 完成时只修改当前 `site_id` 的 `searched/progress`，只发放当前 site 的奖励，最后发出 `search_completed(site_id, worker_name, loot)`（`search_task.gd:162-184`）。信号包含目标与 worker 名称，便于反馈隔离。

### 8.3 UI

Mission HUD、POI context、Minimap、World Markers 和 Search Card 主要按 `search_tasks.has(id)` 或 selected target 渲染。这适合当前“每目标一个活动卡”的 UI 设计，但不是个人任务面板。现有 UI 不应被解读为每个幸存者都有独立 SearchTask 卡。

## 9. 现有测试证据与缺口

### 9.1 已存在的覆盖

- `apps/blue-hour/tests/search_dispatch.gd:83-85` 检查第二个目标可建立独立任务，且不替换第一个 worker。
- `apps/blue-hour/tests/parallel_commands.gd:43-60` 让三个目标同时派遣，并检查进度推进、零 guard 和三个不同 worker。
- `parallel_commands.gd:68-74` 检查取消一个目标后另一个目标继续推进。
- `parallel_commands.gd:93-106` 检查 worker 死亡只移除自己的任务、两个任务可以同帧完成且不会重复奖励。
- `apps/blue-hour/tests/expedition_exploration_runtime.gd` 还覆盖两个建筑并行接近/搜索的生产探索路径。
- `apps/blue-hour/tests/survivor_command.gd` 覆盖搜索中成员不接受普通地面移动、其他成员仍可移动，以及 Command Line 的生成/淡出/清理。

仓库内交付记录 `docs/EXPEDITION_SURVIVOR_COMMAND.md` 声称并行命令专项为 36/36；`docs/EXPEDITION_SEARCH_GAMEPLAY.md` 声称搜索玩法专项、并行隔离和重复奖励保护已通过。另有历史记录指出 `parallel_commands.gd` 曾因车辆测试耗时过短而出现“全员搜索”失败，后续仅在测试 fixture 中固定搜索时长。该修复没有把 target-keyed 模型变成 survivor-keyed 模型。

### 9.2 尚未被当前测试证明的内容

当前测试主要直接调用 `mission.command_search(id)`，并通过 selected member 或 legacy nearest-member 规则间接选择 worker。因此尚未充分证明：

1. 同一公共 Command Resolver 能为指定 A/B/C 显式创建三个个人 Search Command；
2. Medium Town 中不依赖 UI 全局 selected survivor 也能正确分派；
3. 每个 Survivor 的个人命令状态可在不读取 selected target 的情况下查询；
4. 个人命令取消不会因 selected target 变化而误取消其他任务；
5. 任务 ID、worker ID、target ID 在事件、日志、UI 更新中长期稳定关联。

因此验收中的“两个/三个幸存者同时搜索”当前只能判为**目标级并行已覆盖，个人命令模型未覆盖**。

## 10. Root Cause：为什么当前还不是完整 V1

根因不是 SearchTask 的推进循环，也不是建筑/车辆注册，更不是 Command Line。根因是三个身份被压缩在 target-centric 结构中：

1. **任务主键是目标 ID**：`search_tasks[id]`，同一目标只有一个自然任务槽位。
2. **worker 只存于任务内部**：`task_for(member)` 必须遍历反查，Mission 没有 survivor → task 索引。
3. **搜索命令没有成员参数**：`command_search(id)`，Medium Town 依赖全局 `selected_search_member`。
4. **取消/检查默认依赖 selected target**：`command_recall()`、`search_task`、`search_status` 等便捷入口都受 `selected_search_id` 影响。

这套设计足以支持“不同目标同时被不同人占用”，但不等价于“每个幸存者都有可独立派发、查询、取消的个人 SearchTask 命令”。

## 11. 推荐的最小实施方案

建议后续实施时保留现有生命周期、UI 和 Loot，只补身份索引与命令入口：

1. 保留 `search_tasks[target_id]` 作为目标占用/世界卡索引，确保一个目标仍只有一个 worker。
2. 增加 survivor → task 的直接索引，或让每个 Survivor 持有当前 personal command 引用；`task_for(member)` 改为可靠的直接查询，并在释放/完成/死亡时同步清理。
3. 将 `command_search(id, member = null)` 或 Command Resolver 的显式 member 参数接入 Mission；legacy nearest 只作为兼容 fallback，不作为 Medium Town 正式命令身份来源。
4. 把 `selected_search_id` 降级为 UI inspection selection，不再承担任务归属或默认命令身份。
5. 增加按 task/target/member 的稳定事件载荷。现有 `search_completed(id, worker_name, loot)`、`search_cancelled(id)` 可保留兼容，但建议补 worker/task 身份以避免未来多卡更新歧义。
6. `command_recall(id)` 保留按目标取消，同时增加按 survivor/task 取消入口；无参数取消不应依赖隐式 selected target。
7. 继续复用 `SearchUIAnchor`、`SearchActiveCard`、Search Discover Point 与现有 Command Line，不重做 UI。
8. 新增 fixture 覆盖：显式 A/B/C 分派、单人、A 取消/B 继续、A 完成/B 搜索、普通移动过滤和目标重复占用。

## 12. 涉及文件与影响范围

### 直接相关

- `apps/blue-hour/missions/mission.gd`
- `apps/blue-hour/missions/search_task.gd`
- `apps/blue-hour/missions/squad_input.gd`
- `apps/blue-hour/missions/world_interaction_vfx.gd`
- `apps/blue-hour/maps/city.gd`
- `apps/blue-hour/maps/expedition/town_search_registry.gd`

### 现有 UI 消费者

- `apps/blue-hour/ui/mission_hud.gd`
- `apps/blue-hour/ui/expedition/search_card.gd`
- `apps/blue-hour/ui/expedition/poi_context.gd`
- `apps/blue-hour/ui/expedition/poi_entry.gd`
- `apps/blue-hour/ui/expedition/minimap.gd`
- `apps/blue-hour/ui/expedition/world_markers.gd`
- `apps/blue-hour/ui/expedition/squad_card.gd`

### 现有验证夹具

- `apps/blue-hour/tests/search_dispatch.gd`
- `apps/blue-hour/tests/parallel_commands.gd`
- `apps/blue-hour/tests/expedition_exploration_runtime.gd`
- `apps/blue-hour/tests/survivor_command.gd`

本轮没有修改上述任何文件。

## 13. 风险评估

| 风险 | 等级 | 说明 |
|---|---|---|
| 目标占用重复 | 中 | 当前 target key 已能阻止同目标双占用；引入 survivor index 时必须保持双索引一致 |
| 任务释放漏清理 | 高 | 完成、取消、死亡、撤离和室内退出都有不同路径，新增索引必须全部清除 |
| selected target 误操作 | 高 | UI 仍大量依赖 selected target；直接替换语义可能导致取消/卡片更新错对象 |
| Medium Town 分发回归 | 高 | 当前正式入口依赖 selected member；API 改动需兼容 HUD、SquadInput 和实际点击链 |
| 车辆/建筑生命周期分叉 | 中 | 当前已统一 SearchTask，但建筑进门与车辆室外搜索阶段不同，测试需分别覆盖 |
| Command Line 错配 | 中 | 现有线按 survivor key，若新命令只传 target 将失去正确起点 |
| 测试假阳性 | 中 | 历史并行测试曾受车辆搜索时长影响；fixture 必须控制时长并验证任务仍在运行 |

## 14. 实施前置验收条件

后续真正实施 V1 前，至少应补齐以下可观察契约：

1. A、B、C 的命令调用都显式带 survivor 身份，三个任务同时存在且 worker 唯一。
2. A 搜索中、B 移动时，普通 Move 只影响 B；A 进度继续增长。
3. A 搜住宅、B 搜车辆时，任一完成或取消都不清理另一任务、卡片或进度。
4. B 被取消后，A 仍能完成并获得一次奖励；已完成目标不能重复刷奖励。
5. 只剩一名幸存者时，搜索、移动、战斗和撤离仍可用。
6. Search Card 继续按目标显示真实状态，且取消按钮只作用于对应 task。
7. Command Line 起点继续绑定实际 worker，搜索开始或任务释放后及时回收。
8. 建筑和车辆都覆盖入口/进门、自卫暂停、完成、取消和再次搜索路径。

## 最终判定

当前 Expedition 已经有可运行的**目标级多任务搜索基础**，不是完全单任务系统；但附件要求的**以幸存者个人命令为中心的 SearchTask 分配模型**尚未建立。后续应围绕身份索引和显式 worker 命令参数做最小增量实施，不需要重做搜索 UI、建筑/车辆注册、Loot 或地图系统。
