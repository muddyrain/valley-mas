# 🎯 新手必读 - 3分钟上手指南

## 🚀 三步启动

### Step 1: 启动后端 (30秒)
```bash
cd server
air
```
等待看到：`🚀 Server starting on port 8080`

---

### Step 2: 初始化数据 (10秒)
```bash
curl http://localhost:8080/init-data
```

**默认账号自动创建：**
- 管理员：`admin` / `admin123` ✅

---

### Step 3: 启动前端 (30秒)
```bash
cd apps/admin
pnpm dev
```
访问：http://localhost:5173/login

---

## ✅ 完成！

现在你可以：
1. 用 `admin` / `admin123` 登录
2. 查看用户列表
3. 开始开发

---

## 🔥 常用操作

### 重置数据
```bash
curl http://localhost:8080/init-data?force=true
```

### 测试系统
```powershell
.\test-auth.ps1
```

### 查看错误
- 浏览器按 `F12`
- 查看 Console 标签
- 找 `API Error:` 日志

---

## 📚 需要帮助？

- **快速参考：** [REFERENCE_CARD.md](REFERENCE_CARD.md)
- **完整文档：** [docs/OPTIMIZATION_GUIDE.md](docs/OPTIMIZATION_GUIDE.md)
- **常见问题：** [docs/OPTIMIZATION_GUIDE.md#常见问题](docs/OPTIMIZATION_GUIDE.md#常见问题)

---

**就这么简单！开始开发吧！** 🎊
