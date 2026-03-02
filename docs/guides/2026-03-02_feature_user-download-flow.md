# 用户下载流程实现 - Phase 1

> **日期**: 2026-03-02  
> **功能**: 实现用户端核心下载流程（暂不集成广告，等小程序开发时集成抖音广告）

---

## ✅ 已完成功能

### 1. **数据模型更新**

#### 新增模型：`CodeAccessLog`（口令访问日志）
```go
type CodeAccessLog struct {
    ID        Int64String    // Snowflake ID
    CreatorID Int64String    // 创作者ID
    Code      string         // 访问的口令
    IP        string         // 访问IP
    UserAgent string         // User Agent
    CreatedAt time.Time      // 访问时间
}
```

#### 更新模型：`DownloadRecord`（下载记录）
```go
type DownloadRecord struct {
    ID         Int64String    // Snowflake ID
    UserID     Int64String    // 用户ID（暂时为0）
    ResourceID Int64String    // 资源ID
    CreatorID  Int64String    // 创作者ID
    IP         string         // 下载IP（新增）
    UserAgent  string         // User Agent（新增）
    CreatedAt  time.Time      // 下载时间
    
    // 关联
    User     *User
    Resource *Resource
    Creator  *Creator
}
```

---

### 2. **后端 API 接口**

#### 📁 新文件：`server/internal/handler/user_public.go`

#### API 1: 获取创作者空间信息（公开接口）

**接口**: `GET /api/v1/public/space/{code}`

**功能**:
- 通过口令获取创作者空间信息
- 返回创作者资料、资源列表、统计数据
- 自动记录访问日志

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "creator": {
      "id": "1234567890",
      "name": "创作者昵称",
      "avatar": "https://...",
      "description": "个人简介",
      "code": "y2722"
    },
    "resources": [
      {
        "id": "9876543210",
        "title": "精美头像.png",
        "type": "avatar",
        "url": "https://tos-cn-beijing.volces.com/...",
        "size": 102400,
        "downloadCount": 123
      }
    ],
    "stats": {
      "totalViews": 1500,
      "totalDownloads": 450
    }
  }
}
```

---

#### API 2: 下载资源（公开接口）

**接口**: `POST /api/v1/public/resource/{id}/download`

**功能**:
- 用户点击下载资源
- 记录下载行为（IP、User Agent）
- 增加资源下载计数
- 返回下载链接（直接返回 TOS URL，暂不需要广告令牌）

**说明**: 
> 🎬 **广告集成计划**：
> - 当前：直接返回下载链接
> - 未来：小程序集成抖音广告后，需要验证 `adToken` 参数

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "downloadUrl": "https://tos-cn-beijing.volces.com/valley-resources/avatars/xxx.png",
    "resource": {
      "id": "9876543210",
      "title": "精美头像.png",
      "type": "avatar",
      "size": 102400
    }
  }
}
```

---

#### API 3: 获取我的下载记录（需登录）

**接口**: `GET /api/v1/user/downloads`

**参数**:
- `page`: 页码（默认1）
- `pageSize`: 每页数量（默认20）

**功能**:
- 用户查看自己的下载历史
- 支持分页
- 关联展示资源和创作者信息

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "123456",
        "resource": {
          "id": "9876543210",
          "title": "精美头像.png",
          "url": "https://..."
        },
        "creator": {
          "id": "1234567890",
          "name": "创作者昵称"
        },
        "createdAt": "2026-03-02T21:30:00Z"
      }
    ],
    "total": 15
  }
}
```

---

### 3. **路由配置更新**

#### 新增路由组：`/api/v1/public`（公开接口）

```go
public := api.Group("/public")
{
    // 获取创作者空间
    public.GET("/space/:code", handler.GetCreatorSpace)
    
    // 下载资源
    public.POST("/resource/:id/download", handler.DownloadResource)
}
```

#### 新增路由组：`/api/v1/user`（用户接口）

```go
user := api.Group("/user")
user.Use(middleware.Auth(cfg))
{
    // 获取我的下载记录
    user.GET("/downloads", handler.GetMyDownloads)
}
```

---

### 4. **数据库迁移**

#### 新增表：
- `code_access_logs` - 口令访问日志
- 更新 `download_records` 表结构（添加 `ip` 和 `user_agent` 字段）

#### 自动迁移配置：
```go
DB.AutoMigrate(
    &model.User{},
    &model.Creator{},
    &model.Resource{},
    &model.DownloadRecord{},
    &model.UploadRecord{},
    &model.CodeAccessLog{},  // 新增
)
```

---

## 📊 业务流程

### 用户下载完整流程

```
1. 用户获取口令（如：y2722）
   ↓
