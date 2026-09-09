# 森系界面美术记录

地图素材见 [当前美术规则](./ART-DIRECTION.md) 与 [资源清单](./README.md)。界面继续使用已确认的森系绘本风格。

- `storybook-valley.png`：内置 image_gen 生成的原创山谷插画，1672×941，用于标题和加载背景。运行只读取项目内图片，不联网。
- `icon.svg`：项目原创的象牙白、鼠尾草绿山谷标识，用于窗口和 Windows 程序。
- `storybook_icons.gd`：原创 SVG 工具图形，Godot 转换成界面纹理；它们与世界植被图集独立。
- `storybook_theme.gd` 与 `storybook_panel.gd`：象牙白面板、森林色文字、鼠尾草选择态和金色边饰。界面使用平滑过滤；地图使用像素过滤。
- `maps/` 的八张固定缩略图由本项目地图生成器离线绘制。只在确认创建后随机生成实际世界。

下方保留当前背景插画的制作提示；没有提取 WorldBox 图像作为素材。

## 插画最终提示

0.6 的地图资源继续由原创像素绘制代码产生，未新增或编辑背景位图。`pixel_flora.gd` 改用整像素画布、减弱叶簇噪点与内部描边，调整枝叶遮挡，新增柠檬树、香橼树、金穗树、紫晶簇、蓝晶柱、玫晶冠、翡翠枝、萤玉树、蜜糖树、糖霜松、瓶干树、沙葱、星瓣花、蓝花楹、红杉、纸莎草。68 种活植物各有三种占用轮廓；石簇与巨岩仍是物件。`ground_art.gd` 重做深浅水边界、岸线、湿沙与生态地表；`world_view.gd` 使用过滤后的概览与独立林冠层，并绘制生长闪光和柔和投影。图标仍沿用森系幻想绘本配色，四类新增生态具有独立图案。

下列提示是 0.4 背景插画的历史生成记录。

0.7「山海交融」继续使用现有原创插画与 68 种植物图集。新增地图预览共用游戏远景的地表、林冠位置和轮廓；地形改为连续陆块、海岸距离带及环境生态省区。山体使用共享角点的高度与光照、有限灰绿色阶和小片积雪，水岸采用浅滩、近海、深海的层次与低对比水纹。按钮统一占位，沙漏倍率收起后与笔刷/神力/关闭入口保持同尺寸。上述变化由原生绘制与布局代码完成，未生成新位图或复用 WorldBox 素材。

```text
Use case: illustration-story. Production background illustration for the original native game 纪元谷 / Aeon Vale. Create a beautiful 16:9 landscape image, 2048x1152 or higher. Original anime forest-fantasy storybook painting, luminous hand-painted gouache and watercolor with refined clean anime background linework, not pixel art. A peaceful verdant valley at early morning: a winding jade river with two small waterfalls, soft sage forests, pale limestone mountains and distant blue sea; a delicate ancient ivory stone arch overgrown with little leaves on the far right foreground, tiny floating seed lights, graceful branches and white wildflowers framing the bottom corners. Warm ivory sunlight, sage green foliage, soft champagne gold highlights, pale mint and muted teal, airy bright atmospheric depth, delicate detail without gritty texture or high contrast. Composition: the most beautiful river and layered valley occupy center/right; reserve the leftmost 38 percent as calm pale morning mist and light foliage with very low detail and enough contrast for dark green title text and a light translucent menu card to be added in-engine. Top third distant mountains and light sky. Theme is the quiet birth of a living world. No people, characters, buildings, text, letters, logos, watermark, UI frames or buttons. This is a single usable illustration asset, not a moodboard or screenshot.
```
