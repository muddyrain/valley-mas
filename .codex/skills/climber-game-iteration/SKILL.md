---
name: climber-game-iteration
description: 管理 `packages/climber-game` 的持续迭代、任务切换与提交节奏。用于维护 Climber 活跃 backlog、确定下一项、完成后移出并补下一项，以及与 `apps/web` 挂载入口解耦协作。
category: climber
---

# Climber Game Iteration

## 目标

让 `packages/climber-game` 按“小步快跑 + 每轮可提交”的方式推进，并与 Web 业务功能迭代保持清晰边界。

## 边界声明（强约束）

1. 本 skill 只用于 `packages/climber-game` 的任务清单与迭代推进。
2. `apps/web` 业务功能不在本 skill 范围内，Web 任务统一走 `web-feature-iteration`。
3. `apps/unity-climber` 不在本 skill 范围内，Unity 任务统一走 `unity-climber-iteration`。
4. `apps/web` 在本 skill 下仅作为挂载入口检查点，不承载 climber 核心任务。

## 工作流

1. 先维护任务清单：
   - 使用 [`references/CLIMBER-GAME-TASKS.md`](references/CLIMBER-GAME-TASKS.md)。
   - 活跃任务保持 3 到 5 项，完成即移出，补下一项。
2. 再确定本轮范围：
   - 纯游戏内核：只改 `packages/climber-game`。
   - 涉及挂载联动：补查 `apps/web` 入口，但不扩散到 Web 产品需求。
3. 然后落地改动：
   - 优先复用现有实现，不并行造第二套路线。
   - 每轮只推进少量可验证项，避免一次性堆任务。
4. 最后汇报状态：
   - 明确“已完成/部分完成/未开始”。
   - 写清楚清单里已移出项与下一项。

## 建议校验

1. `pnpm --filter @valley/climber-game exec tsc --noEmit`
2. 涉及 Web 挂载时：`pnpm --filter web exec tsc --noEmit`
3. 涉及构建链路时：`pnpm --filter @valley/climber-game build`
4. 涉及中文文案时：`python .codex/skills/encoding-guard/scripts/check_mojibake.py`

## 与其他 skills 的协作

1. 玩法定位、关卡边界、碰撞与可达性约束：联动 [`climber-game-design-guard`](../climber-game-design-guard/SKILL.md)。
2. 产品行为一致性：联动 [`valley-mas-product-guard`](../valley-mas-product-guard/SKILL.md)。
3. 组件/逻辑复用：联动 [`component-reuse-guard`](../component-reuse-guard/SKILL.md)。
4. 技能更新判断：联动 [`skill-sync-guard`](../skill-sync-guard/SKILL.md)。

## 输出要求

使用本 skill 的最终说明至少包含：

1. 本轮完成了什么（真实落地项）。
2. 活跃 backlog 当前剩哪些项（来自 `CLIMBER-GAME-TASKS.md`）。
3. 这次是否涉及 `apps/web` 挂载联动；若涉及，只说明挂载影响面。
4. 本轮执行了哪些校验命令，哪些未执行及原因。
