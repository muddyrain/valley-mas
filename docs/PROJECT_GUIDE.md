# Valley MAS 项目指南

本文件沉淀 Valley MAS 的项目级信息，供开发者和 AI 协作时快速理解项目边界。AI 协作规则仍以根目录 `AGENTS.md` 为入口；AI coding Harness Engineering 约定见 `docs/HARNESS_ENGINEERING.md`。

## 项目定位

- Valley MAS 是一个包含个人内容展示、创作者空间、内容管理、生活记录、AI 辅助能力和实验应用的 monorepo。
- 用户侧主站在 `apps/web`，管理后台在 `apps/admin`，Go API 服务在 `server`。
- Life Trace、AI Mind Arena、WorldSim、Toy Climb Arena、Scratch Legend 是当前仓库内的独立产品或实验应用。
- 共享类型、请求、路由和格式化能力放在 `packages/*`。

## 技术栈地图

| 区域 | 路径 | 说明 |
| --- | --- | --- |
| Web 前台 | `apps/web` | React 19 + Vite 6 + React Router 7 + Tailwind 4，用户侧内容站点。 |
| Admin 后台 | `apps/admin` | React 19 + Vite 6 + Ant Design 6 + Pro Components，覆盖用户、内容、资源、互动、Life Trace 和审计的运营管理后台。 |
| Life Trace | `apps/life-trace` | React 19 + Vite 6 + Tailwind 4，生活计划、踪迹、提醒和 PWA 能力。 |
| AI Mind Arena | `apps/ai-mind-arena` | Next.js 15 + React 19 + Tailwind 3，多人格辩论决策应用，默认端口 5175。 |
| Scratch Legend | `apps/scratch-legend` | Next.js + React，刮刮卡增量游戏实验，默认端口 5176。 |
| Toy Climb Arena | `apps/toy-climb-arena` | Vite 6 + TypeScript + Three.js，玩具世界攀爬游戏，默认端口 5175。 |
| WorldSim | `apps/world-sim` | React 19 + Vite 6 + TypeScript + Pixi.js + Zustand，沙盒文明模拟游戏。 |
| Go 服务端 | `server` | Gin + GORM，入口在 `server/cmd/server`，路由集中在 `server/internal/router/router.go`。 |
| 共享包 | `packages/*` | `shared`、`shared-request`、`shared-router`、`shared-format`、`format-tools`、`browser-media`、`mini-games` 等 workspace 包。 |
| 文档 | `docs` | 长期项目文档；临时分析不要自动沉淀到这里。 |

`apps/ai-mind-arena` 和 `apps/toy-climb-arena` 都使用 `5175` 作为默认开发端口，不能同时用默认端口启动。

## 关键业务模块

