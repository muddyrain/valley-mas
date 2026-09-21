# Search Discoverability V2 · Deadly Days Direction

## 本轮结果

本轮只调整建筑搜索的世界空间发现与状态提示表现。SearchTask、Mission、Loot、Enemy、地图生成、Navigation 和 Survivor 行为保持不变。

核心变化是停用旧的蓝色 AABB / 线框 Hover 框，改为：

```text
Idle      -> SearchUIAnchor 上方的小型搜索发现点
Hover     -> 建筑名 + 左键 · 搜索
Selected  -> 建筑名 + 前往搜索 / 搜索目标
Searching -> 现有 SearchActiveCard + 真实进度
Complete  -> 短暂完成反馈 + Loot 信息
Searched  -> 已搜索，发现点消失，不再显示可搜索提示
```

## 修改文件

| 文件 | 修改 |
| --- | --- |
| `maps/expedition/town_search_registry.gd` | 不再创建运行时 `SearchHoverHighlight` AABB 线框；为每个 Searchable Target 在 `SearchUIAnchor` 创建小型 `SearchDiscoverPoint`。Interaction Point 与 SearchUIAnchor 继续分离。 |
| `ui/expedition/world_markers.gd` | Idle 只显示小型发现点；Hover / Selected / Searching 显示现有 marker；旧 highlight 即使存在也强制隐藏；SearchUIAnchor 用于发现点视口判断。 |
| `ui/expedition/poi_context.gd` | Hover 文案改为“左键 · 搜索”；Selected 保留“前往搜索 / 搜索目标”；Searching 优先级继续高于 Hover/Selected。 |
| `tests/expedition_hud_2.gd` | 增加 Idle、Selected、Complete、Searched 截图检查点，不改变玩法断言或命令流程。 |
| `docs/SEARCH_DISCOVERABILITY_V2_DEADLY_DAYS_DIRECTION.md` | 本交付报告。 |

## 旧表现处理

旧的 `SearchHoverHighlight` 是由 `town_search_registry.gd` 生成的整栋建筑 AABB 线框，容易被误读为 Debug 辅助。当前 registry 不再创建该节点，`world_markers.gd` 也不再显示或更新它；运行时搜索提示不再依赖整栋建筑线框。

保留 `_create_hover_highlight()` 函数源码作为历史兼容代码，但它不再被注册流程调用，也不会产生运行时节点。

## 新状态表现

### Idle

- 使用已有 `world_search_marker` 资源。
- marker 尺寸约 0.46m，挂在 `SearchUIAnchor`，低幅度缩放脉冲。
- 不显示建筑名或大面板，保持地图干净。

### Hover

- 发现卡使用现有世界空间 `SearchUIAnchor` 投影。
- 显示建筑名和“左键 · 搜索”。
- 旧 AABB 线框完全停用。

### Selected

- 点击后由现有 `mission.poi_selected_id` 驱动。
- 文案切换为“前往搜索”或“搜索目标”。
- 现有搜索目标环和 Command Line 继续负责动作确认。

### Searching

- 继续使用既有 `SearchActiveCard`、SearchUIAnchor、进度条和百分比。
- Hover 不会覆盖搜索卡。
- Search marker 继续轻微旋转 / pulse。

### Complete / Searched

- 完成瞬间保留现有短暂完成反馈和 Loot 文案。
- 完成反馈结束后显示“已搜索”。
- 搜索发现点不再显示，建筑不会继续被识别为可搜索目标。

## 使用资源

- `world_search_marker`：Idle 发现点与 Searching marker。
- `icon_search`：Hover / Selected 世界提示卡图标。
- 现有 SearchActiveCard 素材与 SearchUIAnchor 投影链路。
- 未新增 PNG、模型、材质包或第二套交互系统。

## 截图

- [Idle · 搜索发现点](../test-output/expedition-hud-2/03_search_discoverability_idle.png)
- [Hover · 左键搜索](../test-output/expedition-hud-2/03_building_compact.png)
- [Selected · 前往搜索](../test-output/expedition-hud-2/03_search_discoverability_selected.png)
- [Searching · 现有搜索卡](../test-output/expedition-hud-2/03_building_search.png)
- [Complete · 完成与奖励反馈](../test-output/expedition-hud-2/03_search_discoverability_complete.png)
- [Searched · 已搜索](../test-output/expedition-hud-2/03_search_discoverability_searched.png)

## 验收结果

- `tests/search_active_card.gd`：157 checks，0 failures。
- `tests/expedition_hud_phase2.gd`：262 checks，0 failures。
- `tests/expedition_hud_2.gd`：367 checks，3 个既有表现契约失败，均为旧的 legacy selection ring / city move marker 断言；本轮新增加的 Discoverability 截图检查点均已生成。
- Godot 4.7.2 editor import：通过扫描和脚本注册。
- `git diff --check`：目标文件无空白错误。

已覆盖：

- Hover / Selected / Searching / Searched 状态切换。
- SearchUIAnchor 投影与相机移动后的卡片跟随。
- 搜索完成后发现点消失。
- 既有车辆搜索与搜索卡链路未回退。

## 已知限制

- 当前项目没有专用鼠标左键 PNG，因此 Hover 使用现有 `icon_search` 加“左键 · 搜索”文字表达，未生成新素材。
- 完整 Expedition 录屏仍受标题页旧测试入口 `title_screen.tabs` 接口漂移影响；本轮提供真实运行时五态 PNG。
- `_create_hover_highlight()` 历史函数仍保留在源码中，但不再被调用；如后续确认无兼容需求，可在独立清理任务中删除。
