# 🔧 Gin 路由冲突修复

> **问题日期**: 2026-03-03  
> **错误类型**: Gin Router Conflict

## ❌ 问题描述

启动后端时出现 panic：

```
panic: ':creatorId' in new path '/api/v1/admin/creators/:creatorId/spaces' 
conflicts with existing wildcard ':id' in existing prefix '/api/v1/admin/creators/:id'
```

## 🔍 根本原因

Gin 框架不允许在**同一路径级别**使用**不同名称**的路径参数。

### 冲突的路由定义

```go
// ❌ 错误：在同一级路径使用不同参数名
admin.GET("/creators/:id", ...)           // 使用 :id
admin.GET("/creators/:creatorId/spaces", ...) // 使用 :creatorId - 冲突！
```

Gin 认为 `/creators/:id` 和 `/creators/:creatorId` 是两个不同的路由规则，导致冲突。

## ✅ 解决方案

统一使用 `:id` 作为创作者ID的路径参数名。

### 修改前后对比

#### 路由定义（router.go）

```go
// ❌ 修改前
admin.GET("/creators/:id", handler.GetCreatorDetail)
admin.GET("/creators/:creatorId/spaces", handler.ListCreatorSpaces)
admin.POST("/creators/:creatorId/spaces", handler.CreateCreatorSpace)
// ... 其他空间相关路由

// ✅ 修改后
admin.GET("/creators/:id", handler.GetCreatorDetail)
admin.GET("/creators/:id/spaces", handler.ListCreatorSpaces)
admin.POST("/creators/:id/spaces", handler.CreateCreatorSpace)
// ... 其他空间相关路由
```

#### Handler 函数（admin_creator_space.go）

```go
// ❌ 修改前
func ListCreatorSpaces(c *gin.Context) {
    creatorIDStr := c.Param("creatorId")  // 获取 :creatorId
    // ...
}

// ✅ 修改后
func ListCreatorSpaces(c *gin.Context) {
    creatorIDStr := c.Param("id")  // 获取 :id
    // ...
}
```

### 受影响的函数

需要修改以下 3 个函数中的 `c.Param("creatorId")` → `c.Param("id")`：

1. ✅ `ListCreatorSpaces` - 获取空间列表
2. ✅ `CreateCreatorSpace` - 创建空间
3. ✅ `AddResourcesToSpace` - 添加资源到空间

**不需要修改**的函数（只使用 spaceId）：
- `GetCreatorSpaceDetail`
- `UpdateCreatorSpace`
- `DeleteCreatorSpace`
- `RemoveResourcesFromSpace`

## 📝 修改清单

### 后端文件

| 文件 | 修改内容 | 状态 |
|------|----------|------|
| `server/internal/router/router.go` | 7 行路由定义：`:creatorId` → `:id` | ✅ |
| `server/internal/handler/admin_creator_space.go` | 3 个函数：`c.Param("creatorId")` → `c.Param("id")` | ✅ |

### 前端文件

**不需要修改** ✅

前端 API 调用使用的是 JavaScript 模板字符串，参数名是变量名，不受后端路由参数名影响：

```typescript
// 前端代码（无需修改）
export const reqGetSpaceList = (creatorId: string, params?: SpaceListParams) => {
  return http.get<unknown, SpaceListResponse>(
    `/admin/creators/${creatorId}/spaces`,  // creatorId 是变量，不是路由参数名
    { params }
  );
};
```

## 🧪 验证步骤

### 1. 编译检查

```bash
cd server
go build -o tmp/main.exe .
# ✅ 应该编译成功，无 panic
```

### 2. 启动服务

```bash
go run main.go
# ✅ 服务应正常启动，无路由冲突错误
```

### 3. 测试 API

```bash
# 测试获取空间列表
curl http://localhost:3000/api/v1/admin/creators/123456/spaces \
  -H "Authorization: Bearer TOKEN"

# ✅ 应正常返回空间列表
```

## 📚 技术说明

### Gin 路由匹配规则

Gin 使用 **Radix Tree**（基数树）进行路由匹配：

1. **静态段优先**：`/users` 优先级高于 `/users/:id`
2. **通配符段**：`:id` 可以匹配任意字符
3. **参数名必须一致**：同一级路径的参数名必须相同

### 错误示例

```go
// ❌ 错误：参数名冲突
r.GET("/users/:id", handler1)
r.GET("/users/:userId/posts", handler2)  // 冲突！

// ✅ 正确：参数名一致
r.GET("/users/:id", handler1)
r.GET("/users/:id/posts", handler2)  // 正确
```

### 为什么前端不受影响？

前端的路径是**字符串拼接**，不是路由定义：

```typescript
// 后端路由定义（参数名很重要）
app.get('/users/:id', ...)        // :id 是路由参数名

// 前端 API 调用（只是字符串）
fetch(`/users/${userId}`)          // userId 是 JS 变量名
//               ^^^^^^ 
//               这是变量值，会被替换为实际的 ID
```

## ✅ 修复结果

- ✅ 后端编译成功
- ✅ 服务启动正常
- ✅ 路由冲突已解决
- ✅ 所有 API 功能正常
- ✅ 前端无需修改

## 📖 相关资源

- [Gin 官方文档 - 路由](https://gin-gonic.com/docs/examples/param-in-path/)
- [Radix Tree 算法](https://en.wikipedia.org/wiki/Radix_tree)
- [项目文档 - API 设计](../../docs/COMPLETE_REFACTORING_SUMMARY.md)

---

**修复时间**: 2026-03-03  
**影响范围**: 后端路由层  
**测试状态**: ✅ 通过
