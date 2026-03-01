# 后端开发计划 - Valley MAS 核心功能实现

> 创建时间：2026-03-01  
> 状态：规划中  
> 优先级：高

---

## 📋 目录

1. [系统架构概览](#系统架构概览)
2. [开发阶段规划](#开发阶段规划)
3. [第一阶段：创作者与口令系统](#第一阶段创作者与口令系统)
4. [第二阶段：资源管理系统](#第二阶段资源管理系统)
5. [第三阶段：广告激励系统](#第三阶段广告激励系统)
6. [第四阶段：数据统计系统](#第四阶段数据统计系统)
7. [技术细节与注意事项](#技术细节与注意事项)

---

## 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        用户端（小程序/H5）                      │
│  输入口令 → 验证口令 → 浏览资源 → 观看广告 → 下载资源           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         后端 API 层                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 口令验证  │  │ 资源查询  │  │ 广告验证  │  │ 下载记录  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      数据层（SQLite）                          │
│  creators | resources | download_records | ad_records        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    火山引擎 TOS（对象存储）                     │
│                      图片/视频资源存储                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 开发阶段规划

### 阶段优先级

| 阶段 | 功能模块 | 优先级 | 预计工作量 | 依赖关系 |
|-----|---------|-------|-----------|---------|
| **Phase 1** | 创作者与口令系统 | ⭐⭐⭐⭐⭐ | 2-3天 | 无 |
| **Phase 2** | 资源管理系统 | ⭐⭐⭐⭐⭐ | 3-4天 | Phase 1 |
| **Phase 3** | 广告激励系统 | ⭐⭐⭐⭐ | 2-3天 | Phase 2 |
| **Phase 4** | 数据统计系统 | ⭐⭐⭐ | 1-2天 | Phase 2 |

### 总体时间线

```
Week 1: Phase 1 + Phase 2 (50%)
Week 2: Phase 2 (50%) + Phase 3
Week 3: Phase 4 + 测试优化
```

---

## 第一阶段：创作者与口令系统

### 🎯 核心目标

实现创作者注册、口令生成、口令验证的完整流程。

---

### 1.1 数据模型扩展

#### 当前 Creator 模型（已有）

```go
type Creator struct {
    ID          Int64String    `json:"id"`
    UserID      Int64String    `json:"userId"`      // 关联用户 ID
    Name        string         `json:"name"`         // 创作者名称
    Description string         `json:"description"`  // 简介
    Avatar      string         `json:"avatar"`       // 头像
    Code        string         `json:"code"`         // 口令（唯一）
    IsActive    bool           `json:"isActive"`     // 是否启用
    CreatedAt   time.Time      `json:"createdAt"`
    UpdatedAt   time.Time      `json:"updatedAt"`
}
```

#### 需要新增字段

```go
type Creator struct {
    // ... 原有字段

    // 口令配置
    CodeExpireAt    *time.Time `json:"codeExpireAt"`         // 口令过期时间（null=永久）
    CodeMaxUses     int        `json:"codeMaxUses"`          // 最大使用次数（0=无限制）
    CodeUsedCount   int        `json:"codeUsedCount"`        // 已使用次数
    
    // 空间配置
    SpaceTitle      string     `json:"spaceTitle"`           // 空间标题
    SpaceBanner     string     `json:"spaceBanner"`          // 空间横幅
    SpaceDescription string    `json:"spaceDescription"`     // 空间描述
    
    // 统计数据
    ViewCount       int        `json:"viewCount"`            // 浏览次数
    DownloadCount   int        `json:"downloadCount"`        // 下载次数
    Revenue         float64    `json:"revenue"`              // 累计收益（分）
}
```

#### 新增模型：CodeAccessLog（口令访问记录）

```go
type CodeAccessLog struct {
    ID         Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
    CreatorID  Int64String `gorm:"index" json:"creatorId"`
    UserID     Int64String `gorm:"index" json:"userId"`
    Code       string      `gorm:"size:20;index" json:"code"`
    IPAddress  string      `gorm:"size:50" json:"ipAddress"`
    UserAgent  string      `gorm:"size:500" json:"userAgent"`
    AccessedAt time.Time   `json:"accessedAt"`
    
    // 关联
    Creator *Creator `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
    User    *User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
```

---

### 1.2 API 接口设计

#### 🔵 创作者端接口（需要认证）

##### 1. 创建创作者空间

```http
POST /api/v1/creator/register
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "name": "我的创作空间",
  "description": "分享精美壁纸和头像",
  "avatar": "https://...",
  "spaceTitle": "精美壁纸合集",
  "spaceBanner": "https://...",
  "spaceDescription": "每日更新高清壁纸"
}

Response:
{
  "code": 0,
  "message": "创作者注册成功",
  "data": {
    "id": "2028025683447386112",
    "userId": "2028025683447386001",
    "name": "我的创作空间",
    "code": "ABC123",  // 自动生成的口令
    "createdAt": "2026-03-01T10:00:00Z"
  }
}
```

##### 2. 重新生成口令

```http
POST /api/v1/creator/regenerate-code
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "code": "XYZ789",
    "generatedAt": "2026-03-01T10:05:00Z"
  }
}
```

##### 3. 设置口令有效期

```http
PUT /api/v1/creator/code-settings
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "expireAt": "2026-04-01T00:00:00Z",  // null=永久
  "maxUses": 1000                       // 0=无限制
}

Response:
{
  "code": 0,
  "message": "口令设置已更新"
}
```

##### 4. 获取我的创作者信息

```http
GET /api/v1/creator/my-space
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "id": "2028025683447386112",
    "name": "我的创作空间",
    "code": "ABC123",
    "codeExpireAt": "2026-04-01T00:00:00Z",
    "codeMaxUses": 1000,
    "codeUsedCount": 234,
    "viewCount": 5678,
    "downloadCount": 1234,
    "revenue": 12345  // 分
  }
}
```

---

#### 🟢 用户端接口（公开 / 部分需认证）

##### 5. 验证口令（公开接口）

```http
POST /api/v1/public/code/verify
Content-Type: application/json

Request:
{
  "code": "ABC123"
}

Response:
{
  "code": 0,
  "message": "口令验证成功",
  "data": {
    "creatorId": "2028025683447386112",
    "creatorName": "我的创作空间",
    "spaceTitle": "精美壁纸合集",
    "spaceBanner": "https://...",
    "spaceDescription": "每日更新高清壁纸",
    "resourceCount": 128,
    "isValid": true
  }
}

Error Response:
{
  "code": 40001,
  "message": "口令不存在"
}
{
  "code": 40002,
  "message": "口令已过期"
}
{
  "code": 40003,
  "message": "口令使用次数已达上限"
}
```

##### 6. 获取创作者空间详情（公开接口）

```http
GET /api/v1/public/creator/:code
Query: ?code=ABC123

Response:
{
  "code": 0,
  "data": {
    "creator": {
      "id": "2028025683447386112",
      "name": "我的创作空间",
      "avatar": "https://...",
      "spaceTitle": "精美壁纸合集",
      "spaceBanner": "https://...",
      "spaceDescription": "每日更新高清壁纸",
      "viewCount": 5678
    },
    "stats": {
      "totalResources": 128,
      "totalDownloads": 1234,
      "categories": [
        { "type": "wallpaper", "count": 80 },
        { "type": "avatar", "count": 48 }
      ]
    }
  }
}
```

---

#### 🔴 管理后台接口（需要 admin 权限）

##### 7. 创作者列表（已有，需完善）

```http
GET /api/v1/admin/creators
Authorization: Bearer <token>
Query: ?page=1&pageSize=10&keyword=xxx&status=active

Response:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "2028025683447386112",
        "userId": "2028025683447386001",
        "name": "我的创作空间",
        "code": "ABC123",
        "codeUsedCount": 234,
        "viewCount": 5678,
        "downloadCount": 1234,
        "revenue": 12345,
        "isActive": true,
        "createdAt": "2026-03-01T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

##### 8. 禁用/启用创作者

```http
PUT /api/v1/admin/creators/:id/status
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "isActive": false,
  "reason": "违规内容"
}

Response:
{
  "code": 0,
  "message": "创作者状态已更新"
}
```

##### 9. 口令访问记录

```http
GET /api/v1/admin/creators/:id/access-logs
Authorization: Bearer <token>
Query: ?page=1&pageSize=20

Response:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "2028025683447386200",
        "userId": "2028025683447386001",
        "userNickname": "用户A",
        "code": "ABC123",
        "ipAddress": "123.456.789.0",
        "accessedAt": "2026-03-01T10:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

### 1.3 业务逻辑实现

#### 口令生成算法

```go
// utils/code.go

import (
    "math/rand"
    "strings"
    "time"
)

const (
    codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // 去除易混淆字符 I,O,0,1
    codeLength = 6
)

// GenerateCode 生成唯一口令（6位大写字母+数字）
func GenerateCode() string {
    rand.Seed(time.Now().UnixNano())
    var code strings.Builder
    
    for i := 0; i < codeLength; i++ {
        code.WriteByte(codeChars[rand.Intn(len(codeChars))])
    }
    
    return code.String()
}

// ValidateCode 验证口令格式
func ValidateCode(code string) bool {
    if len(code) != codeLength {
        return false
    }
    
    for _, c := range code {
        if !strings.ContainsRune(codeChars, c) {
            return false
        }
    }
    
    return true
}
```

#### 口令验证逻辑

```go
// handler/public.go

func VerifyCodeV2(c *gin.Context) {
    var req struct {
        Code string `json:"code" binding:"required"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        ErrorResponse(c, 400, "参数错误")
        return
    }
    
    // 1. 查询创作者
    var creator model.Creator
    if err := db.Where("code = ? AND is_active = ?", req.Code, true).First(&creator).Error; err != nil {
        ErrorResponse(c, 40001, "口令不存在")
        return
    }
    
    // 2. 检查过期时间
    if creator.CodeExpireAt != nil && time.Now().After(*creator.CodeExpireAt) {
        ErrorResponse(c, 40002, "口令已过期")
        return
    }
    
    // 3. 检查使用次数
    if creator.CodeMaxUses > 0 && creator.CodeUsedCount >= creator.CodeMaxUses {
        ErrorResponse(c, 40003, "口令使用次数已达上限")
        return
    }
    
    // 4. 记录访问日志
    userID := GetUserIDFromContext(c) // 如果已登录则记录
    log := model.CodeAccessLog{
        CreatorID:  creator.ID,
        UserID:     userID,
        Code:       req.Code,
        IPAddress:  c.ClientIP(),
        UserAgent:  c.GetHeader("User-Agent"),
        AccessedAt: time.Now(),
    }
    db.Create(&log)
    
    // 5. 更新统计
    db.Model(&creator).Updates(map[string]interface{}{
        "code_used_count": gorm.Expr("code_used_count + ?", 1),
        "view_count":      gorm.Expr("view_count + ?", 1),
    })
    
    // 6. 返回创作者空间信息
    SuccessResponse(c, gin.H{
        "creatorId":         creator.ID,
        "creatorName":       creator.Name,
        "spaceTitle":        creator.SpaceTitle,
        "spaceBanner":       creator.SpaceBanner,
        "spaceDescription":  creator.SpaceDescription,
        "resourceCount":     getResourceCount(creator.ID),
        "isValid":           true,
    })
}
```

---

### 1.4 数据库迁移

```sql
-- migrations/002_creator_space_features.sql

-- 扩展 creators 表
ALTER TABLE creators ADD COLUMN code_expire_at DATETIME DEFAULT NULL;
ALTER TABLE creators ADD COLUMN code_max_uses INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN code_used_count INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN space_title VARCHAR(100) DEFAULT '';
ALTER TABLE creators ADD COLUMN space_banner VARCHAR(500) DEFAULT '';
ALTER TABLE creators ADD COLUMN space_description TEXT DEFAULT '';
ALTER TABLE creators ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN download_count INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN revenue INTEGER DEFAULT 0;

-- 创建口令访问日志表
CREATE TABLE code_access_logs (
    id INTEGER PRIMARY KEY,
    creator_id INTEGER NOT NULL,
    user_id INTEGER DEFAULT NULL,
    code VARCHAR(20) NOT NULL,
    ip_address VARCHAR(50) NOT NULL,
    user_agent VARCHAR(500),
    accessed_at DATETIME NOT NULL,
    
    FOREIGN KEY (creator_id) REFERENCES creators(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_cal_creator ON code_access_logs(creator_id);
CREATE INDEX idx_cal_user ON code_access_logs(user_id);
CREATE INDEX idx_cal_code ON code_access_logs(code);
CREATE INDEX idx_cal_accessed_at ON code_access_logs(accessed_at);
```

---

### 1.5 开发任务清单

- [ ] **数据模型**
  - [ ] 扩展 Creator 模型（新增字段）
  - [ ] 创建 CodeAccessLog 模型
  - [ ] 编写数据库迁移脚本
  - [ ] 执行迁移并测试

- [ ] **工具函数**
  - [ ] 口令生成算法（utils/code.go）
  - [ ] 口令格式验证
  - [ ] 口令唯一性检查

- [ ] **API 接口**
  - [ ] `POST /api/v1/creator/register` - 创作者注册
  - [ ] `POST /api/v1/creator/regenerate-code` - 重新生成口令
  - [ ] `PUT /api/v1/creator/code-settings` - 口令设置
  - [ ] `GET /api/v1/creator/my-space` - 我的空间信息
  - [ ] `POST /api/v1/public/code/verify` - 口令验证（重构）
  - [ ] `GET /api/v1/public/creator/:code` - 空间详情
  - [ ] `GET /api/v1/admin/creators/:id/access-logs` - 访问记录

- [ ] **单元测试**
  - [ ] 口令生成测试
  - [ ] 口令验证逻辑测试
  - [ ] API 接口集成测试

- [ ] **文档**
  - [ ] API 文档更新
  - [ ] 口令系统使用说明

---

## 第二阶段：资源管理系统

### 🎯 核心目标

实现资源上传、分类、查询、预览的完整流程，对接火山引擎 TOS。

---

### 2.1 数据模型扩展

#### 当前 Resource 模型（已有）

```go
type Resource struct {
    ID            Int64String `json:"id"`
    CreatorID     Int64String `json:"creatorId"`
    Type          string      `json:"type"`          // avatar, wallpaper
    Title         string      `json:"title"`
    Description   string      `json:"description"`
    URL           string      `json:"url"`
    ThumbnailURL  string      `json:"thumbnailUrl"`
    Width         int         `json:"width"`
    Height        int         `json:"height"`
    Size          int64       `json:"size"`
    DownloadCount int         `json:"downloadCount"`
    CreatedAt     time.Time   `json:"createdAt"`
}
```

#### 需要新增字段

```go
type Resource struct {
    // ... 原有字段

    // 分类与标签
    Category    string `json:"category"`        // wallpaper, avatar, emoji, sticker
    Tags        string `json:"tags"`            // 逗号分隔：风景,自然,高清
    
    // 文件信息
    FileName    string `json:"fileName"`        // 原始文件名
    FileHash    string `json:"fileHash"`        // MD5 哈希（去重）
    MimeType    string `json:"mimeType"`        // image/jpeg, image/png
    
    // 审核状态
    Status      string `json:"status"`          // pending, approved, rejected
    RejectReason string `json:"rejectReason"`   // 拒绝原因
    
    // 统计数据
    ViewCount   int    `json:"viewCount"`       // 浏览次数
    LikeCount   int    `json:"likeCount"`       // 点赞次数
    
    // 排序权重
    SortOrder   int    `json:"sortOrder"`       // 排序权重（创作者可调整）
    IsHot       bool   `json:"isHot"`           // 是否热门推荐
}
```

---

### 2.2 火山引擎 TOS 对接

#### TOS 配置

```go
// internal/config/config.go

type TOSConfig struct {
    AccessKey string `mapstructure:"access_key"`
    SecretKey string `mapstructure:"secret_key"`
    Bucket    string `mapstructure:"bucket"`
    Endpoint  string `mapstructure:"endpoint"`
    Region    string `mapstructure:"region"`
    CDNDomain string `mapstructure:"cdn_domain"` // CDN 加速域名
}

type Config struct {
    // ... 原有配置
    TOS TOSConfig `mapstructure:"tos"`
}
```

#### TOS 客户端封装

```go
// internal/utils/tos.go

package utils

import (
    "context"
    "fmt"
    "io"
    "path/filepath"
    "time"
    
    "github.com/volcengine/ve-tos-golang-sdk/v2/tos"
)

type TOSClient struct {
    client *tos.ClientV2
    bucket string
    cdnDomain string
}

func NewTOSClient(cfg *config.TOSConfig) (*TOSClient, error) {
    client, err := tos.NewClientV2(cfg.Endpoint, tos.WithRegion(cfg.Region),
        tos.WithCredentials(tos.NewStaticCredentials(cfg.AccessKey, cfg.SecretKey)))
    
    if err != nil {
        return nil, err
    }
    
    return &TOSClient{
        client:    client,
        bucket:    cfg.Bucket,
        cdnDomain: cfg.CDNDomain,
    }, nil
}

// UploadFile 上传文件
func (t *TOSClient) UploadFile(ctx context.Context, key string, reader io.Reader, size int64) (string, error) {
    input := &tos.PutObjectV2Input{
        PutObjectBasicInput: tos.PutObjectBasicInput{
            Bucket: t.bucket,
            Key:    key,
        },
        Content: reader,
    }
    
    _, err := t.client.PutObjectV2(ctx, input)
    if err != nil {
        return "", err
    }
    
    // 返回 CDN URL
    return fmt.Sprintf("%s/%s", t.cdnDomain, key), nil
}

// GenerateKey 生成对象存储 key
// 格式：creators/{creatorId}/{category}/{timestamp}_{uuid}.{ext}
func GenerateKey(creatorID string, category string, filename string) string {
    ext := filepath.Ext(filename)
    timestamp := time.Now().Unix()
    uuid := GenerateID() // 使用 Snowflake ID
    
    return fmt.Sprintf("creators/%s/%s/%d_%d%s", 
        creatorID, category, timestamp, uuid, ext)
}

// DeleteFile 删除文件
func (t *TOSClient) DeleteFile(ctx context.Context, key string) error {
    input := &tos.DeleteObjectInput{
        Bucket: t.bucket,
        Key:    key,
    }
    
    _, err := t.client.DeleteObject(ctx, input)
    return err
}
```

---

### 2.3 API 接口设计

#### 🔵 创作者端接口

##### 1. 获取上传凭证（预签名 URL）

```http
POST /api/v1/creator/resources/upload-token
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "fileName": "wallpaper.jpg",
  "fileSize": 1024000,
  "category": "wallpaper",
  "mimeType": "image/jpeg"
}

Response:
{
  "code": 0,
  "data": {
    "uploadUrl": "https://tos-cn-beijing.volces.com/...",
    "uploadToken": "...",
    "key": "creators/123/wallpaper/1234567890_xxx.jpg",
    "expireAt": "2026-03-01T11:00:00Z"
  }
}
```

##### 2. 确认上传完成

```http
POST /api/v1/creator/resources
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "key": "creators/123/wallpaper/1234567890_xxx.jpg",
  "category": "wallpaper",
  "title": "夕阳下的海滩",
  "description": "高清自然风景壁纸",
  "tags": "风景,自然,海滩",
  "width": 1920,
  "height": 1080,
  "size": 1024000,
  "fileHash": "abc123def456"
}

Response:
{
  "code": 0,
  "message": "资源上传成功",
  "data": {
    "id": "2028025683447386300",
    "url": "https://cdn.example.com/creators/123/wallpaper/xxx.jpg",
    "thumbnailUrl": "https://cdn.example.com/creators/123/wallpaper/xxx_thumb.jpg"
  }
}
```

##### 3. 我的资源列表

```http
GET /api/v1/creator/resources
Authorization: Bearer <token>
Query: ?page=1&pageSize=20&category=wallpaper&status=approved

Response:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "2028025683447386300",
        "title": "夕阳下的海滩",
        "category": "wallpaper",
        "url": "https://...",
        "thumbnailUrl": "https://...",
        "status": "approved",
        "downloadCount": 123,
        "viewCount": 456,
        "createdAt": "2026-03-01T10:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

##### 4. 更新资源信息

```http
PUT /api/v1/creator/resources/:id
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "title": "更新的标题",
  "description": "更新的描述",
  "tags": "新标签1,新标签2",
  "sortOrder": 10
}
```

##### 5. 删除资源

```http
DELETE /api/v1/creator/resources/:id
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "message": "资源已删除"
}
```

---

#### 🟢 用户端接口

##### 6. 获取创作者空间资源列表

```http
GET /api/v1/public/creator/:code/resources
Query: ?page=1&pageSize=20&category=wallpaper&sort=hot

Response:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "2028025683447386300",
        "title": "夕阳下的海滩",
        "category": "wallpaper",
        "thumbnailUrl": "https://...",
        "width": 1920,
        "height": 1080,
        "size": 1024000,
        "downloadCount": 123,
        "viewCount": 456,
        "likeCount": 78
      }
    ],
    "pagination": { ... }
  }
}
```

##### 7. 获取资源详情

```http
GET /api/v1/public/resources/:id

