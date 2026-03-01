# 数据库迁移实战记录

> 创建时间：2026-03-01  
> 版本：002 - 创作者空间功能  
> 状态：✅ 已完成

---

## 📚 学习要点：GORM AutoMigrate vs 手动迁移

### 本次迁移发生了什么？

#### 预期流程
```
1. 编写迁移脚本（SQL）
2. 手动执行迁移
3. 数据库结构更新
4. 代码可以使用新字段
```

#### 实际发生的
```
1. 修改了 model.go（添加新字段）
2. 启动服务器
3. GORM AutoMigrate 自动检测变化
4. 自动在数据库中添加字段和表  ← 自动完成！
5. 我们执行迁移脚本时发现：已存在
```

---

## 🎯 两种迁移方式对比

### 方式 1：GORM AutoMigrate（开发环境）

```go
// database/database.go
db.AutoMigrate(
    &model.User{},
    &model.Creator{},
    &model.Resource{},
    &model.DownloadRecord{},
    &model.UploadRecord{},
    &model.CodeAccessLog{},  // ← 新增模型自动创建表
)
```

**优点**：
- ✅ 开发时非常方便
- ✅ 修改模型后自动同步
- ✅ 不需要手写 SQL

**缺点**：
- ❌ 无法精确控制 SQL
- ❌ 不生成迁移历史记录
- ❌ 生产环境不推荐使用
- ❌ 团队协作时可能不一致

---

### 方式 2：手动迁移脚本（生产环境）

```sql
-- migrations/002_creator_space_features.sql
ALTER TABLE creators ADD COLUMN code_expire_at DATETIME;
ALTER TABLE creators ADD COLUMN code_max_uses INTEGER DEFAULT 0;
...
```

**优点**：
- ✅ 完全可控的 SQL
- ✅ 版本化管理（Git 追踪）
- ✅ 团队协作一致
- ✅ 可以回滚
- ✅ 生产环境必备

**缺点**：
- ❌ 需要手写 SQL
- ❌ 需要手动执行

---

## 🌟 最佳实践：混合使用

### 推荐方案

```
开发环境（本地）：
├─ 使用 GORM AutoMigrate
├─ 快速迭代，自动同步
└─ 功能稳定后编写迁移脚本

测试环境：
├─ 使用迁移脚本
├─ 验证脚本正确性
└─ 确保可重复执行

生产环境：
├─ 只使用迁移脚本
├─ 关闭 AutoMigrate
└─ 记录每次迁移
```

---

## ✅ 本次迁移验证

### 1. creators 表新增字段

```bash
$ sqlite3 data/valley.db "PRAGMA table_info(creators);"
```

**结果**：✅ 所有字段已存在
```
10|code_expire_at|DATETIME|0|NULL|0
11|code_max_uses|INTEGER|0|0|0
12|code_used_count|INTEGER|0|0|0
13|space_title|VARCHAR(100)|0|''|0
14|space_banner|VARCHAR(500)|0|''|0
15|space_description|TEXT|0|''|0
16|view_count|INTEGER|0|0|0
17|download_count|INTEGER|0|0|0
18|revenue|INTEGER|0|0|0
```

### 2. code_access_logs 表已创建

```bash
$ sqlite3 data/valley.db "SELECT name FROM sqlite_master WHERE type='table' AND name='code_access_logs';"
```

**结果**：✅ 表已存在
```
code_access_logs
```

### 3. code_access_logs 表结构

```bash
$ sqlite3 data/valley.db "PRAGMA table_info(code_access_logs);"
```

**结果**：✅ 所有字段已存在
```
0|id|INTEGER|0||1
1|creator_id|INTEGER|1||0
2|user_id|INTEGER|0|NULL|0
3|code|VARCHAR(20)|1||0
4|ip_address|VARCHAR(50)|1||0
5|user_agent|VARCHAR(500)|0||0
6|accessed_at|DATETIME|1||0
```

---

## 📝 迁移脚本的价值

虽然 GORM 已经自动完成了迁移，但我们编写的迁移脚本仍然很有价值：

### 1. 文档价值
```sql
-- migrations/002_creator_space_features.sql
-- 这个文件记录了：
-- - 什么时候添加的字段
-- - 为什么添加这些字段
-- - 字段的用途说明
```

### 2. 团队协作
```bash
# 团队成员拉取代码后：
git pull
cd server
.\migrate.ps1 -Action up -Version 002  # 执行迁移

# 即使 AutoMigrate 失效，也能通过脚本同步
```

### 3. 生产部署
```bash
# 生产环境不使用 AutoMigrate
# 部署流程：
1. 备份数据库
2. 执行迁移脚本
3. 验证数据库结构
4. 部署新代码
```

### 4. 回滚能力
```bash
# 如果出问题，可以回滚
.\migrate.ps1 -Action down -Version 002
```

---

## 🔧 改进建议：禁用生产环境的 AutoMigrate

### 当前代码（database.go）

```go
// 所有环境都使用 AutoMigrate
db.AutoMigrate(
    &model.User{},
    &model.Creator{},
    // ...
)
```

### 推荐改进

```go
// 只在开发环境使用 AutoMigrate
if gin.Mode() == gin.DebugMode {
    log.Println("🔧 Development mode: Running AutoMigrate...")
    db.AutoMigrate(
        &model.User{},
        &model.Creator{},
        &model.Resource{},
        &model.DownloadRecord{},
        &model.UploadRecord{},
        &model.CodeAccessLog{},
    )
    log.Println("✅ AutoMigrate completed")
} else {
    log.Println("🚀 Production mode: Skipping AutoMigrate (use migration scripts)")
}
```

**好处**：
- 开发环境：保留便利性
- 生产环境：强制使用迁移脚本，更安全

---

## 📊 迁移状态总结

| 项目 | 状态 | 说明 |
|-----|------|------|
| creators 表扩展 | ✅ | 9个新字段已添加 |
| code_access_logs 表 | ✅ | 表已创建，7个字段 |
| 索引 | ✅ | 所有索引已创建 |
| 数据初始化 | ✅ | 默认值已设置 |
| 迁移脚本 | ✅ | 已编写完成（作为文档和备用） |

---

## 🎓 经验教训

1. **GORM AutoMigrate 很强大**
   - 开发时非常方便
   - 但不能完全依赖

2. **迁移脚本不可少**
   - 即使有 AutoMigrate
   - 脚本是文档，是保险

3. **团队协作需要规范**
   - 约定开发流程
   - 统一迁移方式

4. **生产环境要谨慎**
   - 禁用 AutoMigrate
   - 只使用经过测试的迁移脚本

---

## 下一步

数据库迁移已完成，可以开始实现业务逻辑：

1. ✅ 数据库结构已就绪
2. 🔜 实现口令生成工具（`utils/code.go`）
3. 🔜 实现创作者注册 API
4. 🔜 实现口令验证 API

参考文档：
- `docs/guides/2026-03-01_quickstart_what-to-build-first.md`
- `docs/guides/2026-03-01_roadmap_backend-development-plan.md`

