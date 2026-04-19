# Web 任务清单（线程内持续维护）

> 说明：本清单只用于 `apps/web` 产品功能迭代。- [x] CLD-1（P0）名著数据源白名单首版：已冻结首批来源、许可证信号、可用范围与导入门槛，并明确"中文来源优先、海外来源补充"策略（文档：`docs/architecture/2026-04-19_classic_literature_cld1_source_whitelist.md`）。
- [x] CLD-2（P0）名著导入标准与清洗流程：已冻结 epub/txt/html 三种格式的章节切分、脚注处理、图片占位规则及质量校验门槛，输出章节数据契约对齐 CLD-3/CLR-2/CLAI-1（文档：`docs/architecture/2026-04-19_classic_literature_cld2_import_standard.md`）。
- [x] CLD-3（P0）名著元数据模型定版：已定版 Book/Author/Translator/Edition/Chapter 五层模型，明确必填字段与校验规则，字段已对齐 CLD-1 白名单与 CLD-2 章节契约（文档：`docs/architecture/2026-04-19_classic_literature_cld3_metadata_model.md`）。 
> 排除范围：`packages/climber-game` 与 `apps/unity-climber` 不在本清单内。

## 协作约定（新增）

- 每次执行本清单任务后，回复结尾必须输出“当前任务清单进度”。
- 进度需按任务逐项列出，不可只给总览。
- 博客重构任务按子项跟踪，避免“看起来在做但不清楚做到哪”。

## 活跃 Backlog（保持 3-5 项）

- [ ] CLD（P0）名著数据源与版权策略：确认可持续公版来源、导入格式与元数据模型。
  - [x] CLD-1 数据源白名单（来源 + 许可证 + 可用范围）。
  - [x] CLD-2 导入标准（epub/txt/html）与清洗流程定义。
  - [x] CLD-3 元数据模型定版（作者/译者/版本/章节）。
- [ ] CLR（P1）名著在线阅读闭环：列表、详情、阅读器、进度/书签/最近阅读。
  - [x] CLR-1 列表与详情页结构稿。
  - [x] CLR-2 阅读器 MVP（章节切换 + 进度恢复）。
  - [x] CLR-3 书签与最近阅读联动：详情页「加入书架」按钮（localStorage），列表页顶部最近阅读横条，自动记录最近 10 本。
- [ ] CLAI（P1）名著 AI 伴读 MVP：`本章摘要`、`人物关系提示`、`段落问答`。
  - [x] CLAI-1 入口设计与触发条件：阅读模式右下角悬浮 ✨ 按钮，展开 AI 伴读面板。
  - [x] CLAI-2 能力接入与结果卡片展示：`本章导读`（guide+highlights）+ `问章节`（answer+citations）；后端 `classics_ai.go` 两条路由。
  - [x] CLAI-3 阅读记录与 AI 行为联动：AI 导读/提问成功后写入 `classics_ai_explored_{bookId}`，TOC 侧栏和详情页目录对已探索章节显示 ✨ 徽标，持久化跨会话。
- [x] CLSEARCH（P2）名著馆搜索增强：列表页支持按`朝代`/`分类`筛选，参数写入 URL，联动分页重置。
  - [x] CLSEARCH-1 后端 `/public/classics` 接口补 `dynasty` / `category` 可选过滤参数。
  - [x] CLSEARCH-2 前端 ClassicsList 补筛选栏（Select 朝代 + Select 分类），与 keyword/page URL 联动。
- [x] CLADMIN（P2）Admin 名著录入 UI：`apps/admin` 名著书目增删改查，含章节批量导入 Modal。

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

## 下一步建议

- 补全名著测试数据，验证分类/朝代筛选效果（目前仅有 seed 数据）。
- 名著馆书架页：展示用户 localStorage 书架列表（`/classics/shelf`）。
