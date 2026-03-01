# 🎯 快速参考卡片

## 常用命令

### 启动服务
```bash
# 后端（热重载）
cd server && air

# 前端
cd apps/admin && pnpm dev
```

### 数据初始化
```bash
# 普通初始化（数据存在则跳过）
curl http://localhost:8080/init-data

# 强制重新初始化（清空所有数据）⚠️
curl http://localhost:8080/init-data?force=true
```

### 测试登录
```bash
curl -X POST http://localhost:8080/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| creator | creator123 | 创作者 |

---

## 访问地址

- 前端：http://localhost:5173
- 后端：http://localhost:8080
- 登录页：http://localhost:5173/login
- 初始化：http://localhost:8080/init-data

---

## 错误处理

### 查看错误
1. 打开浏览器 F12
2. 查看 Console 标签
3. 查找 `API Error:` 日志

### 清理缓存
```javascript
localStorage.clear()
```

### 重置数据
```bash
rm server/data/valley.db
curl http://localhost:8080/init-data
```

---

## 常见问题

| 问题 | 解决方案 |
|------|---------|
| 网络连接失败 | 检查后端是否启动 |
| 数据已存在 | 使用 `?force=true` |
| 登录失败 | 确认密码 admin123 |
| 401 错误 | Token 过期，重新登录 |
| 403 错误 | 权限不足 |

---

## 调试技巧

### 检查 Token
```javascript
localStorage.getItem('token')
```

### 查看用户信息
```javascript
JSON.parse(localStorage.getItem('userInfo'))
```

### 测试 API
```bash
# 带 token 的请求
curl http://localhost:8080/api/v1/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 文档链接

- 📖 [优化指南](docs/OPTIMIZATION_GUIDE.md)
- 🔐 [认证系统](docs/AUTH_SYSTEM.md)
- 🚀 [快速启动](QUICK_START.md)
- 📝 [开发指南](DEV_GUIDE.md)

---

**快速开发，高效调试！** 🎉
