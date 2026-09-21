# Expedition Interaction Polish V2

## 范围

本轮只调整 Expedition Interaction Presentation Layer，覆盖“发现建筑 → 下达搜索 → 幸存者前往 → 搜索中 → 完成 → Loot → 返航”的视觉连续性。没有修改 Mission、SearchTask 生命周期、Loot 数值、Enemy AI、地图生成、Navigation、Survivor 模型、Camp 或 HUD 大结构。

## 修改文件

| 文件 | 修改 |
| --- | --- |
| `missions/world_interaction_vfx.gd` | 指令线增加两段轻量流动 chevron 和末端箭头；Loot 反馈改为现有资源图标 + Label3D，武器反馈使用更长的显示时间和淡紫色。保留搜索完成环、选中 pop 和既有落点环。 |
| `ui/expedition/world_markers.gd` | Hover、Selected、Searching 建筑轮廓分层；Selected 轮廓更清楚但仍为细线；搜索中保持低幅 pulse。撤离区、巴士 marker 与巴士文字同步低幅 pulse。 |
| `ui/expedition/poi_context.gd` | 建筑被点击成为 Selected 时，已有发现卡做一次短 pop；Hover 不触发动画，避免鼠标移动抖动。 |
| `docs/EXPEDITION_INTERACTION_POLISH_V2.md` | 本交付报告。 |

## 技术实现

- 指令线继续使用 `ImmediateMesh` 和现有青蓝 `StandardMaterial3D`，不创建第二套路线系统。
- 流动方向通过短时 chevron 的位置推进、终点三角箭头和轻微 alpha 呼吸表达，持续时间仍为约 `0.8s`。
- Loot 使用既有 `HudArt` 图标：食物复用 `icon_bag`，废料复用 `icon_loot`，武器复用 `weapon_ranged`；文字使用既有 `Visuals.label()`。
- 搜索完成继续复用 `mission.search_completed`，Loot 继续复用 `mission.search_loot_collected`，不改变信号时序。
- 建筑高亮继续使用 `SearchHoverHighlight` 线框，只调整颜色、透明度和低幅 scale pulse。
- 返航反馈继续复用 `ReturnZone`、`BusMarker` 和 `bus_label`，不新增 beacon 贴图。

## 状态流程

```text
Hover
  -> 细线轮廓 + 可搜索发现卡
Selected
  -> 更清晰轮廓 + 发现卡短 pop
Search Command
  -> 搜索目标环 + 青蓝指令线 + 终点箭头/流动 chevron
Approaching
  -> 指令线随幸存者位置重绘，完成后自然淡出
Searching
  -> 搜索 marker / 建筑轮廓轻 pulse + 现有搜索卡
Complete
  -> 完成环短闪 + 现有完成 Toast
Loot Collected
  -> 资源图标 + 飘字，上移后淡出
Blue Hour / Extraction
  -> 现有冷色预警 + 撤离区/巴士/文字低幅 pulse
```

## 截图证据

这些截图由现有 Godot 运行时测试生成：

- [建筑搜索中 / 世界交互](../test-output/expedition_hud_phase2/07_world_interaction.png)
- [搜索中幸存者状态](../test-output/expedition_hud_phase2/16_survivor_cards_searching.png)
- [取消搜索 normal](../test-output/search-cancel-spacing/normal.png)
- [取消搜索 hover](../test-output/search-cancel-spacing/hover.png)
- [相机移动后的搜索卡](../test-output/search-cancel-spacing/camera-pan.png)
- [返航 marker normal](../test-output/expedition_hud_phase2/09_return_bus_normal.png)
- [返航 marker hover](../test-output/expedition_hud_phase2/10_return_bus_hover.png)

## 录屏

本轮没有生成新的完整流程录屏。当前运行时 capture 脚本主要输出 PNG；`tests/expedition_visual_runtime.gd` 仍在标题页阶段访问已移除的 `title_screen.tabs`，无法进入 Expedition 流程，因此不能把旧视频作为 V2 录屏证据。

## 验证

- `tests/search_active_card.gd`：157 checks，0 failures。
- `tests/expedition_hud_phase2.gd`：262 checks，0 failures。
- 两次测试均覆盖真实 Mission/HUD 装配；第二次重跑确认 Loot 图标节点加入顺序不会产生 `!is_inside_tree()` Runtime Error。
- `git diff --check`：目标脚本无空白错误。
- 未新增 PNG、模型、粒子框架或玩法系统。

## 已知未完成项

- 没有新增专门的 V2 capture fixture，因此 Hover/Selected/Searching/Complete/Loot 的逐态截图仍依赖现有运行时截图集合。
- 完整“发现房屋 → 点击 → 移动 → 搜索 → Loot → 返回”录屏需要先修复既有标题页测试入口接口漂移。
- 蓝时撤离仍使用现有环境色彩和世界 marker 资源，未加入新的路线绘制或专用 beacon 素材。
