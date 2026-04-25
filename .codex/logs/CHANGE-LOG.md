# Valley MAS 变更日志

> 说明：记录每次真实落地改动，按时间顺序追加，不覆盖历史。

## 2026-04-21 15:01 (Asia/Shanghai)

- 任务：收口 `RLIB-2` / `RLIB-3` 执行状态，修正阅读库任务父项进度标记。
- 改动文件：
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将 `RLIB（P1）阅读库在线导入链路增强` 父项由未完成改为已完成，和 `RLIB-1/2/3` 子项状态保持一致。
  - 复核 `RLIB-2/3` 代码落地与路由、模型、迁移、Admin UI 任务追踪链路，确认当前实现可用。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter admin exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：导入任务仍是进程内异步执行，服务重启会中断任务。
  - 下一步动作：按 `RLIB-4` 继续做并发上限、任务取消与重启恢复策略。

## 2026-04-21 14:54 (Asia/Shanghai)

- 任务：推进阅读库导入增强，完成 `RLIB-2`（TXT 自动建书）与 `RLIB-3`（导入任务追踪与重试）。
- 改动文件：
  - `server/internal/handler/admin_classics_import_jobs.go`（新增）
  - `server/internal/handler/admin_classics.go`
  - `server/internal/router/router.go`
  - `server/internal/model/classics.go`
  - `server/internal/database/database.go`
  - `server/migrations/018_create_classics_import_jobs.sql`（新增）
  - `apps/admin/src/api/classics.ts`
  - `apps/admin/src/pages/ClassicsBooks.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 后端新增阅读库导入任务接口：创建任务、列表查询、单任务查询、失败重试（`/admin/classics/import-jobs*`）。
  - 新增 `classics_import_jobs` 任务模型与迁移脚本，持久化记录状态、阶段、进度、错误信息、导入结果（book/edition/chapter/word 统计）。
  - 实现 TXT 自动建书流程：解析章节标题后自动创建书目 + 默认版本 + 章节正文，并回写章节数/总字数。
  - Admin 页面新增“TXT 自动建书”入口与任务状态轮询，支持查看最近任务、失败重试；同时保留“导入到已有书目”模式。
  - 修复 Admin 书目列表缺少 `editions` 导致“导入到已有书目”无法稳定拿到版本 ID 的问题。
  - 任务清单已将 `RLIB-2` / `RLIB-3` 标记完成，并新增 `RLIB-4` 作为后续治理项。
- 校验：
  - `gofmt -w server/internal/model/classics.go server/internal/database/database.go server/internal/handler/admin_classics.go server/internal/handler/admin_classics_import_jobs.go server/internal/router/router.go`：通过
  - `cd server && go test ./...`：通过
  - `pnpm --filter admin exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py server/internal/model/classics.go server/internal/database/database.go server/internal/handler/admin_classics.go server/internal/handler/admin_classics_import_jobs.go server/internal/router/router.go apps/admin/src/api/classics.ts apps/admin/src/pages/ClassicsBooks.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md`：通过
- 风险与后续：
  - 当前风险：当前任务执行在服务进程内异步 goroutine，若服务重启，进行中的任务不会自动恢复。
  - 下一步动作：推进 `RLIB-4`，补任务恢复、取消与并发治理策略。

## 2026-04-21 14:35 (Asia/Shanghai)

- 任务：将名著模块统一命名为“阅读库”，并增强 Admin 在线导入能力（支持 TXT 自动拆章 + 长耗时进度提示）。
- 改动文件：
  - `apps/web/src/App.tsx`
  - `apps/web/src/layouts/Header.tsx`
  - `apps/web/src/pages/ClassicsList/index.tsx`
  - `apps/web/src/pages/ClassicsShelf/index.tsx`
  - `apps/web/src/pages/ClassicsDetail/index.tsx`
  - `apps/admin/src/layouts/Layout.tsx`
  - `apps/admin/src/api/classics.ts`
  - `apps/admin/src/pages/ClassicsBooks.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 前台标题、导航与核心页面文案统一为“阅读库”（保留原 `/classics` 路由兼容）。
  - Admin“导入章节”弹窗升级为“在线导入正文”：新增 `TXT 自动拆章` 与 `JSON 章节数组` 双模式。
  - 增加 TXT 章节识别规则（支持“第X章/回”与 “Chapter X”），自动生成章节预估数。
  - 增加导入过程 1/4~4/4 进度说明与实时状态文本，明确大文件导入可能耗时 10~90 秒。
  - Web 任务清单新增 `RLIB`（阅读库在线导入链路增强）并标记 `RLIB-1` 已完成，补充 `RLIB-2/3` 后续任务。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `pnpm --filter admin exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/App.tsx apps/web/src/layouts/Header.tsx apps/web/src/pages/ClassicsList/index.tsx apps/web/src/pages/ClassicsShelf/index.tsx apps/web/src/pages/ClassicsDetail/index.tsx apps/admin/src/layouts/Layout.tsx apps/admin/src/pages/ClassicsBooks.tsx apps/admin/src/api/classics.ts .codex/skills/web-feature-iteration/WEB-TASKS.md`：通过
- 风险与后续：
  - 当前风险：TXT 自动拆章为规则识别，极端格式（无章节标题、目录噪声）可能仍需人工校对章节标题。
  - 下一步动作：推进 `RLIB-2`，实现“上传 TXT 后自动创建书目 + 默认版本 + 章节”的一站式导入。

## 2026-04-21 14:14 (Asia/Shanghai)

- 任务：修复名著详情页与阅读页观感不友好问题，完成一轮视觉与排版体验重构。
- 改动文件：
  - `apps/web/src/pages/ClassicsDetail/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 章节阅读模式升级为沉浸式阅读布局：背景氛围层、卡片化正文容器、目录侧栏层级优化、上下章与 AI 面板视觉统一。
  - 详情页重构为同风格阅读入口：头部信息卡片、封面与元信息层次重排、版本/语言切换区收敛、目录网格卡片可读性提升。
  - 中英阅读排版区分：英文启用衬线英文阅读字体与更大行距，中文保持宋体阅读风格，降低长文阅读疲劳。
  - Web 任务清单新增并勾选 `CLUI`，将本次视觉改造从活跃迭代中沉淀为已完成项。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/ClassicsDetail/index.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：本轮主要优化视觉与排版，未新增“字号/行宽/主题切换”等阅读个性化设置。
  - 下一步动作：可继续补“阅读设置面板（字号、行高、段宽、背景）”与“AI 问章节历史跨设备同步”。

## 2026-04-20 16:34 (Asia/Shanghai)

- 任务：继续名著增强，完成“最近阅读跨设备同步（登录态云端 + 游客本地兜底）”。
- 改动文件：
  - `server/migrations/016_create_classics_user_recent.sql`（新增）
  - `server/internal/model/classics.go`
  - `server/internal/database/database.go`
  - `server/internal/handler/classics_recent.go`（新增）
  - `server/internal/router/router.go`
  - `apps/web/src/api/classics.ts`
  - `apps/web/src/hooks/useClassicsShelf.ts`
  - `apps/web/src/pages/ClassicsDetail/index.tsx`
  - `apps/web/src/pages/ClassicsList/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 后端新增 `classics_user_recent` 表和 `GET/POST /api/v1/user/classics/recent`，按 `saved_at` 返回最近阅读并在返回中补齐书名/封面/作者信息。
  - 前端新增最近阅读云端 API，`useClassicsShelf` 增加 `getRecentBooksWithSync/pushRecentBookWithSync`，统一处理“本地记录 + 云端合并/回写”。
  - 详情页章节阅读成功后改为写入同步版最近阅读；列表页最近阅读横条改为初始化时同步拉取。
  - Web 任务清单将“最近阅读跨设备同步”标记完成，并补充“AI 探索记录跨设备同步”为下一项。
- 校验：
  - `gofmt -w server/internal/model/classics.go server/internal/database/database.go server/internal/handler/classics_recent.go server/internal/router/router.go`：通过
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py server/internal/model/classics.go server/internal/database/database.go server/internal/handler/classics_recent.go server/internal/router/router.go apps/web/src/api/classics.ts apps/web/src/hooks/useClassicsShelf.ts apps/web/src/pages/ClassicsDetail/index.tsx apps/web/src/pages/ClassicsList/index.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：当前“最近阅读”仅在阅读成功后写入，若用户只打开详情未读章节不会进入最近阅读。
  - 下一步动作：若继续增强，优先实现 AI 探索记录跨设备同步。

## 2026-04-20 16:00 (Asia/Shanghai)

- 任务：继续名著增强，完成“阅读进度跨设备同步（登录态云端 + 游客本地兜底）”。
- 改动文件：
  - `server/migrations/015_create_classics_user_progress.sql`（新增）
  - `server/internal/model/classics.go`
  - `server/internal/database/database.go`
  - `server/internal/handler/classics_progress.go`（新增）
  - `server/internal/router/router.go`
  - `apps/web/src/api/classics.ts`
  - `apps/web/src/hooks/useClassicsShelf.ts`
  - `apps/web/src/pages/ClassicsDetail/index.tsx`
  - `apps/web/src/pages/ClassicsShelf/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 后端新增 `classics_user_progress` 表和 `GET/POST /api/v1/user/classics/progress`，支持按 `bookId/bookIds` 查询与 upsert 保存进度。
  - 前端进度逻辑收口到 `useClassicsShelf`：新增 `getProgressWithSync/getProgressMapWithSync/saveProgressWithSync`，统一处理“本地优先体验 + 登录态云端合并/回写”。
  - 详情页阅读时改为同步保存进度，进入页面时同步拉取进度；书架页展示与跳转使用同步后的进度映射。
  - 任务清单将“阅读进度跨设备同步”标记完成，并补充“最近阅读跨设备同步”为下一项。
- 校验：
  - `gofmt -w server/internal/model/classics.go server/internal/database/database.go server/internal/handler/classics_progress.go server/internal/router/router.go`：通过
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py server/internal/model/classics.go server/internal/database/database.go server/internal/handler/classics_progress.go server/internal/router/router.go apps/web/src/api/classics.ts apps/web/src/hooks/useClassicsShelf.ts apps/web/src/pages/ClassicsDetail/index.tsx apps/web/src/pages/ClassicsShelf/index.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：目前仅同步“单书最新进度”，未同步最近阅读列表排序。
  - 下一步动作：如继续增强，优先做 `classics_recent` 云端同步。

## 2026-04-20 15:48 (Asia/Shanghai)

- 任务：推进名著下一批增强，完成“书架跨设备同步（登录态云端 + 游客本地兜底）”。
- 改动文件：
  - `server/migrations/014_create_classics_user_shelves.sql`（新增）
  - `server/internal/model/classics.go`
  - `server/internal/database/database.go`
  - `server/internal/handler/classics_shelf.go`（新增）
  - `server/internal/router/router.go`
  - `apps/web/src/api/classics.ts`
  - `apps/web/src/hooks/useClassicsShelf.ts`
  - `apps/web/src/pages/ClassicsDetail/index.tsx`
  - `apps/web/src/pages/ClassicsShelf/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 后端新增 `classics_user_shelves` 表与 `GET/POST/DELETE /api/v1/user/classics/shelf` 接口，支持用户维度书架持久化。
  - 新增 `ClassicsUserShelf` 模型并接入启动迁移，`POST` 使用 upsert 刷新 `updated_at`，保证最近加入排序稳定。
  - 前端书架能力升级：`useClassicsShelf` 新增云端同步函数（登录态优先云端、自动合并本地旧书架、失败回退本地）。
  - 详情页与书架页改为调用同步函数，保持“加入/移除/展示”行为一致且兼容游客模式。
  - Web 任务清单新增并勾选 `CLSYNC`，同时把“阅读进度跨设备同步”列为下一项候选。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py server/internal/model/classics.go server/internal/database/database.go server/internal/handler/classics_shelf.go server/internal/router/router.go apps/web/src/api/classics.ts apps/web/src/hooks/useClassicsShelf.ts apps/web/src/pages/ClassicsDetail/index.tsx apps/web/src/pages/ClassicsShelf/index.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：接口依赖登录态 token，未登录用户仍是本地书架，不会自动跨设备同步。
  - 下一步动作：若继续做名著增强，优先实现“阅读进度跨设备同步”。

## 2026-04-20 15:36 (Asia/Shanghai)

- 任务：启动并完成名著馆书架页（`/classics/shelf`）闭环，补齐列表/详情入口与任务清单状态。
- 改动文件：
  - `apps/web/src/pages/ClassicsShelf/index.tsx`（新增）
  - `apps/web/src/App.tsx`
  - `apps/web/src/pages/ClassicsList/index.tsx`
  - `apps/web/src/pages/ClassicsDetail/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增书架页：读取 `classics_shelf` 并拉取书籍详情，支持继续阅读/开始阅读、移出书架、空状态引导回名著馆。
  - 全局路由与标题补齐：新增 `/classics/shelf` 路由与页面标题「名著书架 | Valley」。
  - 阅读链路补齐入口：`ClassicsList` Hero 区新增「我的书架」按钮，`ClassicsDetail` 操作区新增「查看书架」按钮。
  - 任务清单更新：标记名著书架页完成，并同步修正 CLD/CLR/CLAI 父任务完成状态。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/ClassicsShelf/index.tsx apps/web/src/App.tsx apps/web/src/pages/ClassicsList/index.tsx apps/web/src/pages/ClassicsDetail/index.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：书架页通过本地 localStorage 存储，跨设备不会自动同步。
  - 下一步动作：若要跨设备同步，可在后端补用户书架表并提供登录态同步接口。

## 2026-04-19 CLR-3 + CLAI-1/2/3 名著阅读闭环与 AI 伴读全链路 (Asia/Shanghai)

- 任务：完成 CLR-3 书签与最近阅读、CLAI-1 AI 伴读入口、CLAI-2 能力接入、CLAI-3 阅读记录联动。
- 改动文件：
  - `apps/web/src/hooks/useClassicsShelf.ts`（新增）— 书架/最近阅读/AI探索记录 localStorage 工具
  - `apps/web/src/pages/ClassicsDetail/index.tsx` — 书架按钮、最近阅读写入、AI 悬浮按钮、AI 伴读面板、TOC ✨ 徽标
  - `apps/web/src/pages/ClassicsList/index.tsx` — 最近阅读横条（RecentBooksBar）
  - `apps/web/src/api/classics.ts` — 新增 AI 接口类型与函数
  - `server/internal/model/classics.go`（新增）— ClassicsChapter GORM model
  - `server/internal/handler/classics_ai.go`（新增）— GetClassicsChapterGuide / AskClassicsChapter
  - `server/internal/router/router.go` — 注册 2 条 AI 路由
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md` — 标记 CLR-3/CLAI-1/2/3 完成
- 关键改动：
  - CLR-3：`classics_shelf`（书架 id 列表）+ `classics_recent`（最近10本）写入 localStorage；列表页顶部横向卡片行展示最近阅读；详情页加入/取消书架按钮。
  - CLAI-1/2：阅读模式右下角 ✨ 悬浮按钮展开 AI 面板，面板含「本章导读」与「问章节」两个能力，结果卡片含 highlights 标签 + citations 引用块。
  - CLAI-3：`classics_ai_explored_{bookId}` 记录已 AI 探索章节索引，TOC 侧栏和详情页目录网格对已探索章节显示 ✨ 图标，跨会话持久化。
  - 后端复用 blog_ai.go 的 ARK 调用链（`readArkTextModelConfig` / `callChatStream` / `extractJSONPayload`）。

- 任务：启动并完成 CLR-1，产出名著列表与详情页结构稿。
- 改动文件：
  - `docs/architecture/2026-04-19_classic_literature_clr1_list_detail_structure.md`（新增）
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 定版 `/classics`（列表页）与 `/classic/:id`（详情页）路由，规范参考现有 `/resources`→`/resource/:id` 约定。
  - 列表页：URL 状态（page/category/keyword）、ClassicBookCard 卡片字段（封面/书名/作者/分类/字数）、空态/加载态规则。
  - 详情页：信息层级（书名优先中文、作者/译者展示规则、字数格式化）、版本选择交互（URL `?edition=` 参数）、章节列表字段、版权声明折叠区。
  - 全局导航入口：在顶部导航「博客」之后增加「名著馆」入口。
  - 后端接口需求：列出 4 个接口（列表/详情/版本章节列表/单章内容）供 server 端参考。
  - WEB-TASKS：CLR-1 标记完成，下一步建议切换为 CLR-2 → CLR-3。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py docs/architecture/2026-04-19_classic_literature_clr1_list_detail_structure.md .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：后端接口尚未实现，CLR-1 结构稿依赖接口落地后才能进入真实页面开发。
  - 下一步动作：执行 CLR-2，实现阅读器 MVP（`/classic/:id/read`），章节切换 + 进度恢复。


- 改动文件：
  - `docs/architecture/2026-04-19_classic_literature_cld3_metadata_model.md`（新增）
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 定版 Book / Author / Translator / Edition / Chapter 五层元数据模型，含字段类型、必填规则、枚举约束。
  - 明确 Author/Translator 与 Book/Edition 的关联表结构（`book_authors`/`edition_translators`），支持合著与多译者场景。
  - Edition 字段对齐 CLD-1 白名单（`source_name`/`source_url`/`license_type`/`rights_note`）与 CLD-2 输出（`import_format`/`import_at`/`chapter_count`/`word_count`）。
  - Chapter 字段直接承接 CLD-2 章节数据契约（`chapter_html`/`footnotes`/`illustrations`）。
  - 明确字段校验规则：必填项拒绝条件、`is_default` 唯一性约束、`source_name` 需在 CLD-1 白名单内。
  - WEB-TASKS：CLD-3 标记完成，CLD 系列（P0）全部完成；下一步建议切换为 CLR-1 → CLR-2。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py docs/architecture/2026-04-19_classic_literature_cld3_metadata_model.md .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：元数据模型定版后需同步更新数据库 Schema，字段变更需评估对已有导入数据的兼容影响。
  - 下一步动作：执行 CLR-1，产出名著列表与详情页结构稿。


- 改动文件：
  - `docs/architecture/2026-04-19_classic_literature_cld2_import_standard.md`（新增）
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 CLD-2 文档，冻结 epub/txt/html 三种格式的导入规则：章节切分（含 epub TOC 优先、txt 正则推断、html Readability 去噪）、脚注处理（epub 内置脚注/html 锚点/txt 括号注/译注区分）、图片占位（封面下载/插图占位/外链屏蔽）、文本清洗通则（编码归一/广告段落过滤）。
  - 明确清洗 Pipeline 七步流程，输出标准化章节数据契约（`chapter_html`/`word_count`/`footnotes[]`/`illustrations[]`）。
  - 定义质量校验门槛（章节数/字数/广告段落占比/图片 404 率），不达标进人工复核。
  - 明确下游接口约定：对齐 CLD-3（元数据模型）、CLR-2（阅读器 MVP）、CLAI-1（AI 伴读入口）。
  - WEB-TASKS：将 CLD-2 标记为已完成，下一步建议切换为 CLD-3 → CLR-1。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py docs/architecture/2026-04-19_classic_literature_cld2_import_standard.md .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：清洗规则基于常见格式约定，实际导入时可能遇到非标结构（如超长单章节、无 TOC 的 epub），需在工具链中补充兜底逻辑。
  - 下一步动作：执行 CLD-3，定版元数据模型（作者/译者/版本/章节），字段需与 CLD-2 章节数据契约对齐。



- 任务：抽取通用 URL query state hook，并先迁移资源页与博客列表页的复杂查询参数同步。
- 改动文件：
  - `packages/shared-router/src/index.ts`
  - `apps/web/src/hooks/useUrlPaginationQuery.ts`
  - `apps/web/src/pages/Resources/index.tsx`
  - `apps/web/src/pages/blog/BlogList/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 `shared-router` 新增 `useUrlQueryState` 及 `stringParam/numberParam/enumParam`，支持声明式查询参数解析、默认值清理和“筛选变化自动重置分页”。
  - 将现有 `useUrlPaginationQuery` 改为复用新 hook，保持旧页面兼容，同时把公共能力提升到可扩展多字段。
  - `Resources` 页面把 `type/tagId/tagName` 纳入 URL，同步保留 `keyword/page`，刷新与分享链接时可恢复更完整的筛选状态。
  - `BlogList` 页面把 `groupId/sort` 收口到新 hook，移除分散的 `URLSearchParams` 手写更新逻辑。
- 校验：
  - `pnpm --filter @valley/shared-router build`：通过
  - `pnpm --filter @valley/shared-router exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：`Resources` 为了在无额外接口查询时保留标签文案，暂时把 `tagName` 也写进了 URL；后续若补“按 id 取标签详情”接口，可进一步收敛。
  - 下一步动作：把 `CreatorProfile`、`MyResources`、`MyPosts` 等仍有本地筛选 state 的页面逐步迁到同一套 query schema。

## 2026-04-17 15:15 (Asia/Shanghai)

- 任务：新增仓库内 Git 发布护栏 skill，并继续把 URL query state 封装推广到创作者主页与资源管理页。
- 改动文件：
  - `.codex/skills/git-publish-guard/SKILL.md`
  - `.codex/skills/git-publish-guard/agents/openai.yaml`
  - `.codex/skills/INDEX.md`
  - `apps/web/src/pages/CreatorProfile/index.tsx`
  - `apps/web/src/pages/MyResources/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `git-publish-guard` skill，明确 push 时显式指定 remote、默认使用 `origin`，并与 `yeet/github:yeet`、`conventional-commit-guard` 做职责分层。
  - 在 skills 索引中补充 `git-publish-guard` 触发时机与边界，便于后续发现与复用。
  - `CreatorProfile` 改为声明式 URL query schema，收口 `page/keyword/type/albumId/tab`，刷新或分享链接时能恢复创作者主页筛选上下文。
  - `MyResources` 改为声明式 URL query schema，收口 `page/type/albumId`，保留批量操作逻辑的同时减少本地筛选 state。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `quick_validate.py`：未执行（仓库内未找到该脚本）
- 风险与后续：
  - 当前风险：`CreatorProfile` 的 `tab` 已进入 URL，但专辑页切回作品列表时仍沿用同一分页字段；若后续需要“专辑 tab 独立分页”再细分 schema。
  - 下一步动作：继续迁 `MyPosts` 等多分页/多筛选页面，并在后续需要 push 时显式按 `git push origin <branch>` 执行。

## 2026-04-17 15:21 (Asia/Shanghai)

- 任务：继续推进内容管理页的 URL 状态收口，覆盖多分页 + 多分组筛选场景。
- 改动文件：
  - `apps/web/src/pages/MyPosts/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - `MyPosts` 改为使用统一的 `useUrlQueryState`，收口 `blogPage/imageTextPage/blogGroupId/imageTextGroupId`。
  - 博客与图文分组切换现在会自动重置对应分页，避免本地 state 与 URL 状态脱节。
  - 当总页数缩小时，自动把当前页拉回有效范围，保持多分页列表在 URL 驱动下仍然稳定。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：`MyPosts` 仍然是单页双列表结构，若后续要支持更多筛选项，可能需要再考虑是否拆分为 tab 驱动页面。
  - 下一步动作：若你继续想统一剩余列表页，我建议下一批处理 `ResourceTagManage` 这种“多分页器 + 多 keyword key”页面。

## 2026-04-17 15:47 (Asia/Shanghai)

- 任务：收尾剩余的 Web 查询参数联动页面，清理手写 query 同步逻辑。
- 改动文件：
  - `apps/web/src/pages/Creator/index.tsx`
  - `apps/web/src/pages/BlogGroupManage/index.tsx`
  - `apps/web/src/pages/ResourceTagManage/index.tsx`
  - `apps/web/src/pages/ResourceAlbumManage/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - `Creator` 页改为统一 query schema，收口 `page/keyword`，不再手写 `URLSearchParams`。
  - `BlogGroupManage` 用 schema 管理 `type`，让分组类型切换与其他页面保持一致。
  - `ResourceTagManage` 保留双分页器结构，但把 `tab` 也纳入统一 query state。
  - `ResourceAlbumManage` 的 `ResourcePicker` 把 `type` 收进 query state，继续保留关键词与分页联动。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：`ResourceAlbumManage` 的资源选择器仍是“关键词前端过滤 + 类型后端筛选”的混合模式，后续若需要完全一致的筛选语义，可以再统一到后端查询。
  - 下一步动作：当前 `apps/web/src/pages` 下已没有明显手写 `useSearchParams/new URLSearchParams` 的列表页 URL 同步逻辑残留，后续新增列表页时直接复用 `useUrlQueryState`。

## 2026-04-14 12:52 (Asia/Shanghai)

- 任务：新增“每次改动必须记日志”的 skill，并将规则接入仓库协作约定。
- 改动文件：
  - `.codex/skills/change-log-guard/SKILL.md`
  - `.codex/skills/change-log-guard/agents/openai.yaml`
  - `AGENTS.md`
  - `.codex/skills/INDEX.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新建 `change-log-guard` skill，明确日志文件路径、触发条件、模板与协作规则。
  - 将 `change-log-guard` 加入项目默认优先 skills 与场景强制技能说明。
  - 在 skills 索引中新增 `change-log-guard` 的触发指南与使用边界。
  - 建立统一日志文件并写入首条记录，后续按同模板持续追加。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
  - `pnpm --filter web exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：若未来回合未显式触发该 skill，可能出现漏记日志。
  - 下一步动作：后续每轮有文件改动时，必须在本文件追加一条记录。

## 2026-04-14 12:55 (Asia/Shanghai)

- 任务：把新增集装箱改为更明显的横置大台面，并提升该段跳跃容错。
- 改动文件：
  - `packages/climber-game/src/levels/togetherSkyAscent.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将 `sp201` 调整为明显横置（`rotation: [0, Math.PI * 0.5, 0]`）并放大台面尺寸。
  - 新增第二个横置集装箱 `sp204`，形成更连续的可落脚平台。
  - 微调 `sp202` 与 `sp203` 位置与尺寸，避免与新台面重叠并维持可跳路线。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：未做本地实机手感验证，仍需确认这段跳跃节奏是否过于简单。
  - 下一步动作：你进游戏实测后，我再按体感把两块集装箱的间距与高度做一轮微调。

## 2026-04-14 13:00 (Asia/Shanghai)

- 任务：将“模型展览”改为只展示当前地图实际使用的模型实例，并把该约束写入 skill。
- 改动文件：
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/skills/climber-game-design-guard/SKILL.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 模型展览的数据源从“全量资产目录”改为 `activeLevel.setPieces`，每个实例单独展示。
  - 展览卡片改为实例维度命名（`模型名 · 实例ID`），并展示该实例的位置元信息。
  - 顶部统计中的“场景模型”改为当前地图实例数，新增实例后展览会自动出现。
  - 在 `climber-game-design-guard` 中新增“模型展览需按当前地图实例展示”的规则。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：未完成本地运行校验，需确认实例数量较多时展览滚动性能是否可接受。
  - 下一步动作：你实测后如果觉得列表太长，我再加“按资产类型折叠/筛选”。

## 2026-04-14 13:07 (Asia/Shanghai)

- 任务：修复“模型展览看不到集装箱/新增模型不明显”，并支持同模型多次出现的可视化统计。
- 改动文件：
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `packages/climber-game/src/removedSetPieceAssets.ts`
  - `.codex/skills/climber-game-design-guard/SKILL.md`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 模型展览从“仅当前实例列表”升级为“全模型目录 + 当前地图实例”双来源，目录项展示“当前地图出现次数”。
  - 展览顶部新增关键统计：模型目录总数、已使用模型种类、集装箱出现次数，并增加“一键定位集装箱”按钮。
  - 放开 `stepping_stone` 与 `barrel_tower` 的移除过滤，保证新加短阶/木桶模型可进入关卡与展览。
  - 更新 `climber-game-design-guard`：模型展览规则改为必须显示“新增模型/新增实例及出现次数”。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：目录项与实例项合并后列表更长，后续可能需要增加搜索/分组折叠。
  - 下一步动作：你实机确认后，我可以继续补“按资产ID筛选 + 只看当前地图已使用模型”开关。

## 2026-04-14 13:10 (Asia/Shanghai)

- 任务：按用户反馈移除“集装箱专属”展示，保持模型展览为通用能力。
- 改动文件：
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 删除“集装箱出现次数”专属统计，不再给单一模型做特化展示。
  - 删除“定位集装箱”按钮，避免展览 UI 偏向单模型。
  - 保留“全模型目录 + 当前地图实例 + 模型出现次数”的通用展示逻辑。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：无新增功能风险，属于展示层收敛。
  - 下一步动作：如需进一步提效，可做“按模型名搜索”而不是某单模型快捷按钮。

