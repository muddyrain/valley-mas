# Valley MAS - 创作者口令空间平台

## 🎯 系统核心定位

**Valley MAS** 是一个创作者内容分发与变现平台，通过**口令机制**实现私密空间管理，让创作者可以：

### 创作者端
- 📦 创建专属口令空间（类似抖音口令、小红书口令）
- 🎨 上传各类数字资源（头像、壁纸、表情包、贴纸等）
- 💰 通过**广告观看机制**实现内容变现
- 📊 查看空间访问数据和下载统计

### 用户端
- 🔑 输入创作者口令进入专属空间
- 🖼️ 浏览创作者提供的精美资源
- 📺 观看激励视频广告解锁下载权限
- 💾 下载保存喜欢的资源

### 管理后台
- 👥 用户管理（角色：admin / creator / user）
- 🎭 创作者审核与管理
- 📁 资源内容审核
- 📈 数据统计与分析
- 💸 收益结算管理（未来规划）

### 商业模式
```
用户观看广告 → 平台获得广告收益 → 分成给创作者
```

---alley MAS - 创作者口令空间

一个创作者口令分享平台，用户可通过口令进入创作者空间下载头像、壁纸等图片资源。

## ✨ 最新更新 (2026-03-02)

### 🎉 Phase 1 完成 - 用户下载流程 (v1.2.0)
- ✅ **用户下载核心流程**
  - 通过口令获取创作者空间
  - 资源下载（记录 IP、User Agent）
  - 我的下载记录
  - 详情：[用户下载流程文档](docs/guides/2026-03-02_feature_user-download-flow.md)

- ✅ **Admin 统计数据看板**
  - 真实统计数据（用户、创作者、资源、下载）
  - 今日数据统计
  - Dashboard 页面完善

- ✅ **数据模型完善**
  - 新增口令访问日志（`code_access_logs`）
  - 完善下载记录（添加 IP、User Agent）
  - 资源上传者信息绑定

### 📚 完整更新日志
查看 [Phase 1 完成总结](docs/guides/2026-03-02_summary_phase-1-complete.md)

---

## ✨ 历史更新

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

📑 **查看 [文档中心](docs/INDEX.md) 获取所有文档** 

快速导航：
- [快速开始指南](docs/getting-started.md) - 5 分钟搭建开发环境
- [开发规范速查](docs/quick-reference/standards.md) - Biome + API 请求规范 ⭐
- [API 请求规范](docs/API_REQUEST_GUIDE.md) - 前端 API 封装标准
- [代码质量工具](docs/CODE_QUALITY_TOOLS.md) - Biome 完整指南
- [火山引擎 TOS 集成](docs/TOS_INTEGRATION.md) - 对象存储配置

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

### 🔐 已完成功能（v1.x）

#### 认证与权限系统
- ✅ JWT Token 认证（HttpOnly Cookie）
- ✅ 密码加密存储（MD5）
- ✅ 三级角色权限（admin / creator / user）
- ✅ Token 自动验证与刷新
- ✅ 401 自动跳转登录
- ✅ 窗口激活自动验证 token

#### 用户管理系统
- ✅ 用户 CRUD（创建、查询、更新、删除）
- ✅ 用户状态管理（启用/禁用）
- ✅ 多平台用户支持（微信、抖音）
- ✅ Snowflake ID 系统（JavaScript 精度安全）

#### 数据初始化
- ✅ 测试数据自动初始化
- ✅ 强制重置功能（force=true）
- ✅ 默认管理员账号生成

#### 开发基础设施
- ✅ Air 热重载配置
- ✅ Git Hooks（Lefthook）
- ✅ **Biome 代码规范**（✨ **不使用 ESLint/Prettier**）
- ✅ **统一 API 请求规范**（✨ **禁止组件直接调用 request**）
- ✅ 文档管理系统

> **⚠️ 代码质量工具说明**：本项目使用 **Biome** 进行代码格式化和 Lint，不使用 ESLint 和 Prettier。详见：[代码质量工具说明](docs/CODE_QUALITY_TOOLS.md)
>
> **⚠️ API 请求规范说明**：所有 API 请求必须在 `src/api/` 目录集中管理，组件中禁止直接使用 `request` 或 `axios`。详见：[API 请求规范](docs/API_REQUEST_GUIDE.md)

---

### � 待开发核心功能（v2.x）

#### 1️⃣ 创作者空间系统 **[高优先级]**
- [ ] 创作者注册流程
- [ ] 创作者口令生成机制
- [ ] 创作者空间主页配置
- [ ] 创作者资料管理

#### 2️⃣ 口令验证系统 **[高优先级]**
- [ ] 口令输入与验证接口
- [ ] 口令有效期管理
- [ ] 口令访问次数限制
- [ ] 口令访问记录统计

#### 3️⃣ 资源管理系统 **[高优先级]**
- [ ] 资源上传接口（对接火山引擎 TOS）
- [ ] 资源分类管理（头像、壁纸、表情包等）
- [ ] 资源预览与详情
- [ ] 资源搜索与筛选

#### 4️⃣ 广告激励系统 **[核心变现]**
- [ ] 广告 SDK 对接（穿山甲、优量汇等）
- [ ] 激励视频广告触发机制
- [ ] 广告观看验证
- [ ] 下载权限解锁逻辑

#### 5️⃣ 下载记录系统 **[中优先级]**
- [ ] 下载行为记录
- [ ] 下载次数统计
- [ ] 用户下载历史
- [ ] 热门资源排行

#### 6️⃣ 收益结算系统 **[未来规划]**
- [ ] 广告收益计算
- [ ] 创作者分成规则
- [ ] 提现申请管理
- [ ] 收益报表生成

#### 7️⃣ 数据统计系统 **[中优先级]**
- [ ] 实时访问统计
- [ ] 创作者数据看板
- [ ] 资源下载趋势
- [ ] 用户行为分析

---

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
