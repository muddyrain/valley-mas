# 🔐 登录认证系统完成

## 📋 功能概述

已完成完整的登录认证系统，包括：
- ✅ JWT Token 生成和验证
- ✅ 密码 MD5 加密
- ✅ 登录接口
- ✅ 认证中间件
- ✅ 管理员权限验证
- ✅ 前端登录页面
- ✅ Token 自动携带
- ✅ 路由守卫
- ✅ 退出登录

---

## 🎯 后端实现

### 1. JWT Token 工具 (`server/internal/utils/jwt.go`)

```go
// 生成 Token
token, err := utils.GenerateToken(
    userID int64,      // 用户ID
    username string,   // 用户名
    role string,       // 角色
    secret string,     // JWT 密钥
    expireHours int64, // 过期时间（小时）
)

// 解析 Token
claims, err := utils.ParseToken(tokenString, secret)
// 返回：UserID, Username, Role
```

**Token 结构：**
```json
{
  "userId": 1234567890123456789,
  "username": "admin",
  "role": "admin",
  "exp": 1709740800,  // 过期时间
  "iat": 1709654400,  // 签发时间
  "nbf": 1709654400   // 生效时间
}
```

---

### 2. 密码加密工具 (`server/internal/utils/password.go`)

```go
// MD5 加密密码
hashedPassword := utils.HashPassword("admin123")

// 验证密码
isValid := utils.CheckPassword("admin123", hashedPassword)
```

**示例：**
- 原始密码：`admin123`
- MD5 加密：`0192023a7bbd73250516f069df18b500`

---

### 3. 登录接口 (`/api/v1/login`)

#### 请求：
```bash
POST /api/v1/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

#### 响应：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userInfo": {
      "id": 1234567890123456789,
      "username": "admin",
      "nickname": "管理员",
      "avatar": "https://via.placeholder.com/150",
      "role": "admin",
      "email": "admin@valley.com"
    }
  }
}
```

---

### 4. 认证中间件 (`server/internal/middleware/middleware.go`)

**功能：**
1. 从 `Authorization` 头获取 token
2. 验证 token 有效性
3. 提取用户信息存入 context

**使用方式：**
```go
// 需要认证的路由
auth := api.Group("")
auth.Use(middleware.Auth(cfg))
{
    auth.GET("/user/info", handler.GetUserInfo)
}

// 需要管理员权限的路由
admin := api.Group("/admin")
admin.Use(middleware.Auth(cfg), middleware.AdminOnly())
{
    admin.GET("/users", handler.ListUsers)
}
```

**Context 中的值：**
```go
userID := c.Get("userId")      // int64
username := c.Get("username")  // string
role := c.Get("role")          // string
```

---

### 5. User 模型更新

添加了登录相关字段：
```go
type User struct {
    // ... 其他字段
    
    // 管理后台登录字段
    Username string `gorm:"size:50;uniqueIndex" json:"username,omitempty"` 
    Password string `gorm:"size:255" json:"-"` // MD5加密，不返回给前端
    
    Role     string `gorm:"size:20;default:'user'" json:"role"`
    IsActive bool   `gorm:"default:true" json:"isActive"`
}
```

---

### 6. 默认测试账号

运行 `/init-data` 后会创建以下账号：

| 用户名 | 密码 | 角色 | 说明 |
|-------|------|------|------|
| admin | admin123 | admin | 管理员 |
| creator | creator123 | creator | 创作者 |

---

## 💻 前端实现

### 1. 登录 API (`apps/admin/src/api/auth.ts`)

```typescript
import { reqLogin, reqGetCurrentUser } from '@/api/auth'

// 登录
const response = await reqLogin({
  username: 'admin',
  password: 'admin123'
})

// 获取当前用户信息
const userInfo = await reqGetCurrentUser()
```

---

### 2. Token 自动携带 (`apps/admin/src/utils/request.ts`)

**请求拦截器：**
```typescript
// 自动从 localStorage 读取 token 并添加到请求头
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

**响应拦截器：**
```typescript
// 401 自动跳转登录页
http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

---

### 3. 登录页面 (`apps/admin/src/pages/Login.tsx`)

**功能：**
- ✅ 用户名/密码输入
- ✅ 表单验证
- ✅ Loading 状态
- ✅ 登录成功后保存 token 和用户信息
- ✅ 自动跳转到首页
- ✅ 显示默认账号密码提示

**存储：**
```typescript
localStorage.setItem('token', res.token)
localStorage.setItem('userInfo', JSON.stringify(res.userInfo))
```

---

### 4. 路由守卫 (`apps/admin/src/App.tsx`)

```typescript
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

// 使用
<Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
  <Route path="dashboard" element={<Dashboard />} />
  {/* ... */}
</Route>
```

---

### 5. 退出登录 (`apps/admin/src/layouts/Layout.tsx`)

```typescript
const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
  message.success('已退出登录')
  navigate('/login')
}
```

---

