# Search Command Ownership Refactor V1 实施计划

计划日期：2026-09-21
状态：已实施，待交付报告归档
范围：只调整搜索命令归属与分发索引，保留现有 SearchTask 生命周期、建筑/车辆注册、Search UI、Loot 和 Command Line。

## 1. 当前问题

当前 Mission 的活动任务表是 `search_tasks[target_id]`，`SearchTask` 内部保存一个 `worker`。Medium Town 的 `command_search(id)` 没有显式 worker 参数，实际执行者来自全局 `selected_search_member`。

这使当前系统可以按目标并行推进任务，但命令本身没有携带幸存者身份，无法稳定表达“先选 A 搜房屋，再选 B 搜商店”的个人命令关系。`task_for(member)` 还需要遍历所有目标任务反查。

审计依据：

- `apps/blue-hour/missions/mission.gd:65-75,588-607,724-776`
- `apps/blue-hour/missions/search_task.gd:6-18,20-60,154-184`
- `apps/blue-hour/missions/squad_input.gd:81-91`
- `apps/blue-hour/missions/world_interaction_vfx.gd:141-205`

## 2. 目标架构

保留目标索引，同时新增幸存者索引：

```text
search_tasks[target_id]   -> SearchTask
survivor_tasks[member_id] -> SearchTask

SearchTask
  - target_id
  - worker / survivor_id
```

关系约束：

1. 一个 target 最多一个活动 SearchTask。
2. 一个 survivor 最多一个活动 SearchTask。
3. 一个活动 SearchTask 必须同时出现在两个索引中。
4. 任务完成、取消、死亡、撤离和改派时，两个索引必须一起清理或原子替换。
5. `selected_search_id` 只保留为 UI inspection selection，不参与任务归属判断。

建议新增 `SearchTask.survivor_id` 或等价的稳定成员 ID字段。`worker` 继续保留为运行时 Node 引用，用于移动、搜索、伤害订阅和 Command Line 起点；成员 ID用于索引、事件和清理校验。

## 3. API 变化

### 3.1 搜索命令

将正式入口调整为：

```gdscript
func command_search(target_id: String, survivor: Node3D) -> bool
```

返回值表示命令是否被接受，便于输入层决定是否播放反馈。正式 Medium Town 路径不再从 `selected_search_member` 推断 worker。

兼容迁移策略：

- 先更新生产调用方，把实际选中的角色作为第二参数显式传入。
- 对历史 fixture 和旧脚本保留一个短期兼容入口 `command_search_legacy(target_id)`，只用于 Legacy 测试/旧调用迁移，不允许 Medium Town 正式路径依赖它。
- 不在 `command_search(target_id, null)` 中隐式回退到 `selected_search_member`，避免新的调用再次隐藏所有权来源。

### 3.2 取消命令

保留按目标取消：

```gdscript
func command_recall(target_id: String = "") -> void
```

新增按幸存者取消：

```gdscript
func command_recall_survivor(survivor: Node3D) -> void
```

无参数的旧 `command_recall()` 继续作为 UI 兼容入口，但迁移后的 Search Card 应传入明确 target ID；需要取消个人当前命令时使用 survivor 索引，不读取 selected target 猜测。

### 3.3 查询接口

新增：

```gdscript
func task_for(member: Node3D) -> RefCounted
func task_for_survivor_id(member_id: String) -> RefCounted
```

`task_for(member)` 改为从 `survivor_tasks` 直接查询，并保留运行时引用校验。`search_target_state(target_id)` 继续按目标提供 UI 所需视图，不改变 SearchActiveCard 的目标绑定。

## 4. 计划修改文件

### 必改文件

#### `apps/blue-hour/missions/mission.gd`

- 增加 `survivor_tasks` 索引。
- 将搜索命令改为显式接受 survivor。
- 在创建、改派、完成、取消、死亡、撤离和 `_prune_tasks()` 路径同步双索引。
- 将 `task_for(member)` 改为直接查询，并保留旧任务表一致性检查。
- 保持 `move_command_members()` 对已开始搜索者的过滤规则不变。
- 把 `selected_search_member` 降级为 UI 选择状态；仅由输入层把它作为显式命令参数传入。
- 保留 `search_tasks[target_id]` 供 POI、Minimap、World Marker 和 Search Card 使用。

#### `apps/blue-hour/missions/search_task.gd`

- 增加稳定的 `survivor_id`/命令身份字段，或提供等价只读访问器。
- `assign()` 接受并记录显式 survivor。
- 保持现有阶段、进度、完成、取消、自卫暂停和退出过渡逻辑。
- 不在 SearchTask 内新建第二套生命周期。
- 通过任务完成/取消前后的回调或 Mission 清理入口，确保双索引不会残留。

#### `apps/blue-hour/missions/squad_input.gd`

- 建筑点击时取得当前 UI 选中的 survivor，并调用显式 worker API。
- 无有效选中角色时拒绝命令，不触发搜索或 Command Line。
- 普通地面点击继续调用现有 `command_move()`，不改变 Survivor Command V1 规则。

### 需要检查、通常不改结构的文件

#### `apps/blue-hour/missions/world_interaction_vfx.gd`

保持 `member.get_instance_id()` keyed 的 Command Line。只确认新的搜索命令继续传入实际 survivor，并覆盖任务开始、取消、死亡和完成后的回收。

#### `apps/blue-hour/ui/expedition/search_card.gd`

继续按 `site_id` 显示目标卡。取消按钮改为明确传递卡片自身的 target ID；如需“按当前幸存者取消”，再调用 `command_recall_survivor()`，不依赖 selected target。

