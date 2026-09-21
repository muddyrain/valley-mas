# Camp Menu Overlay

2026-09-20。右上角 M03「菜单」从直接进入 Main Menu 改为在当前 Camp 内打开游戏内菜单；M09 `[ Esc ] 返回主菜单` 的视觉与 Overlay 未打开时的行为保持不变。

## 实现边界

- `CampHUDRoot` 将 M03 与 M09 拆成两个信号：M03 请求 `open_camp_menu_overlay()`，M09 继续复用 `show_main_menu()`。
- `CampMenuOverlay` 保持 Camp、Camera、Campaign 与 HUD 实例不变，只在同一 `CanvasLayer` 顶部增加全屏输入遮罩和居中面板。
- 四个动作分别为继续游戏、设置、返回主菜单、退出游戏。设置直接实例化现有 `SettingsView`；返回与退出直接连接 `Main.show_main_menu()`、`Main.request_quit()`。
- Overlay 打开时锁定 `camp_view.interaction_locked` 并禁用 Camp HUD 的处理；全屏 `MOUSE_FILTER_STOP` 遮罩和 `z_index=1000` 阻止点击穿透。关闭后恢复原输入状态。
- Esc 在 `Main._input()` 中先检查 Overlay：打开时只关闭 Overlay 并消费输入；关闭后仍走原 Camp Esc 返回主菜单分支。
- 菜单按钮继承公共 `StateButton`，0.12 秒 Cross Fade，固定 HitArea，Hover 与 Press 均不缩放、不位移。M01～M09 现有场景、PNG、Camp 3D、M07、M08、M09 和公共 `StateButton` 均未修改。

## 视觉与验收证据

`tests/camp_menu_overlay_runtime.gd` 使用 Godot 4.7.2 Compatibility、原生 1600×900 窗口、隔离测试存档和合成鼠标/键盘输入，共 30 项检查、0 失败：

- 右上角菜单不离开 Camp；Camp 与 Camera 实例保持不变。
- 400×440 菜单面板位于全屏遮罩顶层；下层 M09 点击被拦截。
- 继续、共享设置、返回主菜单、退出路由、Hover 中间态、固定 HitArea、Esc 优先级与输入恢复通过。
- `tests/camp_utility_runtime.gd` 87 项、`tests/settings.gd` 14 项继续通过。

四张验收图：

- `test-output/camp-menu-overlay/camp-normal.png`
- `test-output/camp-menu-overlay/menu-overlay-open.png`
- `test-output/camp-menu-overlay/settings-from-menu-overlay.png`
- `test-output/camp-menu-overlay/camp-after-overlay-close.png`

导入与专项日志未出现 Script Error、Missing Resource 或 Invalid UID。完整 `run.ps1 -Mode build` 已实际执行，本轮 Overlay 门禁 30/30 通过后，被既有 `tests/camp_ui_runtime.gd` 的旧 `member_buttons` 访问和旧能力栏断言阻断，因此不标记全量构建通过，也未修改受保护 HUD 迁就旧测试。

随后使用同一 Godot 4.7.2 正式 Windows preset 单独导出，并在隔离目录分别执行 Headless 与原生启动，两次均退出 0、无 `SCRIPT ERROR` / `ERROR`。交付文件为 `build/BlueHourHomeward.exe`，1,340,373,504 字节，SHA-256 `376ED35C50D3A5FE20FF080FF0721705CDB0FE070389E4A6F5E783F5371A60EF`。

本轮停止于 Camp Menu Overlay，等待视觉验收，不继续修改其他 Camp HUD 模块。
