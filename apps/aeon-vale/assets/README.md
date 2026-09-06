# 美术资源

0.14「沧海桑田」使用原创 `soil_art.gd` 重绘暖色裸土和低对比生态颗粒，停止以共享角点噪声绘制大块弯曲色斑。`earthquake.gd` 用同一组原创分支路径改变真实地形和绘制扬尘；旧褐色痕迹仅用于旧档兼容。云体与独立云影在近景完全隐藏，保留雨滴。`storybook_icons.gd` 的土壤图标同步改为暖色裸土；主菜单使用原插画，新增四边留白与对齐，无外部素材提取。

本项目使用原创像素地图、矢量界面绘制和内置 imagegen 生成的原创插画，创建日期为 2026-09-06。没有从 WorldBox 目录提取图像，运行不依赖网络。界面与地图美术记录、历史插画生成提示见 [绘卷记录](./STORYBOOK.md)。

- `storybook-valley.png`：0.4 主菜单、启动与生成加载、建图面板的原创森系幻想山谷插画。
- `dawn.png`：0.1–0.3 的像素谷地插画，保留为历史素材，0.4 已停用并从导出中排除。
- `vegetation.png`：0.1 的四列四行生成图集，作为历史素材保留；0.2 已停止用于地图与工具栏，并从 Windows 导出中排除。
- `scripts/pixel_flora.gd`：原创植物素材真源。0.6 近景使用 40×48 的整像素画布，六个生命阶段、三个轮廓变体，与 20×24 的备用简化轮廓在启动时组成 1200×3024 图集。远景在同一世界位置生成经过过滤的林冠层，中近景使用完整树形；新增果实、晶体、球茎、巨花、瓶干等结构。
- `scripts/plant_catalog.gd`：物种名称、代表颜色、37 种林木与幻想树种和 18 类生态组合。共 68 种植物；旧编号保留，13/14 为历史岩石编号，不计入植物数量。
- `scripts/ground_art.gd`：每地块 12×12 的原创像素地表，表达水纹、湿沙、草叶、坡面、岩层及细分雪线。相同外观条件复用纹理，地块逻辑尺寸仍保持不变。
- 0.13 `scripts/tempest_art.gd`：原创 24 帧 64×96 龙卷风和 8 帧 16×24 火焰，在启动时准备并复用；雨/酸雨像素滴、水花、白色分叉闪电、海浪按尺度绘制。地震裸土与断层由 `ground_art.gd` 静态绘制，动画不重烘整图。
- 0.7 在 `scripts/world_landscape.gd` 中生成连贯岛屿和海岸距离层，按环境形成大片自然生态与少量幻想区域。地图预览与远景共用圆冠/针冠的像素绘制和位置；地表采用连续山体采样、有限明暗色阶、断续浅滩水纹与生态交界细节。没有替换植物图集，也没有把整张参考截图作为地图。
- 0.8 重绘阔叶树的折线叶簇、白桦分叉枝干、针叶层叠、棕榈羽叶、萌芽和枯枝；浆果灌木扩大叶团与果点。保留 40×48 原始像素和既有编号，中近景以完整图集清晰采样，取消与远景林冠的透明叠混。沙岸采用浅奶黄色与窄湿边，浅水使用细小错列水纹，远海保持安静。新增素材来自本项目的程序化像素绘制，没有提取用户视频或截图作为贴图。
- 0.9 新增 `scripts/mountain_art.gd`，以跨地块的岩体、断续岩层、统一受光面和局部山脊积雪代替柔软色环；使用同一世界位置生成和缓存，旧地图无需重建。`ground_art.gd` 加入干沙细纹、暖沙色和湿地水色斑块。`weather_art.gd` 使用原创程序生成的柔和云纹、局部云影、受限雨丝与水迹；没有提取参考视频素材。白色笔刷和撒落颗粒由运行时几何绘制。
- 0.10 用低对比的连续岩地和较大的不规则雪区取代 0.9 的峰体多边形。树叶减少零碎亮暗点，地表草花以较小比例呈现；同一生态内使用空间连续的主导种，天然树冠保持间距。全程为原创程序绘图，用户的 WorldBox 截图仅供轮廓、尺度和排列参照，未提取游戏图像。
- `icon.svg`：本项目直接绘制的山谷标识。
- 0.12 的 `scripts/soil_art.gd` 以共享角点拼接草甸、苔草和干土色块，少量低对比细纹区分草原、桦木林、热带草原及其他生态。沿用原创植物轮廓，修正主导树种的比例，让白桦成为桦木林主体。
- 0.12 的 `scripts/weather_art.gd` 使用四种原创 96×56 像素云纹和对应轮廓云影。晴天与雨云共用轮廓但有不同色调、透明度及功能，近景减淡；缓存纹理后每片浮云只绘制云体与云影，不改变地表纹理。
- `maps/*.png`：八张随游戏附带的固定模板示意图，使用本项目地图绘法离线输出，没有截取 WorldBox 图片。开发工具 `scripts/build_map_thumbnails.gd` 负责重建它们；游戏只读取 PNG，不在选图或启动时重新生成世界。
- 0.11 优化森系界面：细描边、统一方形工具与分组间距，重绘关闭及笔刷图形，移除重复内框、星芒与厚阴影。原生预览采用当前地图结果，未增加或修改位图素材；尺寸、色值和来源见[绘卷记录](./STORYBOOK.md)。
- 0.4 工具图标由 `scripts/storybook_icons.gd` 以原创 SVG 几何和渐变绘制，界面使用平滑过滤并支持尺寸偏好；近景图集保持最近邻显示，缩小后的地表与林冠使用过滤层减少杂点。旧 `pixel_icons.gd`、`pixel_panel.gd` 保留为历史代码，不用于新界面或导出。