Response:
{
  "code": 0,
  "data": {
    "id": "2028025683447386300",
    "title": "夕阳下的海滩",
    "description": "高清自然风景壁纸",
    "category": "wallpaper",
    "tags": ["风景", "自然", "海滩"],
    "url": "https://...",  // 高清大图（需要广告解锁）
    "thumbnailUrl": "https://...",
    "width": 1920,
    "height": 1080,
    "size": 1024000,
    "downloadCount": 123,
    "viewCount": 456,
    "creator": {
      "id": "2028025683447386112",
      "name": "我的创作空间",
      "avatar": "https://..."
    }
  }
}
```

---

#### 🔴 管理后台接口

##### 8. 资源审核列表

```http
GET /api/v1/admin/resources/pending
Authorization: Bearer <token>
Query: ?page=1&pageSize=20

Response:
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "2028025683447386300",
        "title": "夕阳下的海滩",
        "category": "wallpaper",
        "url": "https://...",
        "creator": {
          "id": "2028025683447386112",
          "name": "我的创作空间"
        },
        "status": "pending",
        "createdAt": "2026-03-01T10:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

##### 9. 审核通过/拒绝

```http
PUT /api/v1/admin/resources/:id/review
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "status": "approved",  // approved | rejected
  "rejectReason": "包含违规内容"  // status=rejected 时必填
}

Response:
{
  "code": 0,
  "message": "审核完成"
}
```