- 首页与品牌入口：`apps/web/src/pages/Home`、`apps/web/src/layouts/WorkbenchLayout.tsx`、`apps/web/src/layouts/Sidebar.tsx`、`apps/web/src/components/page`。
- 创作者与创作空间：`apps/web/src/pages/Creator*`、`apps/web/src/pages/MySpace`、`apps/admin/src/pages/Creator*`、`server/internal/handler/creator*.go`。
- 资源库：`apps/web/src/pages/Resources`、`apps/web/src/pages/ResourceDetail`、`apps/web/src/components/ResourceCard.tsx`、`apps/admin/src/pages/admin-ops/ResourceTags.tsx`、`server/internal/handler/*resource*.go`。
- 博客与图文：`apps/web/src/pages/blog`、`apps/web/src/pages/BlogCreate`、`apps/web/src/components/blog`、`apps/admin/src/pages/Blog*`、`apps/admin/src/pages/admin-ops/BlogTaxonomy.tsx`、`apps/admin/src/pages/admin-ops/BlogComments.tsx`、`server/internal/handler/blog*.go`。
- 全站搜索：Web `/search` 搜索公开博客、图文、公开资源及站内页面命令；桌面端可用 `Ctrl+K` / `⌘K` 打开命令面板，移动端顶部栏提供同一入口。内容与资源搜索复用现有 `/public/blog/posts`、`/public/resources` 的 `keyword` 参数，不新增聚合 API；不搜索私有 AI 数据、Life Trace 私有数据或 Admin 数据。
- 实用工具：Web `/tools/format` 通过主导航“工具”入口访问，提供浏览器内图片转换、压缩、裁剪、缩放、旋转、翻转、圆角和水印，以及 JSON、文本、编码与摘要处理；页面复用 `packages/browser-media` 和 `packages/format-tools`，两包同时暴露可供其他页面或智能体适配层消费的结构化工具清单与调用入口。
- 后台运营与审计：`apps/admin/src/pages/admin-ops`、`apps/admin/src/api/operations.ts`、`server/internal/handler/admin_operations.go`，包括 AI 调用审计和存储资产只读治理。
- Life Trace：`apps/life-trace/src`、`server/internal/lifetrace`。
- AI Mind Arena：`apps/ai-mind-arena`、`apps/admin/src/pages/admin-ops/MindArenaDebates.tsx`、`server/internal/mindarena`、`server/internal/model/mind_arena.go`、`server/internal/ai`。
- AI 能力：`server/internal/ai`、`server/internal/aiusage`、`server/internal/handler/*ai*.go`、`apps/web/src/api/ai.ts`；Admin 可审计 Valley AI Chat 与 Life Trace AI 的调用、失败和耗时。
- AI 技能资源：技能导入会保留 `SKILL.md`、`references/` 下的 Markdown、MDX 或 TXT 文件，以及 `scripts/` 下常见文本脚本（Python、JavaScript/TypeScript、Shell、PowerShell、Ruby、PHP、Perl、Lua 和 R）；参考资料与脚本各最多导入 24 份、96KB。ZIP 技能包最大 32MB，服务端限制文件数量与解压后总大小，并拒绝不安全路径、重复路径、符号链接和非 UTF-8 文本；图片、`assets/`、`agents/` 与其他不支持的文件会在预览中计数并于安装时忽略。脚本仅供技能目录查看与后续受控能力使用，不会在导入或生图时执行，也不会作为视觉风格指令注入模型。
- AI 工作台入口：Web `/workbench` 是智能体项目页，智能体通过同一创建弹窗在“标准创建 / AI 创建”之间选择；`/workbench/workflows` 是独立工作流页面，承载模板、普通创建与 AI 创建；`/workbench/knowledge` 当前作为资源库中的知识库入口；`/workbench/resources?tab=prompts` 提供 owner 私有提示词库，支持适用标签与手动创建；`/workbench/resources?tab=skills` 提供 owner 私有已安装技能，支持公开 GitHub 仓库、`skills/SKILL.md`、集合目录、任一技能目录链接、`npx skills add owner/repository --skill skill-name` 来源语法，以及本地 ZIP 技能包。安装时读取 `SKILL.md`，并一并保存该技能目录下 `references/` 中的 Markdown、MDX 或 TXT 参考资料（最多 24 份、96KB）；已安装技能可设置标签、按标签筛选并打开目录查看已导入文件及内容。智能体将技能 ID 固化在版本配置，工作流 LLM 节点按节点配置技能；两种运行期都只注入 `SKILL.md` 与参考资料，按 owner 校验，不调用 AI 整理，不执行仓库或 ZIP 中的命令、脚本、`agents/` 或 `evals/`。`/workbench/resources?tab=tools` 提供 owner 私有的 Notion OAuth 连接管理。知识库 PDF 可在选择视觉模型后按页渲染，补充扫描件 OCR、表格 Markdown 与图片说明；运行环境需提供 Poppler `pdftocairo`。
- AI 工作流协作：编辑器右侧“AI 协作”使用固定的工作流专用智能体和单一 canonical 时间线；旧多会话与提案保留为只读记录，旧 `/ai/workbench/copilot/*` 不再接受工作流写请求。消息进入持久后台队列，离开页面或服务重启后可恢复；支持模型选择、单轮已安装 Skill、图片/PDF/Markdown/TXT/JSON/CSV 附件、停止、站内终态与等待确认通知、上下文重置。AI 只返回节点级 operations，服务端按草稿 revision 与触及路径合并到最新 Graph v4 草稿，非冲突修改直接写入并同步画布，冲突不覆盖用户内容；每次变更可服务端原子撤销。用户明确要求 AI 发布、试运行或启停现有触发器时，服务端先创建 owner 私有确认；原始参数和指纹不返回页面，只有当前任务的同一动作获批后才执行。AI 发起的试运行使用空输入；工作流存在必填运行输入时应继续使用编辑器运行面板。工作流列表展示最新 AI 协作状态，节点信息可携带冻结节点上下文转到“询问 AI”，AI Tab 对等待确认和新终态显示未读标记。编辑器工具栏仍支持一键从左到右整理节点并自动适配视图，保留连线、节点配置和循环体层级，位置变化进入撤销与自动保存。
- Graph v4 节点目录：节点名称、说明、分类和默认配置由服务端 `/workflows/capabilities` 提供，Web 只展示已具备配置界面的节点。主画布通用节点为 Start、End、LLM、Template、HTTP、Tool、Condition、Switch、Merge、Variable、Subworkflow、Intent、Loop 和 Delay；循环体另提供设置循环变量、继续循环和终止循环。Start 将变量名、类型、必填和输入方式分开保存，文件、博客标签、博客分组与可见范围等业务输入由输入方式决定，不依赖固定变量名；重命名保持声明顺序并同步更新下游引用。Template 确定性拼装文本；Delay 最长等待 5 分钟并响应取消；LLM 先把上游输出绑定为本节点命名输入，提示词只引用本节点输入，编辑器会迁移旧版直接上游引用，运行时继续兼容历史已发布图；End 按名称、类型和上游变量映射最终输出，并可声明多个结果动作（名称 + 输出字段），运行面板只按该配置渲染内部跳转入口。节点输入和输出共用统一字段组件：通用节点可编辑声明，Tool 的变量名、类型、必填状态和输出由 capability schema 固定，仅输入值可填写或绑定；工具必填值为空时节点立即标红，并在发布或试运行前阻断，错误列表可直接定位并打开目标节点。固定值与变量引用都按声明类型校验，变量引用底层保存规范引用，界面以“节点名 · 变量名”原子 Token 展示。人工审批不再向新工作流开放，服务端继续兼容已有审批图。
- 工作流业务能力：服务端 Tool capability 提供 Markdown 解析、通用文档提取、结构化提取、JSON 解析、安全列表处理、列表切批、知识检索、知识引用整理、内容/Notion 搜索、封面与通用图片生成、图片理解、AI 生图资源保存、博客草稿和站内通知。安全列表处理提供筛选、字段映射、稳定排序和去重，不执行用户代码；列表切批只生成批次数组，实际逐批执行复用 Loop。站内通知只写入当前工作流 owner 的通知记录，支持完成和失败后继续场景。图片工作流与图片创作页复用同一模型目录、Provider、存储和 AI 审计服务；扫描 PDF 仍走图片理解或知识库 OCR。节点选择器按内容、图片、知识、流程、逻辑、工具和子工作流分类。
- 工作流扩展契约：Tool capability 可声明界面元数据，为输入字段、连接入口、数值配置和条件配置提供标签、约束与动作，Web 不再按工具 ID 写死这些展示。Start 的通用输入声明可额外绑定受控 provider；博客标签、博客分组与可见范围等当前 provider 只负责运行期控件和默认值，历史 `control` 配置会自动迁移兼容。
- 工作流运行治理：可执行节点支持最多 3 次节点级自动重试和失败后继续；运行中节点实时显示当前耗时，并可主动取消顶层节点。取消后的运行保留已成功节点检查点，运行历史和节点详情都可从该失败节点重试并继续，已成功节点不会重放。写入、生图存储和非幂等 HTTP 的节点重试需明确确认，循环节点仍回退为整次重新运行。失败后继续会输出 `_failed`、`_error`、`_errorCode`、`_attempts`。已有人工审批图仍使用 owner 私有记录和冻结版本恢复，审批记录入口收纳在编辑器“更多”菜单，不再占用主工具栏或节点选择器。Cron、Webhook 和内部事件统一冻结当前已发布版本并进入数据库任务 worker：Cron 只允许无输入、无文件、无写入/模型存储副作用的图；Webhook 使用只展示一次、数据库仅存 SHA-256 哈希的 256 位 Bearer 密钥，内部事件按 owner 与事件键隔离，两者都要求唯一 `X-Valley-Delivery` 防止重复投递。任务一旦创建运行记录，租约过期后不会重新执行整张图，而是标记中断，避免重复写入。代码、SQL、自动发布与未受控外部凭据继续拒绝；死信、告警和租约续期仍待后续。Notion OAuth 凭据仅服务端 AES-GCM 加密保存，连接状态和审计记录按 owner 隔离。
- AI 图片创作：Web `/workbench/images` 是独立图片创作页，默认进入排在画布之前的 AI 对话，并支持查看、切换 owner 私有历史会话；图片工作台与智能体会话共用 `ConversationComposer`，两端都可附加最多三张 5MB JPG/PNG/WebP 参考图、输入 `/` 选择技能、查看附件状态和图片生成阶段反馈。图片工作台默认直接具备生图能力，`/` 仅展示技能型视觉风格；智能体需在版本中显式绑定 `image.generate`，再使用其已绑定技能作为本轮视觉风格。两个入口保留独立历史实体，以维持图片会话与智能体版本/运行追踪的隔离。工作台同时支持画布创作、对话描述与连续修改、简笔画、最多三张画布素材、创作类型、视觉风格、从 owner 私有 AI 提示词资源插入画面描述、上传 1–9 张 JPG/PNG/WebP 图片识别共性视觉风格（单张最大 20MB，原图仅请求内使用）、将可编辑结果追加到画面描述或保存到私有提示词库、基于当前输入的 AI 画面描述扩写、五种画面比例、模型感知的目标分辨率、生成阶段动效、owner 私有生成历史、下载和保存到资源库。创作类型只声明输出用途与结构约束，当前提供自由创作、壁纸、草图成图、文章封面、产品展示和角色头像；自由创作不注入隐藏用途提示。视觉风格只控制色彩、材质、光线和渲染语言，内置日系动画、动画 IP、电影风景和手作毛毡，也将 owner 私有已安装技能通过图片风格适配器加入选择器。提示词资源只作为画面描述片段，当前输入非空时由用户选择追加或替换。服务端 `AIImagePlanner` 统一解析 `recipeId + styleProfileId + brief + constraints`，按安全与模型能力、参考图结构、创作类型、用户描述、视觉风格、质量约束编译生成计划；视觉风格不得覆盖参考结构、主体身份与数量、输出用途或用户明确描述。技能内容只在服务端按 owner 校验后作为视觉风格使用，生成记录保存风格来源、标识和不可变指令快照；旧 `presetId/skillId/prompt` 请求及旧图片选项路由暂时保留兼容映射。创作类型的快速示例首屏与后续“换一些”都来自服务端受控候选池，每次即时轮换三条不同于当前项的画面描述，不调用外部模型。对话模式首条消息直接生成，后续消息优先引用本次对话最近一张成功图片；消息和会话按当前用户持久化到服务端，图片结果持久化到历史。画面描述复用提示词助手和已启用文本模型，结果需预览确认后才回填。用户统一选择具备 `image_generation` 的图片模型；`reference_image` 表示该模型还支持把画布、素材或上一张生成图作为参考输入。尺寸能力按模型 ID 判断、Provider 只处理传输协议：`doubao-seedream-4-0-*` 支持 1K/2K/3K/4K，`gpt-image-2` 包括参考图编辑在内均支持 1K/2K/4K。启用参考画布时，画布的主体数量、轮廓、姿态、取景和空间布局优先于创作类型、视觉风格与文字；当前模型不支持参考图时保留模型选择，并明确按文字生成；草图成图必须使用参考图。图片调用由 SiliconFlow、Amux、ARK Provider Adapter 处理各自尺寸字段、JSON/multipart 端点与 URL/Base64 响应；目标尺寸是请求意图而非精确像素承诺，4K 请求返回达到该目标对应 1K 宽高基线的有效图片即按实际像素保存，只有低于最低可用尺寸的明显异常结果才失败，任务状态持久化在 `ai_image_generations`。生成中的任务可暂停：服务端会中止当前 Provider 请求并持久化为 `paused`；第三方生成请求不能从中间进度恢复，用户可从该条历史恢复参数后重新提交。用户直接提交的单张参考图限制为 5MB；引用服务端已持久化的生成结果时按 128MiB 下载上限处理，不套用上传限制。生成结果及其恢复副本允许 JPG、PNG、WebP、GIF、AVIF 和 BMP 等安全栅格格式，并按 128MiB 上限转存；SVG 因可携带可执行标记而不接纳。参考图 data URL 只在当前请求和后台生成过程中使用，不进入数据库或 AI 审计日志；使用画布或对话引用上一张图片时会额外保存一张扁平快照，供历史预览与再次创作恢复，快照上传失败只影响历史恢复，不阻断图片生成，不保存逐笔轨迹或独立图层。生成结果必须转存 TOS 后才进入长期历史；保存到资源库会复制为独立对象，因此资源删除不会影响历史。智能体生图复用同一计划器、模型目录、Provider、存储与审计；原始参考图不持久化，会话只保存附件数量和生成记录 ID。
- AI 图片重试：系统不会自动重试失败任务。图片对话中的失败气泡提供手动重试，重试会复用原任务的模型、创作类型、风格、比例、清晰度和可恢复参考图，创建一条新的生成任务；服务商可能按新调用计费。无法恢复的临时参考图仍引导用户恢复参数后重新提交。
- AI Agent 运行时：`server/internal/ai/agent`（领域中性 tool loop 抽象，未来可无痛迁 CloudWeGo eino）+ `server/internal/ai/tools`（Tool 接口与 Registry）。智能体的对话与图片理解共用当前对话模型：上传图片时要求该模型同时具备 `vision` 能力，不支持时阻止本轮发送并引导切换模型；生成或编辑图片仍是独立的 `image.generate` 工具链路，要求绑定工具及具备 `image_generation` 的图片模型。智能体详情页不展示版本历史，用户修改当前设置后既有会话下一轮也切换到最新配置快照。个性化由默认 `IDENTITY.md`、`USER.md`、`SOUL.md`、`AGENTS.md` 四份档案组成，运行时按身份、用户偏好、行为准则和智能体约定的顺序合成为系统指令。智能体详情页同时聚合会话产生的 owner 私有图片与成果文件。首批 Agent runtime 同时被 Life Trace 生活助理经 `LIFE_TRACE_ASSISTANT_USE_AGENT` 灰度使用。
- 登录与用户状态：`apps/web/src/stores/useAuthStore.ts`、`apps/*/src/utils/request.ts`、`server/internal/middleware`、`server/internal/utils/jwt.go`；Web 的邮箱验证码用于登录、注册与找回密码，找回密码提交 `POST /password/reset`。

