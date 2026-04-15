# Web 任务清单（线程内持续维护）

> 说明：本清单只用于 `apps/web` 产品功能迭代。  
> 排除范围：`packages/climber-game` 与 `apps/unity-climber` 不在本清单内。

## 活跃 Backlog（保持 3-5 项）

- [ ] 首页运营信号增强：给空态 CTA 增加轻量埋点/来源标记（用于后续判断入口转化）。
- [ ] 创作者广场交互增强：补“搜索词高亮/热词推荐”，提升首屏发现效率。
- [ ] 通知中心细化增强：对“无目标跳转”的通知增加运营文案与快捷入口（按通知类型推荐去博客/资源/创作者页）。

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

- 推荐先做第 1 项（首页运营信号增强），先给首页空态 CTA 增加来源标记与轻量埋点。
