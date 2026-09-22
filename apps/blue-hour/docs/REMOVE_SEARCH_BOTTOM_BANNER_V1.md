# Expedition Remove Search Bottom Banner V1

本轮只收缩 Expedition 搜索反馈表现层，没有修改 SearchTask、`survivor_tasks`、`search_tasks`、Command System、Mission、Map、Enemy、Loot 或 Navigation。

## 修改文件

- `ui/mission_hud.gd`
  - 隐藏持续显示行动状态的底部 `order_label`。
  - 在 HUD 表现层过滤前往搜索、进度保留、搜索者归队/改派，以及行动暂停/继续等常规播报。
  - 保留搜索完成和奖励拾取反馈，但改为无大图底板的紧凑 Toast，显示 0.9 秒。
  - 多个完成结果仍按原队列顺序短暂显示，不影响奖励结算。
- `tests/search_gameplay.gd`
  - 将完成 Toast 的过期断言调整为新的 0.9 秒生命周期。
- `tests/search_interaction_polish_acceptance.gd`
  - 增加搜索与取消搜索均不生成底部状态横幅的断言。
- `docs/EXPEDITION_SEARCH_GAMEPLAY.md`、`docs/PLAN.md`
  - 同步紧凑 Toast 的 0.9 秒表现说明。

## 删除内容

以下内容不再通过底部中央状态栏呈现：

- `XXX 前往搜索 XXX`
- `搜索者归队 · 进度保留`
- `改派 XXX · 搜索进度保留`
- `全队集合 · 搜索进度保留`
- `搜索者阵亡 · 进度保留`
- `行动暂停` / `继续行动`
- 持续性的 `mission.order` 行动状态文本

这些文本仍可由 Mission 逻辑发出，但 HUD 会在表现层过滤，不改变命令或任务状态。

## 替代反馈方案

- 搜索进行中：继续使用世界空间 `SearchActiveCard`，显示建筑、搜索状态、实时进度和执行者。
- Hover / Selected：继续使用 `SearchDiscoverabilityCard` 的鼠标左键 glyph、搜索提示和目标态。
- 搜索完成 / 奖励拾取：保留执行者、目标和奖励信息，但改为 0.9 秒紧凑 Toast。
- 取消搜索：仅通过 SearchActiveCard 消失、建筑状态清理和幸存者行为变化反馈，不再弹出取消播报。
- 进度保留：再次查看目标时由 SearchActiveCard 显示真实百分比，不主动播报“进度保留”。

## 验证截图

- [双人搜索，无底部搜索横幅](../test-output/search-interaction-polish-acceptance/parallel-search.png)
- [取消 A 后 B 继续，无底部搜索横幅](../test-output/search-interaction-polish-acceptance/cancel-a-b-continues.png)
- [Hover 搜索提示](../test-output/search-interaction-polish-acceptance/hover-search-prompt.png)
- [完成奖励轻量反馈](../test-output/search-gameplay/completed-found.png)

并行搜索、取消和 Hover 截图为 1600×900；完成奖励截图为既有 1920×1080 native capture。并行搜索截图中两个 SearchActiveCard 同时可见，底部中央没有搜索命令横幅。

## 验证结果

- `search_gameplay.gd`：67 checks，0 failures（headless）；native capture：72 checks，0 failures。
- `search_interaction_polish_acceptance.gd`：15 checks，0 failures。
- `search_active_card.gd`：137 checks，0 failures。
- `search_command_ownership.gd`：14 checks，0 failures。
- `survivor_command.gd`：43 checks，0 failures。
- Godot editor import：通过。
- `git diff --check`：通过。

## 已知限制

- 既有 `tests/poi_context_runtime.gd` fixture 仍有历史并行任务 / Dictionary 访问失败；本轮未修改其 SearchTask 生命周期。
- `expedition_visual.gd` 当前仍有其他工作树改动带来的 24 项基线失败（tracker 尺寸、旧 Hover 语义和建筑贴图 mipmap），未作为本轮搜索反馈验收条件。
- 全量视觉基线仍可能受其他工作树中的 Medium Town 改动影响；本轮专项 native 搜索流程已完成并生成截图，地图脚本不在本轮修改范围。
- 本轮没有新增 PNG 或改变搜索玩法，只调整 HUD 表现层和相关验收计时。
