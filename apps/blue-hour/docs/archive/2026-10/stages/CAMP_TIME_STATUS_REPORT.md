# Camp HUD M02 时间状态栏接入

2026-09-17。仅实现 M02 视觉与基础结构，使用固定展示数据；本轮停止，不进入 M03。M01 继续冻结。

## 最终收尾与冻结

用户已确认整体结构和背景。本轮太阳控件改为 30×30，左边缘从 X=28 移至 25，保持垂直居中；白昼与时间同时左移 4 px。当前白昼节点外径 16 px，蓝色边框 4 px、黄色中心 8 px，普通节点不变；四个阶段标签从 11 增至 12 px。波次从 20 改为 19 px，右侧文字组整体下移 2 px，倒计时结构不变。

M02 外框仍为 (480,16)、568×76，PNG 字节不变，无动画或 gameplay 改动。519 项原生运行检查通过，覆盖四种分辨率；M01 和 M03～M09 截图区与收尾前逐像素一致，48 个受保护文件哈希一致。Windows 构建完成。最新截图为 `test-output/camp-time-status-frozen/camp-1600x900.png`。

独立目录 EXE 启动通过，退出码 0；最终日志无 Script Error、Missing Resource 或 Invalid UID，使用隔离测试存档。按用户要求，本轮完成后 M02 Freeze，不再主动调整，不进入 M03。以下为首次接入记录，当前参数以上述冻结版本为准。

## 资源与布局

用户 `m02_assets_final.zip` 的两张 PNG 原样保存于 `assets/ui/camp/m02/`，SHA-256 对照包内原件一致：

| 文件 | 原始尺寸 | 显示尺寸 | SHA-256 |
| --- | --- | --- | --- |
| m02_status_bar_bg.png | 1136×152 | 568×76 | F9540D1910DEED99E7BBFDA989B19535E0CD4F9AFC686ACF83186831AE862943 |
| m02_icon_sun_day.png | 64×64 | 28×28 | 5C045F5CE7C30C60DE360D1D5CB2B3DE1D03D6B296E9A8A48135CFA0059FE10E |

沿用 M00 外框：1600×900 下屏幕 (480,16)、568×76；HUD 根及锚点未改。TextureRect 等比居中显示，Lossless 导入、线性过滤、透明边缘修复，不重制、不修改图片内容。

原图分隔线缩放后 X≈155/465，三区比例约 27.3%/54.6%/18.1%，没有追加分隔线。中段轨道宽 290、高 6，普通节点 10×10，当前节点 14×14；节点中心间距 74。亮蓝填充宽 78，当前白昼为蓝圈及暖黄色中心。

全部文字为 Godot Label：白昼 22 px、时间 16 px、阶段标签 11 px、波次 20 px、倒计时标题 10 px、数值 14 px。中文使用本机 SimHei / Heiti SC / Noto Sans CJK SC 回退，数字使用 Segoe UI / Noto Sans 回退。当前数据固定为白昼、10:24、第 1 波和 08:36:12，未连接时钟或新增 gameplay。

## 节点与文件

修改 `ui/camp_hud/time_status.tscn`，没有新增 UI 业务脚本。各显示节点独立，后续可直接更新文本、轨道填充宽度和节点样式。

```text
M02_TimeStatus
├── Background
├── CurrentTimeBlock
│   ├── SunIcon
│   ├── PhaseLabel
│   └── TimeLabel
├── PhaseTimeline
│   ├── TrackBase / TrackFill
│   ├── NodeDay / NodeDusk / NodeWarning / NodeBlueHour
│   └── LabelDay / LabelDusk / LabelWarning / LabelBlueHour
└── WaveCountdown
    ├── WaveLabel
    ├── CountdownTitle
    └── CountdownValue
```

新增 `tests/camp_time_status_runtime.gd`；共享骨架检查只将正式接入的 M02 加入素材豁免，M03～M09 仍检查无正式贴图。

## 验证

- 原生运行 519 项检查、0 失败，覆盖 1600×900、1280×720、1024×640、1920×1080；检查场景、相机、文字内容、边界、重叠、时间轴等距、当前节点高亮及展示不改写玩法数据。
- 截图：`test-output/camp-time-status/camp-1600x900.png`，其他分辨率及 `runtime.json` 同目录。
- M01 截图区与冻结版逐像素一致；44 个 PNG/import、其他 HUD、根布局和 Camp 文件哈希保持不变。
- Windows 导出及独立目录程序启动通过，退出码 0，最终日志无 Script Error、Missing Resource 或 Invalid UID。未运行引用已删除旧 HUD 的历史全量 build 测试链。
- 运行与独立启动使用 `user://test-runs/` 隔离存档。M02 待用户截图验收，止于本阶段。
