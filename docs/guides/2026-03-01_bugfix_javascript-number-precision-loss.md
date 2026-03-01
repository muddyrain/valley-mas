# 修复 JavaScript 数字精度丢失导致的 ID 重复问题

## 🐛 问题描述

在前端用户列表页面，所有用户的 ID 显示为相同的数字（如 `2028025683447386000`），但实际上数据库中的 ID 是唯一的：

```
数据库中的实际 ID：
2028025683447386112  (admin)
2028025683447386113  (admin1)
2028025683447386114  (admin2)
2028025683447386115  (creator)
2028025683447386116  (admin3)

前端显示的 ID（精度丢失）：
2028025683447386000  (所有用户都显示为这个数字！)
2028025683447386000
2028025683447386000
2028025683447386000
2028025683447386000
```

## 🔍 根本原因

### JavaScript 数字精度限制

JavaScript 的 `number` 类型使用 **IEEE 754 双精度浮点数**，只能安全表示以下范围的整数：

```javascript
Number.MIN_SAFE_INTEGER  // -(2^53 - 1) = -9007199254740991
Number.MAX_SAFE_INTEGER  //  (2^53 - 1) =  9007199254740991
```

而 Snowflake ID 是 **int64**，范围远超 JavaScript 安全整数范围：

```javascript
// Snowflake ID
2028025683447386112  // > Number.MAX_SAFE_INTEGER

// JavaScript 处理后（精度丢失）
2028025683447386000  // 后3位被截断为000
```

### 验证测试

```javascript
const id = 2028025683447386112;
console.log(id);                    // 输出：2028025683447386000
console.log(id === 2028025683447386112);  // false（精度已丢失）

// 多个连续 ID 都被截断为同一个数字
const ids = [
  2028025683447386112,
  2028025683447386113,
  2028025683447386114,
  2028025683447386115
];
console.log(new Set(ids).size);     // 输出：1（所有ID变成同一个）
```

## ✅ 解决方案

### 方案：将 int64 ID 序列化为字符串

在 Go 后端，将所有 int64 ID 序列化为 JSON 字符串，避免 JavaScript 精度丢失。

### 1. 后端修改 - 自定义类型 `Int64String`

**文件：`server/internal/model/model.go`**

```go
package model

import (
	"database/sql/driver"
	"encoding/json"
	"strconv"
)

// Int64String 用于将 int64 序列化为字符串，避免 JavaScript 精度丢失
type Int64String int64

// MarshalJSON 将 int64 序列化为 JSON 字符串
func (i Int64String) MarshalJSON() ([]byte, error) {
	return json.Marshal(strconv.FormatInt(int64(i), 10))
}

// UnmarshalJSON 从 JSON 字符串或数字反序列化为 int64
func (i *Int64String) UnmarshalJSON(data []byte) error {
	// 尝试解析为字符串
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		val, err := strconv.ParseInt(str, 10, 64)
		if err != nil {
			return err
		}
		*i = Int64String(val)
		return nil
	}

	// 尝试解析为数字（兼容旧数据）
	var num int64
	if err := json.Unmarshal(data, &num); err != nil {
		return err
	}
	*i = Int64String(num)
	return nil
}

// Value 实现 driver.Valuer 接口，用于 GORM 写入数据库
func (i Int64String) Value() (driver.Value, error) {
	return int64(i), nil
}

// Scan 实现 sql.Scanner 接口，用于 GORM 读取数据库
func (i *Int64String) Scan(value interface{}) error {
	if value == nil {
		*i = 0
		return nil
	}
	switch v := value.(type) {
	case int64:
		*i = Int64String(v)
	case []byte:
		val, _ := strconv.ParseInt(string(v), 10, 64)
		*i = Int64String(val)
	case string:
		val, _ := strconv.ParseInt(v, 10, 64)
		*i = Int64String(val)
	default:
		return fmt.Errorf("cannot scan type %T into Int64String", value)
	}
	return nil
}
```

### 2. 更新所有模型

```go
// User 模型
type User struct {
	ID       Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	// ... 其他字段
}

// BeforeCreate 钩子
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == 0 {
		u.ID = Int64String(utils.GenerateID())  // 类型转换
	}
	return nil
}

// Creator 模型
type Creator struct {
	ID     Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID Int64String `gorm:"index" json:"userId"`
	// ...
}

// Resource 模型
type Resource struct {
	ID        Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	CreatorID Int64String `gorm:"index" json:"creatorId"`
	// ...
}

// DownloadRecord 模型
type DownloadRecord struct {
	ID         Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID     Int64String `gorm:"index" json:"userId"`
	ResourceID Int64String `gorm:"index" json:"resourceId"`
	CreatorID  Int64String `gorm:"index" json:"creatorId"`
	// ...
}

// UploadRecord 模型
type UploadRecord struct {
	ID         Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	CreatorID  Int64String `gorm:"index" json:"creatorId"`
	ResourceID Int64String `gorm:"index" json:"resourceId"`
	// ...
}
```

### 3. 前端修改 - 更新类型定义

**文件：`apps/admin/src/api/user.ts`**

