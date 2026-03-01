# Valley MAS - 开发规范快速参考

> **保持代码一致性的黄金规则**

---

## 🎯 代码质量工具

✅ **使用 Biome**（不用 ESLint/Prettier）

```bash
# 检查并修复
pnpm biome check --write

# 只格式化
pnpm biome format --write

# 只 Lint
pnpm biome lint --write
```

📚 详细文档：[docs/CODE_QUALITY_TOOLS.md](docs/CODE_QUALITY_TOOLS.md)  
🔖 快速参考：[BIOME_QUICK_REF.md](BIOME_QUICK_REF.md)

---

## 🌐 API 请求规范

❌ **禁止在组件中直接使用** `request` 或 `axios`

✅ **所有 API 请求必须在** `src/api/` **目录定义**

### 正确示范

```typescript
// 1. 在 src/api/module.ts 定义
export const reqGetEntityList = (params: EntityListParams) => {
  return http.get<unknown, EntityListResponse>('/api/entities', { params });
};

// 2. 在组件中使用
import { reqGetEntityList, type Entity } from '../api/module';

const fetchData = useCallback(async () => {
  const response = await reqGetEntityList(params);
  setData(response.list);
}, [params]);
```

### 错误示范

```typescript
// ❌ 不要这样做
import request from '../utils/request';

const fetchData = async () => {
  const res = await request.get('/api/entities');
};
```

### 命名规范

- 函数：`reqGetUserList`, `reqCreateUser`, `reqDeleteUser`
- 类型：`User`, `UserListParams`, `UserListResponse`

📚 详细文档：[docs/API_REQUEST_GUIDE.md](docs/API_REQUEST_GUIDE.md)

---

## 📋 Git 提交检查

提交代码前确认：

- [ ] 运行 `pnpm biome check --write` 修复格式问题
- [ ] API 请求都在 `src/api/` 目录
- [ ] 没有直接使用 `request` 或 `axios`
- [ ] TypeScript 类型定义完整
- [ ] 使用 `useCallback` 优化请求函数
- [ ] `useEffect` 依赖数组正确

---

## 🔗 相关文档

| 文档 | 说明 |
|------|------|
| [CODE_QUALITY_TOOLS.md](docs/CODE_QUALITY_TOOLS.md) | Biome 完整使用指南 |
| [API_REQUEST_GUIDE.md](docs/API_REQUEST_GUIDE.md) | API 请求规范详解 |
| [BIOME_QUICK_REF.md](BIOME_QUICK_REF.md) | Biome 快速命令参考 |

---

**✨ 记住：规范 = 效率 = 质量**
