# 📝 更新日志 - 2026年3月1日

## 🐛 [v1.1.1] Bug 修复 - 强制初始化问题

### 问题描述
多次执行 `/init-data?force=true` 时出现错误：
```json
{
  "code": 500,
  "message": "初始化数据失败：constraint failed: UNIQUE constraint failed: users.username (2067)"
}
```

### 问题原因
- `DELETE FROM users` 不会重置 SQLite 的自增序列
- 新插入的数据 ID 继续从之前的序列增长
- 可能导致唯一约束冲突

### 解决方案

**改动文件：** `server/internal/handler/init.go`

**修复内容：**
1. ✅ 使用事务确保原子性操作
2. ✅ 按正确顺序删除数据（避免外键约束）
   - upload_records → download_records → resources → creators → users
3. ✅ 重置 SQLite 自增序列
   - `DELETE FROM sqlite_sequence WHERE name IN (...)`
4. ✅ 添加详细错误处理和回滚机制
5. ✅ 验证清空成功后再继续创建

**修复后的代码逻辑：**
```go
// 使用事务
tx := database.DB.Begin()

// 按顺序删除
tx.Exec("DELETE FROM upload_records")
tx.Exec("DELETE FROM download_records")
tx.Exec("DELETE FROM resources")
tx.Exec("DELETE FROM creators")
tx.Exec("DELETE FROM users")

// 重置自增序列
tx.Exec("DELETE FROM sqlite_sequence WHERE name IN (...)")

// 提交事务
tx.Commit()
```

### 测试验证

新增测试脚本：`test-force-init.ps1`

测试内容：
- ✅ 第一次普通初始化
- ✅ 第二次普通初始化（应提示数据已存在）
- ✅ 强制初始化
- ✅ 再次强制初始化（验证可重复执行）
- ✅ 用户登录验证

运行测试：
```powershell
.\test-force-init.ps1
```

### 影响范围
- **影响功能：** 数据初始化接口
- **影响文件：** `server/internal/handler/init.go`
- **向后兼容：** ✅ 完全兼容，无需修改现有代码

---

## ✨ [v1.1.0] 功能优化

### 1. 数据初始化优化

**功能：** `/init-data` 接口支持强制重新初始化

**改动文件：**
- `server/internal/handler/init.go`

**使用方式：**
```bash
# 普通初始化（数据存在则跳过）
curl http://localhost:8080/init-data

# 强制重新初始化（清空现有数据）
curl http://localhost:8080/init-data?force=true
```

**新增功能：**
- ✅ 检测 `force=true` 参数
- ✅ 强制模式下清空所有表数据
- ✅ 返回清理和创建的记录数
- ✅ 友好的提示信息

**响应示例：**
```json
{
  "message": "强制重新初始化成功",
  "clearedUsers": 5,
  "createdUsers": 5,
  "users": [...]
}
```

---

### 2. 前端错误提示优化

**功能：** 完善全局错误处理，确保所有错误都有明确提示

**改动文件：**
- `apps/admin/src/utils/request.ts`

**优化内容：**

#### 2.1 后端错误信息优先显示
```typescript
// 优先使用后端返回的错误信息
if (responseData?.message) {
  msg = responseData.message;
}
```

#### 2.2 完善 HTTP 状态码处理
| 状态码 | 提示信息 | 行为 |
|--------|---------|------|
| 401 | 认证失败，请重新登录 | 清除 token，跳转登录 |
| 403 | 您没有权限执行此操作 | 显示提示 |
| 404 | 请求的资源不存在 | 显示提示 |
| 500 | 服务器内部错误 | 显示提示 |
| 502 | 网关错误 | 显示提示 |
| 503 | 服务暂时不可用 | 显示提示 |

#### 2.3 网络错误处理
```typescript
// 请求超时
if (error.code === 'ECONNABORTED') {
  msg = '请求超时，请检查网络连接';
}
// 网络断开
else if (error.code === 'ERR_NETWORK') {
  msg = '网络连接失败，请检查网络';
}
// 其他网络错误
else {
  msg = '网络请求失败，请稍后重试';
}
```

#### 2.4 错误日志输出
```typescript
console.error('API Error:', error);
```

**优化效果：**
- ✅ 所有错误都有明确提示
- ✅ 区分业务错误、HTTP错误、网络错误
- ✅ 401 自动跳转登录
- ✅ 控制台输出详细日志
- ✅ 方便开发调试

---

## 📊 影响范围

### 后端
- `server/internal/handler/init.go` - 初始化数据接口

