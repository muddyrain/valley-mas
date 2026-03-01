# Valley MAS - 创作者口令空间

一个创作者口令分享平台，用户可通过口令进入创作者空间下载头像、壁纸等图片资源。

## ✨ 最新更新 (2026-03-01)

### � Bug 修复 (v1.1.1)
- ✅ **修复强制初始化唯一约束冲突问题**
  - 问题：多次执行 `force=true` 时出现 `UNIQUE constraint failed`
  - 修复：重置 SQLite 自增序列，使用事务确保原子性
  - 详情：[Bug 修复文档](docs/BUG_FIX_INIT.md)

### �🔐 完整的登录认证系统 (v1.1.0)
- ✅ JWT Token 认证
- ✅ 密码 MD5 加密
- ✅ 角色权限控制（admin/creator/user）
- ✅ Token 自动携带和刷新
- ✅ 401 自动跳转登录

### 🎯 优化功能 (v1.1.0)
- ✅ 数据初始化支持强制重新创建 (`/init-data?force=true`)
- ✅ 完善的全局错误提示（网络错误、HTTP 错误、业务错误）
- ✅ Snowflake ID 系统（和抖音保持一致）

### 📚 完整文档
- [快速启动](GET_STARTED.md) - 3分钟快速开始
- [快速参考](REFERENCE_CARD.md) - 常用命令速查
- [认证系统](docs/AUTH_SYSTEM.md) - 登录认证详解
- [优化指南](docs/OPTIMIZATION_GUIDE.md) - 优化说明
- [Bug 修复](docs/BUG_FIX_INIT.md) - 初始化问题修复

---

## 项目结构

```
valley-mas/
├── apps/
│   ├── mini-app/          # Taro 4 小程序 + H5 (PC端)
│   └── admin/             # React 19 + Vite 管理后台
├── packages/
│   └── shared/            # 前端共享代码（类型定义、工具函数等）
├── server/                # Go + Gin 服务端
├── package.json           # Monorepo 配置
├── pnpm-workspace.yaml    # pnpm workspace 配置
└── turbo.json             # Turborepo 配置
```

## 技术栈

| 端 | 技术栈 |
|---|---|
| 小程序/PC | Taro 4 + React 18 + Tailwind CSS |
| 管理后台 | React 19 + Vite 6 + Ant Design 5 + TanStack Query + Zustand |
| 服务端 | Go 1.23 + Gin + GORM |
| 存储 | 火山引擎对象存储 (TOS) |
| Monorepo | Turborepo + pnpm |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动开发

#### 后端服务

```bash
cd server
air  # 热重载启动
```

#### 初始化数据

```bash
# 普通初始化（数据存在则跳过）
curl http://localhost:8080/init-data

# 强制重新初始化（清空所有数据）⚠️
curl http://localhost:8080/init-data?force=true
```

**默认测试账号：**
- 管理员：`admin` / `admin123`
- 创作者：`creator` / `creator123`

#### 前端应用

```bash
# 启动小程序开发（微信）
pnpm dev:mini

# 启动 H5/PC 端开发
pnpm dev:h5

# 启动管理后台
pnpm dev:admin
# 访问：http://localhost:5173/login
```

### 3. 快速测试

```powershell
# 运行自动化测试
.\test-auth.ps1
```

### 3. 构建

```bash
# 构建所有
pnpm build

# 构建小程序
pnpm build:mini

# 构建 H5
pnpm build:h5

# 构建管理后台
pnpm build:admin

# 构建 Go 服务端
cd server && go build -o bin/server main.go
```

## 核心功能

### 小程序/PC 端
- 🔑 口令输入进入创作者空间
- 🖼️ 浏览创作者上传的图片（头像、壁纸）
- 📥 下载/保存图片
- 👤 创作者注册与口令管理

### 管理后台
- � 完整的登录认证系统
  - JWT Token 认证
  - 密码加密存储
  - 角色权限控制
  - 自动 token 刷新
- �📊 数据统计概览
- 👥 用户管理（CRUD）
- 🎨 创作者管理
- 📁 资源管理
- 📝 上传/下载记录查看
- 🎯 Snowflake ID 系统（和抖音保持一致）

---

## 📚 文档导航

### 快速上手
- **[快速启动](QUICK_START.md)** - 5分钟快速开始
- **[快速参考](REFERENCE_CARD.md)** - 常用命令速查

### 功能详解
- **[认证系统](docs/AUTH_SYSTEM.md)** - 登录认证完整文档
- **[优化指南](docs/OPTIMIZATION_GUIDE.md)** - 最新优化说明
- **[Snowflake ID](docs/SNOWFLAKE_ID_MIGRATION.md)** - ID 系统详解

### 开发参考
- **[开发指南](DEV_GUIDE.md)** - 开发环境配置
- **[更新日志](CHANGELOG.md)** - 版本更新记录

---

## 🎯 常用命令

```bash
# 后端开发
cd server && air

# 前端开发
cd apps/admin && pnpm dev

# 初始化数据
curl http://localhost:8080/init-data

# 强制重新初始化
curl http://localhost:8080/init-data?force=true

# 测试系统
.\test-auth.ps1
```

---

## 环境变量配置

### 服务端 (server/.env)

```bash
# 服务端口
PORT=8080

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=valley

# JWT 配置
JWT_SECRET=your-jwt-secret-key

# 火山引擎 TOS 配置
TOS_ACCESS_KEY=your_access_key
TOS_SECRET_KEY=your_secret_key
TOS_BUCKET=your_bucket_name
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_REGION=cn-beijing
```

## License

MIT