## 🚀 使用流程

### 1️⃣ 初始化数据库

```bash
# 删除旧数据库（如果存在）
rm server/data/valley.db

# 启动服务
cd server
air

# 初始化测试数据
curl http://localhost:8080/init-data
```

---

### 2️⃣ 测试登录接口

```bash
# 登录
curl -X POST http://localhost:8080/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 返回 token
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userInfo": {...}
  }
}
```

---

### 3️⃣ 使用 Token 访问受保护接口

```bash
# 获取用户列表（需要管理员权限）
curl http://localhost:8080/api/v1/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### 4️⃣ 前端登录

1. 访问 `http://localhost:5173/login`
2. 输入用户名：`admin`
3. 输入密码：`admin123`
4. 点击登录
5. 自动跳转到首页

---

## 🔒 安全特性

### 1. 密码加密
- ✅ 使用 MD5 加密存储
- ✅ 密码字段不返回给前端（`json:"-"`）
- ✅ 登录时验证加密后的密码

### 2. Token 安全
- ✅ 使用 JWT 标准
- ✅ HMAC-SHA256 签名算法
- ✅ 7 天过期时间
- ✅ 包含用户 ID、角色等信息

### 3. 权限控制
- ✅ 认证中间件：验证 token 有效性
- ✅ 管理员中间件：验证 admin 角色
- ✅ 前端路由守卫：检查登录状态
- ✅ 401 自动跳转登录页

### 4. 用户状态
- ✅ 检查账号是否被禁用
- ✅ 禁用账号无法登录

---

## ⚙️ 配置说明

### JWT 配置 (`server/internal/config/config.go`)

```go
JWT: JWTConfig{
    Secret: getEnv("JWT_SECRET", "valley-secret-key"), // 密钥
    Expire: 24 * 7,  // 过期时间：7天
}
```

**环境变量：**
```bash
# 生产环境建议设置复杂的密钥
export JWT_SECRET="your-very-secure-secret-key-here"
```

---

## 📊 数据库更新

### 新增字段

```sql
ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN password VARCHAR(255);
```

**GORM 会自动迁移表结构** ✅

---

## 🎯 API 路由变化

### 公开接口（无需认证）
- `POST /api/v1/login` - 登录

### 需要认证的接口
- `GET /api/v1/user/current` - 获取当前用户信息
- `GET /api/v1/user/info` - 用户信息
- `GET /api/v1/user/downloads` - 用户下载记录
- `POST /api/v1/resource/download` - 记录下载

### 管理员接口（需要 admin 角色）
- `GET /api/v1/admin/users` - 用户列表
- `POST /api/v1/admin/users` - 创建用户
- `PUT /api/v1/admin/users/:id` - 更新用户
- `DELETE /api/v1/admin/users/:id` - 删除用户
- ... 所有 `/admin` 下的接口

---

## 🐛 常见问题

### 1. 登录后立即 401

**原因：** Token 未正确保存或发送

**解决：**
```typescript
// 检查 localStorage
console.log(localStorage.getItem('token'))

// 检查请求头
// 浏览器 DevTools -> Network -> Request Headers
Authorization: Bearer eyJhbGciOi...
```

---

### 2. Token 过期

**现象：** 登录后一段时间自动跳转登录页

**原因：** Token 默认 7 天过期

**解决：** 重新登录或调整过期时间

---

### 3. 管理员接口 403

**原因：** 当前用户不是 admin 角色

**解决：** 使用 admin 账号登录

---

### 4. 密码错误

**默认密码：**
- 管理员：`admin123`
- 创作者：`creator123`

**重置密码：**
```bash
# 删除数据库重新初始化
rm server/data/valley.db
curl http://localhost:8080/init-data
```

---

## 📝 TODO 清单

### 短期
- [ ] 添加"记住我"功能（延长 token 有效期）
- [ ] 添加刷新 token 机制
- [ ] 添加找回密码功能
- [ ] 添加修改密码功能

### 长期
- [ ] 使用 bcrypt 替代 MD5（更安全）
- [ ] 添加验证码登录
- [ ] 添加 OAuth 第三方登录
- [ ] 添加登录日志记录
- [ ] 添加异地登录提醒

---

## 🎉 总结

### ✅ 已完成功能

1. **后端：**
   - JWT Token 生成/验证
   - 密码 MD5 加密
   - 登录接口
   - 认证中间件
   - 管理员权限验证
   - 用户状态检查

2. **前端：**
   - 登录页面
   - Token 自动携带
   - 路由守卫
   - 退出登录
   - 401 自动跳转
   - 用户信息显示

### 🎯 核心优势

- ✅ **安全性**：JWT + MD5 + 权限验证
- ✅ **便捷性**：Token 自动携带，无需手动处理
- ✅ **完整性**：前后端一体化方案
- ✅ **可扩展性**：易于添加新的权限角色

---

**现在你的 Valley 项目已经拥有完整的登录认证系统了！** 🎊