## 本地开发命令

```bash
# 安装依赖
pnpm install

# 启动全部前端任务
pnpm dev

# 启动 Web / Admin / Life Trace
pnpm --filter @valley/web dev
pnpm --filter @valley/admin dev
pnpm --filter @valley/life-trace dev


# 启动 AI Mind Arena / Scratch Legend
pnpm --filter @valley/ai-mind-arena dev
pnpm --filter @valley/scratch-legend dev

# 启动 Toy Climb Arena / WorldSim
pnpm --filter @valley/toy-climb-arena dev
pnpm --filter @valley/world-sim dev

# 启动 Go 服务
cd server && go run ./cmd/server

# 启动 Go 服务热重载；只检查并执行尚未应用的版本化迁移
cd server && air

# 仅空的本地开发数据库需要显式初始化一次
cd server && go run ./cmd/migrate bootstrap --apply
```

## 端口速查

| 服务 | 默认端口 |
| --- | --- |
| Go API | 8080 |
| Web | 5000 |
| Admin | 3000 |
| Life Trace | 5178 |
| Life Trace preview | 4178 |
| AI Mind Arena | 5175 |
| Toy Climb Arena | 5175 |
| Scratch Legend | 5176 |

Go API 启动时会优先使用 `PORT`（默认 `8080`）。如果该端口已被占用，服务端会自动顺延尝试后续端口，并在启动日志里打印实际端口。前端本地 Vite 代理默认仍指向 `http://localhost:8080`；如果 Go API 顺延到了 `8081` 等端口，需要同步调整前端 API 代理或 `VITE_API_BASE_URL`，避免继续请求旧分支服务。

