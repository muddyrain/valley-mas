# API 请求规范

> **统一 API 请求格式规范** - 保持项目代码一致性

---

## 📋 规范概述

本项目前端使用统一的 API 请求封装模式，所有请求必须通过 `src/api/` 目录下的模块进行，**禁止在组件中直接使用 `request` 或 `axios`**。

---

## 🎯 核心原则

1. **API 集中管理** - 所有接口定义在 `src/api/` 目录
2. **类型安全** - 使用 TypeScript 完整定义请求/响应类型
3. **命名规范** - 统一使用 `reqXxx` 前缀命名请求函数
4. **单一职责** - 一个 API 文件对应一个业务模块
5. **可维护性** - 便于接口变更、测试和文档生成

---

## 📁 目录结构

```
src/api/
  ├── auth.ts         # 认证相关接口
  ├── user.ts         # 用户管理接口
  ├── resource.ts     # 资源管理接口
  └── ...             # 其他业务模块
```

---

## ✅ 标准格式（推荐）

### 1. API 文件结构模板

```typescript
// src/api/module.ts
import type { PaginationParams, PaginationResponse } from '../types/api';
import http from '../utils/request';

// ============ 类型定义 ============

/** 实体接口定义 */
export interface Entity {
  id: string; // Snowflake ID (后端 int64，序列化为字符串)
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** 列表查询参数 */
export interface EntityListParams extends PaginationParams {
  keyword?: string;
  status?: string;
}

/** 列表响应 */
export type EntityListResponse = PaginationResponse<Entity>;

/** 创建/更新参数 */
export interface EntityFormData {
  name: string;
  status: string;
}

// ============ API 请求函数 ============

/** 获取列表 */
export const reqGetEntityList = (params: EntityListParams) => {
  return http.get<unknown, EntityListResponse>('/api/entities', { params });
};

/** 获取详情 */
export const reqGetEntityDetail = (id: string) => {
  return http.get<unknown, Entity>(`/api/entities/${id}`);
};

/** 创建 */
export const reqCreateEntity = (data: EntityFormData) => {
  return http.post<unknown, Entity>('/api/entities', data);
};

/** 更新 */
export const reqUpdateEntity = (id: string, data: Partial<EntityFormData>) => {
  return http.put<unknown, Entity>(`/api/entities/${id}`, data);
};

/** 删除 */
export const reqDeleteEntity = (id: string) => {
  return http.delete<unknown, null>(`/api/entities/${id}`);
};
```

### 2. 组件中使用

```tsx
// src/pages/EntityList.tsx
import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import {
  reqGetEntityList,
  reqDeleteEntity,
  type Entity,
  type EntityListParams,
} from '../api/entity';

export default function EntityList() {
  const [data, setData] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // ✅ 使用 useCallback 优化
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: EntityListParams = { page, pageSize };
      const response = await reqGetEntityList(params);
      setData(response.list);
    } catch (error) {
      message.error('获取数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  // ✅ 依赖 fetchData
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ✅ 删除操作
  const handleDelete = async (id: string) => {
    try {
      await reqDeleteEntity(id);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  return (
    <div>
      {/* UI 组件 */}
    </div>
  );
}
```

---

## ❌ 错误示范（禁止）

### 1. 直接在组件中使用 request

```tsx
// ❌ 错误：不要在组件中直接调用 request
import request from '../utils/request';

const fetchData = async () => {
  const response = await request.get('/api/entities');
  setData(response.data);
};
```

### 2. 没有类型定义

```tsx
// ❌ 错误：缺少类型定义
export const reqGetList = (params: any) => {
  return http.get('/api/entities', { params });
};
```

### 3. 命名不规范

```tsx
// ❌ 错误：命名不符合规范
export const getList = () => { ... }        // 缺少 req 前缀
export const fetchEntityList = () => { ... } // 不使用 fetch 前缀
export const apiGetList = () => { ... }      // 不使用 api 前缀
```

---

## 📝 命名规范

### API 函数命名

| 操作 | 命名格式 | 示例 |
|------|---------|------|
| 获取列表 | `reqGet{Module}List` | `reqGetUserList` |
| 获取详情 | `reqGet{Module}Detail` | `reqGetUserDetail` |
| 创建 | `reqCreate{Module}` | `reqCreateUser` |
| 更新 | `reqUpdate{Module}` | `reqUpdateUser` |
| 删除 | `reqDelete{Module}` | `reqDeleteUser` |
| 上传 | `reqUpload{Module}` | `reqUploadResource` |
| 自定义操作 | `req{Action}{Module}` | `reqUpdateUserStatus` |

