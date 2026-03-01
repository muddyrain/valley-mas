# 认证方式迁移：从 localStorage 到 HttpOnly Cookie

## 迁移时间
2026年3月1日

## 迁移原因

将 Token 从 localStorage 迁移到 HttpOnly Cookie，提升安全性：

### 安全性对比

| 存储方式 | XSS 攻击风险 | JavaScript 访问 | 自动发送 | 安全性 |
|---------|------------|---------------|---------|--------|
| **localStorage** | ❌ 高风险 | ✅ 可访问 | ❌ 需手动 | ⚠️ 低 |
| **HttpOnly Cookie** | ✅ 防护 | ❌ 不可访问 | ✅ 自动 | ✅ 高 |

### 主要优势

1. **防止 XSS 攻击**：HttpOnly Cookie 无法被 JavaScript 访问，即使网站存在 XSS 漏洞，攻击者也无法窃取 Token
2. **自动发送**：浏览器自动携带 Cookie，无需前端手动处理
3. **行业标准**：飞书、钉钉等主流应用都使用 Cookie 存储认证信息

## 改动内容

### 后端改动 (Go/Gin)

#### 1. **auth.go - 登录接口**
```go
// 设置 HttpOnly Cookie
c.SetCookie(
    "token",              // name
    token,                // value
    int(cfg.JWT.Expire),  // maxAge (秒)
    "/",                  // path
    "",                   // domain
    false,                // secure (生产环境应为 true)
    true,                 // httpOnly (防止 JavaScript 访问)
)

// 响应中不再返回 token，只返回 userInfo
Success(c, gin.H{
    "userInfo": gin.H{...},
})
```

#### 2. **auth.go - 新增登出接口**
```go
func Logout() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 清除 Cookie (maxAge 设为 -1)
        c.SetCookie("token", "", -1, "/", "", false, true)
        Success(c, gin.H{"message": "登出成功"})
    }
}
```

#### 3. **middleware.go - 认证中间件**
```go
// 优先从 Cookie 获取 token
token, err := c.Cookie("token")
if err != nil || token == "" {
    // 兼容旧方式：从 Authorization header 获取
    authHeader := c.GetHeader("Authorization")
    if authHeader != "" {
        token = strings.TrimPrefix(authHeader, "Bearer ")
    }
}
```

#### 4. **middleware.go - CORS 配置**
```go
// 允许携带 Cookie (关键配置)
c.Header("Access-Control-Allow-Credentials", "true")
// Origin 不能为 * (配合 Credentials 使用)
c.Header("Access-Control-Allow-Origin", origin)
```

#### 5. **router.go - 新增路由**
```go
auth.POST("/logout", handler.Logout())
```

### 前端改动 (React/TypeScript)

#### 1. **request.ts - Axios 配置**
```typescript
const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 10000,
  withCredentials: true, // 允许携带 Cookie (关键配置)
});
```

#### 2. **request.ts - 请求拦截器**
```typescript
// 移除手动添加 Authorization header 的代码
// Token 现在通过 Cookie 自动发送
http.interceptors.request.use(
  (config) => {
    // 无需手动设置 token
    return config;
  },
  (error) => Promise.reject(error)
);
```

#### 3. **Login.tsx - 登录处理**
```typescript
const res = await reqLogin(values);

// 不再保存 token (已在 Cookie 中)
// 只保存 userInfo 用于前端显示
localStorage.setItem('userInfo', JSON.stringify(res.userInfo));
```

#### 4. **App.tsx - 路由守卫**
```typescript
function PrivateRoute({ children }: { children: React.ReactNode }) {
  // 通过 userInfo 判断登录状态
  // (Cookie 中的 token 无法通过 JavaScript 访问)
  const userInfo = localStorage.getItem('userInfo');
  return userInfo ? <>{children}</> : <Navigate to="/login" replace />;
}
```

#### 5. **Layout.tsx - 退出登录**
```typescript
const handleLogout = async () => {
  try {
    // 调用后端接口清除 Cookie
    await http.post('/logout');
    
    // 清除本地用户信息
    localStorage.removeItem('userInfo');
    
    message.success('已退出登录');
    navigate('/login');
  } catch (error) {
    // 即使接口失败也清除本地数据
    localStorage.removeItem('userInfo');
    navigate('/login');
  }
};
```

