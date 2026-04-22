# Web 任务清单（线程内持续维护）

> 说明：本清单只用于 `apps/web` 产品功能迭代。  
> 排除范围：`packages/climber-game` 与 `apps/unity-climber` 不在本清单内。

## 协作约定（新增）

- 每次执行本清单任务后，回复结尾必须输出“当前任务清单进度”。
- 进度需按任务逐项列出，不可只给总览。
- 博客重构任务按子项跟踪，避免“看起来在做但不清楚做到哪”。

## 活跃 Backlog（保持 3-5 项）

### ELP 任务（独立追踪）

- [ ] ELP（P0）英语学习功能方案与数据治理：词典接入、学习闭环、口语听力能力、版权边界。
  - [x] ELP-1 方案冻结：完成数据来源、授权边界、导入策略、MVP 信息架构文档沉淀（文档：`docs/architecture/2026-04-20_english_learning_elp1_data_and_delivery_plan.md`）。
  - [ ] ELP-2 API 与数据模型草图：定义 `dictionary_lookup / wordbook / study_plan / speaking_attempt / listening_attempt` 的接口与表结构。
  - [ ] ELP-3 Web MVP 页面骨架：新增 `Learning Hub / Dictionary / Typing / Reading / Speaking / Listening / Plan` 路由与导航入口（先空实现 + mock 数据）。
  - [ ] ELP-4 听力与口语链路 PoC：打通 TTS 生成 + STT 识别 + 口语评分回流到学习计划。

## 已完成（从活跃 Backlog 移除）

- [x] WRESP（P0）Web 首轮移动端适配收口：统一首页、登录/注册与全局头部在小屏设备上的布局节奏，减少横向溢出与按钮挤压。
  - [x] WRESP-1 认证页共享壳子：抽出登录/注册共用双栏布局，并补齐移动端顶部品牌卡、表单间距与验证码按钮换行策略。
  - [x] WRESP-2 全局头部导航收口：将 Header 改为移动端双层结构，上层品牌与操作、下层横向滑动导航，避免多个页面被头部先撑坏。
  - [x] WRESP-3 首页首屏与资源区适配：收口 Hero、搜索区、资源焦点、统计区与 CTA 在小屏上的字号、卡片圆角和纵向堆叠行为。
  - [x] WRESP-4 创作者与博客详情页移动端收口：继续调整 `Creator / CreatorProfile / MySpace / MyResources / BlogPost` 的卡片密度、按钮换行与侧栏策略，避免小屏仍保留桌面式双栏压迫感。
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

## 下一步建议

- [ ] 启动 ELP-2：先产出英语学习域后端 API 契约与数据库表结构草案（与 `ELP-1` 文档保持字段一致）。