### 类型命名

| 类型 | 命名格式 | 示例 |
|------|---------|------|
| 实体 | `{Module}` | `User`, `Resource` |
| 列表参数 | `{Module}ListParams` | `UserListParams` |
| 列表响应 | `{Module}ListResponse` | `UserListResponse` |
| 表单数据 | `{Module}FormData` | `UserFormData` |
| 枚举类型 | `{Module}{Field}` | `ResourceType` |

---

## 🔧 特殊场景处理

### 1. FormData 上传

```typescript
/** 上传资源 */
export const reqUploadResource = (formData: FormData) => {
  return http.post<unknown, UploadResponse>('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};
```

### 2. 下载文件

```typescript
/** 下载资源 */
export const reqDownloadResource = (id: string) => {
  return http.get<unknown, Blob>(`/api/resources/${id}/download`, {
    responseType: 'blob',
  });
};
```

### 3. 批量操作

```typescript
/** 批量删除 */
export const reqBatchDeleteUsers = (ids: string[]) => {
  return http.post<unknown, null>('/api/users/batch-delete', { ids });
};
```

### 4. 无参数请求

```typescript
/** 获取统计数据 */
export const reqGetStats = () => {
  return http.get<unknown, StatsResponse>('/api/stats');
};
```

---

## 🎨 完整示例文件

参考现有实现：

- **用户管理**: `src/api/user.ts` - 标准 CRUD + 状态更新
- **资源管理**: `src/api/resource.ts` - 列表/上传/删除
- **认证模块**: `src/api/auth.ts` - 登录/登出/刷新 Token

---

## 📊 类型系统

### 通用分页类型

```typescript
// src/types/api.ts

/** 分页查询参数 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** 分页响应 */
export interface PaginationResponse<T> {
  list: T[];
  total: number;
}
```

### ID 类型说明

```typescript
/**
 * Snowflake ID 类型说明
 * 
 * - 后端使用 Snowflake 算法生成 int64 ID
 * - JavaScript 不支持 int64，超过 2^53-1 会丢失精度
 * - 后端序列化为 string 传输到前端
 * - 前端统一使用 string 类型定义 ID
 */
export interface Entity {
  id: string; // ✅ 使用 string，不使用 number
}
```

---

## ✅ 代码检查清单

在提交代码前，请确认：

- [ ] 所有 API 请求都在 `src/api/` 目录定义
- [ ] 没有在组件中直接使用 `request` 或 `axios`
- [ ] 所有接口都有完整的 TypeScript 类型定义
- [ ] 函数命名符合 `reqXxx` 规范
- [ ] 类型命名清晰且一致
- [ ] 使用 `useCallback` 优化列表请求函数
- [ ] `useEffect` 依赖数组正确声明
- [ ] 错误处理使用 `try-catch` 并显示友好提示
- [ ] ID 类型使用 `string` 而非 `number`

---

## 🚀 迁移指南

### 旧代码迁移步骤

1. **创建 API 文件**
   ```bash
   # 在 src/api/ 下创建对应模块文件
   touch src/api/module.ts
   ```

2. **定义类型和接口**
   ```typescript
   // 参考模板定义类型和 API 函数
   export interface Module { ... }
   export const reqGetModuleList = () => { ... }
   ```

3. **更新组件导入**
   ```typescript
   // 替换 request 导入
   - import request from '../utils/request';
   + import { reqGetModuleList, type Module } from '../api/module';
   ```

4. **替换请求调用**
   ```typescript
   // 替换直接调用
   - const res = await request.get('/api/modules');
   + const res = await reqGetModuleList(params);
   ```

5. **运行 Biome 检查**
   ```bash
   pnpm biome check --write
   ```

---

## 📚 相关文档

- [Biome 代码规范](./CODE_QUALITY_TOOLS.md)
- [TypeScript 类型定义](../apps/admin/src/types/api.ts)
- [Axios 请求封装](../apps/admin/src/utils/request.ts)

---

**✨ 保持规范，提升代码质量！**
