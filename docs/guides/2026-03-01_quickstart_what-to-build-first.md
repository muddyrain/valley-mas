# 快速决策：应该先做什么？

> 创建时间：2026-03-01  
> 目标：快速确定后端开发优先级

---

## 🎯 当前状态

### ✅ 已完成
- 用户管理系统（CRUD）
- 登录认证系统（JWT + Cookie）
- 权限控制（admin / creator / user）
- 数据初始化
- Snowflake ID 系统

### ❌ 缺失核心功能
- **创作者注册与口令生成** ← 最关键
- **资源上传与管理** ← 最关键
- **广告激励下载** ← 变现核心
- 数据统计看板

---

## 📊 功能依赖关系图

```
        创作者注册 (Phase 1)
              ↓
        生成口令 (Phase 1)
              ↓
      ┌───────┴───────┐
      ↓               ↓
  口令验证         创作者空间
 (Phase 1)        (Phase 1)
      ↓               ↓
      └───────┬───────┘
              ↓
        资源上传 (Phase 2)
              ↓
        资源列表 (Phase 2)
              ↓
      ┌───────┴───────┐
      ↓               ↓
  资源详情         资源审核
 (Phase 2)       (Phase 2)
      ↓
  广告激励 (Phase 3)
      ↓
  下载资源 (Phase 3)
      ↓
  数据统计 (Phase 4)
```

**结论：必须按顺序开发，没有捷径！**

---

## 🚀 第一优先级：Phase 1 创作者与口令系统

### 为什么先做这个？

1. **最小可用产品（MVP）的基础**
   - 用户能输入口令 → 进入创作者空间 → 查看资源
   - 这是整个系统的核心流程起点

2. **后续功能的前置依赖**
   - 没有创作者，就没有资源上传者
   - 没有口令，用户无法访问空间
   - 所有功能都依赖这个基础

3. **开发量适中**
   - 预计 2-3 天完成
   - 不依赖外部服务（TOS、广告平台）
   - 可以独立测试验证

---

## 📝 Phase 1 详细任务分解

### Step 1: 数据模型扩展（1小时）

```go
// 1. 扩展 Creator 模型
ALTER TABLE creators ADD COLUMN code_expire_at DATETIME;
ALTER TABLE creators ADD COLUMN code_max_uses INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN code_used_count INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN space_title VARCHAR(100);
ALTER TABLE creators ADD COLUMN space_banner VARCHAR(500);
ALTER TABLE creators ADD COLUMN space_description TEXT;
ALTER TABLE creators ADD COLUMN view_count INTEGER DEFAULT 0;

// 2. 创建 CodeAccessLog 表
CREATE TABLE code_access_logs (...)
```

**验证标准**：
- ✅ 数据库迁移成功
- ✅ 模型定义正确
- ✅ GORM 自动迁移通过

---

### Step 2: 口令生成工具（30分钟）

```go
// utils/code.go

// GenerateCode 生成 6 位口令（去除易混淆字符）
func GenerateCode() string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    // ... 实现
}
```

**验证标准**：
- ✅ 生成的口令长度为 6
- ✅ 只包含允许的字符
- ✅ 口令唯一性检查通过
- ✅ 单元测试通过

---

### Step 3: 创作者注册 API（2小时）

```http
POST /api/v1/creator/register
Authorization: Bearer <token>

Request:
{
  "name": "我的创作空间",
  "description": "分享精美壁纸",
  "spaceTitle": "精美壁纸合集"
}

Response:
{
  "code": 0,
  "data": {
    "id": "xxx",
    "code": "ABC123",  // 自动生成
    "createdAt": "..."
  }
}
```

**实现要点**：
1. 检查用户是否已是创作者
2. 生成唯一口令（循环检查直到唯一）
3. 创建 Creator 记录
4. 更新 User 表的 role 为 "creator"

**验证标准**：
- ✅ 普通用户可以注册成为创作者
- ✅ 已注册创作者不能重复注册
- ✅ 口令自动生成且唯一
- ✅ 用户角色更新为 creator

---

### Step 4: 口令验证 API（1.5小时）

```http
POST /api/v1/public/code/verify

Request:
{
  "code": "ABC123"
}

Response:
{
  "code": 0,
  "data": {
    "creatorId": "xxx",
    "creatorName": "我的创作空间",
    "spaceTitle": "精美壁纸合集",
    "isValid": true
  }
}
```

**实现要点**：
1. 查询 Creator 表（code + is_active）
2. 检查口令是否过期（code_expire_at）
3. 检查使用次数限制（code_max_uses）
4. 记录访问日志（CodeAccessLog）
5. 更新统计（code_used_count, view_count）

**验证标准**：
- ✅ 有效口令返回创作者信息
- ✅ 无效口令返回 40001 错误
- ✅ 过期口令返回 40002 错误
- ✅ 超限口令返回 40003 错误
- ✅ 访问日志正确记录

---

### Step 5: 我的空间信息 API（1小时）

```http
GET /api/v1/creator/my-space
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "id": "xxx",
    "name": "我的创作空间",
    "code": "ABC123",
    "codeUsedCount": 234,
    "viewCount": 5678,
    "resourceCount": 0  // Phase 2 实现
  }
}
```

