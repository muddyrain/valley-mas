# Camp HUD M01 接入报告

2026-09-16。本轮只实现营地身份区，未进入 M02。

## 收尾冻结（2026-09-17，当前）

用户确认 Logo、卡片素材与整体尺寸通过。本轮只将信息卡整体上移 4 px 至屏幕 (24,104)，保持 238×152；移除日期字体的额外空格加宽，以普通单空格显示 `第 1 天` 并保持右对齐。24 px 中文标题改为 SimHei / Heiti SC / Noto Sans CJK SC 粗体回退、合成加粗 0.7，使字形更规整；9 px 英文副标题 tracking 从 2 调至 3。DAY 01 与两行留言保留现有手写字体、字号和位置。

412 项原生运行检查通过，覆盖四种分辨率；截图为 `test-output/camp-identity-frozen/camp-1600x900.png`。44 个受保护文件哈希一致，包含 PNG/import、M02～M09 及 Camp 文件。Windows 导出和独立目录启动通过，退出码 0，日志无脚本、Missing Resource 或 Invalid UID 错误；使用隔离测试存档，未运行历史全量 build 测试链。按用户要求，M01 在本次收尾后冻结，不再主动调整，不进入 M02。

## 最终几何修正（2026-09-17，历史）

只调整 M01 几何，所有 PNG 字节、字体、字号、文案保持不变。背景改为 NinePatchRect，region_rect=(55,88,1485,828) 排除透明外边距；源图坐标下九切边距为左/上/右/下 170/200/170/450，以统一缩放 238/1485 显示。四角、底部撕纸与折角保留，中段纵向扩展，纸面为 238×152，屏幕位置 (24,108)，可见顶部比此前上移约 9 px。

Logo 控件为 236×104.223，KEEP_ASPECT_CENTERED，可见宽约 230 px。位置 (22,0)：此前控件已位于屏幕 Y=5，因此仅上移 5 px 到屏幕顶边，避免按相对值再上移 12～16 px 裁掉灯塔。Logo 与纸面形成紧密视觉组。六项文字仅调整坐标，日期位于分隔线上方，两行留言位于下方。

原生验证 412 项、0 失败，覆盖四种分辨率的文字内容、边界、重叠与模块间距；1600×900 截图为 `test-output/camp-identity-geometry/camp-1600x900.png`。44 个 PNG/import、其他 HUD、Camp 文件哈希未变。Windows 导出及独立目录程序启动通过，退出码 0，运行日志无 Script Error、Missing Resource 或 Invalid UID。未运行历史全量 build 测试链。本轮停止于 M01，等待截图验收。

## V3 卡片替换（2026-09-17，历史）

使用用户 `camp_identity_panel_bg_v3.zip` 中的 1599×984 PNG 替换原路径 `assets/ui/camp/m01/camp_identity_panel_bg.png`，SHA-256 与包内原件一致。Logo 源图、尺寸和位置保持当前版本；字体、字号、文案不变。

卡片控件调整为 M01 内 (-14,86)、266×164，KEEP_ASPECT_CENTERED；原图 alpha≥16 可见横向范围为 55～1539，纸面实际可见宽约 247 px。透明边距使 Logo 与纸面保持紧凑视觉间距。文字按 V3 单分隔线重新排布，留言起点为 Y=96/122，保留第二行缩进和下边距。该版本替代此前固定双分隔线卡片的间距待定状态，不再等待旧问题的字号取舍。

原生验证 405 项通过，覆盖四种分辨率的文本内容、重叠、卡片边界及其他模块间距；截图为 `test-output/camp-identity-card/camp-1600x900.png`。Logo、M02～M09、HUD 根及 Camp 场景/脚本等 41 个受保护文件哈希一致。Windows 导出与独立目录 Camp 原生启动通过，最终日志无脚本错误、Missing Resource、Invalid UID；未运行历史全量 build 测试链。本轮停止于 M01，等待用户视觉验收。

## 间距微调（2026-09-17，历史部分结果）

Logo 在不改变尺寸的前提下上移 5 px，使 Logo 与卡片间距增加 5 px。PNG、卡片尺寸、所有字体属性、其他 HUD 模块保持不变。

卡片内部加大间距尚未完成：当前卡片高 155 px，末行控件到 149 px；按建议逐段增加间距会与下沿冲突。曾尝试重新分配中间空白，原生截图发现留言贴近原图分隔线和纸张下沿，已撤回该试排。等待确认保留字号重新分配空白，或允许缩小字号。本阶段不能宣称全部完成。

当前局部结果原生检查 405 项通过，截图为 `test-output/camp-identity-spacing/camp-1600x900.png`。44 个 PNG/import、其他 HUD 和 Camp 文件哈希未变；该检查仅证明边界与内容，不代替卡片内部的视觉验收。

## V2 tight 素材尺寸修正（2026-09-17，当前）

按用户提供的 `blue_hour_camp_m01_assets_v2_tight.zip` 替换原路径的两张 PNG：Logo 为 394×174，卡片为 408×251，逐张 SHA-256 与压缩包原件一致，未重制或裁切。Godot 已重新导入，沿用既有资源路径与 import UID。

