# 移除 Creator 功能 — 剩余工作计划

## 当前状态

### 已完成
- 数据库迁移脚本 `043_remove_creator_feature.sql` ✅
- 后端模型变更（UserAlbum 新建、model.go/database.go 修改、旧模型文件删除）✅
- 前端 Web API 新建 `follow.ts`/`album.ts` ✅
- 前端 Web 页面：Creator/CreatorProfile/ResourceAlbumManage 目录已删除、CreatorCard.tsx 已删除 ✅
- 前端 Web App.tsx/Header.tsx 已清理 Creator 路由 ✅
- 前端 Web Follows 页面已改为用户关注 ✅
- 前端 Admin App.tsx/Layout.tsx 已清理 Creator 页面 ✅

### 待完成

#### A. 后端 Handler 编译错误修复（最关键 — 当前 `go build` 无法通过）

17 个文件仍有 `creator` 引用，主要问题：

1. **model.Creator / model.CodeAccessLog / model.CreatorSpace 引用** — 这些模型已删除，编译报错
2. **model.UserFollow.CreatorID 引用** — 字段已改为 FollowedUserID
3. **DownloadRecord.CreatorID 引用** — 字段已删除

需要逐文件修复：

| 文件 | 修改要点 |
|---|---|
| `init.go` | 删除 `model.Creator{}`/`model.CreatorSpace{}`/`model.CodeAccessLog{}` 相关种子数据（行 69-73, 81-85, 155-211, 291, 307-328, 333, 338）；将 creator 测试用户的 Role 从 "creator" 改为 "user"；删除 `creatorCodeMap` 逻辑；DownloadRecord 移除 CreatorID |
| `creator_ai_tags.go` | **保留**，改名为通用 AI 功能（路由从 `/creator/ai/` 移到 content 组下）|
| `creator_ai_title.go` | **保留**，同上处理 |
| `user_like_follow.go` | FollowCreator/UnfollowCreator → FollowUser/UnfollowUser，改用 `model.UserFollow.FollowedUserID`；GetCreatorFollowStatus → GetUserFollowStatus；GetMyFollows 的 Preload 改为 `FollowedUser`；GetMyFavorites 中删除 creatorCodeMap 查询 |
| `user_public.go` | GetCreatorSpace → 删除（Space 概念随 Creator 一起移除）；DownloadResource 中删除 `model.Creator` 查询和 `CreatorID`；GetCreatorResourcesList → GetUserResourcesList，改用 user_id 查询 |
| `public.go` | GetCreatorResources → GetUserResources，改用 user_id 而非 creator code；GetHotCreators → 删除或改为 GetHotUsers |
| `home.go` | GetHotCreators → 删除（含 HotCreatorResponse 结构体）；HomePage HTML 中的 "创作者资源" 链接改为通用描述 |
| `admin_resource.go` | UpdateResourceCreator → UpdateResourceUploader（功能保留，改名为更准确）；移除 `creator` 角色判断逻辑（行 591） |
| `admin_stats.go` | 当前代码看起来已经不依赖 Creator 模型，需确认编译通过 |
| `admin_operations.go` | 可能有 CodeAccessLog/CreatorAlbum 引用，需确认 |
| `user.go` | 可能有 Creator 引用，需确认 |
| `blog_workflow.go` | 可能有 Creator 引用，需确认 |
| `blog_ai.go` / `blog_ai_pick.go` | 可能有 Creator 引用，需确认 |
| `admin_user.go` | 可能有 Creator 引用，需确认 |
| `blog_cover.go` / `blog_external_images.go` | 可能有 Creator 引用，需确认 |
| `blog.go` | 可能有 Creator 引用，需确认 |

#### B. 后端路由变更（router.go）

需要：
1. 删除所有 creator 相关路由：
   - `/public/space/:code` (GetCreatorSpace)
   - `/public/hot-creators` (GetHotCreators)
   - `/public/creators` (SearchCreators)
   - `/public/creator/:id/albums` (ListCreatorAlbums)
   - `/public/creators/:id/resources` (GetCreatorResourcesList)
   - `/creator/:code/resources` (GetCreatorResources)
   - `/user/creators/:id/follow` → 改为 `/user/users/:id/follow`
   - `/user/creators/:id/follow/status` → 改为 `/user/users/:id/follow/status`
   - 整个 `/creator` 组（资源 CRUD + 相册 CRUD + AI 建议）
   - `/admin/creators*` 相关管理路由
   - `/admin/creator-applications*` 相关管理路由
   - `/admin/creator-application-audit-config*`
   - `/admin/creator-albums*`
   - `/admin/audit/code-access-logs`
   - `content.GET("/creator/stats")`
   - `content.GET/POST/PUT/DELETE("/creators*")`
   - `content.PUT("/resources/:id/creator")` → 改为 `/resources/:id/uploader`

2. 新增路由：
   - `/user/users/:id/follow` POST → FollowUser
   - `/user/users/:id/follow/status` GET → GetUserFollowStatus
   - `/user/albums` CRUD 组 → UserAlbum 管理
   - `/public/users/:id/resources` → GetUserResourcesList（公开用户资源）
   - `/public/users/:id/albums` → 公开用户相册
   - 将 AI 建议路由移到 content 组：`content.POST("/ai/suggest-title")`, `content.POST("/ai/resource-tags/suggest")`

