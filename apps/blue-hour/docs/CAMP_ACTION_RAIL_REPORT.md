# Camp HUD M06 Camp Action Rail

2026-09-19。本轮只接入并修正 M06 左侧行动栏，保留根节点位置 `(28,278)` 与 `112×330` 外框；M01～M05、M07～M09、Camp 3D、相机与既有 PNG 未改动。

## 实现

- `camp_action_rail.tscn` 将旧占位槽替换为 `TemporaryBuff`、`MedicalSupport`、`LockedAction` 三个独立纵向槽；可用槽统一包含 `ButtonBG`、`HoverGlow`、`Icon`、`Label`、`Keycap` / `KeyLabel`，图标中心为 `(33,26)`，Keycap 统一锚定 `(67,56)`。
- 两个可用槽使用 `m06_action_button_bg.png`，分别显示临时增益 / 医疗支援、图标和动态 Q / E Keycap；锁定槽使用 `m06_action_button_disabled_bg.png`、锁图标和“后续解锁 / 敬请期待”。
- `m06_action_button.gd` 共享 Hover Glow、1.02 Hover 缩放、0.98 Pressed 缩放和 0.10～0.15 秒级过渡；pivot 固定在圆形按钮中心 `(48,41)`，Hover Glow 透明度收敛为 0.58，锁定槽是无样式 Panel，无法响应 Hover。
- `camp_action_rail.gd` 接收鼠标点击及 Q/E 快捷键，发出本地 `action_requested` 信号并记录 `last_action`，不接入 Gameplay 或 Campaign。
- 七张素材原样放入 `assets/ui/camp/m06/`，不重制、不修改图片内容。

## 验证

- `tests/camp_action_rail_runtime.gd`：233 项检查零失败，覆盖 1600×900、1280×720、1024×640、1920×1080，检查三槽几何、素材、动态文字、统一中心与间距、Hover Glow、Pressed、鼠标点击、Q/E、本地无存档变更。
- Godot import 与原生运行通过，日志无 Script Error、Missing Resource 或 Invalid UID。
- 1600×900 截图：`test-output/camp-action-rail/camp-1600x900.png`；临时增益 Hover：`camp-hover-1600x900.png`；医疗支援 Hover：`camp-hover-medical-1600x900.png`。
- Windows 独立构建按项目要求另行验证，使用 `user://test-runs/camp-action-rail.json` 隔离测试存档。

本阶段到 M06 停止，不进入 M07。