2. 访问 GET /public/space/y2722
   → 返回创作者空间信息和资源列表
   → 记录访问日志
   ↓
3. 用户浏览资源，选择要下载的资源
   ↓
4. 点击下载按钮，调用 POST /public/resource/{id}/download
   → 记录下载行为
   → 增加下载计数
   → 返回下载链接
   ↓
5. 前端使用下载链接让用户下载文件
```

### 未来广告集成流程（小程序开发时）

```
1-3. (同上)
   ↓
4. 用户点击下载 → 触发抖音激励视频广告
   ↓
5. 用户观看广告完成
   → 抖音 SDK 返回 adToken
   ↓
6. POST /public/resource/{id}/download
   Body: { "adToken": "xxx" }
   → 后端验证 adToken 有效性
   → 记录下载 + 广告收益
   → 返回下载链接
```

---

## 🔧 技术细节

### 1. Snowflake ID 一致性
- 所有新记录使用 Snowflake ID
- 自动生成，保证分布式唯一性

### 2. IP 和 User Agent 追踪
- 用于数据分析和防刷
- 使用 `c.ClientIP()` 获取真实 IP
- 记录 User Agent 用于设备分析

### 3. 关联查询优化
- 使用 GORM Preload 预加载关联数据
- 减少 N+1 查询问题

### 4. 下载计数原子更新
```go
db.Model(&resource).Update("download_count", resource.DownloadCount+1)
```

---

## 📝 Swagger 文档

所有接口已添加 Swagger 注释，可以通过以下方式查看：

1. 启动服务器：`cd server && air`
2. 访问：http://localhost:8080/swagger/index.html
3. 查看「用户端 - 公开接口」分类

---

## ⏭️ 下一步计划

### Phase 1.5：Admin 后台未对接功能
- [ ] 创作者管理页面（前端）
- [ ] 下载记录管理页面（前端）
- [ ] 统计数据看板（前端）
- [ ] 资源审核功能

### Phase 2：小程序开发
- [ ] 抖音小程序项目搭建
- [ ] 创作者空间展示页（小程序端）
- [ ] 集成抖音激励视频广告
- [ ] 下载功能实现

### Phase 3：收益系统
- [ ] 广告收益计算
- [ ] 创作者收益结算
- [ ] 平台抽成配置
- [ ] 收益数据看板

---

## 🐛 已知问题

### 1. 用户系统未完善
- 当前下载记录的 `userID` 为 0（未登录用户）
- 需要后续接入微信/抖音登录

### 2. 防刷机制缺失
- 同一IP短时间内多次下载未限制
- 需要添加频率限制（Rate Limiting）

### 3. 下载链接永久有效
- 当前直接返回 TOS 公开 URL
- 建议后续使用临时签名 URL（带过期时间）

---

## 📖 相关文档

- [火山引擎 TOS 集成](./TOS_INTEGRATION.md)
- [Snowflake ID 完整指南](./guides/2026-03-01_standard_snowflake-id-complete-guide.md)
- [API 请求规范](./API_REQUEST_GUIDE.md)

---

**✨ 核心下载流程已完成！等待小程序开发时集成广告系统。**
