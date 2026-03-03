# 🚀 快速启动指南

> 创作者空间系统 v2.0.0 - 一键启动

## 📋 前置要求

- ✅ Go 1.23+
- ✅ Node.js 18+
- ✅ pnpm 8+

## 🎯 快速开始（3 分钟）

### 1. 初始化数据库

```bash
# 方式1：强制重新初始化（推荐，清空旧数据）
curl -X POST http://localhost:3000/api/v1/init/force-init

# 方式2：删除数据库文件
cd server/data
rm valley.db
# GORM 会在启动时自动创建新表
```

### 2. 启动后端

```bash
cd server
go run main.go

# 或使用 Air 热重载
air
```

### 3. 启动前端

```bash
cd apps/admin
pnpm dev
```

### 4. 访问管理后台

```
URL: http://localhost:5173
账号: admin@example.com
密码: admin123
```

## 🧪 功能验证

### 测试创作者管理

1. 登录管理后台
2. 进入"创作者管理"
3. 点击"添加创作者"
4. 选择用户，填写信息，提交
5. ✅ 列表应显示新创作者，**空间数为 0**

### 测试空间管理

1. 在创作者列表，点击某个创作者的"空间"按钮
2. 进入空间管理页面
3. 点击"创建空间"
4. 填写空间名称（口令留空自动生成），提交
5. ✅ 列表应显示新空间，包含 4 位口令

### 测试口令访问

1. 复制空间的 4 位口令（如：`abc1`）
2. 在浏览器访问：
   ```
   http://localhost:3000/api/v1/public/space/abc1
   ```
3. ✅ 应返回空间信息和资源列表

## 📦 API 快速测试

### 获取创作者列表

```bash
curl http://localhost:3000/api/v1/admin/creators \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 创建空间

```bash
curl -X POST http://localhost:3000/api/v1/admin/creators/CREATOR_ID/spaces \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "精选合集",
    "description": "我的第一个空间"
  }'
```

### 获取空间列表

```bash
curl http://localhost:3000/api/v1/admin/creators/CREATOR_ID/spaces \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 公开访问空间

```bash
curl http://localhost:3000/api/v1/public/space/CODE
```

## 🎨 前端页面路由

| 页面 | 路径 |
|------|------|
| 登录 | `/login` |
| 仪表板 | `/dashboard` |
| 用户管理 | `/users` |
| **创作者管理** | `/creators` ✨ |
| **空间管理** | `/creators/:id/spaces` ✨ NEW |
| 资源管理 | `/resources` |
| 记录查看 | `/records` |

## 🔍 常见问题

### Q: 创作者列表中没有"口令"列了？

A: ✅ **这是预期行为**。口令现在在空间层级，点击"空间"按钮进入空间管理查看。

### Q: 如何为创作者生成口令？

A: 创建空间时，口令会自动生成。每个创作者可以有多个空间，每个空间有独立口令。

### Q: 旧的口令还能用吗？

A: ❌ 旧的创作者口令已废弃。需要为创作者创建空间，使用空间口令访问。

### Q: 如何迁移旧数据？

A: 参考 [数据迁移指南](./guides/2026-03-03_migration-creator-to-space.md)

### Q: 编译报错怎么办？

A: 
```bash
# 后端
cd server
go mod tidy
go build

# 前端
cd apps/admin
pnpm install
pnpm build
```

## 📊 健康检查

### 后端健康检查

```bash
# 1. 检查服务是否启动
curl http://localhost:3000/api/v1/ping

# 2. 检查数据库表
sqlite3 server/data/valley.db ".tables"
# 应该看到: creator_spaces, creators, users, resources, etc.

# 3. 查看空间数量
sqlite3 server/data/valley.db "SELECT COUNT(*) FROM creator_spaces"
```

### 前端健康检查

```bash
# 1. 检查编译错误
cd apps/admin
pnpm build
# 应该 0 错误

# 2. 检查 TypeScript
pnpm tsc --noEmit
# 应该 0 错误
```

## 🎯 核心功能清单

### 创作者管理 ✅

- [x] 创建创作者（无口令）
- [x] 编辑创作者信息
- [x] 删除创作者
- [x] 切换创作者状态
- [x] 查看创作者详情
- [x] 显示空间数量统计

### 空间管理 ✅

- [x] 创建空间（自动生成4位口令）
- [x] 编辑空间信息
- [x] 删除空间
- [x] 搜索空间
- [x] 状态筛选
- [x] 复制空间口令
- [x] 显示资源统计

### API 功能 ✅

- [x] 创作者 CRUD
- [x] 空间 CRUD
- [x] 资源关联到空间
- [x] 公开口令访问
- [x] 访问日志记录

## 🎓 使用示例

### 场景：摄影师创建多个作品集

```bash
# 1. 创建创作者
POST /admin/creators
{
  "userId": "photographer123",
  "name": "摄影师小王"
}

# 2. 创建风景摄影空间
POST /admin/creators/xxx/spaces
{
  "title": "风景摄影集",
  "description": "我的风景作品"
}
# 返回: { code: "land" }

# 3. 创建人像摄影空间
POST /admin/creators/xxx/spaces
{
  "title": "人像写真集",
  "description": "人像作品展示"
}
# 返回: { code: "port" }

# 4. 用户通过不同口令访问不同作品集
GET /public/space/land  # 看到风景照
GET /public/space/port  # 看到人像照
```

## 📚 完整文档

- [完整重构总结](./COMPLETE_REFACTORING_SUMMARY.md) - 全面的变更说明
- [系统设计文档](./guides/2026-03-03_design_creator-space-system.md) - 架构设计
- [数据迁移指南](./guides/2026-03-03_migration-creator-to-space.md) - 迁移 SQL
- [前端适配文档](./ADMIN_FRONTEND_ADAPTATION.md) - 前端更新

## 🆘 获取帮助

遇到问题？

1. 查看 [常见问题](#常见问题)
2. 阅读 [完整文档](#完整文档)
3. 检查 [控制台日志](#健康检查)

---

**版本**: v2.0.0  
**最后更新**: 2026-03-03  
**状态**: ✅ 生产就绪
