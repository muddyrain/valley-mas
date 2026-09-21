# Map Phase 1.1.5 — MiniMap Geometry Full Snapshot

Status: `TECHNICALLY COMPLETE`

Human Runtime QA: `PENDING`

## 目标

让随机 Town 的 MiniMap 表达真实城市几何，而不是只显示道路矩形和动态图标。Runtime 继续以 `mission.runtime_data` 为唯一 HUD 数据入口；MiniMap 不扫描世界节点、Mesh 或 Generator。

## Runtime 快照

`runtime_data.minimap_geometry` 现在包含：

- `version: 2`。
- `roads[]`：`centerline`、`polygon`、`bounds`、`width`、`type/kind` 和稳定 `id`。
- `buildings[]`：静态全量建筑的 `polygon`、`bounds`、`position`、`size`、`yaw`、`orientation`、`type/category`、`land_use_type`、`asset` 和入口坐标。未发现建筑也会出现。
- `parking[]`：环境快照中的停车地块 polygon。
- `arrival`：蓝时号停靠区、对应道路、出口走廊、全部停车地块、近邻停车地块和分区列表。

旧 `road_bounds` 与建筑 `bounds` 仍保留，MiniMap 对缺少新 polygon 的旧数据使用矩形回退。

## 渲染行为

`TownWorldLayer` 按道路 polygon 绘制主路和支路，并绘制轮廓；停车区、Arrival 停靠区/出口和静态建筑轮廓使用独立色阶。动态 Survivor、Arrival、POI 和地点 marker 仍以 XZ 世界坐标投影；图标分离只改变屏幕位置，tether 端点保留真实地图空间参照。

## 验证

- `tests/expedition_minimap.gd`: **2,131 checks / 0 failures**，覆盖 4101–4105、道路 polygon、建筑静态字段、Arrival 分区、停车快照、缓存复用、resize、marker 投影和 Legacy 回退。
- `tests/runtime_loading_gate.gd`: **121 checks / 0 failures**。
- `tests/expedition_minimap_local.gd`: 2,180 checks，1 个队伍中心断言失败；失败不涉及本轮几何数据或渲染命令，需后续单独处理既有 roster fixture。
- 原生 `tests/expedition_minimap_capture.gd` 已启动并完成首帧 MiniMap 构建；在既有“世界点击命令三人均收到路径”断言处停止，未宣称原生全流程通过。

完整 Windows build 未执行到本轮交付，现有门禁仍受 Camp `member_buttons` / 左侧能力栏回归阻断。人工视觉验收仍待进行。
