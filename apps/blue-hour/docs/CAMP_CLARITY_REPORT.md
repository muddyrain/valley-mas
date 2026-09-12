# CAMP_001 主站清晰度诊断与修复

2026-09-12。正式营地已改为主 Viewport 中持续存在的 3D 场景，管理 UI 位于原 CanvasLayer。建筑、车辆、角色、灯光及固定相机的世界 Transform 保持不变。修复的是营地显示链路；没有增加面数、重做 UV 或生成新贴图。

## 资源与重新导入

初次读取工作区时，正式路径仍是上一份 2K 文件，SHA-256 为 `912939B48FC24D51DA6389CA70881F905C575F90EB59E5F26314ED3757EE3EDC`。本轮将用户提供的 `Meshy_AI_CAMP_001_main_station_0912074909_texture.glb` 原始字节复制到唯一正式路径，然后先运行 Godot Editor 的重新导入，再开始渲染对照。全部对照图使用这份新 4K 资源，没有恢复旧 GLB。

- 正式源文件：[CAMP_001_main_station.glb](../assets/world/buildings/CAMP_001_main_station.glb)。25,770,144 字节，SHA-256：`F589EEE2A9F94D6A9CD693A8FCDE159E0B2ADB7A2889AA6D118AB08290C7D796`。
- 唯一 wrapper：[camp_main_station.tscn](../scenes/camp/buildings/camp_main_station.tscn)。实例仍在 [camp_main.tscn](../scenes/camp/camp_main.tscn) 的 `NavigationSource/MainBuilding`。
- 新旧几何包围盒与顶点数一致：21,696 顶点、27,592 三角面、一个 Mesh / 材质。原始宽 10.935079、高 3.8、深 6.109353m。
- Godot 总包围盒宽 **12.000000**、高 **4.170067**、深 **6.704319m**，包含台阶、雨棚与天线；最低点 Y 约 0。入口对齐与接地未变化。
- Camp、父节点、建筑实例、wrapper、GLB 根节点都是单位缩放；只有原 Visual 等比 `1.097386`，偏移 `(0.007305, 0, 0.235)`。没有反向缩放链。
- 保留原三组 Box 碰撞与导航数据：主体 `11.8×3.1×5.15`、入口 `2.7×2.65×0.5`、台阶 `3.3×0.32×1.3`，单位 m、顺序 X/Y/Z。未生成高面数网格碰撞。

## 用户要求的 20 项结果

