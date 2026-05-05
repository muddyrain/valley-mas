# Valley MAS AI 协作约定

本文件是 AI 在 Valley MAS 仓库内工作的调度入口。详细项目定位、技术栈、模块地图、启动命令与环境变量以 `docs/PROJECT_GUIDE.md` 为准；文档索引见 `docs/README.md`。

默认使用中文沟通与输出。进入任务后先读取 `.codex/skills/INDEX.md`，再按任务范围读取相关代码和文档。

## 项目定位

- Valley MAS 是一个 monorepo，主要包含 `apps/web`、`apps/admin`、`server`、`apps/ai-mind-arena` 和 `packages/*`。
- 项目核心是个人内容展示、创作者空间、资源/博客/图文内容管理、AI 辅助能力和管理后台。
- 详细业务、技术栈、环境变量和启动方式不要在本文件重复维护，统一查阅 `docs/PROJECT_GUIDE.md`。

## 必读资料

1. 读取 `.codex/skills/INDEX.md`，确认是否需要启用项目 skill。
2. 按任务范围读取 `docs/PROJECT_GUIDE.md` 的相关章节。
3. 读取当前任务相关目录下的 `README.md`、`.env.example`、package scripts、Go 路由或 handler。
4. 以当前代码和当前文档为准，不凭旧记忆推断路径、命令或业务规则。

## 子项目 AGENTS 路由

进入下列子项目时，先读取对应目录的 `AGENTS.md`，再读取本目录内的 README、环境变量示例、路由入口或 package scripts。子项目 `AGENTS.md` 只补充局部功能、规范和路由引导；全局规则、skill 选择、Git 规则和完成标准仍以根目录本文档为准。

| 子项目 | 局部协作入口 | 适用范围 |
|---|---|---|
| Web 前台 | `apps/web/AGENTS.md` | 用户侧页面、创作者空间、资源、博客、我的空间、个人状态与 Web API 封装。 |
| Admin 后台 | `apps/admin/AGENTS.md` | 管理后台页面、审核与管理流程、Ant Design 管理端组件和 Admin API 封装。 |
| AI Mind Arena | `apps/ai-mind-arena/AGENTS.md` | 脑内会议室 Next.js 前端、多人格辩论 UI、SSE 对战流和分享体验。 |
| Go 服务端 | `server/AGENTS.md` | Gin/GORM API、认证中间件、业务 handler、数据模型、AI 与 Mind Arena 服务端能力。 |

## Skills 使用流程

1. 开始任务前读取 `.codex/skills/INDEX.md`。
2. 按“Skill 选择路由”选择需要启用的通用 skill，项目专属 skill 只在对应子项目 `AGENTS.md` 内声明。
3. 启用 skill 后读取对应 `.codex/skills/<skill>/SKILL.md`。
4. 按 skill 内的流程、约束和校验执行。
5. 回复中简短说明本次用了哪些 skills 以及原因。
6. 不确定是否需要 skill 时，先读取 INDEX 和候选 SKILL.md，再决定。

## Skill 选择路由

- IF 出现重复 JSX、重复 handler、重复弹窗/表单/上传/列表逻辑 → `component-reuse-guard`。
- IF 生成 commit message、执行 `git commit`，或用户要求提交 → `conventional-commit-guard`。
- IF 修改中文、Markdown、skill、配置示例或非 ASCII 文本 → `encoding-guard`。
- IF 任务包含多步骤执行、计划后实施或需要验证 → `task-completion-guard`。
- IF 本回合启用了任何 skill → 按 `skill-usage-disclosure` 做简短披露。
- IF 没有匹配 skill → 说明未发现必须启用的项目 skill，并按本文件继续执行。

## 顶层红线

- MUST 先读 skill 索引，再开始涉及代码或文档的任务。
- MUST 使用匹配场景的 skill，并遵守该 skill 的执行规则。
- MUST 先读相关代码和文档，再修改文件。
- MUST 按改动范围运行适用校验，并读取结果。
- MUST NOT 引用、调用或建议已经不存在的 skill。
- MUST NOT 在源码、文档或示例配置中写入真实密钥。
- MUST NOT 回滚、覆盖或整理与当前任务无关的工作树改动。
- MUST NOT 修改 `node_modules`、`dist`、`.next`、`.turbo` 等生成或依赖目录，除非任务明确要求。

## 仓库地图

| 区域 | 路径 | 执行入口 |
|---|---|---|
| Web 前台 | `apps/web` | 路由看 `apps/web/src/App.tsx`，API 看 `apps/web/src/api`。 |
| Admin 后台 | `apps/admin` | 路由看 `apps/admin/src/App.tsx`，API 看 `apps/admin/src/api`。 |
| AI Mind Arena | `apps/ai-mind-arena` | 页面看 `app`，组件看 `components`，接口看 `lib/api.ts`。 |
| Go 服务端 | `server` | 路由看 `server/internal/router/router.go`，配置看 `server/internal/config/config.go`。 |
| 服务端模型 | `server/internal/model` | 数据结构和 GORM 模型入口。 |
| 服务端处理器 | `server/internal/handler` | API handler 和业务入口。 |
| 服务端 AI | `server/internal/ai`、`server/internal/mindarena` | AI 对话、辩论和模型调用逻辑。 |
| 共享包 | `packages/*` | 共享类型、请求、路由、格式化工具和游戏包。 |
| 项目文档 | `docs` | 长期文档；临时总结不自动写入。 |

## 工作方式

- 优先用 `rg` / `rg --files` 定位文件、符号和引用。
- 优先复用现有组件、hooks、utils、API 封装和服务端模式。
- 新增实现前检查是否已有相邻实现或共享能力可复用。
- 修改接口前检查路由、handler、model、service 和中间件。
- 修改环境变量时同步检查对应 `.env.example`。
- 只在用户明确要求沉淀长期文档时更新 `docs/`。
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

# 启动 Go 服务
cd server && go run ./cmd/server
```

## 校验 Checklist

- [ ] Go 服务改动：`cd server && go test ./...`
- [ ] Web 前台改动：`pnpm --filter @valley/web exec tsc --noEmit`
- [ ] Web 样式或 lint 相关改动：`pnpm --filter @valley/web check`
- [ ] Admin 后台改动：`pnpm --filter @valley/admin exec tsc --noEmit`
- [ ] Admin 样式或 lint 相关改动：`pnpm --filter @valley/admin check`
- [ ] AI Mind Arena 改动：`pnpm --filter @valley/ai-mind-arena typecheck`
- [ ] 共享包改动：对应包的 `pnpm --filter <package> typecheck` 或 `pnpm --filter <package> build`
- [ ] 中文文案、Markdown、skill 或配置示例改动：`python3 .codex/skills/encoding-guard/scripts/check_mojibake.py <相关文件>`
- [ ] 只改协作规则或文档：至少运行 encoding 检查，并说明未运行应用级编译的原因
- [ ] 无法运行必要校验：说明原因、影响范围和剩余风险

## Git 规则

- 不自动提交；只有用户明确要求提交时才进入 commit 流程。
- 提交前查看最近 5 条提交风格。
- 提交信息使用 `conventional-commit-guard`。
- 默认使用一行简短中文 Conventional Commit。
- 不自动扩写长正文或 trailers，除非用户明确要求。

## 完成标准

- 核心改动已落地。
- 引用、入口和文档没有指向已删除 skill、过期路径或旧模块名。
- 适用校验已运行并读取结果。
- 最终回复说明：改了什么、验证了什么、哪些未验证或有残留风险。
