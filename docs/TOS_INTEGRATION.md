# 火山引擎对象存储 (TOS) 集成文档

## 📦 功能概述

已成功集成火山引擎对象存储（TOS）用于图片资源管理：
- ✅ 头像上传
- ✅ 壁纸上传
- ✅ 文件删除
- ✅ 公开 URL 访问

---

## 🔧 配置说明

### 1. 环境变量配置

在 `server/.env` 文件中配置：

```bash
# 火山引擎 TOS 配置
TOS_ACCESS_KEY=your_access_key_here
TOS_SECRET_KEY=your_secret_key_here
TOS_BUCKET=your_bucket_name
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_REGION=cn-beijing
```

> **⚠️ 安全提示**：
> - `.env` 文件已在 `.gitignore` 中，不会提交到 Git
> - 请从火山引擎控制台获取真实的 Access Key 和 Secret Key
> - 获取地址：https://console.volcengine.com/iam/keymanage/

### 2. Bucket 设置

**重要**：需要在火山引擎控制台设置 Bucket 为公开读：

1. 登录 [火山引擎控制台](https://console.volcengine.com/tos)
2. 找到你的 Bucket：`valley-resources`
3. 进入「权限管理」→「访问权限」
4. 设置为：**公共读** (Public Read)
5. 或配置 Bucket Policy 允许公开访问

示例 Bucket Policy（公共读）:
```json
{
  "Statement": [
    {
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["tos:GetObject"],
      "Resource": ["trn:tos:::valley-resources/*"]
    }
  ]
}
```

---

## 📡 API 接口

### 1. 上传资源

**接口**: `POST /api/v1/admin/resources/upload`

**权限**: 管理员

**请求**:
- Content-Type: `multipart/form-data`
- Headers: `Authorization: Bearer {token}`

**参数**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 图片文件 |
| type | String | 是 | `avatar` 或 `wallpaper` |

**文件限制**:
- 格式：JPG, PNG, WEBP
- 头像最大：2MB
- 壁纸最大：5MB

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "2028025683447386112",
    "type": "avatar",
    "url": "https://valley-resources.tos-cn-beijing.volces.com/avatars/1234567890_abc123.png",
    "title": "user-avatar.png",
    "size": 153600,
    "creatorId": "0",
    "createdAt": "2026-03-01T20:00:00Z"
  }
}
```

### 2. 资源列表

**接口**: `GET /api/v1/admin/resources`

**权限**: 管理员

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | Integer | 1 | 页码 |
| pageSize | Integer | 20 | 每页数量 |
| type | String | - | 筛选类型：`avatar` / `wallpaper` |

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "id": "2028025683447386112",
        "type": "avatar",
        "url": "https://valley-resources.tos-cn-beijing.volces.com/avatars/xxx.png",
        "title": "头像1",
        "size": 153600,
        "downloadCount": 10,
        "createdAt": "2026-03-01T20:00:00Z"
      }
    ],
    "total": 100
  }
}
```

### 3. 删除资源

**接口**: `DELETE /api/v1/admin/resources/{id}`

