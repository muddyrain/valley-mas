# Expedition MiniMap Marker Rendering V2

## 实现

- `ui/expedition/minimap.gd` 保留项目现有的 Canvas 自绘 marker 架构，移除 marker 之间的动态避让和自动排布。建筑 marker 使用世界坐标投影作为固定锚点；幸存者和车辆分别使用固定 `(0, -6)`、`(0, 6)` 屏幕偏移。坐标投影按像素取整。
- 按稳定 marker ID 复用 marker 数据记录，只更新位置、纹理和状态；离开小地图可视区域的建筑/车辆不参与绘制，重新进入时复用原记录。幸存者、重要 POI 仍按现有规则在边缘夹持。
- MiniMap Content 使用完整内框可视区域，不再为未显示的底栏预留 30 px；World Clip 与 Content 尺寸一致。
- 扩展 `tests/expedition_building_render_audit.gd`，检查并导出建筑 ID、Mesh 数、材质、世界位置、可见性和阴影状态。
- 新增 `tests/minimap_marker_rendering_capture.gd`，执行 1600×900 实机场景捕获、10 秒移动捕获和逐帧锚点/记录复用断言。

## 验证结果

| 验证 | 结果 |
| --- | --- |
| `expedition_minimap.gd` | 2245 checks，0 failures |
| `expedition_minimap_local.gd` | 2270 checks，0 failures |
| `minimap_survivor_marker_acceptance.gd` | 20 checks，0 failures |
| `expedition_building_render_audit.gd` | 392 checks，0 failures；审计 55 栋建筑 |
| `search_command_ownership.gd` | 14 checks，0 failures |
| `parallel_commands.gd` | 36 checks，0 failures |
| 原生 10 秒捕获 | 300 帧，1600×900，21796 checks，0 failures；移动期间 marker 记录保持复用 |

多个建筑 marker 的静态画面：[minimap_building_markers.png](../test-output/minimap-marker-rendering-v2/minimap_building_markers.png)。完整运行画面：[runtime_1600x900.png](../test-output/minimap-marker-rendering-v2/runtime_1600x900.png)。10 秒移动录屏：[minimap_survivor_motion_10s.mp4](../test-output/minimap-marker-rendering-v2/minimap_survivor_motion_10s.mp4)。捕获数据：[capture-report.json](../test-output/minimap-marker-rendering-v2/capture-report.json)。建筑审计数据：[building-render-audit.json](../test-output/minimap-marker-rendering-v2/building-render-audit.json)。

## 建筑闪烁结论

运行时审计覆盖 55 栋建筑：每栋均有一个可见的 MeshInstance，使用 ShaderMaterial 并启用阴影投射。项目既有渲染配置审计也未发现 MSAA / 法线偏移配置异常。所采集的运行画面抽帧中未观察到建筑整体消失或明显屋顶跳闪，因此本轮没有证据支持重复 Mesh 或明显深度冲突是普遍原因。

这不是对所有建筑、相机角度和完整运行时段的逐像素时间稳定性证明。当前捕获中的相机随幸存者移动，无法仅凭这些抽帧排除特定位置的边缘闪烁或特定材质/阴影条件触发的问题；若该现象仍可在实机复现，需要保留复现位置并针对该建筑持续录制固定机位画面进一步定位。

## 范围

本轮没有修改 SearchTask、Mission、Loot、Combat、Enemy AI 或建筑模型资源，也没有新增 UI PNG。搜索所有权和并行命令回归测试通过。