## 2026-04-14 13:22 (Asia/Shanghai)

- 任务：排查“sp 步骤缺失”并清理无效关卡模型配置，同时核对缺失 glb 引用。
- 改动文件：
  - `packages/climber-game/src/levels/togetherSkyAscent.ts`

  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 审计结果：`climber-game` 当前 `setpieceCatalog` 与角色模型导入未发现“代码引用但 glb 文件不存在”的情况。
  - 根因定位：`togetherSkyAscent` 内存在大量已禁用模型的 `sp` 定义，运行时被 `REMOVED_SETPIECE_ASSET_IDS` 过滤，导致体感上“关卡步骤缺失”。
  - 直接清理：从关卡源码物理删除 192 个被禁用模型对应的 `sp`，保留 62 个真实生效点位，并移除该文件内的末尾过滤依赖。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：关卡点位数量大幅收敛后，部分高度段可能变稀疏，需一轮实机可达性复测。
  - 下一步动作：按你的“不要的小模型”清单继续收缩 `setpieceCatalog` 与对应 glb（含脚本产物）做第二轮彻底剔除。

## 2026-04-14 14:06 (Asia/Shanghai)

- 任务：清理 `SETPIECE_CATALOG` 未使用模型，并同步剔除不再保留的 setpiece 资产与生成脚本冗余逻辑。
- 改动文件：
  - `packages/climber-game/src/setpieceCatalog.ts`
  - `packages/climber-game/src/types.ts`
  - `packages/climber-game/src/removedSetPieceAssets.ts`
  - `packages/climber-game/scripts/generate_setpieces.py`
  - `packages/climber-game/assets/models/setpieces/*.glb`（删除未使用资产）
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - `SETPIECE_CATALOG` 与 `ClimberSetPieceAssetId` 收敛到当前关卡真实使用的 11 个模型。
  - 删除 45 个不再使用的 setpiece glb 文件，仅保留关卡实际使用的资产文件。
  - `removedSetPieceAssets` 收敛为空集合，避免类型与资产收缩后残留无效配置。
  - 生成脚本移除不再保留模型（round_stool/tree_pine/grass_patch/road_segment）的构建逻辑与调用。
- 校验：
  - `python3 -m py_compile packages/climber-game/scripts/generate_setpieces.py`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `python3` 扫描 `packages/climber-game/src` 的 `.glb` import：`missing_glb_refs = 0`
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：资产大幅收缩后，若后续要恢复旧主题区块需重新导入模型与碰撞参数。
  - 下一步动作：如你同意，我下一步把 `sp` 命名按现存点位重排为连续编号，便于后续继续加点。

## 2026-04-14 16:35 (Asia/Shanghai)

- 任务：优先推进 P2（角色与动画），补齐 Daisy 跳跃手感、动画调试面板与脚底自动校准能力。
- 改动文件：
  - `packages/climber-game/src/types.ts`
  - `packages/climber-game/src/characterRig.ts`
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - Daisy 跳跃分段参数收敛，调整 jump/fall/land 比例，减少起跳段过长导致的动作粘滞感。
  - 动画状态机从“空中统一 jump”细化为 `jump/fall/land`，新增落地锁定窗口，确保落地动作可见。
  - 新增角色动画调试快照（状态、速度、active clip、clip map、骨骼/overlay 信息），并接入暂停菜单开发态面板与开关。
  - 新增脚底自动校准能力：按足部骨骼最低点计算偏移，支持运行时开关，减少模型“漂浮/陷地”手工调参。
  - 扩展 prototype controller：支持 `setDebugCharacterAnimationVisible` 与 `setCharacterAutoFootCalibrationEnabled`。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：未做实机动作手感回归，Daisy 在极端落差段可能还需微调落地锁定时长。
  - 下一步动作：你实测后我按体感再细调 `LANDING_ANIMATION_LOCK_MS` 与 Daisy 分段比例。

## 2026-04-14 16:41 (Asia/Shanghai)

- 任务：新增菜单内全屏功能，并优化 `Esc` 与游戏菜单的冲突交互。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 暂停菜单新增“全屏开/关”按钮，并监听 `fullscreenchange` 同步全屏状态标签。
  - 新增 `P` 键快速回菜单（释放 pointer lock），减少与浏览器 `Esc` 系统行为冲突。
  - 按键提示与菜单文案更新为“`P` 菜单，`Esc` 系统退出”语义，避免用户误解。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：不同浏览器对全屏 + pointer lock 的 `Esc` 处理仍有细微差异，但交互路径已清晰分流。
  - 下一步动作：你实测后若需，我可以再加“全屏失败提示文案”与“首次进入时键位提示”。

## 2026-04-14 16:54 (Asia/Shanghai)

- 任务：针对“底层地面过空、模型辨识度不足”补充分批落地任务清单。
- 改动文件：
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 P3 新增地面场景与地表分层任务（大树/花草/岩石、土地/水泥地、碰撞回归与密度校准）。
  - 在 P4 新增可辨识度与比例基线任务（大树高度、草花尺寸、纹理策略升级）。
  - 在“下轮优先任务”新增地面冲刺包（按 3 批推进，先可辨识再精细化）。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：任务量较大，若不分批可能再次出现“模型多但体验乱”。
  - 下一步动作：按新清单先执行第一批“树石 + 碰撞 + 出生区回归”。

## 2026-04-14 16:58 (Asia/Shanghai)

- 任务：执行底层地面场景第一批落地（树石草花 + 土地/水泥地分层），改善“地面空与辨识度低”问题。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在底层边缘区域新增大树与岩石场景组，并为树/岩石添加碰撞体（`system` 分类，避免影响主路线 setpiece 统计）。
  - 新增草簇与花簇装饰（可见性优先，体量放大到第三人称镜头下一眼可见）。
  - 地面新增土地区与水泥区分层补丁，缓解单一平面“空白感”。
  - 场景资源在销毁流程中补充统一释放，避免新增几何/材质泄漏。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：树石碰撞虽然放在边缘，但仍需实机走一遍出生区和前段路线确认无遮挡感。
  - 下一步动作：继续第二批“密度校准 + 主路线前 3 段回归 + 纹理策略升级（程序贴图）”。

## 2026-04-14 17:58 (Asia/Shanghai)

- 任务：继续补齐底层空白区，执行第二批地面密度填充。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 扩充土地/水泥地补丁数量，覆盖此前“只有纯地面”的空白区域。
  - 地面大树从 6 棵扩到 12 棵，岩石从 6 组扩到 12 组，进一步填充边缘环带。
  - 草花簇从 6 组扩到 12 组，并为每组新增低矮碰撞体，保证底层场景可触达反馈。
  - 保持新增碰撞体归类为 `system`，避免影响 setpiece 关卡调试统计。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：草簇碰撞数量增加后，边缘绕行手感可能偏“绊脚”，需要实机确认密度是否仍舒适。
  - 下一步动作：按你的体感反馈再做一轮“局部疏密调参 + 纹理层次增强”。

## 2026-04-14 18:01 (Asia/Shanghai)

- 任务：修复 `climber-game` 中 `ImportMeta` 缺少 `env` 属性的 TypeScript 类型错误。
- 改动文件：
  - `packages/climber-game/src/env.d.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增本地 `ImportMetaEnv` 与 `ImportMeta` 声明，补齐 `import.meta.env.DEV/PROD/MODE/BASE_URL` 类型。
  - 采用包内声明文件方案，避免额外依赖 `vite/client` 类型引入。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：若后续读取新的 `env` 字段（自定义变量），需继续在该声明中补充类型。
  - 下一步动作：等你确认后，我可顺手补一个最小 `tsc` CI 校验，防止同类错误回归。

## 2026-04-14 19:53 (Asia/Shanghai)

- 任务：修复全屏失控、重构地面覆盖与碰撞体拟合，并启动 P3 新一轮落地。
- 改动文件：
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/skills/climber-game-design-guard/SKILL.md`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 全屏按钮链路修复：进入全屏后自动尝试恢复 Pointer Lock，避免“只显示鼠标、无法继续游戏”。
  - 地面材质重构：由“整面基础地板 + 土地区薄层覆盖”替代厚盒子叠层，解决泥地/水泥地冲突覆盖与踩踏错位。
  - 地面碰撞体重构：新增基于对象世界包围盒的碰撞体生成，树木按“树干/冠层”分段，岩石按实际结构拟合，不再使用单个大立方体占位。
  - `climber-game-design-guard` 新增“碰撞体拟合硬约束”，明确禁止非方块物体套单一立方体碰撞体。
  - 更新 `CLIMBER-GAME-TASKS`：记录本轮已完成项，并保留 P3 回归与主题区块等未完成项。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：树冠分段碰撞体数量上升后，边缘绕行手感可能偏紧，需要一轮实机回归确认。
  - 下一步动作：继续执行 P3 未完成项中的“地面场景碰撞回归 + 主路线实跳可达性回归”，再推进主题区块和高难挑战段。

## 2026-04-14 19:56 (Asia/Shanghai)

- 任务：继续推进 P3，先落地“四主题区块”可视辨识层。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在底层新增四个主题区块底面（集装箱区 / 木板桥区 / 管道区 / 农场区），通过颜色与区域分区提升路线辨识。
  - 为每个主题区块补充代表性视觉元素（箱体块、桥板条、管道件、农场体块），先完成“可辨识”目标。
  - 本轮主题区块元素先以视觉层为主，避免新增阻挡影响现有起步节奏，后续再按回归结果补精细碰撞。
  - `CLIMBER-GAME-TASKS` 中 P3“增加主题区块”条目标记为已完成。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：主题区块目前偏“基础辨识版”，美术精细度和叙事细节仍需下一轮深化。
  - 下一步动作：执行 P3 的“地面场景碰撞回归 + 主路线实跳可达性回归”，确认无阻挡后再推进移动障碍段。

## 2026-04-14 20:10 (Asia/Shanghai)

- 任务：修正“树碰撞体缺失”和“地面未全覆盖”回归问题。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 为对象包围盒碰撞生成补上 `updateWorldMatrix(true, true)`，修复树木分段碰撞体因世界矩阵未刷新导致的位置失真问题。
  - 新增整面地表覆盖层（全图混凝土基底薄层），在其上保留土地区域薄层，确保整个可玩地面都有覆盖模型。
  - 保持薄层方案，避免再次出现泥地/水泥地厚盒子互相穿插导致的踩踏冲突。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：整面覆盖层与土地区颜色对比在个别角度可能偏弱，后续可再微调材质层次。
  - 下一步动作：你实机复测树木碰撞与全图地面后，我继续推进 P3 的“实跳可达性回归 + 高难障碍段”。

## 2026-04-14 20:18 (Asia/Shanghai)

- 任务：按实机反馈修正“地面看起来未铺满”的视觉参数。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 明确地面统一尺寸：碰撞地面与视觉地面使用同一基准尺寸 `220 x 220`（`FLOOR_COLLIDER_SIZE` / `FLOOR_VISUAL_SIZE`）。
  - 下调网格干扰：`GridHelper` 改为跟随地面尺寸，并降低透明度，避免“只看见网格、看不见地表材质”。
  - 扩大土地区薄层覆盖：由局部小贴片改为全场分区覆盖（上下/左右/中心），确保地表视觉连续。
  - 调整地表层高度，减少共面闪烁与遮盖冲突。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：地表已经铺满，但土地区分层目前偏工程版，可在下一轮继续做更自然的材质过渡。
  - 下一步动作：等你实机确认视觉OK后，我继续推进 P3 的可达性回归与高难障碍段。

## 2026-04-14 20:26 (Asia/Shanghai)

- 任务：修复“人物与地面穿模”与“地面白网格可见”问题。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 引入统一地表高度常量：`FLOOR_SURFACE_Y`，并将 floor 视觉层、覆盖层、地面碰撞体顶部统一对齐到同一地表高度。
  - 地面碰撞体中心改为由地表高度推导（`FLOOR_COLLIDER_CENTER_Y`），避免视觉地面与物理地面错层导致脚底穿模。
  - 白网格调试层默认隐藏（`grid.visible = false`），并降低透明度，避免玩家视角下出现明显白网格干扰。
  - 地表覆盖薄层高度改为略低于地表平面，减少共面冲突和视觉闪烁。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：若后续再抬高地表装饰层，需要同步调整其高度与碰撞关系，避免再次错层。
  - 下一步动作：你实机确认“穿模 + 白网格”已消失后，我继续推进 P3 的可达性回归与移动障碍段。

## 2026-04-14 20:33 (Asia/Shanghai)

- 任务：继续推进 P3，把“地面/前段可达性回归”固化为自动检测门槛。
- 改动文件：
  - `packages/climber-game/src/types.ts`
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 扩展 `ClimberJumpClearanceReport`：新增 `earlyRouteCheckedLinks`、`earlyRouteHighRiskCount`、`spawnBlockerCount`、`spawnZoneClear`、`routeRegressionPassed`。
  - 在原有净空分析中加入 P3 回归规则：
    - 自动检查出生区阻挡碰撞体（排除 floor/boundary-wall）。
    - 自动统计前 3 段路线高风险数量。
    - 给出统一回归门槛 `routeRegressionPassed`（出生区清空 + 前段高风险为 0 + 全局高风险为 0）。
  - HUD 新增回归可视信息：前段高风险、出生区阻挡、回归门槛状态。
  - 任务清单补记“自动回归门槛已落地”，并保留“实机碰撞回归”待确认项。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：自动回归已能拦截明显阻挡，但仍不能替代完整手感实跳。
  - 下一步动作：你实机确认出生区与前 3 段后，我继续做 P3 的“移动障碍/摆锤/旋转杆”首批实现。

## 2026-04-14 20:42 (Asia/Shanghai)

- 任务：修复主题土地块视觉穿模（角色进入棕色地块时半身陷入）。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将主题区块底面从 `BoxGeometry` 改为 `PlaneGeometry`，避免厚度体块悬浮于地表导致“视觉穿模”。
  - 主题区块高度统一贴地（`FLOOR_SURFACE_Y - 0.002`），仅作为地表贴面，不再形成隐式台阶。
  - 同步把主题装饰体块基准高度改为 `FLOOR_SURFACE_Y + height * 0.5`，保证与地表关系一致。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：主题贴面与基础地面仍存在极小高度差，若后续加更强后处理可能出现轻微闪烁，可再加 polygonOffset 微调。
  - 下一步动作：你复测该棕色地块后，我继续做 P3 的移动障碍首批（摆锤）。

## 2026-04-14 20:45 (Asia/Shanghai)

- 任务：修复地表接缝处“仍有轻微穿模”的精度问题。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 地表层改为同一世界高度（`FLOOR_SURFACE_Y`），不再依赖上下错层避免 z-fighting。
  - 对基础地表、土地区贴面、主题区块贴面统一启用 `polygonOffset`，通过渲染偏移控制覆盖关系。
  - 主题区块贴面与地表完全同高，消除边界“视觉下陷”现象。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：若后续再新增多层地表材质，需沿用 polygonOffset 分级，避免再次产生接缝闪烁或错层。
  - 下一步动作：你复测该边界后，我继续 P3 的移动障碍首批实现。

## 2026-04-14 20:53 (Asia/Shanghai)

- 任务：继续推进 P3，落地高难挑战段首批动态障碍（摆锤）。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 2 组摆锤障碍（中段/高段各 1 组），包含锚点、绳索、摆锤体视觉。
  - 摆锤接入实时碰撞：每帧根据摆动角度刷新摆锤碰撞体包围盒，确保是“可碰撞障碍”而非纯装饰。
  - 动态障碍更新挂入主循环 simulation step，避免障碍与角色碰撞时序错位。
  - 清单中 P3 “加入移动障碍/摆锤/旋转杆”标记为已完成（首批摆锤落地）。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：动态障碍已可碰撞，但摆动参数仍需实机手感微调（速度/幅度/点位）。
  - 下一步动作：继续完成 P3 最后一项“主路线全段实跳可达性回归”，必要时按回归结果调摆锤参数。

## 2026-04-14 21:12 (Asia/Shanghai)

- 任务：修复中段关卡“后续上不去”的断链问题（用户截图箭头位置）。
- 改动文件：
  - `packages/climber-game/src/levels/togetherSkyAscent.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 对 `sp077 -> sp080` 段做局部重排，降低单跳跨度并形成连续过渡。
  - 微调 `sp077`（箱体）位置与尺寸，减少“卡视线 + 卡跳点”的压迫感。
  - 新增 `sp078`（stepping_stone）与 `sp079`（rock_slab）作为过渡踏点。
  - 将 `sp080` 调整到更接近主路线的落点位置，保证可顺接后续路线。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：该段已从“断链”修复为“连续可跳”，但仍需一次实跳确认在不同角色下都顺手。
  - 下一步动作：你实测通过后，我继续做 P3 的“全段实跳可达性回归”并据结果收口第 55 项。

## 2026-04-14 21:33 (Asia/Shanghai)

- 任务：为调试模式增加“物体头顶 instanceId（spid）标签”，便于按 ID 定位和改点位。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 碰撞体调试层新增标签渲染：在每个可调实例碰撞体上方显示 `instanceId`（如 `sp078`）。
  - 标签与碰撞调试同开关：开启碰撞体调试时显示，关闭时一并隐藏。
  - 补充标签资源释放逻辑（CanvasTexture / SpriteMaterial），避免调试频繁开关造成内存堆积。
  - 默认过滤 `floor` 与 `boundary-wall` 两个系统碰撞体标签，减少干扰。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：当调试标签数量过多时，画面信息密度会升高，但仅在调试模式下生效。
  - 下一步动作：你按标签直接报 `spid + 期望坐标`，我可以批量精准改位。

## 2026-04-14 21:42 (Asia/Shanghai)

- 任务：新增“调试专用模式”，仅在该模式显示 `spid`，并优化切焦点时的调试体验。
- 改动文件：
  - `packages/climber-game/src/types.ts`
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 controller 能力 `setDebugInstanceLabelsVisible`，用于独立控制实例 ID 标签显示。
  - `spid` 标签显示收口到“调试专用模式 + 碰撞体调试开启”条件，避免平时调试信息过载。
  - 调试专用模式下优化焦点切换：失去 Pointer Lock 后不再强制弹暂停大菜单，提供自动/一键恢复控制。
  - HUD 与菜单新增“调试专用模式”状态和开关。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：浏览器 Pointer Lock 仍受安全策略限制，自动恢复在部分环境可能被拦截；已提供手动恢复按钮兜底。
  - 下一步动作：你实测调试流程是否顺手；若还需，我可再加“固定显示 `spid` 跟随屏幕缩放/距离淡出”。

## 2026-04-14 22:06 (Asia/Shanghai)

- 任务：在调试专用模式中补充坐标轴方向说明（含正负方向）。
- 改动文件：
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 调试专用模式下新增 HUD 坐标方位面板，显示 `position: [x, y, z]` 以及 X/Y/Z 正负方向。
  - 增加快速改值提示（`x+` 右移、`y+` 抬高、`z-` 推远）。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：无功能风险，属于纯调试辅助信息增强。
  - 下一步动作：你按面板调整坐标后直接反馈 `spid + 目标方向`，我可批量改点位。

## 2026-04-14 22:11 (Asia/Shanghai)

- 任务：按用户要求升级调试专用模式，直接在物体六个方向面显示坐标轴标签。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在调试专用模式 + 碰撞体调试开启时，为每个实例碰撞体生成六面标签：`spid +X/-X/+Y/-Y/+Z/-Z`。
  - 保留顶部 `spid` 标签，同时新增面标签，便于直接按面方向改 `position[x,y,z]`。
  - 面标签按碰撞体当前旋转后的世界方向摆放，适配旋转物体。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：标签数量较多时画面信息密度提升，仅建议在定位点位时短时开启。
  - 下一步动作：你实测后若太拥挤，我可以再加“只显示当前焦点物体的六面标签”。

## 2026-04-14 22:32 (Asia/Shanghai)

- 任务：按用户反馈收敛调试标签密度，改为“人物周围 6 个方向便签”。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 移除“每个物体六面 +X/-X/+Y/-Y/+Z/-Z 标签”逻辑，避免满屏信息噪音。
  - 新增“人物周围 6 方向便签”（+X/-X/+Y/-Y/+Z/-Z），调试专用模式下跟随角色位置显示。
  - 保留物体顶部 `spid` 标签，用于定位具体实例。
  - `debugInstanceLabelsVisible` 改为由调试专用模式直接驱动，不再依赖碰撞调试开关。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：无功能风险，属于调试显示层优化。
  - 下一步动作：你按新便签体系继续调点位，我根据 `spid + 偏移方向` 帮你批量改坐标。

## 2026-04-14 23:40 (Asia/Shanghai)

- 任务：为 Unity 新项目建立专用 skill，明确与 Three.js 旧链路的过渡规则与任务清单。
- 改动文件：
  - `.codex/skills/unity-climber-iteration/SKILL.md`
  - `.codex/skills/unity-climber-iteration/agents/openai.yaml`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `AGENTS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新建 `unity-climber-iteration` skill，定义 Unity 迭代流程、提交边界、最小校验与输出要求。
  - 新增 Unity 任务清单模板，约束活跃 backlog 数量并沉淀过渡状态。
  - 在仓库 `AGENTS.md` 加入场景强制 skill：Unity Climber 迭代与 Three.js 过渡使用新 skill。
  - 修复新 skill `agents/openai.yaml` 的编码问题，统一为 UTF-8 可读内容。
- 校验：
  - `PYTHONUTF8=1 python C:\\Users\\A\\.codex\\skills\\.system\\skill-creator\\scripts\\quick_validate.py .codex/skills/unity-climber-iteration`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/unity-climber-iteration/SKILL.md .codex/skills/unity-climber-iteration/agents/openai.yaml .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md AGENTS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：无明显结构与编码风险。
  - 下一步动作：按新 skill 先推进 Unity P0（目录规范 + 首个可演示闭环 + 提交边界稳定）。

## 2026-04-14 23:48 (Asia/Shanghai)

- 任务：启动 Unity 主线第一轮可执行任务，解决“项目打开后场景空白”的起步问题。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Runtime/ClimberSceneBootstrap.cs`
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberPlayerController.cs`
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberFollowCamera.cs`
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberFinishTrigger.cs`
  - `apps/unity-climber/.gitignore`
  - `apps/unity-climber/README.md`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增运行时自动引导：空场景进入 Play 时自动生成地面、阶梯路线、玩家、相机跟随与终点触发。
  - 新增基础玩法脚本：第三人称移动/跳跃、相机跟随、终点触发日志。
  - 新增 `apps/unity-climber/.gitignore`，收敛 Unity 缓存与 IDE 噪音文件。
  - 新增 `apps/unity-climber/README.md`，给出快速启动、目录约定和提交边界。
  - 更新 Unity 任务清单：P0 三项落地完成，并补充下一步活跃项。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/unity-climber/README.md .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
  - `git status --short apps/unity-climber`：通过（结果：`?? apps/unity-climber/`，当前目录整体为新建未跟踪）
- 风险与后续：
  - 当前风险：尚未在 Unity Editor 实机播放验证，需要你本地点 Play 确认体感。
  - 下一步动作：先完成 Unity 内实测，确认后进入“手工正式场景替换自动铺场 + 最小 HUD”。

## 2026-04-14 23:55 (Asia/Shanghai)

- 任务：修复用户反馈的 Unity 场景空白与角色控制异常问题。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberPlayerController.cs`
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberFollowCamera.cs`
  - `apps/unity-climber/Assets/Scripts/Editor/ClimberSceneSetupEditor.cs`
  - `apps/unity-climber/README.md`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 修复地面检测：改为基于 `CapsuleCollider.bounds` 的 SphereCast，避免角色“无法起跳”。
  - 相机跟随偏移改为世界空间，减少 A/S/D 时“画面像在扭动”的感知。
  - 新增编辑器菜单 `Tools > Unity Climber > Setup Sample Scene`，支持在编辑模式一键创建并保存可玩原型。
  - README 新增快速排障说明（Game 视图焦点、菜单初始化步骤）。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/unity-climber/README.md .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：尚未在你本地 Unity Editor 实机验证输入焦点与跳跃手感。
  - 下一步动作：你按新菜单重建场景并 Play，我再根据实测继续调移动/相机参数。

## 2026-04-15 00:00 (Asia/Shanghai)

- 任务：按用户反馈移除“Play 时自动插入场景对象”的模式，回归 Unity 编辑器先搭建场景的默认工作流。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Runtime/ClimberSceneBootstrap.cs`
  - `apps/unity-climber/Assets/Scripts/Editor/ClimberSceneSetupEditor.cs`
  - `apps/unity-climber/README.md`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 删除运行时自动初始化入口，不再通过 `RuntimeInitializeOnLoadMethod` 在开始游戏时插入对象。
  - 将场景构建能力收敛为共享函数，由编辑器菜单 `Tools > Unity Climber > Setup Sample Scene` 主动触发并保存。
  - 文档明确更新为“先在编辑器插入并保存，再 Play”的流程。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/unity-climber/README.md .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`：通过
- 风险与后续：
  - 当前风险：由于未在本地 Unity Editor 直接运行，仍需你实机确认菜单生成与保存流程。
  - 下一步动作：你执行一次菜单生成并保存，我接着把“原型对象”替换成正式预制体结构。

## 2026-04-15 00:02 (Asia/Shanghai)

- 任务：按用户要求支持“直接在场景里创建模型”，减少手工步骤。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Editor/ClimberSceneSetupEditor.cs`
  - `apps/unity-climber/README.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增编辑器自动初始化：首次打开 `SampleScene.scene` 且场景为空时，自动创建原型对象并保存场景。
  - 新增菜单 `Tools > Unity Climber > Setup Sample Scene And Save`，支持一键重建并保存。
  - README 同步为“自动初始化 + 可手动重建”的流程说明。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/unity-climber/README.md apps/unity-climber/Assets/Scripts/Editor/ClimberSceneSetupEditor.cs`：通过
- 风险与后续：
  - 当前风险：自动初始化逻辑当前只针对 `SampleScene.scene`，其他场景不会自动处理。
  - 下一步动作：若你需要，我可以加“仅在用户确认后自动生成”的开关，避免误改场景。

## 2026-04-15 00:16 (Asia/Shanghai)

- 任务：按用户硬性要求切换为“Scene 直接建模”，禁止 Play 时脚本生成场景对象。
- 改动文件：
  - `apps/unity-climber/Assets/Scenes/SampleScene.scene`
  - `apps/unity-climber/Assets/Scripts/Editor/ClimberSceneSetupEditor.cs`（删除）
  - `apps/unity-climber/Assets/Scripts/Runtime/ClimberSceneBootstrap.cs`（删除）
  - `apps/unity-climber/Assets/Scripts/Runtime/ClimberSceneBootstrap.cs.meta`（删除）
  - `apps/unity-climber/README.md`
  - `.codex/skills/unity-climber-iteration/SKILL.md`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 直接在 `SampleScene.scene` 写入可见对象：`Ground`、`StartPlatform`、`Step_01~03`、`Player`、`FinishPlatform`、`FinishTrigger`。
  - 直接在 Scene 里挂载玩家控制、相机跟随、终点触发组件，不再依赖运行时建场景。
  - 删除 Editor/Runtime 建场脚本入口，避免后续继续走“脚本生成场景”的路线。
  - 在 `unity-climber-iteration` skill 中新增硬约束：Scene 模型必须直接写入 scene，禁止 Play 时脚本生成作为默认交付。
- 校验：
  - `rg -n "ClimberSceneBootstrap|Setup Sample Scene|RuntimeInitializeOnLoadMethod" apps/unity-climber`：通过（无匹配）
  - `rg -n "m_Name: (Ground|Player|StartPlatform|Step_01|FinishPlatform|FinishTrigger)" apps/unity-climber/Assets/Scenes/SampleScene.scene`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/unity-climber/README.md .codex/skills/unity-climber-iteration/SKILL.md .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`：通过
- 风险与后续：
  - 当前风险：`SampleScene.scene` 为手工 YAML 落地，需你在 Unity 中打开一次确认组件序列化无告警。
  - 下一步动作：你打开场景验证通过后，我再按同样规则继续补更多关卡模型与布局。

## 2026-04-15 00:21 (Asia/Shanghai)

