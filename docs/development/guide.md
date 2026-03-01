# 🚀 开发环境快速启动指南

## ⚠️ 重要提示

当前配置为**开发模式**，已临时关闭管理后台的认证中间件，方便开发和测试。

**生产环境部署前，请务必：**
1. 在 `server/internal/router/router.go` 中启用认证中间件
2. 删除或保护 `/init-data` 初始化接口
3. 实现完整的登录和 JWT 认证系统

---

## 📝 第一步：启动服务

### 1. 启动后端服务

```powershell
cd d:\my-code\valley-mas\server
air
```

如果看到 air 热重载启动成功，说明后端已经运行在 `http://localhost:8080`

### 2. 启动前端服务

打开新的终端：

```powershell
cd d:\my-code\valley-mas\apps\admin
pnpm dev
```

前端将运行在 `http://localhost:5173`

---

## 🎯 第二步：初始化测试数据

### 方法 1：访问初始化接口（推荐）

浏览器打开或使用 PowerShell：

```powershell
# 浏览器访问
# http://localhost:8080/init-data

# 或使用 PowerShell
Invoke-RestMethod -Uri "http://localhost:8080/init-data" -Method Get
```

**这将自动创建以下测试用户：**

| 昵称 | 平台 | OpenID | 角色 | 状态 | 说明 |
|------|------|--------|------|------|------|
| 管理员 | wechat | admin_openid_001 | admin | 启用 | 管理员账户 |
| 测试用户1 | wechat | user_wx_001 | user | 启用 | 微信普通用户 |
| 抖音测试用户 | douyin | user_dy_001 | user | 启用 | 抖音用户（包含完整信息） |
| 创作者 | wechat | creator_001 | creator | 启用 | 创作者账户 |
| 禁用用户 | wechat | user_disabled_001 | user | 禁用 | 测试禁用状态 |

**响应示例：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "message": "初始化成功",
    "createdUsers": 5,
    "users": [...]
  }
}
```

### 方法 2：手动创建用户

访问管理后台：`http://localhost:5173`

1. 导航到"用户管理"页面
2. 点击"新增用户"按钮
3. 填写表单并提交

---

## ✅ 第三步：测试功能

### 访问管理后台

打开浏览器：`http://localhost:5173`

### 测试用户管理功能

1. **查看用户列表** ✅
   - 应该能看到 5 个测试用户
   - 包含微信和抖音平台的用户

2. **搜索功能** ✅
   - 搜索"管理员"
   - 搜索"抖音"
   - 搜索 OpenID（如 "admin_openid_001"）

3. **筛选功能** ✅
   - 按平台筛选：选择"微信"或"抖音"
   - 按角色筛选：选择"管理员"、"用户"或"创作者"
   - 组合筛选

4. **状态切换** ✅
   - 点击状态开关，启用/禁用用户
   - 观察"禁用用户"的状态

5. **编辑用户** ✅
   - 点击任意用户的"编辑"按钮
   - 修改信息并保存
   - 注意：切换平台会显示不同的表单字段

6. **创建新用户** ✅
   - 点击"新增用户"按钮
   - 选择"微信"平台，填写相关字段
   - 选择"抖音"平台，注意表单字段的变化
   - 提交并验证创建成功

7. **删除用户** ✅
   - 点击任意用户的"删除"按钮
   - 确认删除操作

---

## 🔧 API 测试（PowerShell）

### 获取用户列表

```powershell
# 获取所有用户
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users?page=1&pageSize=10"

# 按平台筛选
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users?platform=douyin"

# 搜索用户
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users?keyword=管理员"

# 组合查询
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users?platform=wechat&role=admin"
```

### 创建用户

```powershell
# 创建微信用户
$body = @{
    nickname = "新微信用户"
    avatar = "https://via.placeholder.com/150"
    platform = "wechat"
    openid = "wx_new_001"
    wechatOpenid = "wx_new_001"
    role = "user"
    isActive = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users" -Method Post -Body $body -ContentType "application/json"

# 创建抖音用户
$body = @{
    nickname = "新抖音用户"
    avatar = "https://via.placeholder.com/150"
    platform = "douyin"
    openid = "dy_new_001"
    douyinOpenid = "dy_new_001"
    douyinNickname = "我的抖音昵称"
    douyinGender = 2
    douyinCity = "上海"
    douyinProvince = "上海"
    douyinCountry = "中国"
    role = "user"
    isActive = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users" -Method Post -Body $body -ContentType "application/json"
```

### 更新用户

