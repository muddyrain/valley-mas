# 创作者空间系统数据迁移指南

## 📋 背景

从单一创作者口令（1:1）迁移到创作者多空间系统（1:N），每个创作者可以创建多个空间，每个空间有独立的口令和资源关联。

## 🔄 数据模型变更

### 旧模型
```
Creator {
  Code string        // 直接在创作者上
  Resources []Resource
}
```

### 新模型
```
Creator {
  Spaces []CreatorSpace
  Resources []Resource
}

CreatorSpace {
  Code string        // 口令移到空间上
  Resources []Resource (many2many)
}
```

## 📊 迁移步骤

### 1. 自动数据库迁移（已完成）

GORM 的 AutoMigrate 会自动：
- 创建 `creator_spaces` 表
- 添加 `code_access_logs.space_id` 字段
- 从 `creators` 表移除 `code` 字段（注意：这会导致数据丢失）

### 2. 手动数据迁移（如果有生产数据）

⚠️ **重要：如果你有生产数据中的 Creator.Code，请在运行新代码前执行以下迁移脚本**

```sql
-- Step 1: 为每个现有创作者创建默认空间
INSERT INTO creator_spaces (id, creator_id, title, code, description, is_active, created_at, updated_at)
SELECT 
  -- 生成新的 Snowflake ID（需要通过应用层生成，这里用简化示例）
  CAST(RANDOM() * 9000000000000000 + 1000000000000000 AS TEXT) as id,
  id as creator_id,
  name || '的默认空间' as title,
  code as code,  -- 复制旧的口令到空间
  description as description,
  is_active as is_active,
  created_at,
  updated_at
FROM creators
WHERE code IS NOT NULL AND code != '';

-- Step 2: 将访问日志关联到新空间
-- 注意：code_access_logs.creator_id 已改为 space_id
UPDATE code_access_logs
SET space_id = (
  SELECT cs.id 
  FROM creator_spaces cs 
  WHERE cs.code = code_access_logs.code 
  LIMIT 1
)
WHERE space_id IS NULL;

-- Step 3: （可选）将现有资源关联到默认空间
-- 通过 space_resources 多对多关联表
INSERT INTO space_resources (creator_space_id, resource_id)
SELECT 
  cs.id as creator_space_id,
  r.id as resource_id
FROM resources r
INNER JOIN creator_spaces cs ON cs.creator_id = r.creator_id
WHERE cs.title LIKE '%的默认空间';
```

### 3. 使用初始化接口（开发环境推荐）

如果是开发环境，最简单的方式：

```bash
# 调用强制初始化接口（会清空数据并重建）
curl -X POST http://localhost:3000/api/v1/init/force-init \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

这会：
- 删除所有旧数据
- 创建示例用户、创作者、空间和资源
- 使用新的数据结构

## ✅ 验证迁移

### 检查数据完整性

```sql
-- 1. 确认所有创作者都有至少一个空间
SELECT c.id, c.name, COUNT(cs.id) as space_count
FROM creators c
LEFT JOIN creator_spaces cs ON cs.creator_id = c.id
GROUP BY c.id, c.name
HAVING COUNT(cs.id) = 0;  -- 应该返回0行

-- 2. 确认所有访问日志都有关联的空间
SELECT COUNT(*) 
FROM code_access_logs 
WHERE space_id IS NULL;  -- 应该返回0

-- 3. 确认口令唯一性
SELECT code, COUNT(*) 
FROM creator_spaces 
GROUP BY code 
HAVING COUNT(*) > 1;  -- 应该返回0行
```

### 测试 API

```bash
# 1. 测试创作者注册（应创建默认空间）
curl -X POST http://localhost:3000/api/v1/creator/register \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试创作者",
    "spaceTitle": "我的第一个空间"
  }'

# 响应应包含 space.code

# 2. 测试空间管理
curl http://localhost:3000/api/v1/admin/creators/CREATOR_ID/spaces \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 3. 测试口令访问（公开接口）
curl http://localhost:3000/api/v1/public/space/SPACE_CODE
```

## 🐛 常见问题

### Q: 迁移后旧的 Creator.Code 去哪了？
A: 如果执行了迁移 SQL，Code 被复制到了 CreatorSpace.Code。原 Creator 表中的 code 字段会在下次 AutoMigrate 时被删除。

### Q: 访问日志 (CodeAccessLog) 如何迁移？
A: `creator_id` 字段已改为 `space_id`。需要通过 Code 字段匹配对应的 CreatorSpace.ID。

### Q: 资源 (Resource) 的关联关系？
A: Resources 保留了 `creator_id`（归属），同时通过 `space_resources` 多对多表关联到空间（展示）。

### Q: 旧的用户端接口会破坏吗？
A: 是的。`/api/v1/creator/code/toggle` 和 `/api/v1/creator/code/regenerate` 已废弃，返回错误提示。

## 📝 API 变更清单

### 已废弃的接口
- `PUT /api/v1/creator/code/toggle` → 改用空间级别控制
- `POST /api/v1/creator/code/regenerate` → 改用空间管理接口

### 新增接口
- `GET /api/v1/admin/creators/:creatorId/spaces` - 获取空间列表
- `POST /api/v1/admin/creators/:creatorId/spaces` - 创建空间
- `GET /api/v1/admin/creators/:creatorId/spaces/:spaceId` - 获取空间详情
- `PUT /api/v1/admin/creators/:creatorId/spaces/:spaceId` - 更新空间
- `DELETE /api/v1/admin/creators/:creatorId/spaces/:spaceId` - 删除空间
- `POST /api/v1/admin/creators/:creatorId/spaces/:spaceId/resources` - 关联资源
- `DELETE /api/v1/admin/creators/:creatorId/spaces/:spaceId/resources` - 移除资源

### 修改的接口
- `POST /api/v1/creator/register` - 现在会创建默认空间
- `GET /api/v1/creator/my-space` - 返回值包含 `spaces` 数组
- `GET /api/v1/public/space/:code` - 从查询创作者改为查询空间

## 🎯 下一步

1. ✅ 后端数据模型已更新
2. ✅ 后端 API 已实现
3. ⏳ 前端需要适配新的空间管理界面
4. ⏳ 用户端小程序需要适配新的空间访问逻辑

## 📚 相关文档

- [创作者空间系统设计](./2026-03-03_design_creator-space-system.md)
- [API 参考](../API_REFERENCE.md)
- [数据模型](../../server/internal/model/model.go)