- 任务：按用户要求正式启动 Unity 任务清单，并把“对齐《攀爬动物：在一起》”写入 skill 硬约束。
- 改动文件：
  - `.codex/skills/unity-climber-iteration/SKILL.md`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 skill 中新增“核心产品定位（必须对齐）”：目标与《攀爬动物：在一起》一致，所有改动服务向上攀爬主循环。
  - 将任务清单升级为 P0~P5 版本路线，替换为当前可执行活跃项（P1-01、P1-02、P2-01、P3-01）。
  - 明确看板状态：Unity 主线为“可演示”，产品对齐状态为“对齐核心攀爬循环”。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/unity-climber-iteration/SKILL.md .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`：通过
- 风险与后续：
  - 当前风险：P1 活跃任务尚未开始落地到场景对象。
  - 下一步动作：下一轮直接执行 P1-01（在 Scene 内补 Step_04~Step_10 与终点缓冲平台）。

## 2026-04-15 00:34 (Asia/Shanghai)

- 任务：执行 P1-01，直接在 Scene 中补齐可达主路线（Step_04~Step_10 + 终点缓冲平台）。
- 改动文件：
  - `apps/unity-climber/Assets/Scenes/SampleScene.scene`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 `SampleScene.scene` 直接新增 `Step_04` 到 `Step_10` 与 `FinishBuffer`，并写入 `SceneRoots`，打开场景即可在 Hierarchy 看到。
  - 修正 Scene 中三个核心组件的脚本引用与参数：`ClimberPlayerController`、`ClimberFollowCamera`、`ClimberFinishTrigger`。
  - 任务清单中将 `P1-01` 标记为完成。
- 校验：
  - `rg -n "m_Name: (Step_0[1-9]|Step_10|FinishBuffer|FinishPlatform|FinishTrigger|Player)" apps/unity-climber/Assets/Scenes/SampleScene.scene`：通过
  - `rg -n "&200000107|&200005106|&963194229|m_Script:" apps/unity-climber/Assets/Scenes/SampleScene.scene`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：`SampleScene.scene` 为手工 YAML 更新，仍需在 Unity Editor 打开一次确认无 Missing Script/序列化告警。
  - 下一步动作：你验收 P1-01 后，我直接进入 `P1-02`（Checkpoint_01）。

## 2026-04-15 00:39 (Asia/Shanghai)

- 任务：修复“player 不能移动/跳跃”并继续执行 P1-02（Checkpoint_01）。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberPlayerController.cs`
  - `apps/unity-climber/Assets/Scenes/SampleScene.scene`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 玩家控制增加键位硬兜底：`W/A/S/D + 方向键 + Space` 可直接驱动移动与跳跃，不依赖轴配置稳定性。
  - 明确强制 `Rigidbody` 为可受力状态（`useGravity=true`、`isKinematic=false`），降低场景序列化差异导致不可动风险。
  - 在 Scene 中新增 `Checkpoint_01`（直接落在 `SampleScene.scene`），并在玩家脚本中加入跌落自动回到检查点逻辑。
  - 将任务清单 `P1-02` 标记为完成。
- 校验：
  - `rg -n "m_Name: (Checkpoint_01|Step_0[1-9]|Step_10|FinishBuffer|Player)" apps/unity-climber/Assets/Scenes/SampleScene.scene`：通过
  - `rg -n "m_Script: \\{fileID: 11500000" apps/unity-climber/Assets/Scenes/SampleScene.scene`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`：通过
- 风险与后续：
  - 当前风险：未在本地 Unity Editor 实际按键验证，仍需你在 `Game` 视图焦点下实测。
  - 下一步动作：你确认移动/跳跃恢复后，我继续做 `P2-01`（最小调参面板）。

## 2026-04-15 00:44 (Asia/Shanghai)

- 任务：继续修复玩家可控性并完成 P2-01 最小调参面板。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberPlayerController.cs`
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberFollowCamera.cs`
  - `apps/unity-climber/Assets/Scenes/SampleScene.scene`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将脚本语法降级为 Unity 兼容的保守写法（移除 `null!` 与目标类型 `new(...)`），降低编译失败导致脚本不运行的风险。
  - 调整 Player 初始高度到 `y=2`，避免胶囊体嵌入起始平台造成“看起来不能移动”。
  - `ClimberFollowCamera` 新增 offset 读写接口，用于运行时调参。
  - `ClimberPlayerController` 新增最小调参面板（`F2` 开关），支持移动速度、跳跃力、相机高度/距离实时调节。
  - 任务清单 `P2-01` 标记完成。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md apps/unity-climber/Assets/Scripts/Gameplay/ClimberPlayerController.cs apps/unity-climber/Assets/Scripts/Gameplay/ClimberFollowCamera.cs`：通过
- 风险与后续：
  - 当前风险：仍需你在 Unity Editor 中实测确认 Console 无编译错误。
  - 下一步动作：你确认角色可动后，我继续 `P3-01`（最小 HUD：高度、进度、重开提示）。

## 2026-04-15 00:49 (Asia/Shanghai)

- 任务：修复场景里 `None (Mono Script)` 绑定丢失问题。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberPlayerController.cs.meta`
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberFollowCamera.cs.meta`
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberFinishTrigger.cs.meta`
  - `apps/unity-climber/Assets/Scenes/SampleScene.scene`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将三个 gameplay 脚本的 `.meta guid` 从异常格式改为 Unity 标准 32 位十六进制 guid。
  - 同步替换 `SampleScene.scene` 中三处 `m_Script.guid` 到新 guid，恢复脚本引用链路。
- 校验：
  - `rg -n "m_Script:" apps/unity-climber/Assets/Scenes/SampleScene.scene`：通过（3 处 guid 已替换）
  - `rg -n "C3oWsS3|D3hKtiir|Bn8ctyOl" apps/unity-climber/Assets/Scripts apps/unity-climber/Assets/Scenes/SampleScene.scene`：通过（无残留）
- 风险与后续：
  - 当前风险：需 Unity 重新导入资源后才会在 Inspector 反映最新绑定状态。
  - 下一步动作：你执行一次 Reimport/重开工程后验证 Player 与 Main Camera 脚本组件是否恢复。

## 2026-04-15 20:11 (Asia/Shanghai)

- 任务：切换到 P4 资产替换准备，先落规范与目录骨架（不改玩法逻辑）。
- 改动文件：
  - `apps/unity-climber/ASSET_PIPELINE.md`
  - `apps/unity-climber/README.md`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `ASSET_PIPELINE.md`，定义模型/材质/预制体/音频目录、命名规范、尺寸与碰撞基线、首批替换目标和下载清单。
  - 建立资产目录骨架：`Assets/Models/*`、`Assets/Materials`、`Assets/Prefabs/*`、`Assets/Audio/*`（含占位文件）。
  - 任务清单将 `P4-01` 标记完成，并切换下一步为 `P4-02/P4-03`。
  - 明确当前策略：先推进 Unity 主线，暂不处理 threejs/web 迁移决策。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/unity-climber/ASSET_PIPELINE.md apps/unity-climber/README.md .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`：通过
  - 目录检查：`Get-ChildItem -Recurse apps/unity-climber/Assets/Models,apps/unity-climber/Assets/Materials,apps/unity-climber/Assets/Prefabs,apps/unity-climber/Assets/Audio`：通过
- 风险与后续：
  - 当前风险：首批替换所需模型与音频资源尚未入库，P4-02/P4-03 仍阻塞。
  - 下一步动作：你先准备最小资源包（角色 1~2、台阶/平台 3~5、终点装置 1、SFX 4 条），我收到后立即开始替换接入。

## 2026-04-15 20:35 (Asia/Shanghai)

- 任务：在模型已入库后推进 P4-02 的首批替换执行路径（保持 Scene 持久化落地）。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Editor/ClimberAssetSwapEditor.cs`
  - `apps/unity-climber/ASSET_PIPELINE.md`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 Unity Editor 菜单工具 `Tools > Unity Climber > Apply P4 First Asset Swap`，用于一次性替换 `Step_01~03 + FinishBuffer` 并保存场景。
  - 工具默认映射：`Step_01->stepping_stone`、`Step_02->rock_slab`、`Step_03->plank_long`、`FinishBuffer->container_short`。
  - 对无碰撞模型自动补 `BoxCollider`，避免替换后角色穿透。
  - 资产规范文档补充了具体执行步骤，任务清单将 P4-02 改为“执行替换工具”动作项。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/unity-climber/ASSET_PIPELINE.md .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md apps/unity-climber/Assets/Scripts/Editor/ClimberAssetSwapEditor.cs`：通过
- 风险与后续：
  - 当前风险：替换动作需要在 Unity Editor 中手动点击菜单执行一次。
  - 下一步动作：你执行菜单后，我继续做 P4-03 音效接入（等待音频资源）。

## 2026-04-15 20:41 (Asia/Shanghai)

- 任务：响应用户“直接在 Player 上换角色模型”的要求，补充一键替换工具。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Editor/ClimberAssetSwapEditor.cs`
  - `apps/unity-climber/ASSET_PIPELINE.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增菜单：
    - `Tools > Unity Climber > Apply Player Model > Peach`
    - `Tools > Unity Climber > Apply Player Model > Daisy`
  - 替换逻辑在编辑器中直接操作 Scene：将角色模型作为 `Player` 子对象挂载，保留 Player 的 Rigidbody/Collider/控制脚本。
  - 自动关闭 Player 原始胶囊体可视网格，避免模型与胶囊重叠显示。
  - 执行后自动保存场景，确保结果是 Scene 持久化对象。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/unity-climber/Assets/Scripts/Editor/ClimberAssetSwapEditor.cs apps/unity-climber/ASSET_PIPELINE.md`：通过
- 风险与后续：
  - 当前风险：模型骨骼与原点可能存在个体差异，`localPosition` 可能需要小幅微调。
  - 下一步动作：你在 Unity 点菜单实测后告诉我偏移量，我再把默认位置参数固化到工具里。

## 2026-04-15 20:43 (Asia/Shanghai)

- 任务：按用户要求将 Player 角色默认设为 Peach，避免每次手动点击替换按钮。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Editor/ClimberAssetSwapEditor.cs`
  - `apps/unity-climber/ASSET_PIPELINE.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将角色替换工具改为 `InitializeOnLoad` 自动流程：打开 `SampleScene` 且 Player 尚无可视角色时，自动绑定 `peach.glb` 并保存场景。
  - 仍保留手动菜单（Peach/Daisy）作为覆盖入口。
  - 资产规范文档同步说明“默认自动绑定 Peach”。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/unity-climber/Assets/Scripts/Editor/ClimberAssetSwapEditor.cs apps/unity-climber/ASSET_PIPELINE.md`：通过
- 风险与后续：
  - 当前风险：自动绑定仅在 `SampleScene` 生效，其他场景不会自动处理。
  - 下一步动作：你重开 `SampleScene` 确认 Peach 自动挂载后，我继续推进 P4-03 音效接入。

## 2026-04-15 21:10 (Asia/Shanghai)

- 任务：响应用户“必须直接改 Scene”的要求，排查默认 Peach 绑定失败原因并清理临时文件。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Editor/ClimberAssetSwapEditor.cs`
  - `apps/unity-climber/Packages/manifest.json`
  - `apps/unity-climber/Assets/Scenes/SampleScene.unity`（删除）
  - `apps/unity-climber/Assets/Scenes/SampleScene.unity.meta`（删除）
  - `.codex/skills/unity-climber-iteration/SKILL.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 去除自动触发方向，保留仅编辑器执行的方法，避免“打开场景自动脚本改动”。
  - 修复 `manifest.json` 无效依赖：移除 `com.unity.modules.infinity`。
  - 排查日志确认当前阻塞：`peach.glb` 在项目中无法作为 `GameObject` 资产加载（`DefaultImporter`），因此无法直接绑定到 Scene。
  - 清理临时 `SampleScene.unity` 文件，回归单一 `SampleScene.scene` 工作流。
  - 在 skill 增加“模型导入前置检查”：`.glb` 必须先有可用导入器。
- 校验：
  - `tmp/unity-bind-peach.log` 关键日志：`[unity-climber] 角色模型未找到: Assets/Models/Characters/peach.glb`
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/unity-climber-iteration/SKILL.md .codex/logs/CHANGE-LOG.md`：未执行（下一步执行）
- 风险与后续：
  - 当前风险：在 glTF 导入器可用前，仍无法把 `.glb` 角色直接落入 Scene。
  - 下一步动作：二选一推进：安装 glTF 导入器，或让用户改提供 FBX 再直接写入 Scene。

## 2026-04-15 21:14 (Asia/Shanghai)

- 任务：将“直接改 Scene”行为写为不可绕过的强制约束，避免同类问题再次出现。
- 改动文件：
  - `.codex/skills/unity-climber-iteration/SKILL.md`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 skill 中新增“强制阻断规则（不可绕过）”：用户要求直接改 Scene 时，禁止运行时生成、自动触发绑定、按钮替代交付。
  - 强制前置检查：模型必须 `LoadAssetAtPath<GameObject>() != null`；不满足即中止该路径并切换到导入修复/格式切换。
  - 在任务清单每轮检查里加入同样阻断检查项，要求显式验证后才能执行 Scene 绑定。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/unity-climber-iteration/SKILL.md .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`：通过
- 风险与后续：
  - 当前风险：无新增实现风险，约束已落地。
  - 下一步动作：后续涉及模型绑定任务时，先跑可加载性检查，再决定是否进入 Scene 改动。

## 2026-04-15 21:28 (Asia/Shanghai)

- 任务：继续推进 glTF 导入修复，消除 `.glb` 被 `DefaultImporter` 锁死的问题。
- 改动文件：
  - `apps/unity-climber/Packages/manifest.json`
  - `apps/unity-climber/Assets/Models/Characters/peach.glb.meta`
  - `apps/unity-climber/Assets/Models/Characters/daisy.glb.meta`
  - `apps/unity-climber/Assets/Models/Setpieces/stepping_stone.glb.meta`
  - `apps/unity-climber/Assets/Models/Setpieces/rock_slab.glb.meta`
  - `apps/unity-climber/Assets/Models/Setpieces/plank_long.glb.meta`
  - `apps/unity-climber/Assets/Models/Setpieces/container_short.glb.meta`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 安装 glTF 包依赖：`com.unity.cloud.gltfast@5.2.0`。
  - 对关键 `.glb` 重建 `.meta`，显式指定 `ScriptedImporter`（脚本 guid 指向 glTFast 的 `GltfImporter`）。
  - 目标是让角色和首批关卡模型都能被当成可绑定的 `GameObject` 资产。
- 校验：
  - 关键 `.meta` 检查：`script: {fileID: 11500000, guid: 715df9372183c47e389bb6e19fbc3b52, type: 3}`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/logs/CHANGE-LOG.md`：未执行（下一步执行）
- 风险与后续：
  - 当前风险：当前终端会话无法稳定定位 Unity 可执行路径，尚未完成批处理重导与 Scene 直绑 peach。
  - 下一步动作：拿到可执行路径后，立即重导资源并直接把 `PlayerVisual_Peach` 写入 `SampleScene.scene`。

## 2026-04-16 21:22 (Asia/Shanghai)

- 任务：按用户硬要求完成“直接改 Scene”，将 Peach 模型绑定到 Player（非运行时脚本触发）。
- 改动文件：
  - `apps/unity-climber/Assets/Scenes/SampleScene.scene`
  - `apps/unity-climber/Assets/Scenes/SampleScene.unity`（删除）
  - `apps/unity-climber/Assets/Scenes/SampleScene.unity.meta`（删除）
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 通过 Unity Editor 批处理完成模型实例绑定，`Player` 下新增 `PlayerVisual_Peach` 预制实例。
  - `Player` 自身胶囊网格已隐藏（`MeshRenderer` 关闭，`MeshFilter.m_Mesh` 置空），避免白色胶囊可视化。
  - 最终结果已回写到正式 `SampleScene.scene`，并清理临时 `.unity` 文件，保持单一 Scene 文件交付。
- 校验：
  - `tmp/unity-bind-peach.log`：包含 `Player 角色外观已替换并保存: PlayerVisual_Peach`
  - `rg -n "PlayerVisual_Peach|m_Mesh: {fileID: 0}|m_Enabled: 0" apps/unity-climber/Assets/Scenes/SampleScene.scene`：通过
- 风险与后续：
  - 当前风险：无运行时替换依赖，主要风险已解除。
  - 下一步动作：你在 Unity 打开 `SampleScene` 目视确认 Peach 模型显示；确认后继续 P4-02 场景模块替换。

## 2026-04-15 00:51 (Asia/Shanghai)

- 任务：把“脚本丢失绑定（None Mono Script）”问题沉淀进技能规则，防止后续复发。
- 改动文件：
  - `.codex/skills/unity-climber-iteration/SKILL.md`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 skill 中新增“脚本绑定防呆（必须检查）”章节，明确 `.meta guid` 格式、scene 引用一致性与重导验证步骤。
  - 在任务清单“每轮提交前检查”里加入 Inspector 抽查项：`Player/Camera/FinishTrigger` 不能出现 `None (Mono Script)`。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/unity-climber-iteration/SKILL.md .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：规则已落地，但仍需在下一轮实操中按检查项执行并闭环。
  - 下一步动作：继续当前 Unity 任务，先确认脚本绑定恢复再推进 P3-01。

## 2026-04-15 19:57 (Asia/Shanghai)

- 任务：按用户确认执行 P3-01，仅推进 Unity 主线任务（暂不处理 `packages/climber-game`）。
- 改动文件：
  - `apps/unity-climber/Assets/Scripts/Gameplay/ClimberPlayerController.cs`
  - `.codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增最小 HUD：显示高度（Height）、进度（Progress）和重开提示（Restart 键）。
  - 新增重开逻辑：按 `R` 重置到 `Checkpoint_01`（无 checkpoint 时回初始出生点）。
  - 进度算法接入 `StartPlatform -> FinishPlatform` 的 `z` 轴比例，输出百分比。
  - 保持现有调参面板（`F2`）并与 HUD 共存。
  - 任务清单将 `P3-01` 标记为完成。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/unity-climber/Assets/Scripts/Gameplay/ClimberPlayerController.cs .codex/skills/unity-climber-iteration/references/UNITY-CLIMBER-TASKS.md`：通过
- 风险与后续：
  - 当前风险：HUD 采用 `OnGUI` 最小实现，样式较基础，后续可替换为 Canvas 版。
  - 下一步动作：在 Unity 中确认脚本绑定恢复后，验证 `WASD/Space/R/F2` 全链路并进入 P4 资产替换准备。

## 2026-04-15 11:16 (Asia/Shanghai)

- 任务：按协作约定拆分 Web 与 Climber 的任务边界，避免 `web-feature-iteration` 与 `climber-game` 混用。
- 改动文件：
  - `.codex/skills/web-feature-iteration/SKILL.md`
  - `.codex/skills/web-feature-iteration/agents/openai.yaml`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/skills/climber-game-design-guard/SKILL.md`
  - `.codex/skills/climber-game-design-guard/references/CLIMBER-GAME-TASKS.md`（由旧路径迁移）
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - `web-feature-iteration` 新增强边界：仅负责 `apps/web` 产品功能，不再承载 `packages/climber-game` 与 `apps/unity-climber`。
  - 新增 `.codex/skills/web-feature-iteration/WEB-TASKS.md`，作为 Web 活跃 backlog 的唯一入口。
  - 将 `CLIMBER-GAME-TASKS.md` 迁移到 `climber-game-design-guard/references/`，把 climber 迭代清单从 Web skill 目录解耦。
  - 更新 `climber-game-design-guard`：明确“climber 仅挂载于 web 入门，不并入 Web 产品 backlog”，并改用新任务清单路径。
  - 更新 `web-feature-iteration/agents/openai.yaml` 的默认提示词，强制排除 climber/unity 范围。
- 校验：
- `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/web-feature-iteration/SKILL.md .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/skills/web-feature-iteration/agents/openai.yaml .codex/skills/climber-game-design-guard/SKILL.md .codex/skills/climber-game-design-guard/references/CLIMBER-GAME-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：历史日志里仍保留旧路径引用（用于历史追溯），不影响当前新规则执行。
  - 下一步动作：后续盘点 Web 任务时只读取 `WEB-TASKS.md`，盘点 climber 任务时只读取 `climber-game-design-guard/references/CLIMBER-GAME-TASKS.md`。

## 2026-04-15 11:22 (Asia/Shanghai)

- 任务：进一步拆分 `packages/climber-game` 与 `apps/unity-climber` 的 skill 与目录职责，形成并列迭代链路。
- 改动文件：
  - `.codex/skills/climber-game-iteration/SKILL.md`（新增）
  - `.codex/skills/climber-game-iteration/agents/openai.yaml`（新增）
  - `.codex/skills/climber-game-iteration/references/CLIMBER-GAME-TASKS.md`（从旧目录迁移）
  - `.codex/skills/climber-game-design-guard/SKILL.md`
  - `.codex/skills/INDEX.md`
  - `AGENTS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `climber-game-iteration` skill，专门负责 `packages/climber-game` 的活跃 backlog 与任务切换。
  - 将 `CLIMBER-GAME-TASKS.md` 迁移到 `climber-game-iteration/references/`，不再挂在 `web-feature-iteration` 或 `design-guard` 目录。
  - `climber-game-design-guard` 收口为“玩法与边界护栏”，迭代清单职责交由 `climber-game-iteration`。
  - 更新 `AGENTS.md` 场景强制 skills：单列 `climber-game-iteration` 与 `unity-climber-iteration`，与 Web 迭代分离。
  - 更新 `skills/INDEX.md`：新增 `climber-game-iteration` 说明，并替换 climber 组合触发建议。
- 校验：
- `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/climber-game-iteration/SKILL.md .codex/skills/climber-game-iteration/agents/openai.yaml .codex/skills/climber-game-iteration/references/CLIMBER-GAME-TASKS.md .codex/skills/climber-game-design-guard/SKILL.md .codex/skills/INDEX.md AGENTS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：历史日志中的旧路径保留用于追溯，不代表当前规则。
  - 下一步动作：后续 Web/Climber/Unity 盘点时按三份独立清单读取，禁止交叉维护。

## 2026-04-15 11:39 (Asia/Shanghai)

- 任务：新增独立 `skill-category-guard`，用于新建/迁移 skill 时的分类与索引同步。
- 改动文件：
  - `.codex/skills/skill-category-guard/SKILL.md`（新增）
  - `.codex/skills/skill-category-guard/agents/openai.yaml`（新增）
  - `.codex/skills/INDEX.md`
  - `.codex/skills/skill-sync-guard/SKILL.md`
  - `AGENTS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新建 `skill-category-guard`，明确 `general/web/climber/unity` 分类规则与落地流程。
  - 在新 skill 前言中加入 `category: general`，示范新增 skill 的分类写法。
  - 在 `INDEX.md` 的“技能体系自身”章节补充 `skill-category-guard` 的触发条件与边界。
  - 在 `skill-sync-guard` 中加入联动规则：新增或迁移 skill 时同步走分类护栏。
  - 在 `AGENTS.md` 场景强制 skills 中补充 `skill-category-guard`。
- 校验：
- `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/skill-category-guard/SKILL.md .codex/skills/skill-category-guard/agents/openai.yaml .codex/skills/INDEX.md .codex/skills/skill-sync-guard/SKILL.md AGENTS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：历史 skill 还未批量补齐 `category` 字段，当前先对新增 skill 强约束。
  - 下一步动作：后续如需，可增补一轮“存量 skills 分类补全”。

## 2026-04-15 11:42 (Asia/Shanghai)

- 任务：补齐存量 skills 的 `category` 字段，统一到 `general/web/climber/unity` 四分类。
- 改动文件：
  - `.codex/skills/*/SKILL.md`（批量补充 `category`）
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 为全部存量 `SKILL.md` 增加 `category` 前言字段（新增 skill 已含该字段的保持不变）。
  - 分类结果：`general=13`、`web=9`、`climber=2`、`unity=1`。
  - 以后新增 skill 可直接按 `skill-category-guard` 要求沿用同一分类结构。
- 校验：
  - `rg -n "^category:" .codex/skills/*/SKILL.md -S`：通过（全量命中）
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/*/SKILL.md AGENTS.md .codex/skills/INDEX.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：个别跨域 skill 的主分类仍可能随后续职责变化而调整。
  - 下一步动作：若你希望，我可以再加一个轻量校验脚本，阻止“新 skill 缺 category”进入提交。

## 2026-04-15 14:20 (Asia/Shanghai)

- 任务：盘点 Web 未完成项并将 `WEB-TASKS.md` 从占位更新为可执行活跃 backlog。
- 改动文件：
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将 `WEB-TASKS.md` 的占位项替换为 5 项可执行任务，聚焦“已有能力未闭环”。
  - 任务覆盖：`/ai-chat` 页面闭环、Blog 列表关键词搜索、创作者广场搜索分页、通知中心详情跳转、首页空态运营引导。
  - 更新“下一步建议”为优先落地 AI Chat 闭环（API 已有、页面未接）。
- 校验：
- `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：任务来自代码结构与接口现状盘点，未做用户侧优先级访谈。
  - 下一步动作：按 backlog 第 1 项开始实现 `/ai-chat` 页面与路由入口。

## 2026-04-15 14:28 (Asia/Shanghai)

- 任务：按用户要求移除 Web 端 `/ai-chat` 残留，并完成 Blog 列表关键词搜索闭环。
- 改动文件：
  - `apps/web/src/App.tsx`
  - `apps/web/src/pages/blog/BlogList/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 删除 `RouteTitle` 中 `/ai-chat` 标题分支，清理 Web 端残留入口语义。
  - `BlogList` 新增关键词搜索输入，支持回车/按钮触发搜索，并与 URL 参数 `keyword` 联动。
  - `getPosts` 请求接入 `keyword`，实现“搜索词 + 分组 + 排序 + 分页”联动。
  - 新增“清除搜索”操作与搜索词回显，空列表时按关键词给出定向提示文案。
  - 更新 `WEB-TASKS`：移除 AI Chat 任务并记为已完成，保持 Blog 搜索任务为当前活跃项。
- 校验：
  - `rg -n "ai-chat|AI Chat" apps/web/src -S`：通过（无匹配）
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx apps/web/src/App.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：Blog 搜索目前仅覆盖标题/摘要关键词（由后端接口决定），暂未扩展更多维度筛选。
  - 下一步动作：按清单继续推进“创作者广场搜索+分页”或“通知中心详情跳转”。

## 2026-04-15 14:48 (Asia/Shanghai)

- 任务：完成“创作者广场列表闭环”（热门默认 + 关键词搜索 + 分页）。
- 改动文件：
  - `apps/web/src/api/creator.ts`
  - `apps/web/src/pages/Creator/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `searchPublicCreators` API，调用 `/public/creators` 并支持 `keyword/page/pageSize`。
  - `Creator` 页面从“固定热门首屏”升级为“可搜索 + 可分页”列表：
    - 新增关键词输入、回车/按钮触发搜索、清除搜索。
    - 列表请求接入分页与关键词参数。
    - 增加分页操作（上一页/下一页/页码展示）。
    - 空状态文案按关键词动态提示（未命中时给出定向反馈）。
  - 更新 Web 活跃清单：将“博客列表搜索闭环”“创作者广场列表闭环”移入已完成，并补充“创作者广场体验增强”后续项。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Creator/index.tsx apps/web/src/api/creator.ts .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：当前搜索词/分页状态尚未写入 URL 参数，刷新页面会回到默认首屏。
  - 下一步动作：如你确认，我下一步补 `keyword/page` URL 联动与无刷新重试。

## 2026-04-15 14:55 (Asia/Shanghai)

- 任务：完成“通知中心动作闭环”（查看详情跳转 + 跳转前自动已读）。
- 改动文件：
  - `apps/web/src/utils/notification.ts`
  - `apps/web/src/pages/Notifications/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `resolveNotificationTarget`：按 `extraData/type` 解析跳转目标（博客、资源、创作者、申请页）。
  - 通知列表新增“查看详情”按钮：有目标时可点击，无目标时置灰。
  - 点击“查看详情”时先调用已读接口，再执行页面跳转，保证通知状态与行为一致。
  - `handleMarkOneRead` 返回布尔结果，作为“跳转前已读成功”门槛。
  - 更新 `WEB-TASKS`：该项标记完成，并补一条后续增强项（更多类型映射 + 跳转失败兜底提示）。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Notifications/index.tsx apps/web/src/utils/notification.ts .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：当前后端通知类型主要是 `creator_application_review`，更多类型需后端扩展后再补映射。
  - 下一步动作：继续做“首页空态运营闭环”或“创作者广场 URL 参数联动”。