**验证标准**：
- ✅ 创作者可以查看自己的空间信息
- ✅ 普通用户返回 404
- ✅ 统计数据正确

---

### Step 6: 口令设置 API（1小时）

```http
PUT /api/v1/creator/code-settings
Authorization: Bearer <token>

Request:
{
  "expireAt": "2026-04-01T00:00:00Z",
  "maxUses": 1000
}
```

**验证标准**：
- ✅ 创作者可以设置口令过期时间
- ✅ 创作者可以设置使用次数限制
- ✅ 设置后立即生效

---

### Step 7: 重新生成口令 API（30分钟）

```http
POST /api/v1/creator/regenerate-code
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "code": "XYZ789",
    "generatedAt": "..."
  }
}
```

**验证标准**：
- ✅ 创作者可以重新生成口令
- ✅ 旧口令立即失效
- ✅ 新口令唯一

---

### Step 8: 管理后台功能（1小时）

```http
# 创作者列表（完善已有接口）
GET /api/v1/admin/creators

# 禁用/启用创作者
PUT /api/v1/admin/creators/:id/status

# 访问日志
GET /api/v1/admin/creators/:id/access-logs
```

**验证标准**：
- ✅ 管理员可以查看所有创作者
- ✅ 管理员可以禁用违规创作者
- ✅ 管理员可以查看访问记录

---

## ⏱️ Phase 1 时间估算

| 任务 | 预计时间 | 累计时间 |
|-----|---------|---------|
| 数据模型扩展 | 1h | 1h |
| 口令生成工具 | 0.5h | 1.5h |
| 创作者注册 API | 2h | 3.5h |
| 口令验证 API | 1.5h | 5h |
| 我的空间信息 API | 1h | 6h |
| 口令设置 API | 1h | 7h |
| 重新生成口令 API | 0.5h | 7.5h |
| 管理后台功能 | 1h | 8.5h |
| 测试与调试 | 2h | **10.5h** |
| 文档编写 | 1h | **11.5h** |

**总计：约 1.5 个工作日（按每天 8 小时计算）**

---

## 🧪 Phase 1 完成标准

### 功能完整性
- [ ] 用户可以注册成为创作者
- [ ] 创作者自动获得唯一口令
- [ ] 用户可以输入口令验证有效性
- [ ] 创作者可以查看空间统计
- [ ] 创作者可以设置口令规则
- [ ] 创作者可以重新生成口令
- [ ] 管理员可以管理创作者

### 数据正确性
- [ ] 口令唯一性保证
- [ ] 访问日志准确记录
- [ ] 统计数据实时更新
- [ ] 角色权限控制正确

### 性能要求
- [ ] 口令验证响应 < 100ms
- [ ] 并发验证无冲突
- [ ] 数据库索引优化

---

## 📋 开发检查清单

### 开始前
- [ ] 拉取最新代码
- [ ] 启动开发环境（`cd server && air`）
- [ ] 确认数据库连接正常
- [ ] 阅读完整开发文档

### 开发中
- [ ] 每完成一个 API 立即测试
- [ ] 使用 Postman/curl 验证接口
- [ ] 记录遇到的问题
- [ ] 提交有意义的 Git commit

### 完成后
- [ ] 运行所有测试用例
- [ ] 更新 API 文档
- [ ] 清理调试代码
- [ ] 提交最终版本

---

## 🎯 完成 Phase 1 后的状态

```
✅ 用户可以注册成为创作者
✅ 创作者拥有专属口令
✅ 用户可以通过口令进入空间
✅ 创作者可以管理口令设置
✅ 管理员可以审核创作者

❌ 创作者还不能上传资源 → Phase 2
❌ 用户还不能下载资源 → Phase 3
❌ 没有收益统计 → Phase 4
```

---

## 下一步：立即开始！

### 推荐开发顺序

```bash
# 1. 创建数据库迁移脚本
cd server/migrations
# 创建 002_creator_space_features.sql

# 2. 扩展数据模型
cd server/internal/model
# 修改 model.go，添加新字段

# 3. 创建口令工具
cd server/internal/utils
# 创建 code.go

# 4. 实现 API 接口
cd server/internal/handler
# 修改 public.go, auth.go, admin_creator.go

# 5. 更新路由
cd server/internal/router
# 修改 router.go

# 6. 测试
# 使用 Postman 或 curl 测试所有接口

# 7. 提交代码
git add .
git commit -m "feat(creator): implement creator registration and code system"
```

---

## 💡 开发建议

1. **边开发边测试**
   - 不要等所有代码写完再测试
   - 每完成一个 API 立即验证

2. **使用 Postman**
   - 创建 Valley MAS 集合
   - 保存所有测试用例
   - 使用环境变量管理 token

3. **关注错误处理**
   - 所有错误都要有清晰的错误码
   - 错误信息要对用户友好
   - 记录关键操作日志

4. **性能优化**
   - 为高频查询字段添加索引
   - 避免 N+1 查询
   - 使用事务保证数据一致性

5. **代码规范**
   - 遵循 Go 命名约定
   - 添加必要的注释
   - 使用 Biome 格式化代码

---

**开始吧！Phase 1 是整个系统的基石！** 🚀