Logo 控件在 M01 内为 (-2,-6)、232×103，信息卡为 (-12,99)、252×155；均 KEEP_ASPECT_CENTERED，未拉伸。以源图 alpha≥16 的可见边界计算，Logo 可见宽约 226.1 px，信息卡约 246.4 px，达到建议区间。信息卡下沿与 M06 控件相距 8 px。

字体资源、字号、字重、颜色、tracking 和六项动态文案均不变；仅微调 Label 的 Y 坐标适配 tight 卡片及原图分隔线。HUD 根、M02～M09、Camp 场景与脚本等 40 个受保护文件哈希未变。

原生测试 405 项、0 失败，覆盖 1600×900、1280×720、1024×640、1920×1080，文字及信息卡无越界或模块重叠。当前截图为 `test-output/camp-identity-tight/camp-1600x900.png`。Windows 导出与独立目录原生 Camp 启动通过，最终日志无 Script Error、Missing Resource 或 Invalid UID；未运行历史全量 build 测试链。本轮仍止于 M01。

## Typography 修订（历史）

用户依据实际截图要求修正字体层级。本次只改 `camp_identity.tscn` 的字体资源和卡片内部布局：标题改为 24 px 楷体、合成加粗 0.7；英文副标题为 9 px Segoe UI，FontVariation 增加 2 px 字距；DAY 使用 17 px Segoe Print 斜体；右侧 19 px 楷体保留“第 1 天”，并增加空格宽度。留言使用 15 px 蓝灰楷体，两行起点相差 19 px，第二行缩进 19 px。

字体继续通过项目已有 SystemFont 方式读取本机字体，没有新增字体文件；中文依次回退 KaiTi、STKaiti、Kaiti SC、Noto Serif CJK SC，其他平台可能因字体可用性有外观差异。PNG 与 import 原样保留。

M01 外框和 Logo 不变，仅卡片在模块内部调整为 (-7,78)、242×176，等比适配原图；与 M06 边界保留 8 px。M02～M09、HUD 根、PNG/import、Camp 场景与脚本等 44 个文件改前改后哈希一致。

`tests/camp_identity_runtime.gd` 当前 405 项通过，覆盖四种分辨率、文字内容/越界/重叠、放大后卡片与其他模块不相交。新的 1600×900 原生截图为 `test-output/camp-identity-typography/camp-1600x900.png`，同目录保留其他尺寸及 `runtime.json`。Windows 导出和独立目录原生 Camp 启动通过；最终日志无脚本错误、Missing Resource 或 Invalid UID。未运行历史全量 build 测试链。

以下为首次接入记录，字号及卡片尺寸已由本节替代。本次到 M01 排版验收为止。

## 资源与实现

- 修改 `ui/camp_hud/camp_identity.tscn`；没有新增 Gameplay 或 UI 业务脚本。
- 接入 `assets/ui/camp/m01/camp_logo_main.png`（480×176）、`camp_identity_panel_bg.png`（412×300）及 Godot 生成的 `.import`。与用户 ZIP 中原始文件 SHA-256 一致。
- 保留 M01 的 Panel 外层及 (24,16)、228×244 矩形，局部空样式移除灰色占位底；Logo 位于 (4,0)、212×78，卡片位于 (8,88)、206×150，两者 KEEP_ASPECT_CENTERED。
- 六个 Label 由 Godot 动态绘制文字，没有写入图片，也没有接入营地或日期数据。中文标题 18 px 粗体，英文 9 px，日期 15/14 px，辅助描述 11 px；使用现有 Windows 中文字体回退规则。标题避开原图挂签，描述适配原图分隔线及纸张下沿。
- `.import` 保持无损压缩、原尺寸、`fix_alpha_border=true`；原图透明通道保留。

```text
M01_CampIdentity
├── GameLogo
│   └── TextureRect
└── CampInfoPanel
    ├── Background (TextureRect)
    ├── CampNameCn
    ├── CampNameEn
    ├── DayEn
    ├── DayCn
    ├── DescriptionLine1
    └── DescriptionLine2
```

## Runtime 验证

`tests/camp_identity_runtime.gd` 在真实 Godot 4.7.2 Compatibility 渲染下执行 369 项检查，0 失败：1600×900、1280×720、1024×640、1920×1080 模块无越界/重叠，六个文字节点内容正确、单行且不相交，两张图保持原尺寸与比例、透明角有效，Campaign 数据未变。

截图来自隔离测试存档和现有两名角色，保存为 `test-output/camp-identity/camp-1600x900.png`；其他分辨率截图及 `runtime.json` 同目录。人工复核截图，未见黑色底框、文字截断或图片变形。测试脚本更新了 M00 的“所有模块无图片”断言，仅豁免 M01，M02～M09 仍要求无图片。

HUD 根、其余八模块、共用占位主题、`core/main.gd` 及 Camp 脚本/场景等 40 个文件逐一比较改前改后 SHA-256，均未变。没有修改 Camera、Lighting、Navigation、Survivor AI 或其他页面 HUD。

Windows `--export-release` 成功输出 `build/BlueHourHomeward.exe`，复制到独立目录后原生 Camp 启动退出码 0。最终导入、原生测试、导出与独立启动日志无 Script Error / Missing Resource / Invalid UID。没有运行依赖已删除旧 HUD 的历史全量 build 测试链。测试进程均已退出。

用户视觉验收待完成；本轮停止，不继续 M02。
