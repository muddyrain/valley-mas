# 🚀 快速启动指南

## 第一次使用

### 1️⃣ 启动后端

```powershell
cd server
air
```

**期望输出：**
```
✅ Snowflake ID generator initialized (Node ID: 1)
✅ Database connected successfully
🚀 Server starting on port 8080
```

---

### 2️⃣ 初始化数据

```powershell
# 新开一个终端
curl http://localhost:8080/init-data
```

**创建的账号：**
- 管理员：`admin` / `admin123`
- 创作者：`creator` / `creator123`

---

### 3️⃣ 测试登录系统

```powershell
.\test-auth.ps1
```

---

### 4️⃣ 启动前端

```powershell
cd apps/admin
pnpm dev
```

---

### 5️⃣ 浏览器访问

打开：http://localhost:5173/login

- 用户名：`admin`
- 密码：`admin123`

---

## 日常使用

### 启动开发环境

```powershell
# 终端 1：后端
cd server && air

# 终端 2：前端
cd apps/admin && pnpm dev
```

### 访问地址

- **前端：** http://localhost:5173
- **后端：** http://localhost:8080
- **API 文档：** http://localhost:8080

---

## 常用命令

### 后端

```bash
# 热重载启动
air

# 直接运行
go run main.go

# 编译
go build -o tmp/main.exe .

# 初始化数据
curl http://localhost:8080/init-data
```

### 前端

```bash
# 开发
pnpm dev

# 构建
pnpm build

# 预览
pnpm preview
```

---

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| creator | creator123 | 创作者 |

---

## 项目结构

```
valley-mas/
├── server/                 # Go 后端
│   ├── internal/
│   │   ├── config/        # 配置
│   │   ├── database/      # 数据库
│   │   ├── handler/       # 接口处理
│   │   ├── middleware/    # 中间件
│   │   ├── model/         # 数据模型
│   │   ├── router/        # 路由
│   │   └── utils/         # 工具函数
│   ├── main.go           # 入口文件
│   └── go.mod            # 依赖管理
│
├── apps/admin/            # React 管理后台
│   ├── src/
│   │   ├── api/          # API 接口
│   │   ├── layouts/      # 布局组件
│   │   ├── pages/        # 页面组件
│   │   └── utils/        # 工具函数
│   └── package.json      # 依赖管理
│
└── docs/                  # 文档
    ├── AUTH_SYSTEM.md    # 认证系统详细文档
    └── ...
```

---

## 端口说明

- **8080** - Go 后端 API
- **5173** - Vite 前端开发服务器

---

## 环境变量（可选）

```bash
# JWT 配置
export JWT_SECRET="your-secret-key"
export JWT_EXPIRE=168  # 小时

# 数据库配置
export DB_DRIVER="sqlite"  # 或 mysql
export DB_SQLITE_PATH="./data/valley.db"
```

---

## 文档

- **认证系统：** `docs/AUTH_SYSTEM.md`
- **实现总结：** `docs/AUTH_IMPLEMENTATION_SUMMARY.md`
- **Snowflake ID：** `docs/SNOWFLAKE_ID_MIGRATION.md`
- **Handler 重构：** `docs/HANDLER_REFACTOR.md`

---

## 测试

```powershell
# 自动化测试登录系统
.\test-auth.ps1

# 手动测试登录
curl -X POST http://localhost:8080/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## 常见问题

**Q: 数据库文件在哪？**  
A: `server/data/valley.db`

**Q: 如何重置数据？**  
A: 删除数据库文件，重启服务，访问 `/init-data`

**Q: 忘记密码怎么办？**  
A: 删除数据库重新初始化，或直接用默认账号 `admin/admin123`

**Q: 前端无法连接后端？**  
A: 检查后端是否启动，端口是否为 8080

---

## 下一步

1. ✅ 完成登录认证系统
2. 🚧 完善创作者管理
3. 🚧 完善资源管理
4. 🚧 对接抖音小程序

---

**准备好了吗？开始你的开发之旅！** 🎉
