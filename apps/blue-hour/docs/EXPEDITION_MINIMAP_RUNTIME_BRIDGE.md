# Expedition Integration E01.5 — Medium Town Minimap Runtime Bridge

日期：2026-09-19。E01.5：**TECHNICALLY COMPLETE**。Human Runtime QA：**PENDING**。

后续修正：左下角已改为 **LOCAL FOLLOW / EQUAL UNITS**，当前行为与证据见 [E01.5 Fix](EXPEDITION_MINIMAP_LOCAL_FOLLOW.md)。本页以下记录初始 Runtime Bridge 的历史实现与验证；全镇 fit 不再用于左下角。

正式 Expedition 左下角小地图已消费 Medium Town Runtime，显示当前种子的道路、建筑轮廓、开放空间与主要铺装。三名正式 Survivor 的标记随实际移动更新，Arrival 和 Mission POI 使用 Runtime 坐标。布局、边框及图标资产保持原有来源。

## 原实现审计

| 项目 | 实际工程事实 |
| --- | --- |
| Minimap Root | `ui/mission_hud.gd` 创建的 `Minimap` Control；左下锚点，原逻辑尺寸 320×264，经原 HUD 缩放 |
| World Layer | `ui/expedition/minimap.gd` 的 Control draw；读取 `city.data.districts`、`road_segments`、`city.sites` 中已发现建筑 |
| Marker Layer | 同一个 Control draw；既有 HudArt PNG：队员、选中队员、危险、巴士、地点、目标、搜索 |
| Bounds Source | 原来以 `squad_center()` 为中心、固定 extent=34，X/Z 分别乘面板宽高 |
| Fixed-map Coupling | 小队中心附近的旧地图窗口与旧数据数组；不是固定卫星纹理，没有 Minimap SubViewport 或第二套 Camera |
| Current Dynamic Markers | `_process` 每帧重绘；存活队员、当前选中者、catalog 巴士、已发现地点；地点可切换目标/搜索图标 |
| Current Blank Layer Cause | E00 Adapter 清空 Legacy 道路/区域数组，且 Town 不填充 Legacy 搜索 sites；旧小地图因此没有 Town 几何可画 |
| Click / Route | 原小地图没有移动路线或点击落点标记；`marker_target` 原用途是已选地点。本轮不新增路线系统 |
| Camera | 原绘制不直接读取 Camera，但视野跟随小队中心。Town 分支改为固定于 Runtime bounds，镜头平移不改变坐标 |

## 改动与边界

- `maps/expedition/town_runtime_adapter.gd` 仅新增 `runtime_data.minimap_geometry`：建筑 `id/bounds`、地面与街区空间 `kind/polygon` 的独立快照。复用已有 `road_bounds`、`town_bounds`、`arrival_point`、`mission_poi`；HUD 不运行 Generator。
- `ui/expedition/minimap.gd` 增加 Provider 分支与 `TownWorldLayer` 子 Control。静态绘制命令由 Godot CanvasItem 缓存；首次就绪、源种子/签名变化或面板尺寸变化时重新投影。每帧只检查缓存键并更新五个标记。
- `world_to_minimap(Vector3)` 从 X/Z 到内容矩形；`scale=min(content_width/town_width, content_height/town_depth)`，居中并保留边缘与原标签区。没有写死 Town 长宽或世界中心，四种子覆盖 310×260 和旋转后的 260×310。
- 所有图标复用现有 HudArt。近距离图标按稳定队伍顺序选择不重叠的屏幕位置，细线与小点标出真实投影坐标；这是图标排布偏移，未改 Survivor 的世界位置。图标整体保持在面板内部，选中者沿用现有高亮。
- POI 作为已知任务目标显示，但不设置 `discovered`，不创建 SearchTask，不启用 E02。Arrival 仅作静态巴士标记，不实现 E05。
- Legacy `_draw` 主体与 `_draw_marker` 保持逐字一致；切回 FIXED_LEGACY 隐藏 Town 缓存层。
- 旧小地图没有独立 Fog 纹理。Town 静态概览不按地点发现状态遮挡；世界中的 Exploration 没有改动。正式 Minimap Fog：**DEFERRED_TO_E04**。
- QA Overlay 仅存在于专用截图测试脚本，正常游戏没有该 Overlay。

Town Structure、M00/M01/M01.1/M02/M03 和 E01 Navigation 未改。未改其他 HUD 面板、角色/美术资产、搜索、敌人或撤离系统。

## 自动验证与冻结检查

