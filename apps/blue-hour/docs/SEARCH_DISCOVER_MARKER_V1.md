# Search Discover Marker V1

## 本轮范围

本轮只补充 Expedition 可搜索目标的世界空间发现反馈。没有修改 `SearchTask`、`Mission`、Command System、地图生成、Loot、Enemy 或 Navigation 规则。

## 修改文件

- `ui/expedition/world_marker.gd`
  - 增加 `world_discover_marker` 语义模式。
  - 使用 Godot 原生 `SphereMesh` 作为蓝白发现点，使用 `TorusMesh` 作为轻量扫描波纹。
  - 通过 `animate_discovery()` 更新呼吸亮度、波纹半径与透明度，不新增 PNG。
- `maps/expedition/town_search_registry.gd`
  - Medium Town 搜索注册器为每个 SearchUIAnchor 创建独立 `SearchDiscoverPoint`。
- `maps/city.gd`
  - 兼容当前旧 Expedition 验收入口的 `City.register_site`，使用同一 `SearchDiscoverPoint`，避免两套运行时表现分叉。
- `ui/expedition/world_markers.gd`
  - Available Marker 绑定 `SearchUIAnchor`，并在已有 20Hz 世界标记更新循环中驱动动画。
  - Available 点只对住宅、商店/超市、仓库显示；车辆等既有搜索目标仍保留原 Hover、Searching marker 与搜索卡链路。
  - Hover/Selected、Searching、Completed 的优先级继续由既有状态驱动。
- `tests/expedition_hud_2.gd`
  - 增加 Available 点存在、专用语义、原生扫描环、动画、Hover 隐藏、Searching 隐藏、Completed 不恢复检查。

## 状态切换

```text
AVAILABLE
  discovered && !searched && target in {house, shop, supermarket, warehouse}
  -> SearchUIAnchor 上方蓝白点 + 呼吸 + 小范围扫描波纹

HOVER / SELECTED
  -> Available 点隐藏；现有 SearchDiscoverabilityCard 显示建筑名与搜索动作

SEARCHING
  -> Available 点隐藏；现有 SearchActiveCard 显示目标、执行者、真实进度

COMPLETED / SEARCHED
  -> Available 点不恢复；沿用现有短暂奖励反馈和已搜索状态
```

`SearchUIAnchor` 与实际 `InteractionPoint` 仍然分离。发现点只读取锚点位置，不参与寻路、占用、进度或取消逻辑，因此背向建筑也能在建筑上方给出提示。

## 资源与性能

- 未新增 PNG、模型或第二套交互系统。
- 每个支持的目标增加一个根 `MeshInstance3D` 与一个扫描环子节点；扫描环不创建独立 `_process`，由 `WorldMarkers` 统一以 20Hz 更新。
- 数十个目标同时存在时，开销是少量简单几何和一次集中更新，远低于新增粒子系统或逐节点 Tween。

## 验证截图

- [Available · 搜索发现点](../test-output/expedition-hud-2/03_search_discoverability_idle.png)
- [Hover · 搜索提示](../test-output/expedition-hud-2/03_building_compact.png)
- [Selected · 目标状态](../test-output/expedition-hud-2/03_search_discoverability_selected.png)
- [Searching · 搜索状态卡](../test-output/expedition-hud-2/03_building_search.png)
- [Completed · 完成反馈](../test-output/expedition-hud-2/03_search_discoverability_complete.png)
- [Searched · 已搜索](../test-output/expedition-hud-2/03_search_discoverability_searched.png)

## 验收结果

| 检查 | 结果 |
| --- | --- |
| Godot 4.7.2 editor import | 通过 |
| `tests/expedition_hud_2.gd` | 358 checks，3 个既有失败 |
| `tests/search_interaction_polish_acceptance.gd` | 15 checks，0 failures |
| `tests/search_active_card.gd` | 137 checks，0 failures |
| 本轮新增 Marker 检查 | 全部通过 |
| `git diff --check` | 通过 |

`expedition_hud_2.gd` 剩余失败是工作树已有的 selection ring / Compatibility move marker 基线断言：`Only the inspected member has a clear selection ring`、`Move marker animates actual Compatibility material alpha`、`Repeated move replaces the previous marker and restarts its animation`。它们不涉及本轮 Search Discover Marker。

## 已知限制

- 发现点只新增到现有可搜索目标注册链；本轮没有扩展空投、特殊事件或战斗目标。
- 车辆仍可通过既有 Hover/搜索卡发现和操作，但不显示本轮的 Available 建筑发现点。
- 既有完整 Expedition 测试仍包含其他线程的历史视觉基线失败，未在本轮修复。
