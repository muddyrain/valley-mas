# Valley MAS - 创作者口令空间

一个创作者口令分享平台，用户可通过口令进入创作者空间下载头像、壁纸等图片资源。

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

```bash
# 启动小程序开发（微信）
pnpm dev:mini

# 启动 H5/PC 端开发
pnpm dev:h5

# 启动管理后台
pnpm dev:admin

# 启动 Go 服务端
cd server
cp .env.example .env  # 配置环境变量
go mod tidy
go run main.go
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
- 📊 数据统计概览
- 👥 用户管理
- 🎨 创作者管理
- 📁 资源管理
- 📝 上传/下载记录查看

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