## 2026-04-15 15:01 (Asia/Shanghai)

- 任务：完成“首页空态运营闭环”，将占位式空态改为可执行引导。
- 改动文件：
  - `apps/web/src/pages/Home/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 创作者雷达空态：按角色切换文案与 CTA，提供“查看创作者页 / 申请成为创作者 / 去完善创作空间”。
  - 资源风暴墙空态：按角色切换文案与 CTA，提供“去看资源页 / 去上传我的资源 / 去看创作者页”。
  - 内容更新信号站空态：按角色切换文案与 CTA，提供“去看内容页 / 去发布新内容 / 去看创作者更新”。
  - 替换首页“之后这里会…”类占位表达为面向当前状态的运营引导表达。
  - 更新 `WEB-TASKS`：该项移入已完成，并补充下一步“首页运营信号增强”任务。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/index.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：空态 CTA 尚未带来源埋点，无法直接量化入口转化。
  - 下一步动作：继续“创作者广场 URL 参数联动”或“首页空态 CTA 埋点”。

## 2026-04-15 15:09 (Asia/Shanghai)

- 任务：继续完善创作者广场，补齐 URL 参数联动与无刷新重试。
- 改动文件：
  - `apps/web/src/pages/Creator/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - `/creators` 页面改为 URL 驱动状态：`keyword` 与 `page` 由 `useSearchParams` 管理。
  - 搜索、清空、分页操作统一更新 URL 参数，刷新后可保留当前浏览上下文。
  - 新增输入框与 URL 同步逻辑：地址栏参数变化时自动回填搜索输入框。
  - 错误态“重新加载”从 `window.location.reload()` 改为无刷新重试（本页重拉接口）。
  - 更新 `WEB-TASKS`：将“创作者广场体验增强”标记完成，并刷新下一项建议。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Creator/index.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：搜索词目前未做高亮或热词推荐，首屏发现效率仍可继续优化。
  - 下一步动作：继续“通知中心体验增强”（跳转失败兜底 + 扩展通知类型映射）。

## 2026-04-15 15:37 (Asia/Shanghai)

- 任务：继续完成“通知中心体验增强”，补跳转兜底与通知类型映射扩展。
- 改动文件：
  - `apps/web/src/utils/notification.ts`
  - `apps/web/src/pages/Notifications/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 扩展通知目标解析：支持 `redirectUrl/path/postSlug/resourceSlug/creatorId` 等 `extraData` 字段。
  - 新增按通知类型关键词兜底映射：`blog/resource/creator` 类型可回退到对应列表页。
  - 通知页“查看详情”新增失败兜底提示：
    - 无可跳转目标时给信息提示。
    - 标记已读失败时给错误提示并中止跳转。
  - 更新 `WEB-TASKS`：将“通知中心体验增强”标记完成，并补下一条细化增强任务。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Notifications/index.tsx apps/web/src/utils/notification.ts .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：通知目标映射仍依赖后端 `extraData/type` 约定，若字段命名变更需同步调整解析逻辑。
  - 下一步动作：继续“首页运营信号增强”（CTA 来源标记与轻量埋点）。

## 2026-04-15 15:45 (Asia/Shanghai)

- 任务：将“列表页 keyword/page URL 联动”沉淀为可复用 skill，并纳入 Web 活跃迭代清单。
- 改动文件：
  - `.codex/skills/web-url-state-sync/SKILL.md`
  - `.codex/skills/web-url-state-sync/agents/openai.yaml`
  - `.codex/skills/INDEX.md`
  - `AGENTS.md`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `web-url-state-sync`（`category: web`），统一 keyword/page 与 URL 查询参数联动规则、实现顺序与校验项。
  - 在 skills 索引新增该 skill 的触发条件与边界说明，便于后续按场景快速命中。
  - 在 `AGENTS.md` 场景强制 skills 中补充 Web URL 联动专项规则。
  - 在 Web 活跃 backlog 新增“其余页面补齐 keyword/page URL 联动”任务，作为后续推进入口。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/web-url-state-sync/SKILL.md .codex/skills/INDEX.md AGENTS.md .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：其他列表页尚未逐页落地 URL 联动，仍可能存在刷新/回退状态不一致。
  - 下一步动作：按 `WEB-TASKS.md` 新增项逐页补齐，并在每页完成后更新清单与日志。

## 2026-04-15 16:21 (Asia/Shanghai)

- 任务：批量补齐 Web 列表页 `keyword/page` 与 `page` 的 URL 联动，统一刷新恢复与前进/后退行为。
- 改动文件：
  - `apps/web/src/pages/Resources/index.tsx`
  - `apps/web/src/pages/CreatorProfile/index.tsx`
  - `apps/web/src/pages/ResourceAlbumManage/index.tsx`
  - `apps/web/src/pages/ResourceTagManage/index.tsx`
  - `apps/web/src/pages/Notifications/index.tsx`
  - `apps/web/src/pages/Favorites/index.tsx`
  - `apps/web/src/pages/Downloads/index.tsx`
  - `apps/web/src/pages/Follows/index.tsx`
  - `apps/web/src/pages/Guestbook/index.tsx`
  - `apps/web/src/pages/MyResources/index.tsx`
  - `apps/web/src/pages/MyPosts/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - `Resources / CreatorProfile / ResourceAlbumManage / ResourceTagManage`：将 `keyword/page` 从本地 state 收敛到 URL 查询参数，搜索/清除/分页统一更新 query。
  - `Notifications / Downloads / Follows / Guestbook`：将“加载更多”页码写入 URL；刷新时按 URL 页码回放加载，保证回退与分享链接可复现。
  - `Favorites / MyResources / MyPosts`：将分页页码写入 URL，保留现有业务逻辑，仅替换页码状态来源。
  - 更新 Web 活跃任务清单：将“列表页 URL 状态统一”从活跃 Backlog 移至已完成。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py ...`（本轮变更文件）：通过
- 风险与后续：
  - 当前风险：个别“加载更多”页面在 URL 页码很大时会按页回放请求，首屏恢复耗时会随页数上升。
  - 下一步动作：如你希望进一步优化，可改为“游标持久化 + 懒回放”策略，减少高页码恢复成本。

## 2026-04-15 16:33 (Asia/Shanghai)

- 任务：将 URL 联动逻辑抽取为可复用 hook，减少多页面重复 `searchParams` 操作。
- 改动文件：
  - `apps/web/src/hooks/useUrlPaginationQuery.ts`
  - `apps/web/src/pages/Resources/index.tsx`
  - `apps/web/src/pages/CreatorProfile/index.tsx`
  - `apps/web/src/pages/ResourceAlbumManage/index.tsx`
  - `apps/web/src/pages/Notifications/index.tsx`
  - `apps/web/src/pages/Favorites/index.tsx`
  - `apps/web/src/pages/Downloads/index.tsx`
  - `apps/web/src/pages/Follows/index.tsx`
  - `apps/web/src/pages/Guestbook/index.tsx`
  - `apps/web/src/pages/MyResources/index.tsx`
  - `apps/web/src/pages/MyPosts/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `useUrlPaginationQuery`，统一封装 `page/keyword` 的解析、更新、清空与参数保留行为。
  - 多个列表页改为复用该 hook，去除大量重复的 `new URLSearchParams(searchParams)` 样板代码。
  - 在任务清单新增“URL 状态复用收敛”完成项，标记本轮组件/逻辑复用结果。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
- 风险与后续：
  - 当前风险：`ResourceTagManage` 仍保留多组 query 手工处理（`tags* / resource* / tab`），后续可按相同思路继续收敛。
  - 下一步动作：若你确认，我下一轮可以把 `ResourceTagManage` 也迁移到统一 hook 风格。

## 2026-04-15 16:39 (Asia/Shanghai)

- 任务：在不改变既有业务时序前提下，补齐 `ResourceTagManage` 的 URL 状态复用迁移。
- 改动文件：
  - `apps/web/src/pages/ResourceTagManage/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 引入 `useUrlPaginationQuery` 到 `ResourceTagManage`，替换 `tagsPage/tagsKeyword` 与 `resourcePage/resourceKeyword` 的重复 query 读写。
  - 保留 `tab` 参数逻辑与原有请求触发顺序，仅收敛 URL 状态更新实现，避免行为漂移。
  - 更新任务清单文案，明确 `ResourceTagManage` 已纳入 URL 状态复用收敛范围。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py ...`（本轮相关文件）：通过
- 风险与后续：
  - 当前风险：无新增业务风险，本轮属于等价重构。
  - 下一步动作：如需继续收敛，可在后续把“加载更多页的按页回放请求”抽成统一 data hook。

## 2026-04-15 17:12 (Asia/Shanghai)

- 任务：在不改变现有交互与鉴权行为前提下，完成 `shared-*` 公共包抽取接线（`format/router/request`）。
- 改动文件：
  - `packages/shared-format/package.json`
  - `packages/shared-format/tsconfig.json`
  - `packages/shared-format/tsup.config.ts`
  - `packages/shared-format/src/index.ts`
  - `packages/shared-router/package.json`
  - `packages/shared-router/tsconfig.json`
  - `packages/shared-router/tsup.config.ts`
  - `packages/shared-router/src/index.ts`
  - `packages/shared-request/package.json`
  - `packages/shared-request/tsconfig.json`
  - `packages/shared-request/tsup.config.ts`
  - `packages/shared-request/src/index.ts`
  - `apps/web/src/hooks/useUrlPaginationQuery.ts`
  - `apps/web/src/utils/request.ts`
  - `apps/admin/src/utils/request.ts`
  - `apps/web/src/pages/Downloads/index.tsx`
  - `apps/web/src/pages/Favorites/index.tsx`
  - `apps/web/package.json`
  - `apps/admin/package.json`
  - `pnpm-lock.yaml`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `@valley/shared-format`，沉淀文件大小/资源类型/中文时间格式化工具，`web` 页面改为复用该包。
  - 新增 `@valley/shared-router`，将 `useUrlPaginationQuery` 抽到公共包，应用侧保留原 hook 出口以保证调用方兼容。
  - 新增 `@valley/shared-request`，抽离 axios 公共客户端创建逻辑，`web/admin` 继续通过回调注入各自错误提示与登录跳转策略，保持原行为。
  - 补齐 `apps/web` 与 `apps/admin` 对新共享包的 workspace 依赖声明。
- 校验：
  - `pnpm install`：通过
  - `pnpm --filter @valley/shared-format build`：通过
  - `pnpm --filter @valley/shared-router build`：通过
  - `pnpm --filter @valley/shared-request build`：通过
  - `pnpm --filter @valley/shared-format typecheck`：通过
  - `pnpm --filter @valley/shared-router typecheck`：通过
  - `pnpm --filter @valley/shared-request typecheck`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `pnpm --filter admin exec tsc --noEmit`：通过
- 风险与后续：
  - 当前风险：`shared-request` 已包含默认中文错误映射，后续若 `web/admin` 文案策略分化，需要在调用端继续显式覆盖 `resolveErrorMessage`，避免体验漂移。
  - 下一步动作：可继续评估 `apps/admin/src/api/record.ts` 的直连 axios 逻辑是否纳入 `shared-request`，进一步统一请求层。

## 2026-04-17 16:48 (Asia/Shanghai)

- 任务：为博客创作页补齐批量导入 Markdown 创建博客能力，并修复直接粘贴 Markdown 代码块时编辑器展示异常。
- 改动文件：
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `apps/web/src/components/blog/MdxMarkdownEditor.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增“批量导入 MD”入口，支持一次选择多个 Markdown 文件，预览识别结果后按当前分组与可见范围批量创建博客。
  - 批量创建链路直接复用现有 Markdown 解析和博客创建接口，摘要按正文自动截取，显式跳过 AI 封面生成。
  - 编辑器新增针对 Markdown 代码块粘贴的兼容处理，在检测到 fenced code 或缩进代码块时改用 `insertMarkdown`，避免富文本粘贴破坏代码结构。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前批量创建为串行调用前端单篇创建接口，文件很多时耗时会较长；后续如有需要可补后端批量接口。
  - 粘贴修复目前聚焦代码块语法，若后续发现其他 Markdown 结构在富文本粘贴下也会失真，可继续扩展识别范围。

## 2026-04-17 16:48 (Asia/Shanghai)

- 任务：移除 Web 活跃 backlog 中 3 个实质增量偏低的收尾项，清空当前任务入口。
- 改动文件：
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 从 Web 活跃 Backlog 中移除“首页运营信号增强 / 创作者广场交互增强 / 通知中心细化增强”3 项。
  - 将活跃区改为“当前暂无活跃项”，避免后续迭代继续被旧的低优先级任务牵引。
  - 同步更新“下一步建议”，改为重新规划一批更有实质增量的 Web 功能。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：Web 活跃 backlog 已清空，后续若不及时补新计划，任务入口会短暂处于空档状态。
  - 下一步动作：基于现有页面闭环和产品方向，补一版新的 Web 高价值功能清单。

## 2026-04-17 16:52 (Asia/Shanghai)

- 任务：把新的博客改版与名著阅读方向收敛进 Web 活跃 backlog，形成下一批可执行功能计划。
- 改动文件：
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 4 个活跃项，分别覆盖“博客视觉重做 / 博客 AI 阅读助手 / 名著书库基础建设 / 名著在线阅读闭环”。
  - 将博客方向明确拆成“视觉层”和“AI 阅读层”，避免把改样式与改功能混成一个大任务。
  - 将名著方向明确拆成“资源来源/版权边界”与“站内阅读闭环”，方便后续按阶段推进。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：名著板块尚未确定最终数据来源与授权边界，后续实现前必须先锁定可合法导入的首批资源。
  - 下一步动作：补一版博客 AI 形态建议和名著资源来源决策，作为后续实施依据。

## 2026-04-17 17:11 (Asia/Shanghai)

- 任务：完善 Web 持续迭代任务清单，补齐“博客全面 AI 化 + 名著板块”的可执行拆解。
- 改动文件：
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将博客重构任务升级为 P0 级可执行任务，明确信息架构与内容消费目标。
  - 新增“博客 AI 能力定义与 MVP”任务，先收敛能力范围，再落地 2-3 个高感知能力。
  - 将名著需求拆为“数据源与版权策略（P0）+ 阅读闭环（P1）+ AI 伴读（P1）”三步，降低一次性不确定性。
  - 调整下一步建议，优先完成 AI 能力边界与数据源边界的方案定板。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：博客 AI 与名著 AI 仍处于能力待选阶段，若不先锁定 MVP 会导致 UI/接口反复返工。
  - 下一步动作：先完成“博客 AI MVP 能力清单”和“名著首批数据源白名单”，再开页面与接口实现。

## 2026-04-17 17:12 (Asia/Shanghai)

- 任务：复核并完善博客批量创建流程的健壮性与可恢复性。
- 改动文件：
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 为批量导入增加单次文件数上限（50）与超限提示，避免一次导入过多文件导致流程过慢或难以恢复。
  - 批量创建状态新增 `running`，逐条创建时准确展示当前进行中的项，避免所有 pending 项同时显示“转圈”造成误判。
  - 批量创建失败时保留后端错误信息，并新增“重试失败项”能力，无需重新选文件即可再次执行失败项。
  - 收紧“确认创建”按钮可用条件，仅在存在 `pending` 项时可执行首轮创建。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：批量创建仍是前端串行调用单条创建接口，大批量场景下总耗时依然偏长。
  - 下一步动作：如批量规模继续上升，可考虑补后端批量创建接口与服务端事务/失败明细返回。

## 2026-04-17 17:40 (Asia/Shanghai)

- 任务：按要求取消脚本化提交约束，改为在 skill 内强化 commit message 约束。
- 改动文件：
  - `.codex/skills/conventional-commit-guard/SKILL.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 回退本轮新增的 hook/alias/模板脚本方案，保持仓库现有机制不变。
  - 将 `conventional-commit-guard` 升级为强约束说明，明确“先对齐历史风格、再生成 message、再自检提交”的执行链路。
  - 在 skill 中补充失败处理规则：被 hook 拒绝后必须修正并重提，用户指出风格不一致时必须优先 amend 对齐。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/conventional-commit-guard/SKILL.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：skill 约束依赖 agent 执行纪律，不具备 hook/CI 那种硬拦截能力。
  - 下一步动作：若后续仍有风格漂移，再考虑把关键约束回收为最小化 hook 规则。

## 2026-04-17 17:48 (Asia/Shanghai)

- 任务：将 commit message 约束收敛为“默认短提交”，并明确在 skill 内强制执行。
- 改动文件：
  - `.codex/skills/conventional-commit-guard/SKILL.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 `conventional-commit-guard` 中新增“默认只写一行首行”的硬规则。
  - 明确仅在用户显式要求时才允许正文与 Lore trailers，避免 agent 自动生成长提交信息。
  - 增补“太长即 amend 修正”的失败处理规则与默认长度约束。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/conventional-commit-guard/SKILL.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：该约束属于 skill 级执行规范，不具备 hook/CI 的技术强制拦截。
  - 下一步动作：如仍出现偏差，再评估最小化 hook 兜底（仅校验首行长度与是否存在正文）。

## 2026-04-17 21:21 (Asia/Shanghai)

- 任务：放行 Git 自动生成的 `Merge branch ...` 提交信息，避免 `git pull` 合并提交被 commit-msg hook 拦截。
- 改动文件：
  - `scripts/check-commit-msg.js`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在提交信息校验脚本中新增 merge message 正则，支持 `Merge branch 'xxx'` 与 `Merge branch 'xxx' of ...` 这类 Git 默认合并文案。
  - 调整校验条件为“满足 Conventional Commits 或满足 merge message 规则即放行”。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py scripts/check-commit-msg.js .codex/logs/CHANGE-LOG.md`：通过
  - `node --check scripts/check-commit-msg.js`：通过
- 风险与后续：
  - 当前风险：仅放行了 `Merge branch`/`Merge remote-tracking branch` 形式，`Merge pull request` 暂未纳入。
  - 下一步动作：若你也希望放行 PR 合并文案，可再补一条白名单正则。
## 2026-04-17 21:36 (Asia/Shanghai)

- 任务：重构博客批量导入交互，改为先开弹窗，再在弹窗内完成导入识别、分组/可见范围设置与单篇封面配置。
- 改动文件：
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将“批量导入 MD”入口改为先打开弹窗，默认在弹窗中部展示“上传文件”区，用户点击后再触发文件选择并展示识别结果列表。
  - 在批量弹窗中新增独立“目标分组 + 可见范围”设置，创建时使用弹窗内设置，不再强依赖主编辑区当前值。
  - 为每条识别结果新增“设置封面”开关，支持两种来源：上传本地图片、选择资源壁纸；并在创建前拦截“已勾选但未选图”的项。
  - 批量创建请求新增按条目携带 `cover/coverStorageKey`，实现单篇博客可选封面发布。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/BlogCreate/index.tsx`：通过
- 风险与后续：
  - 当前风险：批量封面上传仍按单篇逐次触发，超大批量时操作步数较多。
  - 下一步动作：如后续需求增加，可补“批量应用同一封面/批量清空封面”快捷操作。
## 2026-04-17 21:49 (Asia/Shanghai)

- 任务：在 `/my-space/posts` 增加批量设置壁纸操作，支持给选中内容一次应用同一张资源壁纸。
- 改动文件：
  - `apps/web/src/pages/MyPosts/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 批量模式工具栏新增“批量设置壁纸”按钮，并复用 `PublicWallpaperPickerDialog` 作为壁纸选择入口。
  - 选择壁纸后先调用 `uploadBlogCoverByUrl` 转存封面，再批量调用 `updatePost` 更新选中内容的 `cover/coverStorageKey`。
  - 增加批量设置结果回写与提示：成功项即时更新列表封面，失败项保留选中便于重试；全成功则自动退出批量模式。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/MyPosts/index.tsx`：通过
- 风险与后续：
  - 当前风险：批量设置壁纸会给所有选中文章应用同一封面，误选时影响面较大。
  - 下一步动作：可追加确认弹窗，明确提示“将覆盖当前封面”。

## 2026-04-17 21:55 (Asia/Shanghai)

- 任务：将 /my-space/posts 的批量设置入口调整到页面主入口，并提供统一“批量设置博客”弹框。
- 改动文件：
  - `apps/web/src/pages/MyPosts/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 页面右上角按钮改为“批量设置博客”，点击后进入批量模式并直接弹出“批量设置博客”弹框。
  - 弹框内统一提供“批量设置访问状态 / 批量设置壁纸”两个操作入口，避免主操作分散在工具栏。
  - 批量工具栏按钮也改为打开同一弹框，保持入口一致，减少找不到操作位置的问题。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/MyPosts/index.tsx`：通过
- 风险与后续：
  - 当前风险：若未先勾选内容，弹框内操作按钮会禁用，首次使用可能需要一次引导。
  - 下一步动作：可补充“未选择时一键全选当前页”的快捷按钮。

## 2026-04-17 22:02 (Asia/Shanghai)

- 任务：修正 /my-space/posts 批量设置入口交互，避免顶部按钮直接弹框。
- 改动文件：
  - `apps/web/src/pages/MyPosts/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 顶部“批量设置博客”按钮改为仅进入批量模式，不再自动打开“批量设置博客”弹框。
  - 保持批量工具栏内“批量设置博客”按钮作为弹框触发入口，符合“先选中再设置”的操作节奏。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/MyPosts/index.tsx`：通过
- 风险与后续：
  - 当前风险：用户首次进入批量模式可能不知道下一步要点批量工具栏按钮。
  - 下一步动作：可补一条轻提示文案“先勾选内容，再点批量设置博客”。

## 2026-04-17 22:16 (Asia/Shanghai)

- 任务：将 /my-space/posts 的“批量设置壁纸”重构为“在线逐条设置封面”的批量弹框体验。
- 改动文件：
  - `apps/web/src/pages/MyPosts/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 取消原先“给全部选中文章套同一张壁纸”的单步流程，改为进入“在线批量设置封面”弹框后逐条处理。
  - 弹框内展示已选内容列表，并为每条提供“设置封面”勾选、上传图片、选择资源壁纸、状态反馈（待处理/成功/失败）。
  - 批量保存时按条目执行：若是资源壁纸先转存，再更新对应文章封面；支持失败项重试。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/MyPosts/index.tsx`：通过
- 风险与后续：
  - 当前风险：大量条目逐条转存+更新时，整体耗时会明显增长。
  - 下一步动作：可补“同一封面批量应用到已勾选项”的快捷操作，兼顾精细设置与效率。

## 2026-04-17 22:27 (Asia/Shanghai)

- 任务：调整 /my-space/posts 在线批量设置封面弹框宽度，提升列表可读性。
- 改动文件：
  - pps/web/src/pages/MyPosts/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将在线批量设置封面弹框宽度从固定 max-w-4xl 调整为 w-[92vw] max-w-[1120px]，在桌面端展示更宽。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/MyPosts/index.tsx：通过
- 风险与后续：
  - 当前风险：超小屏幕仍会按视口缩放，信息密度较高。
  - 下一步动作：如需可再分离移动端样式（减少信息行、改按钮排布）。
## 2026-04-17 22:42 (Asia/Shanghai)

- 任务：修复在线批量设置封面弹框的横向溢出问题。
- 改动文件：
  - pps/web/src/pages/MyPosts/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 弹框容器新增 overflow-hidden，防止内部内容超出可视区域。
  - 列表容器新增 overflow-x-hidden，禁止横向滚动撑出布局。
  - 封面地址文本新增 reak-all，长 URL 强制换行，不再把卡片宽度撑爆。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/MyPosts/index.tsx：通过
- 风险与后续：
  - 当前风险：长地址虽然不溢出，但可读性一般。
  - 下一步动作：可改为“仅展示域名+截断路径 + 复制按钮”。
## 2026-04-17 22:46 (Asia/Shanghai)

- 任务：修复在线批量设置封面弹框在 sm 断点下被默认 max-width 压窄的问题。
- 改动文件：
  - pps/web/src/pages/MyPosts/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将弹框宽度类调整为 w-[92vw] max-w-[92vw] sm:max-w-[1120px]。
  - 用 sm:max-w-[1120px] 显式覆盖 DialogContent 基类里的 sm:max-w-sm，避免在中大屏被强制收窄。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/MyPosts/index.tsx：通过
- 风险与后续：
  - 当前风险：超宽屏下弹框上限仍为 1120px（有意限制）。
  - 下一步动作：如你希望更宽，可再提升为 1240/1360。

## 2026-04-17 23:15 (Asia/Shanghai)

- 任务：为博客详情正文图片增加点击预览能力，并复用现有资源图片预览组件。
- 改动文件：
  - `apps/web/src/components/blog/MarkdownContent.tsx`
  - `apps/web/src/pages/blog/BlogPost/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 `MarkdownContent` 中新增可选能力：`enableImagePreview`，开启后可点击正文里的 `img` 直接预览。
  - 预览能力复用现有 `ImagePreviewDialog`（与资源图片预览同组件），支持放大缩小、旋转、拖拽与下载。
  - 仅在博客详情页开启该能力，保持其他 markdown 场景默认行为不变。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/MarkdownContent.tsx apps/web/src/pages/blog/BlogPost/index.tsx`：通过
- 风险与后续：
  - 当前风险：正文中若图片被外层链接包裹，当前逻辑会优先触发预览而不是跳转外链。
  - 下一步动作：如需保留外链跳转，可改成“点击图片预览，点击图片下方来源链接跳转”。

## 2026-04-17 23:20 (Asia/Shanghai)

- 任务：修复博客详情图片预览弹框打开时页面内容抖动问题。
- 改动文件：
  - pps/web/src/index.css
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 在全局 html 增加 scrollbar-gutter: stable both-edges，为滚动条预留稳定空间。
  - 避免弹框打开时滚动锁定导致视口宽度变化，从而引发页面横向抖动。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/index.css：通过
- 风险与后续：
  - 当前风险：极少数不支持 scrollbar-gutter 的旧浏览器仍可能出现轻微位移。
  - 下一步动作：如需兼容旧浏览器，可补 overflow-y: scroll 作为降级策略。
## 2026-04-17 23:29 (Asia/Shanghai)

- 任务：为博客正文可预览图片增加 hover 交互反馈，强化“可点击预览”的感知。
- 改动文件：
  - pps/web/src/components/blog/MarkdownContent.tsx
  - pps/web/src/components/blog/markdown-styles.css
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 为开启预览能力的正文图片添加 previewable-image 标记类，支持按开关启用/移除。
  - 新增 hover 效果：轻微上浮放大、亮度微增强、主题色描边与更明显阴影（含 dark 样式）。
  - 保持效果只作用于“可预览图片”，不影响其他普通 markdown 图片场景。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/MarkdownContent.tsx apps/web/src/components/blog/markdown-styles.css：通过
- 风险与后续：
  - 当前风险：极个别图片在 hover 时轻微放大会让邻近文本重绘。
  - 下一步动作：如需要更稳，可改为仅阴影/描边，不做缩放。
## 2026-04-18 00:33 (Asia/Shanghai)

- 任务：在 BlogList 突出分组的重要性，帮助用户更快识别阅读内容类型。
- 改动文件：
  - pps/web/src/pages/blog/BlogList/index.tsx
  - pps/web/src/components/blog/BlogPostCard.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 在列表页新增“按分组阅读”横向分组条，支持快速在“全部/热门分组”之间切换。
  - 列表区文案增加当前分组上下文提示，空状态在选中分组时也会明确引导切换分组。
  - 公开态博客卡片头部新增分组徽标（与类型标签并列），提升“内容类型可识别性”。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx apps/web/src/components/blog/BlogPostCard.tsx：通过
- 风险与后续：
  - 当前风险：分组信息在卡片中展示频率提升，信息密度略高。
  - 下一步动作：可结合真实数据再微调 badge 文案长度与优先级。
## 2026-04-18 00:50 (Asia/Shanghai)

- 任务：按 Web 活跃任务清单对博客页执行整体重构，重做 BlogList 与 BlogPost 的视觉与阅读结构。
- 改动文件：
  - pps/web/src/pages/blog/BlogList/index.tsx
  - pps/web/src/pages/blog/BlogPost/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - BlogList：升级为“分组主导 + 搜索排序 + Featured 推荐卡”的阅读入口形态，强化科技感主视觉与信息层级。
  - BlogList：分组导航保持高权重，新增推荐首卡与普通卡片分层，提升内容浏览节奏。
  - BlogPost：重做详情页头部与正文承载区，新增阅读进度条与阅读状态卡，强化沉浸式阅读反馈。
  - BlogPost：保留目录/评论链路并优化排版层次，确保从列表进入详情再返回的体验连续。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx apps/web/src/pages/blog/BlogPost/index.tsx：通过
- 风险与后续：
  - 当前风险：重构后视觉和信息密度提升，需结合真实内容量再微调首屏节奏与阴影层级。
  - 下一步动作：继续补“相关推荐区 + 详情页上一篇/下一篇”闭环，完成博客页重构收口。
## 2026-04-18 01:00 (Asia/Shanghai)

- 任务：根据反馈重做 BlogList 视觉结构，强化分组阅读并去除“单张大图主导”的展示方式。
- 改动文件：
  - pps/web/src/pages/blog/BlogList/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - BlogList 主视觉重构为“阅读舱 + 操作台”结构，替换原先单调区块式布局。
  - 搜索区与排序区重排为高可用操作台，减少视觉噪音并提升操作效率。
  - 分组区域重构为“分组优先导航 + 分组矩阵侧栏”，强化分组对阅读路径的主导作用。
  - 列表数据改为仅请求 postType=blog，不再混入图文内容。
  - 去除单篇大图主导展示方式，改为统一网格卡片流。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx apps/web/src/pages/blog/BlogPost/index.tsx：通过
- 风险与后续：
  - 当前风险：重构后信息密度提升，极小屏设备的首屏可见内容变少。
  - 下一步动作：补移动端专属压缩版头部与分组入口，以降低首屏负担。
## 2026-04-18 01:06 (Asia/Shanghai)

- 任务：按反馈继续重构博客页，优化 BlogList 分组按钮配色并同步强化 BlogPost 沉浸阅读视觉。
- 改动文件：
  - pps/web/src/pages/blog/BlogList/index.tsx
  - pps/web/src/components/blog/BlogPostCard.tsx
  - pps/web/src/pages/blog/BlogPost/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - BlogList：分组按钮选中态由黑色改为主题主色，统一主题风格。
  - BlogList：维持重构后的“分组优先导航 + 分组矩阵 + 博客卡片流”结构，持续提升分组识别与阅读路径清晰度。
  - BlogPost：补强阅读进度反馈与沉浸式阅读层次（顶部进度、阅读状态卡、正文承载区分层）。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx apps/web/src/pages/blog/BlogPost/index.tsx：通过
- 风险与后续：
  - 当前风险：当前改动量较大，需要你按真实内容量看首屏节奏是否仍需收敛。
  - 下一步动作：若你认可方向，再补“相关推荐 + 上一篇/下一篇”阅读闭环。## 2026-04-18 01:12 (Asia/Shanghai)

- 任务：优化 BlogPost 目录导读位置，使其随阅读滚动持续可见。
- 改动文件：
  - `apps/web/src/pages/blog/BlogPost/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将目录导读从头部静态区域移入正文旁 `sticky` 侧栏。
  - 目录容器增加 `max-h` + `overflow-y-auto`，长目录可滚动且不影响侧栏稳定性。
  - 解决阅读到底部时“看不到当前章节目录”的体验问题。
