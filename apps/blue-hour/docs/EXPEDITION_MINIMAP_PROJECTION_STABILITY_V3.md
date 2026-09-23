# Expedition MiniMap Projection Stability V3

## 完成内容

- `MiniMap.world_to_minimap()` 的统一投影输出改为逐轴 `floorf()`，形成 World → MiniMap Local → Floor Pixel → Canvas Draw 流程；MiniMap 原点也保持整数像素。无插值、Tween 或 marker 动态避让。
- 建筑、车辆和幸存者继续使用稳定 ID 对应的 Canvas 绘制记录。记录只在首次出现时建立，位置、材质引用和状态随后更新；建筑/车辆超出完整 marker 可视范围时设置为 Hidden 并保留记录，重新进入时恢复同一记录。建筑位置使用 `(0, 0)`，幸存者固定 `(0, -6)`，车辆固定 `(0, +6)` 屏幕偏移。
- Content、World Clip、Marker Clip 使用同一完整 MiniMap 内框矩形；地图长轴保持既有 70m 范围并按 viewport 比例裁切，不留隐藏底栏空间。
- 增加关闭状态的 `MINIMAP_DEBUG` 开关。开启后每秒输出 Frame、Content、World Bounds，以及每个 marker 的 ID、世界坐标、未取整 MiniMap 坐标、floor 后坐标和 Visible/Hidden 状态。纹理由 `setup()` 缓存加载，marker 更新不重复载入纹理。
- 没有修改 Camera、Search、Mission、地图生成或建筑资源。

## 验收

| 检查 | 结果 |
| --- | --- |
| `tests/expedition_minimap.gd` | 2318 checks / 0 failures |
| `tests/expedition_minimap_local.gd` | 2297 checks / 0 failures |
| `tests/minimap_marker_rendering_capture.gd` | 21432 checks / 0 failures；300 帧；16:9、1600×900；59 个 marker 记录持续复用 |
| 固定画面检查 | MiniMap Content 与 World Clip 同尺寸并填满内框；截图含多个已发现建筑 marker |
| 移动录屏抽查 | 2 秒、6 秒、9 秒画面中幸存者 marker 随地图连续移动；未观察到闪烁、亚像素漂移或动态重新排布 |

录屏：[minimap_survivor_motion_v3.mp4](../test-output/minimap-marker-rendering-v2/minimap_survivor_motion_v3.mp4)。1600×900 固定画面：[minimap_projection_v3_static_1600x900.png](../test-output/minimap-marker-rendering-v2/minimap_projection_v3_static_1600x900.png)。MiniMap 多建筑静态画面：[minimap_projection_v3_static.png](../test-output/minimap-marker-rendering-v2/minimap_projection_v3_static.png)。捕获坐标和可见状态：[minimap_projection_v3_capture_report.json](../test-output/minimap-marker-rendering-v2/minimap_projection_v3_capture_report.json)。

建筑渲染审计覆盖 55 栋建筑、392 项检查，0 failures：每栋各有一个可见 MeshInstance、ShaderMaterial 和阴影投射状态。抽取的录屏关键帧未发现建筑整体消失或明显屋顶跳闪。该结论限于本次固定 Seed 与录屏观察；没有用它推断所有地图和机位均无闪烁。

## 实际架构说明

当前 MiniMap 用单一 `Control._draw()` Canvas 绘制 marker，而不是每个 marker 一个 Scene Node。因此“Create Once / Hide / Re-enter”由稳定 ID 的池化 Dictionary 记录承担；没有引入 marker 子节点，也没有逐帧创建或释放 marker Node。