## 环境变量与外部服务

- Web/Admin API 地址读取 `VITE_API_BASE_URL`，示例分别在 `apps/web/.env.example` 与 `apps/admin/.env.example`。
- Life Trace 本地默认通过 Vite `/api` 代理访问 Go 服务，示例见 `apps/life-trace/.env.example`。
- AI Mind Arena 前端读取 `NEXT_PUBLIC_API_BASE_URL`，示例见 `apps/ai-mind-arena/.env.example`。
- Server 示例配置在 `server/.env.example`，包括 `DB_*`、`JWT_SECRET`、`SMTP_*`、`TOS_*`、`SILICONFLOW_*`、`AMUX_*`、`PIPIXIA_*`、兼容期 `ARK_*` / `GEMINI_*`、`AI_WORKBENCH_COPILOT_ENABLED`、`LIFE_TRACE_AI_*`、`MIND_ARENA_AI_*`、`QWEATHER_*`、`WEB_PUSH_*`、`UNSPLASH_ACCESS_KEY`、`PEXELS_API_KEY`、`EXTERNAL_IMAGES_TIMEOUT_SECONDS`。
- TOS 上传依赖 `TOS_ACCESS_KEY`、`TOS_SECRET_KEY`、`TOS_BUCKET`、`TOS_ENDPOINT`、`TOS_REGION`。
- 平台共享 Provider 首期使用 `SILICONFLOW_API_KEY`（默认 Base URL `https://api.siliconflow.cn/v1`）、`AMUX_API_KEY`（默认 Base URL `https://api.amux.ai/v1`）和 `PIPIXIA_API_KEY` / `PIPIXIA_BASE_URL`（OpenAI-compatible 中转，Base URL 由部署环境配置）；可用 `*_BASE_URL` 接入私有网关。模型不写入环境变量：管理员在 Admin「AI 模型目录」审核、导入并检测模型，标记文本、视觉、生图、支持参考图或向量能力；向量模型必须同时登记实际输出维度（例如 384、768 或 1024），连接检测会核对返回向量长度；`reference_image` 必须与 `image_generation` 同时启用，兼容读取旧 `image_edit` 标签。图片模型的 `image_protocol` 默认按 Provider 自动匹配，也可为兼容网关显式选择 SiliconFlow Images、OpenAI Images 或 ARK Images 协议。业务节点和交互界面直接选择已启用且能力匹配的模型。连接检测执行一次与声明能力匹配的真实请求并保存未验证、部分验证、已验证或验证失败状态；文本检测只消耗极少量 token，生图和参考图检测会真实生成图片、耗时更长且可能产生明显费用，因此只允许管理员手动触发。Provider 密钥只保留在服务端环境变量，不支持用户自带 key。
- 服务端在保存或调用前校验模型存在、已启用且具备所需能力；模型 Provider、实际模型、token 与延迟继续写入 AI 用量审计。场景策略与个人 AI 偏好已移除。
- `ARK_*`、`GEMINI_*` 和既有 `LIFE_TRACE_AI_*` / `MIND_ARENA_AI_*` 暂时仅为未迁移调用路径保留，新功能不得新增 `*_TEXT_MODEL`、`*_VISION_MODEL` 等模型环境变量。移除条件是：所有直接调用完成模型目录迁移，且没有剩余 Legacy 直连路径。
- Life Trace Pantry AI 拍照分析优先使用 `GEMINI_API_KEY`、`GEMINI_API_BASE_URL`、`GEMINI_VISION_MODEL`，可用 `LIFE_TRACE_PANTRY_PHOTO_AI_PROVIDER` 强制切换 `auto` / `gemini` / `ark`，可用 `LIFE_TRACE_PANTRY_PHOTO_AI_TIMEOUT_SECONDS` 单独调整超时；未配置 Gemini 时回退 `ARK_VISION_MODEL`，再回退 `ARK_TEXT_MODEL`。
- Life Trace 文本 AI 可用 `LIFE_TRACE_AI_*` 覆盖，未配置时回退 `ARK_TEXT_MODEL`；旧 `OPENAI_API_*` 仍兼容但不建议新增使用。
- Life Trace 生活助理 Agent 灰度：`LIFE_TRACE_ASSISTANT_USE_AGENT`（默认 false）。设为 `true`/`1`/`yes`/`on` 时走 `server/internal/ai/agent` 的手写 tool loop（可自主调用 5 个 life-trace tool）;其他值一律回退旧的结构化 tool-call 单次调用 + fallback 路径。
- AI Mind Arena 后端依赖 `MIND_ARENA_AI_PROVIDER`、`MIND_ARENA_AI_BASE_URL`、`MIND_ARENA_AI_API_KEY`，默认复用 `ARK_TEXT_MODEL`；只有需要单独切换脑内会议室模型时才配置 `MIND_ARENA_AI_MODEL`。配置不完整或上游失败时应回退 mock；旧 `AI_*` 仍兼容但不建议新增使用。
- 博客封面外部图源代理依赖 `UNSPLASH_ACCESS_KEY`、`PEXELS_API_KEY`，超时使用 `EXTERNAL_IMAGES_TIMEOUT_SECONDS`（默认 8 秒）；未配置对应 Key 时该 provider 返回 503，仓库不写入真实 Key。
- Notion OAuth 连接器依赖 `NOTION_OAUTH_CLIENT_ID`、`NOTION_OAUTH_CLIENT_SECRET`、`NOTION_OAUTH_REDIRECT_URL` 和独立的 32 字节 `NOTION_OAUTH_TOKEN_KEY`；回调地址必须与 Notion Creator Dashboard 中登记的地址完全一致。

