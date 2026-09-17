# Expedition 搜索状态卡位置异常分析报告

日期：2026-09-17

状态：原始只读分析已归档；后续定位修复已实施，验证见下节。
范围：搜索卡定位链路；不调整卡片样式、内容、素材或搜索玩法。

用户反馈：幸存者在建筑上方位置搜索，搜索状态卡却显示在建筑下方、偏向马路。第 1–6 节保留修复前的只读分析，行号与代码片段对应当时版本。

## 后续修复与验证（2026-09-17）

用户确认根因后，已仅修改定位实现 `poi_context.gd` 与对应 `tests/search_active_card.gd`；`search_card.gd`、四张 PNG、`city.gd` 和 SearchTask 保持不变。

- 移除整栋建筑的四向候选、AABB 投影与缓存；沿用 SearchUIAnchor 和 world → screen 转换。
- 正常位置为 `point - Vector2(card.size.x / 2, card.size.y + 12)`，指针在搜索锚点上方约 12 个 UI 单位。
- HUD/屏幕限位与锚点附近的允许区域取交集：相对默认位置横向最多 24、纵向最多 12。平滑后的最终位置也受相同边界限制，不会因相机移动滞后而跨到建筑另一侧。
- 极端靠边、锚点附近无法完整容纳卡片时隐藏；空间恢复后重新显示，不把卡片挤到远处。
- 原生 Godot 正式 Mission/HUD 专项 137 项通过。覆盖默认方向与距离、12 次连续平移、20/35 镜头缩放、0°/90°/180° 建筑朝向、左右/顶部边缘、极端边缘恢复、1366×768 / 1920×1080 / 2560×1440，以及原有搜索生命周期与 Hover 检查。

证据为独立内存 Campaign、正式搜索任务和合成鼠标输入；不是用户当前存档的人工操作录像。截图由 Godot 原生渲染采集，没有合成或添加指示图形。

| 验证场景 | 实际截图 |
| --- | --- |
| 站前住宅，恢复入口上方定位 | [normal-full.png](../test-output/search-card-position/normal-full.png) |
| 镜头连续平移 | [camera-pan-full.png](../test-output/search-card-position/camera-pan-full.png) |
| 0° 建筑 | [orientation-corner-full.png](../test-output/search-card-position/orientation-corner-full.png) |
| 90° 建筑 | [orientation-yard_repair-full.png](../test-output/search-card-position/orientation-yard_repair-full.png) |
| 顶部边缘微调 | [edge-top-full.png](../test-output/search-card-position/edge-top-full.png) |
| 左侧边缘微调 | [edge-left-full.png](../test-output/search-card-position/edge-left-full.png) |

逐场景锚点、指针和间距记录在 [runtime.json](../test-output/search-card-position/runtime.json)。构建与独立 EXE 验收状态见 [实施计划](PLAN.md)。

实际坐标采样（UI 局部单位）：默认位置指针与锚点横向误差小于 0.01、纵向间距约 12.42；左右边缘分别调整约 16，顶部边缘间距约 4；三种建筑朝向的默认纵向间距均约 12.42。小数差异来自屏幕像素对齐。

定位修复后的 Windows release 已导出；独立目录 EXE 菜单 native、Expedition headless/native 启动通过。挂载内嵌包后，锚点位置、素材、进度、渲染和取消检查通过，见 `test-output/search-position-pack.log`；该临时探针退出时另报告 2 个 ObjectDB 实例泄漏警告，未作为无警告通过记录。完整 `run.ps1 -Mode build` 的 HUD 258 项、搜索卡 137 项、设置 14 项通过，随后仍被旧 Camp 测试的 `member_buttons` 接口与旧能力栏断言阻断。本轮未修改营地或搜索玩法。

以下为修复前的原始分析。

## 1. 当前 SearchCard 的完整定位链路

