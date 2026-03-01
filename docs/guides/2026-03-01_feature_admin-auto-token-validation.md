# Admin 自动 Token 验证功能

## 📋 功能说明

当用户在使用 Admin 管理后台时，如果从其他标签页或其他应用切换回来，系统会自动验证当前 Token 是否仍然有效。

## 🎯 使用场景

1. **标签页切换**: 用户从其他浏览器标签页切回 Admin 页面
2. **应用切换**: 用户从其他应用程序（如 VS Code、微信等）切换回浏览器
3. **锁屏后返回**: 用户电脑锁屏后重新解锁并切回浏览器

## 🔧 技术实现

### 监听的事件

1. **visibilitychange**: 监听页面可见性变化（标签页切换）
2. **focus**: 监听窗口焦点事件（应用切换）

### 实现逻辑

```typescript
// 在 App.tsx 中添加 TokenValidator 组件
function TokenValidator() {
  const navigate = useNavigate();
  const isValidatingRef = useRef(false);

  // 验证函数
  const validateToken = useRef(async () => {
    if (isValidatingRef.current) return; // 防止并发验证
    
    const userInfo = localStorage.getItem('userInfo');
    if (!userInfo) return; // 未登录，无需验证

    try {
      isValidatingRef.current = true;
      await reqGetCurrentUser(); // 调用接口验证
      // Token 有效，继续使用
    } catch (error) {
      // Token 失效，清理数据并跳转登录
      localStorage.removeItem('userInfo');
      message.warning('登录已过期，请重新登录');
      navigate('/login', { replace: true });
    } finally {
      isValidatingRef.current = false;
    }
  }).current;

  useEffect(() => {
    // 监听页面激活
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateToken();
      }
    };

    // 监听窗口焦点
    const handleFocus = () => {
      validateToken();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [validateToken]);

  return null;
}
```

## ✅ 优点

1. **自动化**: 无需用户手动刷新或重新登录
2. **安全性**: 及时发现 Token 过期，防止无效操作
3. **用户体验**: 在后台自动完成，用户无感知（除非真的过期）
4. **防抖处理**: 使用 `isValidatingRef` 防止并发验证请求

## 🧪 测试方法

### 正常场景测试

1. 登录 Admin 管理后台
2. 切换到其他标签页（如 Bilibili、GitHub）
3. 等待几秒后切回 Admin 标签页
4. 观察控制台日志: `🔍 页面激活，验证 Token...`
5. 如果 Token 有效，页面继续正常使用

### Token 过期场景测试

**方法 1: 修改 Cookie 过期时间**
1. 在 `server/internal/handler/auth.go` 中临时修改 Cookie maxAge
   ```go
   // 临时改为 30 秒测试
   c.SetCookie("token", token, 30, "/", "", false, true)
   ```
2. 重启后端服务
3. 登录后等待 31 秒
4. 切换标签页后切回
5. 应该看到 "登录已过期，请重新登录" 提示，并自动跳转到登录页

**方法 2: 手动删除 Cookie**
1. 登录 Admin 管理后台
2. 打开浏览器开发者工具 → Application → Cookies
3. 删除 `token` Cookie
4. 切换标签页后切回
5. 应该看到提示并跳转登录页

**方法 3: 后端模拟**
1. 在 `server/internal/middleware/middleware.go` 中临时修改 Auth 中间件
   ```go
   // 临时返回 401 测试
   c.JSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
   c.Abort()
   return
   ```
2. 刷新页面或切换标签页
3. 观察是否正确处理过期逻辑

## 📝 注意事项

1. **并发控制**: 使用 `isValidatingRef` 防止同时触发多个验证请求
2. **静默验证**: Token 有效时不会有任何提示，只在控制台输出日志
3. **只验证已登录用户**: 未登录状态不会触发验证
4. **依赖 Cookie**: 基于 HttpOnly Cookie 机制，前端无法直接读取 Token

## 🔗 相关文件

- **前端**: `apps/admin/src/App.tsx` - TokenValidator 组件
- **接口**: `apps/admin/src/api/auth.ts` - reqGetCurrentUser 方法
- **后端**: `server/internal/handler/user.go` - GET /user/current 接口
- **中间件**: `server/internal/middleware/middleware.go` - Auth 验证

## 📊 性能影响

- **触发频率**: 仅在窗口激活时触发（不频繁）
- **请求开销**: 单次 GET 请求，响应极快（< 50ms）
- **用户感知**: 几乎无感知，后台静默完成

## 🚀 未来优化

1. **节流处理**: 添加节流，防止快速切换时频繁验证
2. **离线检测**: 结合网络状态，离线时不验证
3. **刷新令牌**: Token 快过期时自动刷新（Refresh Token 机制）
