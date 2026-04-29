# Valley MAS AI 协作约定

本文件是 AI 在 Valley MAS 仓库内工作的入口，只保留协作规则、skill 路由和最低校验。项目定位、技术栈、模块地图、开发命令与环境变量见 `docs/PROJECT_GUIDE.md`。

默认使用中文沟通与输出。执行任务前先判断应启用的 skills，并在回复中简短说明“用了哪些 skills，以及原因”。

## 必读项目文档

- `docs/PROJECT_GUIDE.md`：项目定位、技术栈、业务模块、本地开发命令、环境变量与常用定位入口。
- `docs/README.md`：项目文档索引。

## 项目必读 Skills

每次进入任务时优先判断以下 skills 是否适用：

- `encoding-guard`：改中文文案、Markdown、skill 或任何非 ASCII 文本前后必须严格执行，防止乱码、文本丢失和异常转义写法。
- `skill-usage-disclosure`：只要启用任何 skill，就在开始或最终回复中简短披露。
- `component-reuse-guard`：发现重复 JSX、重复 handler、重复列表/弹窗/上传逻辑时，先复用或抽取。

## 场景 Skills

- 创作空间与工作台改动：`creator-space-ux`。
- Web 主题、视觉一致性、品牌色改动：`web-theme-consistency`、`brand-theme-guard`。
- Loading 态或媒体加载体验改动：`web-loading-overlay-strategy`。
- Web 列表搜索、分页与 URL query 联动：`web-url-state-sync`。
- Go 服务端调用火山 ARK：`ai-capability-orchestration`。
- 生成 commit message、执行 `git commit`、或用户说“提交/提交吧/提交代码/帮我提交”：`conventional-commit-guard`。
- 新增、迁移、清理或修复 skills：`skill-opportunity-scout`、`skill-sync-guard`、`skill-category-guard`。

如果某个 skill 已被删除，不要继续在 `AGENTS.md` 或最终说明中引用它；先检查 `.codex/skills/*/SKILL.md` 的真实存在情况。

## 工作方式

- 优先复用现有实现，不随意新建并行方案；新增组件前先搜现有 components、utils、hooks 与 `packages`。
- 改 Web 页面时先确认主题 token、共享组件与已有页面模式，避免局部页面脱离全站视觉。
- 改 Go 接口时先看 `server/internal/router/router.go`、对应 `handler/model/service`，保持 API 分组、鉴权中间件与错误返回风格一致。
- 改列表页时同步考虑 `keyword/page` 与 URL 状态，刷新、清除、重试、翻页不能丢状态。
- 涉及用户可见文案时，只写面向终端用户的产品表达，不把用户提示词、内部指令、实现思路、推理过程原文展示到 UI。
- 涉及中文或其他非 ASCII 文本时，必须遵从编码格式原则：源码、Markdown、配置示例中直接保留可读原文，不要把中文生成或改写成 Unicode escape、HTML 实体、拼音替代、问号占位等转义或降级写法。
- 不在源码、文档、示例配置中写入真实密钥；新增环境变量必须同步 `.env.example` 与说明。
- 不主动创建临时总结文档；只有用户明确要求沉淀长期文档时，才在 `docs/` 中新增或更新文档。
- 不维护文件型 changelog；变更追溯使用 git commit log、diff、PR 描述和必要正式文档。

## 最低校验要求

- 修改 Go 服务后：运行 `cd server && go test ./...`。
- 修改 Web 前台后：运行 `pnpm --filter web exec tsc --noEmit`。
- 修改 Admin 后台后：运行 `pnpm --filter admin exec tsc --noEmit`。
- 修改共享包后：优先运行对应包的 `pnpm --filter <package> run typecheck` 或 `pnpm --filter <package> run build`。
- 涉及中文文案、Markdown 或 skill 改动后：运行 `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py <相关文件>`。

## 提交约定

- 不要自动提交；只有用户明确要求提交时才进入 commit 流程。
- 提交前先查看最近 5 条提交风格，并启用 `conventional-commit-guard`。
- 若用户只说“提交/提交吧/提交代码”，默认使用一行简短中文 Conventional Commit，不自动扩写长正文。
- 如需长提交说明，遵循仓库 Lore Commit Protocol，用 trailers 记录约束、取舍、验证与未验证项。