- 校验：
  - `npx pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogPost/index.tsx`：通过
- 风险与后续：
  - 当前风险：极短文章时右侧 sticky 区显得信息较密。
  - 下一步动作：可在短文场景下折叠目录卡片默认状态。
## 2026-04-18 01:41 (Asia/Shanghai)

- 任务：阶段性提交博客重构改动，并明确 BlogPost 仍有未完成改善项。
- 改动文件：
  - `apps/web/src/pages/blog/BlogList/index.tsx`
  - `apps/web/src/pages/blog/BlogPost/index.tsx`
  - `apps/web/src/components/blog/BlogPostCard.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - BlogList 完成新版分组优先导航与视觉重构，且仅展示博客内容（不混图文）。
  - BlogPost 已完成目录导读随滚动侧栏与部分阅读层次优化。
- 校验：
  - `npx pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx apps/web/src/pages/blog/BlogPost/index.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：BlogPost 视觉与交互仍未全部改善（仍需继续深度打磨页面节奏、推荐阅读区、上下篇导航等）。
  - 下一步动作：下一轮优先把 BlogPost 做完“完整沉浸阅读版”并补全阅读闭环。

## 2026-04-19 12:58 (Asia/Shanghai)

- 任务：完成博客重构 BR-5 ~ BR-7，收口 BlogPost 视觉与交互，并完成双视角验收。
- 改动文件：
  - `apps/web/src/pages/blog/BlogPost/index.tsx`
  - `apps/web/src/components/blog/TableOfContents.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - BR-5：重构 BlogPost 阅读导览信息区，弱化冗余说明卡，优化信息密度与节奏。
  - BR-6：目录高亮改为页面级共享状态，桌面/移动目录一致跟随；新增移动端底部目录入口与抽屉目录。
  - BR-6：新增滚动状态提示，按阅读进度与章节动态反馈。
  - BR-7：完成访客/创作者双视角回归；修复上一篇/下一篇/相关推荐跳转后的返回上下文继承问题。
  - WEB-TASKS：将 BR（BR-1 ~ BR-7）整体转入“已完成”，并更新下一步建议为 BAI-1 / CLD-1。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogPost/index.tsx apps/web/src/components/blog/TableOfContents.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：上一篇/下一篇仍基于列表窗口推断，极端情况下可能无相邻项。
  - 下一步动作：推进 BAI-1，先冻结博客 AI MVP 能力边界。

## 2026-04-19 13:02 (Asia/Shanghai)

- 任务：启动 BAI 任务并完成 BAI-1 能力边界文档。
- 改动文件：
  - docs/architecture/2026-04-19_blog_ai_mvp_capability_boundary.md
  - .codex/skills/web-feature-iteration/WEB-TASKS.md
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 新增博客 AI MVP 能力边界文档，覆盖 AI 导读、章节速览、问文章 三项能力。
  - 对每项能力明确输入/输出、页面入口、触发方式与失败兜底策略。
  - WEB-TASKS 将 BAI-1 标记为已完成，并将下一步建议切换为 BAI-2/BAI-3。
- 校验：
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py docs/architecture/2026-04-19_blog_ai_mvp_capability_boundary.md .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：BAI-2 未冻结范围前，仍可能发生能力蔓延。
  - 下一步动作：执行 BAI-2，确定首批上线能力与裁剪项。

## 2026-04-19 13:10 (Asia/Shanghai)

- 任务：继续推进 BAI，完成 BAI-2 能力冻结与 BAI-3 UI 接入方案。
- 改动文件：
  - docs/architecture/2026-04-19_blog_ai_mvp_freeze_and_ui_plan.md
  - .codex/skills/web-feature-iteration/WEB-TASKS.md
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - BAI-2：冻结首批上线能力为 AI 导读 + 问文章，并将 章节速览 延后到后续版本。
  - BAI-3：补齐博客详情页与列表页的 AI 入口位置、状态反馈与失败兜底策略。
  - WEB-TASKS：将 BAI（BAI-1~BAI-3）转入已完成，并更新下一步建议为 CLD-1/CLD-2。
- 校验：
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py docs/architecture/2026-04-19_blog_ai_mvp_freeze_and_ui_plan.md .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：AI 能力已冻结，但未进入页面代码实现阶段。
  - 下一步动作：按 BAI-3 方案进入前端接入实现与交互联调。

## 2026-04-19 13:21 (Asia/Shanghai)

- 任务：将 BAI 从方案阶段推进到真实开发，落地 BlogPost 的 AI 导读 + 问文章。
- 改动文件：
  - server/internal/handler/blog_reader_ai.go
  - server/internal/router/router.go
  - pps/web/src/api/blog.ts
  - pps/web/src/pages/blog/BlogPost/index.tsx
  - .codex/skills/web-feature-iteration/WEB-TASKS.md
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 新增公开 AI 接口：POST /public/blog/posts/id/:id/ai/guide 与 POST /public/blog/posts/id/:id/ai/ask。
  - 复用 ARK 文本模型配置与共享客户端，按文内上下文生成导读与问答结果。
  - BlogPost 页面接入真实交互：导读按钮、提问输入、加载态、失败态、结果与引用展示。
  - API 层补齐 generateBlogReaderGuide 与 skBlogPost 调用方法。
  - WEB-TASKS 补充“BAI-MVP 首批能力代码接入”已完成记录。
- 校验：
  - cd server && go test ./...：通过
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogPost/index.tsx apps/web/src/api/blog.ts server/internal/handler/blog_reader_ai.go server/internal/router/router.go .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：导读/问答输出结构仍依赖模型 JSON 服从度，极端情况下会走降级文案。
  - 下一步动作：按 BAI-3 继续补 BlogList 的“AI 推荐读哪篇”轻入口与接口。

## 2026-04-19 13:41 (Asia/Shanghai)

- 任务：继续推进 BAI 代码能力，完成 BlogList 的“AI 推荐读哪篇”接入。
- 改动文件：
  - server/internal/handler/blog_reader_ai.go
  - server/internal/router/router.go
  - pps/web/src/api/blog.ts
  - pps/web/src/pages/blog/BlogList/index.tsx
  - .codex/skills/web-feature-iteration/WEB-TASKS.md
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 新增推荐接口：POST /public/blog/ai/recommend，基于当前筛选候选 + AI 意图返回 1-3 篇推荐及理由。
  - BlogList 搜索卡新增“AI 推荐读哪篇”入口与轻量面板（输入意图、加载态、失败态、推荐结果）。
  - 推荐结果可直接跳转博客详情，并保留来源 source=blog-ai-recommend 的返回上下文。
  - WEB-TASKS 新增“BAI-MVP 列表页推荐接入”已完成记录。
- 校验：
  - cd server && go test ./...：通过
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx apps/web/src/api/blog.ts server/internal/handler/blog_reader_ai.go server/internal/router/router.go .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：推荐结果依赖模型 JSON 服从度，异常时会回退候选兜底推荐。
  - 下一步动作：补“章节速览”能力的正式接口与详情页目录区展示。

## 2026-04-19 13:44 (Asia/Shanghai)

- 任务：调整 BlogList 顶部主视觉标题与主题背景，去除偏蓝色调。
- 改动文件：
  - pps/web/src/pages/blog/BlogList/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 主标题由“博客分组阅读中心”改为“博客主题深读中心”。
  - 背景渐变改为暖金/奶油方向，移除蓝色径向高光。
  - 新增轻量图形元素与低频脉冲动效，增强识别度但不干扰阅读。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：极低，属于纯视觉层改动。
  - 下一步动作：如需可继续统一 BlogList 其余卡片层级的动效节奏。

## 2026-04-19 13:45 (Asia/Shanghai)

- 任务：落地 Web 系统更新日志能力（后端存储 + Web 展示 + Admin 管理），并新增仅在 commit/push 节点写对外更新日志的 skill。
- 改动文件：
  - `server/internal/model/model.go`
  - `server/internal/database/database.go`
  - `server/internal/router/router.go`
  - `server/internal/handler/system_update.go`
  - `server/migrations/012_create_system_updates.sql`
  - `apps/web/src/api/systemUpdate.ts`
  - `apps/web/src/pages/SystemUpdates/index.tsx`
  - `apps/web/src/App.tsx`
  - `apps/web/src/layouts/Header.tsx`
  - `apps/admin/src/api/system-update.ts`
  - `apps/admin/src/pages/SystemUpdates.tsx`
  - `apps/admin/src/App.tsx`
  - `apps/admin/src/layouts/Layout.tsx`
  - `.codex/skills/web-update-log-guard/SKILL.md`
  - `.codex/skills/web-update-log-guard/agents/openai.yaml`
  - `.codex/skills/INDEX.md`
  - `AGENTS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `SystemUpdate` 数据模型与自动迁移接线，平台固定 `web`，支持草稿/发布状态与发布时间。
  - 新增公开接口 `GET /api/v1/public/system-updates`，后端强制仅返回 `web + published` 且已到发布时间的更新，并只返回用户可见字段（标题/内容/时间）。
  - 新增管理接口 `GET/POST/PUT/DELETE /api/v1/admin/system-updates`，支持在 admin 手动创建、编辑、删除系统更新。
  - Web 新增 `/updates` 页面与导航入口，用于展示“更新内容 + 更新时间”，不暴露文件名与内部实现信息。
  - Admin 新增“系统更新日志”菜单与管理页，可按标题/内容检索并执行增删改。
  - 新增 `web-update-log-guard` skill，明确“仅在 commit/push 节点记录对外 Web 更新日志”，并同步 AGENTS 与 skills 索引。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `pnpm --filter admin exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：当前 admin 发布时间采用“发布时默认当前时间”的交互，若后续需要精确定时发布，可补充日期时间选择器。
  - 下一步动作：在实际 commit/push 流程中启用 `web-update-log-guard`，将本次 Web 功能变更写入系统更新日志并再发布到线上。

## 2026-04-19 13:49 (Asia/Shanghai)

- 任务：修复“AI 推荐读哪篇”价值感不足问题，并升级交互表达。
- 改动文件：
  - server/internal/handler/blog_reader_ai.go
  - pps/web/src/api/blog.ts
  - pps/web/src/pages/blog/BlogList/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 推荐接口返回结构升级：新增 	itle/excerpt/groupName/readMinutes，前端不再依赖“当前分页数据匹配”。
  - 修复“请求成功但看不到结果”的核心问题（跨页推荐也可直接展示）。
  - 推荐面板升级为“AI 阅读路线”：加入快捷意图 chips、路线式卡片（序号、预计时长、分组、推荐理由）与更强视觉反馈。
  - 交互收口：发起新推荐时清空旧结果，避免旧数据误导。
- 校验：
  - cd server && go test ./...：通过
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py server/internal/handler/blog_reader_ai.go apps/web/src/pages/blog/BlogList/index.tsx apps/web/src/api/blog.ts .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：推荐质量仍受模型输出稳定性影响。
  - 下一步动作：可增加“推荐理由可信提示”和“换一批”机制，进一步提升可玩性与可控性。

## 2026-04-19 13:53 (Asia/Shanghai)

- 任务：将 BlogList AI 推荐提示词调整为技术博客语境。
- 改动文件：
  - pps/web/src/pages/blog/BlogList/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 快捷意图 chips 改为前端技术方向：JS/TS、HTML+CSS、Vue/React 工程化。
  - 输入框占位文案改为技术问题示例（异步、布局、性能优化）。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：无功能风险，属于文案引导优化。
  - 下一步动作：如需可继续细分为“框架 / 工程化 / 性能 / CSS”四类快捷入口。

## 2026-04-19 13:59 (Asia/Shanghai)

- 任务：按反馈修正 BlogList 页头主题表现与 AI 推荐布局。
- 改动文件：
  - pps/web/src/pages/blog/BlogList/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 页头背景收敛为主题变量驱动，不再出现红黄对冲感。
  - AI 推荐从页头内联展开改为独立弹层面板，避免撑高页头导致左右布局失衡。
  - 推荐结果区域加入最大高度与滚动，结果较多时不影响主布局。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：无功能风险，主要为布局与视觉优化。
  - 下一步动作：可按需要继续微调弹层宽度与卡片密度。

## 2026-04-19 14:02 (Asia/Shanghai)

- 任务：按反馈优化 BlogList AI 推荐交互样式，避免弹框观感与页头布局冲突。
- 改动文件：
  - pps/web/src/pages/blog/BlogList/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将 AI 推荐从全局 Dialog 改为按钮下方悬浮 Popover 面板（不遮全屏、不撑高页头）。
  - 页头背景继续收敛到主题变量，不使用红黄对冲色块。
  - 保留推荐结果滚动区与跳转链路，确保功能不回退。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：Popover 在极窄屏下宽度受限，已设置最大宽并跟随容器。
  - 下一步动作：可按视觉稿继续微调阴影与边框对比度。

## 2026-04-19 14:09 (Asia/Shanghai)

- 任务：按反馈将 AI 推荐交互改为右侧滑出抽屉。
- 改动文件：
  - pps/web/src/pages/blog/BlogList/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 移除 Popover 方案，改为 fixed 右侧滑出抽屉（含遮罩与过渡动画）。
  - 抽屉开启时锁定页面滚动，关闭后恢复，避免滚动穿透。
  - 推荐输入、快捷意图、结果卡与跳转链路全部保留。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：抽屉在超小屏宽度下占比仍较高，但已限制为 92vw 上限。
  - 下一步动作：可继续优化抽屉头部与卡片密度。

## 2026-04-19 14:12 (Asia/Shanghai)

- 任务：优化 BlogCreate 批量导入体验，支持追加上传并调整按钮文案。
- 改动文件：
  - pps/web/src/pages/BlogCreate/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 批量选择 MD 文件时由“覆盖模式”改为“追加模式”，第二次上传不会清空上次识别结果。
  - 去掉单次导入文件数量截断逻辑（不再自动截取前 N 个）。
  - 识别结果区按钮文案由“重新上传文件”统一为“上传文件”。
  - 导入完成态也保留“上传文件”入口，便于继续追加文件。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/BlogCreate/index.tsx .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：一次性上传超大量文件会拉长前端解析时间。
  - 下一步动作：如有需要可补“每批次分段解析进度提示”。

## 2026-04-19 14:20 (Asia/Shanghai)

- 任务：修复批量导入封面设置边界，并为“选择资源壁纸”补充排序筛选。
- 改动文件：
  - pps/web/src/pages/BlogCreate/index.tsx
  - pps/web/src/components/blog/PublicWallpaperPickerDialog.tsx
  - pps/web/src/api/resource.ts
  - server/internal/handler/home.go
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 批量导入中，已创建成功（status=success）条目禁用“设置封面”开关与封面操作按钮。
  - 壁纸选择弹框新增排序筛选：新到旧 / 旧到新。
  - getAllResources 与后端 /public/resources 新增 sort 参数支持，并按 created_at 排序。
- 校验：
  - cd server && go test ./...：通过
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/BlogCreate/index.tsx apps/web/src/components/blog/PublicWallpaperPickerDialog.tsx apps/web/src/api/resource.ts server/internal/handler/home.go .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：无明显风险，改动集中在 UI 状态限制与列表排序参数。
  - 下一步动作：如需可继续补“按下载量/热度排序”选项。

## 2026-04-19 14:44 (Asia/Shanghai)

- 任务：启动并完成 CLD-1，冻结名著数据源白名单与版权策略首版。
- 改动文件：
  - `docs/architecture/2026-04-19_classic_literature_cld1_source_whitelist.md`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 CLD-1 文档，明确白名单准入规则、首批来源、暂不纳入范围、落库最小字段与导入前门槛。
  - 将 `WEB-TASKS` 中 `CLD-1` 标记为已完成，并把下一步建议切换为 `CLD-2 -> CLD-3`。
  - 在活跃 backlog 外补充已完成记录，保证后续迭代可追溯。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py docs/architecture/2026-04-19_classic_literature_cld1_source_whitelist.md .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：不同来源的公版定义与地域口径仍可能不一致，需在 `CLD-2` 导入环节继续做作品级校验。
  - 下一步动作：执行 `CLD-2`，先冻结 `epub/txt/html` 的章节切分、脚注处理与清洗规则。

## 2026-04-19 14:54 (Asia/Shanghai)

- 任务：根据用户画像调整 CLD-1，为中国用户优先策略补齐白名单执行顺序。
- 改动文件：
  - `docs/architecture/2026-04-19_classic_literature_cld1_source_whitelist.md`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 CLD-1 文档中新增“中文来源优先、海外来源补充”的用户导向策略。
  - 将首批白名单调整为中文来源优先展示，并补充“选源优先级（执行顺序）”。
  - 在 WEB-TASKS 的 CLD-1 完成项中同步标注该优先级策略，保证任务口径一致。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py docs/architecture/2026-04-19_classic_literature_cld1_source_whitelist.md .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：中文来源中个别条目的授权口径仍可能存在差异，需要继续坚持“作品级”而非“站点级”判断。
  - 下一步动作：在 CLD-2 中把该优先级落实到导入器规则（中文源默认优先抓取与校验）。

## 2026-04-20 11:29 (Asia/Shanghai)

- 任务：补全名著测试数据并提供一键入库命令，降低本地验证分类/朝代筛选的门槛。
- 改动文件：
  - `server/scripts/seed_classics.go`
  - `scripts/classics-seed.js`（新增）
  - `package.json`
  - `README.md`
  - `QUICK_START.md`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 重写 `seed_classics.go` 为可重复执行的 upsert 逻辑，避免重复作者/书籍；seed 覆盖 `先秦/汉/魏晋南北朝/唐/宋/元/明/清/近现代/外国` 与多分类。
  - 新增根目录脚本 `scripts/classics-seed.js`，自动读取 `DB_DSN` 并串行执行 classics 表迁移与 seed。
  - 新增仓库命令 `pnpm classics:seed`，并在 README/QUICK_START 补充使用说明。
  - 更新 Web 任务清单下一步建议：标记“补全测试数据”完成，并追加“白名单源抓取导入脚本”待办。
- 校验：
  - `cd server && go test ./...`：通过
  - `node --check scripts/classics-seed.js`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py server/scripts/seed_classics.go scripts/classics-seed.js README.md QUICK_START.md .codex/skills/web-feature-iteration/WEB-TASKS.md`：通过
- 风险与后续：
  - 当前风险：本轮提供的是“可重复一键入库的测试数据”，尚未实现“按白名单自动抓取远端源并清洗导入”的生产级 pipeline。
  - 下一步动作：新增白名单抓取 + 清洗 + 导入脚本（含导入日志与失败重试），并将来源与许可证信息落库。

## 2026-04-20 14:26 (Asia/Shanghai)

- 任务：修复 `pnpm classics:seed` 在根目录执行时 Go 模块路径错误，确保一键入库可直接成功。
- 改动文件：
  - `scripts/classics-seed.js`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将 `go run` 的执行目录从仓库根切换为 `server` 目录，避免 `go.mod file not found`。
  - 保持脚本入口不变（仍用 `pnpm classics:seed`），仅修正内部执行上下文。
- 校验：
  - `node --check scripts/classics-seed.js`：通过
  - `pnpm classics:seed`：通过（迁移 + seed 成功，10 本书 30 章）
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py scripts/classics-seed.js`：通过
- 风险与后续：
  - 当前风险：远程数据库网络波动时可能导致执行耗时增大。
  - 下一步动作：可继续补“白名单源抓取导入脚本”，将真实来源文本自动导入而非仅测试 seed。

## 2026-04-20 14:31 (Asia/Shanghai)

- 任务：把“英语学习功能”方案加入 Web 活跃清单，并沉淀可执行的实施文档（数据来源、授权边界、落地步骤）。
- 改动文件：
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `docs/architecture/2026-04-20_english_learning_elp1_data_and_delivery_plan.md`（新增）
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 `WEB-TASKS` 的活跃 backlog 新增 `ELP（P0）` 任务组，包含 `ELP-1 ~ ELP-4`，并将 `ELP-1` 标记为已完成（方案冻结）。
  - 把已完成的 `CLSEARCH / CLADMIN` 从活跃 backlog 移至“已完成”区，保持活跃任务聚焦。
  - 新增 ELP-1 架构文档，明确：
    - 可用数据来源（Oxford/Cambridge/Merriam-Webster + WordNet/Wiktionary/Tatoeba/Common Voice/LibriSpeech）。
    - 版权边界与导入策略（哪些可导入、哪些必须实时 API、哪些禁止抓取）。
    - 在线学习产品闭环（词典/打字/阅读/口语/听力/学习计划）与 Valley MAS 对应技术落点。
    - 听力配音（TTS/真人/混合）与口语评分（STT + 发音评估）实施路径。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：ELP 仍是方案阶段，尚未进入数据库迁移与 API 实作，第三方词典缓存与展示限制仍需法务/协议逐条确认。
  - 下一步动作：进入 `ELP-2`，先落库表结构与后端 API 契约草案，再做 Web 页面骨架联调。

## 2026-04-20 15:05 (Asia/Shanghai)

- 任务：将名著库从“示例片段”升级为“可阅读完整正文”，并提供稳定的一键抓取导入命令。
- 改动文件：
  - `server/scripts/import_classics_fulltext.go`（新增）
  - `scripts/classics-import-fulltext.js`（新增）
  - `package.json`
  - `README.md`
  - `QUICK_START.md`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增完整正文导入器：按书目抓取 Project Gutenberg / 维基文库文本，按章节规则切分并覆盖默认版本章节。
  - 支持网络重试与单书补导入：`CLASSICS_ONLY='书名' pnpm classics:import-fulltext`。
  - 为 `朝花夕拾` 增加维基文库子页面聚合导入，补齐为 12 篇（含小引、后记）。
  - 文档补充 `pnpm classics:import-fulltext` 使用方式，并在 WEB-TASKS 标记“白名单源抓取导入脚本”完成。
- 校验：
  - `pnpm classics:import-fulltext`：通过（全量导入）
  - `CLASSICS_ONLY='朝花夕拾' pnpm classics:import-fulltext`：通过（定点补导入）
  - `cd server && go test ./...`：通过
  - `node --check scripts/classics-import-fulltext.js && node --check scripts/classics-seed.js`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py server/scripts/import_classics_fulltext.go scripts/classics-import-fulltext.js README.md QUICK_START.md .codex/skills/web-feature-iteration/WEB-TASKS.md`：通过
- 风险与后续：
  - 当前风险：上游公版源网络偶发重置（已做重试）；个别文本（如 `宋词三百首` 来源版本）章节总量受源站版本影响。
  - 下一步动作：补充导入结果审计表（来源 URL、许可证、导入时间、失败重试次数）并落库，便于持续运营和合规追溯。

## 2026-04-20 16:48 (Asia/Shanghai)

- 任务：完成名著馆「AI 探索记录」跨设备同步（云端读写 + 前端合并回写 + 页面接入）。
- 改动文件：
  - `server/migrations/017_create_classics_user_ai_explored.sql`（新增）
  - `server/internal/model/classics.go`
  - `server/internal/database/database.go`
  - `server/internal/handler/classics_ai_explored.go`（新增）
  - `server/internal/router/router.go`
  - `apps/web/src/api/classics.ts`
  - `apps/web/src/hooks/useClassicsShelf.ts`
  - `apps/web/src/pages/ClassicsDetail/index.tsx`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增表 `classics_user_ai_explored`（`user_id + book_id + chapter_index` 唯一约束），并接入 Gorm 模型与 AutoMigrate。
  - 新增用户接口 `GET/POST /api/v1/user/classics/ai-explored`，支持按 `bookId/bookIds` 查询与单章节 upsert 保存。
  - 前端新增 `getMyClassicsAiExplored/saveMyClassicsAiExplored`，并在 `useClassicsShelf` 增加：
    - `getAiExploredChaptersWithSync(bookId)`：本地与云端去重合并，缺失记录回写云端。
    - `markChapterAiExploredWithSync(bookId, chapterIndex)`：本地立即写入，登录态异步回写云端。
  - `ClassicsDetail` 初始化改为读取 `getAiExploredChaptersWithSync`；AI 导读/提问成功后改为 `markChapterAiExploredWithSync`。
  - `WEB-TASKS` 已将“名著 AI 探索记录跨设备同步”标记完成，并新增下一项“名著 AI 问章节历史跨设备同步”。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py server/internal/handler/classics_ai_explored.go server/internal/model/classics.go server/internal/database/database.go server/internal/router/router.go apps/web/src/api/classics.ts apps/web/src/hooks/useClassicsShelf.ts apps/web/src/pages/ClassicsDetail/index.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：当前仅同步“章节被 AI 探索过”的布尔轨迹，尚未同步“问答文本历史”，跨端无法回看具体问答内容。
  - 下一步动作：推进“名著 AI 问章节历史跨设备同步”，补云端问答记录表与最近问答回放入口。

## 2026-04-21 11:14 (Asia/Shanghai)

- 任务：补齐“残书”问题，将《骆驼祥子》《老人与海》从摘要内容替换为完整正文。
- 改动文件：
  - `server/scripts/import_classics_fulltext.go`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - `import_classics_fulltext` 增加《骆驼祥子》维基文库完整章节源（`序 + 1~24`）并接入专用解析器。
  - `import_classics_fulltext` 增加《老人与海》Project Gutenberg Canada 完整文本源，并新增正文裁剪解析器（去掉前后版权/书目附录）。
  - 修复导入器对非 UTF-8 文本（ISO-8859-1）解码问题，避免 PostgreSQL 入库报 `invalid byte sequence for encoding "UTF8"`。
  - 实际执行定向导入：`CLASSICS_ONLY='骆驼祥子,老人与海'`，两本均已完成完整正文覆盖。
