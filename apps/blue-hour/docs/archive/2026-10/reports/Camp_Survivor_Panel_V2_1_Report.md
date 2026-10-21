# Camp Survivor Panel V2.1 Report

## 1. 修改文件

- `ui/camp_hud/survivor_detail.tscn`
- `ui/camp_hud/survivor_detail.gd`
- `ui/camp_hud/camp_hud_root.tscn`
- `ui/camp_hud/portrait_slot.gd`
- `tests/camp_roster_recruitment_integration.gd`
- `tests/m05_selected_survivor_detail_data.gd`
- `tests/camp_survivor_detail_animation.gd`
- `tests/camp_survivor_panel_visual_capture.gd`（新增隔离 UI 验证与截图脚本）
- `docs/PLAN.md`
- `docs/reports/Camp_Survivor_Panel_V2_1_Report.md`

没有新增 PNG UI 素材，没有修改 Survivor 数据结构、头像资源结构或装备玩法逻辑。

## 2. 修改内容

- 右侧幸存者栏维持 118px 窄栏和纵向头像卡；选中卡放大至 1.03 并加强蓝色边框，未选头像降低亮度，Hover 保留轻微上浮反馈。
- Detail 维持紧凑整备布局，尺寸为 390×526；左侧展示姓名、SUR ID、等级、状态、HP、任务定位，右侧展示正式头像。隐藏 Profile 生平摘要，避免它挤压或覆盖任务标签。
- 装备区显示武器名称、类型和综合战力，并预留 38×38 纯控件图标槽。
- 保留生存能力、火力输出、团队支援、机动性四项及现有数据绑定；调整间距、数值可读性和进度条样式。
- 底部保留“切换 / 装备 / 升级幸存者”；升级按钮视觉优先级提高，运行时可用状态仍由原 action state 控制。
- 修改只涉及 Camp UI 布局、显示和转场；Survivor ID 数据链与存档结构不变。

## 3. 当前截图路径

隔离面板截图（1600×900）：

- `test-output/camp-survivor-panel/camp-panel-isolated-1600x900.png`

动画状态截图（1600×900）：

- `test-output/camp-survivor-detail-animation/open-sur001-1600x900.png`
- `test-output/camp-survivor-detail-animation/switch-sur002-1600x900.png`
- `test-output/camp-survivor-detail-animation/closing-1600x900.png`
- `test-output/camp-survivor-detail-animation/closed-1600x900.png`

上述截图通过隔离 UI 脚本直接实例化正式 Panel 与 PortraitSlot，并加载正式幸存者头像。它们用于检查面板布局、头像、选中态和转场，不代表完整 Camp/Main 流程截图。目录中旧的 Main 场景截图包含存档错误弹窗，不作为本次验收证据。

## 4. 动画调整说明

- Open：0.30 秒，向左滑入、Alpha 0→1、Scale 0.96→1，Cubic Ease Out。
- Close：0.22 秒，向右退出并淡出，轻微缩至 0.98，Sine Ease In。
- Survivor Switch：内容退出 0.06 秒，内容进入 0.10 秒；壳层保持稳定，不增加角色登场动画。
- 新增隔离测试覆盖 Open、SUR_001→SUR_002 快速切换和 Close，测试通过。

## 5. 验证与未完成问题

- Godot 4.7.2 Headless Editor Import：通过。
- 隔离 UI / 动画截图脚本：0 failures，生成上列截图。
- Main 驱动的 Roster、M05 和原动画专项：不能判定通过。运行时报告 `maps/exploration.gd` 解析错误，`core/main.gd` 因依赖编译失败；旧测试仍输出 0 failures，不能作为有效结果。
- Windows 标准 build：执行至 `tests/camp_ui_runtime.gd` 后失败。该测试访问 `CampHUDRoot.member_buttons`，并触发“Camp exposes active abilities on its left edge”断言。发布导出和独立 EXE 启动阶段未执行。
- 当前四项属性仍由 adapter 的 HP 比例占位值驱动；切换、装备、升级按钮的 gameplay actions 尚未开放。
- 完整 Camp/HUD 实机截图、完整流程回归和独立 EXE 验收未完成。

GitNexus MCP 工具在本会话不可用；影响范围通过原生代码搜索核查。没有修改 Main、地图、Campaign 或武器系统代码。

## 6. 下一阶段建议

1. 修复并回归当前 `maps/exploration.gd` 解析错误及 Main 依赖链，再运行 Main 驱动的 Roster、Detail 与动画专项。
2. 更新 `camp_ui_runtime.gd` 对旧 `member_buttons` 的引用和能力栏布局断言，重新执行完整 build。
3. 在完整 Camp 流程可启动后，补充无弹窗的 Camp 原生截图与独立 EXE 启动验收。
4. 后续接入真实四维属性数据和三项操作行为时，保持本面板只负责呈现与输入路由。
