# 创作者访问管理端指南

## 🎯 架构方案

我们采用了**方案1:创作者可以访问管理端**,这是最灵活且用户体验最好的方案。

## 🏗️ 实现细节

### 1. 后端中间件 (server/internal/middleware/middleware.go)

新增了两个中间件函数:

```go
// CreatorOrAdmin - 创作者或管理员都可以访问
func CreatorOrAdmin() gin.HandlerFunc {
    return func(c *gin.Context) {
        role, exists := c.Get("role")
        if !exists || (role != "admin" && role != "creator") {
            c.JSON(403, gin.H{"code": 403, "message": "需要创作者或管理员权限"})
            c.Abort()
            return
        }
        c.Next()
    }
}

// CreatorOnly - 仅创作者可以访问
func CreatorOnly() gin.HandlerFunc {
    return func(c *gin.Context) {
        role, exists := c.Get("role")
        if !exists || role != "creator" {
            c.JSON(403, gin.H{"code": 403, "message": "需要创作者权限"})
            c.Abort()
            return
        }
        c.Next()
    }
}
```

### 2. 路由权限分层 (server/internal/router/router.go)

```go
admin := api.Group("/admin")
admin.Use(middleware.Auth(cfg))
{
    // ========== 管理员专属接口 ==========
    adminOnly := admin.Group("")
    adminOnly.Use(middleware.AdminOnly())
    {
        // 用户管理、创作者管理、全局统计、全局记录等
    }

    // ========== 创作者和管理员共享接口 ==========
    content := admin.Group("")
    content.Use(middleware.CreatorOrAdmin())
    {
        // 创作者空间管理、资源管理
        // 创作者只能管理自己的空间和资源
    }
}
```

### 3. 前端角色识别 (apps/admin/src)

#### 登录页面 (Login.tsx)
- ✅ 检查角色权限,只允许 `admin` 和 `creator` 登录
- ✅ 更新页面标题为"创作者·管理后台"

#### 布局菜单 (Layout.tsx)
- ✅ 管理员菜单:完整权限(数据概览、用户管理、创作者管理、资源管理、记录管理)
- ✅ 创作者菜单:受限权限(我的资源、我的空间)
- ✅ 头像旁显示"[创作者]"标签

#### 创作者管理页面 (Creators.tsx)
- ✅ 管理员:可以查看所有创作者,执行 CRUD 操作
- ✅ 创作者:只能查看自己的数据,不能编辑/删除
- ✅ 标题:管理员显示"创作者管理",创作者显示"我的空间管理"

#### 资源管理页面 (Resources.tsx)
- ✅ 管理员:可以查看所有资源,可筛选创作者,可配置上传者
- ✅ 创作者:自动筛选只显示自己的资源,不显示创作者筛选器
- ✅ 标题:管理员显示"资源管理",创作者显示"我的资源"

## 🧪 测试步骤

### 前置条件
1. 确保数据库中有测试数据:
   - 管理员账号:`admin/admin123`
   - 创作者账号:需要先创建用户并设置为创作者

### 创建测试创作者账号

#### 方法1:通过管理端创建

1. 使用管理员账号登录
2. 进入"用户管理"页面
3. 创建新用户:
   ```
   用户名: creator_test
   昵称: 测试创作者
   密码: creator123
   角色: user
   ```
4. 进入"创作者管理"页面
5. 点击"添加创作者",选择刚创建的用户
6. 修改用户表,将该用户的 role 改为 `creator`:
   ```sql
   UPDATE users SET role = 'creator' WHERE username = 'creator_test';
   ```

#### 方法2:直接通过数据库创建

```sql
-- 1. 创建用户(密码是 creator123 的 bcrypt 哈希)
INSERT INTO users (id, username, nickname, password, role, is_active, created_at, updated_at)
VALUES (
    2028477627731283970,
    'creator_test',
    '测试创作者',
    '$2a$10$...',  -- 使用 bcrypt 哈希后的密码
    'creator',
    1,
    datetime('now'),
    datetime('now')
);

-- 2. 创建对应的创作者记录
INSERT INTO creators (id, user_id, name, description, is_active, created_at, updated_at)
VALUES (
    2028477627731283971,
    2028477627731283970,
    '测试创作者',
    '这是一个测试创作者',
    1,
    datetime('now'),
    datetime('now')
);
```

### 测试创作者登录

1. **登录测试**
   ```
   用户名: creator_test
   密码: creator123
   ```
   - ✅ 应该能成功登录
   - ✅ 右上角显示"测试创作者 [创作者]"

2. **菜单显示测试**
   - ✅ 只显示两个菜单:"我的资源"和"我的空间"
   - ❌ 不显示"数据概览"、"用户管理"、"记录管理"

