# Search Interaction Polish V3

本轮目标是把 Expedition 搜索交互整理成清晰的“选择幸存者 → 指定目标 → 执行搜索”反馈流程。实现只涉及搜索表现层和测试 fixture，没有改变 SearchTask 生命周期、任务归属索引、Mission 规则、地图、Enemy、Loot 或 Navigation 核心逻辑。

## 修改文件

- `ui/expedition/poi_context.gd`
  - 增加轻量 `SearchDiscoverabilityCard`，用于世界空间 Hover / Selected / Completed 提示。
  - 使用内嵌 `MouseLeftGlyph` 原生绘制鼠标左键图标，避免新增 PNG。
  - 以 `SearchUIAnchor`（兼容旧 `search_anchor`）作为投影来源。
  - 搜索中优先级高于 Hover / Selected；搜索卡独立按 site 更新，取消或完成时及时隐藏。
  - 完成反馈短暂显示奖励摘要，随后清除。
- `ui/expedition/search_card.gd`
  - 在 `SearchActiveCard` 右上角增加执行者短标识（姓名前两个字）。
  - 保留完整姓名 tooltip，便于多幸存者并行搜索时确认任务归属。
  - 保留现有卡片素材、进度条、取消按钮和尺寸。
- `tests/search_interaction_polish_acceptance.gd`
  - 新增 V3 场景 fixture，覆盖双人并行搜索、切换幸存者、独立取消、地面移动和 Hover 提示。
- `run.ps1`
  - 将 V3 headless 测试接入 `test` 模式。
  - 将 V3 native capture 接入 `capture` 模式。

## 交互流程

未 Hover 时保持地图简洁；Hover 已发现且未搜索的建筑时，显示小型鼠标左键 glyph 和“搜索”。选中建筑时文案变为“搜索目标”或“前往搜索”。开始搜索后，SearchActiveCard 由 SearchUIAnchor 投影到世界空间，显示建筑、状态、进度、百分比、取消按钮和执行者标识。搜索中的目标不会被 Hover / Selected 提示覆盖。

多个幸存者可以同时拥有独立 SearchTask。取消某个目标只清理对应卡片和任务；其他幸存者的任务与卡片保持不变。空闲幸存者仍可在其他搜索进行期间接受地面移动。

## 多 Survivor 验证

`search_interaction_polish_acceptance.gd`：13 checks，0 failures。

已验证：

- Survivor A 搜索住宅、Survivor B 搜索车辆时，两张活动卡同时显示。
- 每张卡显示对应执行者短标识，并通过 tooltip 保留完整姓名。
- 切换当前选中幸存者不会改变 A 的任务归属。
- 取消 A 只隐藏 A 的卡片，B 继续搜索。
- B 搜索期间，空闲 Survivor C 可以接受地面移动。
- 普通 Hover 显示原生左键 glyph 和“搜索”。

相关回归：

- `search_active_card.gd`：137 checks，0 failures。
- `search_command_ownership.gd`：14 checks，0 failures。
- `survivor_command.gd`：43 checks，0 failures。

## 截图

本轮 native capture 输出：

- [双人并行搜索](../test-output/search-interaction-polish-acceptance/parallel-search.png)
- [取消 A 后 B 继续](../test-output/search-interaction-polish-acceptance/cancel-a-b-continues.png)
- [Hover 搜索提示](../test-output/search-interaction-polish-acceptance/hover-search-prompt.png)

此前完整搜索流程截图也可复用：

- [搜索开始](../test-output/expedition-integration-e02/03_building_search_active.png)
- [搜索完成](../test-output/expedition-integration-e02/05_building_search_complete.png)
- [搜索取消](../test-output/expedition-integration-e02/06_search_cancelled.png)

## 录屏

- [完整建筑搜索流程](../test-output/expedition-integration-e02/building_search_full_flow.mp4)
- [取消并重新分配流程](../test-output/expedition-integration-e02/search_cancel_and_reassign.mp4)

上述录屏来自既有 Expedition integration capture；本轮新增 native capture 重点验证 V3 多任务卡和 Hover 表现。

## 已知限制

- `tests/poi_context_runtime.gd` 中仍有旧 fixture 的并行任务时序 / Dictionary 访问失败（包括 `garden_house` 访问）。该 fixture 失败发生在本轮 V3 UI 改动之外，未作为 V3 通过条件，也未修改 SearchTask 生命周期来绕过。
- GitNexus MCP 工具在当前环境未暴露，本轮影响范围通过现有调用点检索和 Godot 回归测试核验。
- 本轮没有新增正式图片素材；鼠标左键提示图标由 Godot 原生绘制。
