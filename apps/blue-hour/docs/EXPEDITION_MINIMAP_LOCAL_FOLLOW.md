# E01.5 Fix — Local Follow Minimap + Equal-Footing Survivor Markers

日期：2026-09-19。状态：**TECHNICALLY COMPLETE**。Human Runtime QA：**PENDING**。

左下角 Minimap 已从整镇缩放改为 **LOCAL FOLLOW**。中心始终复用 `mission.squad_center()`，即所有存活出征 Survivor 的位置平均值；默认半径 35m，固定显示约 70×70m。三名成员使用相同尺寸的轻量圆环 marker，中心点表达位置，移动状态呼吸，搜索状态显示旋转弧线。

## 修改范围

正式实现仅修改 `ui/expedition/minimap.gd`。Town Runtime Adapter、Town Structure、M00–M03、E01 Navigation、Mission 和其他 HUD 面板未由本轮修改。

- 保留 Runtime 道路、建筑轮廓、地面区域、Arrival、POI、种子与 Provider 数据；不修改 Town 生成或 Runtime Bridge。
- `world_to_minimap()` 以小队中心和固定范围投影；Camera pan、头像选择和 Town 大小不影响范围。正方形内容区域置于原有矩形边框中，不改变 HUD 锚点与布局。
- 静态底图按世界坐标构建并缓存。`LocalWorldClip` 裁切超出局部窗口的部分，运动只更新世界层的平移/缩放变换。换种子重建缓存；移动与面板 resize 不重建道路、建筑或区域命令。
- 所有存活 Survivor 使用 `draw_circle` / `draw_arc` 绘制轻量圆环 marker，不再依赖头像或角色图片，也不记录 `selected` 状态。中心点表达位置，普通状态显示完整外圈，移动状态轻微呼吸，搜索状态显示旋转弧线。
- 相邻 marker 使用与选择无关的固定候选位置分离，连线端点仍是真实投影。世界角色查看/操作不会改变小地图 marker 的大小、纹理、坐标或显示状态；输入、导航队形和职业规则保持不变。
- 离开窗口的 POI、Arrival 和分散 Survivor 沿真实方向与边缘内缩矩形求交；复用原图标及小方向尖角。拥挤时沿同一边分离，保留真实边缘锚点连线。不会触发全镇 zoom out。
- 已发现地点继续使用现有地点 / selected target / search target 图标；未发现地点不显示内容。Town 尚未接入 E02，测试只通过隔离 fixture 验证既有 `sites` 数据形状和发现边界，不创建正式 SearchTask。
- 原 E01.5 全镇等比投影保留为 `world_to_overview(world_pos, content_rect)`，仅作为未来 Full/Tactical Map 数据基础；左下角不调用它，本轮没有实现全图 UI。
- FIXED_LEGACY 的原地图来源与局部窗口保留；其 Survivor 也使用相同的基础圆环绘制。原来的头像、选中 24px / 未选中 12px 差异被本轮平等表达规则替代。

没有新增贴图、SubViewport、3D Camera、Fog、敌人、搜索玩法或撤离逻辑。原 E01.5 静态地理底图继续保留，不增加未知战利品、敌人或建筑内部信息；正式 Fog 仍为 DEFERRED_TO_E04。

## 验证

| 验证 | 结果 |
| --- | --- |
| 测试先行 | `red.log` 确认旧版不是 LOCAL_FOLLOW；修复后通过 |
| E01.5 Runtime Bridge 回归 | **1,319 checks / 0 failures**；4101–4104 数据逐项对照冻结 Generator、种子切换、Legacy、统一坐标和保留的 overview 投影 |
| Local Follow 专项 | **1,810 checks / 0 failures**；四种子固定 70×70m、镜头/选择独立、等尺寸三人标记、成员死亡/离队/分散、边缘方向、已知/未知地点、移动滚动及静态缓存 |
| 原生选择与移动 | **386 checks / 0 failures**；真实头像点击选择 B、C，三人通过生产导航抵达 POI，再走离 POI |
| Survivor Marker V2 专项 | **19 checks / 0 failures**；静止、移动、搜索三种状态均检查三名成员平等显示、无头像纹理、无小地图选择状态 |
| 最终三份专项日志 | Missing Resource=0；Invalid UID=0；Runtime Error=0；Warning=0 |
| E01 冻结集 | **633 / 633** 未变化 |
| M03 冻结集 | **622 / 622** 未变化 |
| 本轮附加保护集 | Adapter、全部 Mission/Navigation、其他 UI、上一轮 PNG/MP4 共 134 项；仅 `ui/camp_hud/loadout_panel.tscn` 检测到其他工作带来的并行变化，本轮没有编辑或还原它。其余 133 项一致 |