---

### 2.4 开发任务清单

- [ ] **TOS 对接**
  - [ ] 安装 TOS SDK（`go get github.com/volcengine/ve-tos-golang-sdk/v2`）
  - [ ] 封装 TOS 客户端（utils/tos.go）
  - [ ] 实现文件上传/删除/预签名 URL
  - [ ] 测试 TOS 连接

- [ ] **数据模型**
  - [ ] 扩展 Resource 模型
  - [ ] 数据库迁移脚本
  - [ ] 执行迁移

- [ ] **API 接口**
  - [ ] `POST /api/v1/creator/resources/upload-token` - 获取上传凭证
  - [ ] `POST /api/v1/creator/resources` - 确认上传
  - [ ] `GET /api/v1/creator/resources` - 我的资源列表
  - [ ] `PUT /api/v1/creator/resources/:id` - 更新资源
  - [ ] `DELETE /api/v1/creator/resources/:id` - 删除资源
  - [ ] `GET /api/v1/public/creator/:code/resources` - 空间资源列表
  - [ ] `GET /api/v1/public/resources/:id` - 资源详情
  - [ ] `GET /api/v1/admin/resources/pending` - 待审核列表
  - [ ] `PUT /api/v1/admin/resources/:id/review` - 审核

- [ ] **功能优化**
  - [ ] 文件哈希去重
  - [ ] 缩略图自动生成（可选）
  - [ ] 图片压缩优化