#### C. 前端 Web 残留 Creator 引用修复

15 个文件仍有 creator 引用：
- `api/resource.ts` — 9 处 `/creator/` API 路径需改为 content 路径
- `components/ResourceCard.tsx` — creatorName/creatorAvatar 字段改为 userName/userAvatar，showCreator 改为 showUser
- `pages/ResourceDetail/index.tsx` — creatorCode/creatorId/creator 字段清理
- `pages/Favorites/index.tsx` — creatorName 引用
- `pages/Resources/index.tsx` — creator 引用
- `pages/MyPosts/index.tsx` — creator 引用
- `components/blog/ImageTextPostCard.tsx` — creator 引用
- `pages/blog/BlogPost/index.tsx` — creator 引用
- `pages/blog/BlogList/index.tsx` — creator 引用
- `components/blog/PublicWallpaperPickerDialog.tsx` — creator 引用
- `components/blog/BlogPostCard.tsx` — creator 引用
- `components/TypeFilterBar.tsx` — creator 引用
- `utils/notification.ts` — creator 通知类型
- `pages/Downloads/index.tsx` — creator 引用
- `api/auth.ts` — creatorCode/creatorId/creator 字段

#### D. 前端 Admin 残留 Creator 引用修复

6 个文件仍有 creator 引用：
- `pages/admin-ops/AuditLogs.tsx` — creatorId 列
- `pages/admin-ops/shared.tsx` — creatorId 搜索参数
- `pages/admin-ops/Relations.tsx` — creator 对象引用
- `api/record.ts` — 需确认
- `api/resource.ts` — 需确认
- `components/UserCardInfo.tsx` — 需确认

## 执行计划

### Step 1: 后端 Handler 全面修复
修复所有编译错误，确保 `go build ./...` 通过。具体：

1. **init.go** — 大幅重写：
   - 移除 `model.Creator`/`model.CreatorSpace`/`model.CodeAccessLog` 相关所有代码
   - creator 测试用户 Role 改为 "user"
   - DownloadRecord 移除 CreatorID
   - 删除 creatorCodeMap 逻辑
   - 返回数据移除 createdCreators/createdAccessLogs

2. **user_like_follow.go** — 关注逻辑重写：
   - FollowCreator → FollowUser：通过 user_id 查 model.User，用 FollowedUserID 替代 CreatorID
   - UnfollowCreator → UnfollowUser：WHERE 条件改为 followed_user_id
   - GetCreatorFollowStatus → GetUserFollowStatus
   - GetMyFollows：Preload("Creator.User") → Preload("FollowedUser")
   - GetMyFavorites：移除 creatorCodeMap 查询逻辑

3. **user_public.go** — 重写：
   - GetCreatorSpace → 删除
   - DownloadResource：移除 Creator 查询，DownloadRecord 不再有 CreatorID
   - GetCreatorResourcesList → GetUserResourcesList：通过 user_id 直接查询

4. **public.go** — 重写相关函数：
   - GetCreatorResources → GetUserResources
   - GetHotCreators → 删除或改为 GetActiveUsers（按资源数排序的用户列表）

5. **home.go**：
   - 删除 GetHotCreators 和 HotCreatorResponse
   - HomePage HTML 移除 "创作者资源" 链接

6. **creator_ai_tags.go / creator_ai_title.go** — 保留功能，不删除文件
   - 这些是通用 AI 辅助功能，只是路由路径需要变更

7. **admin_resource.go**：
   - UpdateResourceCreator → UpdateResourceUploader
   - 移除 `creator` 角色判断

8. 其他文件 — 逐一检查修复 Creator 引用

### Step 2: 后端路由变更（router.go）
按上述 B 部分计划修改路由

### Step 3: 前端 Web Creator 引用清理
将所有 creator API 路径和数据字段改为 user 对应路径和字段名

### Step 4: 前端 Admin Creator 引用清理
将 admin 侧的 creator 引用改为 user

### Step 5: 全局校验
- `cd server && go build ./...`
- `cd server && go test ./...`
- `pnpm --filter @valley/web exec tsc --noEmit`
- `pnpm --filter @valley/admin exec tsc --noEmit`
- Grep 确认无残留 creator 引用（排除注释和迁移脚本）

## 关键决策

1. **AI 建议功能（tags/title）保留**，只改路由路径
2. **Space 功能随 Creator 一起移除**，不做独立保留
3. **GetHotCreators 改为 GetActiveUsers**，按资源数量排序用户
4. **Follow 改为用户间关注**，路由从 `/user/creators/:id/follow` 改为 `/user/users/:id/follow`
5. **Album 保留为用户相册**，路由新增 `/user/albums` 组
6. **UpdateResourceCreator 改名 UpdateResourceUploader**，语义更准确
7. **init.go 中 creator 测试用户 Role 改为 "user"**，不再创建 Creator 种子数据
