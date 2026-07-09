# Phase 7：移除 Creator 功能 — 全局校验与清理

## 概述

Phase 1-6 已完成（数据库迁移脚本、后端模型/Handler/路由变更、前端 Web/Admin 变更）。本阶段执行全局校验，修复残留问题，确保编译通过且无残留 creator 引用。

## 当前问题清单

### 1. album.ts / follow.ts import 路径错误
- `apps/web/src/api/album.ts` 使用 `import http from './request'`
- `apps/web/src/api/follow.ts` 使用 `import http from './request'`
- 同目录其他文件（resource.ts, auth.ts, ai.ts, notification.ts）均使用 `import http from '@/utils/request'`
- **修复**：两文件改为 `import http from '@/utils/request'`

### 2. creator_compat.go 整文件可删除
- `server/internal/handler/creator_compat.go` 包含 ~200 行占位函数
- router.go 已重写，不再引用这些函数名
- **修复**：删除 creator_compat.go

### 3. Blog 系列文件中残留 creator 角色检查
用户已明确"所有资源和博客直接关联用用户即可"，creator 角色不再存在。以下文件中 `role != "admin" && role != "creator"` 需改为允许 user 角色：

- `server/internal/handler/blog_ai.go` — 4 处（L426-427, L639-640）
- `server/internal/handler/blog_ai_pick.go` — 2 处（L31-32）
- `server/internal/handler/blog.go` — 多处（L559, L577-578, L609, L788-789, L1295, L1355, L1443, L1471, L2007-2008）
- `server/internal/handler/blog_cover.go` — 4 处（L28-29, L109-110）
- `server/internal/handler/blog_external_images.go` — 4 处（L50-51, L311-312）
- `server/internal/handler/blog_workflow.go` — 4 处（L97-98, L168-169）

**策略**：
- `role == "creator"` 条件 → 删除或改为 `role == "user"`，视上下文语义
- `role != "admin" && role != "creator"` 权限检查 → 改为 `role != "admin" && role != "user"`（即只要求登录即可），因为 content 组路由已在 admin 中间件保护下但未限 AdminOnly
- 错误消息 `"creator required"` → 改为 `"登录后即可操作"` 或类似

### 4. creator_ai_tags.go / creator_ai_title.go 文件名和注释
- 文件名含 "creator" 但功能已通用化（SuggestResourceTags / SuggestResourceTitle）
- creator_ai_tags.go 注释仍写 `POST /creator/ai/suggest-tags`，实际路由已改为 `content.POST("/ai/resource-tags/suggest")`
- **修复**：重命名为 `resource_ai_tags.go` / `resource_ai_title.go`，更新注释

### 5. admin_resource.go 注释残留
- L495: `// DELETE /creator/resources/batch`
- L569: `// POST /creator/resources/batch-visibility`
- **修复**：更新注释中的路径

### 6. admin_user.go swagger 注释
- L23: `Enums(user, creator, admin)` → `Enums(user, admin)`

### 7. life_trace.go Creator 字段 — 不修改
- `Creator string` 是领域字段（影视/书籍创作者），与 Creator 功能无关，保留

### 8. database.go 迁移代码 — 不修改
- 删除 creator 外键的迁移逻辑，属于正常迁移清理，保留

## 执行步骤

1. 修复 album.ts / follow.ts 的 import 路径
2. 删除 creator_compat.go
3. 批量更新 blog 系列文件的 creator 角色检查（7 个文件）
4. 重命名 creator_ai_tags.go → resource_ai_tags.go，creator_ai_title.go → resource_ai_title.go，更新内部注释
5. 修复 admin_resource.go / admin_user.go 的注释
6. 运行 `go build ./...` 确认后端编译通过
7. 运行 `go test ./...` 确认测试通过
8. 运行 `pnpm --filter @valley/web exec tsc --noEmit` 确认前端 Web 编译通过
9. 运行 `pnpm --filter @valley/admin exec tsc --noEmit` 确认前端 Admin 编译通过
10. 最终 Grep 确认无功能相关 creator 残留（排除 life_trace 领域字段、迁移脚本、已下线提示文案）

## 验证标准

- `go build ./...` 零错误
- `go test ./...` 零失败
- `tsc --noEmit` (web + admin) 零错误
- Grep 扫描 `server/internal/handler/` 和 `apps/{web,admin}/src/` 无功能性 creator 引用