- [ ] **测试**
  - [ ] 上传流程测试
  - [ ] 大文件上传测试
  - [ ] 并发上传测试

---

## 第三阶段：广告激励系统

### 🎯 核心目标

实现广告观看验证、下载权限解锁、收益计算的完整流程。

---

### 3.1 数据模型设计

#### 新增模型：AdRecord（广告观看记录）

```go
type AdRecord struct {
    ID           Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
    UserID       Int64String `gorm:"index" json:"userId"`
    ResourceID   Int64String `gorm:"index" json:"resourceId"`
    CreatorID    Int64String `gorm:"index" json:"creatorId"`
    
    // 广告信息
    AdPlatform   string      `json:"adPlatform"`   // douyin, wechat, etc.
    AdType       string      `json:"adType"`       // reward_video, interstitial
    AdUnitID     string      `json:"adUnitId"`     // 广告位 ID
    
    // 观看状态
    IsCompleted  bool        `json:"isCompleted"`  // 是否看完
    WatchDuration int        `json:"watchDuration"` // 观看时长（秒）
    
    // 收益信息
    Revenue      int         `json:"revenue"`      // 单次收益（分）
    CreatorRevenue int       `json:"creatorRevenue"` // 创作者收益（分）
    PlatformRevenue int      `json:"platformRevenue"` // 平台收益（分）
    
    // 验证信息
    AdToken      string      `json:"adToken"`      // 广告回调 token
    IPAddress    string      `json:"ipAddress"`
    UserAgent    string      `json:"userAgent"`
    
    CreatedAt    time.Time   `json:"createdAt"`
    
    // 关联
    User     *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
    Resource *Resource `gorm:"foreignKey:ResourceID" json:"resource,omitempty"`
    Creator  *Creator  `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
}
```

#### 新增模型：DownloadToken（下载令牌）

```go
type DownloadToken struct {
    ID         Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
    UserID     Int64String `gorm:"index" json:"userId"`
    ResourceID Int64String `gorm:"index" json:"resourceId"`
    Token      string      `gorm:"size:64;uniqueIndex" json:"token"` // UUID
    ExpireAt   time.Time   `json:"expireAt"`  // 5分钟有效期
    IsUsed     bool        `json:"isUsed"`
    UsedAt     *time.Time  `json:"usedAt"`
    CreatedAt  time.Time   `json:"createdAt"`
}
```

---

### 3.2 广告流程设计

```
┌────────────────────────────────────────────────────────────────┐
│                        广告激励下载流程                           │
└────────────────────────────────────────────────────────────────┘