- 校验：
  - `CLASSICS_ONLY='骆驼祥子,老人与海' go run ./scripts/import_classics_fulltext.go "$DB_DSN"`：通过（`骆驼祥子 25章/139574字`；`老人与海 1章/134489字`）
  - `go run /tmp/classics_audit2.go`（按默认版本统计 `sum(chapters.word_count)`）：通过（`real_words < 5000` 的疑似残书为 `none`）
  - `cd server && go test ./...`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py server/scripts/import_classics_fulltext.go .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：《老人与海》来源为 Project Gutenberg Canada，页面明确“仅加拿大公版，其他国家需自行核对版权”；跨地区分发需持续做权利边界提示。
  - 下一步动作：在导入审计/来源说明里补充地域版权标记（如 `region_scope=CA`），避免后续误判为全球公版。

## 2026-04-21 11:49 (Asia/Shanghai)

- 任务：支持国外文学 `简体中文 / English` 双语切换，并补齐可切换的数据版本。
- 改动文件：
  - `apps/web/src/pages/ClassicsDetail/index.tsx`
  - `server/internal/handler/classics.go`
  - `server/scripts/import_classics_fulltext.go`
  - `server/scripts/backfill_foreign_cn_editions.go`（新增）
  - `scripts/classics-foreign-cn-guide.js`（新增）
  - `package.json`
  - `.codex/skills/web-feature-iteration/WEB-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - Classics 详情页新增国外文学语言切换入口：`简体中文 / English`，并与 URL 参数 `lang`、`edition` 联动。
  - 版本切换增强：国外文学切换版本时自动同步 `lang`，并支持“导读版”提示文案。
  - 后端名著接口中 `classics_editions` 查询增加稳定排序（默认版本优先），避免切换时版本顺序抖动。
  - 完整正文导入器新增：
    - 《骆驼祥子》维基文库完整章节导入（序 + 1~24）。
    - 《老人与海》Project Gutenberg Canada 完整文本导入。
    - 非 UTF-8 文本（ISO-8859-1）解码兜底，修复入库 UTF-8 字节错误。
  - 新增脚本 `backfill_foreign_cn_editions.go` + `pnpm classics:foreign-cn-guide`，为国外文学补齐 `简体中文导读版` 版本，支持和英文版切换。
  - 实际执行数据补齐后，国外文学已具备双语版本（英文完整版 + 简体中文导读版）。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `node --check scripts/classics-foreign-cn-guide.js`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/ClassicsDetail/index.tsx server/internal/handler/classics.go server/scripts/import_classics_fulltext.go server/scripts/backfill_foreign_cn_editions.go scripts/classics-foreign-cn-guide.js package.json`：通过
  - `CLASSICS_ONLY='骆驼祥子,老人与海' go run ./scripts/import_classics_fulltext.go "$DB_DSN"`：通过
  - `go run ./scripts/backfill_foreign_cn_editions.go "$DB_DSN"`：通过（7 本书，21 章导读版）
- 风险与后续：
  - 当前风险：国外文学的简体侧当前为“导读版”，不是完整译文；若需双语都为完整正文，需继续补授权译本来源。
  - 下一步动作：按授权边界补充“简体完整译本”来源，并升级导读版为完整正文版。

## 2026-04-20 20:09 (Asia/Shanghai)

- 任务：修复名著馆 recent/progress 接口在实际请求中的 400/500 异常，提升参数兼容性并去除对唯一约束完整性的硬依赖。
- 改动文件：
  - `server/internal/handler/classics_reading_common.go`（新增）
  - `server/internal/handler/classics_progress.go`
  - `server/internal/handler/classics_recent.go`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 抽出 `classics_reading_common` 公共逻辑，统一 recent/progress 的请求解析、书籍/版本校验、时间处理与响应字段组装，避免两处继续复制同类逻辑。
  - `bookId/editionId/chapterIndex/savedAt` 改为可同时接收 JSON 字符串或数字（`model.Int64String`），减少因前端字段类型漂移导致的 `参数错误`。
  - 去掉 `ON CONFLICT` 直写，改为“先按 `user_id + book_id` 更新，未命中再插入；并发重复时再回退更新”，避免历史库缺失唯一约束时触发 500。
  - recent/progress 两个保存接口复用同一套 upsert 路径，保证行为一致。
- 校验：
  - `cd server && go test ./...`：通过
- 风险与后续：
  - 当前风险：`classics_user_shelves` 与 `classics_user_ai_explored` 仍使用 `ON CONFLICT`，若线上历史库同样缺失对应唯一约束，后续可能出现同类 500。
  - 下一步动作：建议同样迁移这两个接口为“更新优先 + 插入兜底”写入策略，或补充一次幂等的唯一约束修复迁移。

## 2026-04-20 20:15 (Asia/Shanghai)

- 任务：修复名著列表“最近阅读”出现同一本书重复展示的问题。
- 改动文件：
  - `apps/web/src/hooks/useClassicsShelf.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 调整最近阅读去重策略：在 `bookId` 去重基础上，新增按“书名 + 作者 + 朝代”二次去重，保留最新记录。
  - 去重逻辑改为按 `savedAt` 降序先排再去重，避免旧记录覆盖新记录。
  - 云端与本地合并后返回结果统一走去重流程，确保首次渲染也不会出现重复卡片。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/hooks/useClassicsShelf.ts`：通过
- 风险与后续：
  - 当前风险：若确实存在“同名同作者同朝代但不同作品”的极少场景，当前会合并展示为一条。
  - 下一步动作：如后续出现该场景，可补充 `workId/sourceId` 后按稳定业务主键去重。

## 2026-04-20 20:32 (Asia/Shanghai)

- 任务：将名著馆默认内容调整为“更新一些、白话简体优先”，并补齐无封面时的可视化封面体验。
- 改动文件：
  - `server/internal/handler/classics_cover.go`（新增）
  - `server/internal/handler/classics.go`
  - `server/internal/handler/classics_recent.go`
  - `server/scripts/seed_classics.go`
  - `apps/web/src/pages/ClassicsList/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增后端封面兜底：当 `cover_url` 为空时，按书名/分类动态生成 SVG data URI 封面，列表/详情/最近阅读都能稳定显示封面。
  - 调整名著列表默认策略：无关键词和筛选时，默认优先返回 `现代文学/外国文学` 与 `近现代/外国`，减少文言文内容干扰；古典内容仍可通过筛选查看。
  - Web 端名著馆筛选项排序改为现代内容优先，并将页头文案明确为“默认优先展示近现代白话简体作品”。
  - 重写 `seed_classics` 的默认种子书目为白话/现代向（鲁迅、老舍及多本外国文学简体译本向条目），降低初始数据古文占比。
  - 已执行 `pnpm classics:seed` 完成一次迁移+seed，当前环境新增/更新了现代向书目与章节样本。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py server/internal/handler/classics_cover.go server/internal/handler/classics.go server/internal/handler/classics_recent.go server/scripts/seed_classics.go apps/web/src/pages/ClassicsList/index.tsx`：通过
  - `pnpm classics:seed`：通过（迁移 + seed 完成）
- 风险与后续：
  - 当前风险：若后续继续导入古典全量正文，默认列表仍会优先现代内容，但古典仍可通过筛选进入，需持续保持产品预期一致。
  - 下一步动作：可补一批“现代白话公版全文源”抓取规则（如鲁迅合集按篇导入），把当前种子样本文本升级为完整可读正文。
## 2026-04-20 21:21 (Asia/Shanghai)

- 任务：让“编辑资源信息”弹框左侧图片支持大图预览，并复用公共预览组件。
- 改动文件：
  - `apps/web/src/components/EditResourceDialog.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 `EditResourceDialog` 引入并接入公共 `ImagePreviewDialog`，不新增并行预览实现。
  - 左侧图片预览区改为可点击区域，增加“点击预览”提示，点击后打开统一的大图预览弹层。
  - 在资源切换/关闭时重置 `previewOpen`，避免弹层状态残留影响后续编辑。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/EditResourceDialog.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：预览展示仍以 `resource.url` 为主，若后端返回图链不可访问将显示加载失败（与现有预览行为一致）。
  - 下一步动作：如需更强健，可在预览失败时自动回退到 `thumbnailUrl`。

## 2026-04-20 21:51 (Asia/Shanghai)

- 任务：响应“要全文 + 分页要在页面实际可用”，补全现代白话书目全文导入入口并修正名著列表分页可见性。
- 改动文件：
  - `server/scripts/import_classics_fulltext.go`
  - `apps/web/src/pages/ClassicsList/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 全文导入脚本新增《呐喊》《彷徨》维基文库导入配置，抽取 `parseWikisourcePages` 公共逻辑复用，和《朝花夕拾》保持同一全文抓取路径。
  - 名著列表分页大小由 `20` 调整为 `6`，确保当前数据量下页面也能直接出现并使用“上一页/下一页”。
  - 触发一次定向全文导入命令：`CLASSICS_ONLY=朝花夕拾,呐喊,彷徨 pnpm classics:import-fulltext`，用于将样本章节替换为全文章节。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py server/scripts/import_classics_fulltext.go apps/web/src/pages/ClassicsList/index.tsx .codex/logs/CHANGE-LOG.md`：通过
  - `CLASSICS_ONLY=朝花夕拾,呐喊,彷徨 pnpm classics:import-fulltext`：未通过（`zh.wikisource.org` TLS handshake timeout）
- 风险与后续：
  - 当前风险：全文导入依赖上游源站可达性，当前网络到维基文库握手超时导致本轮未能完成落库。
  - 下一步动作：切换可达的镜像源或提升抓取容错（更长超时 + 退避重试 + 备用源），恢复后立即重跑定向导入。

## 2026-04-20 21:54 (Asia/Shanghai)

- 任务：修复名著列表分页接口“无筛选时查不到古典书目”的回归问题。
- 改动文件：
  - `server/internal/handler/classics.go`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 移除 `GetClassicsList` 中“无 keyword/category/dynasty 时仅返回现代/外国分类”的隐式过滤。
  - 保留现代内容优先排序，但恢复分页查询的全量书目可见性（含《三国演义》等古典书）。
- 校验：
  - `cd server && go test ./...`：通过
- 风险与后续：
  - 当前风险：无筛选时古典书会回到分页结果中，若需要“首页更白话”可在前端增加可见的默认筛选开关，避免后端隐式改语义。
  - 下一步动作：如你同意，可把“白话优先”做成前端可见的默认筛选 Tag（可一键清除），语义更直观。

## 2026-04-20 23:01 (Asia/Shanghai)

- 任务：修复“全文导入后出现繁体与特殊标记字符”的问题，并完成当前白话书单的全量章节导入。
- 改动文件：
  - `server/scripts/import_classics_fulltext.go`
  - `server/scripts/seed_classics.go`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 对维基文库来源改为 `action=render&variant=zh-hans` 抓取，新增渲染文本清洗流程，去掉 `&emsp;`、`<p ...>` 等 HTML/实体残留，正文统一落为简体展示文本。
  - 增加通用 Python 网络兜底抓取，解决 Go 原生请求在当前环境下对 wikisource/gutenberg 偶发 TLS/连接中断问题。
  - 新增/修正现代书单的全文来源与解析：`呐喊/彷徨` 章节页、`简爱/傲慢与偏见/了不起的盖茨比/月亮与六便士/鲁滨逊漂流记/巴斯克维尔的猎犬`，并修正《了不起的盖茨比》罗马数字章节解析（过滤目录区）。
  - 调整 seed 书单以对齐可稳定导入全文的书目（将无法稳定全量抓取的条目替换为可全量来源条目）。
  - 已执行两轮定向全文导入并完成落库：
    - `CLASSICS_ONLY=朝花夕拾,呐喊,彷徨 pnpm classics:import-fulltext`（成功，37 章）
    - `CLASSICS_ONLY=简爱,傲慢与偏见,了不起的盖茨比,月亮与六便士,鲁滨逊漂流记,巴斯克维尔的猎犬 pnpm classics:import-fulltext`（成功，202 章）
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm classics:seed`：通过
  - `CLASSICS_ONLY=朝花夕拾,呐喊,彷徨 pnpm classics:import-fulltext`：通过
  - `CLASSICS_ONLY=简爱,傲慢与偏见,了不起的盖茨比,月亮与六便士,鲁滨逊漂流记,巴斯克维尔的猎犬 pnpm classics:import-fulltext`：通过
- 风险与后续：
  - 当前风险：维基文库渲染页顶部可能仍有少量来源元信息行，当前已做通用清洗但个别作品模板格式变化时仍需补规则。
  - 下一步动作：可继续增加“导入后文本质量检查（首尾模板噪声探测）”脚本，导入后自动报警并回滚异常章节。

## 2026-04-20 23:32 (Asia/Shanghai)

- 任务：修复 unity-dungeon 运行时报错 `PlayerVisual AnimationEvent has no function name specified`。
- 改动文件：
  - `apps/unity-dungeon/Assets/Animation/PlayerIdle.anim`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 删除 `PlayerIdle.anim` 中空的 AnimationEvent（`functionName` 为空），将 `m_Events` 收敛为 `[]`。
  - 全量扫描 `apps/unity-dungeon/Assets/Animation` 与 `Assets/Resources`，确认不存在其他空 `functionName` 的动画事件。
- 校验：
  - `rg -n "functionName:\s*$|m_Events:" apps/unity-dungeon/Assets/Animation apps/unity-dungeon/Assets/Resources -S`：通过
- 风险与后续：
  - 当前风险：若后续在 Unity Editor 中再次手动添加空 AnimationEvent，运行时仍会复现同类报错。
  - 下一步动作：在 Unity 的 Animation 窗口中新增事件时，必须填写有效函数名或直接删除该事件点。

## 2026-04-21 16:09 (Asia/Shanghai)

- 任务：优化博客列表“详情返回列表”体验，减少整页刷新感并恢复阅读位置。
- 改动文件：
  - `apps/web/src/pages/blog/BlogList/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增列表结果内存缓存（按 `page/groupId/keyword/sort` 维度分桶），命中缓存时优先渲染，降低返回列表时的白屏与骨架屏概率。
  - 新增分组元数据缓存，避免短时间内重复请求分组数据。
  - 新增滚动位置持久化与恢复：按 `pathname + search` 写入 `sessionStorage`，仅在历史回退（`POP`）时恢复，避免普通导航误跳滚动位置。
  - 缓存策略为 30 秒 TTL：过期后继续后台拉新并以局部刷新方式更新。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogList/index.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：缓存仅在当前页面会话内生效，浏览器强刷（F5）后仍会重新请求。
  - 下一步动作：如需跨页面刷新保留列表体验，可把该缓存下沉到 `sessionStorage` 或引入统一查询缓存层（例如 React Query）。

## 2026-04-21 16:24 (Asia/Shanghai)

- 任务：将“返回列表体验优化”扩展到资源页与创作者页，统一列表浏览回退体验。
- 改动文件：
  - `apps/web/src/pages/Resources/index.tsx`
  - `apps/web/src/pages/Creator/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - `Resources` 新增按 `page/type/keyword/tagId` 分桶的内存缓存，命中缓存优先渲染，并在 30 秒 TTL 过期后执行静默拉新。
  - `Resources` 的手动“刷新”动作会同步覆盖缓存，保证后续回退命中的是最新结果。
  - `Creator` 新增按 `page/keyword` 分桶的内存缓存与 30 秒 TTL 策略；重试按钮会强制绕过缓存触发真实重拉。
  - 两个列表页均新增滚动位置保存与恢复：按 `pathname + search` 存储 `scrollY`，仅在 `POP`（历史回退）时恢复，避免普通前进跳转误恢复。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Resources/index.tsx apps/web/src/pages/Creator/index.tsx`：通过
- 风险与后续：
  - 当前风险：缓存为进程内内存缓存，浏览器强刷后仍会回到首轮请求路径。
  - 下一步动作：若需要跨 F5 保留体验，可把缓存下沉到 `sessionStorage` 或统一接入查询层（如 React Query）并配置 staleTime。

## 2026-04-21 20:36 (Asia/Shanghai)

- 任务：修复 /api/v1/user/classics/shelf 加入书架返回 500 的问题。
- 改动文件：
  - server/internal/handler/classics_shelf.go
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将书架写入逻辑从 ON CONFLICT 改为“先更新 updated_at，未命中再插入”的兼容流程，避免依赖数据库已存在复合唯一约束。
  - 对并发插入场景补充唯一冲突兜底：当插入触发重复键时回退为更新，保证接口幂等。
  - 保留原有参数校验与书籍可见性校验逻辑，避免行为回归。
- 校验：
  - cd server && go test ./...：通过
- 风险与后续：
  - 当前风险：若历史库中已存在同一用户同一书籍的重复脏数据，读接口仍可能返回重复 bookId。
  - 下一步动作：可补一条数据清理 SQL（按 user_id + book_id 去重）并补充唯一索引巡检脚本。

## 2026-04-21 20:58 (Asia/Shanghai)

- 任务：优化阅读库详情页阅读模式视觉层次，降低布局杂乱感。
- 改动文件：
  - apps/web/src/pages/ClassicsDetail/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 阅读模式背景由多重径向渐变改为更克制的纵向奶油渐变，减少视觉噪声。
  - 桌面端目录栏改为 sticky 卡片式侧栏（含固定高度与圆角边框），避免“抽屉感”导致的割裂。
  - 正文区容器由 max-w-4xl 提升到 max-w-5xl，并收紧内外边距，减少页面中心留白。
  - 顶部工具条与章节标题区做减法：增强书名截断表现、统一进度文案、优化正文卡片间距与标题尺度。
  - 上下章按钮改为双列等宽布局，阅读动线更稳定。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/ClassicsDetail/index.tsx：通过
- 风险与后续：
  - 当前风险：AI 面板仍采用较高信息密度，若用户主要关注纯阅读，仍可能感到干扰。
  - 下一步动作：可将 AI 伴读默认折叠为二级入口（例如抽屉或底部 sheet），进一步突出正文。

## 2026-04-21 21:04 (Asia/Shanghai)

- 任务：修复阅读库详情页阅读模式改版后出现的布局变形问题。
- 改动文件：
  - apps/web/src/pages/ClassicsDetail/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 为阅读模式恢复桌面端双栏容器：新增 max-w-[1180px] 的 lex 外层，目录栏与正文区回到同一布局流。
  - 修正正文区容器为 min-w-0 flex-1，避免侧栏存在时正文区域挤压错位。
  - 保留移动端目录抽屉逻辑，不影响小屏交互。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
- 风险与后续：
  - 当前风险：阅读页其余视觉细节仍需按你口味继续打磨，但不会再出现本次结构性变形。
  - 下一步动作：先确认这版结构恢复是否正常，再按你的方向逐项微调视觉。

## 2026-04-21 21:21 (Asia/Shanghai)

- 任务：彻底移除 classics / 阅读库模块。
- 改动文件：
  - apps/web/src/App.tsx
  - apps/web/src/layouts/Header.tsx
  - apps/admin/src/App.tsx
  - apps/admin/src/layouts/Layout.tsx
  - package.json
  - README.md
  - QUICK_START.md
  - server/internal/router/router.go
  - server/internal/database/database.go
  - server/migrations/019_drop_classics_tables.sql
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 移除 web 端阅读库路由、导航入口，以及 classics 相关页面 / API / hook 文件。
  - 移除 admin 端阅读库管理菜单、路由、页面与 API 文件。
  - 移除 server 端所有 classics handler、model、路由注册、导入脚本与旧迁移文件。
  - 删除根目录与文档中的 classics 命令说明，并新增一条 drop classics 表的迁移用于清理旧库。
- 校验：
  - pnpm --filter web exec tsc --noEmit：通过
  - pnpm --filter admin exec tsc --noEmit：通过
  - cd server && go test ./...：通过
  - python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/App.tsx apps/web/src/layouts/Header.tsx apps/admin/src/App.tsx apps/admin/src/layouts/Layout.tsx README.md QUICK_START.md .codex/logs/CHANGE-LOG.md：通过
- 风险与后续：
  - 当前风险：仓库历史变更记录 CHANGELOG.md 里仍保留 classics 的历史条目，这是历史记录而非现行模块代码。
  - 下一步动作：如需连历史数据库一起清掉，执行新增的 server/migrations/019_drop_classics_tables.sql。

## 2026-04-21 21:55 (Asia/Shanghai)

- 任务：排查并优化公开资源列表接口响应过慢的问题。
- 改动文件：
  - server/internal/handler/home.go
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 为公开资源列表与热门资源列表补充统一的批量响应组装逻辑，避免在循环里按资源逐条查询创作者用户信息。
  - 将收藏状态查询改为仅按“当前页资源 ID 集合”批量查询，避免把当前用户全部收藏记录读出后再内存过滤。
  - 复用 `Preload("User") + Preload("Tags")` 的一次性加载结果，减少远程数据库往返次数。
- 校验：
  - `cd server && go test ./...`：通过
- 风险与后续：
  - 当前风险：若数据库侧仍缺少适合公开列表排序的索引，后续数据量继续上涨时 `count + order by created_at` 仍可能成为下一阶段瓶颈。
  - 下一步动作：上线后观察 `/api/v1/public/resources` 的实际耗时；若仍偏慢，再补数据库 `EXPLAIN ANALYZE` 与索引优化。

## 2026-04-21 22:01 (Asia/Shanghai)

- 任务：继续压缩公开资源列表接口的数据库查询耗时。
- 改动文件：
  - server/internal/handler/home.go
  - server/migrations/020_optimize_public_resource_queries.sql
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将公开资源筛选条件从包含 `NULL/空字符串` 的 `OR` 表达式收紧为 `visibility = 'public'`，让数据库更容易稳定命中索引。
  - 新增资源公开列表复合索引 `visibility + deleted_at + created_at DESC`，优化公开列表的筛选与倒序分页。
  - 新增用户收藏状态查询复合索引 `user_id + deleted_at + resource_id`，优化当前页收藏状态的批量查询。
- 校验：
  - `cd server && go test ./...`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py server/internal/handler/home.go server/migrations/020_optimize_public_resource_queries.sql .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：新增索引文件需要在目标数据库真正执行后才会生效；如果线上库还没跑迁移，接口耗时不会明显下降。
  - 下一步动作：先在目标库执行 `server/migrations/020_optimize_public_resource_queries.sql`，再用同一个接口复测并对比日志耗时。

## 2026-04-21 22:10 (Asia/Shanghai)

- 任务：将公开资源列表改为更适合浏览场景的 `hasMore` 分页模式，降低首屏对 `total` 的依赖。
- 改动文件：
  - server/internal/handler/home.go
  - apps/web/src/api/resource.ts
  - apps/web/src/pages/Resources/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 公开资源接口改为取 `pageSize + 1` 条数据来计算 `hasMore`，首屏不再同步执行 `count(*)`。
  - Web 端资源页分页逻辑由 `totalPages` 切换为 `hasMore` 驱动，保留上一页 / 下一页浏览体验。
  - 顶部与列表状态文案调整为“当前页 / 本页条数”优先，只有服务端返回 `total` 时才展示总量。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Resources/index.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：公开资源接口若被其他页面直接依赖精确 `total`，这些调用方后续也应逐步切到 `hasMore` 或兼容 `total` 可选。
  - 下一步动作：观察资源广场首屏耗时；若仍需进一步提速，可继续给首页热门流和标签页也统一改成 `hasMore`。

## 2026-04-21 22:09 (Asia/Shanghai)

- 任务：回退公开资源列表的 `hasMore` 分页改造，恢复为精确 `total` 分页。
- 改动文件：
  - server/internal/handler/home.go
  - apps/web/src/api/resource.ts
  - apps/web/src/pages/Resources/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 公开资源接口恢复 `count(*) + total` 返回结构，不再以 `pageSize + 1` 推导 `hasMore`。
  - Web 端资源页恢复总数驱动的分页 UI 与顶部统计文案。
  - 仅回退本轮产品行为调整，保留前面已经生效的查询批量化与索引优化。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Resources/index.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：恢复 `total` 后，公开资源首屏仍会承担 `count(*)` 的远程数据库成本。
  - 下一步动作：若后续还要继续提速，更适合从缓存、区域、连接池或专门的统计缓存入手，而不是继续改分页交互。

## 2026-04-21 22:14 (Asia/Shanghai)

- 任务：为公开资源列表增加服务端短时内存缓存，并接上资源变更后的缓存失效。
- 改动文件：
  - server/internal/handler/home.go
  - server/internal/handler/admin_resource.go
  - server/internal/handler/resource_tag.go
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 为 `/api/v1/public/resources` 增加基于查询参数的 30 秒内存缓存，只缓存公共列表数据与总数。
  - 登录用户请求继续实时查询当前页 `isFavorited`，避免把用户态字段缓存脏掉。
  - 在资源上传、删除、批量删除、可见性修改、上传者修改、资源信息修改、标签修改后统一清空公开资源列表缓存。
- 校验：
  - `cd server && go test ./...`：通过
- 风险与后续：
  - 当前风险：这是单实例内存缓存；如果线上是多实例或冷启动实例，缓存命中会受实例切换影响。
  - 下一步动作：上线后观察同条件重复请求的耗时变化；若还需要更稳的命中率，再考虑迁移到 Redis / Upstash。

## 2026-04-21 22:47 (Asia/Shanghai)

- 任务：收口 Web 首轮移动端适配，优先修复首页、登录、注册和全局头部在小屏设备上的布局问题。
- 改动文件：
  - apps/web/src/components/AuthSplitLayout.tsx
  - apps/web/src/pages/Login/index.tsx
  - apps/web/src/pages/Register/index.tsx
  - apps/web/src/layouts/Header.tsx
  - apps/web/src/pages/Home/index.tsx
  - apps/web/src/pages/Home/components/HomeSectionBlocks.tsx
  - apps/web/src/pages/Home/components/HomeEnergyCore.tsx
  - apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx
  - .codex/skills/web-feature-iteration/WEB-TASKS.md
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 新增认证页共享壳子 `AuthSplitLayout`，统一登录/注册双栏布局，并补上移动端品牌卡、表单边距和验证码按钮换行策略。
  - Header 改为移动端双层结构，上层承载品牌与用户操作，下层使用可横滑导航，减少多个页面的横向溢出风险。
  - 首页收口 Hero、搜索条、资源焦点、统计块和展示舱在小屏下的字号、卡片圆角、按钮宽度与堆叠方式，并修复首页收藏按钮的乱码 `aria-label`。
  - Web 活跃任务清单新增并完成 `WRESP` 首轮移动端适配任务，同时补充下一步 `WRESP-4` 页面范围。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/AuthSplitLayout.tsx apps/web/src/pages/Login/index.tsx apps/web/src/pages/Register/index.tsx apps/web/src/layouts/Header.tsx apps/web/src/pages/Home/index.tsx apps/web/src/pages/Home/components/HomeSectionBlocks.tsx apps/web/src/pages/Home/components/HomeEnergyCore.tsx apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md`：通过
- 风险与后续：
  - 当前风险：`Creator / CreatorProfile / MySpace / MyResources / BlogPost` 等复杂内容页仍有独立的移动端密度和 sticky 布局问题，尚未纳入这轮代码改动。
  - 下一步动作：按 `WRESP-4` 继续逐页收口高复杂度页面，并结合真机或浏览器响应式模式补一轮视觉走查。

## 2026-04-21 23:03 (Asia/Shanghai)

- 任务：修正首轮移动端适配后的回归，恢复 PC 头部原有布局，并放宽首页移动端首屏宽度。
- 改动文件：
  - apps/web/src/layouts/Header.tsx
  - apps/web/src/pages/Home/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - Header 调整为桌面端保持单行导航，移动端单独渲染第二行横滑导航，避免 PC 头部被两层结构污染。
  - 首页在移动端取消过重的外层边距，Hero 与后续分区更接近满宽展示，同时保留桌面端原有容器节奏。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/layouts/Header.tsx apps/web/src/pages/Home/index.tsx`：通过
- 风险与后续：
  - 当前风险：这次主要修正的是头部和首页容器节奏，其它复杂页面的移动端密度问题仍需继续逐页检查。
  - 下一步动作：优先继续处理 `Creator / CreatorProfile / MySpace / MyResources / BlogPost` 的移动端宽度与侧栏策略。

## 2026-04-21 23:10 (Asia/Shanghai)

- 任务：继续修正移动端页面未占满视口的问题，收口 Web 根层宽度与滚动槽策略。
- 改动文件：
  - apps/web/src/index.css
  - apps/web/src/layouts/Layout.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 取消移动端 `html` 上的 `scrollbar-gutter: stable both-edges`，仅保留桌面端滚动槽预留，避免窄屏出现两侧被强行吃掉的空白。
  - 为 `body / #root / Layout` 补齐 `width: 100%` 与横向溢出约束，确保页面根容器按视口满宽展开。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/index.css apps/web/src/layouts/Layout.tsx`：通过
