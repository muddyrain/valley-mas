# Search Discoverability V1

## Scope

本轮只整理 Expedition 搜索目标的视觉可发现性。地图生成、建筑场景、SearchTask、Loot、Mission、Enemy 和 Navigation 规则没有新增或重写。

## 修改文件

- `maps/expedition/town_search_registry.gd`
  - 为每个已注册搜索目标创建独立运行时 `SearchUIAnchor`。
  - 锚点优先级：显式 `SearchUIAnchor`、建筑 `Anchors/CenterMarker` 的建筑顶部、碰撞包围盒顶部、交互点回退。
  - 保留 `search_anchor` 兼容键，但导航解析只更新 `entry/ring/entrance_hit`，不会把 UI 锚点移到入口。
  - 创建不参与碰撞的运行时线框高亮节点 `SearchHoverHighlight`。
  - `snapshot()` 增加 `search_ui_anchor` 和来源字段。
- `ui/expedition/poi_context.gd`
  - 通过现有 `site_id` Area3D 代理进行屏幕空间 Hover 检测。
  - 增加紧凑的 `SearchDiscoverabilityCard`，显示建筑名与 `可搜索 / 搜索目标 / 前往搜索 / 已搜索`。
  - 搜索完成后复用 `search_completed` 事件显示 2.4 秒奖励短反馈。
  - 搜索卡和发现卡统一投影到 `search_ui_anchor`，并保留旧地图 `search_anchor` 回退。
  - 状态优先级为 `SEARCHING > SELECTED > HOVER > NORMAL`；Searching 时发现卡不会覆盖进度卡。
- `ui/expedition/world_markers.gd`
  - 移除按距离常驻的搜索图标。
  - Normal 不显示搜索 marker；只有 Hover、Selected 或 Searching 显示 marker/线框高亮。

## 状态机与表现

```text
NORMAL
  -> HOVER       可搜索建筑：可搜索 + 轻微线框/marker
  -> SELECTED    搜索目标 / 前往搜索
  -> SEARCHING   现有 SearchActiveCard + 真实进度
  -> SEARCHED    短暂完成反馈；之后 Hover 显示已搜索
```

同一目标的 Searching 状态优先于 Hover/Selected。不可搜索或未发现目标不会进入发现提示；点击仍由原有 `squad_input.gd` 派发，视觉层没有新增命令系统。

## Anchor 说明

`Interaction Point` 仍只负责寻路、到达和开始搜索。`SearchUIAnchor` 是独立的 `Marker3D`，由 registry 运行时创建，屏幕卡片通过现有 `Camera3D.unproject_position()` 链路投影。导航解析不会覆盖它，因此摄像机旋转、入口朝向和入口可见性不会改变提示所绑定的建筑位置。

## 验证

| 检查 | 结果 |
| --- | --- |
| Godot 导入 | 通过（`--headless --editor --import --quit`） |
| 本次三份脚本语法探针 | 通过：`town_search_registry.gd`、`poi_context.gd`、`world_markers.gd` |
| `git diff --check` | 通过 |
| Expedition 完整搜索测试 | 当前工作树阻断：`core/campaign.gd` 解析 `SurvivorProgression` 类型失败；该类型文件存在但未被当前导入状态注册 |
| `poi_context_runtime.gd` | 当前工作树在既有任务并行场景失败，随后访问缺失的 `garden_house` card；因基础 Mission 状态链同时存在未完成线程改动，未将其判定为本轮通过 |

## 截图证据

以下为仓库中已有的 Expedition 搜索基线截图，用于对照锚点与状态卡，不冒充本轮新捕获：

- `test-output/expedition-integration-e02/01_searchable_building_detected.png`
- `test-output/expedition-integration-e02/03_building_search_active.png`
- `test-output/expedition-integration-e02/05_building_search_complete.png`
- `test-output/expedition-integration-e02/06_search_cancelled.png`

本轮没有生成新的 PNG。待工作树中的 `SurvivorProgression` 导入错误修复后，应重新运行 Expedition native capture，补齐 Hover、Selected、Searching、Search Complete 四态截图并确认背向建筑和镜头移动场景。

## 未覆盖项

- 本轮没有为每栋建筑场景新增手工 `SearchUIAnchor`；当前使用 `CenterMarker`/包围盒回退，后续如需艺术指导可单独添加显式锚点。
- 线框高亮为运行时 AABB 边线，未修改建筑 Mesh 或材质。
- 车辆搜索沿用同一 registry/UI 链路；当前 Medium Town 若没有可搜索车辆实例，不会凭空显示车辆提示。