#### `apps/blue-hour/ui/expedition/poi_context.gd`

保持 SearchUIAnchor、Search Discover Point 和目标卡管理。检查刷新逻辑只消费 `search_target_state(id)`，不把 `selected_search_member` 当作任务 owner。

#### `apps/blue-hour/ui/mission_hud.gd`

保留角色选择行为，但确保选择只改变待发送命令的角色和 UI inspection，不重写已存在任务的 owner。更新所有 `command_search()` 调用为显式 worker。

### 测试文件

- 新增 `apps/blue-hour/tests/search_command_ownership.gd`，覆盖本计划的双索引和显式 API。
- 更新 `apps/blue-hour/tests/parallel_commands.gd`，把关键用例改为显式 A/B/C 分派，同时保留目标级并行回归。
- 更新 `apps/blue-hour/tests/survivor_command.gd`，验证搜索中的 A 不接地面移动、B 可移动且 Command Line 起点属于 B。
- 更新直接调用 `command_search(id)` 的旧 fixture，明确标注 Legacy 兼容入口或传入 survivor。

不修改建筑注册、车辆搜索、地图生成、Loot 数值、Enemy、Navigation、SearchUIAnchor 资源或 PNG 素材。

## 5. 数据与迁移步骤

按以下顺序实施，保持每一步可回归：

1. 增加双索引和 SearchTask 的稳定 survivor 身份字段，不改变现有目标生命周期。
2. 加入统一的 bind/unbind 辅助函数，所有写入 `search_tasks` 的路径都通过该函数完成。
3. 让 `task_for(member)` 优先走 `survivor_tasks`，发现索引失配时记录错误并以目标表做一次兼容校验，避免静默错配。
4. 修改 `command_search()` 为显式 worker，并把 Town 的可用性、目标占用和路线检查放在同一入口。
5. 修改 SquadInput、Mission HUD 和 Search Card 的调用方。
6. 迁移 `command_reassign()`：解除旧 survivor 索引，再把同一 target task 原子替换为新 survivor；搜索进度和 UI target 不变。
7. 迁移取消/完成/死亡/撤离清理路径，完成后断言两个索引都不存在。
8. 添加显式 A/B/C fixture，再运行现有 Search、Command Line、Search Card 和 Expedition HUD 回归。
9. 只有在 headless 与原生验证通过后，才生成两个/三个幸存者并行搜索的截图或录屏。

## 6. 风险与控制措施

| 风险 | 等级 | 控制措施 |
|---|---|---|
| 双索引不同步导致幽灵任务 | 高 | 所有绑定/解绑集中到辅助函数；完成、取消、死亡、撤离逐条断言 |
| selected member 语义继续渗透 | 高 | 正式 API 强制 survivor 参数；Town 不允许 null 隐式回退 |
| 改派时错误释放另一任务 | 高 | 先校验 target task 与旧 worker 的双向关系，再原子替换 |
| Search Card 取消错目标 | 中 | 卡片始终传自身 target ID；个人取消单独走 survivor API |
| Legacy fixture 大量失败 | 中 | 提供短期 Legacy wrapper，逐个迁移生产/测试调用，不改变正式 Town 语义 |
| Command Line 起点错配 | 中 | 继续以实际 survivor 传入 `play_command_line()`，新增断言检查 key |
| 建筑与车辆阶段差异回归 | 中 | 分别覆盖室内进门搜索和室外车辆搜索的创建、取消、完成 |
| 单幸存者流程回归 | 中 | 单成员 fixture 覆盖搜索、移动、战斗、撤离和完成 |

## 7. 验收方案

### Case 1：A 搜住宅，B 搜商店

- 显式调用 `command_search(house_id, survivor_a)` 和 `command_search(shop_id, survivor_b)`。
- 断言两个 target task 存在、两个 survivor task 存在、worker 不相同。
- 两个目标进度都增长，Search Card 分别显示对应建筑和搜索者。

### Case 2：A 搜索中，B 移动

- 让 A 进入 `SEARCHING_INSIDE` 或 `SEARCHING_OUTSIDE`。
- 对地面发出普通 Move。
- 断言 A 的 task、progress、卡片不变；B 接收目标并生成 B 的 Command Line。

### Case 3：取消 A，B 继续

- 用 `command_recall_survivor(survivor_a)` 或显式 target recall 取消 A。
- 断言 A 的 target/survivor 索引清理，进度保留，B 的两个索引和进度保持有效。

### Case 4：单 Survivor

- 只保留一个存活成员。
- 覆盖搜索、普通移动、战斗、自卫、取消和撤离。
- 断言不存在“必须有其他 guard”或“必须切换 selected member”的隐式限制。

### Case 5：Command Line 所有权

- A、B 同时下达不同目标命令。
- 断言 `world_interaction_vfx.command_lines` 以各自 `member.get_instance_id()` 存储，目标点不交叉。
- 搜索开始、完成、取消、死亡后对应线回收，另一成员的线不受影响。

### Case 6：目标唯一占用与重复奖励

- A 已占用目标 1 时尝试让 B 搜目标 1，必须拒绝且不覆盖 A。
- A 完成目标 1 后再次点击，不能创建任务或重复掉落。

## 8. 交付物

实施阶段完成后生成：

`apps/blue-hour/docs/SEARCH_COMMAND_OWNERSHIP_REFACTOR_V1.md`

内容包括：

- 实际修改文件
- 最终双索引架构与 API
- 生命周期清理路径
- Headless/native 测试结果
- 两人/三人并行搜索截图或录屏路径
- 已知限制与未处理项

当前阶段只交付本计划，不生成最终实施报告，不生成截图/录屏，不修改代码。