Bridge 回归更新了被新需求替代的旧断言：左下角全镇 fit 改为局部跟随，overview fit 单独测试；resize 改为变换而非重建。道路/建筑/区域数据对照和 Legacy 检查保留。历史 E01.5 截图、视频没有被覆盖。

初次并行执行时，原有 fixture 的固定测试存档名引发启动冲突；已在测试存档名加入进程 ID，复跑成功。这是测试隔离修正，未修改生产存档。失败日志 `bridge-save-race.log` 保留，不计入最终通过结果。

## 性能

Godot 4.7.2 / Compatibility。四种子均为单次静态构建，尺度始终为 2.4 个逻辑像素/米（原面板逻辑尺寸下）。

| Seed | 静态命令数 | 构建 ms | 动态更新平均 µs |
| --- | ---: | ---: | ---: |
| 4101 | 252 | 0.404 | 67.270 |
| 4102 | 253 | 0.416 | 41.385 |
| 4103 | 249 | 0.419 | 42.720 |
| 4104 | 255 | 0.495 | 55.560 |

动态更新为每种子 200 次调用均值，包含局部变换与标记排布，不是整帧 GPU 基准。无新增地图纹理/Viewport/Camera。原生移动全程缓存构建计数保持 1。

## 截图与视频

输出：[expedition-integration-e01-5-fix](../test-output/expedition-integration-e01-5-fix/)。

- [01 Arrival](../test-output/expedition-integration-e01-5-fix/01_local_minimap_arrival.png)
- [02 三人同时可见](../test-output/expedition-integration-e01-5-fix/02_all_survivors_visible.png)
- [03 静止三人](../test-output/minimap-survivor-marker-acceptance/01-static.png)
- [04 移动状态](../test-output/minimap-survivor-marker-acceptance/02-moving.png)
- [05 局部跟随移动](../test-output/expedition-integration-e01-5-fix/05_local_follow_mid_move.png)
- [06 远处 POI 边缘标记](../test-output/expedition-integration-e01-5-fix/06_poi_offscreen_edge_marker.png)
- [07 抵达 POI](../test-output/expedition-integration-e01-5-fix/07_arrived_at_poi.png)
- [08 搜索状态](../test-output/minimap-survivor-marker-acceptance/03-searching.png)
- [09 走离后 POI 再次在边缘](../test-output/expedition-integration-e01-5-fix/09_poi_leaves_local_window.png)
- [选择与移动总览](../test-output/expedition-integration-e01-5-fix/local_minimap_contact_sheet.png)
- [选择与移动视频](../test-output/expedition-integration-e01-5-fix/local_minimap_survivor_selection_and_move.mp4)：1600×900、30fps、1,997 帧、66.567 秒。

视频为原生 Godot 帧图编码，固定 1/30 秒推进实际生产移动，并非桌面墙钟录屏。地面命令经过实际 InputEvent；没有角色瞬移。测试记录每 15 帧的队伍中心、比例、世界坐标、marker 坐标、edge 与行为状态。截图检查三种 marker 状态、局部道路滚动及 POI 进出窗口；人工操作体验仍待用户验收。

复跑脚本：`tests/expedition_minimap.gd`（Bridge，可用 `--output-dir=` 指定证据目录）、`tests/expedition_minimap_local.gd`（专项）、`tests/expedition_minimap_local_capture.gd`（原生 1600×900、`--fixed-fps 30`）。测试存档仅写入 `user://test-runs/`。

## Windows 构建与停止点

本轮 Windows build 已实际执行并失败。Import、Search Gameplay 72 项、Expedition HUD Phase2 258 项、Survivor Command 45 项、Search Active Card 157 项及 Settings 14 项通过，随后被既有 `tests/camp_ui_runtime.gd:114` 的 `member_buttons` 缺失和 `Camp exposes active abilities on its left edge` 断言阻断。构建日志另保留既有 Search Gameplay 退出 ObjectDB 泄漏警告，不与专项零警告混淆。

详见 [windows-build.log](../test-output/expedition-integration-e01-5-fix/windows-build.log)。未改 Camp 或旧测试绕过门禁，未更新独立 EXE，不能宣称旧 EXE 包含本轮修正。本轮验证与视频编码进程均已结束；原生证据来自当前工程。

```text
E01.5 Fix: TECHNICALLY COMPLETE
Minimap Mode: LOCAL FOLLOW
Survivor Representation: EQUAL UNITS
Human Runtime QA: PENDING
E02 Search: NOT STARTED
```

未进入 E02、Enemy、Full/Tactical Map、Fog 重构或其他 HUD 美术重构。到此停止，等待人工验收。
