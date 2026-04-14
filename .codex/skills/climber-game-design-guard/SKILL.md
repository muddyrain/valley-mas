---
name: climber-game-design-guard
description: 统一 Valley MAS 中 packages/climber-game 的产品定位、关卡设计边界与目标职责，避免玩法漂移与实现分叉。用于任何与 climber-game 相关的新增功能、关卡路线调整、相机/角色手感修改、HUD 与菜单改动、可达性回归、资源结构或构建校验任务。
---

# Climber Game 设计护栏

这个 skill 用来约束 `packages/climber-game` 的长期演进方向：该包的核心职责是承载《攀爬动物：在一起》游戏体验，而不是演变成泛 3D 实验场或分散到 `apps/web` 的业务逻辑集合。

## 核心职责

1. 将 `packages/climber-game` 作为独立可玩游戏包维护，`apps/web` 仅保留挂载入口。
2. 持续服务《攀爬动物：在一起》的“向上攀爬”主循环：移动、跳跃、落地、登顶反馈。
3. 关卡设计优先保障“实跳可达 + 难度递进 + 区块辨识”，避免堆砌无关机制。
4. HUD、暂停菜单、角色切换等玩法内交互尽量内聚在游戏内，不依赖页面外临时控制。

## 关卡与玩法边界

1. 优先沿“单张大地图 + 多主题区块”演进，不回退到多关卡频繁切换方案。
2. 新增障碍或挑战段时，先验证是否提升攀爬体验，再决定是否引入移动障碍/摆锤/旋转杆等机制。
3. 任何路线改动都要做可达性回归：跳距、落差、斜坡贴合、边缘站立稳定性。
4. 视觉层与物理层必须尽量 1:1 对齐；禁止只改模型不校准碰撞。
5. 不把“内部提示词、实现思路、协作指令”暴露到玩家可见 UI 文案中。

## 改动决策顺序

1. 先确认需求是否服务《攀爬动物：在一起》主目标；若不是，先收敛为最小可用方案或拒绝扩散。
2. 优先复用现有实现与资产目录约定，不并行新建第二套逻辑。
3. 再决定改动落点：`packages/climber-game` 内核、`apps/web` 挂载层、还是工具脚本层。
4. 落地后同步更新任务清单，保持“活跃项短小可执行”。

## 优先检查文件

1. `packages/climber-game/**`
2. `apps/web` 中挂载 climber-game 的入口文件
3. `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`

## 最低校验

1. 修改 `climber-game` 代码后运行：`pnpm --filter @valley/climber-game exec tsc --noEmit`
2. 涉及 Web 挂载或页面联动时运行：`pnpm --filter web exec tsc --noEmit`
3. 涉及构建链路时运行：`pnpm --filter @valley/climber-game build`
4. 涉及中文文案时运行：`python .codex/skills/encoding-guard/scripts/check_mojibake.py`

## 与其他 skills 的协作

1. 涉及持续迭代排期与任务切换时，联动 [$web-feature-iteration](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/web-feature-iteration/SKILL.md)。
2. 涉及产品行为与体验链路时，联动 [$valley-mas-product-guard](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/valley-mas-product-guard/SKILL.md)。
3. 涉及复用与重复逻辑收敛时，联动 [$component-reuse-guard](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/component-reuse-guard/SKILL.md)。
4. 改完功能后需判断 skill 是否过期时，联动 [$skill-sync-guard](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/skill-sync-guard/SKILL.md)。
5. 只要本回合使用了本 skill，在最终答复中按 [$skill-usage-disclosure](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/skill-usage-disclosure/SKILL.md) 说明使用原因。

## 输出要求

当使用这个 skill 时，最终说明中应至少包含：
1. 本次改动是否仍满足《攀爬动物：在一起》的核心职责。
2. 是否触发了关卡可达性或碰撞贴合相关回归。
3. 这次执行了哪些校验命令，哪些未执行及原因。