```typescript
// 用户接口定义
export interface User {
  id: string;  // ← 从 number 改为 string
  nickname: string;
  avatar: string;
  // ... 其他字段
}

// API 函数参数也要改为 string
export const reqGetUserDetail = (id: string) => {
  return http.get<unknown, User>(`/admin/users/${id}`);
};

export const reqUpdateUser = (id: string, data: Partial<User>) => {
  return http.put<unknown, User>(`/admin/users/${id}`, data);
};

export const reqUpdateUserStatus = (id: string, isActive: boolean) => {
  return http.put<unknown, null>(`/admin/users/${id}/status`, { isActive });
};

export const reqDeleteUser = (id: string) => {
  return http.delete<unknown, null>(`/admin/users/${id}`);
};
```

**文件：`apps/admin/src/pages/Users.tsx`**

```typescript
// State 类型改为 string
const [editId, setEditId] = useState<string | null>(null);

// 函数参数类型改为 string
const toggleStatus = async (id: string, checked: boolean) => {
  // ...
};

const handleDelete = async (id: string) => {
  // ...
};
```

## 📊 修复前后对比

### API 响应变化

**修复前（数字，有精度丢失）：**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 2028025683447386000,  // ← 精度丢失，后3位变成000
        "username": "admin",
        "nickname": "管理员"
      },
      {
        "id": 2028025683447386000,  // ← 所有ID都一样！
        "username": "admin1",
        "nickname": "测试用户1"
      }
    ]
  }
}
```

**修复后（字符串，精度完整）：**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "2028025683447386112",  // ← 字符串，精度完整
        "username": "admin",
        "nickname": "管理员"
      },
      {
        "id": "2028025683447386113",  // ← 每个ID都不同
        "username": "admin1",
        "nickname": "测试用户1"
      }
    ]
  }
}
```

### 前端处理

```typescript
// 修复前：直接使用 number（精度丢失）
const users: User[] = [
  { id: 2028025683447386112, username: "admin" },
  { id: 2028025683447386113, username: "admin1" }
];
console.log(users[0].id);  // 2028025683447386000
console.log(users[1].id);  // 2028025683447386000  ← 相同！

// 修复后：使用 string（精度完整）
const users: User[] = [
  { id: "2028025683447386112", username: "admin" },
  { id: "2028025683447386113", username: "admin1" }
];
console.log(users[0].id);  // "2028025683447386112"
console.log(users[1].id);  // "2028025683447386113"  ← 不同！
```

## 🎯 验证步骤

### 1. 后端验证

```bash
# 启动后端
cd server
go run main.go

# 访问初始化接口
curl http://localhost:8080/init-data?force=true

# 验证返回的 JSON 中 ID 是字符串
# 应该看到：
# "id": "2028025683447386112"  ← 带引号的字符串
```

### 2. 前端验证

```bash
# 启动前端
cd apps/admin
pnpm dev

# 访问用户列表页面
# 查看浏览器控制台的 Network 请求
# Response 中的 id 字段应该是字符串
```

### 3. 数据库验证

```bash
# 查询数据库，确认 ID 仍然是 int64
sqlite3 server/data/valley.db "SELECT id, username FROM users LIMIT 5;"

# 输出应该是：
# 2028025683447386112|admin
# 2028025683447386113|admin1
# 2028025683447386114|admin2
# ...
```

## 📚 相关资源

### JavaScript 精度问题

- [Number.MAX_SAFE_INTEGER - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
- [IEEE 754 浮点数标准](https://en.wikipedia.org/wiki/IEEE_754)

### Go JSON 序列化

- [json.Marshal 自定义](https://pkg.go.dev/encoding/json#Marshaler)
- [GORM 自定义类型](https://gorm.io/docs/data_types.html)

### Snowflake ID

- [Twitter Snowflake 算法](https://github.com/twitter-archive/snowflake)
- [为什么使用 Snowflake ID](https://tech.meituan.com/2017/04/21/mt-leaf.html)

## 💡 最佳实践

### 1. 为什么不使用 BigInt？

虽然 JavaScript 有 `BigInt` 类型，但有以下问题：

```typescript
// BigInt 的问题
const id = 2028025683447386112n;  // ← 需要 'n' 后缀
JSON.stringify({ id });             // ❌ 报错：BigInt 不能序列化

// 需要自定义序列化
JSON.stringify({ id: id.toString() });  // ✅ 但不如直接用 string
```

### 2. 为什么后端转换而不是前端转换？

- ✅ **后端统一处理**：一次修改，所有前端受益（Web、小程序、移动端）
- ✅ **类型安全**：前端直接用 `string`，不需要手动转换
- ✅ **避免遗漏**：不会忘记在某个地方转换

### 3. 性能影响

字符串 vs 数字的性能对比：

| 操作 | 数字 | 字符串 | 差异 |
|---|---|---|---|
| JSON 序列化 | 快 | 稍慢 | ~5% |
| 内存占用 | 8 bytes | ~20 bytes | +150% |
| 比较操作 | 快 | 稍慢 | ~10% |
| 数据库存储 | int64 | int64 | 无差异 |

**结论：可以忽略的性能差异，换来的是绝对正确性！**

## 🚀 未来优化

如果未来需要在前端进行 ID 计算（不推荐），可以考虑：

1. **使用 BigInt 库**：如 `big-integer`
2. **自定义序列化**：`JSON.parse` 时自动转换
3. **改用 UUID**：完全随机，但失去时间排序特性

但对于大多数场景，**字符串 ID 是最佳方案**！
