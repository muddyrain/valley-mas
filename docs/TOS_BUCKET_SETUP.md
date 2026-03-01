# 火山引擎 TOS Bucket 创建指南

## 📦 创建 Bucket

### 1. 访问控制台

**地址**：https://console.volcengine.com/tos/bucket

### 2. 创建 Bucket

点击「创建 Bucket」按钮，填写以下信息：

#### 基本信息
- **Bucket 名称**：`valley-resources`
  - ⚠️ 全局唯一，如果被占用请改名
  - 建议格式：`valley-{你的用户名}-resources`
  - 只能包含小写字母、数字、短横线
  - 长度 3-63 字符

- **地域**：`华北2（北京）cn-beijing`
  - 需要与 .env 中的 TOS_REGION 一致

#### 访问权限设置（重要！）
- **访问权限**：选择「**公共读**」（Public Read）
  - 私有：❌ 无法公开访问图片
  - 公共读：✅ 可以直接通过 URL 访问
  - 公共读写：❌ 不安全，不推荐

#### 其他设置
- **存储类型**：标准存储（Standard）
- **版本控制**：不启用（默认）
- **日志记录**：不启用（可选）

### 3. 确认创建

点击「确定」完成创建。

---

## 🔧 如果 Bucket 名称被占用

### 方法 1：使用唯一后缀

```bash
valley-mas-2024
valley-{你的用户名}
valley-{随机字符串}
```

### 方法 2：使用工具生成

在终端运行：
```bash
# 生成随机 Bucket 名称
echo "valley-$(date +%s)"
# 输出示例：valley-1709308800
```

### 修改配置

创建完成后，修改 `server/.env`：

```bash
# 如果使用了不同的名称
TOS_BUCKET=你的实际bucket名称

# 如果选择了不同的地域
TOS_REGION=你的地域代码
TOS_ENDPOINT=tos-{region}.volces.com
```

**地域代码对照表**：
| 地域 | Region 代码 | Endpoint |
|------|-------------|----------|
| 华北2（北京） | cn-beijing | tos-cn-beijing.volces.com |
| 华东2（上海） | cn-shanghai | tos-cn-shanghai.volces.com |
| 华南1（广州） | cn-guangzhou | tos-cn-guangzhou.volces.com |

---

## ✅ 验证 Bucket 创建成功

### 方法 1：在控制台查看

1. 访问 https://console.volcengine.com/tos/bucket
2. 应该能看到刚创建的 Bucket
3. 点击进入，查看「权限管理」→「访问权限」
4. 确认显示为「公共读」

### 方法 2：使用 API 测试

重启服务器后，查看日志：

```bash
cd server
air
```

应该看到：
```
✅ TOS (Volcano Engine Object Storage) initialized
```

如果看到警告：
```
⚠️  TOS initialization failed: ...
```

说明配置有问题。

---

## 🔒 设置 Bucket 权限（重要！）

如果创建时忘记设置公共读，可以后续修改：

### 步骤 1：进入 Bucket 管理

1. 访问 https://console.volcengine.com/tos/bucket
2. 点击你的 Bucket 名称

### 步骤 2：修改访问权限

1. 左侧菜单点击「权限管理」
2. 点击「访问权限」标签
3. 修改为「公共读」
4. 点击「保存」

### 步骤 3：配置 Bucket Policy（可选）

如果需要更细粒度的控制，可以配置 Bucket Policy：

```json
{
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["tos:GetObject"],
      "Resource": ["trn:tos:::valley-resources/*"]
    }
  ]
}
```

**注意**：将 `valley-resources` 替换为你的实际 Bucket 名称。

---

## 🧪 测试上传

### 1. 重启服务器

```bash
cd server
air
```

### 2. 使用 Swagger UI 测试

1. 访问：http://localhost:8080/swagger/index.html
2. 登录获取管理员 Token
3. 点击右上角「Authorize」
4. 输入：`Bearer {token}`
5. 找到 `POST /admin/resources/upload`
6. 上传测试图片

### 3. 检查结果

成功响应示例：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "2028025683447386112",
    "url": "https://valley-resources.tos-cn-beijing.volces.com/avatars/1234567890_abc123.png"
  }
}
```

复制 URL 在浏览器中打开，应该能看到图片。

---

## ❌ 常见错误

### 错误 1：Bucket 不存在
```
The specified bucket does not exist
```
**解决**：创建 Bucket 或修改配置

### 错误 2：无权限访问
```
Access Denied
```
**解决**：
1. 检查 AK/SK 是否正确
2. 检查 AK 是否有 TOS 权限

### 错误 3：图片无法访问
```
403 Forbidden
```
**解决**：设置 Bucket 为「公共读」

### 错误 4：地域不匹配
```
The bucket you are attempting to access must be addressed using the specified endpoint
```
**解决**：检查 TOS_REGION 和 TOS_ENDPOINT 是否匹配

---

## 📞 需要帮助？

如果遇到问题：

1. **查看服务器日志**
   ```bash
   # 查看完整错误信息
   tail -f server/tmp/build-errors.log
   ```

2. **检查配置**
   ```bash
   cat server/.env | grep TOS
   ```

3. **火山引擎文档**
   - TOS 快速入门：https://www.volcengine.com/docs/6349/74820
   - API 文档：https://www.volcengine.com/docs/6349/74821

---

**创建日期**：2026-03-01  
**问题**：Bucket 不存在  
**解决**：按本指南创建 Bucket 并设置公共读权限
