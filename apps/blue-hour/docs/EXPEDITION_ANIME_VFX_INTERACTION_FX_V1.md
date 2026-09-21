# Expedition Anime VFX & Interaction FX V1

## 本轮交付

本轮只增强 Expedition / Medium Town 的交互反馈表现，没有修改 Mission 规则、SearchTask 生命周期、Enemy AI、地图生成、Camp、Survivor 模型或大规模 HUD 结构。所有新增表现使用 Godot 原生 Mesh、ImmediateMesh、Shader、Tween 与 Label3D 程序化生成，没有新增 PNG。

## 修改文件

| 文件 | 修改内容 |
| --- | --- |
| `missions/world_interaction_vfx.gd` | 选择环 pop、移动落点方向刻线、指令线末端箭头、搜索完成闪动环、Loot 世界空间飘字。 |
| `ui/mission_hud.gd` | 冷色边缘预警 Shader、蓝时/夜晚短提示、Toast pop、搜索完成和 Loot 信号到世界 VFX 的桥接。 |
| `ui/expedition/world_markers.gd` | 巴士与撤离区低幅 beacon 脉冲、搜索目标状态轻脉冲、危险标记轻脉冲。 |

## 触发条件与表现

| 模块 | 触发条件 | 实现 |
| --- | --- | --- |
| 角色选中 | `set_selected_member()` 切换目标 | 青蓝扁平环从 0.78 倍尺寸 pop 到 1 倍，并配合短淡入。 |
| 地面点击 | 现有 `play_move_feedback()` | 复用环 Shader 的 focus ticks，短促扩散后淡出。 |
| 指令线 | 现有 `play_command_line()` | 0.8 秒青蓝细带状线，末端增加小型三角箭头；仍随幸存者实时重绘。 |
| 搜索开始 | 现有 `play_search_feedback()` | 保留既有搜索目标环，不改搜索玩法。 |
| 搜索中 | `WorldMarkers` 的 busy site | 搜索 marker、建筑高亮和旋转速度保持原有逻辑，仅加低幅 alpha 脉冲。 |
| 搜索完成 | `mission.search_completed` | 目标点播放淡青色完成环，随后自动隐藏。 |
| Loot 获得 | `mission.search_loot_collected` | 在搜索点生成 `+食物 n`、`+废料 n`、`+武器` 的 Label3D，向上漂浮后消失。 |
| 蓝时预警 | `clock.warning_changed` / `watch_warning_changed` | 全屏边缘使用低强度蓝灰 Shader，中央保持清晰；显示“蓝时将至 · 留意归航路线”。 |
| 蓝时开始 | `clock.phase_changed(BLUE_HOUR)` | 边缘冷色层过渡到 0.07 强度，短提示“蓝时开始 · 立即返航”。 |
| 夜间压力 | `clock.phase_changed(NIGHT)` | 边缘层过渡到 0.12 强度，短提示“夜幕降临 · 危险升级”；环境冷蓝过渡继续复用现有 `atmosphere.gd`。 |
| 撤离点 / 蓝时号 | 每帧世界标记更新，且进入预警、蓝时或夜晚时增强 | 撤离区与巴士 marker 低幅 scale pulse，保持原有颜色与交互范围。 |
| 轻量危险 | 现有 focus target 可见时 | 危险 marker 做小幅呼吸缩放，不增加屏幕闪烁或重粒子。 |

## 资源与视觉约束

- 未新增 PNG、贴图、模型或第三方特效框架。
- 颜色集中在青蓝、蓝白、冷灰蓝，奖励文字使用食物暖金、废料浅青、武器淡紫区分。
- 未使用 bloom、写实烟雾、厚重粒子或大型弹窗。
- 搜索完成和 Loot 反馈通过既有 Mission 信号接入，避免在 Mission 核心逻辑中复制玩法状态。

## 验证结果

### 已通过

- `tests/search_active_card.gd`：157 checks, 0 failures。覆盖真实搜索卡、取消、普通移动保持搜索、完成隐藏、相机移动、屏幕边缘、不同建筑朝向和车辆搜索。
- `tests/expedition_hud_phase2.gd`：262 checks, 0 failures。覆盖生产 Expedition HUD、搜索中角色卡、资源栏、动作栏、撤离点 normal/hover/pressed 等截图节点。
- Godot 4.7.2 headless editor import：通过。
- `git diff --check`：目标文件无空白错误。
- GitNexus `detect_changes --scope unstaged`：当前工作树整体风险 low；由于仓库含其他线程改动，报告不把全工作树变化归因于本轮。

### 截图证据

以下截图由真实 Godot 运行时测试生成：

- 搜索中状态：[07_world_interaction.png](../test-output/expedition_hud_phase2/07_world_interaction.png)
- 搜索中幸存者卡：[16_survivor_cards_searching.png](../test-output/expedition_hud_phase2/16_survivor_cards_searching.png)
- 取消搜索 normal：[normal.png](../test-output/search-cancel-spacing/normal.png)
- 取消搜索 hover：[hover.png](../test-output/search-cancel-spacing/hover.png)
- 相机移动后的搜索卡：[camera-pan.png](../test-output/search-cancel-spacing/camera-pan.png)
- 撤离点 normal：[09_return_bus_normal.png](../test-output/expedition_hud_phase2/09_return_bus_normal.png)
- 撤离点 hover：[10_return_bus_hover.png](../test-output/expedition_hud_phase2/10_return_bus_hover.png)

### 未能生成的证据

本轮没有把现有完整 Expedition 视觉测试结果冒充为 VFX 专项录屏。`tests/expedition_visual_runtime.gd` 在标题页阶段即因既有测试入口仍访问已移除的 `title_screen.tabs` 而中止，未进入 Expedition 场景；本轮没有修改该入口。现有 `test-output` 中的旧 Expedition 视频属于此前验证，不能证明本轮所有 VFX 状态均已录制。

## 已知未完成项

- 没有新增独立 VFX capture fixture，因此搜索完成环、Loot 飘字、蓝时边缘层和夜间 banner 尚缺自动截图断言。
- 蓝时号仍使用既有世界 marker 资源，仅增加程序化 pulse，没有新增专用 beacon 图形。
- 危险提示继续复用 focus target 语义，没有扩展敌人感知或新的 Threat 系统。
- 完整 Expedition 录屏需要先修复标题页测试入口与当前 Runtime 的接口漂移，再重新跑 `expedition_visual_runtime.gd`。
