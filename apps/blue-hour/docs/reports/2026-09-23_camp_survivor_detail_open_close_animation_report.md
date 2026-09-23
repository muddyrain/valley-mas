# Task Report

## Summary

为 Camp 的 Survivor Detail Panel 接入克制的打开、关闭与角色切换动画。点击已选中的 Roster 卡片可关闭面板；连续点选、过渡中切换和关闭中重新打开均会收敛到最后一次有效选择。仅修改 Camp UI 展示层，保留现有 Survivor 数据和头像绑定。

## Changed Files

修改：

- `ui/camp_hud/survivor_detail.gd`：增加 Tween 过渡、明确的状态机和中断处理；保留原有数据渲染方法。
- `ui/camp_hud/survivor_roster.gd`：增加当前卡片再次点击信号及清除选中态方法；程序调用 `select_survivor()` 的语义保持不变。
- `ui/camp_hud/camp_hud_root.gd`：路由打开、切换、关闭和 HUD 暂时隐藏；布局更新时让动画回到稳定位置。
- `tests/camp_roster_recruitment_integration.gd`、`tests/m05_selected_survivor_detail_data.gd`、`tests/m05_avatar_binding.gd`：等待过渡完成后检查数据，避免把正常淡入期判成绑定失败。
- `AGENTS.md`：在既有报告规范内补充 UI 交互、截图/录屏，以及数据来源与旧逻辑影响记录要求。
- `docs/PLAN.md`：同步本轮动画和 macOS 验证状态。

新增：

- `tests/camp_survivor_detail_animation.gd`：覆盖 open / switch / close、连续点选、关闭中重开、HUD 隐藏恢复和 Campaign 数据不变。
- `docs/reports/2026-09-23_camp_survivor_detail_open_close_animation_report.md`：本报告。

删除：无。截图与录屏保存在本地 `test-output/`，按项目规则不纳入版本控制。

## Animation Design

| 状态 | 表现 | 时长 |
| --- | --- | --- |
| Open | 面板从右侧 24 px 移回布局位置，同时透明度 0→1；内部六块内容依次轻微错峰淡入 | 主面板 0.26 秒，内容 0.15 秒 |
| Close | 内容先淡出，面板随后向右 18 px 收回，透明度 1→0；完成后隐藏并重置位置与透明度 | 内容 0.08 秒，面板 0.20 秒加 0.02 秒延迟 |
| Switch | 保持面板外壳的位置和透明度；旧内容淡出后更新角色视图，新内容由下方 4 px 淡入并落位 | 0.08 + 0.16 秒 |

使用 Godot 原生 Tween，状态为 `CLOSED / OPENING / OPEN / CLOSING / SWITCHING`。新操作会取消正在冲突的 Tween 或更新待切换目标；待切换数据独立复制，避免清理动画队列时修改 Roster 的正式视图字典。布局改变或 HUD 暂时隐藏时直接收敛到完整的打开/关闭状态，不停留在半透明位置。没有新增素材、旋转、弹跳或大面积特效。

## Interaction Rules

- 点击未选中的幸存者卡片：从关闭态播放 Open；已打开时播放 Switch。
- 再次点击当前已选卡片：清除 Roster 选中态并播放 Close。这是本轮唯一新增的关闭入口，避免占用 Camp 的 Esc 或空白区域操作。
- 对同一已选成员的程序调用 `select_survivor()` 仍保持幂等；只有用户再次点击卡片才触发 Close。
- Camp HUD 被其他页面暂时隐藏时取消过渡；返回 Camp 后按保留的 `survivor_id` 重新打开详情。

数据来源仍为 `SurvivorRosterManager.get_recruited_survivors() → SurvivorDefinition / SurvivorProfile → SurvivorRosterAdapter → survivor_id → Roster / Detail`。头像仍由 Definition 的 `portrait_path` 指向 `assets/characters/<character_id>/portrait/avatar_square.png`；本轮不改数据、招募、Trait、Progression、装备或头像绑定逻辑。

## Validation

| 检查 | 结果 |
| --- | --- |
| Godot 4.7.2 Headless Editor 导入 | PASS |
| 动画专项：打开、关闭、切换、打开中关闭、关闭中重开、快速连点、HUD 隐藏恢复、Campaign 不变 | PASS，0 failures |
| Camp Roster 集成 | PASS，0 failures |
| M05 详情数据 | PASS，0 failures |
| M05 正式头像绑定与 hover | PASS，0 failures |
| Godot 原生 Compatibility 渲染 | PASS，1600×900 / Apple M3 Pro |
| `git diff --check` 与中文编码检查 | PASS |
| Windows build 与独立 EXE 启动 | 未执行；当前无可访问的 Windows 设备 |

原生 1600×900 截图：

- [面板未打开](../../test-output/camp-survivor-detail-animation/closed-1600x900.png)
- [打开过程](../../test-output/camp-survivor-detail-animation/opening-1600x900.png)
- [SUR_001 打开完成](../../test-output/camp-survivor-detail-animation/open-sur001-1600x900.png)
- [内容切换过程](../../test-output/camp-survivor-detail-animation/switching-1600x900.png)
- [SUR_002 切换完成](../../test-output/camp-survivor-detail-animation/switch-sur002-1600x900.png)
- [关闭过程](../../test-output/camp-survivor-detail-animation/closing-1600x900.png)
- [关闭完成](../../test-output/camp-survivor-detail-animation/closed-after-selection-1600x900.png)

[Open / Switch / Close 原生录屏](../../test-output/camp-survivor-detail-animation/open-switch-close.mp4)：1600×900、30 FPS、5.3 秒。

## Environment

| 工具 | macOS environment | Windows environment |
| --- | --- | --- |
| Godot Editor | 4.7.2，导入与原生 Compatibility 渲染通过 | 无可访问设备，未运行 |
| Blender | 已安装，本轮未使用 | 无可访问设备，未运行 |
| Node | v22.22.3，用于 GitNexus 影响检查 | 无可访问设备，未运行 |
| Git | 2.55.0，用于变更检查 | 无可访问设备，未运行 |

[macOS] macOS compatible。本轮仅使用 Godot 原生 Tween 和 CanvasItem 属性，无平台专属动画分支；macOS 的原生表现已验证。

[Windows] Windows environment required。正式 build 和独立程序启动仍需 Windows 环境验收；用户此前选择先交付 macOS 结果。

## Known Issues

- Windows 发布构建与独立程序启动仍待可访问设备。
- 详情底部三个操作按钮继续服从现有 `action_states`，当前处于 disabled；本轮不接入新的操作功能。
