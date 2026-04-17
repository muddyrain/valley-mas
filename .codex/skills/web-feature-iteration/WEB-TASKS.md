# Web 任务清单（线程内持续维护）

> 说明：本清单只用于 `apps/web` 产品功能迭代。  
> 排除范围：`packages/climber-game` 与 `apps/unity-climber` 不在本清单内。

## 活跃 Backlog（保持 3-5 项）

- [ ] 博客整体重构（P0）：重构 `BlogList / BlogPost` 的阅读型布局、信息层级、导航入口与推荐区，让博客从“功能页”升级为“内容消费主阵地”。
- [ ] 博客 AI 能力定义与 MVP（P0）：先完成“AI 到底做什么”的能力收敛，优先从阅读场景选 2-3 个高感知能力落地（建议候选：`AI 导读`、`章节速览`、`问文章`）。
- [ ] 名著数据源与版权策略（P0）：确定可持续公版来源、站内使用边界、导入格式（epub/txt/html）与元数据模型（作者/译者/版本/章节结构）。
- [ ] 名著在线阅读闭环（P1）：交付名著列表、详情、在线阅读器、阅读进度/书签/最近阅读，先完成“可连续阅读 + 可恢复现场”的主流程。
- [ ] 名著 AI 伴读 MVP（P1）：在阅读器内接入最小可用 AI 功能（建议候选：`本章摘要`、`人物关系提示`、`段落问答`），并与阅读记录联动。

## 已完成（从活跃 Backlog 移除）

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

- 推荐先做两个“定方向”动作，再进入开发：
  - 先完成博客 AI 能力收敛（第 2 项），明确首批只做哪 2-3 个能力，避免重构后反复返工。
  - 再完成名著数据源与版权策略（第 3 项），确认首批来源、导入脚本格式和书目范围。
