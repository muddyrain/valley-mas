# 资源标签去表化：删除 resource_tags 关联表，改用 resources.tags 字符串数组

> **临时工作产物**：本文档只记录本次一次性重构的计划与执行摘要，不作为长期能力说明。产品长期状态以各子项目 `PLAN.md` 或 `docs/PROJECT_GUIDE.md` 为准；owner 可在验证稳定后清理本 md。

## 背景 & 目标

`apps/web` 内的"资源标签"实体维护成本过高：
- 单独存在 `resource_tags` 与 `resource_tag_relations` 两张表；
- Admin 后台有独立的标签管理页（增删改查、AI 生成描述等）；
- 上传/编辑资源时 AI 匹配标签需要先查表、再匹配、再落表，一次匹配至少两次 AI 调用 + 数据库检索；
- 用户主要诉求只是"给资源打几个字符串标签用来过滤"。

目标：把标签退化成纯字符串数组，直接挂在 `resources.tags` 上，AI 只做"在线生成候选让用户勾选"，不再回写标签表。

用户确认：
1. 保留标签名（迁移把旧关联展开成 `resources.tags`）；
2. 保留资源列表按标签名筛选；
3. AI 返回候选，用户勾选，不自动写入；
4. Admin 保留"资源标签统计"只读页；
5. 数据迁移不可逆，直接删旧表，不备份；
6. 一次性跑完 Phase 1-6。

## 非目标

- 不改 `blog_tags`、`life-trace tags` 等其他领域的标签系统；
- 不改 AI 供应商、`aiclient`、`agent runtime`；
- 不改前端主题、路由骨架、其它页面。

## 方案

### 数据模型
- `Resource.Tags` 从 `many2many:resource_tag_relations` 改为 `model.StringList`（JSON 序列化的 `[]string`）；
- 迁移脚本 `server/migrations/042_flatten_resource_tags.sql`：把 `resource_tag_relations` 展开为 JSON 数组，回填到 `resources.tags`，然后 `DROP TABLE resource_tag_relations` 和 `resource_tags`；
- `database.AutoMigrate` 移除 `ResourceTag` 模型；`ResourceTag` 及其 handler / seed 脚本一并删除。

### Handler / 路由
- 删除：`resource_tag.go`（711 行 CRUD + AI 匹配）、`resource_tag_ai_description.go`、`scripts/seed_tags.go`；
- 新增：
  - `admin_resource_tag_stats.go`：`/admin/resource-tags/stats`，Go 侧聚合 `map[name]count`（不用 SQL `unnest`，保证跨库兼容）；
  - `creator_ai_tags.go` 重写 `SuggestResourceTags`：`/creator/ai/resource-tags/suggest`，接收 `type / title / description / imageBase64`，直接调 AI 返回 `{ tags: string[] }`；
- `admin_resource.go`、`admin_operations.go`、`home.go`、`list_query_helpers.go` 里所有对旧标签表的 join / 预加载 / 关键字搜索均改为对 `resources.tags` 数组做 `LIKE` / JSON 内嵌搜索。

### apps/web
- `api/resource.ts`：`Resource.tags` 由对象数组改为 `string[]`；`aiMatchResourceTags` 改为 `aiSuggestResourceTags`；
- `components/ResourceTagSelector.tsx`：从"搜索接口 + 多选 chip"改为"输入回车 + 逗号分隔 + AI 生成候选点击勾选"；
- `components/{EditResourceDialog,UploadResourceDialog,BatchUploadResourceDialog,ResourceCard}.tsx`：把 `tag.name` / `tag.id` 全部换成字符串本身；
- `pages/Resources/index.tsx`：过滤器从"标签下拉 + 接口拉列表"简化为"输入回车即可"；
- `pages/{MyResources,MySpace,ResourceAlbumManage,CreatorProfile}/index.tsx`：所有 `tag.id/name` 引用改字符串；
- `App.tsx`、`layouts/Header.tsx`：移除 `/resource-tags` 路由入口；
- 删除：`pages/ResourceTagManage/`（1050 行）、`components/ResourceTagUpsertDialog.tsx`。

### apps/admin
- `api/operations.ts`：新增 `listResourceTagStats`；
- `pages/admin-ops/ResourceTags.tsx`：改为"资源标签统计（只读表格）"，列 `标签名 / 资源数`，走 `useAdminList` 适配层做前端分页；
- `pages/Resources.tsx`：详情列表里的标签 chip 用字符串本身；
- `layouts/Layout.tsx`：菜单文案从"资源标签"改为"资源标签统计"。

### apps/desktop-os（Finder / Spotlight）
- `store/resourceStore.ts`：移除 `tags` selector（旧的独立标签列表）；
- `store/finderStore.ts`：`activeTagId → activeTag: string | null`；`setTagId → setTag`；
- `apps/FinderWindow.tsx`：侧栏 tags 循环由 `useResourceStore.tags` 改成 `useMemo` 聚合出 `tagOptions = [{name, count}]`；`buildSavedSearchName`、`openPath`、`openSavedSearch`、`saveCurrentSearch` 全部改传字符串；
- `finder/data.ts`、`spotlight/data.ts`：`resource.tags?.map(t => t.name)` 改为 `resource.tags?.map(t => t.trim())` / 直接 `resource.tags ?? []`。

## Phase & 状态

| Phase | 内容 | 状态 |
|---|---|---|
| 1 | 后端模型 + 迁移脚本 | ✅ |
| 2 | 后端 Handler + 路由 | ✅ |
| 3 | apps/web 端 | ✅ |
| 4 | apps/admin 端 | ✅ |
| 5 | apps/desktop-os 端 | ✅ |
| 6 | 校验 + 计划文档 + 交付摘要 | ✅ |

## 校验结果

- `cd server && go build ./...` ✅
- `cd server && go test ./internal/handler/...` ✅（`ok valley-server/internal/handler 1.135s`）
- `pnpm --filter @valley/web exec tsc --noEmit` ✅
- `pnpm --filter @valley/admin exec tsc --noEmit` ✅
- `pnpm --filter @valley/desktop-os typecheck` ✅
- `pnpm --filter @valley/desktop-os check` ✅
- `pnpm --filter @valley/admin check` ✅
- `pnpm --filter @valley/desktop-os exec vitest run` ✅（25 files / 146 tests）
- `pnpm --filter @valley/web check` ⚠️ 剩 2 个既有 baseline 错误（`UploadResourceDialog.tsx:65:7` non-null assertion、`src/index.css` linear-gradient 格式），已通过 `git show HEAD:...` 确认属于 `daf1cc61 feat(blog): 支持 AI 选图与外部图源封面` 提交遗留，非本任务引入。
- `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <改动文件>` ✅

## 风险与回滚

- 迁移不可逆：一旦 042 迁移执行，`resource_tag_relations` / `resource_tags` 两张表被 drop，前端相关页面路由被删；回滚需要走"重建表 + 逆向拆分 `resources.tags`"，成本高，请仅在确认线上不再依赖标签管理页时执行。
- 影响面：任何依赖 `POST /admin/resource-tags/*` 或 `POST /creator/ai/resource-tags/match` 的旧客户端会 404；本仓库内所有调用已更新。

## 后续可选优化（非本次范围）

- Postgres 环境可考虑给 `resources.tags` 加 GIN 索引以加速 tag 过滤；
- 观察 AI 候选生成的准确率，如需要再引入"最近使用过的标签"缓存复用。