| # | 检查项 | 结果 |
| --- | --- | --- |
| 1 | BaseColor 原始分辨率 | 4096×4096，GLB 内嵌 Image_0 JPEG |
| 2 | Godot 实际导入分辨率 | BaseColor 4096×4096；纹理资源尺寸与 `get_image()` 像素尺寸一致 |
| 3 | Normal | 原始与实际导入均 4096×4096，Image_2 |
| 4 | ORM / Roughness / Metallic | 原始与实际导入均 2048×2048，Image_1；G=Roughness、B=Metallic，没有单独绑定 AO；不是 4K 被降为 2K |
| 5 | Texture Import | Lossless、保留 mipmaps、Max Size=0、无 VRAM 有损压缩；最终材质使用线性+mipmaps+各向异性过滤，细项见下表 |
| 6 | 实际窗口 | 验收 1920×1080；另验 1600×900。项目默认窗口仍为 1600×900 |
| 7 | 主 Viewport | 实际渲染图像 1920×1080，与验收窗口相同 |
| 8 | 是否存在 SubViewport | 正式 Camp 已没有；与本轮无关的资产调试测试可独立使用 SubViewport |
| 9 | 旧 SubViewport 分辨率 | 管理页实际 1182×524；出发用的全屏模式 1600×900。脚本初始 760×440 会被 stretch 布局覆盖，不能当作运行值 |
| 10 | Viewport 放大 | 旧画面在 1080p 窗口被放大 1.2 倍；修复后直接渲染到窗口原生像素 |
| 11 | 3D Render Scale | 1.0；Compatibility；无 FSR、TAA、FXAA 或后处理锐化；主视口沿用现有 8× MSAA |
| 12 | Window / Content Scale | 设计 1600×900、`canvas_items`、content factor=1；1080p 时 UI 坐标按 1.2 映射。未修改全局项目设置 |
| 13 | Camp 二次缩放 | 修复后无中间 ViewportTexture 放大；UI 的正常 DPI / 窗口缩放不再降低 3D 分辨率 |
| 14 | 根因 | 管理 UI 中的小渲染目标限制建筑像素覆盖，再经窗口缩放放大；独立 SubViewport 的 MSAA=Disabled，未继承主视口 8×；材质原先没有启用项目已有各向异性采样 |
| 15 | 实际修改 | 正式 Camp 挂到主场景；CanvasLayer 覆盖管理面板；刷新 UI 保留 Camp / 角色实例并同步武器和特质；主站导入复用 `world_material_import.gd`；增加原生清晰度与交互回归 |
| 16 | 其它地图 | 未修改全局渲染参数或外出地图；Camp 出发仍清理营地并调用原 Mission 加载。相关完整流程与导出验证记录见下节 |
| 17 | 1080p 修复前 | `test-output/camp-clarity/00-before-ui-1920x1080.png`；严格同画幅 A 为 `01-A-subviewport-1920x1080.png` |
| 18 | 1080p 修复后 | 正式包为 `test-output/camp-clarity/07-exported-camp-1920x1080.png`，源码运行是 `05-after-ui-1920x1080.png`；同画幅直接渲染 B 为 `02-B-main-viewport-same-msaa-1920x1080.png`，最终过滤为 `04-D-main-viewport-anisotropic-1920x1080.png` |
| 19 | 是否建议重导资产 | 当前不需要 |
| 20 | 资产侧调整理由 | 未发现必须重做资产的证据。正常营地距离不要求读清 AI 小英文；当前面数与纹理可以表达门窗框、雨棚、屋顶设备及主要旧化 |

## 纹理 / 材质细项

| 设置 | 实测最终状态 |
| --- | --- |
| Compression Mode | 0 / Lossless；运行时三张均为未压缩 RGB8 图像。原 JPEG 自带的压缩不等于 Godot 再次进行 Lossy 压缩 |
| Lossy Quality | 配置中 0.7，但在 Lossless 模式下不生效 |
| High Quality | false；当前不是 VRAM 压缩模式，不能据此判定为低质量纹理 |
| Mipmaps | Generate=true、Limit=-1；4K 纹理 12 级、2K 纹理 11 级，不含基础层 |
| Max Size / Downscale | `process/size_limit=0`，没有大小上限；源尺寸完整保留 |
| VRAM Compression | `vram_texture=false`，无 S3TC / BasisU 质量损失 |
| Detect 3D | `detect_3d/compress_to=1` 为检测后的 VRAM 目标；本轮实际导入仍是 Lossless，不能把检测目标当作当前压缩结果 |
| Normal Map | Import=Detect；正确接入 StandardMaterial3D Normal，Enabled=true、Scale=1、Invert Y=false；未交换通道 |
| sRGB / Color Space | 颜色纹理接入 Albedo，Normal / MR 接入数据槽；保留标准材质的通道语义，无强制 sRGB 或自定义颜色转换。`hdr_as_srgb=false` 不是 SDR Albedo 的 sRGB 开关 |
| Filter | 导入后统一设置 `TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC`；项目原有各向异性级别 3（16×）保持不变 |
| UV / Repeat / 替代材质 | UV1 scale=(1,1,1)、offset=0；Repeat=true；没有 material_override，也没有运行时低分辨率材质替换 |

