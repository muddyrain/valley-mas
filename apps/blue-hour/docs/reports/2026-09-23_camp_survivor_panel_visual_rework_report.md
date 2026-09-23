# Task Report

## Summary

执行《蓝时归航 Camp Survivor Panel V2 目标效果图视觉重构（无新增素材优先版）》的合并验收。附件要求的 Roster 角色卡、Detail 档案卡和 Open / Close / Switch 动画已在本对话前两轮落地；本轮逐项核对现有实现、正式数据链和原生画面，复跑 Godot 导入、Roster 集成及动画专项，并保留独立报告。不为同一目标重复改写生产代码。

结论：在 macOS 环境，附件列出的 UI、数据一致性、动画、Godot 导入与 1600×900 验收均通过；Windows 发布构建仍待可访问的 Windows 设备。

## Changed Files

本轮新增：

- `docs/reports/2026-09-23_camp_survivor_panel_visual_rework_report.md`：本合并验收报告。

本轮修改：

- `docs/PLAN.md`：增加附件合并验收与本报告入口。

本轮删除：无。本轮没有再次修改生产脚本或新增图片素材。下列现有文件承载已落地的功能并在本轮复核：

- Roster：`ui/camp_hud/portrait_slot.tscn`、`portrait_slot.gd`、`survivor_roster.tscn`、`survivor_roster.gd`。
- Detail：`ui/camp_hud/survivor_detail.tscn`、`survivor_detail.gd`。
- 路由与数据：`ui/camp_hud/camp_hud_root.gd`、`survivor_roster_adapter.gd`。
- 动画专项：`tests/camp_survivor_detail_animation.gd`。

## Data Flow

Camp 继续从 `SurvivorRosterManager.get_recruited_survivors()` 构建视图；`SurvivorRosterAdapter` 使用同一 `survivor_id` 对应的 `SurvivorDefinition` 与 `SurvivorProfile` 输出名称、正式头像、Trait 和详情。Roster 与 Detail 消费同一视图中的 `portrait` 纹理。Definition 的 `portrait_path` 指向 `assets/characters/<character_id>/portrait/avatar_square.png`。

- SUR_001：`res://assets/characters/xia_zhiyao/portrait/avatar_square.png`。
- SUR_002：`res://assets/characters/su_wanxing/portrait/avatar_square.png`。
- Roster 装饰框沿用 `res://assets/ui/camp/m04/m04_portrait_frame_normal.png` 和 `m04_portrait_frame_selected.png`，只表示交互状态，不参与身份绑定。

本轮复核的 Camp 脚本没有旧 `survivor_avatars`、GLB 截图或 fixture 头像引用，也没有按名字或数组顺序匹配头像。未改 Survivor Framework、Trait、Progression 或 Recruitment。可选展示字段缺失时，详情脚本隐藏标签/描述/Trait 或显示安全默认值。

## UI Changes

### Roster

现有实现为 100×110 的竖向头像卡，头像为视觉主体，底部只保留姓名和等级；normal / hover / selected 有明确差别，选中框为蓝色。标题只显示“营地成员”和当前已招募人数。成员较少时收紧轨道，超过可见范围后显示细滚动条。

### Detail

现有实现采用蓝色上部角色展示区和浅色下部档案卡。展示姓名、SUR ID、等级、状态、HP、放大的正式头像、人物小记、装备与战力、四条属性、Trait 和底部按钮。结构与附件要求一致，没有增加新美术依赖。

### Animation

Open：0.26 秒、从右侧 24 px 淡入；Close：内容先淡出，面板约 0.22 秒向右 18 px 收回；Switch：外壳保持稳定，内容以 0.08 秒淡出、0.16 秒淡入。再次点击当前卡片是关闭入口。动画状态和快速点击收敛逻辑见[动画报告](2026-09-23_camp_survivor_detail_open_close_animation_report.md)。

## Validation

| 验收项 | 本轮结果 |
| --- | --- |
| Godot 4.7.2 Headless Editor 导入 | PASS |
| Camp Roster 集成、招募人数、正式姓名/头像/详情一致性 | PASS，0 failures |
| 原生 Open / Switch / Close、连续点击与中断恢复 | PASS，0 failures |
| 1600×900 Camp 默认 / SUR_001 / SUR_002 截图 | PASS，均为 1600×900 |
| 目标图对照：头像卡、蓝色选中、档案卡层级 | PASS，使用现有 Godot 控件和资源 |
| Windows EXE 构建与独立程序启动 | 未执行；当前没有可访问的 Windows 设备 |

原生截图：

- [默认状态，详情关闭](../../test-output/camp-survivor-detail-animation/closed-1600x900.png)
- [SUR_001 夏知遥详情打开](../../test-output/camp-survivor-detail-animation/open-sur001-1600x900.png)
- [SUR_002 苏晚星切换完成](../../test-output/camp-survivor-detail-animation/switch-sur002-1600x900.png)
- [打开过程](../../test-output/camp-survivor-detail-animation/opening-1600x900.png)
- [关闭过程](../../test-output/camp-survivor-detail-animation/closing-1600x900.png)

[Open / Switch / Close 原生录屏](../../test-output/camp-survivor-detail-animation/open-switch-close.mp4)：1600×900、30 FPS、5.3 秒。

详细结构改动见[展示版报告](2026-09-23_camp_survivor_panel_report.md)，详细动画实现见[动画报告](2026-09-23_camp_survivor_detail_open_close_animation_report.md)。

## Environment

| 工具 | macOS environment | Windows environment |
| --- | --- | --- |
| Godot Editor | 4.7.2；本轮执行导入与原生 Compatibility 渲染 | 无可访问设备，未运行 |
| Blender | 已安装，本轮未使用 | 无可访问设备，未运行 |
| Node | v22.22.3；本轮未修改生产代码 | 无可访问设备，未运行 |
| Git | 2.55.0；检查工作区和变更 | 无可访问设备，未运行 |

[macOS] macOS compatible。用户此前已选择先交付 macOS 验证结果；本轮没有平台专属 UI 实现。

[Windows] Windows environment required。macOS 验证不能代替 Windows 正式构建和独立程序启动。

## Known Issues

- 缺少可访问的 Windows 设备，Windows 构建和独立程序启动未验收。
- 四条属性目前仍使用现有视图模型中的相同 HP 比例数值；底部按钮仍服从当前 disabled 的 `action_states`。这些是数据/功能现状，不在附件的视觉与动画改动范围内。
