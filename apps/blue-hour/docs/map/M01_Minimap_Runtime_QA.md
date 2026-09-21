# M01 MiniMap Runtime QA

## 测试范围

本次只验证 Random Town MiniMap 是否反映当前 Expedition 随机地图，不修改生产代码、不修复发现的问题。

- Godot runtime：`Godot_v4.7.2-stable`
- Seed：`4101`、`4102`、`4103`、`4104`、`4105`
- 每个 seed 创建一次 `MEDIUM_TOWN_V1` Expedition，在初始静态帧保存世界图和 MiniMap 裁剪图。
- 结构观测原始数据：[observations.json](../../test-output/m01-minimap-runtime-qa/observations.json)
- 本次截图没有移动队伍，也没有强行注入 SearchTask；因此 Marker 结论只覆盖初始运行时状态。

## Seed 记录

| Seed | 世界地图截图 | MiniMap 截图 | Runtime 观测 |
| --- | --- | --- | --- |
| 4101 | [world](../../test-output/m01-minimap-runtime-qa/seed_4101_world.png) | [minimap](../../test-output/m01-minimap-runtime-qa/seed_4101_minimap.png) | 13 roads（main 1 / secondary 10 / connector 2），55 buildings，5 markers |
| 4102 | [world](../../test-output/m01-minimap-runtime-qa/seed_4102_world.png) | [minimap](../../test-output/m01-minimap-runtime-qa/seed_4102_minimap.png) | 13 roads（main 1 / secondary 10 / connector 2），55 buildings，7 markers |
| 4103 | [world](../../test-output/m01-minimap-runtime-qa/seed_4103_world.png) | [minimap](../../test-output/m01-minimap-runtime-qa/seed_4103_minimap.png) | 13 roads（main 1 / secondary 10 / connector 2），55 buildings，8 markers |
| 4104 | [world](../../test-output/m01-minimap-runtime-qa/seed_4104_world.png) | [minimap](../../test-output/m01-minimap-runtime-qa/seed_4104_minimap.png) | 13 roads（main 1 / secondary 10 / connector 2），55 buildings，7 markers |
| 4105 | [world](../../test-output/m01-minimap-runtime-qa/seed_4105_world.png) | [minimap](../../test-output/m01-minimap-runtime-qa/seed_4105_minimap.png) | 13 roads（main 1 / secondary 10 / connector 2），55 buildings，5 markers |

## 检查结果

### 道路

- **几何数据存在**：5 个 seed 均记录 13 条道路，包含主路、支路和 connector polygon；宽度字段也存在。
- **视觉偏差**：MiniMap 截图中道路没有呈现为可辨认的道路面或路口网络，主要只能看到深色底上的少量细水平线。世界图中的宽主路、支路方向和路口无法在 MiniMap 中稳定对应。
- **结论**：数据层通过；视觉表达不通过。主路是否显示、支路是否显示、方向和宽度是否合理，单凭当前 MiniMap 均无法可靠判断。

### 建筑

- **几何数据存在**：每个 seed 均记录 55 个静态建筑，含位置、尺寸、yaw/orientation 和 polygon。
- **视觉偏差**：世界图中可见的建筑体量、轮廓和朝向没有在 MiniMap 中以建筑 footprint 呈现。MiniMap 只显示少量房屋/POI 类图标，无法核对建筑位置、尺寸或旋转。
- **结论**：建筑静态结构已进入 runtime geometry，但当前 MiniMap 视觉表达不通过。

### Arrival

- **几何数据存在**：5 个 seed 均有 Arrival 的 bus stop polygon、road polygon、entrance polygon 和 exit/point；4101、4105 为 `Arrival_MainEnd`，4102–4104 为 `Arrival_ResidentialEdge`。
- **视觉结果**：MiniMap 能显示蓝时号巴士图标，并且图标与世界初始出生区域同向对应。
- **偏差**：周围道路区域、停车区域、入口 zone 没有形成可读的 Arrival 面积结构；巴士图标之外，玩家无法从 MiniMap 判断停靠区在道路中的具体空间关系。

### Marker

| Marker | 观测结果 | 结论 |
| --- | --- | --- |
| Survivor | 每个 seed 均有 3 个 survivor marker；marker 记录 world、anchor、point，拥挤时有偏移/连线 | 图标可见且有地图空间参照；但由于底图道路/建筑不可读，无法判断队员位于城市的哪一类空间 |
| Vehicle | 5 个 seed 均无独立 vehicle marker；只有 Arrival 巴士 landmark | 未覆盖/缺失，世界中的车辆没有对应 MiniMap 空间标记 |
| POI | 每个 seed 均有 `poi` landmark；部分 seed 另有已发现 `site:*` POI marker | marker 可见；越界 POI 使用边缘锚点和引导线，但底图不足以确认其道路/建筑关系 |
| Search | 5 个 seed 的 `search_marker_count` 均为 0 | 未覆盖：当前 runtime 导航/搜索命令被阻断，无法在真实运行中建立 SearchTask；没有伪造 Search marker 结果 |

## 偏差记录

1. **道路不像道路**：MiniMap 主要显示参考线/低对比底色，宽路、支路、路口和方向无法从视觉上辨认。
2. **建筑 footprint 不可见**：55 个静态建筑虽有 geometry 数据，但 MiniMap 没有呈现可核对的轮廓、尺寸或旋转。
3. **Arrival 空间表达不足**：巴士图标存在，但停靠区、道路连接、停车区和入口没有形成清晰的缩略地图区域。
4. **车辆缺少独立 marker**：未观察到 Vehicle marker；runtime 中 `vehicle_search_points` 仍为 `NOT_AVAILABLE_YET`。
5. **MiniMap 缺少城市空间参照**：初始画面下，玩家和 POI 图标漂浮在近似空白底图上，无法判断自己位于城市的道路、建筑或 Arrival 哪一侧。

## 阻断与限制

- 本次捕获停留在初始静态帧；未执行移动流程，因此未验证跟随队伍移动时 MiniMap 滚动后的几何一致性。
- Random Town runtime 当前 `navigation_available`/`gameplay_available` 为 false，搜索命令会被拒绝；因此 Search marker 只能记录为未覆盖，不能作为“已验证没有 Search marker”的功能结论。
- 运行日志显示 5 个 seed 均成功生成 MiniMap cache（`roads=13`、`buildings=55`），截图和结构观测均已保存。

## QA 结论

本次运行确认随机地图 geometry 已进入 `mission.runtime_data.minimap_geometry`，但当前 MiniMap 截图仍不足以作为真实城市缩略地图：道路、建筑和 Arrival 的空间关系不可读，Vehicle/Search 也未形成完整的动态空间参照。以上均为 QA 记录，未在本次任务中修复。