## 常用定位入口

- Web 路由：`apps/web/src/App.tsx`。
- Admin 路由：`apps/admin/src/App.tsx`。
- Life Trace 路由：`apps/life-trace/src/App.tsx`。
- AI Mind Arena 页面：`apps/ai-mind-arena/app`。
- 服务端路由：`server/internal/router/router.go`。
- 服务端配置：`server/internal/config/config.go`。
- 数据模型：`server/internal/model`。
- Web API 封装：`apps/web/src/api`。
- Admin API 封装：`apps/admin/src/api`。

## 常用校验

本节是仓库验证命令的唯一完整真源。根 `AGENTS.md`、Harness 文档和子项目规则只维护路由或局部补充，不复制整张命令表。

```bash
# Harness 配置与 fixture
pnpm check:harness
pnpm check:harness:test
pnpm check:docs-links

# 全 workspace 静态检查与构建
pnpm check
pnpm build

# 前端应用定向检查
pnpm --filter @valley/web exec tsc --noEmit
pnpm --filter @valley/web test
pnpm --filter @valley/admin exec tsc --noEmit
pnpm --filter @valley/life-trace check
pnpm --filter @valley/ai-mind-arena typecheck
pnpm --filter @valley/scratch-legend typecheck
pnpm --filter @valley/world-sim typecheck
pnpm --filter @valley/toy-climb-arena typecheck

# Go 服务
cd server && go test ./...

# 非 ASCII 文本、Markdown、skill 或配置示例
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <相关文件>
```

共享包改动运行对应包的 `typecheck`、`test` 或 `build`。无法运行必要验证时，最终回复必须说明原因、影响范围和剩余风险。

## CI 质量门禁

- `.github/workflows/quality.yml` 在 push 和 pull request 上执行 Harness 检查、workspace check/build 和 Go 测试。
- `.github/workflows/deploy-server.yml` 只处理服务端部署：远端测试通过后构建服务与迁移程序，应用待执行迁移，成功后才重启服务。
- 当前不使用 changed-files 第三方 action；优先保证完整验证，后续根据 CI 耗时再评估增量矩阵。
