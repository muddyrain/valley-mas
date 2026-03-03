# 创作者空间系统设计文档

> **日期**: 2026-03-03  
> **设计**: 创作者 1:N 空间，空间 N:N 资源

---

## 🎯 新的业务模型

### 旧模型（1:1）
```
Creator (创作者)
  ├── code (口令) - 1个
  └── Resources (资源) - N个
```

**问题**：
- 一个创作者只能有一个口令
- 所有资源共享同一个口令
- 无法针对不同资源集合创建不同的分享链接

---

### 新模型（1:N:N）
```
Creator (创作者)
  ├── Spaces (空间) - N个
  │   ├── Space 1 (口令: ABC1)
  │   │   └── Resources [R1, R2, R3]
  │   ├── Space 2 (口令: XYZ9)
  │   │   └── Resources [R2, R4, R5]
  │   └── Space 3 (口令: DEF6)
  │       └── Resources [R1, R5, R6]
  └── Resources (所有资源) - N个
```

**优势**：
- ✅ 一个创作者可以创建多个空间
- ✅ 每个空间有独立的口令
- ✅ 创作者可以自由选择哪些资源放到哪个空间
- ✅ 同一个资源可以出现在多个空间
- ✅ 灵活的内容分发策略

---

## 📊 数据模型

### Creator (创作者表)
```go
type Creator struct {
    ID          Int64String    // Snowflake ID
    UserID      Int64String    // 关联用户
    Name        string         // 创作者名称
    Description string         // 描述
    Avatar      string         // 头像
    IsActive    bool           // 是否启用
    CreatedAt   time.Time
    UpdatedAt   time.Time
    DeletedAt   gorm.DeletedAt
    
    // 关联
    Spaces    []CreatorSpace  // 空间列表（1:N）
    Resources []Resource      // 所有资源（1:N）
}
```

**移除字段**：
- ❌ `Code` - 口令移到 CreatorSpace

**统计字段**（动态计算）：
- `SpaceCount` - 空间数量
- `ResourceCount` - 资源数量
- `DownloadCount` - 总下载量

---

### CreatorSpace (创作者空间表) 🆕
```go
type CreatorSpace struct {
    ID          Int64String    // Snowflake ID
    CreatorID   Int64String    // 关联创作者
    Title       string         // 空间标题
    Description string         // 空间描述
    Banner      string         // 空间横幅
    Code        string         // 口令（唯一索引）
    IsActive    bool           // 是否启用
    ViewCount   int            // 浏览次数
    CreatedAt   time.Time
    UpdatedAt   time.Time
    DeletedAt   gorm.DeletedAt
    
    // 关联
    Creator   *Creator        // 所属创作者
    Resources []Resource      // 关联的资源（N:N）
    Logs      []CodeAccessLog // 访问日志
}
```

**关联表**：`space_resources` (GORM 自动创建)
```sql
CREATE TABLE space_resources (
    creator_space_id BIGINT,
    resource_id BIGINT,
    PRIMARY KEY (creator_space_id, resource_id)
);
```

---

### Resource (资源表)
```go
type Resource struct {
    ID            Int64String
    CreatorID     Int64String    // 上传者（创作者或管理员）
    Type          string         // avatar, wallpaper
    Title         string
    Description   string
    URL           string
    ThumbnailURL  string
    Width         int
    Height        int
    Size          int64
    DownloadCount int
    CreatedAt     time.Time
    UpdatedAt     time.Time
    DeletedAt     gorm.DeletedAt
    
    // 关联
    Creator *Creator         // 上传者
    Spaces  []CreatorSpace   // 所属空间（N:N）
}
```

**变更**：
- 一个资源可以属于多个空间（many2many）

---

### CodeAccessLog (口令访问日志)
```go
type CodeAccessLog struct {
    ID        Int64String
    SpaceID   Int64String    // 关联空间（改为 SpaceID）
    Code      string
    IP        string
    UserAgent string
    CreatedAt time.Time
    DeletedAt gorm.DeletedAt
    
    // 关联
    Space *CreatorSpace      // 所属空间
}
```

**变更**：
- `CreatorID` → `SpaceID`
- 关联从 Creator 改为 CreatorSpace

---

## 🔧 API 设计

### 创作者管理 API

#### 1. 创建创作者
```http
POST /admin/creators
{
  "userId": "2028025683447386288",
  "name": "设计师小王",
  "description": "专注UI设计",
  "avatar": "https://...",
  "isActive": true
}
```
**变更**：移除 `code` 字段

