# Expedition MiniMap + World Rendering Polish V1

本轮只处理 Expedition 的 MiniMap 表现、Medium Town 建筑渲染审计，以及多幸存者搜索分配缺陷。没有修改 Mission 规则、SearchTask 生命周期、Loot、Combat 或 Enemy AI。

## 已完成

### MiniMap marker 稳定

- `world_to_minimap()` 的 X/Z 投影在输出前使用 `snappedf(..., 1.0)` 对齐整数像素。
- `map_origin` 同样取整，避免幸存者移动时因相机跟随产生亚像素漂移。
- marker 的 `anchor` 仍来自真实世界坐标；碰撞避让只改变绘制点，不改变世界锚点。

### MiniMap 填充与裁剪

- 原实现把内容强制裁成居中正方形，在宽屏 HUD 中留下左右空白。
- 现在 `minimap_content_rect` 直接使用 framed viewport 的完整可用区域，`LocalWorldClip` 与它保持同尺寸。
- `map_scale` 以长轴对应 70m tactical extent，短轴按同一比例显示；这样保持世界比例，同时让内容填满外框。超出的长轴区域由 clip 裁切。
- 已发现建筑只有在 `world_to_minimap(site.spec.entry)` 落入当前 content rect 时才生成 site marker；离开范围时隐藏，回到范围时重新生成。Arrival、POI、幸存者仍保留边缘指示逻辑。

### 多幸存者搜索

根因在 `Mission.command_search()` 的隐式分配：没有显式传入 survivor 时，总是先拿 `selected_search_member`，即使该角色已经占用已有 SearchTask；随后任务占用检查拒绝第二个目标。

现在只有在选中角色可用时才使用它；选中角色死亡、登车、进入建筑或已有任务时，继续走现有的空闲幸存者 fallback。显式传入一个忙碌 survivor 仍会被拒绝，因此没有放开“同一目标双占用”或引入全局搜索锁。

## 建筑闪烁调查

| 项目 | 检查结果 |
| --- | --- |
| Duplicate Mesh | `TownUrbanView.build()` 为每个 `town.buildings` 项创建一个 `Buildings/<id>` wrapper；Environment、Search Registry 和 MiniMap 不复制建筑 Mesh。审计 fixture 检查 wrapper 名称、`parcel_id` 和运行时 building entry 一一对应。 |
| Z Fighting / 高度层级 | Ground、ground-space、Foundation、Entrance、Road/Sidewalk 使用分层 Y 值；Foundation 为 `-0.005`，Entrance 为 `0.015`，道路/人行道更高。没有发现建筑根节点与入口层共面。 |
| Shadow Bias | `blue_hour/atmosphere.gd` 使用正交阴影、`shadow_bias = 0.04`、`shadow_normal_bias = 2.0`；审计 fixture 验证运行时值。 |
| MSAA / 采样 | `project.godot` 保持 `msaa_3d=3`；建筑材质/导入配置继续使用现有 mipmap 与各向异性策略。 |
| LOD | 本轮未发现 Medium Town 建筑运行时发生 LOD 跳变；没有通过关闭 LOD 或阴影来掩盖问题。 |

结论：本轮未发现新的 duplicate Mesh、Z Fighting 或 LOD 根因。已有视觉报告记录的残余变化主要来自水平薄层的自阴影和屋顶高频材质采样边缘，现有 normal bias、MSAA 和高度分层方案已生效。自动审计能证明结构与配置正确，但不能替代 native 连续帧的人眼闪烁复核，因此“完全无闪烁”仍不是自动测试可证明的结论。

## 修改文件

- `apps/blue-hour/ui/expedition/minimap.gd`
  - 像素取整、完整 framed viewport、长轴 70m 缩放、建筑 marker clipping。
- `apps/blue-hour/missions/mission.gd`
  - 隐式搜索分配跳过已占用的 selected survivor。
- `apps/blue-hour/tests/expedition_minimap.gd`
  - 内容填充、像素取整、越界 marker、双建筑并行搜索契约。
- `apps/blue-hour/tests/expedition_minimap_local.gd`
  - 对像素取整使用 1.1px 容差；验证长轴 tactical extent。
- `apps/blue-hour/tests/expedition_building_render_audit.gd`
  - 新增只读结构/渲染配置审计 fixture，不修改运行时渲染。

## 验收结果

| 验证 | 结果 |
| --- | --- |
| `tests/expedition_minimap.gd` | `E01.5 MINIMAP: 2350 checks, 0 failures` |
| `tests/expedition_minimap_local.gd` | `E01.5 LOCAL FOLLOW: 2351 checks, 0 failures` |
| `tests/expedition_building_render_audit.gd` | `392 checks, 0 failures` |
| `tests/search_command_ownership.gd` | `14 checks, 0 failures` |
| `tests/parallel_commands.gd` | `36 checks, 0 failures` |
| `tests/search_interaction_polish_acceptance.gd` | `15 checks, 0 failures` |
| `tests/survivor_command.gd` | `43 checks, 0 failures` |

`expedition_minimap_local.gd` 的投影断言按实际设计更新为“长轴保留 70m、短轴按比例裁剪”，否则会把宽屏填充行为误报为失败。

本轮没有把 `tests/expedition_visual.gd` 中既有的 HUD tracker、Hover 文案和资产过滤断言失败，或 `tests/search_dispatch.gd` 的既有 dispatch 断言失败，归因于 MiniMap/建筑渲染改动；它们不在本轮变更路径内。

## 截图证据

- [移动中的本地跟随 MiniMap](../test-output/expedition-integration-e01-5-fix/05_local_follow_mid_move.png)
- [POI 越界后的边缘/裁剪状态](../test-output/expedition-integration-e01-5-fix/06_poi_offscreen_edge_marker.png)
- [MiniMap 完整接触表](../test-output/expedition-integration-e01-5-fix/local_minimap_contact_sheet.png)
- [多幸存者并行搜索](../test-output/search-interaction-polish-acceptance/parallel-search.png)
- [Medium Town 建筑总览](../test-output/town-phase-3a-capture/seed_4101_overview.png)

这些截图来自现有 native capture；本轮没有生成新的 PNG 素材，也没有改变建筑模型或材质资源。

## 已知限制

- MiniMap 的“越界隐藏”针对建筑 site marker；Arrival、POI 和 survivor 仍会以边缘指示保留可追踪性。
- 建筑闪烁的连续帧稳定性仍需在目标机器上做 native 录屏复核；当前自动审计覆盖结构、层级和渲染配置，不宣称替代视觉 QA。
- 工作树中其他线程仍有未提交文件；本报告只对应上列 MiniMap、搜索分配和渲染审计改动。
