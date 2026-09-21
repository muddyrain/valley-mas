# Map Phase 1.2 MiniMap Renderer Visual Reconstruction

## 状态

`TECHNICALLY COMPLETE`。本轮只重建 MiniMap renderer，不修改 Town 生成、`mission.runtime_data.minimap_geometry` 或地图快照字段。

## 修改文件

- `apps/blue-hour/ui/expedition/minimap.gd`
  - 保留 `LocalWorldClip` + `TownWorldLayer` 静态缓存和 LOCAL_FOLLOW 投影合同。
  - 修正静态层被父节点底色遮盖的问题；父层只绘制边框、边缘区和动态 marker。
  - 按 Layer 0–4 缓存 Terrain、Road、Building、Arrival/Special polygon，Layer 5 继续绘制动态 marker。
  - Main / Secondary / Connector 道路使用不同填充色、轮廓色和轮廓宽度。
  - Residential / Commercial / Industrial / Special 建筑使用不同低饱和色块和 footprint 轮廓。
  - Arrival 的 bus stop、road、entrance、parking 使用独立高亮色阶。
  - 已发现车辆站点使用 `icon_vehicle`；SearchTask 优先级仍高于车辆图标。
  - 静态 geometry 只在 seed/source 改变时重建；marker 仍按动态刷新节奏更新。
- `apps/blue-hour/tests/minimap_phase_1_2_capture.gd`
  - 只读原生截图工具，生成 4101–4105 的 World + MiniMap 对比图和 manifest。

## Renderer 结构

```text
MiniMap Control
├── Frame
├── LocalWorldClip (clip_contents)
│   └── TownWorldLayer (cached static commands)
│       ├── Layer 0: Town background
│       ├── Layer 1: terrain / district / parking
│       ├── Layer 2: road polygons
│       ├── Layer 3: building footprints
│       └── Layer 4: Arrival zones
└── Parent draw: Layer 5 dynamic Survivor / Bus / POI / Search / Vehicle markers
```

## 5 Seed 验收

| Seed | 对比图 | 结果 |
| --- | --- | --- |
| 4101 | [seed_4101_comparison.png](../../test-output/map-phase-1-2-minimap/seed_4101_comparison.png) | PASS：道路面、建筑色块、Arrival 区域和 marker 可见 |
| 4102 | [seed_4102_comparison.png](../../test-output/map-phase-1-2-minimap/seed_4102_comparison.png) | PASS：支路/建筑分布与当前世界视图保持空间对应 |
| 4103 | [seed_4103_comparison.png](../../test-output/map-phase-1-2-minimap/seed_4103_comparison.png) | PASS：主路、建筑 footprint、Arrival 和 POI 可辨认 |
| 4104 | [seed_4104_comparison.png](../../test-output/map-phase-1-2-minimap/seed_4104_comparison.png) | PASS：旋转后的局部道路与建筑朝向可辨认 |
| 4105 | [seed_4105_comparison.png](../../test-output/map-phase-1-2-minimap/seed_4105_comparison.png) | PASS：Arrival 主路区域与动态队伍位置可对应 |

原始捕获数据：[capture-manifest.json](../../test-output/map-phase-1-2-minimap/capture-manifest.json)

## 自动化验证

- `tests/expedition_minimap.gd`：`2131 checks / 0 failures`
- `tests/expedition_minimap_local.gd`：`2180 checks / 0 failures`
- `tests/runtime_loading_gate.gd`：`121 checks / 0 failures`
- Native capture：5 seeds captured，5 张对比图生成，静态 cache 每个 seed 只构建一次。

## 已知边界

- MiniMap 保留 Phase 1.1.5 的 LOCAL_FOLLOW 行为；本轮没有改成全城 overview，也没有改变 `world_to_minimap` 坐标合同。
- 旧 `tests/expedition_minimap_capture.gd` 在既有“世界点击后 3 名 Survivor 均收到路径”断言处停止；不属于本轮静态 renderer 回归。新的 Phase 1.2 capture 不依赖移动，因此 5 seed 截图完整生成。
- Search marker 仍依赖真实 SearchTask；本轮没有伪造任务或改动搜索/导航逻辑。
- 完整 Windows build 仍受工作区既有 Camp UI / weapon 并行改动影响，本报告不将其归因于 MiniMap renderer。

## 结论

Phase 1.2 的 renderer 视觉重建已落地：MiniMap 现在显示真实道路 polygon、静态建筑 footprint、Arrival 特殊区域和动态地图 marker，不再只显示低对比背景上的漂浮点。地图生成数据和 runtime snapshot 保持不变。
