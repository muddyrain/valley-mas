# Web 任务清单（线程内持续维护）

> 说明：本清单只用于 `apps/web` 产品功能迭代。- [x] CLD-1（P0）名著数据源白名单首版：已冻结首批来源、许可证信号、可用范围与导入门槛，并明确"中文来源优先、海外来源补充"策略（文档：`docs/architecture/2026-04-19_classic_literature_cld1_source_whitelist.md`）。
- [x] CLD-2（P0）名著导入标准与清洗流程：已冻结 epub/txt/html 三种格式的章节切分、脚注处理、图片占位规则及质量校验门槛，输出章节数据契约对齐 CLD-3/CLR-2/CLAI-1（文档：`docs/architecture/2026-04-19_classic_literature_cld2_import_standard.md`）。
- [x] CLD-3（P0）名著元数据模型定版：已定版 Book/Author/Translator/Edition/Chapter 五层模型，明确必填字段与校验规则，字段已对齐 CLD-1 白名单与 CLD-2 章节契约（文档：`docs/architecture/2026-04-19_classic_literature_cld3_metadata_model.md`）。 
> 排除范围：`packages/climber-game` 与 `apps/unity-climber` 不在本清单内。

## 协作约定（新增）

- 每次执行本清单任务后，回复结尾必须输出“当前任务清单进度”。
- 进度需按任务逐项列出，不可只给总览。
- 博客重构任务按子项跟踪，避免“看起来在做但不清楚做到哪”。
- 前台命名统一使用“阅读库”；历史“名著馆/名著”任务编号保留以便追溯。

## 活跃 Backlog（保持 3-5 项）

### 阅读库任务

- [x] CLD（P0）名著数据源与版权策略：确认可持续公版来源、导入格式与元数据模型。
  - [x] CLD-1 数据源白名单（来源 + 许可证 + 可用范围）。
  - [x] CLD-2 导入标准（epub/txt/html）与清洗流程定义。
  - [x] CLD-3 元数据模型定版（作者/译者/版本/章节）。
- [x] CLR（P1）名著在线阅读闭环：列表、详情、阅读器、进度/书签/最近阅读。
  - [x] CLR-1 列表与详情页结构稿。
  - [x] CLR-2 阅读器 MVP（章节切换 + 进度恢复）。
  - [x] CLR-3 书签与最近阅读联动：详情页「加入书架」按钮（localStorage），列表页顶部最近阅读横条，自动记录最近 10 本。
- [x] CLAI（P1）名著 AI 伴读 MVP：`本章摘要`、`人物关系提示`、`段落问答`。
  - [x] CLAI-1 入口设计与触发条件：阅读模式右下角悬浮 ✨ 按钮，展开 AI 伴读面板。
  - [x] CLAI-2 能力接入与结果卡片展示：`本章导读`（guide+highlights）+ `问章节`（answer+citations）；后端 `classics_ai.go` 两条路由。
  - [x] CLAI-3 阅读记录与 AI 行为联动：AI 导读/提问成功后写入 `classics_ai_explored_{bookId}`，TOC 侧栏和详情页目录对已探索章节显示 ✨ 徽标，持久化跨会话。
- [x] RLIB（P1）阅读库在线导入链路增强：支持 TXT 一键导入、自动建书、可视化长任务进度。
  - [x] RLIB-1 Admin 导入框增强：新增 `TXT 自动拆章` 模式与“1/4~4/4”长耗时步骤提示。
  - [x] RLIB-2 Admin 一键建书：上传 TXT 后自动抽取书名/章节并创建书目+默认版本+章节。
  - [x] RLIB-3 导入任务可追踪：增加后台任务状态（排队/解析/写入/完成/失败）与可恢复重试。

### ELP 任务（独立追踪）

- [ ] ELP（P0）英语学习功能方案与数据治理：词典接入、学习闭环、口语听力能力、版权边界。
  - [x] ELP-1 方案冻结：完成数据来源、授权边界、导入策略、MVP 信息架构文档沉淀（文档：`docs/architecture/2026-04-20_english_learning_elp1_data_and_delivery_plan.md`）。
  - [ ] ELP-2 API 与数据模型草图：定义 `dictionary_lookup / wordbook / study_plan / speaking_attempt / listening_attempt` 的接口与表结构。
  - [ ] ELP-3 Web MVP 页面骨架：新增 `Learning Hub / Dictionary / Typing / Reading / Speaking / Listening / Plan` 路由与导航入口（先空实现 + mock 数据）。
  - [ ] ELP-4 听力与口语链路 PoC：打通 TTS 生成 + STT 识别 + 口语评分回流到学习计划。

## 已完成（从活跃 Backlog 移除）

- [x] BAI（P0）博客 AI 能力定义与 MVP 完成（BAI-1 ~ BAI-3）。
  - [x] BAI-1 能力边界文档：明确每个能力输入/输出、入口位置、失败兜底。
  - [x] BAI-2 首批能力选型定版：冻结 `AI 导读 + 问文章`，`章节速览` 延后。
  - [x] BAI-3 UI 接入方案：明确博客详情页/列表页入口位置、交互状态与失败兜底。
