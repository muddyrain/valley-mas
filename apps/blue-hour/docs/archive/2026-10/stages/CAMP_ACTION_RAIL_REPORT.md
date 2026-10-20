# Camp HUD M06 Camp Action Rail

2026-09-19。本轮只接入并修正 M06 左侧行动栏，保留根节点位置 `(28,278)` 与 `112×330` 外框；M01～M05、M07～M09、Camp 3D、相机与既有 PNG 未改动。

## 实现

- `camp_action_rail.tscn` 将旧占位槽替换为 `TemporaryBuff`、`MedicalSupport`、`LockedAction` 三个独立纵向槽；可用槽统一包含 `NormalTexture`、`HoverTexture`、`Icon`、`Label`、`Keycap` / `KeyLabel`，图标中心为 `(33,26)`，Keycap 统一锚定 `(67,56)`。
- 两个可用槽使用 `m06_action_button_bg.png`，分别显示临时增益 / 医疗支援、图标和动态 Q / E Keycap；锁定槽使用 `m06_action_button_disabled_bg.png`、锁图标和“后续解锁 / 敬请期待”。
- `state_button.gd` 提供公共 Normal/Hover/Selected/Disabled 双层 Cross Fade、固定 Button HitArea、Tween 替换和 VisualRoot Pressed 反馈；`m06_action_button.gd` 只配置 M06 的 0.58 强度 Glow 和轻微提亮 NormalTexture/Icon。Hover 不改变 Button 或 VisualRoot Scale，Pressed 只缩放独立 VisualRoot 到 0.98，所有视觉子节点 `mouse_filter=IGNORE`。
- `camp_action_rail.gd` 接收鼠标点击及 Q/E 快捷键，发出本地 `action_requested` 信号并记录 `last_action`，不接入 Gameplay 或 Campaign。
- 七张素材原样放入 `assets/ui/camp/m06/`，不重制、不修改图片内容。

## 验证

- `tests/camp_action_rail_runtime.gd`：365 项检查零失败，覆盖 1600×900、1280×720、1024×640、1920×1080。两个按钮各快速跨越边缘 20 次，逐帧确认 HitArea 和按钮图形矩形不变、旧 Tween 被替换；实际鼠标按下仅缩放 VisualRoot，离开后光效与亮度归位。其他检查覆盖素材、动态文字、统一间距、Q/E 与 Campaign 不变。
- Godot import 与原生运行通过，日志无 Script Error、Missing Resource 或 Invalid UID。
- 1600×900 截图：`test-output/camp-action-rail/camp-1600x900.png`；临时增益 Hover：`camp-hover-1600x900.png`；医疗支援 Hover：`camp-hover-medical-1600x900.png`。
- Windows release 导出与独立原生启动通过，退出码 0，使用 `user://test-runs/camp-action-rail-jitter.json` 隔离存档。产物为 `build/BlueHourHomeward.exe`；本轮未运行全项目测试链。

本阶段到 M06 停止，不进入 M07。