1. 用户点击下载按钮
   ↓
2. 前端调用：GET /api/v1/resources/:id/download-status
   → 检查是否需要观看广告
   ↓
3. 如果需要广告：
   前端展示激励视频广告（穿山甲/优量汇 SDK）
   ↓
4. 广告播放完成后，前端调用：
   POST /api/v1/ad/verify
   {
     "resourceId": "xxx",
     "adPlatform": "douyin",
     "adToken": "xxx"  // 广告平台回调 token
   }
   ↓
5. 后端验证广告：
   - 验证 adToken 有效性（调用广告平台接口）
   - 记录广告观看记录
   - 计算收益
   - 生成下载令牌（5分钟有效）
   ↓
6. 返回下载令牌给前端：
   { "downloadToken": "uuid-xxx", "expireAt": "..." }
   ↓
7. 前端调用下载接口：
   GET /api/v1/resources/:id/download?token=uuid-xxx
   ↓
8. 后端验证令牌：
   - 检查令牌有效性
   - 标记令牌已使用
   - 记录下载记录
   - 更新统计数据
   - 返回资源 URL
```

---

### 3.3 API 接口设计

#### 1. 检查下载状态

```http
GET /api/v1/resources/:id/download-status
Authorization: Bearer <token> (可选)

Response:
{
  "code": 0,
  "data": {
    "needAd": true,           // 是否需要观看广告
    "reason": "首次下载需观看广告",
    "adConfig": {
      "adPlatform": "douyin",
      "adUnitId": "xxx",
      "adType": "reward_video"
    },
    "hasPrevDownload": false, // 是否曾下载过
    "downloadCount": 0        // 用户下载此资源次数
  }
}

