# 口令系统设计文档

> 创建时间：2026-03-01  
> 版本：v1.0  
> 状态：✅ 已完成

---

## 🎯 设计目标

### 核心需求
1. ✅ **短小易记** - 4位口令，方便用户输入和分享
2. ✅ **永久有效** - 口令不会过期
3. ✅ **可控开关** - 创作者可以随时关闭/开启口令
4. ✅ **易读易输** - 去除易混淆字符（I/O/0/1）

---

## 📝 口令格式设计

### 字符集
```
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

**去除的易混淆字符**：
- `I` (大写i) - 与 `1`(数字一) 容易混淆
- `O` (大写o) - 与 `0`(数字零) 容易混淆
- `0` (数字零) - 与 `O`(大写o) 容易混淆
- `1` (数字一) - 与 `I`(大写i) 和 `l`(小写L) 容易混淆

**保留字符**：32个（26个字母 - 2个 + 10个数字 - 2个）
- 大写字母：24个（A-Z，去除I、O）
- 数字：8个（2-9）

### 口令长度
**4位** - 兼顾易记性和唯一性

### 组合空间
```
32^4 = 1,048,576 种组合
约 100 万个唯一口令
```

### 口令示例
```
AB2C  XY8Z  MN5K  QR7P  WE3D
FG6H  JK9L  ST4V  BN8M  CD2F
```

---

## 🏗️ 数据模型

### Creator 模型（简化版）

```go
type Creator struct {
    ID          Int64String    `json:"id"`
    UserID      Int64String    `json:"userId"`
    Name        string         `json:"name"`
    Code        string         `json:"code"`         // 4位口令
    IsActive    bool           `json:"isActive"`     // 口令开关
    
    // 空间信息
    SpaceTitle       string    `json:"spaceTitle"`
    SpaceBanner      string    `json:"spaceBanner"`
    SpaceDescription string    `json:"spaceDescription"`
    
    // 统计数据
    ViewCount        int       `json:"viewCount"`      // 浏览次数
    DownloadCount    int       `json:"downloadCount"`  // 下载次数
    Revenue          int       `json:"revenue"`        // 累计收益（分）
    
    CreatedAt   time.Time      `json:"createdAt"`
    UpdatedAt   time.Time      `json:"updatedAt"`
}
```

### CodeAccessLog 模型（访问日志）

```go
type CodeAccessLog struct {
    ID         Int64String `json:"id"`
    CreatorID  Int64String `json:"creatorId"`
    UserID     Int64String `json:"userId"`      // 可选
    Code       string      `json:"code"`
    IPAddress  string      `json:"ipAddress"`
    UserAgent  string      `json:"userAgent"`
    AccessedAt time.Time   `json:"accessedAt"`
}
```

**关键字段说明**：
- ❌ **移除** `code_expire_at` - 不需要过期时间
- ❌ **移除** `code_max_uses` - 不需要使用次数限制
- ✅ **保留** `is_active` - 创作者可以关闭口令
- ✅ **保留** `view_count` - 统计访问次数

---

## 🔧 核心功能实现

### 1. 口令生成

#### 主要方法
```go
// GenerateCode 生成4位随机口令
func GenerateCode() string
```

**实现细节**：
- 使用 `crypto/rand` 生成加密安全的随机数
- 从32个字符集中随机选择4个字符
- 如果随机失败，使用 Snowflake ID 作为后备方案

**测试结果**：
```
✅ 生成1000个口令，999个唯一，1个重复
✅ 唯一率：99.9%
✅ 理论碰撞概率：1/1,048,576 ≈ 0.0001%
```

### 2. 口令验证

#### 格式验证
```go
// ValidateCodeFormat 验证口令格式
func ValidateCodeFormat(code string) bool
```

**验证规则**：
- 长度：4位或5位（允许5位用于特殊情况）
- 字符：只能包含字符集中的字符
- 大小写：不区分（会自动转大写）

#### 标准化
```go
// NormalizeCode 标准化口令（转大写，去空格）
func NormalizeCode(code string) string
```

**处理规则**：
- 去除前后空格
- 转换为大写
- 例如：`"  ab2c  "` → `"AB2C"`

---

## 🚀 API 接口设计

### 1. 创作者注册（生成口令）

```http
POST /api/v1/creator/register
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "name": "我的创作空间",
  "spaceTitle": "精美壁纸合集",
  "spaceDescription": "每日更新高清壁纸"
}