| 验证 | 结果 |
| --- | --- |
| 测试先行 | `red.log` 确认旧实现缺少 `world_to_minimap`；实现后重新验证 |
| E01.5 Headless | **1,311 checks / 0 failures**；种子 4101–4104，与冻结 Generator 逐项对照道路/建筑/区域，等比 fit、resize、确定性、镜头独立、实际移动、图标边界/分离及复用组件换种子 |
| E01.5 原生 | **1,186 checks / 0 failures**；正式 Mission/HUD/三名 Survivor，真实鼠标点击经生产输入逻辑下令；全程生产导航，无角色瞬移 |
| E00 回归 | **58 checks / 0 failures** |
| E01 回归 | **240 checks / 0 failures** |
| E01 原有冻结集 | **633 / 633** 哈希不变 |
| M03 原有冻结集 | **622 / 622** 哈希不变 |
| 本轮附加保护集 | **105 / 105**：非 Minimap UI、Mission、E01 Navigation 及原 E01 测试 |
| Adapter 导航部分 | 从 `_build_navigation` 开始的全部代码与执行前快照一致；额外数据代码见 `adapter.diff` |
| 最终专项运行日志 | Missing Resource=0；Invalid UID=0；Runtime Error=0；Warning=0 |

上述结果对应本轮专项日志，不代表整个仓库所有测试通过。开发期间的失败日志只作为测试先行记录，不混入最终通过结果。

## 性能记录

当前设备 Godot 4.7.2，Windows / RTX 3060，Compatibility。以下是正常尺寸缓存构建的 CPU 时间和每种子 200 次标记更新平均时间；不含 Town 生成、不作为整帧 GPU 基准。

| Seed | 静态命令数（含背景/边界） | 缓存构建 ms | 每次动态更新 µs |
| --- | ---: | ---: | ---: |
| 4101 | 252 | 0.557 | 38.330 |
| 4102 | 253 | 0.949 | 33.275 |
| 4103 | 249 | 0.631 | 36.085 |
| 4104 | 255 | 0.953 | 42.310 |

新增地图 Texture 分配：0；新增 SubViewport：0；新增 3D Camera：0。既有图标纹理由 HudArt 缓存复用。51.467 秒移动中静态构建计数保持不变，POI 投影保持不变；标记每帧更新。

## 原生证据

证据目录：[expedition-integration-e01-5](../test-output/expedition-integration-e01-5/)。

- [Arrival 初始画面](../test-output/expedition-integration-e01-5/01_minimap_town_ready.png)
- [道路与建筑原尺寸裁图](../test-output/expedition-integration-e01-5/02_minimap_roads_buildings.png)
- [Arrival 标记](../test-output/expedition-integration-e01-5/03_minimap_arrival_markers.png)
- [移动途中](../test-output/expedition-integration-e01-5/04_minimap_mid_movement.png)
- [抵达 Mission POI](../test-output/expedition-integration-e01-5/05_minimap_at_mission_poi.png)
- [Seed 4102](../test-output/expedition-integration-e01-5/06_seed_4102_minimap.png)、[Seed 4103](../test-output/expedition-integration-e01-5/07_seed_4103_minimap.png)、[Seed 4104](../test-output/expedition-integration-e01-5/08_seed_4104_minimap.png)
- [Legacy 原生回归](../test-output/expedition-integration-e01-5/09_legacy_minimap.png)
- [六图总览](../test-output/expedition-integration-e01-5/minimap_contact_sheet.png)
- [Arrival → Mission POI 视频](../test-output/expedition-integration-e01-5/minimap_realtime_arrival_to_poi.mp4)：1600×900、30 fps、1,544 帧、51.467 秒。

视频通过原生 Godot 逐帧截图编码；测试固定按 1/30 秒推进生产移动逻辑，并非桌面墙钟录屏。`capture-manifest.json` 保留截图时刻和每 15 帧的世界/投影/排布坐标采样。已检查初始、途中、抵达及四种子原生画面；人工可读性和操作体验仍需用户验收。

复跑入口：`tests/expedition_minimap.gd`（Headless）、`tests/expedition_minimap_capture.gd`（原生 1600×900、`--fixed-fps 30`）；使用独立 `user://test-runs/expedition-minimap-*` 存档。

## 交付状态

Windows build 已实际执行并失败。Import、Search Gameplay 72 项、Expedition HUD Phase2 258 项、Survivor Command 45 项、Search Active Card 157 项、Settings 14 项通过，随后在既有 `tests/camp_ui_runtime.gd:114` 访问不存在的 `member_buttons` 时出现错误，并触发 `Camp exposes active abilities on its left edge` 断言。日志：[windows-build.log](../test-output/expedition-integration-e01-5/windows-build.log)。

未改 Camp 或旧测试绕过构建门禁；未产生本轮新独立 EXE，也未宣称旧 EXE 包含本次修改。专项原生证据来自当前 Godot 工程。本轮启动的验证与编码进程均已退出。

```text
E01.5: TECHNICALLY COMPLETE
Human Runtime QA: PENDING
E02 Search: NOT STARTED
E03 Enemy: NOT STARTED
E04 Full HUD / Minimap Polish: NOT STARTED
E05 Blue Hour / Extraction: NOT STARTED
```

上述 NOT STARTED 指 Medium Town 集成后续阶段，不否认仓库已有 Legacy 系统。停止于 E01.5 人工验收，不自动推进后续阶段。
