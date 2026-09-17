# Camp HUD M00 基础骨架

日期：2026-09-16。范围仅为布局骨架，视觉位置与比例依据本轮用户提供的 1672×941 最终效果图换算到 1600×900。没有引用历史 Camp HUD 的布局或美术文件。

## 文件与结构

`ui/camp_hud/camp_hud_root.tscn` 为根场景，`camp_hud_root.gd` 仅处理响应式尺寸、模块显隐和入口信号。九个模块均为独立 `.tscn`，共享 `placeholder_theme.tres` 的灰色半透明面板与 1 px 边框。各模块包含静态命名子区域；M04 四个头像槽不对应真实人数。`core/main.gd` 挂载根场景，并连接原有今日行动及返回主菜单流程。

```text
CanvasLayer
└── CampHUDRoot
    ├── M01_CampIdentity       (camp_identity.tscn)
    ├── M02_TimeStatus         (time_status.tscn)
    ├── M03_ResourceBar        (resource_bar.tscn)
    ├── M04_SurvivorRoster     (survivor_roster.tscn)
    ├── M05_SurvivorDetail     (survivor_detail.tscn)
    ├── M06_CampActionRail     (camp_action_rail.tscn)
    ├── M07_LoadoutPanel       (loadout_panel.tscn)
    ├── M08_DepartAction       (depart_action.tscn)
    └── M09_Utility            (utility.tscn)
```

## 1600×900 布局

位置是左上角坐标。四个 Anchor 值使用相同的模块锚点；Offset 为左、上、右、下。模块自身尺寸保持设计像素，由根脚本在窗口变化时做等比缩放。

| 模块 | X, Y | 宽×高 | Anchor X, Y | Offset L, T, R, B |
| --- | --- | --- | --- | --- |
| M01 CampIdentity | 24, 16 | 228×244 | 0, 0 | 24, 16, 252, 260 |
| M02 TimeStatus | 480, 16 | 568×76 | 0.5, 0 | -320, 16, 248, 92 |
| M03 ResourceBar | 1120, 20 | 464×60 | 1, 0 | -480, 20, -16, 80 |
| M04 SurvivorRoster | 1478, 126 | 106×424 | 1, 0 | -122, 126, -16, 550 |
| M05 SurvivorDetail | 1100, 278 | 354×452 | 1, 0.5 | -500, -172, -146, 280 |
| M06 CampActionRail | 28, 278 | 112×330 | 0, 0.5 | 28, -172, 140, 158 |
| M07 LoadoutPanel | 624, 776 | 316×82 | 0.5, 1 | -176, -124, 140, -42 |
| M08 DepartAction | 1264, 744 | 320×112 | 1, 1 | -336, -156, -16, -44 |
| M09 Utility | 24, 844 | 180×36 | 0, 1 | 24, -56, 204, -20 |

M05 与 M04 水平间距 24 px；M05 与 M08 垂直间距 14 px。M02 与 M03 间距 72 px。根节点不绘制背景，也不拦截中央场景输入；模块区域阻挡穿透点击。窗口适配采用 `min(width / 1600, height / 900)` 缩放，边缘模块保持对应屏幕锚点，超宽窗口增加中央留白。

## 验证

- Godot 4.7.2 Compatibility 原生渲染，`tests/camp_hud_skeleton_runtime.gd`：294 项、0 失败。
- 1600×900、1280×720、1024×640、1920×1080、2560×1080：九模块全部可见，无模块交叠或越界，中央保留区域无 HUD。
- 主入口进入 Camp；静态 HUD 不改 Campaign；原生合成鼠标点击 DEPART、ESC 关闭、再次确认出发并到达 Mission 均通过。关闭今日行动保持原 Camp 实例及相机变换。
- 导入、原生验证、Windows 导出、独立目录 Camp / TodayAction 原生启动日志均无 SCRIPT ERROR、ERROR、Missing Resource 或 Invalid UID。
- 导出文件：`build/BlueHourHomeward.exe`。通过 Godot `--export-release` 构建；没有运行仍依赖已删除 Camp HUD 的历史全量 `run.ps1 -Mode build` 测试链。
- 截图：`test-output/camp-hud-skeleton/camp-hud-1600x900.png`；结构结果：同目录 `runtime.json`；独立程序日志：`standalone/camp.log` 与 `standalone/today-action.log`。

截图来自隔离测试存档与两个现有角色，属于真实引擎自动化运行证据，不是用户当前存档验收。没有修改 Camp 场景、Camera、Lighting、Navigation、Survivor AI 或其他 HUD；不恢复旧 HUD，不接入正式美术。仓库原有旧 HUD 删除及其他未提交工作保持原状。

用户视觉验收待完成。本阶段已停止，不进入 M01。