0.2 保留的植物包括橡树、白桦、冷杉、雪松、金枫、秋橡、樱树、林间菇、棕榈、仙人掌、柏树、垂柳、野花、浆果丛、草本、芦苇、雪地灌木和旱地灌木。岩石为独立地表物件。具体适生条件与年龄属于世界数据，图集只表达形态；换图不改变植物的生命状态。

0.3 新增树木：榆树、山毛榉、白蜡树、赤松、栗树、银杏、红枫、落叶松、云杉、杜松、胡杨、金合欢、水杉、玉兰。新增地被植物：蕨丛、三叶草、雏菊、薰衣草、虞美人、石楠、雪绒花、冰原草、龙舌兰、芦荟、风滚草、香蒲、鸢尾、苔草、杜鹃、萤光菇。不同物种用冠形、分枝、叶丛、花序等区别；变体和年龄阶段不重复计数。

工具栏已改为 18 类生态种子与独立浆果丛入口，不再逐棵树种播种。所有物种进入对应生态的自然生成与更新；沙岸和山峰使用更窄的适生组合。仙人掌沿用早期存档的枯茎生命周期和树木肥料规则，但不计入 37 种林木与幻想树种。

## 首版图集生成提示（历史）

```text
Use case: stylized-concept. Asset type: production vegetation sprite atlas for an original top-down pixel world sandbox game, Aeon Vale. Create a perfectly square 1024 by 1024 image with a TRANSPARENT alpha background. Exactly 4 columns and 4 rows of equally sized 256 by 256 invisible cells, one isolated sprite per cell, centered horizontally, feet grounded at 85% of its own cell, with generous clear padding. No grid lines, text, labels, ground tiles or scene. All sprites consistent overhead three-quarter 2D RPG pixel art perspective, beautifully shaped chunky pixel clusters, intentional limited palettes, top-left sunlight, rich dark cool outlines, no blurry paint or tiny noisy details. Each tree fills about 65% width and 78% height of cell, reads as a 32x40-pixel game sprite scaled up crisply. Row 1 left to right: full green oak tree with crooked trunk; small bright lime birch tree; tall dark evergreen pine; snowy blue-green pine. Row 2: golden broad-crowned autumn maple; burnt orange autumn oak; rose pink blossom tree; tall violet fantasy mushroom. Row 3: tropical palm tree with leaning trunk; branching desert cactus; low dark cypress tree; hanging willow tree. Row 4: compact grey stone cluster; tall craggy granite boulder; tiny cluster of yellow and white wildflowers; leafy berry bush. Preserve transparent background, no background shadows spanning cells, no lettering. This is original art, not extracted game art. Prioritize gorgeous readable silhouettes and consistent pixel scale.
```

## 0.1–0.3 插画提示（历史）

```text
Use case: stylized-concept. Asset type: original pixel-art title-screen and new-world illustration for the game Aeon Vale, landscape 1536x1024. A breathtaking miniature living world viewed from the rim of an ancient valley at dawn: winding turquoise river flowing from far snowy peaks through emerald woodland, tiny rose blossom grove, golden autumn woods to the right, little golden sand dunes at lower right, a broad blue ocean reflecting the warm horizon. Foreground dark framing pines and worn mossy stone arch fragments at left and right. In the sky an enormous gentle golden sun halo above misty mountains, a few tiny floating islands and clouds suggesting the birth of a world. Rich artisanal 16-bit pixel art with clearly resolved chunky square pixel clusters, restrained cool teal/forest palette contrasted against honey-gold sunlight, gorgeous atmospheric depth, deliberate clusters instead of grain. Wide cinematic composition with quiet darker lower central area for a UI title and buttons added later. No letters, no text, no typography, no logos, no watermark, no user interface, no human faces. Consistent original game illustration, magical but peaceful and beautifully finished.
```