- 风险与后续：
  - 当前风险：如果后续还有某个具体页面仍显得偏窄，更可能是该页面自己的 `max-w / px / aside` 布局而不是根层问题。
  - 下一步动作：重新查看首页在移动端的实际占宽；若还有剩余问题，逐页检查 `Creator / CreatorProfile / BlogPost` 的独立容器约束。

## 2026-04-21 23:17 (Asia/Shanghai)

- 任务：将移动端头部导航从横滑入口改为汉堡导航，收口小屏导航模式。
- 改动文件：
  - apps/web/src/layouts/Header.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 为移动端 Header 增加汉堡按钮，点击后展开两列导航面板，替换掉原先横向滚动的一排入口。
  - 保持桌面端头部仍为单行导航，不影响 PC 现有导航节奏。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/layouts/Header.tsx`：通过
- 风险与后续：
  - 当前风险：当前汉堡菜单仍是轻量面板，如果后续导航项继续变多，可能需要升级为全屏抽屉式导航。
  - 下一步动作：结合真机宽度再看一轮操作密度，必要时补导航分组和账号快捷入口。

## 2026-04-21 22:22 (Asia/Shanghai)

- 任务：修复博客详情页“继续阅读”的上一篇 / 下一篇长期为空问题。
- 改动文件：
  - server/internal/handler/blog.go
  - apps/web/src/api/blog.ts
  - apps/web/src/pages/blog/BlogPost/index.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将上一篇 / 下一篇的计算从前端“只拉前 50 篇再找当前位置”改为后端详情接口直接返回相邻文章。
  - 相邻文章优先按当前分组时间线查找，若当前文章不在分组时间线中，再回退到全站公开博客时间线。
  - 博客详情页继续阅读区域改为直接消费详情接口中的 `prevPost` / `nextPost`，不再受老文章超出前 50 篇限制。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
- 风险与后续：
  - 当前风险：后端当前通过读取同时间线文章列表来定位相邻项，若未来公开博客量显著增加，可进一步改为更精确的 SQL 邻居查询。
  - 下一步动作：在几篇不同发布时间、不同分组的博客详情页手动验证上一篇 / 下一篇是否符合预期。

## 2026-04-22 11:18 (Asia/Shanghai)

- 任务：清理 Web 任务清单里已废弃的阅读库导入线（RLIB）残留项。
- 改动文件：
  - .codex/skills/web-feature-iteration/WEB-TASKS.md
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 从 Web 活跃 backlog 中移除整段 `RLIB` 主项及其 `RLIB-1 ~ RLIB-3` 子项，避免继续把已撤销方向保留在清单里。
  - 从“下一步建议”中删除 `RLIB-4`，让后续 Web 迭代只保留当前仍有效的任务方向。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次仅清理清单记录，不会自动移除仓库中其他非清单文档里对 `RLIB` 的历史提及。
  - 下一步动作：若后续还要做阅读库任务收口，可继续检查架构文档、注释或更新记录里是否还有已过期的 `RLIB` 语义残留。

## 2026-04-22 11:22 (Asia/Shanghai)

- 任务：清理 Web 任务清单里已撤销的名著/阅读库相关任务线。
- 改动文件：
  - .codex/skills/web-feature-iteration/WEB-TASKS.md
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 从活跃 backlog 中移除整段阅读库任务，以及顶部说明里遗留的名著任务编号说明。
  - 从“已完成”和“下一步建议”中删除所有名著/阅读库相关事项，只保留当前仍有效的 Web 迭代方向。
  - 顺手修正了 `WEB-TASKS.md` 顶部说明段落，把之前混入说明行的历史残留内容收回为正常文档结构。
- 校验：
  - `rg -n "名著|阅读库|CLD|CLR|CLAI|CLSEARCH|CLADMIN|CLSYNC|CLLANG|CLUI|classics|书架|双语" .codex/skills/web-feature-iteration/WEB-TASKS.md`：无结果
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/skills/web-feature-iteration/WEB-TASKS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次只清理了 Web 任务清单，不会自动同步删除架构文档、脚本或后端代码里的名著历史实现。
  - 下一步动作：如果你希望整仓库继续做语义收口，可以再扫一轮 docs、脚本和界面入口里的名著/阅读库残留。

## 2026-04-22 11:32 (Asia/Shanghai)

- 任务：完成 `WRESP-4`，继续收口创作者链路与博客详情页的移动端布局密度。
- 改动文件：
  - apps/web/src/pages/Creator/index.tsx
  - apps/web/src/pages/CreatorProfile/index.tsx
  - apps/web/src/pages/MySpace/index.tsx
  - apps/web/src/pages/MyResources/index.tsx
  - apps/web/src/pages/blog/BlogPost/index.tsx
  - .codex/skills/web-feature-iteration/WEB-TASKS.md
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 为 `Creator / MySpace` 收紧移动端外边距与 Hero 圆角，并把搜索区、操作按钮区改为小屏优先纵向排布，减少首屏按钮互相挤压。
  - 为 `CreatorProfile` 调整顶部 badge/tabs/搜索框/分页在小屏下的换行策略，避免仍按桌面按钮宽度强撑。
  - 为 `MyResources` 把桌面式固定侧栏改为移动端上置卡片布局，并让批量工具栏、分页和页头操作在手机上自动竖排。
  - 为 `BlogPost` 收紧移动端卡片内边距、问文章输入区布局，并隐藏小屏下重复的侧栏阅读状态卡，降低信息堆叠感。
  - 同步将 `WRESP-4` 从 Web 清单的“下一步建议”转为已完成记录。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Creator/index.tsx apps/web/src/pages/CreatorProfile/index.tsx apps/web/src/pages/MySpace/index.tsx apps/web/src/pages/MyResources/index.tsx apps/web/src/pages/blog/BlogPost/index.tsx .codex/skills/web-feature-iteration/WEB-TASKS.md`：通过
- 风险与后续：
  - 当前风险：这次主要收口的是布局密度与按钮换行，尚未做真机视觉回归，个别卡片在极窄宽度下仍可能需要继续微调字号或图片高度。
  - 下一步动作：优先转入 `ELP-2`，先把英语学习域 API 契约和数据模型草图定下来。

## 2026-04-22 11:43 (Asia/Shanghai)

- 任务：把提交阶段默认启用 `conventional-commit-guard` 的规则升级为仓库级强约束。
- 改动文件：
  - AGENTS.md
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 在项目 `场景强制 Skills` 中新增提交场景规则，明确只要生成 commit message、执行 `git commit`，或用户说“提交/提交吧/提交代码/帮我提交”，都必须启用 `conventional-commit-guard`。
  - 在 `变更约束` 中补充默认提交行为：先看最近 5 条提交风格，再生成提交信息；若用户未要求详细版，默认只允许一行简短中文 Conventional Commit。
  - 补充 Web 提交联动规则：Web 改动进入 `commit/push` 时，除 `conventional-commit-guard` 外还需联动 `web-update-log-guard`。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py AGENTS.md .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次是仓库协作约定层面的强约束，能约束后续 agent 行为，但不会改变已有 git hook 的校验逻辑。
  - 下一步动作：如果你还想把“提交/推送”进一步拆成更细的自动化约束，可以继续补充 `git-publish-guard` 的触发词与默认动作。

## 2026-04-22 20:45 (Asia/Shanghai)

- 任务：为首页 AI 中枢方向补一张可直接沟通视觉气质的暖金玻璃核心体草图。
- 改动文件：
  - apps/web/src/assets/concepts/valley-ai-core-sketch.svg
  - apps/web/src/assets/concepts/valley-ai-core-sketch.png
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 新增一张本地 `SVG` 概念草图，表现暖金玻璃外壳、发光内核、环绕轨道、粒子和底部语音波纹平台，方便继续确定首页中心 AI 物体方向。
  - 补生成一张同构图的 `PNG` 预览版本，便于在当前协作环境中直接查看整体气质，不受 `SVG` 预览限制影响。
  - 草图整体配色控制在奶油白、香槟金、暖粉点缀范围内，避免偏蓝紫赛博球，保持 Valley MAS 当前首页更温润的品牌基调。
- 校验：
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：这是一张概念草图，不等于最终前端实现稿；真正上首页时还需要再细化交互状态、动效层级和移动端占位比例。
  - 下一步动作：若方向确认，可以继续把这张草图拆成前端实现版结构图，或者直接开始做首页中枢组件改造。

## 2026-04-22 21:05 (Asia/Shanghai)

- 任务：把首页展示舱升级成可唤醒的 Valley AI 中枢，并按暖金玻璃核心体方向落到页面。
- 改动文件：
  - apps/web/src/pages/Home/components/HomeAICoreDialog.tsx
  - apps/web/src/pages/Home/components/HomeEnergyCore.tsx
  - apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 新增首页专用 `HomeAICoreDialog`，接入现有 `/ai/chat` 流式接口，让首页中枢不再只是装饰，而是可以直接发起对话的 AI 入口。
  - 重写 `HomeEnergyCore` 的左侧信息区，改成更明确的 `VALLEY AI CORE` 叙事，并补上可一键触发的提问 chips 和唤醒按钮。
  - 重构 `HeroImmersiveShowcase` 的中心视觉，从原来偏人形展示舱改为暖金玻璃核心体、环绕轨道和底部语音波纹，更贴合本轮确认的视觉方向。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/components/HomeAICoreDialog.tsx apps/web/src/pages/Home/components/HomeEnergyCore.tsx apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：首页 AI 中枢目前依赖登录后的 `/ai/chat` 接口，未登录用户可以看到入口和对话层，但真正发起对话时会引导登录。
  - 下一步动作：若这轮页面方向确认，可以继续补“AI 回答后给出站内跳转建议卡”或把中枢动效再往真实 3D 感推进一档。

## 2026-04-22 21:14 (Asia/Shanghai)

- 任务：修正首页 AI 中枢弹框被默认 `max-width` 压窄的问题。
- 改动文件：
  - apps/web/src/pages/Home/components/HomeAICoreDialog.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 为首页 AI 中枢弹框补上明确的 `max-w-[calc(100vw-1rem)]` 和 `sm:max-w-4xl`，覆盖共享 `DialogContent` 默认的 `sm:max-w-sm` 限制。
  - 保留小屏边距约束，同时让中大屏可以恢复预期的宽弹框展示。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
- 风险与后续：
  - 当前风险：这次只修了宽度约束，若你后面还想让弹框更像“横向工作台”，可以再继续调内部分栏比例和最小高度。
  - 下一步动作：如果你确认宽度已经正常，我再帮你继续收口弹框内部排版密度。

## 2026-04-22 21:23 (Asia/Shanghai)

- 任务：继续拉开首页 AI 中枢弹框的工作台宽度，并把中枢视觉收口到 Web 主题变量。
- 改动文件：
  - apps/web/src/pages/Home/components/HomeAICoreDialog.tsx
  - apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将首页 AI 中枢弹框从 `4xl` 级别继续放宽到更接近工作台的宽度，并把内部布局改成左侧说明更窄、右侧对话更宽的比例，同时提高最小高度，让对话区更舒展。
  - 将弹框和中枢视觉里的偏金黄硬编码颜色改为尽量依赖 `--theme-primary-rgb`、`--theme-secondary-rgb`、`theme-soft` 等现有主题变量，避免 AI 中枢脱离当前站点主题单独发黄。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/components/HomeAICoreDialog.tsx apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：`canvas` 绘制部分虽然已改为读取主题变量表达式，但真实视觉效果仍建议在不同主题下各看一眼，确认 `rose/ocean/forest/amber` 都不过亮或过灰。
  - 下一步动作：若你还觉得不够开阔，可以继续把弹框做成接近全屏的 `90vw` 中枢工作台，并补站内跳转卡。

## 2026-04-22 21:29 (Asia/Shanghai)

- 任务：修复首页 AI 中枢 canvas 动效直接使用 CSS 变量导致的运行时报错。
- 改动文件：
  - apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将 `canvas` 渐变和粒子使用的 `rgba(var(--theme-xxx-rgb), alpha)` 字符串改为先从运行时主题里读取真实 RGB 值，再拼成 `rgba(r,g,b,a)`，避免 `addColorStop` 无法解析 CSS 变量表达式。
  - 保留主题跟随能力，同时让 `canvas` API 能正确消费颜色值。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
- 风险与后续：
  - 当前风险：这次修复的是颜色字符串解析问题；如果后续还想让切换主题时动效立即重绘得更细致，可以再补主题变化时的显式重绘策略。
  - 下一步动作：确认页面恢复正常后，再继续看是否要把弹框做成更接近全屏的工作台。

## 2026-04-22 21:36 (Asia/Shanghai)

- 任务：降低首页 AI 中枢左侧信息区的拥挤感，让中枢视觉更透气。
- 改动文件：
  - apps/web/src/pages/Home/components/HomeEnergyCore.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将左侧三条长句 prompt 气泡改为更短的快捷入口标签，减少红框区域内的文字堆叠和多行换行。
  - 把说明性小字收回到主说明卡里，并增大左右区域的栅格比例与间距，让右侧核心视觉更突出、左侧留白更大。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/components/HomeEnergyCore.tsx .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：这次优先降了信息密度，未改变首页 AI 中枢的功能入口数量；如果你还想更极简，可以继续把左侧再收成“标题 + 一句说明 + 一个按钮”。
  - 下一步动作：如果你确认这一版更舒展了，再继续看要不要把右侧核心本身放大一档。

## 2026-04-22 21:43 (Asia/Shanghai)

- 任务：修正首页 AI 中枢右侧核心卡在大屏下被夹在中间、上下留白过多的问题。
- 改动文件：
  - apps/web/src/pages/Home/components/HomeEnergyCore.tsx
  - apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将首页 AI 中枢两栏布局从 `items-center` 调整为 `items-stretch`，避免右侧核心卡在左列更高时被垂直居中。
  - 显著提高 `HeroImmersiveShowcase` 的高度和内部核心体尺寸，让右侧视觉更接近满列展示，直接吃掉顶部和底部的空白区域。
  - 同步微调底部信息条位置与核心轨道尺寸，保证放大后比例仍然稳定。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/components/HomeEnergyCore.tsx apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：这次主要针对大屏首屏比例做了放大，极小宽度设备上虽然仍有断点保护，但最好再实际看一眼移动端视觉是否需要同步收口。
  - 下一步动作：如果你觉得这次已经不空了，再决定要不要把左侧也继续做成更精炼的标题型布局。

## 2026-04-22 21:52 (Asia/Shanghai)

- 任务：为首页 AI 中枢大圆球加入更明确的随鼠标“看向目标”的 3D 扭动感。
- 改动文件：
  - apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 在现有整体卡片倾斜之外，额外给球壳、高光、内核、内层光点和轨道环分别加入基于鼠标位置的偏移与旋转，让圆球本体会朝鼠标方向“看过去”。
  - 增加一层随视线轻微形变的内圈轮廓，强化这不是单纯平面位移，而是偏 3D 视差的感觉。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：这次是纯前端视觉层的 3D 拟态，还不是真正 WebGL 模型；如果继续加太多位移，可能会显得像“眼球”而不是“能量核心”，需要你看一眼手感是否刚好。
  - 下一步动作：如果这个方向对，可以继续补 hover 时的轻微呼吸和惯性回弹，让它更像有生命感的中枢。

## 2026-04-22 22:02 (Asia/Shanghai)

- 任务：按用户反馈撤回首页 AI 中枢的大圆球方案，恢复为更顺眼的展示舱造型。
- 改动文件：
  - apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 移除大圆球和“看向鼠标”的 3D 拟态实现，恢复为之前那版更轻巧的展示舱造型与动态粒子布局。
  - 保留首页 AI 中枢点击唤醒入口，不回退已接好的首页对话能力，只回退右侧视觉表现。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：这次是定向回退视觉方案，若后续还想增强 3D 感，建议只做轻微壳体视差，不再回到大圆球主体。
  - 下一步动作：确认这版恢复效果没问题后，再继续微调展示舱尺寸和与左侧文案区的比例。

## 2026-04-22 22:09 (Asia/Shanghai)

- 任务：继续降低首页 AI 中枢左侧内容密度，避免左侧信息量压住右侧展示舱。
- 改动文件：
  - apps/web/src/pages/Home/components/HomeEnergyCore.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 移除左侧快捷入口 chips 和厚说明卡，把左侧收成更轻的“标题 + 一句说明 + 一个主按钮”结构。
  - 进一步放宽两栏比例，让右侧展示舱获得更大的视觉权重，不再被左列的多块内容分散注意力。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/components/HomeEnergyCore.tsx .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：这次左侧已经收得很轻，如果你还想更干净，下一步就不该继续减文字，而是该放大右侧展示舱本体或缩短整体容器高度。
  - 下一步动作：确认这一版后，再决定是否继续放大右侧展示舱或收短外层容器高度。

## 2026-04-22 22:15 (Asia/Shanghai)

- 任务：修正首页 AI 中枢左侧文案和按钮被窄列挤压得过于拥挤的问题。
- 改动文件：
  - apps/web/src/pages/Home/components/HomeEnergyCore.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将左右列比例从更极端的右重布局稍微拉回，给左侧文案留出更自然的换行宽度。
  - 将左侧说明收短为一句更直接的引导语，并把主按钮文案从“唤醒 AI 中枢”缩短为“打开中枢”，同时略微收紧按钮内边距。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/components/HomeEnergyCore.tsx .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：这次主要修的是左列文字拥挤，不会改变右侧展示舱本身尺寸；如果还觉得整体不平衡，下一步应该调的是右侧卡片大小而不是继续压缩左侧文案。
  - 下一步动作：确认这次换行是否自然后，再决定是否轻微放大右侧展示舱。

## 2026-04-22 22:22 (Asia/Shanghai)

- 任务：按用户要求恢复首页 AI 区块左侧为原本的首页说明内容，只保留右侧展示舱点击弹窗能力。
- 改动文件：
  - apps/web/src/pages/Home/components/HomeEnergyCore.tsx
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 将左侧内容恢复为原来的 `HOME ENERGY CORE / 首页中枢` 结构、说明卡和辅助说明，不再把这一区域改造成 AI 专属介绍区。
  - 保留右侧 `HeroImmersiveShowcase` 的点击唤醒能力，让首页外部内容仍然照旧，只是在展示舱上新增 AI 弹窗入口。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/components/HomeEnergyCore.tsx .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：当前 AI 能力主要通过右侧展示舱触发，左侧已经不再显式强调 AI，如果后续想再强化可发现性，可以只在右侧展示舱里做更明显的 hover 提示。
  - 下一步动作：确认这版布局没问题后，再看是否只需微调右侧展示舱尺寸或 hover 文案。

## 2026-04-22 22:34 (Asia/Shanghai)

- 任务：把 `/ai/chat` 从本地 Ollama 链路切换到项目当前主用的火山 ARK 文本模型链路。
- 改动文件：
  - server/internal/handler/admin_ai_chat.go
  - server/.env.example
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 重写 `ChatWithAI`，改为复用现有 `readArkTextModelConfig` 与 `ensureSharedArkClient`，直接使用 `ARK_API_KEY / ARK_BASE_URL / ARK_TEXT_MODEL` 调用 ARK 文本模型。
  - 保留前端当前使用的同步/流式返回协议，让首页 AI 弹窗无需改接口协议就能继续工作，但不再依赖本地 `127.0.0.1:11434` 的 Ollama。
  - 更新 `server/.env.example` 的 AI Chat 配置说明，移除误导性的 Ollama 默认说明，并修正了 `AI_CHAT_SYSTEM_PROMPT` 的乱码示例值。
- 校验：
  - `cd server && go test ./...`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py server/.env.example .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：这次切换后 `/ai/chat` 依赖 `ARK_API_KEY` 和 `ARK_TEXT_MODEL` 正确配置；若本地或部署环境没配，会返回明确 `503`，不再回退到本地 Ollama。
  - 下一步动作：测试通过后，建议再做一次登录态首页 AI 弹窗的冒烟验证，确认流式响应在前端表现正常。

## 2026-04-22 22:45 (Asia/Shanghai)

- 任务：修正首页 AI 中枢弹框超出视口的问题，并提升首页入口类问题的回答贴合度。
- 改动文件：
  - apps/web/src/pages/Home/components/HomeAICoreDialog.tsx
  - server/internal/handler/admin_ai_chat.go
  - .codex/logs/CHANGE-LOG.md
- 关键改动：
  - 为首页 AI 中枢弹框增加视口高度上限，并把主内容区改成固定工作区高度，让长对话只在左右内容区内部滚动，不再把整个弹框撑出视口。
  - 强化 `/ai/chat` 的系统提示词：明确它是 Valley 的站内导航助手，已知首页存在内容页、资源页、创作者页、创作空间等主链路；当用户问“首页最近先点什么”时，不再优先回通用平台空话，也避免先说“我无法访问平台”。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：待执行
  - `cd server && go test ./...`：待执行
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/Home/components/HomeAICoreDialog.tsx .codex/logs/CHANGE-LOG.md`：待执行
- 风险与后续：
  - 当前风险：这次主要是通过系统提示词提升首页入口类问题的回答质量，它仍然不是基于实时数据库检索的 RAG，因此不会凭空知道最新具体标题，只会更贴合当前站内结构地回答。
  - 下一步动作：如果你还想继续提高“智能感”，下一步最有效的是把首页当前已加载的 featured 内容标题作为隐藏上下文一起传给 `/ai/chat`。

## 2026-04-23 21:50 (Asia/Shanghai)

- 任务：补上博客批量导入弹窗里对单条 MD 识别结果的移除操作。
- 改动文件：
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 为批量导入识别结果新增单条“移除”按钮，允许在真正批量创建前把不需要的 md 条目从列表里剔除。
  - 约束运行中和已创建成功的条目不可移除，避免界面状态与真实创建结果不一致。
  - 处理删除到空列表时的回退状态，让弹窗重新回到上传文件初始态。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/BlogCreate/index.tsx`：通过
- 风险与后续：
  - 当前风险：本次只补了单条移除入口，尚未增加“批量移除失败项”或“去重提示”等更进一步的导入整理能力。
  - 下一步动作：如果后续批量导入使用频率继续升高，可以再补“按状态筛掉失败项/重复项”的快捷操作。

## 2026-04-23 22:05 (Asia/Shanghai)

- 任务：让博客内容详情页的浏览器标签标题跟随文章标题显示。
- 改动文件：
  - `apps/web/src/pages/blog/BlogPost/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在博客详情页补充标题同步逻辑，文章加载完成后将浏览器标签更新为“文章标题 | Valley”。
  - 在标题尚未加载出来时继续保留“内容详情 | Valley”兜底，避免详情页初始状态出现空标题。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/blog/BlogPost/index.tsx`：通过
- 风险与后续：
  - 当前风险：这次只收口了博客详情页，资源详情和其他内容详情页仍然沿用各自的静态标题规则。
  - 下一步动作：如果你也希望资源详情或图文详情标签页更好区分，可以继续按同样方式补动态标题。

## 2026-04-24 17:28 (Asia/Shanghai)

- 任务：修复 web 图片预览器不能拖拽，并补上鼠标滚轮缩放交互。
- 改动文件：
  - `apps/web/src/components/ImagePreviewDialog.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将图片预览的拖拽事件从 `<img>` 本身切换到外层预览舞台，复用 pointer capture 方式，避免浏览器原生图片拖拽打断交互。
  - 修复鼠标松开后立即把位移重置为初始值的问题，让图片拖拽结束后保留当前位置。
  - 为预览舞台新增鼠标滚轮缩放，并阻止滚轮事件继续冒泡到弹窗外层。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/ImagePreviewDialog.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：本次拖拽位移仍未做边界约束，用户可以把图片拖到视口外较远位置，但可通过“复位”快速回到初始状态。
  - 下一步动作：如果你希望体验继续向专业图片查看器靠拢，可以再补“按缩放比例自动限制拖拽边界”和“按鼠标指针位置缩放”。

## 2026-04-24 22:59 (Asia/Shanghai)

- 任务：把 web 图片预览组件升级为带惯性拖拽，并让滚轮按光标位置缩放。
- 改动文件：
  - `apps/web/src/components/ImagePreviewDialog.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 为图片预览补上拖拽速度采样、松手后的惯性衰减，以及超出边界时的阻尼回弹，让预览移动手感更接近 antd Image 的预览体验。
  - 新增图片尺寸与预览舞台尺寸计算，在缩放、旋转、窗口变化后自动收敛位移，避免图片缩回去后还停在不可见区域。
  - 将滚轮缩放改为按鼠标当前位置做锚点缩放，让当前指向的图像区域在放大缩小时尽量保持在光标下方。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/ImagePreviewDialog.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：本次惯性和阻尼参数是按通用桌面手感调的，若后续觉得“甩动过头”或“回弹偏软”，还需要在真实页面上再微调系数。
  - 下一步动作：如果你还希望继续贴近专业看图器体验，可以再补双击定点放大、触控板 pinch 或移动端双指缩放。

## 2026-04-24 23:23 (Asia/Shanghai)

- 任务：为资源批量上传补上失败项单独重传和单项移除能力。
- 改动文件：
  - `apps/web/src/components/BatchUploadResourceDialog.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 抽出单项上传复用逻辑，让批量上传和失败项单独重传走同一条资源上传链路，避免两套行为分叉。
  - 为失败项新增“重新上传”按钮，允许不重跑整批任务时单独补传某一张失败图片。
  - 把单项“移除”入口整理到每个未成功资源项的状态区里，便于直接从批量列表剔除不想继续处理的图片。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/BatchUploadResourceDialog.tsx`：通过
- 风险与后续：
  - 当前风险：单项重传仍会沿用当前批量弹窗上方统一设置的资源类型与可见范围，如果用户在失败后改了全局选项，重传会按最新设置重新上传。
  - 下一步动作：如果你希望失败项完全锁定初次上传时的配置，可以再把类型和可见范围固化到每个资源项自身。

## 2026-04-24 23:41 (Asia/Shanghai)

- 任务：修复博客批量创建时公用壁纸封面未转存，导致后续编辑重复上传的问题。
- 改动文件：
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在批量创建博客时，为“已设置封面但尚无 coverStorageKey”的条目补上按 URL 转存博客封面的步骤，再携带转存后的 `cover` 与 `coverStorageKey` 创建博客。
  - 批量条目在转存成功后会立即回写新的封面地址与存储键，避免同一条博客创建失败重试或后续进入编辑页时再次重复上传同一张公用壁纸。
  - 批量创建失败时同步收口封面上传中的临时状态，避免列表项停留在假性 `coverUploading`。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/BlogCreate/index.tsx`：通过
- 风险与后续：
  - 当前风险：这次只修了批量博客创建入口，单篇创建与编辑仍沿用各自已有的封面转存逻辑，但它们当前路径本身是正常的。
  - 下一步动作：如果你希望继续降低封面上传耗时，可以再把“同一资源壁纸多次转存”收口成带幂等或复用缓存的封面上传机制。

## 2026-04-25 00:03 (Asia/Shanghai)

- 任务：修复资源上传慢、超时后重复创建，以及断网/关页后后台仍继续建资源的问题。
- 改动文件：
  - `server/internal/handler/admin_resource.go`
  - `server/internal/service/upload_service.go`
  - `server/internal/utils/tos.go`
  - `server/internal/model/model.go`
  - `server/internal/router/router.go`
  - `server/migrations/021_add_resource_upload_idempotency.sql`
  - `apps/web/src/api/resource.ts`
  - `apps/web/src/utils/resourceUpload.ts`
  - `apps/web/src/components/UploadResourceDialog.tsx`
  - `apps/web/src/components/BatchUploadResourceDialog.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 后端资源上传改为透传 `c.Request.Context()` 到上传服务和 TOS SDK，请求取消后会停止上传，并在对象已上传但请求已取消时先清理存储对象，再终止后续 `db.Create`。
  - 为资源表补上 `upload_key` 与 `file_hash` 字段，并在上传接口中加入“同用户 + uploadKey”幂等返回、“同用户 + file_hash + 短时间窗口”去重回收，避免超时重试或重复点击后生成多条重复资源。
  - Web 端为资源上传单独放宽到 5 分钟超时，并给单传/批量上传统一接入 `uploadKey`、上传状态回查接口和“上传结果确认中”状态，减少超时后误判失败导致的重复重试。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/UploadResourceDialog.tsx apps/web/src/components/BatchUploadResourceDialog.tsx apps/web/src/api/resource.ts apps/web/src/utils/resourceUpload.ts server/internal/handler/admin_resource.go server/migrations/021_add_resource_upload_idempotency.sql .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：`021_add_resource_upload_idempotency.sql` 已补齐，但线上要真正生效仍需要执行迁移；未执行迁移前，后端代码里的幂等和去重只能部分依赖运行时逻辑，无法获得数据库唯一约束兜底。
  - 下一步动作：上线前先执行迁移并验证现网数据库版本；如果后面还想进一步压缩上传等待感，可以继续把上传改成异步任务或分片上传。