Response:
{
  "code": 0,
  "message": "创作者注册成功",
  "data": {
    "id": "2028025683447386112",
    "code": "AB2C",           // 自动生成的4位口令
    "isActive": true,
    "createdAt": "2026-03-01T10:00:00Z"
  }
}
```

### 2. 口令开关控制

```http
PUT /api/v1/creator/code/toggle
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "isActive": false  // true=开启口令, false=关闭口令
}

Response:
{
  "code": 0,
  "message": "口令状态已更新",
  "data": {
    "isActive": false,
    "updatedAt": "2026-03-01T11:00:00Z"
  }
}
```

### 3. 重新生成口令

```http
POST /api/v1/creator/code/regenerate
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "message": "口令已重新生成",
  "data": {
    "oldCode": "AB2C",
    "newCode": "XY8Z",
    "generatedAt": "2026-03-01T12:00:00Z"
  }
}
```

### 4. 验证口令（用户端）

```http
POST /api/v1/public/code/verify
Content-Type: application/json

Request:
{
  "code": "AB2C"
}

Response - 成功:
{
  "code": 0,
  "message": "口令验证成功",
  "data": {
    "creatorId": "2028025683447386112",
    "creatorName": "我的创作空间",
    "spaceTitle": "精美壁纸合集",
    "spaceBanner": "https://...",
    "spaceDescription": "每日更新高清壁纸",
    "resourceCount": 128,
    "isValid": true
  }
}

Response - 口令不存在:
{
  "code": 40001,
  "message": "口令不存在或已失效"
}

Response - 口令已关闭:
{
  "code": 40002,
  "message": "创作者已关闭此口令"
}
```

---

## 🛡️ 安全性设计

### 1. 防暴力破解

**问题**：4位口令只有100万种组合，存在暴力破解风险

**防护措施**：

#### 方案 A：IP 限流（推荐）
```go
// 同一 IP 每小时最多尝试 10 次
const MaxAttemptsPerHour = 10

// 使用 Redis 记录尝试次数
key := fmt.Sprintf("code_verify:%s", clientIP)
count, _ := redis.Incr(key)
if count == 1 {
    redis.Expire(key, time.Hour)
}
if count > MaxAttemptsPerHour {
    return errors.New("尝试次数过多，请1小时后再试")
}
```

#### 方案 B：访问日志监控
```go
// 检测异常行为
func DetectAbnormalAccess(ip string) bool {
    // 1. 短时间内大量失败尝试
    // 2. 同一 IP 尝试多个不同口令
    // 3. 使用代理或 VPN 访问
}
```

#### 方案 C：验证码机制
```
连续失败 3 次 → 要求输入验证码
连续失败 5 次 → 封禁 IP 1 小时
```

### 2. 防爬虫

```go
// 记录访问日志，分析异常模式
type AccessPattern struct {
    IP            string
    Attempts      int       // 尝试次数
    SuccessRate   float64   // 成功率
    AccessSpeed   float64   // 访问速度（次/秒）
    UserAgentHash string    // User-Agent 哈希
}
```

### 3. 唯一性保证

```go
// 生成口令时检查唯一性
func GenerateUniqueCode(db *gorm.DB) (string, error) {
    maxAttempts := 10
    
    for i := 0; i < maxAttempts; i++ {
        code := utils.GenerateCode()
        
        var count int64
        db.Model(&model.Creator{}).Where("code = ?", code).Count(&count)
        
        if count == 0 {
            return code, nil
        }
    }
    
    // 极小概率：10次都冲突，使用5位口令
    return utils.GenerateCode() + utils.GenerateCode()[:1], nil
}
```

---

## 📊 统计与分析

### 1. 访问统计

```sql
-- 创作者空间访问趋势
SELECT 
    DATE(accessed_at) as date,
    COUNT(*) as visits,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips
