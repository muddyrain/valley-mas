# Handler 快速参考

## 📁 文件 → 接口映射

| 文件 | 接口名称 | 路由 | 方法 | 说明 |
|------|---------|------|------|------|
| **common.go** | | | | **通用函数** |
| | Success | - | - | 成功响应 |
| | Error | - | - | 错误响应 |
| **public.go** | | | | **公开接口（无需认证）** |
| | VerifyCode | `/api/v1/code/verify` | POST | 验证口令 |
| | GetCreatorResources | `/api/v1/creator/:code/resources` | GET | 获取创作者资源 |
| **user.go** | | | | **用户接口（需要认证）** |
| | GetUserInfo | `/api/v1/user/info` | GET | 获取用户信息 |
| | GetUserDownloads | `/api/v1/user/downloads` | GET | 用户下载记录 |
| | RecordDownload | `/api/v1/resource/download` | POST | 记录下载 |
| **admin_stats.go** | | | | **管理后台-统计** |
| | GetStats | `/api/v1/admin/stats` | GET | 获取统计数据 |
| **admin_user.go** | | | | **管理后台-用户管理** |
| | ListUsers | `/api/v1/admin/users` | GET | 用户列表 |
| | CreateUser | `/api/v1/admin/users` | POST | 创建用户 |
| | GetUserDetail | `/api/v1/admin/users/:id` | GET | 用户详情 |
| | UpdateUser | `/api/v1/admin/users/:id` | PUT | 更新用户 |
| | DeleteUser | `/api/v1/admin/users/:id` | DELETE | 删除用户 |
| | UpdateUserStatus | `/api/v1/admin/users/:id/status` | PUT | 更新状态 |
| **admin_creator.go** | | | | **管理后台-创作者管理** |
| | ListCreators | `/api/v1/admin/creators` | GET | 创作者列表 |
| | CreateCreator | `/api/v1/admin/creators` | POST | 创建创作者 |
| | UpdateCreator | `/api/v1/admin/creators/:id` | PUT | 更新创作者 |
| | DeleteCreator | `/api/v1/admin/creators/:id` | DELETE | 删除创作者 |
| **admin_resource.go** | | | | **管理后台-资源管理** |
| | ListResources | `/api/v1/admin/resources` | GET | 资源列表 |
| | UploadResource | `/api/v1/admin/resources/upload` | POST | 上传资源 |
| | DeleteResource | `/api/v1/admin/resources/:id` | DELETE | 删除资源 |
| **admin_record.go** | | | | **管理后台-记录管理** |
| | ListDownloadRecords | `/api/v1/admin/records/downloads` | GET | 下载记录 |
| | ListUploadRecords | `/api/v1/admin/records/uploads` | GET | 上传记录 |
| **home.go** | | | | **其他** |
| | HomePage | `/` | GET | 首页 |
| **init.go** | | | | **开发工具** |
| | InitData | `/init-data` | GET | 初始化数据 |

## 🎯 按功能查找

### 想要修改用户管理？
→ 打开 `admin_user.go`

### 想要添加创作者功能？
→ 打开 `admin_creator.go`

### 想要实现资源上传？
→ 打开 `admin_resource.go`

### 想要添加统计图表？
→ 打开 `admin_stats.go`

### 想要修改响应格式？
→ 打开 `common.go`

## 📊 实现进度

- ✅ `common.go` - 完成
- ✅ `public.go` - 完成
- ✅ `user.go` - 完成
- ✅ `admin_stats.go` - 完成（简单实现）
- ✅ `admin_user.go` - **完整实现**（CRUD + 搜索 + 筛选）
- ⏳ `admin_creator.go` - 待完善
- ⏳ `admin_resource.go` - 待完善
- ⏳ `admin_record.go` - 待完善
- ✅ `home.go` - 完成
- ✅ `init.go` - 完成

## 🔄 开发流程

### 新增一个管理功能（以"标签管理"为例）

1. **创建 handler 文件**
   ```bash
   touch server/internal/handler/admin_tag.go
   ```

2. **编写 CRUD 函数**
   ```go
   package handler
   
   func ListTags(c *gin.Context) { ... }
   func CreateTag(c *gin.Context) { ... }
   func UpdateTag(c *gin.Context) { ... }
   func DeleteTag(c *gin.Context) { ... }
   ```

3. **在 router.go 中注册路由**
   ```go
   admin.GET("/tags", handler.ListTags)
   admin.POST("/tags", handler.CreateTag)
   admin.PUT("/tags/:id", handler.UpdateTag)
   admin.DELETE("/tags/:id", handler.DeleteTag)
   ```

4. **编写测试**
   ```bash
   touch server/internal/handler/admin_tag_test.go
   ```

## 💡 最佳实践

1. **职责单一**：一个文件只负责一个功能模块
2. **命名规范**：`admin_*` 表示管理后台接口
3. **复用函数**：统一使用 `Success()` 和 `Error()`
4. **添加注释**：每个函数都要有清晰的注释
5. **错误处理**：统一的错误码和错误信息

## 🚀 快速开始

```bash
# 1. 查看某个文件的内容
cat server/internal/handler/admin_user.go

# 2. 编译检查
go build -o tmp/main.exe .

# 3. 运行服务
air

# 4. 测试接口
curl http://localhost:8080/api/v1/admin/users
```
