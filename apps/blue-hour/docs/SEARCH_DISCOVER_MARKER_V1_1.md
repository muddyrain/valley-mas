# Search Discover Marker V1.1 验收报告

## 交付结果

本轮只调整 Search Discover Marker、SearchUIAnchor 数据和现有世界奖励反馈。`SearchTask`、Mission 规则、Command、Loot 发放、Navigation 与交互分发未修改。

## 修改文件

| 文件 | V1.1 调整 |
| --- | --- |
| `ui/expedition/world_marker.gd` | 保留 `SphereMesh + TorusMesh`；发现点呼吸幅度由 8% 降为 2%，扫描环扩散与透明度减弱，并下移到接近地面的高度。 |
| `ui/expedition/world_markers.gd` | 保留统一 20Hz 更新；降低根节点缩放脉冲幅度。 |
| `maps/expedition/town_search_registry.gd` | SearchUIAnchor 优先使用显式锚点；住宅、商店和仓库的运行时回退锚点位于入口外侧 0.75m、高 0.65m；车辆位于交互点上方 0.55m。 |
| `maps/city.gd` | 旧 Expedition 注册路径采用同样的低位入口/车辆锚点高度。 |
| `missions/world_interaction_vfx.gd` | 复用现有 `LootFeedback`，改为角色附近侧向 0.62m、小字号、上浮 0.5m、1.5 秒淡出销毁。 |
| `ui/mission_hud.gd` | 世界奖励反馈在真实搜索完成事件触发一次；资源拾取仍走原结算链，只更新结算文案，避免重复飘字。 |
| `tests/expedition_search.gd` | 验证建筑锚点距入口 0.5–1m、车辆锚点绑定交互位置、锚点保持低位。 |
| `tests/expedition_hud_2.gd` | 验证 Available、Hover、Searching、Completed 状态，以及奖励位置、字号、1.5 秒生命周期和自动销毁。 |

## 状态验收

| 状态 | 结果 |
| --- | --- |
| Available | 蓝白点位于入口附近；扫描环贴近地面；呼吸和波纹均为低幅表现。 |
| Hover | Available Marker 立即隐藏，沿用 `SearchDiscoverabilityCard`。 |
| Searching | Available Marker 保持隐藏，沿用 `SearchActiveCard` 与真实进度。 |
| Completed | Marker 不恢复；奖励在完成者附近侧向显示并上浮淡出。 |
| Reward | 24px、`pixel_size = 0.014`，距最近幸存者约 0.62m，1.5 秒后释放，不覆盖角色身体。 |

## 截图

- [Available · 低位入口发现点](../test-output/expedition-hud-2/03_search_discoverability_idle.png)
- [Hover · Marker 隐藏](../test-output/expedition-hud-2/03_building_compact.png)
- [Searching · SearchActiveCard](../test-output/expedition-hud-2/03_building_search.png)
- [Completed · 小型世界奖励](../test-output/expedition-hud-2/03_search_discoverability_complete.png)
- [Searched · Marker 不恢复](../test-output/expedition-hud-2/03_search_discoverability_searched.png)

## 自动验收

| 测试 | 结果 |
| --- | --- |
| Godot 4.7.2 editor import | 通过 |
| `tests/expedition_search.gd` | 1662 checks，0 failures |
| `tests/search_interaction_polish_acceptance.gd` | 15 checks，0 failures |
| `tests/search_active_card.gd` | 137 checks，0 failures |
| `tests/expedition_hud_2.gd` native capture | 381 checks，3 个既有失败；本轮新增断言全部通过 |
| `git diff --check` | 通过 |

HUD 测试剩余三项仍是任务开始前已有的 selection ring / Compatibility move marker 基线断言，不涉及搜索发现点、锚点或奖励反馈。

## 资源与架构

- 未新增 PNG 或其他图片资源。
- 未新增交互系统、任务状态或奖励结算路径。
- SphereMesh、TorusMesh、WorldMarkers 集中更新和现有 LootFeedback 均继续复用。
- 本轮没有扩展空投、特殊事件、战斗目标或车辆 Available Marker。
