# Expedition Survivor Command V1

2026-09-18，基于现有 Mission、SquadInput、SearchTask 与 WorldInteractionVFX 完成。

## 根因与修复

地面点击和持续按住左键均调用 `Mission.command_move()`。旧实现首先无条件 `_release_tasks()`，在下发路径之前就结束了全部搜索。实际输入回归在修复前出现 3 项失败：A 的任务消失、进度停止、搜索卡隐藏；不是单纯的 UI 显示错误。

当前链路为：`SquadInput.handle/update → Mission.command_move → move_command_members → 可达路径检查 → 仅释放允许覆盖的搜索赶路任务 → order_move → 指令线 + 原有落点反馈`。

沿用现有小队指挥方式。当前头像/角色选择只用于查看和定位，未另建单人/多选命令状态或 RTS 指令系统。

| 当前状态 | 普通地面移动 |
| --- | --- |
| 空闲 / 正在移动 | 接受，更新目标 |
| 搜索赶路，尚未开始 | 接受，只取消该成员的未开始任务 |
| 正在进入建筑 | 拒绝，保留任务与进门过程 |
| 室内 / 室外搜索 | 拒绝，进度继续推进 |
| 已开始搜索后的自卫暂停 / 返回入口 | 拒绝，仍属于原搜索任务 |
| 阵亡 / 上车 / 正在出门 | 拒绝；出门完成后恢复可移动 |

SearchTask 在到达入口、开始进入或室外搜索时记录 `search_started`，不会因临时自卫把已开始任务误认成可覆盖的赶路任务。没有合法且可抵达的接收者时不更改集合点、不显示误导性的移动反馈。

搜索卡“取消搜索”继续走 `command_recall → SearchTask.release → _prune_tasks`，断开任务伤害订阅、清除占用和 searching 状态，搜索卡立即隐藏，室内角色完成原有 0.3 秒出门后可移动。搜索进度保留，完成后奖励与任务清理仍由原有流程负责。集合、撤离、显式改派仍是明确操作；自卫暂停、死亡和完成规则未移除。

## 指令反馈

在现有 `WorldInteractionVFX` 增加运行时 `ImmediateMesh` 双三角形细带，半透明青蓝色，宽 0.035m，持续 0.8 秒，前 0.2 秒后逐渐淡出。起点跟随接受指令的角色脚下，终点为本次地面落点；保留队形成员各自的实际导航终点，不画完整寻路路径。

每名角色最多保留一条线，连续命令更新并重置其寿命；到期、阵亡、上车或转入搜索时回收。通过 WeakRef 读取角色，节点归 Mission 下的 VFX 层管理。原有选中环、搜索反馈、点击落点反馈不变。没有新增 PNG、角色模型、骨骼、Blender、动画或 UI 素材。

## 实际验证

验证使用正式 Mission/HUD、固定内存 Campaign 和合成鼠标输入，不写入玩家存档。参考视频 1 按秒取帧核对问题，视频 2 取连续帧核对短暂命令反馈；最终参数按本作视角与用户要求确定。

| 验证 | 结果 |
| --- | --- |
| 修复前 `tests/survivor_command.gd` 地面点击复现 | 6 项检查，3 项预期失败 |
| Survivor Command headless 行为回归 | 43/43 |
| Survivor Command 原生运行及截图 | 45/45 |
| 搜索状态卡与定位 | 157/157 |
| Expedition HUD | 258/258 |
| 搜索派遣 | 56/56 |
| 室内搜索 | 13/13 |
| 三人并行、指向射击、集合与撤离 | 36/36 |
| 设置 | 14/14 |
| Windows release 单独导出 | 成功 |
| 独立目录 EXE 原生 Expedition 启动 | 退出码 0，无脚本或资源错误 |
| EXE 内嵌包搜索/移动/指令线/选中环/取消 | 通过，无运行时错误 |

新增专项覆盖：A 搜索/B 移动、连续命令与按住拖动、进门保护、全员搜索拒绝移动、自卫与恢复、赶路取消、显式取消及订阅清理、完成和另一任务并行推进、线条跟随/淡出/回收、无有效命令时无反馈、死亡/上车过滤，以及明确集合/撤离兼容性。

`parallel_commands.gd` 的旧前提失效：车辆搜索耗时 1 秒，测试等待 1 秒后已完成，却仍断言“三人全搜”。仅把该测试场景的三处耗时固定为 46 秒，让任务一直保持到测试主动完成；正式搜索配置未修改。

完整 `run.ps1 -Mode build` 已执行，Expedition 与设置检查通过后，仍被旧 `camp_ui_runtime.gd:114` 访问当前 CampHUDRoot 已无的 `member_buttons` 阻挡，另有旧能力栏断言失败。未修改 Camp 或跳过其错误冒充完整构建通过。单独导出与独立运行通过。本轮 Expedition 日志未出现之前的空纹理或退出实例泄漏错误。

## 证据与文件

- [指令线出现、A 继续搜索](../test-output/survivor-command/feedback-00.png)
- [指令线消失、A 继续推进](../test-output/survivor-command/feedback-30.png)
- [明确取消后的界面](../test-output/survivor-command/cancelled.png)
- [搜索完成后的界面](../test-output/survivor-command/completed.png)
- [1.2 秒原生渲染反馈录像](../test-output/survivor-command/command-feedback.mp4)：按 30 FPS 记录 36 帧；行为模拟和指令线同步以 1/30 秒推进，没有合成界面。
- [导出包实景](../test-output/survivor-command/packed.png)

行为实现：`missions/mission.gd`、`missions/search_task.gd`、`missions/squad_input.gd`。表现实现：`missions/world_interaction_vfx.gd`。回归：新增 `tests/survivor_command.gd`，更新 `search_active_card.gd`、`expedition_hud_phase2.gd` 与 `parallel_commands.gd`；专项已接入 `run.ps1` 的 test/capture/build。README、ADR-0003 和 PLAN 同步新规则。

日志、截图、视频与 EXE 均在忽略目录中；交付程序为 `build/BlueHourHomeward.exe`。完整记录位于 `test-output/survivor-command/`，构建元数据为 `build/BUILD-INFO.json`。
