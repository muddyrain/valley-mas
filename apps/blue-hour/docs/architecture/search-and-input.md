# 搜索、命令与输入契约

Mission 管理活动任务；每个地点持有独立 SearchTask，进度归地点。`search_tasks[target_id]` 与 `survivor_tasks[member_id]` 是同一批任务的两个索引，绑定、取消、改派、完成和死亡时同步更新。

- 每名成员最多一项任务，每个目标最多一个活动任务；允许全员分散搜索。单人取消或改派不能抢走其他任务成员。
- 正式输入传入选中成员；`command_search` 仍有无参数的兼容选择路径，最终检查空闲、存活和可抵达。检查 UI 选择不等于修改任务归属。
- 建筑任务共用进入、隐藏搜索和退出生命周期，室内成员不是外部目标；车辆搜索者留在外部，遇险暂停自卫，安全后恢复，进度不被取消抹除。
- 指向射击只控制掩护成员，保留弹药、射程和墙体约束；武器不绑定职业。
- 从地面开始按住左键才连续带队；拖过建筑不连续派遣。Ctrl 松开、进入 UI、打开菜单/Debug 和失焦释放持续输入。
- 撤离等待所有存活成员抵达、巴士准备和关门；阵亡明确结算，全灭按 Run/携带物资规则处理，结果只入账一次。

实现入口：[Mission](../../missions/mission.gd)、[SearchTask](../../missions/search_task.gd)、[输入](../../missions/squad_input.gd)。专项入口：[搜索派遣](../../tests/search_dispatch.gd)、[并行命令](../../tests/parallel_commands.gd)、[运行输入](../../tests/controls_runtime.gd)、[跨日流程](../../tests/day_loop_flow.gd)。

架构取舍与旧接口建议见 [归属重构历史](../archive/2026-10/stages/SEARCH_COMMAND_OWNERSHIP_REFACTOR_PLAN.md)，旧方案不替代现有兼容实现。