```powershell
# 更新用户信息（假设用户 ID 为 1）
$body = @{
    nickname = "更新后的昵称"
    role = "creator"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users/1" -Method Put -Body $body -ContentType "application/json"

# 更新用户状态
$body = @{
    isActive = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users/1/status" -Method Put -Body $body -ContentType "application/json"
```

### 删除用户

```powershell
# 删除用户（假设用户 ID 为 5）
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users/5" -Method Delete
```

---

## 📊 数据库查看

SQLite 数据库文件位置：`server/data/valley.db`

### 使用 SQLite 命令行查看数据

```powershell
# 进入 server 目录
cd d:\my-code\valley-mas\server

# 打开数据库（需要安装 sqlite3）
sqlite3 data/valley.db

# 查看所有用户
SELECT * FROM users;

# 查看抖音用户
SELECT id, nickname, platform, douyin_nickname, douyin_gender, douyin_city FROM users WHERE platform = 'douyin';

# 退出
.quit
```

---

## 🔍 常见问题

### Q1: 访问管理后台显示 401 错误

**A:** 确认 `server/internal/router/router.go` 中管理后台的认证中间件已注释：

```go
admin := api.Group("/admin")
// TODO: 生产环境取消注释下面这行启用认证
// admin.Use(middleware.Auth(cfg), middleware.AdminOnly())
```

如果已注释，重启后端服务（air 会自动重启）。

### Q2: 初始化数据接口返回"数据已存在"

**A:** 说明数据库中已有用户数据，无需重复初始化。如需重新初始化，可以：

1. 删除数据库文件：`server/data/valley.db`
2. 重启后端服务（GORM 会自动创建新数据库）
3. 再次访问 `/init-data`

### Q3: 前端无法连接后端

**A:** 检查以下几点：

1. 后端服务是否正常运行（`http://localhost:8080/health` 应返回 `{"status":"ok"}`）
2. 前端 vite.config.ts 中的代理配置
3. CORS 配置是否正确

### Q4: 抖音用户字段没有显示

**A:** 确认：

1. 数据库表结构已更新（GORM 会自动迁移）
2. 创建用户时选择了"抖音小程序"平台
3. 表单中填写了抖音相关字段

---

## 🎯 下一步开发建议

### 1. 实现登录功能 🔐

创建登录接口和 JWT 认证：

- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/register` - 用户注册（可选）
- `GET /api/v1/auth/profile` - 获取当前用户信息
- `POST /api/v1/auth/logout` - 用户登出

### 2. 完善认证中间件

在 `server/internal/middleware/middleware.go` 中：

- 实现 JWT token 解析和验证
- 从 token 中提取用户信息
- 设置 `userId` 和 `role` 到上下文

### 3. 启用生产环境认证

在 `server/internal/router/router.go` 中取消注释：

```go
admin.Use(middleware.Auth(cfg), middleware.AdminOnly())
```

### 4. 完善其他管理功能

按照用户管理的模式，实现：

- 创作者管理（Creators）
- 资源管理（Resources）
- 下载记录管理（Download Records）

### 5. 对接小程序

参考 `docs/USER_API.md` 文档，实现：

- 抖音小程序登录
- 微信小程序登录
- 用户信息同步

---

## 📂 重要文件位置

### 后端
- **路由配置**: `server/internal/router/router.go`
- **中间件**: `server/internal/middleware/middleware.go`
- **用户处理器**: `server/internal/handler/handler.go`
- **初始化处理器**: `server/internal/handler/init.go`
- **用户模型**: `server/internal/model/model.go`
- **数据库**: `server/data/valley.db`

### 前端
- **用户管理页**: `apps/admin/src/pages/Users.tsx`
- **用户 API**: `apps/admin/src/api/user.ts`
- **Axios 封装**: `apps/admin/src/utils/request.ts`
- **类型定义**: `apps/admin/src/types/api.ts`

### 文档
- **API 文档**: `docs/USER_API.md`
- **总结文档**: `docs/SUMMARY.md`
- **快速启动**: `QUICKSTART.md`

---

## 🎉 开始使用

现在你可以：

1. ✅ 访问 `http://localhost:8080/init-data` 初始化测试数据
2. ✅ 访问 `http://localhost:5173` 打开管理后台
3. ✅ 测试所有用户管理功能
4. ✅ 使用 PowerShell 测试 API
5. ✅ 开始开发其他功能

**祝开发顺利！** 🚀

---

## 📞 技术支持

如有问题，请参考：
- 📖 [用户 API 文档](./docs/USER_API.md)
- ✅ [功能完成说明](./docs/USER_MANAGEMENT_DONE.md)
- 📝 [总结文档](./docs/SUMMARY.md)
