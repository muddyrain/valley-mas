# Valley MAS API 文档

**日期**: 2026-03-01  
**版本**: v1.0  
**状态**: ✅ 在线可访问

---

## 🎯 快速访问

### Swagger UI（推荐）
```
http://localhost:8080/swagger/index.html
```

**特点**：
- ✅ 在线交互式测试
- ✅ 实时查看请求/响应
- ✅ 支持 JWT 认证
- ✅ 自动从代码生成，实时同步

---

## 📚 文档方案对比

| 方案 | 访问方式 | 优点 | 推荐场景 |
|------|----------|------|----------|
| **Swagger UI** | http://localhost:8080/swagger/index.html | 🔥 在线测试、UI美观 | ⭐⭐⭐⭐⭐ 开发调试 |
| JSON 文件 | server/docs/swagger.json | 可导入其他工具 | Postman/Apifox |
| YAML 文件 | server/docs/swagger.yaml | 标准格式 | CI/CD集成 |

---

## 🚀 使用步骤

### 1. 启动服务器
```bash
cd server
go run main.go
# 或使用 air 热重载
air
```

### 2. 访问 Swagger UI
在浏览器打开：
```
http://localhost:8080/swagger/index.html
```

### 3. 测试 API

#### 方式一：Swagger UI 在线测试
1. 点击需要测试的 API（如 `POST /api/v1/creator/register`）
2. 点击 **"Try it out"** 按钮
3. 填写请求参数（JSON）
4. 点击 **"Execute"** 执行请求
5. 查看响应结果

#### 方式二：使用 JWT 认证
1. 先调用登录接口获取 token
2. 点击页面右上角 **"Authorize"** 按钮
3. 输入：`Bearer {your_token}`
4. 点击 **"Authorize"** 确认
5. 现在所有需要认证的接口都会自动带上 token

---

## 📖 已集成的 API

### ✅ 公开接口（无需认证）

#### 1. 验证创作者口令
```http
POST /api/v1/code/verify
```

**请求示例**：
```json
{
  "code": "y2722"
}
```

**响应示例**：
```json
{
  "code": 200,
  "data": {
    "valid": true,
    "creator": {
      "id": "1234567890",
      "name": "设计师小王",
      "description": "分享精美头像和壁纸",
      "avatar": "https://example.com/avatar.jpg",
      "code": "y2722",
      "resourceCount": 25,
      "createdAt": "2026-03-01T12:00:00Z"
    }
  }
}
```

### 🔐 需要认证的接口

#### 2. 注册成为创作者
```http
POST /api/v1/creator/register
Authorization: Bearer {token}
```

**请求示例**：
```json
{
  "name": "设计师小王",
  "description": "分享精美头像和壁纸",
  "avatar": "https://example.com/avatar.jpg",
  "spaceTitle": "小王的创意空间",
  "spaceBanner": "https://example.com/banner.jpg",
  "spaceDescription": "这里有最新的设计作品"
}
```

**响应示例**：
```json
{
  "code": 200,
  "data": {
    "id": "1234567890",
    "name": "设计师小王",
    "code": "y2722",
    "description": "分享精美头像和壁纸",
    "isActive": true,
    "createdAt": "2026-03-01T12:00:00Z",
    "message": "注册成功！您的创作者口令是：y2722"
  }
}
```

**口令特点**：
- 5位小写字母+数字（如：y2722）
- 自动生成，全局唯一
- 永久有效（可手动开关）
- 去除易混淆字符（i/l/o/0/1）

---

## 🔧 开发指南

### 添加新 API 文档

1. **在 Handler 函数上方添加 Swagger 注释**：

```go
// CreateResource 创建资源
// @Summary      上传资源
// @Description  创作者上传新资源（头像/壁纸）
// @Tags         资源管理
// @Accept       multipart/form-data
// @Produce      json
// @Security     Bearer
// @Param        file  formData  file    true  "资源文件"
// @Param        type  formData  string  true  "资源类型" Enums(avatar, wallpaper)
// @Success      200  {object}  map[string]interface{}
// @Router       /resource/upload [post]
func CreateResource(c *gin.Context) {
    // 实现逻辑
}
```

2. **重新生成文档**：
```bash
cd server
swag init --exclude tmp,data
```

3. **刷新浏览器**即可看到新 API

### Swagger 注释说明

