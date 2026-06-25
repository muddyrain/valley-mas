# Valley MAS AI 协作约定

本文件是 AI 在 Valley MAS 仓库内工作的调度入口。详细项目定位、技术栈、模块地图、启动命令与环境变量以 `docs/PROJECT_GUIDE.md` 为准；文档索引见 `docs/README.md`；AI coding Harness Engineering 约定见 `docs/HARNESS_ENGINEERING.md`。

默认使用中文沟通与输出。协作策略偏强流程：宁可多做必要确认、上下文读取和验证，也不要为了速度跳过关键约束。进入任务后先读取 `.agents/skills/INDEX.md`，再按任务范围读取相关代码和文档。`.codex/skills`、`.claude/skills`、`.codebase/skills`、`.trae/skills` 均作为兼容入口软链接到 `.agents/skills`。

## 项目定位

- Valley MAS 是一个 monorepo，主要包含 `apps/web`、`apps/admin`、`server`、`apps/ai-mind-arena` 和 `packages/*`。
- 项目核心是个人内容展示、创作者空间、资源/博客/图文内容管理、AI 辅助能力和管理后台。
- 详细业务、技术栈、环境变量和启动方式不要在本文件重复维护，统一查阅 `docs/PROJECT_GUIDE.md`。

## 必读资料

1. 读取 `.agents/skills/INDEX.md`，确认是否需要启用项目技能。
2. 按任务范围读取 `docs/PROJECT_GUIDE.md` 的相关章节。
3. 涉及 AI 协作流程、智能体工作方式、验证闭环或任务执行可靠性时，读取 `docs/HARNESS_ENGINEERING.md`。
4. 读取当前任务相关目录下的 `README.md`、`.env.example`、包脚本、Go 路由或处理器。
5. 以当前代码和当前文档为准，不凭旧记忆推断路径、命令或业务规则。

## 子项目 AGENTS 路由

进入下列子项目时，先读取对应目录的 `AGENTS.md`，再读取本目录内的 README、环境变量示例、路由入口或包脚本。子项目 `AGENTS.md` 只补充局部功能、规范和路由引导；全局规则、技能选择、Git 规则和完成标准仍以根目录本文档为准。

| 子项目 | 局部协作入口 | 适用范围 |
|---|---|---|
| Life Trace | `apps/life-trace/AGENTS.md` | Life Trace 的 Today、计划、AI、踪迹、Pantry、提醒、家庭空间和个人设置。 |
| Web 前台 | `apps/web/AGENTS.md` | 用户侧页面、创作者空间、资源、博客、我的空间、个人状态与 Web API 封装。 |
| Admin 后台 | `apps/admin/AGENTS.md` | 管理后台页面、审核与管理流程、Ant Design 管理端组件和 Admin API 封装。 |
| AI Mind Arena | `apps/ai-mind-arena/AGENTS.md` | 脑内会议室 Next.js 前端、多人格辩论 UI、SSE 对战流和分享体验。 |
| WorldSim | `apps/world-sim/AGENTS.md` | 沙盒文明模拟游戏、游戏设计文档、Phaser/Vite 子项目规则。 |
| Go 服务端 | `server/AGENTS.md` | Gin/GORM API、认证中间件、业务处理器、数据模型、AI 与 Mind Arena 服务端能力。 |

## 计划文档同步

每次实现前先判断当前改动是否计划内；每次收尾必须说明计划文档是否已同步。同步范围按“真实长期影响”判断，避免把临时调试和局部修复写进长期计划。

- Life Trace 产品计划唯一入口：`apps/life-trace/docs/PLAN.md`。
- WorldSim 玩法或系统参数：按 `apps/world-sim/AGENTS.md` 和 `game-doc-sync-guard` 同步对应设计文档。
- 根项目长期文档索引：`docs/README.md`。
- 必须同步：新增、删除或调整功能状态、页面入口、接口路径、依赖策略、数据模型、产品方向、长期文档索引或验收标准。
- 通常无需同步：临时调试、格式化、拼写、注释、局部样式微调、协作规则措辞收敛，且不改变产品计划、功能状态或验收标准。
- 计划文档缺失、未落地或不适用于当前子项目时，不要临时创造计划入口；最终回复说明“无需同步计划”的原因和判断依据。

## 技能使用流程

