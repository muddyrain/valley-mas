# 数据库迁移指南

> 创建时间：2026-03-01  
> 版本：002 - 创作者空间功能

---

## 📚 什么是数据库迁移？

### 简单类比

```
代码更新：    Git commit → Git push → 团队成员 Git pull
数据库更新：  编写迁移脚本 → 执行迁移 → 团队成员执行迁移
```

### 核心价值

1. **版本控制** - 数据库结构的变化有迹可循
2. **团队协作** - 所有人的数据库结构保持一致
3. **安全回滚** - 出问题可以快速恢复
4. **自动化部署** - 生产环境部署更安全

---

## 🎯 本次迁移内容（002）

### 新增功能

- ✅ 创作者口令系统（过期时间、使用次数限制）
- ✅ 创作者空间自定义（标题、横幅、描述）
- ✅ 访问统计（浏览量、下载量、收益）
- ✅ 口令访问日志表（记录每次访问）

### 数据库变化

#### 扩展 `creators` 表
```sql
+ code_expire_at       口令过期时间
+ code_max_uses        最大使用次数
+ code_used_count      已使用次数
+ space_title          空间标题
+ space_banner         空间横幅
+ space_description    空间描述
+ view_count           浏览次数
+ download_count       下载次数
+ revenue              累计收益
```

#### 新增 `code_access_logs` 表
```sql
+ id                   主键
+ creator_id           创作者ID
+ user_id              用户ID（可选）
+ code                 口令
+ ip_address           IP地址
+ user_agent           User-Agent
+ accessed_at          访问时间
```

---

## 🚀 执行迁移（3种方式）

### 方式 1：使用 PowerShell 脚本（推荐）

```powershell
# 1. 进入 server 目录
cd server

# 2. 查看当前数据库状态
.\migrate.ps1 -Action status

# 3. 执行迁移（会自动备份）
.\migrate.ps1 -Action up -Version 002

# 4. 验证迁移结果
.\migrate.ps1 -Action status
```

### 方式 2：手动执行 SQL

```powershell
# 1. 进入 server 目录
cd server

# 2. 备份数据库（重要！）
cp data/valley.db data/valley.db.backup

# 3. 执行迁移
Get-Content migrations/002_creator_space_features.sql | sqlite3 data/valley.db

# 4. 验证结果
sqlite3 data/valley.db "PRAGMA table_info(creators);"
```

### 方式 3：使用 SQLite GUI 工具

1. 下载 [DB Browser for SQLite](https://sqlitebrowser.org/)
2. 打开 `server/data/valley.db`
3. 点击 `Execute SQL` 标签
4. 复制 `002_creator_space_features.sql` 内容
5. 点击执行

---

## 🔄 回滚迁移

### 什么时候需要回滚？

- ❌ 迁移执行出错
- ❌ 发现新字段有问题
- ❌ 需要修改迁移脚本

### 如何回滚？

```powershell
# 使用 PowerShell 脚本
cd server
.\migrate.ps1 -Action down -Version 002
```

⚠️ **警告**：回滚会删除数据！

---

## ✅ 验证迁移成功

### 1. 检查表结构

```powershell
cd server
sqlite3 data/valley.db "PRAGMA table_info(creators);"
```

**预期输出**：应该看到新增的字段（code_expire_at, space_title 等）

### 2. 检查新表

```powershell
sqlite3 data/valley.db "SELECT name FROM sqlite_master WHERE type='table' AND name='code_access_logs';"
```

**预期输出**：`code_access_logs`

### 3. 运行代码测试

```powershell
# 启动服务器
cd server
air

# 访问初始化接口
curl http://localhost:8080/init-data
```

**预期结果**：服务器正常启动，没有数据库错误

---

## 📋 迁移检查清单

执行迁移前：
- [ ] 已备份数据库
- [ ] 已阅读迁移脚本内容
- [ ] 确认在正确的环境（开发/测试）
- [ ] 已关闭正在运行的服务器

执行迁移后：
- [ ] 验证表结构正确
- [ ] 验证新表创建成功
- [ ] 验证索引创建成功
- [ ] 启动服务器测试
- [ ] 提交代码（包含迁移脚本）

---

## 🐛 常见问题

### Q1: 提示 "sqlite3: command not found"

**解决方案**：
```powershell
# Windows (使用 Chocolatey)
choco install sqlite

# 或者手动下载
# https://www.sqlite.org/download.html
```

### Q2: 迁移执行失败

**解决方案**：
```powershell
# 1. 恢复备份
cp data/valley.db.backup data/valley.db

# 2. 检查错误信息
# 3. 修改迁移脚本
# 4. 重新执行
```

### Q3: 字段已存在错误

**说明**：可能已经执行过迁移

**解决方案**：
```powershell
# 查看当前状态
.\migrate.ps1 -Action status

# 如果字段已存在，可以跳过此迁移
```

### Q4: GORM 自动迁移 vs 手动迁移脚本

**GORM 自动迁移**：
```go
db.AutoMigrate(&model.Creator{})  // 开发时方便
```
- ✅ 优点：自动同步模型变化
- ❌ 缺点：不可控、难以回滚、无版本管理

**手动迁移脚本**：
```sql
ALTER TABLE creators ADD COLUMN ...  // 生产环境必须
```
- ✅ 优点：可控、可回滚、有版本管理
- ❌ 缺点：需要手动编写

**最佳实践**：
- 开发环境：使用 GORM AutoMigrate 快速迭代
- 生产环境：使用手动迁移脚本，确保安全

---

## 📝 团队协作流程

### 开发者 A（创建迁移）

```bash
1. 修改数据模型（Go struct）
2. 创建迁移脚本（SQL）
3. 执行迁移（本地测试）
4. 提交代码（包含迁移脚本）
```

### 开发者 B（拉取代码）

```bash
1. git pull
2. cd server
3. .\migrate.ps1 -Action up -Version 002
4. 启动服务器测试
```

### 部署到生产环境

```bash
1. 备份生产数据库
2. 在测试环境验证迁移
3. 停止生产服务器
4. 执行迁移脚本
5. 启动服务器
6. 验证功能正常
```

---

## 🎓 延伸阅读

- [SQLite ALTER TABLE 文档](https://www.sqlite.org/lang_altertable.html)
- [数据库迁移最佳实践](https://www.prisma.io/dataguide/types/relational/migration-strategies)
- [GORM 迁移指南](https://gorm.io/docs/migration.html)

---

## 下一步

迁移完成后，开始实现 API 接口：

1. ✅ 数据库结构已更新
2. 🔜 实现口令生成工具（`utils/code.go`）
3. 🔜 实现创作者注册 API
4. 🔜 实现口令验证 API

参考文档：`docs/guides/2026-03-01_quickstart_what-to-build-first.md`