#### 2. 获取创作者列表
```http
GET /admin/creators?page=1&pageSize=20&keyword=小王
```
**返回**：
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "xxx",
        "name": "设计师小王",
        "spaceCount": 3,        // 空间数量
        "resourceCount": 25,    // 资源数量
        "downloadCount": 580    // 总下载量
      }
    ],
    "total": 10
  }
}
```

---

### 创作者空间管理 API 🆕

#### 1. 获取创作者的空间列表
```http
GET /admin/creators/{creatorId}/spaces?page=1&pageSize=20
```

#### 2. 创建空间
```http
POST /admin/creators/{creatorId}/spaces
{
  "title": "头像专区",
  "description": "精选头像资源",
  "banner": "https://...",
  "code": "ABC1",             // 可选，留空自动生成
  "isActive": true,
  "resourceIds": ["xxx", "yyy"]  // 初始关联的资源
}
```

#### 3. 获取空间详情
```http
GET /admin/creators/{creatorId}/spaces/{spaceId}
```
**返回**：包含关联的资源列表

#### 4. 更新空间
```http
PUT /admin/creators/{creatorId}/spaces/{spaceId}
{
  "title": "新标题",
  "description": "新描述",
  "code": "XYZ9",
  "isActive": false
}
```

#### 5. 删除空间
```http
DELETE /admin/creators/{creatorId}/spaces/{spaceId}
```

#### 6. 为空间添加资源
```http
POST /admin/creators/{creatorId}/spaces/{spaceId}/resources
{
  "resourceIds": ["xxx", "yyy", "zzz"]
}
```

#### 7. 从空间移除资源
```http
DELETE /admin/creators/{creatorId}/spaces/{spaceId}/resources
{
  "resourceIds": ["xxx", "yyy"]
}
```

---

## 🔄 数据迁移策略

### 方案 A：保留旧数据（推荐）
```go
// 为每个已有的创作者创建默认空间
func MigrateCreatorsToSpaces(db *gorm.DB) error {
    var creators []model.Creator
    db.Find(&creators)
    
    for _, creator := range creators {
        // 为每个创作者创建一个默认空间
        space := model.CreatorSpace{
            CreatorID:   creator.ID,
            Title:       creator.Name + "的空间",
            Description: creator.Description,
            Code:        creator.Code,  // 使用原来的口令
            IsActive:    creator.IsActive,
        }
        db.Create(&space)
        
        // 关联该创作者的所有资源到默认空间
        var resources []model.Resource
        db.Where("creator_id = ?", creator.ID).Find(&resources)
        db.Model(&space).Association("Resources").Append(&resources)
    }
    
    return nil
}
```

### 方案 B：全新开始
```go
// 清空创作者表，重新创建
// init-data?force=true
```

---

## 📝 使用场景示例

### 场景 1：创作者创建多个分类空间
```
创作者"设计师小王"有 50 个资源：
- 20 个头像
- 20 个壁纸
- 10 个图标

创建 3 个空间：
1. 空间"头像专区" (口令: HEAD) - 包含 20 个头像
2. 空间"壁纸合集" (口令: WALL) - 包含 20 个壁纸
3. 空间"全部资源" (口令: ALL1) - 包含全部 50 个资源
```

### 场景 2：限时分享
```
创作者创建临时空间：
- 空间"七夕特辑" (口令: 520A)
- 关联 10 个精选资源
- 活动结束后删除空间（资源不会被删除）
```

### 场景 3：付费内容分发
```
创作者创建不同等级空间：
- 免费空间 (口令: FREE) - 10 个免费资源
- 会员空间 (口令: VIP1) - 全部 100 个资源
```

---

## ⚠️ 注意事项

### 1. 口令唯一性
- 口令在 `creator_spaces` 表中全局唯一
- 不同创作者不能使用相同口令

### 2. 资源关联
- 资源可以同时出现在多个空间
- 删除空间不会删除资源
- 删除资源会自动解除所有空间关联

### 3. 统计数据
- Creator.SpaceCount - 统计该创作者的空间数量
- Creator.ResourceCount - 统计该创作者上传的资源数量
- Creator.DownloadCount - 统计所有资源的下载次数总和
- CreatorSpace.ViewCount - 统计该空间的访问次数
- CreatorSpace.ResourceCount - 统计该空间关联的资源数量
- CreatorSpace.DownloadCount - 统计该空间资源的下载次数总和

---

## 🚀 实施步骤

1. ✅ 更新数据模型
   - 移除 Creator.Code
   - 创建 CreatorSpace 模型
   - 更新 CodeAccessLog 关联

2. ✅ 创建空间管理 Handler
   - admin_creator_space.go

3. ✅ 添加路由
   - /admin/creators/:creatorId/spaces

4. ⏳ 更新现有 Handler
   - admin_creator.go（移除口令逻辑）
   - user_public.go（改为通过空间口令访问）

5. ⏳ 数据迁移
   - 创建迁移脚本或在 init.go 中处理

6. ⏳ 前端适配
   - 创作者管理页面
   - 空间管理页面（新增）
   - 资源关联页面

---

**完成时间：** 2026-03-03  
**状态：** 🔄 数据模型已更新，正在实施