// 如果不需要广告：
{
  "code": 0,
  "data": {
    "needAd": false,
    "reason": "已观看过广告",
    "directDownload": true,
    "downloadUrl": "https://..."  // 直接返回下载链接
  }
}
```

#### 2. 验证广告观看

```http
POST /api/v1/ad/verify
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "resourceId": "2028025683447386300",
  "adPlatform": "douyin",
  "adType": "reward_video",
  "adUnitId": "xxx",
  "adToken": "xxx",  // 广告平台回调 token
  "watchDuration": 30
}

Response:
{
  "code": 0,
  "message": "广告验证成功",
  "data": {
    "downloadToken": "550e8400-e29b-41d4-a716-446655440000",
    "expireAt": "2026-03-01T10:05:00Z",
    "revenue": {
      "total": 100,      // 总收益（分）
      "creator": 70,     // 创作者收益（分）
      "platform": 30     // 平台收益（分）
    }
  }
}

Error Response:
{
  "code": 50001,
  "message": "广告验证失败"
}
```

#### 3. 下载资源

```http
GET /api/v1/resources/:id/download
Authorization: Bearer <token>
Query: ?token=550e8400-e29b-41d4-a716-446655440000

Response:
{
  "code": 0,
  "data": {
    "downloadUrl": "https://cdn.example.com/creators/123/wallpaper/xxx.jpg",
    "fileName": "夕阳下的海滩.jpg",
    "fileSize": 1024000,
    "expireAt": "2026-03-01T10:10:00Z"  // URL 有效期
  }
}

