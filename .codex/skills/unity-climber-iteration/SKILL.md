---
name: unity-climber-iteration
description: 管理 `apps/unity-climber` 的持续迭代、提交边界与迁移节奏。用于 Unity 新项目初始化、`.gitignore`/提交噪音收敛、任务清单维护、Three.js 旧链路过渡（`packages/climber-game`）以及“下一步做什么”的迭代决策场景。
---

# Unity Climber Iteration

## 目标

让 `apps/unity-climber` 以“小步快跑 + 每轮可提交”的方式推进，同时避免 Unity 缓存文件污染仓库，并管理 Three.js 旧链路的平滑过渡。

## 核心产品定位（必须对齐）

1. 本项目目标是实现与《攀爬动物：在一起》同类型、同核心循环的攀爬游戏体验。
2. 任何功能、关卡、相机、角色手感改动，都必须服务“向上攀爬”主循环，而不是偏离成泛 3D 展示项目。
3. 新增需求若与该定位冲突，先收敛为最小可用方案，必要时拒绝扩散。

## 工作流

1. 先判定本轮范围：
   - 只改 Unity：聚焦 `apps/unity-climber`。
   - 改 Unity + Web 挂载：同时检查 `apps/web`。
   - 涉及 Three.js 旧链路：仅做过渡维护，不默认删除 `packages/climber-game`。
2. 再维护任务清单：
   - 使用 [`references/UNITY-CLIMBER-TASKS.md`](references/UNITY-CLIMBER-TASKS.md)。
   - 活跃任务保持 3 到 5 项，完成即移出，补下一项。
3. 然后落地改动：
   - 优先复用已有结构，不并行造第二套流程。
   - Unity 项目优先维护：`Assets/`、`Packages/`、`ProjectSettings/` 与 `.meta` 文件。
4. 最后做最小验证并汇报：
   - 明确“已完成/部分完成/未开始”。
   - 给出下一轮建议 1 到 3 项。

## Unity 提交边界

1. 允许提交：
   - `apps/unity-climber/Assets/**`
   - `apps/unity-climber/Packages/**`
   - `apps/unity-climber/ProjectSettings/**`
2. 默认忽略（通过 `.gitignore`）：
   - `Library/`、`Temp/`、`Logs/`、`Obj/`、`UserSettings/` 等 Unity 生成目录。
3. 禁止误操作：
   - 不要忽略 `*.meta`。
   - 不要把大规模缓存文件手工 `git add` 入库。

## 场景落地硬约束（必须遵守）

1. `Scene` 内的模型与 3D 对象必须直接落在场景文件中（例如 `Assets/Scenes/*.scene`）。
2. 禁止把“通过 C# 脚本在 Play 时动态创建场景对象”作为默认交付方式。
3. 若确实需要程序化生成，仅可用于临时调试，最终必须回写为可见的场景对象并保存后提交。
4. 评审场景改动时，优先检查 `Hierarchy` 与 `.scene` 文件是否已经包含真实对象，而不是依赖运行时代码。

## 脚本绑定防呆（必须检查）

1. 严禁手写或污染 `.cs.meta` 中的 `guid` 格式；`guid` 必须是 Unity 标准 32 位十六进制字符串。
2. 当 Scene 中出现 `None (Mono Script)` 时，优先排查：
   - 对应脚本是否编译失败（先看 Console）。
   - `.cs.meta` 的 `guid` 是否有效且与 `.scene` 中 `m_Script.guid` 一致。
3. 修改 Scene 脚本引用后，必须执行一次资源重导或重开项目验证绑定恢复。
4. 交付前最小核对：
   - `Player` 上应挂 `ClimberPlayerController`。
   - `Main Camera` 上应挂 `ClimberFollowCamera`。
   - 终点触发物上应挂 `ClimberFinishTrigger`。

## Three.js 过渡策略

1. 默认策略是“冻结旧链路”，不是“立即删除”：
   - `packages/climber-game` 进入 Legacy 维护态。
   - 新增功能优先落在 `apps/unity-climber`。
2. 仅当满足以下条件再执行下线清理：
   - Unity 版本已具备可演示闭环。
   - Web 端没有硬依赖 Three.js 入口。
   - 文档与任务清单都已切到 Unity 主线。

## 建议校验

1. 每轮先看改动面：
   - `git status --short`
   - `git status --short apps/unity-climber`
2. 涉及 Web 联动时：
   - `pnpm --filter web exec tsc --noEmit`
3. 涉及中文文案或中文 skill 修改时：
   - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`

## 输出要求

使用本 skill 的最终说明至少包含：

1. 本轮完成了什么（真实落地项）。
2. 活跃 backlog 当前剩哪些项（来自 `UNITY-CLIMBER-TASKS.md`）。
3. Three.js 旧链路当前状态（冻结/过渡/已下线）。
4. 本轮执行了哪些校验命令，哪些未执行及原因。
5. 本轮改动是否仍与《攀爬动物：在一起》核心体验保持一致。
