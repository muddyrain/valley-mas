# 游戏美术资源

地图风格遵循 [美术规则](./ART-DIRECTION.md)：圆润紧凑的树冠、短树干、连片草土和稀疏细节。

- `vegetation/near.png`、`middle.png`、`far.png`：唯一正式植被图集，分别使用 40×48、20×24、4×5 帧。近中景原画保留；远景由相同原画按覆盖率和三个实色派生紧凑像素标记。覆盖 68 种植物、两个岩石编号、六个生命阶段和三个变体，包含蘑菇、水晶、翡翠与糖果生态。
- [清单](./vegetation/manifest.json)：源对象与物种派生关系、尺寸、落点、状态和来源；[技术报告](./vegetation/technical-report.json) 检查实际帧。`normalize.py` 与 `check_assets.py` 用于离线整理和验收；游戏运行时只读取图像，不生成树木素材。
- `vegetation/sources/`：三张内置 image_gen 原创来源板与提示词记录；仅用于继续制作，排除 Windows 包。生成图以用户截图作风格参照，没有提取参考游戏像素。
- `terrain/snow-crests.png`：四个 64×48 雪岩形体，整张图集 128×96、六色加透明；包含相连的峰顶、侧壁和山脚，替换已删除的平铺雪纹。 [清单](./terrain/manifest.json)、[原始提示词](./terrain/sources/prompt.json) 与 [技术报告](./terrain/technical-report.json) 记录制作过程。`terrain/normalize.py` 离线切片、去色键和统一色板，`terrain/preview.png` 在岩地底色上检查四种轮廓。来源与预览排除 Windows 包。
- `maps/`：八张固定模板缩略图，由 `scripts/build_map_thumbnails.gd` 离线绘制。选择模板不生成世界、不联网。
- `storybook-valley.png`、`icon.svg`：既有森系界面插画和山谷图标，说明见 [界面美术记录](./STORYBOOK.md)。

土地由 `ground_art.gd`、`soil_art.gd`、`mountain_art.gd` 和 `ground_materials.gd` 按实际世界状态绘制；近、远景共用同一地表。普通草土沿用当前配色；丘陵使用独立灰色岩地，山体为深灰岩层，积雪依据保存的海拔和固定的山脊起伏分布。所有纹理固定在世界坐标，不随镜头变化。

`flora_sprites.gd` 读取所有物种的图像帧，`pixel_flora.gd` 提供共享图集与图标。旧的几何植被绘法、三套被否定的树木资源、旧地表噪纹和未引用的早期占位插画已删除，不保留备用路径。