```text
地点数据 spec.entry（搜索入口）
  -> City.register_site()
  -> 在目标 body/Anchors 下创建 SearchUIAnchor
  -> anchor.global_position = entry + Vector3.UP * 高度
     建筑高度偏移 2.0m，车辆 1.8m
  -> sites[id].search_anchor 保存该节点
  -> PoiContext._process() 每帧调用 _project_cards()
  -> _project() 读取 search_anchor.global_position
  -> Camera3D.unproject_position()：世界坐标转 viewport 坐标
  -> PoiContext.get_global_transform().affine_inverse()
     将投影坐标转到 PoiContext 局部坐标 point
  -> 初始位置 = point - Vector2(卡片半宽, 卡片高度 + 12)
  -> 按左右 HUD、顶部时间栏及底部预留区限制位置
  -> 建筑投影包围框避让：重新选择上、右、左、下候选位置
  -> 平滑、像素对齐、再次限位
  -> 写入 card.position
  -> 经 MissionHUD 缩放、CanvasLayer、viewport stretch 显示
```

UI 层级为 `CanvasLayer -> MissionHUD -> PoiContext -> SearchActiveCard`。正式流程中的 CanvasLayer 使用默认变换；MissionHUD 根据窗口尺寸设置缩放，PoiContext 的逆全局变换负责将投影坐标还原到相应局部坐标。最终写入的是 `card.position`，没有将同一个结果再次写入 `card.global_position`。

源码依据：

| 环节 | 文件及当前行号 |
| --- | --- |
| 创建搜索 UI 锚点 | [maps/city.gd](../maps/city.gd)，41–55 行 |
| CanvasLayer 创建与 HUD 挂载 | [core/main.gd](../core/main.gd)，98–100、520–522 行 |
| PoiContext 挂载与 HUD 缩放 | [ui/mission_hud.gd](../ui/mission_hud.gd)，93–96、121–127 行 |
| 世界投影及最终定位 | [ui/expedition/poi_context.gd](../ui/expedition/poi_context.gd)，96–145 行 |
| 建筑包围框生成与投影 | 同上，147–164 行 |

## 2. 实际绑定的节点与坐标

实际读取：

```gdscript
mission.city.sites[id].search_anchor.global_position
```

该字段指向运行时创建的 `SearchUIAnchor`。它不是 Survivor 的 `global_position`，不是建筑根节点原点，也不是模型已有的 `InteractionPoint` 或 `SearchMarker`。

虽然节点挂在建筑的 `Anchors` 下面，但创建时明确赋值其世界坐标为 `spec.entry + 高度偏移`，不能仅凭父节点是建筑就判断使用了建筑原点。

搜索任务也使用 `spec.entry`：派遣时将其作为移动目标；室内搜索开始前执行 `worker.position = entry`。相关逻辑见 [missions/search_task.gd](../missions/search_task.gd) 的 21、124–139 行。因此，入口数据与搜索目标同源；本次大幅下偏的直接原因不在于把建筑原点当成搜索入口。

### 幸存者移动后的更新行为

- 卡片每帧重新读取锚点并进行投影，相机移动时会更新。
- 当前逻辑没有读取执行者的位置，幸存者单独移动不会带动卡片锚点移动。
- `SearchUIAnchor` 的高度和位置在地点注册时设置，没有每帧同步至执行者。
- 普通移动指令取消任务后，卡片隐藏；这不等于卡片跟随了角色。
- 建筑世界 AABB 首次计算后缓存，每帧只重新投影其八个角点；当前策略以静态建筑为前提。

## 3. Root Cause

**上轮新增的整栋建筑避让算法覆盖了搜索点上方的初始定位，并允许将卡片重新放到建筑下方。**

`_project()` 的初始位置原本是搜索锚点上方。随后 `_projected_building_bounds()` 合并目标建筑下所有 Mesh 的世界 AABB，投影出一个包住建筑的二维矩形，再计算四个候选位置。

候选评分为：

```text
score = 与建筑矩形的重叠面积 × 10000
        + 与初始限位位置的距离平方
```

该评分强烈偏好不与建筑矩形重叠的位置，但没有限制：

- 卡片必须保持在搜索点上方；
- 卡片距离实际搜索点不得过远；
- 下方候选不能跨过整栋建筑；
- 素材自带的向下指针应继续对应目标位置。

当下方候选的评分更低时，代码直接用它替换初始位置。搜索点投影本身即使正确，最后显示的位置也会偏到建筑底边之外。

### 与旧 POI UI 的关系

旧 POI 的静态入口锚定、HUD 限位和平滑逻辑仍在使用；新增搜索卡替换了表现，定位仍由 `poi_context.gd` 管理。此次明显向下偏移的直接触发点是上轮新增的建筑四向避让，而非卡片自身内部布局。

