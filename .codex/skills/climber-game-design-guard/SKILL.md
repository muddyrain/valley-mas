---
name: climber-game-design-guard
description: 统一 Valley MAS 中 packages/climber-game 的产品定位、关卡设计边界与目标职责，避免玩法漂移与实现分叉。用于任何与 climber-game 相关的新增功能、关卡路线调整、相机/角色手感修改、HUD 与菜单改动、可达性回归、资源结构或构建校验任务。
category: climber
---

# Climber Game 设计护栏

这个 skill 用来约束 `packages/climber-game` 的长期演进方向：该包的核心职责是承载《攀爬动物：在一起》游戏体验，而不是演变成泛 3D 实验场或分散到 `apps/web` 的业务逻辑集合。

## 核心职责

1. 将 `packages/climber-game` 作为独立可玩游戏包维护，`apps/web` 仅保留挂载入口。
2. 持续服务《攀爬动物：在一起》的“向上攀爬”主循环：移动、跳跃、落地、登顶反馈。
3. 关卡设计优先保障“实跳可达 + 难度递进 + 区块辨识”，避免堆砌无关机制。
4. HUD、暂停菜单、角色切换等玩法内交互尽量内聚在游戏内，不依赖页面外临时控制。
5. 与 `apps/web` 业务功能迭代解耦：climber 仅作为 web 挂载入口，不并入 Web 产品 backlog。

## 关卡与玩法边界

1. 优先沿“单张大地图 + 多主题区块”演进，不回退到多关卡频繁切换方案。
2. 新增障碍或挑战段时，先验证是否提升攀爬体验，再决定是否引入移动障碍/摆锤/旋转杆等机制。
3. 任何路线改动都要做可达性回归：跳距、落差、斜坡贴合、边缘站立稳定性。
4. 视觉层与物理层必须尽量 1:1 对齐；禁止只改模型不校准碰撞。
5. 不把“内部提示词、实现思路、协作指令”暴露到玩家可见 UI 文案中。

## 碰撞体拟合硬约束（新增）

1. 禁止给非方块物体直接套“单个大立方体”碰撞体糊弄通过。
2. 碰撞体必须按物体结构拆分：例如树木至少拆分为树干/冠层，岩石按实际外轮廓估算，斜坡保持专用 ramp。
3. 对程序化场景物体，优先基于实际渲染对象的世界包围盒自动生成碰撞体，再做轻量 inset 微调。
4. 新增或调整碰撞体后，必须回归：出生区、前 3 段起跳、主路线关键跳点，不允许出现“看起来能走但被隐形方块挡住”。
5. 若物体仅用于视觉氛围且不应阻挡通行，要明确设置为无碰撞，不得用宽大碰撞体占位。

## 模型增量标准流程

当用户要求“继续加模型”时，默认按以下标准执行：

1. 每批新增模型控制在 1 到 3 个，禁止一次性大批量堆入主路线。
2. 新模型优先放在现有可达路径附近做局部重排，不做全图重排。
3. 若新增模型会挡住关键跳跃路径，优先改位置/缩放，再考虑替换模型。
4. 默认避免“连续小件密集堆叠”；同一区域小件应稀疏分布。
5. 新增模型后必须运行关键跳点净空检测，满足以下门槛才算通过：
   - 高风险阻塞为 0
   - 小件密集区不增加，或明确说明为什么可接受
6. 通过后再进入下一批模型增量，保持“增量-验证-再增量”的节奏。
7. 模型展览默认同时展示“全量模型目录 + 当前地图模型实例”；新增模型或新增实例后应自动出现在展览中，并可看到每种模型在当前地图的出现次数。

## 改动决策顺序

1. 先确认需求是否服务《攀爬动物：在一起》主目标；若不是，先收敛为最小可用方案或拒绝扩散。
2. 优先复用现有实现与资产目录约定，不并行新建第二套逻辑。
3. 再决定改动落点：`packages/climber-game` 内核、`apps/web` 挂载层、还是工具脚本层。
4. 落地后同步更新任务清单，保持“活跃项短小可执行”。

## 优先检查文件

1. `packages/climber-game/**`
2. `apps/web` 中挂载 climber-game 的入口文件
3. `.codex/skills/climber-game-iteration/references/CLIMBER-GAME-TASKS.md`

## 最低校验

1. 修改 `climber-game` 代码后运行：`pnpm --filter @valley/climber-game exec tsc --noEmit`
2. 涉及 Web 挂载或页面联动时运行：`pnpm --filter web exec tsc --noEmit`
3. 涉及构建链路时运行：`pnpm --filter @valley/climber-game build`
4. 涉及中文文案时运行：`python .codex/skills/encoding-guard/scripts/check_mojibake.py`

## 与其他 skills 的协作

1. 涉及 climber 持续迭代排期与任务切换时，联动 [`climber-game-iteration`](../climber-game-iteration/SKILL.md) 并维护其任务清单，不并入 Web backlog。
2. 涉及产品行为与体验链路时，联动 [$valley-mas-product-guard](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/valley-mas-product-guard/SKILL.md)。
3. 涉及复用与重复逻辑收敛时，联动 [$component-reuse-guard](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/component-reuse-guard/SKILL.md)。
4. 改完功能后需判断 skill 是否过期时，联动 [$skill-sync-guard](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/skill-sync-guard/SKILL.md)。
5. 只要本回合使用了本 skill，在最终答复中按 [$skill-usage-disclosure](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/skill-usage-disclosure/SKILL.md) 说明使用原因。

## 输出要求

当使用这个 skill 时，最终说明中应至少包含：
1. 本次改动是否仍满足《攀爬动物：在一起》的核心职责。
2. 是否触发了关卡可达性或碰撞贴合相关回归。
3. 这次执行了哪些校验命令，哪些未执行及原因。
4. 若本次有新增模型，需额外写明：
   - 本批新增了哪些模型
   - 是局部重排还是全图重排
   - 净空检测门槛是否通过
   - 模型展览是否已同步显示新增模型/新增实例及出现次数
