# Camp HUD M04 Survivor Roster

当前行为更新：用户后续授权 M04 Hover/Pressed 与 M05-A，已改为进入 Camp 不选中、点击后显示详情；实现与最新证据见 [M05-A 报告](CAMP_SURVIVOR_DETAIL_REPORT.md)。以下保留 M04 初次接入与基础视觉冻结记录，不代表当前初始选择规则。

2026-09-18。仅实现头像列表及本地选中切换，不修改 M05 详情或实际队伍。M01～M03 继续冻结，M05～M09 保持占位骨架，本轮停止于 M04。

## 最终收尾与冻结

用户已确认位置、尺寸、间距、背景和选中效果。本轮仅在 FrameTexture 上对 normal 状态设置 self_modulate=Color(0.78,0.78,0.78,1)，将 RGB 亮度及蓝色高光调低约 22%，透明度不变；selected 状态恢复 Color.WHITE。PNG 原件、头像、圆点、Slot 与布局均未修改。

477 项原生检查通过，覆盖四种分辨率、唯一选中及切换后的色值恢复；69 个受保护文件哈希一致，默认 Selected 槽与前版逐像素一致。截图差异仅位于三个普通框区域。最新截图为 `test-output/camp-survivor-roster-frozen/camp-1600x900.png`；本轮 Windows 独立构建位于同目录 `standalone/BlueHourHomeward.exe`。

Windows 独立构建与原生启动通过，退出码 0，日志无脚本或资源错误；使用隔离测试存档，未运行历史全量构建测试链。按用户要求，本轮完成后 M04 Freeze，不再主动调整，不进入 M05。以下为首次接入记录，当前亮度以上述冻结版本为准。

## 资源与布局

用户 `m04_assets_final.zip` 三张 PNG 原字节保存在 `assets/ui/camp/m04/`，SHA-256 逐张对照包内原件一致。背景 `m04_roster_panel_bg.png` 原尺寸 236×872，显示 118×436；普通与选中框均为 188×188，显示 94×94。Lossless 导入、线性过滤、保留透明通道，不增加或修改 PNG。

外框屏幕位置 (1466,126)，右边距 16 px；仅更新根场景 M04 实例的左偏移 -134 和下偏移 562，满足新规格。M05 保持原位，两模块间距 12 px。Header 高 34，文字“幸存者”及数量“4/4”由 Godot Label 渲染。四个 Slot 位于 (12,42)、(12,138)、(12,234)、(12,330)，步进 96 px。

头像区域 78×78，位于 Slot (8,8)，先渲染头像再叠加框。复用现有 `assets/ui/expedition/portraits/portrait_su_wanxing.png` 与 `portrait_xia_zhiyao.png`，通过 AtlasTexture 的 (40,10,112,112) 区域取面部，不修改原图。当前只有两张正式头像，按苏/夏/苏/夏填充四个展示槽；4/4 是本轮四槽展示数量，不代表实际 Campaign 人数。每槽左下 4 个原生圆点，直径 4 px、净间距 2 px。

## 文件与节点

- `ui/camp_hud/survivor_roster.tscn`：背景、Header、四个独立 Slot。
- `ui/camp_hud/portrait_slot.tscn`：复用 Button 场景，包含 PortraitTexture、FrameTexture、StatusDots。
- `ui/camp_hud/survivor_roster.gd`：默认 selected_index=0；点击槽时更新唯一选中框并发出 selection_changed(index)，不连接 M05 或 Gameplay。重复选择与无效索引不发信号。
- `ui/camp_hud/camp_hud_root.tscn`：仅 M04 尺寸偏移调整。
- `tests/camp_survivor_roster_runtime.gd`：原生点击与截图验收；共享骨架检查只为正式接入的 M04 放开贴图限制。

## 验证

413 项原生检查通过，覆盖 1600×900、1280×720、1024×640、1920×1080。每档使用原生鼠标事件遍历选择，确认唯一高亮、旧框复位、信号顺序、重复/无效选择、固定尺寸与步进、文字完整显示、Campaign 与相机不变。

默认首项高亮截图：`test-output/camp-survivor-roster/camp-1600x900.png`。第三项高亮证据：同目录 `camp-selected-third.png`；其他分辨率、布局与断言见同目录 `runtime.json`。

独立目录 EXE 原生启动通过，退出码 0；导入、运行、导出与独立启动日志均无 Script Error、Missing Resource 或 Invalid UID。

59 个受保护文件哈希一致；M01～M03、M05～M09 截图区与上一版逐像素一致。Windows 独立导出路径：`test-output/camp-survivor-roster/standalone/BlueHourHomeward.exe`。验证使用 `user://test-runs/` 隔离存档，未运行历史全量 build 测试链。待本轮截图验收，不进入 M05。