1. 开始任务前读取 `.agents/skills/INDEX.md`。
2. 按“技能选择路由”和 `.agents/skills/INDEX.md` 选择需要启用的通用技能，项目专属技能只在对应子项目 `AGENTS.md` 内声明。
3. 启用技能后读取对应 `.agents/skills/<技能名>/SKILL.md`；工具只识别 `.codex/skills` 等入口时，通过软链接访问同一份内容。
4. 按技能内的流程、约束和校验执行。
5. 回复中简短说明本次用了哪些技能以及原因。
6. 不确定是否需要技能时，先读取 INDEX 和候选 SKILL.md，再决定。
7. 只要改动可能影响产品计划、功能状态、接口路径、依赖策略或验收标准，必须同步检查当前项目计划文档；需要更新时先更新计划文档再收尾。

## Matt Pocock 工程技能配置

本节由 `setup-matt-pocock-skills` 初始化，记录 Matt Pocock 工程技能使用的问题追踪、分诊标签和领域文档消费规则。普通 Valley MAS 开发不默认读取 `docs/agents/*`；只有用户明确使用相关外部工程技能，或任务涉及问题、分诊、领域文档工作流时才读取。

### 问题追踪

问题追踪使用 `muddyrain/valley-mas` 的 GitHub Issues；外部 PR 不作为分诊请求入口。见 `docs/agents/issue-tracker.md`。

### 分诊标签

分诊使用默认标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。见 `docs/agents/triage-labels.md`。

### 领域文档

领域文档配置预留为多上下文布局，但当前仓库尚未落地 `CONTEXT-MAP.md`、`CONTEXT.md` 或 ADR 目录。普通任务继续以 `AGENTS.md`、`docs/PROJECT_GUIDE.md`、子项目 `AGENTS.md` 和当前代码为准；见 `docs/agents/domain.md`。

## 技能选择路由

- 如果出现重复 JSX、重复处理器、重复弹窗/表单/上传/列表逻辑 → `component-reuse-guard`。
- 如果生成提交信息、执行 `git commit`，或用户要求提交 → `conventional-commit-guard`。
- 如果用户要求“每次告诉我改了什么 / 下一步做什么 / 详细汇报阶段进展 / 每次更新要同步计划” → `delivery-reporting`。
- 如果新增、删除或调整产品功能、页面、接口、依赖、数据模型、长期文档或验收标准 → `delivery-reporting`。
- 如果修改用户可见 UI 文案、设置说明、按钮、副标题、空状态或入口摘要 → `ui-copy-boundary-guard`。
- 如果修改中文、Markdown、技能、配置示例或非 ASCII 文本 → `encoding-guard`。
- 如果任务包含多步骤执行、计划后实施、跨文件改动或需要验证闭环 → `task-completion-guard`。
- 如果本回合启用了任何技能 → 按 `skill-usage-disclosure` 做简短披露。
- 如果没有匹配技能 → 说明未发现必须启用的项目技能，并按本文件继续执行。

## 顶层红线

- 必须先读技能索引，再开始涉及代码或文档的任务。
- 必须使用匹配场景的技能，并遵守该技能的执行规则。
- 必须先读相关代码和文档，再修改文件。
- 必须按改动范围运行适用校验，并读取结果。
- 必须每次实现前判断改动是否属于当前计划内；计划外新增、范围变化或验收标准变化必须同步更新对应计划文档。
- 必须每次收尾说明计划文档是否已同步；若无需同步，必须说明原因。
- 禁止引用、调用或建议已经不存在的技能。
- 禁止在源码、文档或示例配置中写入真实密钥。
- 禁止回滚、覆盖或整理与当前任务无关的工作树改动。
- 禁止擅自移除、恢复或改写自己无法确认来源的改动；未知脏改动默认视为用户改动。若临时产物需要清理，只清理产物本身，不借此修改用户已有的 `.gitignore`、配置或文档规则。
- 必须在发现疑似无关但会影响当前任务的改动时先说明并询问，除非用户已明确授权处理。
- 禁止修改 `node_modules`、`dist`、`.next`、`.turbo` 等生成或依赖目录，除非任务明确要求。

## 仓库地图