Godot 4 的 3D 过滤与 Repeat 位于材质；Lossless、Detect 3D 与压缩选项含义参见 [官方图像导入文档](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html)。各向异性采样保留 mipmaps，并改善倾斜表面的纹理采样，见 [BaseMaterial3D](https://docs.godotengine.org/en/stable/classes/class_basematerial3d.html)。

## A/B 方法与画面判读

先以旧管理 UI 记录实际显示，再隐藏 UI、切换它已有的全屏 Camp 模式。冻结同一个 Camp 实例以固定角色姿态，保留相机 `size=20.5`、Transform、灯光、模型、材质与时段。

旧容器是 `SubViewportContainer`，自身绘制 ViewportTexture，没有另一个 TextureRect，因此 TextureRect Stretch Mode 不适用。容器 Stretch=true、Stretch Shrink=1、Control Scale=(1,1)；SubViewport Size 2D Override=(0,0)、Override Stretch=false、Render Target Update Mode=4 / Always。旧全屏状态填满设计画布 1600×900，然后随 canvas_items 映射到 1920×1080。

1. A：旧 SubViewport 1600×900 → 1920×1080，MSAA=0。
2. B：将相同 Camp 实例直接挂到主 Viewport，1920×1080，暂设 MSAA=0。这里只改变渲染链路，未改镜头或材质。
3. C：沿用 B，恢复项目已有的 8× MSAA。
4. D：沿用 C，为主站材质启用带 mipmaps 的各向异性过滤。

A/B 均为真实原生 Godot GPU 截图，PNG 像素尺寸均为 1920×1080。B 的窗框、屋顶细节和轮廓比 A 更清楚；C 消除更多斜边阶梯；D 保留倾斜屋面的细节。最终管理 UI 截图单独留档，避免将版面变化和严格渲染 A/B 混为一谈。未使用图片锐化、重新采样或 AI 修图。

原管理页主站世界 AABB 投影宽约 336 渲染像素，放大后约 403 屏幕像素。全屏相同相机下 AABB 宽约 692 像素；逐顶点投影得到实际网格约 **638×405 像素**，占屏幕宽度约 33.2%。画幅变化提高了建筑可分配的像素，未改变 3D Camera zoom 或任何场景位置。仍需按正常观看距离判断，小字不作为验收目标。

测量使用 `ViewportTexture.get_image()` 的实际像素尺寸。此引擎下 `Window.get_texture().get_size()` 在 canvas_items 缩放时返回 2304×1296 元数据，与实际 PNG / DisplayServer 的 1920×1080 不同；没有据此错误调整项目分辨率。

## 验证与复现

- 实施前新增 `camp_clarity_runtime.gd`，首先复现“正式营地未由主 Viewport 渲染”的失败，再修改实现。
- 原生清晰度测试覆盖资源 4K / 2K、mipmaps、材质过滤、原生 1080p / 900p、选人、训练、换装、弹窗输入拦截、选图取消与同一 Camp 生命周期，输出截图、GPU 及帧时间样本。
- 同机原生窗口短时采样，不代表所有配置的性能承诺；Godot 4.7.2、Compatibility、RTX 3060、VSync 开启。
- 测试已接入 `run.ps1 -Mode capture` 与 `run.ps1 -Mode build`。日志、原件审计与图片均保存在忽略目录 `test-output/camp-clarity/`，不写玩家存档。
- 清晰度专项 39、Camp 107、出发 89、额外开局原生 202、效果原生 80 项通过；最终 EXE 内嵌 Camp 13 项及 Headless / 原生启动通过。4 秒原生样本约 165 FPS、P95 约 6.6ms。
- 最终包 `build/BlueHourHomeward.exe` 为 451,621,288 字节，SHA-256 `6931731E925AF189A00E3F61EE3D2A029A5BCFED003B238CE4292788B6F74B9B`，已保留同期地图、角色及武器工作。完整构建、首次验证器超时的修正与最终复验记录见 [VALIDATION](VALIDATION.md)。

本次未手工整理或迁移 `.godot/imported/`，没有删除待确认的旧模型或创建版本后缀资源。