### 前端
- `apps/admin/src/utils/request.ts` - HTTP 请求拦截器

### 文档
- `docs/OPTIMIZATION_GUIDE.md` - 优化指南（新增）
- `REFERENCE_CARD.md` - 快速参考卡片（新增）
- `test-auth.ps1` - 测试脚本（更新）

---

## 🧪 测试验证

### 1. 测试数据初始化

```bash
# 测试普通初始化
curl http://localhost:8080/init-data

# 测试强制初始化
curl http://localhost:8080/init-data?force=true
```

**期望结果：**
- ✅ 普通初始化：数据存在时提示并返回用户数
- ✅ 强制初始化：清空数据并重新创建

---

### 2. 测试错误提示

#### 测试场景 A：用户名密码错误
**操作：** 输入错误密码登录

**期望：**
- ✅ 显示："用户名或密码错误"
- ✅ 控制台输出错误日志

#### 测试场景 B：后端未启动
**操作：** 停止后端服务后尝试登录

**期望：**
- ✅ 显示："网络连接失败，请检查网络"
- ✅ 控制台输出网络错误

#### 测试场景 C：Token 过期
**操作：** 使用过期 token 访问接口

**期望：**
- ✅ 显示："认证失败，请重新登录"
- ✅ 自动清除 token
- ✅ 自动跳转登录页

---

### 3. 运行自动化测试

```powershell
.\test-auth.ps1
```

**期望输出：**
```
=== Valley 登录认证系统测试 ===
✅ 服务正常运行
✅ 强制重新初始化成功
✅ 登录成功！
✅ 正确返回 401 未授权
✅ 成功获取用户列表
✅ 成功获取当前用户信息
=== 测试完成 ===
```

---

## 🎯 使用示例

### 场景 1：开发时需要重置数据

```bash
# 方式 1：使用 force 参数（推荐）
curl http://localhost:8080/init-data?force=true

# 方式 2：删除数据库
rm server/data/valley.db
air  # 重启服务
curl http://localhost:8080/init-data
```

---

### 场景 2：调试登录问题

```javascript
// 1. 打开浏览器控制台（F12）

// 2. 尝试登录，查看错误
// 会显示：API Error: AxiosError {...}

// 3. 查看错误详情
// error.response.status - HTTP 状态码
// error.response.data - 后端响应数据
// error.message - 错误信息

// 4. 检查 token
localStorage.getItem('token')

// 5. 清理重试
localStorage.clear()
```

---

### 场景 3：前端看不到错误提示

**检查清单：**
1. ✅ 确认浏览器控制台有 `API Error:` 日志
2. ✅ 确认右下角有 Ant Design message 提示
3. ✅ 确认 `request.ts` 文件已更新
4. ✅ 刷新页面重试

**临时调试：**
```typescript
// 在登录函数的 catch 中添加
catch (error) {
  console.log('完整错误:', error)
  console.log('响应数据:', error.response?.data)
  console.log('状态码:', error.response?.status)
}
```

---

## 🔄 升级步骤

如果你是从旧版本升级，请按以下步骤操作：

### 1. 更新代码
```bash
git pull origin master
```

### 2. 重新安装依赖（前端）
```bash
cd apps/admin
pnpm install
```

### 3. 重新编译（后端）
```bash
cd server
go build -o tmp/main.exe .
```

### 4. 重置数据（可选）
```bash
curl http://localhost:8080/init-data?force=true
```

### 5. 重启服务
```bash
# 后端
cd server && air

# 前端
cd apps/admin && pnpm dev
```

---

## 📚 相关文档

- **优化详解：** [docs/OPTIMIZATION_GUIDE.md](docs/OPTIMIZATION_GUIDE.md)
- **快速参考：** [REFERENCE_CARD.md](REFERENCE_CARD.md)
- **认证系统：** [docs/AUTH_SYSTEM.md](docs/AUTH_SYSTEM.md)
- **快速启动：** [QUICK_START.md](QUICK_START.md)

---

## 🐛 已知问题

**无**

---

## 🎉 下个版本计划

- [ ] 添加"记住我"功能
- [ ] 添加刷新 token 机制
- [ ] 添加修改密码功能
- [ ] 完善创作者管理
- [ ] 完善资源管理

---

## 👥 贡献者

- @muddyrain

---

## 📞 反馈

如有问题或建议，请提交 Issue 或 Pull Request。

---

**版本：** v1.1.0  
**日期：** 2026年3月1日  
**状态：** ✅ 稳定