**权限**: 管理员

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": null
}
```

---

## 🧪 测试步骤

### 使用 Swagger UI

1. 启动服务器：
   ```bash
   cd server
   air
   ```

2. 访问 Swagger UI：http://localhost:8080/swagger/index.html

3. 登录获取 Token：
   - 使用 `POST /api/v1/login` 接口
   - 获取管理员用户的 JWT Token

4. 授权：
   - 点击右上角 "Authorize" 按钮
   - 输入：`Bearer {你的token}`

5. 测试上传：
   - 找到 `POST /admin/resources/upload`
   - 点击 "Try it out"
   - 选择文件
   - 选择 type (`avatar` 或 `wallpaper`)
   - 点击 "Execute"

### 使用 curl

```bash
# 1. 登录获取 token
TOKEN=$(curl -X POST http://localhost:8080/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.data.token')

# 2. 上传头像
curl -X POST http://localhost:8080/api/v1/admin/resources/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/avatar.png" \
  -F "type=avatar"

# 3. 上传壁纸
curl -X POST http://localhost:8080/api/v1/admin/resources/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/wallpaper.jpg" \
  -F "type=wallpaper"

# 4. 查看列表
curl -X GET "http://localhost:8080/api/v1/admin/resources?page=1&pageSize=10&type=avatar" \
  -H "Authorization: Bearer $TOKEN"

# 5. 删除资源
curl -X DELETE http://localhost:8080/api/v1/admin/resources/2028025683447386112 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📂 目录结构

上传的文件会按类型存储在不同目录：

```
valley-resources (Bucket)
├── avatars/          # 头像
│   ├── 1234567890_abc123.png
│   └── 1234567891_def456.jpg
└── wallpapers/       # 壁纸
    ├── 1234567892_ghi789.jpg
    └── 1234567893_jkl012.webp
```

文件命名规则：`{timestamp}_{random8chars}.{ext}`
- `timestamp`: 纳秒时间戳
- `random8chars`: 8位随机字符
- `ext`: 原始文件扩展名

---

## 🔒 安全说明

### 已实现的安全措施

1. **文件类型验证**
   - 只允许 `.jpg`, `.jpeg`, `.png`, `.webp`
   - 通过扩展名检查

2. **文件大小限制**
   - 头像：最大 2MB
   - 壁纸：最大 5MB

3. **权限控制**
   - 只有管理员可以上传/删除资源
   - 使用 JWT Bearer Token 认证

4. **数据一致性**
   - 上传失败时自动回滚（删除已上传的文件）
   - 删除记录时同步删除 TOS 文件

### 建议的额外安全措施

1. **内容类型检查**（未实现）
   ```go
   // 检查文件头魔术数字
   // PNG: 89 50 4E 47
   // JPEG: FF D8 FF
   ```

2. **图片尺寸限制**（未实现）
   ```go
   // 限制头像：最大 1024x1024
   // 限制壁纸：最大 4096x4096
   ```

3. **防重复上传**（未实现）
   ```go
   // 计算文件 MD5/SHA256
   // 检查是否已存在相同文件
   ```

4. **病毒扫描**（未实现）
   - 集成 ClamAV 或云安全服务

---

## 🐛 常见问题

### 1. 上传失败：TOS uploader not initialized

**原因**：TOS 配置未加载

**解决**：
1. 检查 `.env` 文件是否存在
2. 确认环境变量配置正确
3. 重启服务器

### 2. 上传成功但无法访问 URL

**原因**：Bucket 权限未设置为公共读

**解决**：
1. 登录火山引擎控制台
2. 设置 Bucket 为公共读
3. 或配置 Bucket Policy

### 3. 文件过大被拒绝

**原因**：超过文件大小限制

**解决**：
- 头像：压缩到 2MB 以内
- 壁纸：压缩到 5MB 以内
- 或修改 `admin_resource.go` 中的 `maxSize` 参数

### 4. 编译错误：TOS SDK 未安装

**解决**：
```bash
cd server
go get github.com/volcengine/ve-tos-golang-sdk/v2/tos
go mod tidy
```

---

## 📝 代码文件说明

### 新增文件

1. **`internal/utils/tos.go`** - TOS 上传工具类
   - `InitTOS()` - 初始化 TOS 客户端
   - `UploadFile()` - 上传文件
   - `DeleteFile()` - 删除文件
   - `GetPublicURL()` - 获取公开 URL
   - `ValidateFileType()` - 验证文件类型
   - `ValidateFileSize()` - 验证文件大小

2. **`server/.env`** - 环境变量配置（包含 TOS 密钥）

### 修改文件

1. **`main.go`**
   - 添加 `.env` 文件加载
   - 添加 TOS 初始化逻辑

2. **`internal/handler/admin_resource.go`**
   - 实现 `UploadResource()` - 上传资源
   - 实现 `ListResources()` - 资源列表
   - 实现 `DeleteResource()` - 删除资源

3. **`internal/utils/snowflake.go`**
   - 添加 `GenerateRandomString()` - 生成随机字符串

4. **`internal/handler/common.go`**
   - 添加 `GetIntQuery()` - 获取整数查询参数

---

## 🚀 下一步优化

### 短期优化

1. **图片处理**
   - 自动生成缩略图
   - 自动压缩大图
   - 自动转换为 WebP 格式

2. **CDN 加速**
   - 配置火山引擎 CDN
   - 使用 CDN 域名替代直接访问

3. **批量操作**
   - 批量上传接口
   - 批量删除接口

### 长期优化

1. **智能裁剪**
   - AI 识别主体
   - 自动裁剪头像

2. **水印功能**
   - 自动添加平台水印
   - 防盗链保护

3. **统计分析**
   - 资源访问统计
   - 热门资源分析

---

**集成完成时间**: 2026-03-01  
**SDK 版本**: ve-tos-golang-sdk v2.9.1  
**测试状态**: ✅ 编译通过
