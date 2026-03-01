# Valley MAS - 用户管理快速启动指南

## 立即开始测试

### 1. 启动后端服务

打开终端，执行：

```powershell
cd d:\my-code\valley-mas\server
air
```

或者不使用热重载：

```powershell
cd d:\my-code\valley-mas\server
go run main.go
```

后端将在 http://localhost:8080 启动

### 2. 启动前端管理后台

打开新的终端，执行：

```powershell
cd d:\my-code\valley-mas\apps\admin
pnpm dev
```

前端将在 http://localhost:5173 启动

### 3. 访问管理后台

浏览器打开：http://localhost:5173

导航到"用户管理"菜单

## 快速测试 API

### 使用 PowerShell 测试（无需登录认证）

如果后端没有强制要求认证，可以直接测试：

#### 获取用户列表
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users?page=1&pageSize=10" -Method Get
```

#### 创建微信用户
```powershell
$body = @{
    nickname = "测试微信用户"
    avatar = "https://via.placeholder.com/150"
    platform = "wechat"
    openid = "wx_test_001"
    wechatOpenid = "wx_test_001"
    role = "user"
    isActive = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users" -Method Post -Body $body -ContentType "application/json"
```

#### 创建抖音用户
```powershell
$body = @{
    nickname = "测试抖音用户"
    avatar = "https://via.placeholder.com/150"
    platform = "douyin"
    openid = "dy_test_001"
    douyinOpenid = "dy_test_001"
    douyinNickname = "我是抖音用户"
    douyinGender = 1
    douyinCity = "北京"
    role = "user"
    isActive = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users" -Method Post -Body $body -ContentType "application/json"
```

#### 按平台筛选
```powershell
# 查询所有抖音用户
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users?platform=douyin" -Method Get

# 查询所有微信用户
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users?platform=wechat" -Method Get
```

#### 搜索用户
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users?keyword=测试" -Method Get
```

## 功能清单

### ✅ 后端已实现

- [x] User 模型扩展（支持微信、抖音）
- [x] 用户列表查询（分页、搜索、筛选）
- [x] 创建用户
- [x] 更新用户
- [x] 删除用户
- [x] 更新用户状态
- [x] 多条件筛选（平台、角色）

### ✅ 前端已实现

- [x] 用户列表展示
- [x] 搜索功能
- [x] 平台筛选（微信/抖音/小程序）
- [x] 角色筛选（用户/管理员/创作者）
- [x] 分页
- [x] 创建用户弹窗
- [x] 编辑用户弹窗
- [x] 删除确认
- [x] 状态切换
- [x] 智能表单（根据平台显示不同字段）
- [x] 响应式表格
- [x] 完整的 TypeScript 类型支持

### ✅ 其他

- [x] Axios 请求封装（拦截器、错误处理）
- [x] API 类型定义
- [x] 数据库迁移脚本
- [x] 完整的 API 文档
- [x] 抖音对接指南
- [x] 微信对接指南

## 核心代码位置

### 后端
- **用户模型**: `server/internal/model/model.go`
- **用户处理器**: `server/internal/handler/handler.go` (ListUsers, CreateUser, UpdateUser, DeleteUser 等)
- **路由配置**: `server/internal/router/router.go`

### 前端
- **用户 API**: `apps/admin/src/api/user.ts`
- **用户管理页**: `apps/admin/src/pages/Users.tsx`
- **Axios 封装**: `apps/admin/src/utils/request.ts`
- **类型定义**: `apps/admin/src/types/api.ts`

### 文档
- **API 文档**: `docs/USER_API.md`
- **完成说明**: `docs/USER_MANAGEMENT_DONE.md`

## 下一步

1. **测试所有功能**：确保增删改查都正常工作
2. **实现认证**：添加登录功能和 JWT 认证
3. **完善中间件**：实现 Auth 和 AdminOnly 中间件
4. **继续其他模块**：按照同样的模式实现创作者管理、资源管理等

## 常见问题

### 前端代理配置

如果前端无法访问后端，检查 `apps/admin/vite.config.ts` 的代理配置：

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

### CORS 问题

后端已配置 CORS 中间件在 `server/internal/middleware/middleware.go`

### 数据库位置

SQLite 数据库文件：`server/data/valley.db`

## 技术支持

查看详细文档：
- 📖 [用户 API 文档](./USER_API.md)
- ✅ [功能完成说明](./USER_MANAGEMENT_DONE.md)

---

🚀 现在你可以开始测试用户管理的完整功能了！
