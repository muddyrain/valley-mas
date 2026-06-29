# Valley MAS - Harness Engineering

> 版本：v0.1 · 日期：2026-05-16  
> 本文档定义 Valley MAS 如何为 AI coding agent 提供“缰绳”：上下文入口、工具边界、验证命令、评审回路、trace 与回归证据。它不是某个业务子项目的运行页面，也不是游戏模拟 harness。

## 1. 定位

Harness Engineering 是一种面向 AI coding agent 的工程实践：通过清晰的仓库入口、任务上下文、可执行脚本、权限边界、验证命令和反馈回路，让 agent 在真实代码库里更可靠地完成开发任务。

在本仓库中，它回答这些问题：

- agent 进入仓库后先读什么
- 哪些文档是长期真源，哪些只是临时讨论
- 任务如何被拆成可执行步骤
- 工具、命令、环境变量和权限边界在哪里
- 改完后必须跑哪些验证
- 如何让后续 agent 能复盘前一次工作的证据

## 2. 不是这些东西

- 不是 `apps/world-sim` 的游戏模拟验证台
- 不是一个必须写进 `src/` 的业务模块
- 不是把“熟练玩家 / 架构师 / 评审专家”包装成一堆虚拟角色
- 不是替代测试、类型检查、lint、文档同步的口号
- 不是正式行业标准；它是 2026 年初开始流行的 AI coding 工程方法论

## 3. 仓库级组成

| 层级 | 当前载体 | 职责 |
|---|---|---|
| 入口地图 | `AGENTS.md` | 告诉 agent 仓库结构、必读资料、skill 选择和红线 |
| 项目指南 | `docs/PROJECT_GUIDE.md` | 沉淀项目定位、技术栈、模块地图和启动命令 |
| Skill 路由 | `.agents/skills/INDEX.md` | 按任务类型启用对应协作能力 |
| 项目 skills | `.agents/skills/*/SKILL.md` | 约束编码、文档同步、编码检查、提交信息等流程 |
| 工具兼容入口 | `.codex/skills`、`.claude/skills`、`.codebase/skills`、`.trae/skills` | 通过软链接指向 `.agents/skills`，避免多份 skill 内容漂移 |
| 子项目入口 | `apps/*/AGENTS.md`、`server/AGENTS.md` | 补充局部规则、目录入口、校验命令 |
| 验证命令 | package scripts、Go test、typecheck、encoding check | 把“完成了”变成可验证证据 |
| 运行证据 | 最终回复、命令输出摘要、必要时的 trace/report | 让人和后续 agent 能判断工作是否可信 |

## 4. 标准工作流

### 4.1 任务进入

1. 读取根目录 `AGENTS.md`
2. 读取 `.agents/skills/INDEX.md`
3. 按任务范围读取 `docs/PROJECT_GUIDE.md` 和子项目 `AGENTS.md`
4. 定位相关代码、文档、脚本和 `.env.example`
5. 区分任务类型：问答、分析、文档、代码实现、修复、评审、提交

### 4.2 上下文装载

agent 只装载当前任务需要的上下文，避免把整个仓库读成噪声。

- Web 任务：路由、页面、API 封装、相关组件、样式规则
- Admin 任务：路由、页面、Ant Design 模式、Admin API
- Server 任务：router、handler、model、service、config
- AI 能力任务：ARK skill、handler、prompt、环境变量、错误处理
- WorldSim 任务：子项目 AGENTS、GDD、架构合同、任务拆分、UI 文档

### 4.3 执行与工具边界

- 优先复用现有组件、hooks、utils、API 封装和服务端模式
- 修改前先理解当前实现，不凭旧记忆推断路径
- 不写真实密钥
- 不修改生成目录和依赖目录
- 不回滚未知来源的 dirty change
- 实际修改 CJK/非 ASCII 文本、Markdown、skill 或配置示例时使用定向 encoding 检查
- 涉及游戏玩法、参数或架构时同步 `apps/world-sim/docs/`

### 4.4 验证

每个任务的完成证据应来自命令或可观察结果，而不是口头判断。

| 改动类型 | 基础验证 |
|---|---|
| Web 前台 | `pnpm --filter @valley/web exec tsc --noEmit` |
| Admin 后台 | `pnpm --filter @valley/admin exec tsc --noEmit` |
| AI Mind Arena | `pnpm --filter @valley/ai-mind-arena typecheck` |
| WorldSim | `pnpm --filter @valley/world-sim typecheck`、必要时 `pnpm --filter @valley/world-sim build` |
| Go 服务端 | `cd server && go test ./...` |
| 共享包 | 对应包的 `typecheck` 或 `build` |
| CJK/非 ASCII 文本、Markdown/skill | `python .agents/skills/encoding-guard/scripts/check_mojibake.py <相关文件>` |

无法运行验证时，最终回复必须说明原因、影响范围和剩余风险。

## 5. AI coding 里的 agent 角色

本仓库默认不把“熟练玩家 agent、评审专家 agent、架构师 agent”写成业务运行时模块。更稳的做法是把它们定义成可执行的工作流视角：

| 视角 | 用途 | 推荐载体 |
|---|---|---|
| Implementer | 落地代码、文档或配置改动 | 当前 Codex 会话 |
| Reviewer | 查找 bug、回归风险、缺失测试 | code review 回复、评审清单 |
| Architect | 评估边界、依赖、状态真源、扩展性 | 架构文档、设计评审 |
| Verifier | 跑测试、读结果、确认证据 | 命令输出、最终验证摘要 |
| Domain Expert | 检查玩法、业务或内容合理性 | 子项目设计文档和评审工作流 |

只有当未来真的需要自动化调度、独立权限、独立状态和可重复评测时，才把这些视角升级成真正 runtime agent。

## 6. Trace 与回归证据

目前 Valley MAS 的轻量 trace 由以下内容组成：

- 用户任务原文和关键澄清
- 被读取的入口文档和相关文件
- 实际修改的文件
- 实际运行的验证命令
- 验证结果摘要
- 未验证事项和残留风险

后续如果要加强，可以新增：

- `docs/AGENT_EVALS.md`：记录 agent 任务评测集
- `scripts/agent-evals/`：放可重复执行的仓库任务验证脚本
- CI 中的 agent regression job：对固定任务集跑回归
- trace artifact：保存关键命令、diff 摘要和评审结论

## 7. Valley MAS 当前落点

短期只做三件事：

1. 让 `AGENTS.md` 保持轻量入口，不堆百科全书
2. 用 `.agents/skills` 承载可复用协作流程，并用软链接兼容各类 AI 工具入口
3. 把验证命令、文档同步和最终证据写清楚

暂不做：

- 不在 `apps/world-sim/src/` 实现 AI coding harness
- 不为每个“专家视角”创建假 agent
- 不引入独立 agent 平台或复杂 orchestrator
- 不把临时讨论自动沉淀为长期文档

## 8. 参考

- Mitchell Hashimoto, [My AI Adoption Journey](https://mitchellh.com/writing/my-ai-adoption-journey)
- OpenAI, [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
- OpenAI, [Agent evals](https://platform.openai.com/docs/guides/agent-evals)
- OpenAI, [Trace grading](https://platform.openai.com/docs/guides/trace-grading)
