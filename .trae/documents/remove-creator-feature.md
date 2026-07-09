# 移除 Creator 功能，改为 User 直接关联

## Context

用户决定移除 Creator（创作者）概念，资源和博客直接关联到 User。需要：1) 删除 Creator 相关前后端代码；2) 数据迁移（Creator 绑定改为 User）；3) Follows 改为关注用户；4) 相册保留为用户相册。

## 实施步骤

### Phase 1: 数据库迁移脚本

新建 `server/migrations/043_remove_creator_feature.sql`：

1. **创建 `user_albums` 表**：从 `creator_albums` 迁移，`creator_id` → 通过 `creators.user_id` 找到 `user_id`
2. **创建 `user_album_resources` 关联表**：从 `creator_album_resources` 复制
3. **修改 `user_follows`**：新增 `followed_user_id`，从 `creator_id` → `creators.user_id` 迁移，删除旧 `creator_id` 列
4. **移除 `download_records.creator_id`**：冗余字段直接删
5. **UPDATE users SET role = 'user' WHERE role = 'creator'**
6. **DROP 旧表**：creators, creator_spaces, creator_albums, creator_album_resources, creator_applications, creator_audit_configs, code_access_logs, space_resources

### Phase 2: 后端模型变更

- **新建** `server/internal/model/user_album.go`：UserAlbum（CreatorAlbum → UserID 替换 CreatorID）
- **修改** `model.go`：UserFollow 的 CreatorID → FollowedUserID；DownloadRecord 移除 CreatorID；删除 Creator/CreatorSpace/CodeAccessLog/CreatorApplication 模型
- **删除** `creator_album.go`、`creator_audit_config.go`
- **修改** `database.go`：AutoMigrate 移除 Creator 模型，新增 UserAlbum
- **修改** `init.go`：移除创建 Creator/Space 的种子数据

### Phase 3: 后端 Handler 变更

- **新建** `user_album.go`：从 `creator_album.go` 适配，CreatorID → UserID
- **修改** `user_like_follow.go`：FollowCreator → FollowUser，路由改为 `/user/users/:id/follow`
- **修改** 资源相关 handler：移除 creatorName/creatorAvatar/creatorCode 计算字段，改为 userName/userAvatar
- **修改** `admin_resource.go`：UpdateResourceCreator → UpdateResourceUploader
- **修改** `admin_record.go`：移除 creator 关联
- **修改** `admin_stats.go`：移除 creatorCount/topCreators
- **修改** `user.go`：移除 creatorCode 相关逻辑
- **删除** handler 文件：creator.go, creator_application.go, creator_application_audit.go, creator_album.go, creator_search.go, creator_stats.go, admin_creator.go, admin_creator_space.go

### Phase 4: 后端路由变更

`router.go`：
- **删除**：所有 /public/creator*, /public/creators*, /public/space/*, /creator/*, /api/v1/creator 组, /admin/creators*, /admin/creator-applications*, /admin/creator-albums*
- **新增**：/user/users/:id/follow, /user/users/:id/follow/status, /user/albums CRUD, /public/users/:id/albums, /public/users/:id/resources
- 资源管理路由移至现有 content 组

### Phase 5: 前端 Web 变更

**删除文件：**
- pages/Creator/index.tsx, pages/CreatorProfile/index.tsx, pages/ResourceAlbumManage/index.tsx
- components/CreatorCard.tsx, api/creator.ts

**新建文件：**
- api/follow.ts（followUser, unfollowUser, getUserFollowStatus, getMyFollows）
- api/album.ts（UserAlbum CRUD，路径 /user/albums）

**修改文件：**
- App.tsx：移除 Creator/CreatorProfile/ResourceAlbumManage 路由和 import
- api/resource.ts：creatorName/creatorAvatar/creatorCode → userName/userAvatar；/creator/resources → /content/resources
- api/auth.ts：UserProfile 移除 creatorCode
- layouts/Header.tsx：移除 /creators 导航项
- pages/Home/index.tsx：移除创作者口令搜索 UI 和 /creators 入口
- pages/Follows/index.tsx：改用 api/follow.ts，文案"创作者"→"用户"，跳转改为用户资源页
- pages/ResourceDetail/index.tsx：creatorName/creatorAvatar → userName/userAvatar
- pages/MyResources/index.tsx：改用 api/album.ts
- pages/Profile/index.tsx：ROLE_MAP 移除 creator
- components/ResourceCard.tsx：creatorName → userName
- utils/notification.ts：移除 creator 相关跳转逻辑

### Phase 6: 前端 Admin 变更

**删除文件：**
- pages/Creators.tsx, CreatorApplications.tsx, CreatorDashboard.tsx, CreatorSpaces.tsx, ApplyCreator.tsx
- pages/admin-ops/CreatorAlbums.tsx, api/creator-application.ts, api/creator.ts

**修改文件：**
- App.tsx：移除 creator 相关路由
- Layout.tsx：移除侧边栏 creator 菜单项
- Users.tsx：移除 creator 角色选项
- Resources.tsx：移除 creatorId 筛选和 UpdateResourceCreator 弹窗
- Records.tsx：移除 creator 列
- Dashboard.tsx：移除 creatorCount/topCreators
- Login.tsx：移除 creator 跳转

### Phase 7: 校验

```bash
cd server && go build ./...
cd server && go test ./...
pnpm --filter @valley/web exec tsc --noEmit
pnpm --filter @valley/admin exec tsc --noEmit
```

全局搜索 `creator` 确认无遗漏引用。

## 注意事项

1. **迁移顺序**：先运行 DB 迁移（创建新表+迁移数据），再部署新后端代码
2. **DownloadRecord.CreatorID**：移除后，上传者信息通过 Resource.UserID → User 获取
3. **通知类型 `creator_application_review`**：旧记录保留兼容，不再生成新通知
4. **创作者口令（Code）概念彻底移除**：所有口令相关入口一并删除
5. **User.Role**：有效值从 `user, admin, creator` 收窄为 `user, admin`

## 计划文档同步

本次改动移除 Creator 功能、新增 User Follow 和 User Album，属于功能状态变化。需更新 docs/PROJECT_GUIDE.md 中 Web 首页和创作者相关描述（如有）。