Error Response:
{
  "code": 50002,
  "message": "下载令牌无效或已过期"
}
{
  "code": 50003,
  "message": "下载令牌已使用"
}
```

#### 4. 创作者收益统计

```http
GET /api/v1/creator/revenue
Authorization: Bearer <token>
Query: ?startDate=2026-03-01&endDate=2026-03-31

Response:
{
  "code": 0,
  "data": {
    "totalRevenue": 123456,  // 总收益（分）
    "totalAds": 1234,        // 广告总数
    "avgRevenue": 100,       // 平均单次收益
    "dailyRevenue": [
      { "date": "2026-03-01", "revenue": 1234, "ads": 12 },
      { "date": "2026-03-02", "revenue": 2345, "ads": 23 }
    ]
  }
}
```

---

### 3.4 收益计算规则

```go
// 收益分成比例配置
const (
    CreatorRevenueRate  = 0.70  // 创作者 70%
    PlatformRevenueRate = 0.30  // 平台 30%
)

// 单次广告收益（分）
const (
    RewardVideoRevenue = 100  // 激励视频 1元
    InterstitialRevenue = 50  // 插屏广告 0.5元
)

// CalculateRevenue 计算收益
func CalculateRevenue(adType string) (total, creator, platform int) {
    switch adType {
    case "reward_video":
        total = RewardVideoRevenue
    case "interstitial":
        total = InterstitialRevenue
    default:
        total = 0
    }
    
    creator = int(float64(total) * CreatorRevenueRate)
    platform = total - creator
    
    return
}
```

---

### 3.5 广告平台 Mock（开发阶段）

```go
// handler/ad.go

// MockVerifyAd 模拟广告验证（开发阶段使用）
func MockVerifyAd(adToken string) (bool, error) {
    // 开发环境：直接返回成功
    if gin.Mode() == gin.DebugMode {
        return true, nil
    }
    
    // 生产环境：调用真实广告平台接口
    // TODO: 对接穿山甲/优量汇 API
    return false, errors.New("未实现")
}
```

---

### 3.6 开发任务清单

- [ ] **数据模型**
  - [ ] 创建 AdRecord 模型
  - [ ] 创建 DownloadToken 模型
  - [ ] 数据库迁移

- [ ] **核心逻辑**
  - [ ] 下载状态检查
  - [ ] 广告验证逻辑（Mock）
  - [ ] 下载令牌生成与验证
  - [ ] 收益计算与分成
  - [ ] 统计数据更新

- [ ] **API 接口**
  - [ ] `GET /api/v1/resources/:id/download-status`
  - [ ] `POST /api/v1/ad/verify`
  - [ ] `GET /api/v1/resources/:id/download`
  - [ ] `GET /api/v1/creator/revenue`

- [ ] **防刷机制**
  - [ ] IP 限流
  - [ ] 用户行为分析
  - [ ] 广告 token 唯一性校验

- [ ] **测试**
  - [ ] 广告流程测试
  - [ ] 并发下载测试
  - [ ] 令牌过期测试

---

## 第四阶段：数据统计系统

### 🎯 核心目标

实现实时数据统计、创作者数据看板、管理后台数据分析。

---

### 4.1 统计维度设计

```go
// 统计维度
type Stats struct {
    // 全局统计
    TotalUsers      int64 `json:"totalUsers"`
    TotalCreators   int64 `json:"totalCreators"`
    TotalResources  int64 `json:"totalResources"`
    TotalDownloads  int64 `json:"totalDownloads"`
    TotalRevenue    int64 `json:"totalRevenue"`
    
    // 今日统计
    TodayUsers      int64 `json:"todayUsers"`
    TodayDownloads  int64 `json:"todayDownloads"`
    TodayRevenue    int64 `json:"todayRevenue"`
    
    // 增长率
    UserGrowthRate  float64 `json:"userGrowthRate"`
    DownloadGrowthRate float64 `json:"downloadGrowthRate"`
}

// 创作者统计
type CreatorStats struct {
    ViewCount       int64   `json:"viewCount"`       // 浏览量
    DownloadCount   int64   `json:"downloadCount"`   // 下载量
    AdCount         int64   `json:"adCount"`         // 广告次数
    Revenue         int64   `json:"revenue"`         // 收益（分）
    ResourceCount   int64   `json:"resourceCount"`   // 资源数
    
    // 排行榜
    TopResources    []Resource `json:"topResources"`    // 热门资源 Top 10
    
    // 趋势数据
    DailyViews      []DailyStat `json:"dailyViews"`
    DailyDownloads  []DailyStat `json:"dailyDownloads"`
    DailyRevenue    []DailyStat `json:"dailyRevenue"`
}