FROM code_access_logs
WHERE creator_id = ?
GROUP BY DATE(accessed_at)
ORDER BY date DESC;
```

### 2. 热门创作者排行

```sql
-- 按浏览量排序
SELECT 
    id, name, code, view_count, download_count, revenue
FROM creators
WHERE is_active = true
ORDER BY view_count DESC
LIMIT 10;
```

### 3. 口令使用分析

```sql
-- 口令访问地域分布
SELECT 
    ip_address,
    COUNT(*) as access_count,
    MIN(accessed_at) as first_access,
    MAX(accessed_at) as last_access
FROM code_access_logs
WHERE creator_id = ?
GROUP BY ip_address
ORDER BY access_count DESC;
```

---

## 🎨 用户体验优化

### 1. 口令输入优化

#### 前端实现
```javascript
// 自动转大写
<input 
  type="text" 
  maxLength="4"
  placeholder="输入4位口令"
  onInput={(e) => {
    e.target.value = e.target.value.toUpperCase();
  }}
/>

// 自动去除空格
const normalizeCode = (code) => {
  return code.trim().toUpperCase();
};
```

#### 输入提示
```
请输入4位口令（大小写均可）
例如：AB2C
```

### 2. 错误提示优化

```javascript
const errorMessages = {
  40001: '口令不存在，请检查是否输入正确',
  40002: '该创作者已关闭此口令，暂时无法访问',
  40003: '访问过于频繁，请稍后再试',
};
```

### 3. 口令分享优化

#### 分享文案模板
```
📦 我的创作空间口令：AB2C
🎨 精美壁纸合集
✨ 输入口令即可访问
🔗 https://valley.com?code=AB2C
```

#### 二维码生成
```javascript
// 生成包含口令的二维码
const qrCodeData = {
  type: 'creator_space',
  code: 'AB2C',
  url: 'https://valley.com?code=AB2C'
};
```

---

## 🧪 测试结果

### 单元测试

```bash
$ go test -v ./internal/utils -run Test

✅ TestGenerateCode          - 口令生成格式正确
✅ TestGenerateCodeUniqueness - 1000个口令，999个唯一（99.9%）
✅ TestValidateCodeFormat    - 格式验证正确
✅ TestNormalizeCode         - 标准化功能正确
✅ TestGetCodeStrength       - 强度信息正确

PASS
ok      valley-server/internal/utils    0.239s
```

### 性能测试

```bash
$ go test -bench=BenchmarkGenerateCode ./internal/utils

BenchmarkGenerateCode-8   	  500000	      2841 ns/op
```

**结果**：每秒可生成约 35万 个口令

---

## 📈 扩展性考虑

### 场景 1：口令不够用了怎么办？

**当前容量**：32^4 = 1,048,576 种组合（约100万）

**解决方案**：
1. **增加长度**：改为5位 → 32^5 = 33,554,432（约3300万）
2. **分区管理**：按创作者等级分配不同长度
3. **回收机制**：删除的创作者口令可重新分配

### 场景 2：需要更高安全性

**方案**：添加口令密码
```
口令：AB2C
密码：123456（可选，创作者设置）
```

### 场景 3：需要临时口令

**方案**：添加临时口令功能
```
临时口令：有效期7天
永久口令：永久有效
```

---

## 📝 开发检查清单

- [x] 口令生成工具（utils/code.go）
- [x] 单元测试（code_test.go）
- [x] 数据模型设计
- [ ] API 接口实现
  - [ ] 创作者注册
  - [ ] 口令开关
  - [ ] 重新生成口令
  - [ ] 验证口令
- [ ] 防护机制
  - [ ] IP 限流
  - [ ] 访问日志
  - [ ] 异常检测
- [ ] 前端集成
  - [ ] 口令输入组件
  - [ ] 口令分享功能
  - [ ] 错误提示优化

---

## 🎯 下一步

1. ✅ 口令生成工具已完成
2. 🔜 实现创作者注册 API
3. 🔜 实现口令验证 API
4. 🔜 实现口令管理功能

---

## 📚 参考资料

- [Base32 编码标准](https://datatracker.ietf.org/doc/html/rfc4648)
- [防暴力破解最佳实践](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks)
- [口令设计案例：抖音口令、小红书口令](https://www.douyin.com/)

