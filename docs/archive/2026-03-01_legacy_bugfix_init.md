# 🐛 Bug 修复：强制初始化唯一约束冲突

## 问题描述

执行 `/init-data?force=true` 多次时出现错误：

```json
{
  "code": 500,
  "message": "初始化数据失败：constraint failed: UNIQUE constraint failed: users.username (2067)"
}
```

## 根本原因

SQLite 的 `DELETE FROM` 命令不会重置自增序列：

```sql
DELETE FROM users;  -- ❌ 删除数据，但自增 ID 继续增长
```

下次插入时，ID 从上次的值继续递增，可能导致：
- ID 冲突
- 唯一约束冲突
- 数据不一致

## 修复方案

### 1. 使用事务保证原子性

```go
tx := database.DB.Begin()
// ... 操作
tx.Commit()
```

### 2. 按正确顺序删除（避免外键约束）

```go
tx.Exec("DELETE FROM upload_records")    // 先删除子表
tx.Exec("DELETE FROM download_records")
tx.Exec("DELETE FROM resources")
tx.Exec("DELETE FROM creators")
tx.Exec("DELETE FROM users")             // 最后删除主表
```

### 3. 重置自增序列（关键！）

```go
// SQLite 的自增序列存储在 sqlite_sequence 表中
tx.Exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'creators', 'resources', 'download_records', 'upload_records')")
```

### 4. 添加错误处理

```go
if err := tx.Exec("DELETE FROM users").Error; err != nil {
    tx.Rollback()  // 出错时回滚
    Error(c, 500, "清空用户失败："+err.Error())
    return
}
```

## 修复后的完整流程

```
┌─────────────────────────────────┐
│  接收 force=true 参数           │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  开始事务                       │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  按顺序删除数据                 │
│  1. upload_records              │
│  2. download_records            │
│  3. resources                   │
│  4. creators                    │
│  5. users                       │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  重置自增序列                   │
│  DELETE FROM sqlite_sequence    │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  提交事务                       │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  创建新数据                     │
└─────────────────────────────────┘
```

## 测试验证

运行测试脚本：

```powershell
.\test-force-init.ps1
```

测试内容：
1. ✅ 第一次初始化
2. ✅ 普通初始化（数据已存在）
3. ✅ 强制初始化
4. ✅ 再次强制初始化（验证可重复）
5. ✅ 登录验证

## 影响范围

| 项目 | 说明 |
|------|------|
| **影响文件** | `server/internal/handler/init.go` |
| **影响功能** | 数据初始化接口 |
| **向后兼容** | ✅ 完全兼容 |
| **数据库** | SQLite |
| **版本** | v1.1.1 |

## 使用方式

### 正常初始化

```bash
curl http://localhost:8080/init-data
```

**响应（数据已存在）：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "message": "数据已存在，无需初始化。如需强制重新初始化，请使用: /init-data?force=true",
    "userCount": 5
  }
}
```

### 强制重新初始化

```bash
curl http://localhost:8080/init-data?force=true
```

**响应（成功）：**
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

## 知识点

### SQLite 自增序列

SQLite 使用 `sqlite_sequence` 表来跟踪自增字段的当前值：

```sql
-- 查看自增序列
SELECT * FROM sqlite_sequence;

-- 输出示例
name              | seq
------------------+-----
users             | 10
creators          | 5
resources         | 20
```

### 重置方法对比

| 方法 | 重置序列 | 保留表结构 | 推荐 |
|------|---------|-----------|------|
| `DELETE FROM table` | ❌ | ✅ | ❌ |
| `DELETE FROM table` + `DELETE FROM sqlite_sequence` | ✅ | ✅ | ✅ |
| `DROP TABLE` + `CREATE TABLE` | ✅ | ❌ | ❌ |
| `TRUNCATE` (不支持) | - | - | ❌ |

### 注意事项

⚠️ **生产环境警告**

```
❌ 切勿在生产环境使用 force=true
✅ 仅用于开发和测试环境
✅ 使用前务必备份数据
```

## 参考资料

- [SQLite Autoincrement](https://www.sqlite.org/autoinc.html)
- [GORM Transactions](https://gorm.io/docs/transactions.html)
- [Go Error Handling](https://go.dev/blog/error-handling-and-go)

## 版本历史

- **v1.1.1** (2026-03-01) - 🐛 修复唯一约束冲突
- **v1.1.0** (2026-03-01) - ✨ 新增 force 参数支持

---

**修复完成！✅ 现在可以安全地多次执行强制初始化了！**