- [x] BAI-MVP 首批能力代码接入（BlogPost）：已落地 `AI 导读 + 问文章` 的后端接口与前端交互。
- [x] BAI-MVP 列表页推荐接入（BlogList）：已落地“AI 推荐读哪篇”面板、推荐接口与跳转链路。
- [x] BR（P0）博客整体重构完成（BR-1 ~ BR-7 全部验收通过）。
  - [x] BR-1 `BlogList` 结构重排：分组优先导航、搜索与排序重排、视觉升级。
  - [x] BR-2 `BlogList` 内容边界收敛：列表仅展示博客，不混入图文。
  - [x] BR-3 `BlogPost` 阅读基础升级：图片预览、目录侧栏 sticky、阅读进度条。
  - [x] BR-4 `BlogPost` 阅读闭环增强：相关推荐、上一篇/下一篇导航。
  - [x] BR-5 `BlogPost` 视觉深度打磨：信息密度、层次节奏、弱化冗余卡片。
  - [x] BR-6 `BlogPost` 交互细节收口：目录高亮跟随、移动端目录策略、滚动状态提示。
  - [x] BR-7 博客重构验收：访客/创作者双视角走查完成，并修复详情页相关推荐/上一篇/下一篇返回上下文回退问题。
- [x] 移除 Web 端 `/ai-chat` 残留入口语义（`RouteTitle` 中的 `/ai-chat` 标题分支已删除）。
- [x] 博客列表搜索闭环：`BlogList` 已接入 `keyword` 搜索、URL 参数联动、清除搜索与分页保持。
- [x] 创作者广场列表闭环：已接入 `/public/creators` 公开检索，支持关键词搜索、分页与空状态联动提示。
- [x] 通知中心动作闭环：新增“查看详情”跳转，并在跳转前自动标记已读（含 `extraData/type` 路由解析）。
- [x] 通知中心体验增强：补“跳转失败兜底提示 + 更多通知类型映射（当后端新增类型时）”。
- [x] 首页空态运营闭环：替换占位式说明，按游客/普通用户/创作者提供可执行下一步 CTA。
- [x] 创作者广场体验增强：`keyword/page` 写入 URL，并将“重新加载”改为无刷新重试。
- [x] 列表页 URL 状态统一：补齐 `Resources / CreatorProfile / ResourceAlbumManage / ResourceTagManage` 的 `keyword/page` URL 联动，并补齐 `Notifications / Favorites / Downloads / Follows / Guestbook / MyResources / MyPosts` 的 `page` URL 联动。
- [x] URL 状态复用收敛：新增通用 hook `useUrlPaginationQuery`，并替换多页重复 `searchParams` 读写逻辑（含 `ResourceTagManage`），减少后续维护成本。
- [x] CLD-1（P0）名著数据源白名单首版：已冻结首批来源、许可证信号、可用范围与导入门槛，并明确“中文来源优先、海外来源补充”策略（文档：`docs/architecture/2026-04-19_classic_literature_cld1_source_whitelist.md`）。
- [x] CLSEARCH（P2）名著馆搜索增强：列表页支持按`朝代`/`分类`筛选，参数写入 URL，联动分页重置。
  - [x] CLSEARCH-1 后端 `/public/classics` 接口补 `dynasty` / `category` 可选过滤参数。
  - [x] CLSEARCH-2 前端 ClassicsList 补筛选栏（Select 朝代 + Select 分类），与 keyword/page URL 联动。
- [x] CLADMIN（P2）Admin 名著录入 UI：`apps/admin` 名著书目增删改查，含章节批量导入 Modal。
- [x] CLSYNC（P2）名著书架跨设备同步：新增 `user/classics/shelf` 接口（GET/POST/DELETE）与 `classics_user_shelves` 表；前端登录态优先云端书架并保留游客 localStorage 兜底。
- [x] CLLANG（P2）国外文学双语切换：详情页支持 `简体中文 / English` 语言切换；为国外文学补齐 `简体中文导读版` 版本，保留英文完整版并可一键切换。
- [x] CLUI（P2）名著详情与阅读观感重构：详情页与章节阅读页统一为沉浸式阅读风格，增强信息层级、目录卡片可读性与中英排版舒适度。

## 下一步建议

- [x] 补全名著测试数据，验证分类/朝代筛选效果（seed 已扩展为覆盖朝代/分类的一组样本，并支持一键命令 `pnpm classics:seed`）。
- [ ] 启动 ELP-2：先产出英语学习域后端 API 契约与数据库表结构草案（与 `ELP-1` 文档保持字段一致）。
- [ ] RLIB-4 导入治理增强：为长任务增加并发上限/取消任务/历史归档策略，避免超大文本并发导入压垮数据库。
- [x] 增加白名单源抓取导入脚本：已新增完整正文导入命令 `pnpm classics:import-fulltext`，支持从 Project Gutenberg / 维基文库抓取并覆盖默认版本章节，含网络重试与单书补导入（`CLASSICS_ONLY`）。
- [x] 名著馆书架页：展示用户 localStorage 书架列表（`/classics/shelf`）。
- [x] 名著阅读进度跨设备同步：已新增 `user/classics/progress`（GET/POST）与 `classics_user_progress` 表；详情页/书架页改为登录态云端优先，游客保留 localStorage 兜底。
- [x] 名著最近阅读跨设备同步：已新增 `user/classics/recent`（GET/POST）与 `classics_user_recent` 表；列表页最近阅读横条改为登录态云端优先，游客保留 localStorage 兜底。
- [x] 名著 AI 探索记录跨设备同步：已新增 `user/classics/ai-explored`（GET/POST）与 `classics_user_ai_explored` 表；详情页改为登录态云端优先 + 本地合并回写，游客保留 localStorage 兜底。
- [ ] 名著 AI 问章节历史跨设备同步：将每章问答记录从本地会话态升级为登录态云端历史（支持跨端回看最近问答）。
- [ ] 国外文学双语“完整正文”增强：在授权允许范围内补齐简体中文完整译本（当前简体侧为导读版）。