| 注释 | 说明 | 示例 |
|------|------|------|
| @Summary | 简短描述 | `注册成为创作者` |
| @Description | 详细说明 | `普通用户注册成为创作者，系统自动生成口令` |
| @Tags | 分组标签 | `创作者` / `资源管理` |
| @Accept | 请求格式 | `json` / `multipart/form-data` |
| @Produce | 响应格式 | `json` |
| @Security | 认证方式 | `Bearer` |
| @Param | 参数定义 | `request body RegisterRequest true` |
| @Success | 成功响应 | `200 {object} Response` |
| @Failure | 失败响应 | `400 {object} ErrorResponse` |
| @Router | 路由路径 | `/creator/register [post]` |

---

## 📊 Swagger 配置

### main.go 全局配置

```go
// @title           Valley MAS API
// @version         1.0
// @description     Valley MAS 创作者内容平台 API 文档
// @description     支持创作者注册、口令管理、资源上传下载等功能

// @contact.name   API Support
// @contact.email  support@valley-mas.com

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey Bearer
// @in header
// @name Authorization
// @description JWT 认证，格式：Bearer {token}
```

### 路由配置（router.go）

```go
import (
    swaggerFiles "github.com/swaggo/files"
    ginSwagger "github.com/swaggo/gin-swagger"
)

// Swagger 文档路由
r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
```

---

## 🎨 自定义 Swagger UI

### 修改主题颜色
在 `docs/docs.go` 中添加：
```go
// SwaggerInfo holds exported Swagger Info so clients can modify it
var SwaggerInfo = &swag.Spec{
    // ... 其他配置
    DeepLinking:  true,
    DocExpansion: "list",
}
```

### 生产环境隐藏文档
```go
if gin.Mode() == gin.ReleaseMode {
    // 生产环境不暴露 Swagger
} else {
    r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
}
```

---

## 🌐 导出到其他工具

### Postman
1. 下载 `server/docs/swagger.json`
2. Postman → Import → Upload Files
3. 选择 swagger.json 导入

### Apifox
1. 新建项目
2. 项目设置 → 导入数据 → OpenAPI
3. 上传 swagger.json 或填写 URL：
   ```
   http://localhost:8080/swagger/doc.json
   ```

### Redoc（更美观的展示）
安装 Redoc 中间件：
```bash
go get -u github.com/go-chi/httplog/redoc
```

添加路由：
```go
r.GET("/redoc", func(c *gin.Context) {
    c.HTML(200, "redoc.html", gin.H{
        "specUrl": "/swagger/doc.json",
    })
})
```

---

## 🔍 常见问题

### Q: 修改代码后文档没更新？
**A**: 需要重新生成文档：
```bash
swag init --exclude tmp,data
```

### Q: 如何测试需要认证的接口？
**A**: 
1. 先调用登录接口获取 token
2. 点击 Swagger UI 右上角 "Authorize" 按钮
3. 输入：`Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Q: 生产环境如何部署文档？
**A**: 三种方式：
1. **暴露在线文档**（推荐）：部署到 `https://api.yourdomain.com/swagger/`
2. **导出静态文件**：使用 swagger-ui-dist 打包
3. **第三方托管**：上传到 Swagger Hub / Apifox 云端

### Q: 如何自动同步到 API 管理平台？
**A**: 
```bash
# 生成 JSON 后自动推送到 Apifox
curl -X POST https://api.apifox.cn/v1/projects/{id}/import \
  -H "Authorization: Bearer {token}" \
  -F "file=@docs/swagger.json"
```

---

## 📝 待添加文档的 API

- [ ] GET /api/v1/creator/my-space - 获取我的创作者空间
- [ ] PUT /api/v1/creator/code/toggle - 开关口令
- [ ] POST /api/v1/creator/code/regenerate - 重新生成口令
- [ ] POST /api/v1/resource/upload - 上传资源
- [ ] GET /api/v1/creator/:code/resources - 获取创作者资源列表
- [ ] POST /api/v1/resource/download - 记录下载

### 添加步骤
1. 在对应 handler 函数添加 Swagger 注释
2. 运行 `swag init --exclude tmp,data`
3. 刷新 Swagger UI 即可看到

---

## 🎉 总结

✅ **Swagger UI 已集成**  
✅ **访问地址**: http://localhost:8080/swagger/index.html  
✅ **已文档化接口**: 2个（口令验证、创作者注册）  
✅ **支持在线测试和 JWT 认证**  

**下一步**：
1. 为其他 API 添加 Swagger 注释
2. 生成完整的接口文档
3. 导出到 Postman/Apifox 供团队使用

---

**文档更新时间**: 2026-03-01  
**维护者**: Valley MAS Team