type DailyStat struct {
    Date  string `json:"date"`
    Count int64  `json:"count"`
}
```

---

### 4.2 API 接口设计

#### 1. 管理后台总览统计（已有，需完善）

```http
GET /api/v1/admin/stats
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "overview": {
      "totalUsers": 10000,
      "totalCreators": 500,
      "totalResources": 5000,
      "totalDownloads": 100000,
      "totalRevenue": 1000000
    },
    "today": {
      "todayUsers": 100,
      "todayDownloads": 1000,
      "todayRevenue": 10000
    },
    "growth": {
      "userGrowthRate": 5.2,
      "downloadGrowthRate": 10.5
    },
    "trends": {
      "dailyUsers": [...],
      "dailyDownloads": [...],
      "dailyRevenue": [...]
    }
  }
}
```

#### 2. 创作者数据看板

```http
GET /api/v1/creator/dashboard
Authorization: Bearer <token>
Query: ?startDate=2026-03-01&endDate=2026-03-31

Response:
{
  "code": 0,
  "data": {
    "overview": {
      "viewCount": 5678,
      "downloadCount": 1234,
      "adCount": 567,
      "revenue": 56700,
      "resourceCount": 128
    },
    "topResources": [
      {
        "id": "xxx",
        "title": "夕阳下的海滩",
        "downloadCount": 234,
        "revenue": 23400
      }
    ],
    "trends": {
      "dailyViews": [...],
      "dailyDownloads": [...],
      "dailyRevenue": [...]
    }
  }
}
```

---

### 4.3 开发任务清单

- [ ] **统计逻辑**
  - [ ] 全局统计查询
  - [ ] 创作者统计查询
  - [ ] 趋势数据聚合
  - [ ] 排行榜计算

- [ ] **API 接口**
  - [ ] `GET /api/v1/admin/stats` - 完善管理后台统计
  - [ ] `GET /api/v1/creator/dashboard` - 创作者看板

- [ ] **性能优化**
  - [ ] Redis 缓存统计数据
  - [ ] 定时任务预计算
  - [ ] 数据库索引优化

---

## 技术细节与注意事项

### 安全性

1. **口令安全**
   - 使用安全随机数生成口令
   - 避免暴力破解（添加访问频率限制）
   - 记录所有访问日志

2. **文件上传安全**
   - 文件类型白名单（只允许图片）
   - 文件大小限制（单文件 < 10MB）
   - 文件内容检测（防止恶意文件）
   - 防止路径遍历攻击

3. **广告防刷**
   - IP 限流（单 IP 每小时最多 10 次）
   - 设备指纹识别
   - 广告 token 唯一性校验
   - 异常行为检测（短时间内大量请求）

4. **下载令牌安全**
   - 使用 UUID v4 生成令牌
   - 5分钟短有效期
   - 一次性使用（用完即失效）
   - 绑定用户和资源

---

### 性能优化

1. **数据库优化**
   - 为高频查询字段添加索引
   - 使用 GORM 的 `Preload` 避免 N+1 查询
   - 分页查询使用游标分页（大数据量时）

2. **缓存策略**
   - Redis 缓存热门资源列表（5分钟）
   - Redis 缓存创作者空间信息（10分钟）
   - Redis 缓存统计数据（1小时）

3. **CDN 加速**
   - 静态资源全部走 CDN
   - 配置合理的缓存策略
   - 使用 WebP 格式（减少体积）

---

### 监控告警

1. **业务监控**
   - 广告验证成功率
   - 下载成功率
   - 平均下载时长

2. **系统监控**
   - API 响应时间
   - 数据库连接池状态
   - TOS 上传成功率

3. **告警规则**
   - 广告验证失败率 > 10%
   - API 错误率 > 5%
   - 下载失败率 > 5%

---

## 总结

### 开发顺序建议

```
1️⃣ Phase 1: 创作者与口令系统 (2-3天)
   ├─ 数据模型扩展
   ├─ 口令生成与验证
   ├─ 创作者注册流程
   └─ 管理后台审核功能

2️⃣ Phase 2: 资源管理系统 (3-4天)
   ├─ TOS 对接
   ├─ 资源上传流程
   ├─ 资源列表与详情
   └─ 审核与分类

3️⃣ Phase 3: 广告激励系统 (2-3天)
   ├─ 广告验证逻辑（Mock）
   ├─ 下载令牌机制
   ├─ 收益计算与记录
   └─ 防刷机制

4️⃣ Phase 4: 数据统计系统 (1-2天)
   ├─ 统计数据查询
   ├─ 创作者看板
   └─ 管理后台数据分析
```

### 关键里程碑

- [ ] **Week 1 结束**：完成 Phase 1 + Phase 2（50%）
  - ✅ 创作者可以注册并生成口令
  - ✅ 用户可以验证口令进入空间
  - ✅ 创作者可以上传资源到 TOS

- [ ] **Week 2 结束**：完成 Phase 2 + Phase 3
  - ✅ 用户可以浏览资源列表
  - ✅ 用户可以通过观看广告解锁下载
  - ✅ 下载记录正确保存

- [ ] **Week 3 结束**：完成 Phase 4 + 测试优化
  - ✅ 数据统计准确
  - ✅ 创作者可以查看收益
  - ✅ 系统性能满足要求

---

**下一步行动：开始 Phase 1 - 创作者与口令系统开发！** 🚀