| 区域 | 路径 | 执行入口 |
|---|---|---|
| Life Trace | `apps/life-trace` | 路由看 `apps/life-trace/src/App.tsx`，API 看 `apps/life-trace/src/api`，计划看 `apps/life-trace/docs/PLAN.md`。 |
| Web 前台 | `apps/web` | 路由看 `apps/web/src/App.tsx`，API 看 `apps/web/src/api`。 |
| Admin 后台 | `apps/admin` | 路由看 `apps/admin/src/App.tsx`，API 看 `apps/admin/src/api`。 |
| AI Mind Arena | `apps/ai-mind-arena` | 页面看 `app`，组件看 `components`，接口看 `lib/api.ts`。 |
| WorldSim | `apps/world-sim` | 协作入口看 `apps/world-sim/AGENTS.md`，设计文档看 `apps/world-sim/docs`。 |
| Go 服务端 | `server` | 路由看 `server/internal/router/router.go`，配置看 `server/internal/config/config.go`。 |
| 服务端模型 | `server/internal/model` | 数据结构和 GORM 模型入口。 |
| 服务端处理器 | `server/internal/handler` | API 处理器和业务入口。 |
| 服务端 AI | `server/internal/ai`、`server/internal/mindarena` | AI 对话、辩论和模型调用逻辑。 |
| 共享包 | `packages/*` | 共享类型、请求、路由、格式化工具和游戏包。 |
| 项目文档 | `docs` | 长期文档；临时总结不自动写入。 |

## 工作方式

- 优先用 `rg` / `rg --files` 定位文件、符号和引用。
- 优先复用现有组件、hooks、utils、API 封装和服务端模式。
- 新增实现前检查是否已有相邻实现或共享能力可复用。
- 评估新增第三方依赖时，必须先告知用户拟使用的依赖、解决的问题、主要取舍和替代方案，并询问是否采用。
- 修改接口前检查路由、处理器、模型、服务和中间件。
- 修改环境变量时同步检查对应 `.env.example`。
- 功能、接口、依赖、数据模型、产品方向或验收标准变化时，主动更新对应计划文档；纯临时调试、格式化或不改变计划的微调可不更新，但最终要说明原因。
- 只在用户明确要求或当前改动影响长期知识时更新 `docs/`；不要把临时总结写入长期文档。
- Life Trace UI 改动按 `apps/life-trace/AGENTS.md` 的局部规则处理。
- Web UI 改动按 `apps/web/AGENTS.md` 的局部规则处理。
- 不要使用 Playwright 做自动验收；涉及前端、游戏或可视交互改动时，最终回复应告知用户清晰的验收标准，并提示由用户自行手动验收。

## 环境与外部服务

- Web/Admin API 地址使用 `VITE_API_BASE_URL`。
- 环境变量示例查看 `apps/web/.env.example`、`apps/admin/.env.example`、`server/.env.example`。
- TOS、ARK、SMTP、数据库等外部服务配置以 `.env.example` 和 `docs/PROJECT_GUIDE.md` 为准。

## 开发命令

```bash
# 安装依赖
pnpm install

# 启动全部前端任务
pnpm dev

# 启动 Web
cd apps/web && pnpm dev

# 启动 Admin
cd apps/admin && pnpm dev

# 启动 AI Mind Arena
cd apps/ai-mind-arena && pnpm dev

# 启动 WorldSim
cd apps/world-sim && pnpm dev

# 启动 Go 服务
cd server && go run ./cmd/server
```

## 校验清单

- [ ] Go 服务改动：`cd server && go test ./...`
- [ ] Web 前台改动：`pnpm --filter @valley/web exec tsc --noEmit`
- [ ] Web 样式或 lint 相关改动：`pnpm --filter @valley/web check`
- [ ] Admin 后台改动：`pnpm --filter @valley/admin exec tsc --noEmit`
- [ ] Admin 样式或 lint 相关改动：`pnpm --filter @valley/admin check`
- [ ] AI Mind Arena 改动：`pnpm --filter @valley/ai-mind-arena typecheck`
- [ ] WorldSim 改动：`pnpm --filter @valley/world-sim typecheck`
- [ ] 共享包改动：对应包的 `pnpm --filter <package> typecheck` 或 `pnpm --filter <package> build`
- [ ] 中文文案、Markdown、技能或配置示例改动：`python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <相关文件>`
- [ ] 只改协作规则或文档：至少运行编码检查，并说明未运行应用级编译的原因
- [ ] 无法运行必要校验：说明原因、影响范围和剩余风险

## Git 规则

- 不自动提交；只有用户明确要求提交时才进入 commit 流程。
- 提交前查看最近 5 条提交风格。
- 提交信息使用 `conventional-commit-guard`。
- 默认使用一行简短中文 Conventional Commit。
- 不自动扩写长正文或 trailers，除非用户明确要求。

## 完成标准

- 核心改动已落地。
- 引用、入口和文档没有指向已删除技能、过期路径或旧模块名。
- 已判断是否计划内，并同步更新对应计划文档；如果未更新，最终回复说明无需更新的原因。
- 适用校验已运行并读取结果。
- 最终回复说明：改了什么、验证了什么、哪些未验证或有残留风险。