## 2026-04-25 00:25 (Asia/Shanghai)

- 任务：修复资源上传幂等字段引入后，`AutoMigrate` 在旧数据回填前提前创建唯一索引导致启动失败的问题。
- 改动文件：
  - `server/internal/model/model.go`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 移除 `Resource.UploadKey`、`Resource.FileHash` 以及相关复合索引的 GORM 自动索引标签，避免 `AutoMigrate` 在旧数据仍为默认空值时抢先创建唯一索引。
  - 将上传幂等相关唯一约束继续收口到 `021_add_resource_upload_idempotency.sql`，保证执行顺序保持为“先补列与回填，再建索引”。
- 校验：
  - `cd server && go test ./...`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py server/internal/model/model.go .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：如果数据库已经被 `AutoMigrate` 补过列但还没执行 SQL 迁移，`upload_key` 仍可能保留为空字符串，需要继续执行 `021_add_resource_upload_idempotency.sql` 完成回填和索引创建。
  - 下一步动作：重启前先跑这条 SQL 迁移，再验证资源公开列表接口与上传接口都恢复正常。

## 2026-04-25 00:36 (Asia/Shanghai)

- 任务：修复博客编辑后返回列表仍显示旧内容、列表没有及时刷新的问题。
- 改动文件：
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `apps/web/src/pages/MyPosts/index.tsx`
  - `apps/web/src/pages/blog/BlogList/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 博客编辑成功后不再依赖 `navigate(-1)` 回退历史页，而是明确跳回内容管理页并携带刷新标记，避免返回到旧页面状态时仍沿用旧列表数据。
  - 内容管理页新增对刷新标记的消费逻辑，接收到编辑页返回信号后会主动重新请求博客与图文列表，再清掉路由 state。
  - 移除公开博客列表页的内存缓存与分组缓存，保证从详情或编辑链路返回 `/blog` 时直接请求最新数据，不再复用 30 秒内的旧结果。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/BlogCreate/index.tsx apps/web/src/pages/MyPosts/index.tsx apps/web/src/pages/blog/BlogList/index.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：关闭博客列表页缓存后，频繁切换筛选或来回进入列表时会多发一些请求，但优先保证了编辑后的内容正确性。
  - 下一步动作：如果后面还想兼顾性能，可以再把博客列表缓存改成“仅前进浏览使用，编辑/发布后显式失效”的可控失效方案。

## 2026-04-25 11:18 (Asia/Shanghai)

- 任务：修复博客编辑页手动粘贴 Markdown 时代码块等语法没有被正确识别的问题。
- 改动文件：
  - `apps/web/src/components/blog/MdxMarkdownEditor.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将编辑器粘贴时的 Markdown 判定从“只识别少量代码块语法”扩展为同时识别围栏代码块、标题、列表、引用、表格、分隔线、链接、图片和常见行内格式，避免整段 Markdown 手动粘贴时退回默认富文本粘贴。
  - 为粘贴接管增加文件类剪贴板保护，图片或文件粘贴继续沿用编辑器默认行为，避免误拦截非文本输入。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/MdxMarkdownEditor.tsx`：通过
- 风险与后续：
  - 当前风险：这次采用的是启发式 Markdown 识别，极少数恰好命中 Markdown 特征的普通纯文本粘贴，也会被按 Markdown 片段插入。
  - 下一步动作：如果后面还观察到误判，可以继续把判定收口成“多特征组合”或补一个“按原文粘贴”入口。

## 2026-04-25 11:27 (Asia/Shanghai)

- 任务：在内容管理页补一个“批量导入 MD”入口，并复用现有博客批量导入流程。
- 改动文件：
  - `apps/web/src/pages/MyPosts/index.tsx`
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 `/my-space/posts` 顶部操作区新增“批量导入 MD”按钮，让创作者可以从内容管理页直接进入批量导入博客流程。
  - 通过路由 state 给博客创建页补上“进入页面后自动打开批量导入弹窗”的轻量接线，继续复用 `BlogCreate` 里已有的批量识别、封面处理和批量创建逻辑，避免复制一套新实现。
  - 从内容管理页跳转时会把当前博客分组筛选作为批量导入弹窗的初始分组，减少创作者重复切换分组的操作。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/MyPosts/index.tsx apps/web/src/pages/BlogCreate/index.tsx`：通过
- 风险与后续：
  - 当前风险：这次入口仍然是“跳到博客创作页后自动打开弹窗”，还不是在内容管理页内原地弹出；但导入逻辑只有一份，后续维护成本更低。
  - 下一步动作：如果你后面想要更顺滑，可以再把批量导入对话框抽成共享组件，直接挂到 `/my-space/posts` 原地打开。

## 2026-04-25 11:42 (Asia/Shanghai)

- 任务：把博客批量导入能力抽成共享组件，并让内容管理页原地复用同一套弹框。
- 改动文件：
  - `apps/web/src/components/blog/BatchMarkdownImportDialog.tsx`
  - `apps/web/src/utils/blogImport.ts`
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `apps/web/src/pages/BlogCreate/utils.ts`
  - `apps/web/src/pages/MyPosts/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `BatchMarkdownImportDialog` 共享组件，把批量导入 MD、正文识别、封面选择、批量创建博客的整条流程统一收口，避免 `BlogCreate` 和内容管理页各维护一套实现。
  - 将 `createAutoExcerpt`、`parseMarkdownImport` 提取到 `apps/web/src/utils/blogImport.ts`，让博客创建页和批量导入组件共用同一份 Markdown 解析与摘要生成逻辑。
  - `/my-space/posts` 顶部“批量导入 MD”按钮改为在当前页直接打开共享弹框；新建博客页也切回复用这个组件，不再通过跳转页面再间接打开弹框。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/BatchMarkdownImportDialog.tsx apps/web/src/pages/BlogCreate/index.tsx apps/web/src/pages/MyPosts/index.tsx apps/web/src/pages/BlogCreate/utils.ts apps/web/src/utils/blogImport.ts .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：共享组件目前仍然只覆盖“博客”批量导入，如果后面图文也要引入类似导入能力，还需要再评估是否继续抽象通用内容导入框架。
  - 下一步动作：如果你希望继续顺手优化，可以再把“批量导入成功后自动高亮新创建博客”也补到内容管理页里。

## 2026-04-25 11:48 (Asia/Shanghai)

- 任务：优化博客批量导入弹框顶部设置区，缓解分组选择区域过于拥挤的问题。
- 改动文件：
  - `apps/web/src/components/blog/BatchMarkdownImportDialog.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将“批量发布设置”区域调整为更宽松的响应式布局，常见窗口宽度下优先避免等宽双列硬挤，超宽时再恢复左右分栏。
  - 为“目标分组”和“可见范围”各自补上独立的卡片容器、更多内边距与更高的内容区，让标签换行和滚动区更自然。
  - 将当前发布目标摘要独立为单独一行的信息条，避免和分组标签争抢顶部空间。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/BatchMarkdownImportDialog.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：当分组数量继续明显增长时，弹框顶部仍会依赖滚动容器承载全部标签，只是当前密度已经比之前舒展很多。
  - 下一步动作：如果后面分组越来越多，可以再把这里升级成“可搜索分组选择器”而不是纯标签墙。

## 2026-04-25 11:49 (Asia/Shanghai)

- 任务：修复批量上传资源时，单项 AI 标题/标签分析在条目被移除后仍按旧索引回写，导致结果串到其他资源上的问题。
- 改动文件：
  - `apps/web/src/components/BatchUploadResourceDialog.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 为批量上传资源弹框新增基于 `uploadKey` 的稳定条目定位与查询方法，单项 AI 起名、单项 AI 标签、批量 AI 起名、批量 AI 标签都不再依赖数组索引回写结果。
  - 当 AI 请求返回时，会先确认目标条目是否仍存在；如果用户已经把该资源移除，则直接忽略迟到结果，不再修改当前列表里其他资源的标题或标签。
  - 顺手为单项 AI 操作补了空条目保护，避免极端情况下点击事件滞后导致的空引用。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/BatchUploadResourceDialog.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次修的是前端回写错位问题，后台 AI 请求本身仍会继续执行，尚未做到真正的请求取消。
  - 下一步动作：如果后面想进一步节省后端资源，可以再把资源上传弹框的 AI 请求接入 `AbortController` 或请求级取消能力。

## 2026-04-25 11:58 (Asia/Shanghai)

- 任务：修复博客编辑器手动粘贴 Markdown 时，Windows 剪贴板换行符导致代码块语言和换行格式异常的问题。
- 改动文件：
  - `apps/web/src/components/blog/MdxMarkdownEditor.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `normalizeMarkdownPaste`，在实际调用 `insertMarkdown(...)` 前先移除 BOM 并将 `CRLF/CR` 统一规范为 `LF`。
  - 让 Markdown 粘贴识别和真正插入都基于同一份规范化文本，避免 fenced code block 在 Windows 复制场景下出现语言丢失、换行被压成一行的问题。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/MdxMarkdownEditor.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次主要针对换行符链路做修复；如果后面还存在某些特定 Markdown 片段在富文本光标位置插入异常，需要继续看 `insertMarkdown` 本身的上下文插入行为。
  - 下一步动作：如果你复测后仍有个别片段异常，我下一步会继续把“代码块粘贴”单独改成更强的插入策略，而不只依赖当前通用插入接口。

## 2026-04-25 12:07 (Asia/Shanghai)

- 任务：继续修复从聊天/网页复制 Markdown 到博客编辑器时，代码块仍未按预期格式化的问题。
- 改动文件：
  - `apps/web/src/components/blog/MdxMarkdownEditor.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增基于 `text/html` 的剪贴板恢复逻辑，当复制内容里包含 `<pre><code>` 时，会优先把 HTML 结构重建成 fenced markdown，再交给编辑器插入。
  - 从代码块节点的 `language-* / lang-*` class 中恢复代码语言标识，避免“复制的是网页渲染结果，但粘贴时语言信息丢失”的情况。
  - `text/html` 不可用时仍会回退到原有 `text/plain` 规范化链路，保持普通 Markdown 粘贴兼容。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/MdxMarkdownEditor.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次主要覆盖 HTML 剪贴板里带 `<pre><code>` 的场景；如果某些来源既不给规范的 `text/plain`，也不给可恢复的 `text/html`，仍可能落到编辑器默认粘贴行为。
  - 下一步动作：如果你复测后依然失败，我下一步会直接在本地加粘贴调试日志，精确看你当前剪贴板源到底给了什么 MIME 内容。

## 2026-04-25 11:17 (Asia/Shanghai)

- 任务：下线 Web 端公共“更新日志”板块，移除不再需要的入口与页面实现。
- 改动文件：
  - `apps/web/src/layouts/Header.tsx`
  - `apps/web/src/App.tsx`
  - `apps/web/src/pages/SystemUpdates/index.tsx`
  - `apps/web/src/api/systemUpdate.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 移除公共站点头部导航中的“更新日志”入口，避免继续向用户暴露低价值页面。
  - 将旧的 `/updates` 路由改为直接回到首页，兼容历史书签或外部旧链接，不让用户落到孤立空页。
  - 删除 Web 端更新日志页面与其专用接口封装，清理已经失去入口的死代码。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：后台系统更新日志管理与服务端接口仍保留，当前只是公共 Web 展示下线；如果后续决定彻底废弃，还可以再清理 admin 与 server 侧实现。
  - 下一步动作：观察一段时间是否还需要把“版本动态”合并进首页公告、通知或别的更轻量入口。

## 2026-04-25 11:21 (Asia/Shanghai)

- 任务：彻底下线系统更新日志功能，移除 admin 与 server 侧残留实现。
- 改动文件：
  - `apps/admin/src/App.tsx`
  - `apps/admin/src/layouts/Layout.tsx`
  - `apps/admin/src/pages/SystemUpdates.tsx`
  - `apps/admin/src/api/system-update.ts`
  - `server/internal/router/router.go`
  - `server/internal/database/database.go`
  - `server/internal/model/model.go`
  - `server/internal/handler/system_update.go`
  - `server/migrations/022_drop_system_updates.sql`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 移除 admin 端“系统更新日志”菜单、页面和接口封装，并将旧的 `/system-updates` 后台地址改为回到 `/dashboard`，避免历史入口落到空白页。
  - 删除 server 侧公开与后台的系统更新日志接口、模型定义以及自动迁移注册，彻底清掉这条已废弃功能链路。
  - 新增 `022_drop_system_updates.sql`，用于在数据库侧删除不再需要的 `system_updates` 表。
- 校验：
  - `cd server && go test ./...`：通过
  - `pnpm --filter admin exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/admin/src/App.tsx apps/admin/src/layouts/Layout.tsx server/internal/router/router.go server/internal/database/database.go server/internal/model/model.go .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：`022_drop_system_updates.sql` 需要在线上数据库执行后，`system_updates` 表才会真正删除；在执行前，库里旧数据仍会保留但已无代码路径使用。
  - 下一步动作：如果准备发布这轮清理，记得把 `022_drop_system_updates.sql` 一起纳入部署迁移流程。

## 2026-04-25 12:16 (Asia/Shanghai)

- 任务：继续修复博客编辑器手动粘贴 Markdown 时，fenced code block 被插成单行且语言退回纯文本的问题。
- 改动文件：
  - `apps/web/src/components/blog/MdxMarkdownEditor.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 确认 `@mdxeditor/editor` 的 `insertMarkdown(...)` 属于基于当前选区节点的上下文导入，不适合稳定插入整段 fenced code block。
  - 为“包含代码块的 Markdown 粘贴”新增合成 HTML paste 通道：先用 `marked` 把 Markdown 转成 HTML，再通过带 `text/html` 的合成粘贴事件交还给编辑器原生 DOM 导入链路处理。
  - 保留普通 Markdown 场景的 `insertMarkdown(...)` 回退逻辑，并用内部 MIME 标记避免合成粘贴被本地 paste 监听器重复拦截。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/MdxMarkdownEditor.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次修复依赖浏览器支持 `DataTransfer` 与合成 paste 事件；现代桌面浏览器通常可用，但仍建议你在实际博客编辑页再复测一次目标样例。
  - 下一步动作：如果你那边复测仍异常，我下一步会直接把 paste 时拿到的 MIME 类型和重建后的 HTML 临时打到控制台，继续精确定位浏览器兼容差异。

## 2026-04-25 12:30 (Asia/Shanghai)

- 任务：继续修复博客编辑器手动粘贴 Markdown 时，代码块内容被压成单行的问题。
- 改动文件：
  - `apps/web/src/components/blog/MdxMarkdownEditor.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 放弃继续依赖 `insertMarkdown(...)` 处理含代码块的 Markdown 粘贴，改为在 MDXEditor 内部注册 `PASTE_COMMAND`，优先拦截包含 fenced code block 的粘贴内容。
  - 新增基于 fenced code block 的分段解析，将普通文本段落拆成段落节点，将代码段直接创建为真正的 `CodeBlockNode`，保留原始多行代码内容与语言标记。
  - 外层原有 paste 监听保留给普通 Markdown 场景，且在事件已被内部命令处理时直接跳过，避免双重插入。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/MdxMarkdownEditor.tsx`：通过
- 风险与后续：
  - 当前风险：当前“含代码块”的专用插入会把代码块外的普通文本按段落文本插入，优先保证代码多行结构正确；复杂列表、表格等高级 Markdown 结构在这条专用链路里还没有完全恢复富文本语义。
  - 下一步动作：如果你复测确认代码块换行已经正常，但还希望同一段粘贴里的列表/标题也完整保留，我下一步再把这条专用导入升级成更完整的 Markdown 节点映射。

## 2026-04-25 12:38 (Asia/Shanghai)

- 任务：继续优化博客编辑器代码块粘贴体验，修复空白行显示红点并补上语言归一化/推断。
- 改动文件：
  - `apps/web/src/components/blog/MdxMarkdownEditor.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `normalizeCodeBlockCode`，在代码块写入节点前清理零宽字符，并把“只包含空格/不可见空白”的空白行还原成真正空行，避免 CodeMirror 把这些行显示成 `cm-specialChar` 小红点。
  - 新增 `normalizeCodeBlockLanguage` 和 alias 语言表，把 `javascript/typescript/shell/plaintext` 等写法统一归一到 `js/ts/bash/txt` 等 canonical key。
  - 新增 `inferCodeBlockLanguage`，当 fenced code block 没有显式语言时，会按 JSON / HTML / TypeScript / JavaScript / Python / SQL / YAML / Bash 做轻量推断；显式 fence 语言存在时仍以 fence 为准。
  - 将 `codeMirrorPlugin` 的语言配置改成带 alias 的 `CodeBlockLanguage[]`，让语言下拉和自动加载语法高亮能识别更多等价写法。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：当前语言推断是轻量启发式，优先解决常见博客代码片段；极少数跨语言或语法非常接近的片段，仍可能需要用户手动切换语言。
  - 下一步动作：如果你后面还希望进一步增强准确率，我可以继续补 `go/rust/java/vue` 等更多语言规则，或者把语言选择器直接放进博客编辑器工具栏里。

## 2026-04-25 22:10 (Asia/Shanghai)

- 任务：修复博客编辑器在代码块粘贴修复后，标题、列表等其他 Markdown 粘贴不再生效的问题。
- 改动文件：
  - `apps/web/src/components/blog/MdxMarkdownEditor.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 放弃“代码块走手动节点、其他 Markdown 走外层 DOM `insertMarkdown(...)`”的分叉方案，改为统一在编辑器内部 `PASTE_COMMAND` 中接管所有 Markdown 粘贴。
  - 新增 `normalizeMarkdownCodeBlocks`，在整段 Markdown 导入前统一净化 fenced code block 的空白行与语言标记，同时保留标题、列表、引用等其他 Markdown 结构原文。
  - 改为使用 MDXEditor 运行时暴露的 `importMarkdownToLexical(...)`，以 root 级上下文导入 Markdown 后再插入节点，避免 selection 上下文导致的代码块挤压，也恢复普通 Markdown 结构的正确导入。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/MdxMarkdownEditor.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次方案依赖 `@mdxeditor/editor` 当前版本对运行时导入接口的暴露；后续若库版本大改，需要再看这一层兼容性。
  - 下一步动作：如果你后面还遇到某一类特殊 Markdown 来源粘贴异常，我优先继续补这条导入链路；只有在这类基础行为长期不稳定时，再考虑整体替换编辑器。

## 2026-04-25 22:39 (Asia/Shanghai)

- 任务：将博客创作页 Markdown 编辑器从 `@mdxeditor/editor` 替换为 `Milkdown/Crepe`，恢复稳定的 Markdown 粘贴与代码块编辑体验。
- 改动文件：
  - `apps/web/src/components/blog/MdxMarkdownEditor.tsx`
  - `apps/web/src/components/blog/mdx-editor.css`
  - `apps/web/src/main.tsx`
  - `apps/web/package.json`
  - `pnpm-lock.yaml`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 保留 `MdxMarkdownEditor` 组件入口不变，内部改为基于 `Crepe` 初始化编辑器，并通过 `replaceAll(...)` 补齐外部 `value` 到编辑器内容的双向同步。
  - 启用 `Milkdown` 自带的 `TopBar` 与 `clipboard` Markdown 解析链路，让标题、列表、引用、代码块等复制粘贴时统一按 Markdown 结构落入编辑器。
  - 重写博客编辑器样式入口，接入 `@milkdown/crepe` 官方主题 CSS，再用本地主题 token 覆盖顶部工具栏、正文排版、代码块和语言选择器，保持当前站点风格一致。
  - 显式增加 `@milkdown/kit` 依赖，并移除不再使用的 `@mdxeditor/editor` 样式接线。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/MdxMarkdownEditor.tsx apps/web/src/components/blog/mdx-editor.css apps/web/src/main.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次完成的是编辑器内核替换与样式接入，实际交互观感仍建议你在博客创作页再手动复测几组典型 Markdown 样例，重点看长文、表格和多代码块混排场景。
  - 下一步动作：如果你复测后还想进一步收紧工具栏布局或补更贴近产品的快捷操作，我可以基于 `Milkdown` 继续精调顶部工具栏项和代码块表现。

## 2026-04-25 22:54 (Asia/Shanghai)

- 任务：修复 Milkdown 编辑器样式冲突与悬浮菜单裁切，并让“已发布文章保存草稿”不再影响公开博客列表。
- 改动文件：
  - `apps/web/src/components/blog/mdx-editor.css`
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `server/internal/handler/blog.go`
  - `server/internal/model/blog.go`
  - `server/migrations/023_add_post_draft_data.sql`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 去掉博客编辑器外层对 Milkdown 的 `overflow: hidden` 裁切，并把列表样式从全局 `li/marker` 覆盖收回到 `milkdown-list-item-block`，避免左侧悬浮菜单被截断、列表序号与项目符号错位。
  - 为 `posts` 增加 `draft_data` / `draft_updated_at`，当已发布文章执行“保存草稿”时，不再把正式文章状态改成 `draft`，而是把编辑中的标题、正文、摘要、封面、分组等内容存入草稿快照。
  - 管理端文章详情读取时优先回填草稿快照；真正点击发布时再把当前编辑内容写回正式字段并清空草稿快照，保证公开博客列表继续使用已发布版本。
  - 补上草稿资源清理逻辑，避免删除文章或发布时遗留只存在于草稿里的封面/图文资源。
  - 调整博客编辑页提示语，已发布文章保存草稿时明确提示“当前线上正文未受影响”。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `cd server && go test ./...`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/mdx-editor.css apps/web/src/pages/BlogCreate/index.tsx server/internal/handler/blog.go server/internal/model/blog.go server/migrations/023_add_post_draft_data.sql .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：`draft_data` 依赖新增数据库字段，部署前需要执行本次新增的迁移；未迁移时保存草稿会缺列失败。
  - 下一步动作：建议你在博客编辑页重点回归三组场景：列表排版、左侧悬浮菜单、已发布文章“保存草稿后公开页仍保持旧版本，点击发布后才切新版本”。

## 2026-04-25 23:05 (Asia/Shanghai)

- 任务：继续收敛博客编辑页的所见即所得样式，并为 Milkdown 左侧悬浮操作留出更合理的写作区空间。
- 改动文件：
  - `apps/web/src/components/blog/mdx-editor.css`
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将编辑页 split 布局调整为更偏向写作区的列比例，并增加写作区容器内边距，缓解正文区域过窄导致的拥挤感。
  - 为 Milkdown 的 `ProseMirror` 内容区增加左侧 gutter padding，同时提高 slash menu 层级并微调 block handle 外侧间距，让左侧悬浮加号/拖拽按钮有实际落位空间。
  - 为博客编辑页预览区新增 `valley-md-preview-body` 局部样式，和编辑区统一标题层级、段落、列表、引用、行内代码、代码块、链接与表格观感，避免预览和编辑两边像两套主题。
  - 保持这次样式收敛只作用于博客编辑页预览，不直接影响站内其他公共 Markdown 展示页。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/mdx-editor.css apps/web/src/pages/BlogCreate/index.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次主要解决的是编辑页视觉一致性与左侧操作空间，若后续还要进一步做到“预览像最终博客详情页”，可能需要再抽一层真正共享的 Markdown typography token。
  - 下一步动作：建议你继续在编辑页重点看两类内容是否满意：多级标题/列表，以及左侧 block handle 在普通段落、代码块前的停靠位置。

## 2026-04-25 23:14 (Asia/Shanghai)

- 任务：移除博客创建页的实时预览区域，只保留编辑区与发布设置。
- 改动文件：
  - `apps/web/src/pages/BlogCreate/index.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 删除博客创建页顶部的编辑/分屏/预览切换按钮，不再保留预览模式状态。
  - 移除实时预览面板与对应的 `MarkdownPreview` / `previewMarkdown` 链路，页面聚焦为“左侧写作 + 右侧发布设置”。
  - 将主布局固定为更偏向写作区的双栏结构，避免去掉预览后页面仍保留旧的模式切换判断。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/BlogCreate/index.tsx .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：本次只移除了博客创建页的实时预览，编辑器样式文件里上一轮为预览区准备的局部样式仍可后续再清理。
  - 下一步动作：如果你希望页面更纯粹，我下一步可以继续把右侧发布设置也压缩一下，让写作区再宽一点。

## 2026-04-25 23:17 (Asia/Shanghai)

- 任务：修复博客编辑器里有序列表从 `0.` 开始显示的问题，统一从 `1.` 起始。
- 改动文件：
  - `apps/web/src/components/blog/MdxMarkdownEditor.tsx`
  - `apps/web/src/utils/blog.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `normalizeOrderedListStarts(...)`，按行处理 Markdown，在非 fenced code block 场景下把行首的 `0.` / `0)` 有序列表标记归一为 `1.` / `1)`。
  - 编辑器初始化、外部 `value` 回填和编辑器 `markdownUpdated` 回调都接入这层规范化，保证你在写作区里看到和最终保存出去的内容一致。
  - Markdown HTML 渲染链路也同步接入同一规则，避免编辑器里改好了但后续渲染时又把 `start="0"` 带出来。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/MdxMarkdownEditor.tsx apps/web/src/utils/blog.ts .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：当前规则是产品层面的统一收口，因此会把 Markdown 中显式写的 `0.` 起始有序列表也自动改成 `1.`。
  - 下一步动作：如果你后面希望把 `2.`、`3.` 这类手写起始编号也统一收成规范序号，我可以继续把整段有序列表做更完整的归一化。

## 2026-04-25 23:31 (Asia/Shanghai)

- 任务：修复博客编辑器里正文与块级内容选中时高亮不明显的问题。
- 改动文件：
  - `apps/web/src/components/blog/mdx-editor.css`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将 `Milkdown` 的 `--crepe-color-selected` 从偏奶油白的浅色改成基于当前主题主色的半透明高亮色，恢复普通正文文本选区的可见度。
  - 为 `ProseMirror` 的块级选中态补充统一的描边、外发光和圆角高亮，覆盖段落块、列表项、图片、表格单元格以及代码块选中场景。
  - 把编辑器外层容器从 `overflow: hidden` 改回 `overflow: visible`，避免左侧浮动菜单再次被外层裁切。
- 校验：
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/components/blog/mdx-editor.css .codex/logs/CHANGE-LOG.md`：通过
- 风险与后续：
  - 当前风险：这次增强的是统一选中态视觉，如果你后面觉得某一类块元素还要再“更重”一点，可以继续按元素单独微调。
  - 下一步动作：优先看正文拖选、整块代码块选中、列表项选中这三种是否已经足够明显。

## 2026-04-25 23:33 (Asia/Shanghai)

- 任务：统一公共博客列表与创作空间博客列表的默认排序顺序。
- 改动文件：
  - `server/internal/handler/blog.go`
  - `server/internal/handler/blog_reader_ai.go`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 `buildPostTimelineOrderExpr(...)`，统一收口博客时间线默认排序规则，避免多个接口各自维护一份排序表达式。
  - 将公共博客列表、详情页前后篇时间线、创作空间 `AdminGetPosts` 默认排序统一为“置顶优先，再按 `published_at` 回退 `created_at`”。
  - 让博客 AI 推荐候选池同步复用同一排序 helper，保证推荐输入顺序与博客列表页时间线一致。
- 校验：
  - `gofmt -w server/internal/handler/blog.go server/internal/handler/blog_reader_ai.go`：通过
  - `go test ./...`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：创作空间中的草稿内容仍然会按 `created_at` 参与回退排序，而不是按 `draft_updated_at`，这是本次为对齐公共列表顺序而保留的行为。
  - 下一步动作：如果你希望“内容管理”页更偏编辑视角，我可以继续把草稿列表单独切成“最近编辑优先”模式，同时不影响公共博客列表时间线。
