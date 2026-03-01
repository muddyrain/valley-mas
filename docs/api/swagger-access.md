# 🎯 Swagger 文档访问指南

**服务器已启动**: ✅ http://localhost:8080  
**日期**: 2026-03-01

---

## 📚 Swagger 访问地址

### 🌟 主要访问方式（推荐）

```
http://localhost:8080/swagger/index.html
```

**复制这个地址到浏览器打开** 👆

---

## 🔗 其他相关地址

### 1. Swagger JSON 文档
```
http://localhost:8080/swagger/doc.json
```
用途：导入到 Postman/Apifox

### 2. API 健康检查
```
http://localhost:8080/health
```
返回：`{"status":"ok"}`

### 3. 首页
```
http://localhost:8080/
```
显示欢迎页面

### 4. 初始化测试数据（开发用）
```
http://localhost:8080/init-data
```

---

## 🎨 Swagger UI 界面说明

访问 `http://localhost:8080/swagger/index.html` 后您会看到：

```
┌─────────────────────────────────────────────────────┐
│  Valley MAS API v1.0                    [Authorize] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📖 Valley MAS 创作者内容平台 API 文档               │
│                                                     │
│  ▼ 公开接口                                         │
│    POST /api/v1/code/verify                        │
│         验证创作者口令                              │
│                                                     │
│  ▼ 创作者                                           │
│    POST /api/v1/creator/register                   │
│         注册成为创作者                              │
│                                                     │
│  [Try it out] 按钮                                  │
│  [Execute] 执行测试                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 界面元素说明

| 元素 | 说明 |
|------|------|
| **Authorize** 🔓 | 右上角，输入 JWT Token |
| **Try it out** | 点击后可编辑参数 |
| **Execute** | 执行 API 请求 |
| **▼ 标签** | 点击展开/折叠 API 组 |
| **Responses** | 查看响应示例和结构 |
| **Model** | 查看数据模型定义 |

---

## 🧪 快速测试示例

### 测试 1: 验证口令（无需登录）

1. 打开 http://localhost:8080/swagger/index.html
2. 找到 `POST /api/v1/code/verify`
3. 点击 **"Try it out"**
4. 修改请求体：
```json
{
  "code": "y2722"
}
```
5. 点击 **"Execute"**
6. 查看响应结果

**预期响应**（404 - 口令不存在）：
```json
{
  "code": 404,
  "message": "口令不存在或已关闭"
}
```

### 测试 2: 注册创作者（需要登录）

1. 先获取 JWT Token（调用登录接口）
2. 点击右上角 **"Authorize"** 🔓 按钮
3. 输入：`Bearer {your_token}`
4. 点击 **"Authorize"** 确认
5. 找到 `POST /api/v1/creator/register`
6. 点击 **"Try it out"**
7. 填写创作者信息：
```json
{
  "name": "测试创作者",
  "description": "这是一个测试账号",
  "avatar": "https://example.com/avatar.jpg"
}
```
8. 点击 **"Execute"**
9. 查看生成的口令（如：y2722）

---

## 📱 移动设备访问

如果您想在手机上查看文档：

1. **查看电脑 IP**：
```powershell
ipconfig
# 找到 IPv4 地址，如：192.168.1.100
```

2. **手机浏览器访问**：
```
http://192.168.1.100:8080/swagger/index.html
```

⚠️ 注意：电脑和手机需在同一局域网

---

## 🛠️ 常见问题

### Q1: 打不开 Swagger UI？
**检查清单**：
- ✅ 服务器是否启动？运行 `go run main.go`
- ✅ 端口是否被占用？检查 8080 端口
- ✅ 浏览器地址是否正确？`/swagger/index.html`（不是 `/swagger/`）
- ✅ 防火墙是否拦截？临时关闭试试

### Q2: 页面显示空白？
**解决方法**：
```bash
# 重新生成文档
cd server
swag init --exclude tmp,data

# 重启服务器
go run main.go
```

### Q3: API 测试返回 401？
**原因**: 接口需要认证

**解决**：
1. 先调用登录接口获取 token
2. 点击 "Authorize" 按钮
3. 输入：`Bearer eyJhbGciOiJI...`（完整 token）

### Q4: 看不到我新加的 API？
**原因**: 没有重新生成文档

**解决**：
```bash
swag init --exclude tmp,data
# 刷新浏览器（Ctrl+F5 强制刷新）
```

---

## 📦 导出到其他工具

### 导出到 Postman

1. 浏览器访问：
```
http://localhost:8080/swagger/doc.json
```

2. 复制 JSON 内容（Ctrl+A, Ctrl+C）

3. Postman → Import → Raw text → 粘贴 → Import

### 导出到 Apifox

1. Apifox → 导入数据 → URL 导入

2. 输入地址：
```
http://localhost:8080/swagger/doc.json
```

3. 点击"导入"

---

## 🎓 Swagger 注释示例

如果您想为更多 API 添加文档，参考以下格式：

```go
// GetMyCreatorSpace 获取我的创作者空间
// @Summary      获取创作者空间信息
// @Description  返回当前登录用户的创作者空间详情
// @Tags         创作者
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Success      200  {object}  map[string]interface{}  "成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      404  {object}  map[string]interface{}  "不是创作者"
// @Router       /creator/my-space [get]
func GetMyCreatorSpace(c *gin.Context) {
    // 实现代码...
}
```

添加注释后运行：
```bash
swag init --exclude tmp,data
```

---

## 🌐 生产环境部署

### 方式 1: 保持开放（推荐）
部署到公网后，Swagger 会在：
```
https://api.yourdomain.com/swagger/index.html
```

### 方式 2: 仅开发环境开放
```go
// router.go
if gin.Mode() != gin.ReleaseMode {
    r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
}
```

生产环境运行：
```bash
export GIN_MODE=release
go run main.go
```

### 方式 3: 密码保护
```go
authorized := r.Group("/swagger")
authorized.Use(gin.BasicAuth(gin.Accounts{
    "admin": "your-password",
}))
authorized.GET("/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
```

---

## 📊 已文档化的 API

| 接口 | 方法 | 路径 | 认证 | 状态 |
|------|------|------|------|------|
| 验证口令 | POST | /api/v1/code/verify | 无 | ✅ |
| 注册创作者 | POST | /api/v1/creator/register | 需要 | ✅ |

### 待文档化的 API（优先级）
- [ ] GET /api/v1/creator/my-space - 获取我的空间
- [ ] PUT /api/v1/creator/code/toggle - 开关口令
- [ ] POST /api/v1/creator/code/regenerate - 重新生成口令

---

## 🎉 快速访问卡片

```
┌────────────────────────────────────────┐
│  🌟 Valley MAS API 文档                │
├────────────────────────────────────────┤
│                                        │
│  主要地址（在浏览器打开）：             │
│                                        │
│  http://localhost:8080/swagger/index.html
│                                        │
│  服务器状态：✅ 运行中（端口 8080）     │
│  API 数量：30+ 个接口                  │
│  已文档化：2 个核心接口                │
│                                        │
└────────────────────────────────────────┘
```

---

## 🔥 现在就试试！

1. **复制这个地址**：
```
http://localhost:8080/swagger/index.html
```

2. **粘贴到浏览器地址栏**

3. **按回车键打开**

4. **开始探索 API 文档！** 🚀

---

**最后更新**: 2026-03-01  
**维护者**: Valley MAS Team  
**服务器状态**: ✅ 运行中
