# Cookie 过期时间修复说明

## 🐛 问题描述

Cookie Token 过期时间过短，实际只有 **2.8 分钟**，而不是预期的 **7 天**。

## 🔍 问题原因

### 错误代码

```go
// auth.go 登录函数
c.SetCookie(
    "token",
    token,
    int(cfg.JWT.Expire),  // ❌ 错误：传入 168（小时数）
    "/",
    "",
    false,
    true,
)
```

### 原因分析

1. **配置值**：`cfg.JWT.Expire = 24 * 7 = 168`（单位：小时）
2. **Cookie maxAge 参数**：单位是**秒**，不是小时
3. **实际效果**：Cookie 只存活 `168 秒 ≈ 2.8 分钟`

### 时间单位对比

| 位置 | 参数 | 单位 | 值 | 说明 |
|------|------|------|----|----|
| config.go | JWT.Expire | **小时** | 168 | 7天 = 24×7 小时 |
| jwt.go | expireHours | **小时** | 168 | 转换为 time.Hour × 168 |
| auth.go | Cookie maxAge | **秒** | ❌ 168 | **错误**：应该是 604800 秒 |

## ✅ 解决方案

### 修复代码

```go
// auth.go 登录函数
c.SetCookie(
    "token",
    token,
    int(cfg.JWT.Expire * 3600),  // ✅ 正确：168 小时 × 3600 = 604800 秒
    "/",
    "",
    false,
    true,
)
```

### 计算验证

```
JWT.Expire = 24 * 7 = 168 小时
Cookie maxAge = 168 * 3600 = 604800 秒
验证：604800 ÷ 3600 ÷ 24 = 7 天 ✅
```

## 📊 修复前后对比

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| **配置值** | 168 小时 | 168 小时 |
| **Cookie maxAge** | 168 秒 | 604800 秒 |
| **实际有效期** | ❌ 2.8 分钟 | ✅ 7 天 |
| **JWT Token 有效期** | ✅ 7 天（未受影响） | ✅ 7 天 |

## 🧪 测试方法

### 1. 清除旧 Cookie

```javascript
// 浏览器控制台
document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
```

### 2. 重新登录

访问 `http://localhost:5173/login` 并登录

### 3. 查看 Cookie 过期时间

**方法 1：浏览器 DevTools**
1. 打开 DevTools（F12）
2. 进入 Application → Cookies
3. 查看 `token` Cookie 的 `Expires / Max-Age`
4. 应该显示 **7 天后的日期**

**方法 2：控制台检查**
```javascript
// 浏览器控制台
document.cookie.split(';').forEach(c => console.log(c.trim()));
```

### 4. 验证过期时间

```javascript
// 计算过期时间（如果 Cookie 包含 expires 信息）
const cookieStr = document.cookie;
// 注意：HttpOnly Cookie 无法通过 JS 读取具体值
// 需要通过 DevTools Application 面板查看
```

### 5. 服务端日志验证

重启服务后，登录时查看生成的 Token：

```bash
# 在服务器日志中应该看到类似信息
Cookie 过期时间：604800 秒 (7 天)
```

## 🎯 相关文件

| 文件 | 作用 | 修改内容 |
|------|------|---------|
| `config/config.go` | JWT 配置 | 无需修改（已正确） |
| `utils/jwt.go` | JWT 生成 | 无需修改（已正确） |
| `handler/auth.go` | Cookie 设置 | ✅ 修改 maxAge 计算 |

## ⚠️ 注意事项

### 1. JWT Token 和 Cookie 过期时间应该一致

```go
// JWT Token 过期时间
time.Hour * time.Duration(cfg.JWT.Expire)  // 168 小时

// Cookie 过期时间
cfg.JWT.Expire * 3600  // 604800 秒 = 168 小时 ✅ 一致
```

### 2. 为什么不直接改配置？

**不推荐：**
```go
// config.go
JWT: JWTConfig{
    Secret: "...",
    Expire: 604800,  // ❌ 混淆：看起来像秒，但实际用作小时
}
```

**推荐（当前方案）：**
```go
// config.go
JWT: JWTConfig{
    Secret: "...",
    Expire: 24 * 7,  // ✅ 清晰：168 小时 = 7 天
}

// auth.go（使用时转换单位）
maxAge: int(cfg.JWT.Expire * 3600)  // ✅ 转换为秒
```

### 3. 生产环境配置

```go
c.SetCookie(
    "token",
    token,
    int(cfg.JWT.Expire * 3600),
    "/",
    ".your-domain.com",  // 跨子域共享
    true,                // secure: 仅 HTTPS ⚠️ 生产环境必须
    true,                // httpOnly
)
```

## 📝 总结

- ✅ **问题**：Cookie maxAge 单位混淆（秒 vs 小时）
- ✅ **修复**：添加 `* 3600` 转换为秒
- ✅ **验证**：604800 秒 = 7 天
- ✅ **影响**：仅 Cookie 过期时间，JWT Token 本身未受影响

## 🔗 相关文档

- [Go SetCookie 文档](https://pkg.go.dev/net/http#SetCookie)
- [MDN Cookie Max-Age](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [JWT 最佳实践](https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-token-best-practices)

---

修复完成时间：2026年3月1日
