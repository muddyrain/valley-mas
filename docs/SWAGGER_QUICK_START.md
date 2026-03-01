# Valley MAS API 文档访问指南

## 🎯 快速开始

### 1. 启动服务器
```powershell
cd server
air
```
服务器会在 `http://localhost:8080` 启动

### 2. 访问 Swagger UI
在浏览器打开：
```
http://localhost:8080/swagger/index.html
```

---

## 📖 在线文档界面

### Swagger UI 功能
- **API 列表**：左侧展示所有接口
- **详细说明**：点击展开查看参数、响应
- **在线测试**：点击 "Try it out" 直接测试
- **JWT 认证**：右上角 "Authorize" 输入 token

### 当前已文档化的接口

#### 🌐 公开接口
- `POST /api/v1/code/verify` - 验证创作者口令

#### 🔐 需要认证
- `POST /api/v1/creator/register` - 注册成为创作者

---

## 🔧 测试流程

### 测试口令验证（无需登录）
1. 展开 `POST /api/v1/code/verify`
2. 点击 **"Try it out"**
3. 修改请求体：
```json
{
  "code": "y2722"
}
```
4. 点击 **"Execute"**
5. 查看响应（200 = 成功，404 = 口令不存在）

### 测试创作者注册（需要登录）
1. 先获取 JWT token（调用登录接口或手动生成）
2. 点击右上角 **"Authorize"** 🔓 按钮
3. 输入：`Bearer {your_token_here}`
4. 点击 **"Authorize"** 确认
5. 展开 `POST /api/v1/creator/register`
6. 点击 **"Try it out"**
7. 填写创作者信息
8. 点击 **"Execute"**
9. 查看生成的口令（如：y2722）

---

## 📊 文档生成命令

### 更新文档
```powershell
cd server
swag init --exclude tmp,data
```

### 验证生成结果
```powershell
# 检查生成的文件
dir docs
# 应该看到：
# - docs.go
# - swagger.json
# - swagger.yaml
```

---

## 🌟 特色功能

### 1. 实时同步
- 修改代码 → 运行 `swag init` → 刷新页面
- 代码即文档，永不过期

### 2. 交互式测试
- 无需 Postman，直接在浏览器测试
- 实时查看请求和响应
- 支持文件上传、表单等

### 3. 多格式导出
- **swagger.json**: 导入 Postman/Apifox
- **swagger.yaml**: CI/CD 集成
- **在线 URL**: 分享给团队

---

## 📱 移动端访问

Swagger UI 是响应式的，可以在手机浏览器访问：
```
http://你的IP:8080/swagger/index.html
```

---

## 🚀 下一步

1. **为所有 API 添加文档**
   - 复制现有的注释格式
   - 每个 handler 函数上方添加 `@Summary`、`@Router` 等

2. **导出到团队工具**
   - Postman: 导入 `docs/swagger.json`
   - Apifox: 在线导入 `http://localhost:8080/swagger/doc.json`

3. **生产环境部署**
   - 部署到 `https://api.valley-mas.com/swagger/`
   - 团队随时查看最新文档

---

**访问链接**: http://localhost:8080/swagger/index.html  
**更新日期**: 2026-03-01
