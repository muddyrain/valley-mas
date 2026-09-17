# Camp HUD M03 Resource Bar

2026-09-17。仅接入 M03，M01、M02 保持冻结，M04～M09 保持骨架；本轮止于 M03。

## 最终微调与冻结

用户确认结构和素材通过。本轮三个资源图标从 30×30 放大至 34×34（约 13.3%），以原中心放大；文字左边缘移至 X=53，图文控件间距由 8 增至 11 px。三个数值从 22 增至 23 px，并增加 0.2 合成字重；仅对资源数值生效。菜单两行文字整体右移 3 px，汉堡图标及菜单尺寸不变。

M03 外框、卡片尺寸、卡片间距和全部 PNG 保持不变。537 项四分辨率运行检查通过；60 个受保护文件哈希一致，M01、M02、M04～M09 截图区与微调前逐像素一致。最新截图为 `test-output/camp-resource-bar-frozen/camp-1600x900.png`，本轮独立构建位于 `test-output/camp-resource-bar-frozen/standalone/BlueHourHomeward.exe`。

独立构建及原生启动通过，退出码 0；日志无 Script Error、Missing Resource 或 Invalid UID。使用隔离测试存档，未运行历史全量构建测试链。按用户要求，M03 在本轮收尾后 Freeze，不再主动调整，不进入 M04。以下为首次接入记录，当前参数以上述冻结版本为准。

## 资源与结构

用户 `m03_assets_final.zip` 六张 PNG 原字节保存于 `assets/ui/camp/m03/`，逐张 SHA-256 对照原包一致。使用 Godot Lossless 导入、透明边缘修复和线性过滤，TextureRect 等比居中，不裁切、不修改像素。

| 素材 | 原始尺寸 | 控件尺寸 |
| --- | --- | --- |
| m03_resource_chip_bg.png | 206×112 | 103×56，共享三次 |
| m03_icon_food.png / m03_icon_scrap.png / m03_icon_intel.png | 64×64 | 30×30 |
| m03_menu_button_bg.png | 232×112 | 116×56 |
| m03_icon_menu.png | 48×48 | 24×24 |

`ui/camp_hud/resource_bar.tscn` 沿用外框屏幕 (1120,20)、464×60。资源卡本地位置为 (1,2)、(117,2)、(233,2)，菜单为 (346,2)；间距 13/13/10 px。菜单本阶段为展示容器，没有新增点击流程。无 UI 业务脚本、动画或真实资源系统连接。

```text
M03_ResourceBar
├── ResourceFood
│   └── Background / Icon / Label / Value
├── ResourceScrap
│   └── Background / Icon / Label / Value
├── ResourceIntel
│   └── Background / Icon / Label / Value
└── MenuButton
    └── Background / Icon / LabelCn / LabelEn
```

Godot Label 动态渲染食物/10、废料/60、情报/3、菜单/MENU。资源名 13 px，数值 22 px 粗体；菜单中文 18 px、英文 9 px。中文字体沿用 SimHei / Heiti SC / Noto Sans CJK SC 回退，西文使用 Segoe UI / Noto Sans。

## 验证

- `tests/camp_resource_bar_runtime.gd` 原生检查 537 项通过，覆盖 1600×900、1280×720、1024×640、1920×1080；包含布局、间距、贴图尺寸、共享背景、文字边界/重叠、相机与玩法数据不变。
- 共享骨架检查仅新增 M03 正式贴图豁免，M04～M09 继续检查无正式贴图。
- 48 个受保护文件哈希一致；M01、M02、M04～M09 截图区与上一版逐像素一致。
- 1600×900 原生截图：`test-output/camp-resource-bar/camp-1600x900.png`；其他分辨率和 `runtime.json` 同目录。
- 默认 `build/BlueHourHomeward.exe` 正在运行，首次导出因目标文件不能替换失败。未终止该进程，改为独立路径导出成功：`test-output/camp-resource-bar/standalone/BlueHourHomeward.exe`。
- 独立目录程序原生启动通过，退出码 0；最终运行和成功导出日志无 Script Error、Missing Resource 或 Invalid UID。
- 测试使用 `user://test-runs/` 隔离存档；未运行引用已删除旧 HUD 的历史全量构建测试链。待本轮截图验收，不进入 M04。