现有 [tests/search_active_card.gd](../tests/search_active_card.gd) 第 48 行只断言卡片不与整栋建筑的投影矩形相交，没有验证它与实际搜索点的方向和距离。这使得“放到马路上但不遮挡建筑”也能通过原测试。

## 4. 为什么会向下偏这么多

下方候选的纵坐标为：

```text
card.y = bounds.end.y + 12
```

`bounds.end.y` 是整栋建筑投影矩形的底边，不是搜索点，也不是幸存者脚下位置。该表达式把卡片顶部放到建筑底边下方，因此整张卡片都落在建筑下方区域。

当前卡片高 96。暂不考虑 HUD 限位与平滑时：

```text
原始顶部 = point.y - 96 - 12
下方顶部 = bounds.end.y + 12
下移量   = bounds.end.y - point.y + 120
```

这里的量是 UI 局部坐标单位，实际屏幕像素还取决于 HUD 与 viewport 缩放。该公式说明偏移由整栋建筑的投影范围参与决定，不是多加了一个小间距。本报告未测量用户当前现场的精确下移像素值。

投影 AABB 又比真实可见建筑轮廓更保守；候选经过顶部和侧边 HUD 限位后，还可能重新与建筑矩形相交，进一步提高下方候选胜出的可能性。

### 重复 offset 排查

| 项目 | 当前行为 | 是否解释此次大幅下偏 |
| --- | --- | --- |
| World offset | 入口向上 2.0m，车辆 1.8m | 不解释；用于抬高锚点 |
| Screen offset | 减去半宽及高度加 12 | 不解释；原本将卡片放在锚点上方 |
| Card pivot | 卡片未额外设置 pivot 或自身缩放 | 未发现重复中心偏移 |
| Anchor offset | 已包含在锚点世界坐标内，投影后未再次加同一高度 | 未发现重复应用 |
| CanvasLayer | 正式流程未设置额外变换 | 未发现额外平移 |
| Viewport transform | 逆 HUD 变换后定位；stretch 用于屏幕像素对齐 | 未发现本次下偏由重复缩放造成 |
| 建筑避让 | 用 `bounds.end.y + 12` 等候选覆盖初始位置 | 直接原因 |

## 5. 最小修复方案

以下均为建议，尚未实施。

1. 保留搜索入口锚点及现有 world → screen 转换。
2. 取消按整栋建筑上、右、左、下重新选址，以搜索点上方固定间距作为主定位。
3. 保留必要的屏幕边界和 HUD 限位；如仍需建筑避让，只允许在搜索点附近作有限调整，不允许跳到整栋建筑的另一侧。
4. 将位置验收改为检查卡片相对搜索点的方向、距离和指针对应关系，同时继续检查文字、按钮、Hover 尺寸及搜索状态行为。

若后续明确要求卡片随执行者移动，可改用当前任务 `worker.global_position + 高度偏移` 作为主锚点；这不是修复本次大幅下偏的必要步骤。仅更换世界坐标来源而保留现有四向避让，仍可能再次被推到建筑下方。

建议修复后覆盖建筑朝向变化、相机平移与缩放、屏幕边缘、不同分辨率和并行搜索。正确贴近搜索点与避免遮挡建筑应同时检查，不能只以整栋投影矩形零交叠作为成功标准。

## 6. 需要修改的文件

| 文件 | 建议修改 |
| --- | --- |
| [ui/expedition/poi_context.gd](../ui/expedition/poi_context.gd) | 修改 `_project()` 的建筑避让策略；若不再使用包围框，移除相应计算与缓存 |
| [tests/search_active_card.gd](../tests/search_active_card.gd) | 调整整栋建筑矩形零交叠断言，补充相对搜索点方向、距离及边界场景验证 |

最小方案无需修改 `search_card.gd`、PNG 素材、`city.gd` 或搜索玩法。

## 记录与验证边界

- 本次只新增分析报告，未修改代码、素材、测试或构建产物。
- 已只读核对锚点创建、搜索目标、CanvasLayer/HUD 层级、投影、避让、缓存、平滑和现有测试断言。
- 未进行新的游戏运行、现场坐标采样或修复后验收；历史通过的测试不代表此次定位问题已解决。
- 不调整实施计划完成项：本报告记录分析结论和待实施建议，不将修复标记为完成。