3. **我的空间测试**
   - ✅ 只能看到自己的创作者记录
   - ❌ 不能创建/编辑/删除创作者
   - ✅ 可以点击"空间"按钮管理自己的空间
   - ✅ 在空间管理页面可以创建/编辑/删除空间
   - ✅ 在空间管理页面可以绑定资源

4. **我的资源测试**
   - ✅ 自动筛选只显示自己的资源
   - ❌ 不显示"创作者"筛选器
   - ❌ 不显示"配置上传者"按钮
   - ✅ 可以上传新资源
   - ✅ 可以删除自己的资源

5. **权限测试**
   - 尝试直接访问管理员专属页面:
     - `http://localhost:5173/dashboard` → ❌ 应该403或重定向
     - `http://localhost:5173/users` → ❌ 应该403或重定向
     - `http://localhost:5173/records` → ❌ 应该403或重定向

### 测试管理员登录

1. **登录测试**
   ```
   用户名: admin
   密码: admin123
   ```
   - ✅ 应该能成功登录
   - ✅ 右上角显示"admin"(不显示创作者标签)

2. **菜单显示测试**
   - ✅ 显示完整菜单:数据概览、用户管理、创作者管理、资源管理、记录管理

3. **完整权限测试**
   - ✅ 可以访问所有页面
   - ✅ 可以执行所有 CRUD 操作
   - ✅ 可以查看所有创作者和资源
   - ✅ 可以配置资源的上传者

## 📊 权限对比表

| 功能 | 管理员 | 创作者 |
|------|--------|--------|
| 数据概览 | ✅ | ❌ |
| 用户管理 | ✅ | ❌ |
| 创作者管理(查看所有) | ✅ | ❌ |
| 创作者管理(查看自己) | ✅ | ✅ |
| 创作者 CRUD | ✅ | ❌ |
| 空间管理(自己的) | ✅ | ✅ |
| 资源管理(查看所有) | ✅ | ❌ |
| 资源管理(查看自己的) | ✅ | ✅ |
| 资源上传 | ✅ | ✅ |
| 资源删除(自己的) | ✅ | ✅ |
| 配置资源上传者 | ✅ | ❌ |
| 记录管理 | ✅ | ❌ |

## 🔐 数据隔离机制

### 后端
- 创作者通过 JWT 中的 `userId` 识别身份
- 在 handler 层需要添加数据过滤逻辑(当前前端实现,后续可优化到后端)

### 前端
- 创作者登录时自动获取自己的 Creator ID
- 资源列表自动添加 `creatorId` 过滤参数
- 创作者列表前端过滤只显示自己的记录

## 🚀 后续优化建议

### 1. 后端数据隔离(推荐)
在 handler 层添加自动过滤:
```go
func ListResources(c *gin.Context) {
    role, _ := c.Get("role")
    userId, _ := c.Get("userId")
    
    query := db.Model(&Resource{})
    
    // 如果是创作者,自动过滤只显示自己的资源
    if role == "creator" {
        var creator Creator
        db.Where("user_id = ?", userId).First(&creator)
        query = query.Where("creator_id = ?", creator.ID)
    }
    
    // ... 执行查询
}
```

### 2. 路由级别的数据隔离
为创作者创建专用路由:
```go
// 创作者专用路由
creator := api.Group("/creator")
creator.Use(middleware.Auth(cfg), middleware.CreatorOnly())
{
    creator.GET("/my-spaces", handler.GetMySpaces)
    creator.GET("/my-resources", handler.GetMyResources)
    creator.POST("/resources/upload", handler.UploadMyResource)
}
```

### 3. 前端路由守卫
添加 React Router 守卫,根据角色限制页面访问:
```typescript
<Route 
    path="/dashboard" 
    element={
        <ProtectedRoute allowedRoles={['admin']}>
            <Dashboard />
        </ProtectedRoute>
    } 
/>
```

## 📝 注意事项

1. **密码存储**:所有密码必须使用 bcrypt 加密存储
2. **JWT 安全**:Token 存储在 HttpOnly Cookie 中,防止 XSS 攻击
3. **角色验证**:前端+后端双重验证,前端仅用于 UI 显示,安全依赖后端
4. **数据隔离**:创作者只能访问自己的数据,后端需严格验证
5. **空间码唯一性**:空间码在全局范围内唯一,6位大写字母+数字

## 🎉 完成状态

- ✅ 后端中间件实现
- ✅ 路由权限分层
- ✅ 前端登录权限检查
- ✅ 前端菜单动态显示
- ✅ 创作者页面角色适配
- ✅ 资源页面角色适配
- ⏳ 后端数据隔离优化(待实现)
- ⏳ 前端路由守卫(待实现)
