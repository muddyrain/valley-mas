# Mission Selection V2 Runtime Style + Open/Close Transition

2026-09-19。仅修改今日行动页面表现和专项测试，无新美术资源，无 Camp / Expedition Gameplay 改动。

## 修改文件

- `ui/today_action_screen.gd`：布局、Atlas 裁切、动态字段、交互动效和页面关闭时序。
- `tests/mission_selection_runtime.gd`、对应 `.uid`：隔离存档下的原生鼠标输入、动画期间锁定、返回、出发和分辨率验收。
- 本报告与 `docs/PLAN.md`：记录交付与构建阻塞。

页面仍由 `core/main.gd::show_today_action()` 动态创建，没有新增 Scene，没有修改 Main、Camp 或共享 Hover 脚本。

## 资源与结构

所有路径相对 `assets/ui/`，没有生成或修改 PNG。

| 用途 | 复用资源 | 组合方式 |
| --- | --- | --- |
| 主板 | `today_action/today_action_board.png` | NinePatch，90px 源边距，保留纸边和内边框 |
| 三张卡片 | `common/cards/ui_common_card_paper.png` | 空白纸底；标题、图、类型、距离、收益与三组五点评级运行时排版 |
| 顶部资源条 | 同一空白卡片 | 只裁取内部 `Rect2(40,100,220,64)` 干净纸纹，横向平铺；分隔线独立绘制 |
| Briefing 正文 | `common/panels/ui_common_paper_panel.png` | `Rect2(110,140,1954,439)`，NinePatch 正文纸面 |
| Briefing 装饰 | `today_action/today_action_selection_bar.png` | 仅取左侧 `Rect2(0,94,435,423)` 相框/纸夹；不取右侧烘焙横线 |
| 缩略图 | 原住宅、商业、空投缩略图 | 原路径绑定，不替换图片 |
| Logo | `common/branding/ui_common_logo_tagline_compact.png` | 沿用 Art.LOGO，保持比例 |
| 资源图标 | `camp/m03/m03_icon_food.png`、`m03_icon_scrap.png` | 原图复用 |
| 按钮 | TodayAction green/red/blue 按钮 | 原有效区域 Atlas；绿确认、红返回，亮度区分 Hover/Pressed，禁用态沿用蓝底 |
| 选中强调 | `paper_card_hover.gd` 的既有轮廓 Shader | 蓝 rim、弱 glow、动态“已选择”Tag；没有新增状态 PNG |

停止使用：不透明 Gradient 页面背景、大浅灰圆角外壳、姓名 Chip、旧四方槽任务卡、严重压缩的旧状态条、完整 Briefing 烘焙合成底图。

背景为真实 Camp → alpha 0.46 蓝灰遮罩 → 纸板与 UI。不替换场景，不生成假背景。

## 数据与接口

- `selected_party` 仍来自 Campaign，顶部只汇总人数，页面不编辑成员名单。
- Food、今晚需求、Scrap、Day、外勤人数接真实状态。
- 蓝时显示“出勤后 N 秒进入蓝时”，读取地图白昼时长与 modifier，不冒充营地实时倒计时。
- 卡片与 Briefing 均通过 `_ui_title()` 显示“空投区域”，ID 仍为 `airdrop`。
- 类型、距离和五点评级是页面决策语义，不新增距离模拟或独立完成条件；收益仍为倾向，不承诺固定数量。
- 保留 `departure_confirmed(action_id)`、`cancelled`、`selected_id`、`selected_party` 契约。

## 动画与输入

| 动画 | 时序 |
| --- | --- |
| 遮罩进入 | 0–0.18s |
| 主板进入 | 0.03–0.26s；scale 0.97→1，Y +16→0 |
| Header | 0.10–0.28s |
| 三卡进入 | 0.12 / 0.18 / 0.24s 启动，各 0.20s；Y +18→0 |
| Briefing 与按钮 | 0.30–0.48s；Y +10→0 |
| Hover | 0.14s，Y -4px，亮度 1.025；不放大卡片 |
| 选中切换 | 0.16s rim/Tag 与 Briefing 图片、文字交叉淡化；不重播整页 |
| 返回 | 总 0.30s；Footer 先退、卡片随后、主板缩至 0.985，遮罩最后淡出 |

打开/关闭期间禁用操作，整页拦截鼠标。关闭动画完成后才发 `cancelled`，Main 才恢复 Camp；`close_with_animation()` 可重复调用且不会重播。无需修改 Main 的 Camp 逻辑。

## 验证

- Godot 4.7.2 Compatibility 原生运行；专项完整流程 **23 checks / 0 failures**。
- 原生 Movie Maker 录制模式 **21 checks / 0 failures**；1600×900、30 FPS，约 6.93 秒。
- 1600×900 与 1280×720：卡片不越界、字段可读、无姓名 Chip、无旧四槽。
- 验证真实 Camp 按钮打开、过渡期间拒绝取消、鼠标选卡、统一空投命名、重复返回防护、Camp 实例不变、退出后解锁、party 不变，以及确认进入 departure/mission。
- 截图及录屏使用原生 Godot 渲染与自动注入鼠标输入；不是用户手动试玩。存档隔离为 `user://test-runs/mission-selection-runtime.json`。
- 专项日志无 Runtime Error / Missing Resource / Invalid Node。中文编码检查和定向 diff whitespace 检查通过。

证据位于 `test-output/`（不入版本控制）：

- `mission-selection-1600.png`、`mission-selection-hover.png`
- `mission-selection-1280.png`
- `mission-selection.mp4`：打开 → 商业街 → 空投区域 → 返回 Camp
- `mission-selection-runtime.log`、`mission-selection-recording.log`
- `mission-selection-build.log`

Windows `run.ps1 -Mode build` **实际执行但失败**：Search Gameplay 72、HUD Phase2 258、Survivor Command 45、Search Active Card 157、Settings 14 检查先通过；随后既有 `tests/camp_ui_runtime.gd:114` 访问已删除的 `member_buttons`，并触发旧“左侧能力”断言失败。另有 Survivor Command 测试退出时既有 4 ObjectDB 泄漏警告。没有修改这些跨任务文件，没有绕过门禁导出。

**正式 `build/BlueHourHomeward.exe` 未由本轮更新，未宣称新版独立 EXE 验证通过。** 后续需 Camp 对应任务更新旧测试后再走正式构建。视觉喜好仍需用户最终确认；本轮到此停止，不扩展 Mission Gameplay。