#### 6. **auth.ts - API 类型**
```typescript
// 登录响应不再包含 token
export interface LoginResponse {
  userInfo: {
    id: number;
    username: string;
    nickname: string;
    avatar: string;
    role: string;
    email?: string;
    phone?: string;
  };
}
```

## 兼容性说明

- **向后兼容**：中间件仍支持从 `Authorization` header 读取 token（兼容旧客户端或 API 调用）
- **渐进迁移**：新用户自动使用 Cookie，旧用户下次登录后自动切换

## 测试步骤

1. **清除旧数据**
   ```javascript
   // 浏览器控制台执行
   localStorage.clear();
   ```

2. **重新登录**
   - 访问 `http://localhost:5173/login`
   - 输入账号密码登录
   - 检查浏览器 DevTools → Application → Cookies
   - 应该看到 `token` Cookie (HttpOnly)

3. **验证功能**
   - ✅ 登录成功后可访问后台页面
   - ✅ 刷新页面保持登录状态
   - ✅ 退出登录清除 Cookie
   - ✅ 401 错误自动跳转登录页

4. **安全性验证**
   ```javascript
   // 浏览器控制台执行（应该无法读取）
   document.cookie; // 看不到 token (HttpOnly 保护)
   ```

## 生产环境注意事项

### 1. **启用 HTTPS + Secure Cookie**

修改 `auth.go`：
```go
c.SetCookie(
    "token",
    token,
    int(cfg.JWT.Expire),
    "/",
    "",
    true,  // secure: true (仅 HTTPS)
    true,  // httpOnly: true
)
```

### 2. **配置正确的 CORS Origin**

修改 `middleware.go`：
```go
func Cors() gin.HandlerFunc {
    return func(c *gin.Context) {
        origin := c.GetHeader("Origin")
        // 生产环境：只允许特定域名
        allowedOrigins := []string{
            "https://your-domain.com",
            "https://admin.your-domain.com",
        }
        
        for _, allowed := range allowedOrigins {
            if origin == allowed {
                c.Header("Access-Control-Allow-Origin", origin)
                break
            }
        }
        
        c.Header("Access-Control-Allow-Credentials", "true")
        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
        
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }
        c.Next()
    }
}
```

### 3. **设置 Cookie Domain**

如果前后端域名不同（如 `api.example.com` 和 `admin.example.com`）：
```go
c.SetCookie(
    "token",
    token,
    int(cfg.JWT.Expire),
    "/",
    ".example.com", // 设置为顶级域名
    true,
    true,
)
```

### 4. **添加 CSRF 保护**

HttpOnly Cookie 防止 XSS，但不防 CSRF，建议添加 CSRF Token：
```go
// 可选：使用 gin-contrib/csrf 中间件
import "github.com/gin-contrib/csrf"

r.Use(csrf.Middleware(csrf.Options{
    Secret: "your-csrf-secret",
    ErrorFunc: func(c *gin.Context) {
        c.JSON(403, gin.H{"error": "CSRF token mismatch"})
        c.Abort()
    },
}))
```

## 回滚方案

如果需要回滚到 localStorage 方式：

1. 恢复 `auth.go` 返回 token
2. 恢复 `request.ts` 的 Authorization header 设置
3. 恢复 `Login.tsx` 保存 token 到 localStorage
4. 恢复 `App.tsx` 通过 token 判断登录状态

## 参考资料

- [OWASP - HttpOnly Cookie](https://owasp.org/www-community/HttpOnly)
- [MDN - Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [Axios - withCredentials](https://axios-http.com/docs/req_config)

## 总结

✅ **安全性提升**：防止 XSS 攻击窃取 Token  
✅ **用户体验**：自动携带认证信息，无需手动处理  
✅ **行业标准**：与飞书、钉钉等主流应用一致  
✅ **代码简化**：前端无需管理 Token 生命周期
